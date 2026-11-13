import * as THREE from 'three';
import { b2t } from '../engine.js';
import { U, patched } from './lit.js';
import { loadRangeRoom, breathe, prepare } from './room.js';
import { makeGun } from './gun.js';
import { makeFx } from './fx.js';
import { makeTargets } from './targets.js';
import { makeHud } from './hud.js';
import { stats, damageAt, nextGun } from '../pure/arsenal.js';
import { newWeapon, step as stepWeapon, spreadNow, scatter } from '../pure/weapon.js';
import { STAGES, STAGE, DIFFICULTIES, openStages, totalStars, starScores } from '../pure/stages.js';
import { newRun, step as stepRun, fired, hit as hitRun, quit as quitRun } from '../pure/rangegame.js';
import { spring, springStep, kick, critical } from '../pure/springs.js';

// The range: its rooms (fetched after the house) and the game at the firing line. You stand at the bench, look and
// aim with the mouse, step along the line, duck behind the bench, and shoot what the stage sends: the rules live in
// src/pure (the guns, the weapon in the hand, the stages, the run), and this file joins them to what is seen and heard.
const EYE = 1.56, DUCK = 0.52, YAW_MAX = 1.2, PITCH_MAX = 0.62, LOOK = 0.0021, TOUCH_LOOK = 0.0052, STEP = 2.6, COUNT = 0.62;
// The stages this build can play; the rest need the guns and attachments still to come.
const READY = new Set(['warmup', 'walkers', 'swarm']);
const rad = THREE.MathUtils.degToRad;

export function makeRange({ engine, camera, meta, canvas, coarse, visible, sfx, progress, look, onReady, onExit, onResult }) {
  // A world file from before these rooms were built has none of this: the house opens as ever and the range is not offered.
  const built = !!(meta.range?.stand && meta.range.line && meta.range.strafe && meta.zones.some(z => z.id === 'range' && z.light));
  const R = built ? meta.range : { stand: [0, 0, 0], line: [0, 0], strafe: [0, 0], bench: 1 }, stand = b2t(...R.stand);
  let room = null, gun = null, fx = null, targets = null, loading = null, hud = null;
  let active = false, state = 'off', enterK = 0, baseFov = camera.fov;
  let along = 0, yaw = 0, pitch = 0, duck = 0, lastYaw = 0, lastPitch = 0, alongV = 0;
  let s = stats('pistol', []), w = newWeapon(s), run = null, countT = 0, countN = 0;
  const pick = { stage: 'warmup', difficulty: 'normal' };
  let aimHeld = false;
  const input = { fire: false, aim: false, reload: false, left: false, right: false, crouch: false, step: 0 };
  const kickUp = spring(150, critical(150) * 0.8), kickSide = spring(150, critical(150) * 0.8);
  const from = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, eye = new THREE.Vector3(), aim = new THREE.Euler(0, 0, 0, 'YXZ'), q = new THREE.Quaternion();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), dir = new THREE.Vector3(), caster = new THREE.Raycaster();
  let flashRoom = null, flashStage = null, flashT = 9, flashK = 0;
  // For the checks: with a film on, time moves only by what `advance` hands out, so a shot can be looked at frame by frame.
  let film = null;

  function load() {
    if (!built) return Promise.reject(new Error('this world file has no range rooms'));
    loading ||= (async () => {
      const r = await loadRangeRoom(meta, engine.renderer, { small: coarse });
      await breathe();
      const g = await makeGun({ env: r.env });
      await breathe();
      // The bench's top and the floor are what a spent case lands on.
      const b0 = b2t(R.strafe[0] - 1, R.line[1] - 0.3, 0), b1 = b2t(R.strafe[1] + 1, R.line[1] + 0.3, 0);
      fx = makeFx(r.stage, { tops: [{ x0: Math.min(b0.x, b1.x), x1: Math.max(b0.x, b1.x), z0: Math.min(b0.z, b1.z), z1: Math.max(b0.z, b1.z), y: R.bench }], onCasing: (p, k) => sfx?.casing(p, k) });
      targets = makeTargets(r.stage, fx, meta, { sfx });
      flashRoom = new THREE.PointLight(0xffc27a, 0, 11, 2); flashStage = flashRoom.clone();
      r.scene.add(flashRoom); r.stage.add(flashStage);
      // The pistol hangs on the gun wall's first mount, side on (the other mounts fill as the guns are built).
      if (R.mounts?.[0]) {
        const show = g.model.clone(true), drop = [];
        show.traverse(o => { if (o.isLight) drop.push(o); else if (/hand|_att_|casing|round_ext/.test(o.name)) o.visible = false; o.frustumCulled = true; });
        for (const o of drop) o.parent.remove(o);
        show.position.copy(b2t(...R.mounts[0])).add(v1.set(0, 0.05, -0.08)); show.rotation.y = -Math.PI / 2; show.scale.setScalar(1.25);
        r.stage.add(show);
      }
      // A spent case waits out of sight in the room, so the first one thrown costs nothing to prepare.
      const first = g.newCasing();
      first.visible = false; r.stage.add(first);
      await r.warmUp(camera);
      await breathe();
      await prepare(engine.renderer, g.scene, g.camera);
      room = r; gun = g;
      engine.addLayer({ scene: r.scene, under: true, on: () => active || visible() });
      engine.addLayer({ scene: r.stage, under: true, on: () => active || visible() });
      engine.addLayer({ scene: g.scene, camera: g.camera, clearDepth: true, on: () => active });
      drawBoard();
      onReady?.(r);
      return r;
    })();
    // A fetch that failed can be tried again (the bookcase asks each time it is pulled).
    loading.catch(() => { loading = null; });
    return loading;
  }

  // ---------- the board by the line ----------
  function drawBoard() {
    if (!room) return;
    const c = room.board.canvas, g = c.getContext('2d'), best = progress.rangeBest(), stars = totalStars(best), next = nextGun(stars);
    const mono = (px, weight = 600) => `${weight} ${px}px ui-monospace, Menlo, Consolas, monospace`;
    g.fillStyle = '#060b10'; g.fillRect(0, 0, c.width, c.height);
    g.textBaseline = 'top';
    g.fillStyle = '#5fe3d0'; g.font = mono(44); g.fillText('RANGE', 44, 36);
    g.fillStyle = '#ffc24a'; g.font = mono(96); g.fillText(String(stars), 44, 100);
    const wide = g.measureText(String(stars)).width;
    g.fillStyle = '#8fa7ae'; g.font = mono(34, 400); g.fillText(`of ${STAGES.length * 3} stars`, 64 + wide, 150);
    STAGES.forEach((st, i) => {
      const b = best[st.id] || {}, n = Math.max(b.easy | 0, b.normal | 0, b.hard | 0), y = 262 + i * 56;
      g.fillStyle = '#e9f3f6'; g.font = mono(32); g.fillText(st.name, 44, y);
      g.font = mono(34, 400);
      for (let k = 0; k < 3; k++) { g.fillStyle = k < n ? '#ffc24a' : '#26323a'; g.fillText('★', 520 + k * 46, y - 2); }
    });
    g.fillStyle = '#8fa7ae'; g.font = mono(28, 400);
    g.fillText(next ? `${next.need} more for the ${next.name}` : 'Every gun is yours', 44, c.height - 50);
    room.board.texture.needsUpdate = true;
  }

  // ---------- the cards ----------
  // Letting go of everything: a key or a button released while a card was up (or the window was away) never reaches
  // the page, and must not still be down when play goes on.
  const release = () => { Object.assign(input, { fire: false, aim: false, reload: false, left: false, right: false, crouch: false, step: 0 }); alongV = 0; };
  const lock = () => { if (!coarse && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock()?.catch?.(() => {}); } catch (e) { /* no pointer lock here: the mouse still aims */ } } };
  const unlock = () => { if (document.pointerLockElement === canvas) document.exitPointerLock(); };
  function menu() {
    state = 'menu'; unlock(); run = null;
    targets.clear();
    const best = progress.rangeBest(), open = openStages(best), { el } = hud;
    if (!open.includes(pick.stage) || !READY.has(pick.stage)) pick.stage = 'warmup';
    const list = el('div', 'rg-list');
    for (const st of STAGES) {
      const b = best[st.id] || {}, n = Math.max(b.easy | 0, b.normal | 0, b.hard | 0), ok = open.includes(st.id) && READY.has(st.id);
      const row = el('button', pick.stage === st.id ? 'on' : '');
      const mark = el('span');
      for (let k = 0; k < 3; k++) mark.append(k < n ? el('b', '', '★') : document.createTextNode('★'));
      row.append(document.createTextNode(st.name), mark, el('small', '', !READY.has(st.id) ? 'Opens with the next guns.' : ok ? st.line : 'Earn a star on the stage before it.'));
      row.disabled = !ok;
      row.addEventListener('click', () => { pick.stage = st.id; menu(); });
      list.append(row);
    }
    const seg = el('div', 'rg-seg');
    for (const [id, d] of Object.entries(DIFFICULTIES)) { const bt = el('button', pick.difficulty === id ? 'on' : '', d.name); bt.addEventListener('click', () => { pick.difficulty = id; menu(); }); seg.append(bt); }
    const stars = totalStars(best), next = nextGun(stars);
    hud.card([el('h2', '', 'THE RANGE'), el('h3', '', 'Pick a stage'), el('p', '', `${stars} of ${STAGES.length * 3} stars. Stars unlock guns${next ? `: ${next.need} more for the ${next.name} (${next.kind.toLowerCase()})` : ''}. The other guns and the last two stages are still being built.`), list, seg],
      [['Start', () => start(pick.stage, pick.difficulty), true], ['Leave', () => api.exit()]]);
    hud.set({ playing: false });
  }
  function start(stage, difficulty, seed) {
    hud.closeCard(); release();
    run = newRun(stage, difficulty, seed || (Math.random() * 1e6) | 0 || 1);
    w = newWeapon(s); gun.draw(); targets.clear(); fx.clear();
    hud.stage(STAGE[stage].name, DIFFICULTIES[difficulty].name);
    state = 'count'; countT = 0; countN = 3; hud.big('3'); sfx?.beep(false);
    lock();
  }
  function pause() {
    if (state !== 'play' && state !== 'count') return;
    const was = state;
    state = 'paused'; unlock(); release();
    const { el } = hud;
    hud.card([el('h2', '', 'PAUSED'), el('h3', '', STAGE[run.stage].name)], [['Resume', () => { hud.closeCard(); release(); state = was; lock(); }, true], ['Stages', () => { quitRun(run); menu(); }], ['Leave', () => api.exit()]]);
  }
  function finish(res) {
    state = 'over'; unlock(); release();
    const got = progress.rangeResult(res.stage, res.difficulty, res.stars, res.score), { el } = hud;
    drawBoard();
    const more = onResult?.(res, got) || [];
    sfx?.stars(res.stars);
    const marks = starScores(run.par * run.scale), rows = el('div', 'rg-rows');
    for (const [k, val] of [['Targets', `${res.kills} of ${res.total}`], ['Accuracy', `${Math.round(res.accuracy * 100)}%`], ['Weak spots', String(res.weak)], ['Best streak', `x${res.streak}`]]) rows.append(document.createTextNode(k), el('b', '', val));
    const lines = [];
    if (res.failed) lines.push('Out of shields.');
    else if (res.stars < 3) lines.push(`${marks[res.stars]} for ${res.stars + 1} star${res.stars ? 's' : ''}.`);
    if (got.best) lines.push('A new best.');
    for (const name of got.guns) lines.push(`Unlocked: the ${name}. It will hang on the gun wall once it is built.`);
    for (const name of more) lines.push(`Unlocked: ${name}.`);
    const nextStage = STAGES[STAGES.findIndex(x => x.id === res.stage) + 1];
    const canNext = res.stars > 0 && nextStage && READY.has(nextStage.id) && openStages(progress.rangeBest()).includes(nextStage.id);
    const again = ['Again', () => start(res.stage, res.difficulty), !canNext];
    hud.card([el('h2', '', `${STAGE[res.stage].name.toUpperCase()} · ${DIFFICULTIES[res.difficulty].name.toUpperCase()}`), el('div', 'rg-num', String(res.score)), hud.stars(res.stars), rows, ...lines.map(l => el('p', '', l))],
      [...(canNext ? [['Next stage', () => { pick.stage = nextStage.id; start(nextStage.id, res.difficulty); }, true]] : []), again, ['Stages', () => menu()], ['Leave', () => api.exit()]]);
    hud.set({ playing: false });
  }

  // ---------- shooting ----------
  function shoot(ev) {
    sfx?.gunShot(ev.loud);
    if (run && state === 'play') fired(run);
    // The shot leaves along the eye's line, off by its share of the spread.
    const [sx, sy] = scatter(ev.spread);
    aim.set(pitch + kickUp.x + rad(sy), Math.PI + yaw + kickSide.x + rad(sx), 0);
    dir.set(0, 0, -1).applyEuler(aim);
    caster.set(camera.position, dir); caster.far = 130;
    const wall = caster.intersectObject(room.group, true)[0];
    const t = targets.hit(camera.position, dir, wall ? wall.distance : Infinity);
    const end = t ? t.point : wall ? wall.point : v1.copy(camera.position).addScaledVector(dir, 90);
    fx.tracer(gun.inRoom(gun.anchor.muzzle, camera, v2), end);
    if (t) {
      const out = run && state === 'play' ? hitRun(run, t.id, t.zone, damageAt(s, t.dist)) : [];
      for (const e of out) {
        if (e.type === 'hurt') { targets.hurt(t.id, { ...t, weak: e.weak }); sfx?.botHit(t.point, e.weak); hud.hitMark(false, e.weak); }
        else if (e.type === 'kill') {
          targets.kill(t.id, t, dir);
          hud.hitMark(true, e.weak);
          hud.pop(`+${e.points}${e.weak && e.kind !== 'plate' ? '  WEAK SPOT' : ''}${e.streak >= 3 ? `  x${e.streak}` : ''}`);
        }
      }
    } else if (wall) {
      const steel = wall.object.material?.name === 'r_steel';
      v3.copy(wall.face.normal).transformDirection(wall.object.matrixWorld);
      if (v3.dot(dir) > 0) v3.negate();
      fx.impact(wall.point, v3, steel ? 'steel' : 'concrete');
      sfx?.thud(wall.point, steel);
    }
    // The spent case, out of the port to the right and a little back.
    gun.axes(v1, v3);
    const at = gun.inRoom(gun.anchor.eject, camera, v2).clone();
    const vel = v1.multiplyScalar(1.5 + Math.random() * 0.9).addScaledVector(v3, 1.3 + Math.random() * 0.8).addScaledVector(dir, -0.5 - Math.random() * 0.4);
    fx.casing(gun.newCasing(), at, vel, new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(40));
    // The kick: the view jumps and mostly comes back; a little of the climb stays, so a string of shots walks upward.
    const calm = 1 - 0.35 * gun.aim;
    kick(kickUp, rad(ev.up) * calm * Math.sqrt(kickUp.k) * Math.E); kick(kickSide, rad(ev.side) * calm * Math.sqrt(kickSide.k) * Math.E);
    pitch = Math.min(PITCH_MAX, pitch + rad(ev.up) * 0.22 * calm);
    flashT = 0; flashK = ev.flash;
    gun.inRoom(gun.anchor.muzzle, camera, v2);
    flashRoom.position.copy(v2).addScaledVector(dir, 0.25); flashStage.position.copy(flashRoom.position);
  }

  // ---------- the mouse, the keys, the thumbs ----------
  function turn(dx, dy, k) {
    const zoom = camera.fov / baseFov;
    yaw = THREE.MathUtils.clamp(yaw - dx * k * zoom, -YAW_MAX, YAW_MAX);
    pitch = THREE.MathUtils.clamp(pitch - dy * k * zoom, -PITCH_MAX, PITCH_MAX);
  }
  const playing = () => state === 'play' || state === 'count';
  const onMove = e => { if (active && !coarse && playing()) turn(e.movementX, e.movementY, LOOK); };
  const onDown = e => {
    if (!active || coarse || hud?.carded) return;
    if (playing()) lock();
    if (e.button === 0) input.fire = true; else if (e.button === 2) input.aim = true;
  };
  const onUp = e => { if (e.button === 0) input.fire = false; else if (e.button === 2) input.aim = false; };
  const onMenu = e => { if (active) e.preventDefault(); };
  // Esc lets the mouse go before any key reaches the page, so losing the mouse in the middle of a run is the pause.
  let hadLock = false;
  const onLock = () => {
    const has = document.pointerLockElement === canvas;
    if (active && hadLock && !has && playing()) pause();
    hadLock = has;
  };
  // On a phone a drag anywhere on the picture looks around; the pads do the rest.
  let drag = null;
  const onTouch = e => {
    if (!active || !coarse) return;
    if (e.type === 'pointerdown') { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
    if (!drag || e.pointerId !== drag.id) return;
    if (e.type === 'pointermove') { if (playing()) turn(e.clientX - drag.x, e.clientY - drag.y, TOUCH_LOOK); drag.x = e.clientX; drag.y = e.clientY; } else drag = null;
  };
  function onPad(name, down, x) {
    if (name === 'fire') input.fire = down;
    else if (name === 'aim') { if (down && !aimHeld) input.aim = !input.aim; aimHeld = down; }
    else if (name === 'reload') input.reload = down;
    else if (name === 'step') input.step = down ? Math.max(-1, Math.min(1, x * 1.4)) : 0;
    else if (name === 'quit') api.escape();
  }
  const listen = on => {
    const f = on ? 'addEventListener' : 'removeEventListener';
    document[f]('mousemove', onMove); document[f]('mousedown', onDown); document[f]('mouseup', onUp); document[f]('contextmenu', onMenu); document[f]('pointerlockchange', onLock);
    window[f]('blur', release);
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) canvas[f](t, onTouch);
  };

  const api = {
    load, U,
    get ready() { return !!gun; },
    // The world file has the range's rooms; three's lighting shaders are worded as the range's patches expect.
    get built() { return built; },
    get patched() { return patched; },
    get room() { return room; },
    get active() { return active; },
    get state() { return state; },
    enter() {
      if (!gun || active) return false;
      active = true; enterK = 0; along = 0; alongV = 0; aimHeld = false; yaw = lastYaw = 0; pitch = lastPitch = 0; duck = 0; baseFov = camera.fov; hadLock = false;
      release();
      from.p.copy(camera.position); from.q.copy(camera.quaternion);
      engine.showBackground(false);
      s = stats('pistol', []); w = newWeapon(s); gun.setAttachments([]); gun.draw();
      if (look) gun.setLook(look());
      hud = makeHud({ coarse, onPad });
      hud.show();
      hud.hint([['Click', 'shoot'], ['Right click', 'aim'], ['R', 'reload'], ['A D', 'step'], ['C', 'duck'], ['Esc', 'pause']]);
      listen(true);
      menu();
      return true;
    },
    exit() {
      if (!active) return;
      active = false; state = 'off';
      if (run) quitRun(run);
      run = null;
      listen(false); unlock();
      targets.clear(); fx.clear();
      hud.hide(); hud = null;
      flashRoom.intensity = flashStage.intensity = 0;
      camera.fov = baseFov; camera.updateProjectionMatrix();
      engine.showBackground(true);
      // Back on the yellow line, a step from the bench and short of the crates at the line's end.
      onExit?.({ at: new THREE.Vector3(THREE.MathUtils.clamp(stand.x + along, R.strafe[0] + 0.5, R.strafe[1] - 0.5), stand.y, stand.z - 0.5) });
    },
    // Esc: out of a run to the pause card first, then out of the range.
    escape() { if (state === 'play' || state === 'count') pause(); else api.exit(); },
    key(e, down) {
      // Ctrl+R is the browser's, not the gun's (a key going up always counts, so nothing stays held).
      if (down && (e.ctrlKey || e.metaKey || e.altKey)) return false;
      const c = e.code;
      if (c === 'KeyR') input.reload = down;
      else if (c === 'KeyA' || c === 'ArrowLeft') input.left = down;
      else if (c === 'KeyD' || c === 'ArrowRight') input.right = down;
      else if (c === 'KeyC' || c === 'ShiftLeft') input.crouch = down;
      else if (c === 'Space') input.fire = down && !hud?.carded;
      else return false;
      return true;
    },
    // Puts the camera at my eye, looking where I aim. Blender's -y (downrange) is three's +z.
    pose(dt, lookAt) {
      if (film) dt = film.step;
      enterK = Math.min(1, enterK + (film ? 1 : dt * 2.2));
      springStep(kickUp, 0, dt); springStep(kickSide, 0, dt);
      eye.set(stand.x + along, stand.y + EYE - DUCK * duck, stand.z);
      aim.set(pitch + kickUp.x, Math.PI + yaw + kickSide.x, 0);
      q.setFromEuler(aim);
      const k = enterK * enterK * (3 - 2 * enterK);
      camera.position.lerpVectors(from.p, eye, k);
      camera.quaternion.slerpQuaternions(from.q, q, k);
      const fov = baseFov / (1 + (s.zoom - 1) * (gun?.aim || 0));
      if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      lookAt.copy(camera.position).add(v1.set(0, 0, -3).applyQuaternion(camera.quaternion));
    },
    tick(dt, t) {
      if (!gun) return;
      // Out of the range, what was left in the air still lands.
      if (!active) { if (visible()) fx.tick(dt); return; }
      if (film) dt = film.step;
      const live = state === 'play' || state === 'count', dtc = film ? dt : Math.min(dt, 0.05);
      if (live) {
        const want = (input.left ? 1 : 0) - (input.right ? 1 : 0) - input.step;
        alongV += (want * STEP * (1 - 0.5 * duck) * (1 - 0.35 * gun.aim) - alongV) * Math.min(1, dt * 10);
        along = THREE.MathUtils.clamp(along + alongV * dt, R.strafe[0] - stand.x, R.strafe[1] - stand.x);
        duck += ((input.crouch ? 1 : 0) - duck) * Math.min(1, dt * 9);
      }
      if (state === 'count') {
        countT += dt;
        if (countT >= COUNT) { countT = 0; countN--; if (countN > 0) { hud.big(String(countN)); sfx?.beep(false); } else { hud.big('GO'); sfx?.beep(true); state = 'play'; } }
      }
      // The gun works while a run is on; the run's clock only once the count is over.
      const hands = { fire: input.fire && state === 'play', reload: live && input.reload, aim: gun.aim };
      if (state !== 'paused') {
        for (const ev of stepWeapon(w, s, dtc, hands)) {
          gun.event(ev, s);
          if (ev.type === 'shot') shoot(ev);
          else if (ev.type === 'dry') sfx?.gunDry();
          else if (ev.type === 'mag_out') sfx?.magOut();
          else if (ev.type === 'mag_in') sfx?.magIn();
          else if (ev.type === 'rack') sfx?.slideRack();
        }
      }
      if (state === 'play') {
        for (const ev of stepRun(run, dtc)) {
          if (ev.type === 'spawn') targets.spawn(ev.target);
          else if (ev.type === 'escape') targets.escape(ev.id);
          else if (ev.type === 'end') finish(ev.result);
        }
      }
      if (state !== 'paused') {
        targets.update(dtc, t, id => { const g = run?.live.get(id); return g ? run.t - g.born : 0; });
        fx.tick(dtc);
      }
      gun.update(dtc, camera, w, s, { aim: input.aim && live, fire: hands.fire, turn: [yaw - lastYaw, pitch - lastPitch], strafe: live ? alongV : 0, crouch: duck });
      lastYaw = yaw; lastPitch = pitch;
      flashT += dt;
      flashRoom.intensity = flashStage.intensity = flashT < 0.07 ? 26 * flashK * (1 - flashT / 0.07) : 0;
      if (hud) hud.set({ playing: live || state === 'paused', spread: spreadNow(w, s, gun.aim), aim: gun.aim, score: run?.score, streak: run && run.t - run.lastKill < 3.5 ? run.streak : 0,
        left: run ? 1 - run.t / run.time : 1, ammo: w.ammo, mag: s.mag, gun: s.name, state: w.phase, shields: 0, maxShields: 0 });
      if (film) film.step = 0;
    },
    // For the checks: point the view at a place in the room (Blender axes) or at a live target, hold a control down,
    // start a stage, and see what is going on.
    lookAt(x, y, z) { const d = b2t(x, y, z).sub(eye); yaw = Math.atan2(d.x, d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); },
    aimAtTarget(id, part) { const p = targets.aimPoint(id, part); if (!p) return false; const d = p.sub(eye); yaw = Math.atan2(d.x, d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) - kickUp.x; return true; },
    press(name, down) { input[name] = down; },
    film(on) { film = on ? { step: 0 } : null; },
    advance(dt) { if (film) film.step = dt; },
    start(stage = 'warmup', difficulty = 'normal', seed) { if (active) start(stage, difficulty, seed); },
    get debug() { return { state, run, weapon: w, stats: s, targets: targets?.live().map(o => ({ id: o.id, kind: o.kind })) || [], fx: fx?.counts, aim: gun?.aim, along, duck }; },
  };
  return api;
}

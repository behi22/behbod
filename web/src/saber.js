import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { b2t } from './engine.js';
import { knightMaterials, buildHilt, buildBlade, bladeGlowMaterial, HILT } from './knight.js';
import { BLADE, guard, bladeEnds, meets, hum, newTraining, stepTraining, blocked, stung, returned, rest, levelOf } from './pure/saber.js';
export { makeKnight } from './knight.js';

// Taking the knight's saber: the lid lifts, the saber is in your hand, and his training drone floats out of the case
// to throw slow bolts at you. The blade follows the mouse or a finger; light it and swing, and block what comes. The
// rules (where the blade is, whether a bolt meets it, the drone's run of shots) are in pure/saber.js.
const CSS = `
.sb-hud { position: fixed; left: calc(16px + env(safe-area-inset-left, 0px)); top: calc(16px + env(safe-area-inset-top, 0px)); z-index: 25; display: flex; gap: 8px; align-items: center; pointer-events: none;
  font: 600 12px/1.2 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; color: #e8edf5; letter-spacing: .04em; }
.sb-hud span { background: rgba(8,10,16,.74); border: 1px solid rgba(255,255,255,.14); padding: 6px 12px; border-radius: 999px; }
.sb-hud b { color: #ff7a6a; font-weight: 700; }
.sb-hud .up { animation: sb-up .35s ease-out; }
@keyframes sb-up { from { transform: scale(1.18); border-color: #ff5a4a; } to { transform: scale(1); } }
.sb-bar { position: fixed; left: 0; right: 0; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 25; display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap; padding: 0 16px; pointer-events: none;
  font: 500 12px/1.3 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; color: #cfd8e6; }
.sb-bar .hint { background: rgba(8,10,16,.72); padding: 7px 12px; border-radius: 999px; }
.sb-bar button { pointer-events: auto; font: inherit; color: #e8edf5; background: rgba(8,10,16,.84); border: 1px solid rgba(255,255,255,.22); border-radius: 999px; padding: 9px 16px; cursor: pointer; }
.sb-bar button.hot { border-color: #ff5a4a; color: #ff9a8c; }
.sb-pop { position: fixed; left: 50%; top: 24%; transform: translateX(-50%); z-index: 25; pointer-events: none; font: 700 15px/1 'JetBrains Mono', ui-monospace, monospace; letter-spacing: .2em; color: #ffd9d2; text-shadow: 0 0 12px rgba(255,60,40,.8); opacity: 0; }
.sb-pop.on { animation: sb-pop .7s ease-out; }
@keyframes sb-pop { 0% { opacity: 0; transform: translate(-50%, 6px); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -14px); } }
.sb-sting { position: fixed; inset: 0; z-index: 24; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(255,36,24,.5) 100%); opacity: 0; transition: opacity .45s; }
.sb-sting.on { opacity: 1; transition: none; }
body[data-mode="saber"] .keys, body[data-mode="saber"] .joy, body[data-mode="saber"] .touch, body[data-mode="saber"] .prompt, body[data-mode="saber"] .tag,
body[data-mode="saber"] #who, body[data-mode="saber"] #hood, body[data-mode="saber"] #closet { display: none; }
body[data-mode="saber"] canvas#view { cursor: none; }
`;
// AWAY: how much bigger the drone is drawn once out of the case, so it reads at training distance.
const EYE = 1.55, GLIDE = 0.75, AHEAD = 2.4, AWAY = 1.6, BOLTS = 8, SPARKS = 64, LIGHT_UP = 0.16, GO_OUT = 0.26;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = k => k * k * (3 - 2 * k);

function buildDrone(env) {
  const std = (color, roughness, metalness) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: env, envMapIntensity: 1.2 });
  // A ball the size of a grapefruit: a graphite shell with a steel belt, one amber eye in a dark hood, two small
  // thrusters and an aerial with a status light.
  const g = new THREE.Group(), shell = std(0x34383f, 0.3, 0.6), steel = std(0x9096a0, 0.26, 1), dark = std(0x111216, 0.5, 0.3);
  const lens = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.55, 0.1) }), status = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 1.6) });
  const R = 0.046, at = (geo, p, r = [0, 0, 0], s = [1, 1, 1]) => geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
  // One mesh per material: the parts of each are merged.
  const steelParts = [at(new THREE.TorusGeometry(R + 0.001, 0.0035, 8, 40), [0, 0, 0], [Math.PI / 2, 0, 0]), at(new THREE.CylinderGeometry(0.0016, 0.0016, 0.026, 6), [0.012, R * 0.92 + 0.01, -0.012])];
  for (const s of [-1, 1]) steelParts.push(at(new THREE.CylinderGeometry(0.009, 0.011, 0.024, 12), [s * (R + 0.004), -0.008, -0.004]));
  const parts = [
    [at(new THREE.SphereGeometry(R, 28, 18), [0, 0, 0], [0, 0, 0], [1, 0.92, 1]), shell],
    [mergeGeometries(steelParts.map(q => q.index ? q.toNonIndexed() : q)), steel],
    [at(new THREE.CylinderGeometry(0.015, 0.018, 0.014, 20), [0, 0, R - 0.002], [Math.PI / 2, 0, 0]), dark],
    [at(new THREE.SphereGeometry(0.004, 10, 8), [0.012, R * 0.92 + 0.024, -0.012]), status],
  ];
  for (const [geo, m] of parts) g.add(new THREE.Mesh(geo, m));
  // The eye is its own mesh: the bolts leave from it.
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 10), lens);
  eye.position.z = R + 0.004;
  g.add(eye);
  g.name = 'saber_drone';
  return { group: g, lens, eye };
}

export function makeSaber({ engine, camera, canvas, coarse, knight, meta, audio, store, onExit, onEvent }) {
  const c = meta.colliders?.find(x => x.name === 'vader'), it = meta.interact?.find(x => x.id === 'vader');
  if (!knight || !c || !it) return null;
  const { renderer, scene } = engine;
  if (!document.getElementById('sb-css')) { const s = document.createElement('style'); s.id = 'sb-css'; s.textContent = CSS; document.head.append(s); }
  // Where you stand to train: the spot in front of the case, looking out over the open floor to the east.
  const eyeAt = b2t(it.at[0], it.at[1], EYE), ahead = new THREE.Vector3(1, 0, 0);
  const station = eyeAt.clone().addScaledVector(ahead, AHEAD).add(new THREE.Vector3(0, -0.08, 0));
  const facing = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eyeAt, station, UP));
  // The drone waits on a small steel ring on the plinth, in a corner of the case at the knight's feet.
  const cx = (c.min[0] + c.max[0]) / 2, cy = (c.min[1] + c.max[1]) / 2, home = b2t(cx + 0.21, cy - 0.2, 1.0 + 0.046);
  const above = home.clone().add(new THREE.Vector3(0, 0.75, 0));

  // ---------- the saber in your hand: its own little scene, drawn over the room, in eye space ----------
  const env = knight.env, M = knightMaterials(env);
  const hand = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(camera.fov, camera.aspect, 0.01, 10) };
  hand.scene.add(new THREE.HemisphereLight(0xcdd8ff, 0x1c1410, 1.1));
  const key = new THREE.DirectionalLight(0xfff0e0, 1.8);
  key.position.set(0.4, 1, 0.3);
  const redLight = new THREE.PointLight(0xff2a18, 0, 1.2, 2);
  hand.scene.add(key, redLight);
  const saber = new THREE.Group(), hilt = new THREE.Group();
  buildHilt(M).build(hilt, M);
  hilt.position.y = -HILT;
  const glowMat = bladeGlowMaterial(), blade = buildBlade(BLADE, 0.0115, M, glowMat);
  blade.scale.y = 0.001; blade.visible = false;
  saber.add(hilt, blade);
  hand.scene.add(saber);
  // The swing's trail: where the blade was over the last few frames, fading, drawn only while it moves fast.
  const TRAIL = 9, trailPos = new Float32Array(TRAIL * 2 * 3), trailCol = new Float32Array(TRAIL * 2 * 3), trailIdx = [];
  for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; trailIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  trailGeo.setIndex(trailIdx);
  const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  trail.frustumCulled = false; trail.visible = false;
  hand.scene.add(trail);
  const trailAt = [];
  engine.addLayer({ scene: hand.scene, camera: hand.camera, clearDepth: true, on: () => active && enterK > 0.35 });
  try { renderer.compile(hand.scene, hand.camera); } catch (e) { /* built on first sight instead */ }

  // ---------- the drone, its bolts and the sparks, out in the room ----------
  const drone = buildDrone(env);
  const cradle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 8, 32), M.steel);
  cradle.rotation.x = Math.PI / 2; cradle.position.copy(home).setY(home.y - 0.04);
  scene.add(cradle);
  drone.group.position.copy(home);
  drone.group.lookAt(home.clone().add(new THREE.Vector3(1, 0, 0.6)));
  scene.add(drone.group);
  const boltCore = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.1) }), boltGlow = bladeGlowMaterial();
  boltGlow.uniforms.color.value.setRGB(1.0, 0.42, 0.06);
  const bolts = [];
  for (let i = 0; i < BOLTS; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.15, 4, 8), boltCore), new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.15, 6, 12), boltGlow));
    g.visible = false;
    scene.add(g);
    bolts.push({ g, live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, back: false, home: false });
  }
  const sparkPos = new Float32Array(SPARKS * 3), sparkVel = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const dg = dot.getContext('2d'), grad = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,220,170,0.7)'); grad.addColorStop(1, 'rgba(255,140,60,0)');
  dg.fillStyle = grad; dg.fillRect(0, 0, 32, 32);
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.028, map: new THREE.CanvasTexture(dot), color: new THREE.Color(2.4, 1.4, 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; sparks.visible = false;
  scene.add(sparks);
  let sparkNext = 0;

  // ---------- state ----------
  let active = false, enterK = 0, lit = false, litK = 0, tr = null, best = Number(store?.get('home.saber.best')) || 0;
  let hud = null, bar = null, pop = null, sting = null, lightBtn = null, wasLevel = 0;
  const from = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const pointer = { x: 0.2, y: -0.2 }, held = new Set();
  const view = { tanX: 1, tanY: 1 };
  // The blade as drawn: the hand and the way it points follow the guard a moment behind, which is the swing.
  const handAt = new THREE.Vector3(), dirAt = new THREE.Vector3(0, 1, 0), was = { a: [0, 0, 0], b: [0, 0, 0] }, now = { a: [0, 0, 0], b: [0, 0, 0] };
  let shake = 0, swingK = 0, flight = null, hold = false;
  const dronePos = new THREE.Vector3().copy(home), droneGoal = new THREE.Vector3().copy(station), droneWob = new THREE.Vector3();
  let tellK = 0, flash = 0, wanderT = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), inv = new THREE.Matrix4();

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function showHud() {
    hud = el('div', 'sb-hud');
    hud.append(el('span', '', 'SABER'), el('span', 'streak'));
    bar = el('div', 'sb-bar');
    lightBtn = el('button', 'hot');
    lightBtn.addEventListener('click', () => setLit(!lit));
    const back = el('button', '', 'Put it back');
    back.addEventListener('click', () => api.exit());
    bar.append(el('span', 'hint', coarse ? 'Drag to move the blade' : 'Move the mouse to guard. Space lights it. Esc puts it back.'), lightBtn, back);
    pop = el('div', 'sb-pop'); sting = el('div', 'sb-sting');
    document.body.append(hud, bar, pop, sting);
    drawHud();
  }
  function drawHud(bump) {
    if (!hud) return;
    const s = hud.querySelector('.streak');
    s.replaceChildren(document.createTextNode('Streak '), el('b', '', String(tr?.streak || 0)), document.createTextNode(`  Best ${best}`));
    if (bump) { s.classList.remove('up'); void s.offsetWidth; s.classList.add('up'); }
    lightBtn.textContent = lit ? 'Switch off' : 'Light it';
  }
  function say(text) { if (!pop) return; pop.textContent = text; pop.classList.remove('on'); void pop.offsetWidth; pop.classList.add('on'); }
  function setLit(on) {
    if (!active || on === lit) return;
    lit = on;
    if (lit) { audio?.ignite(); rest(tr); onEvent?.('lit'); } else { audio?.retract(); }
    drawHud();
  }

  // ---------- input ----------
  const toPointer = e => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = 1 - (e.clientY / innerHeight) * 2; };
  // The mouse guards wherever it is; a finger or pen only while it is the one that touched the picture.
  const onMove = e => { if (active && (e.pointerType === 'mouse' || e.pointerId === touchId)) toPointer(e); };
  let touchId = null;
  const onDown = e => {
    if (!active) return;
    if (e.pointerType !== 'mouse') { touchId = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ } }
    toPointer(e);
    if (!lit && enterK >= 1) setLit(true);
  };
  const onUp = e => { if (e.pointerId === touchId) touchId = null; };
  const onBlur = () => held.clear();
  function listen(on) {
    const f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('pointermove', onMove);
    canvas[f]('pointerdown', onDown);
    window[f]('pointerup', onUp);
    window[f]('pointercancel', onUp);
    window[f]('blur', onBlur);
  }

  // ---------- bolts ----------
  function fire(ev) {
    const b = bolts.find(x => !x.live);
    if (!b) return;
    // The place it passes is on the blade you would hold for that pointer place, so every bolt can be blocked.
    const g = guard(ev.aim[0], ev.aim[1], view), { a, dir } = bladeEnds(g);
    tmp.set(a[0] + dir[0] * BLADE * ev.along, a[1] + dir[1] * BLADE * ev.along, a[2] + dir[2] * BLADE * ev.along);
    camera.localToWorld(tmp);
    drone.eye.getWorldPosition(b.pos);
    b.vel.copy(tmp).sub(b.pos).normalize().multiplyScalar(ev.speed);
    b.live = true; b.back = false; b.home = false; b.age = 0; b.g.visible = true;
    flash = 1;
    audio?.bolt(b.pos);
  }
  function burst(at, dir, n = 18) {
    for (let k = 0; k < n; k++) {
      const i = sparkNext; sparkNext = (sparkNext + 1) % SPARKS;
      sparkPos.set([at.x, at.y, at.z], i * 3);
      sparkVel.set([dir.x * 1.5 + (Math.random() - 0.5) * 3, dir.y * 1.5 + Math.random() * 2, dir.z * 1.5 + (Math.random() - 0.5) * 3], i * 3);
      sparkLife[i] = 0.25 + Math.random() * 0.3;
    }
    sparks.visible = true;
  }
  // The blade's way in the room, for sending a bolt back.
  const bladeDir = new THREE.Vector3();
  function deflect(b) {
    bladeDir.copy(dirAt).transformDirection(camera.matrixWorld);
    // Off the blade's face back the way it came, a little scattered; close enough to the drone, it finds it.
    const v = b.vel, along = bladeDir.clone().multiplyScalar(v.dot(bladeDir));
    v.sub(along).negate().add(along).multiplyScalar(1.5);
    v.add(tmp.set((Math.random() - 0.5), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5)).multiplyScalar(v.length() * 0.35));
    const toDrone = tmp2.copy(dronePos).sub(b.pos).normalize();
    b.back = true; b.age = 0;
    b.home = v.clone().normalize().dot(toDrone) > Math.cos(0.5);
    burst(b.pos, v.clone().normalize());
    audio?.clash(b.pos);
    const n = blocked(tr);
    if (n > best) { best = n; store?.set('home.saber.best', String(best)); }
    onEvent?.('streak', n);
    const lvl = levelOf(tr.streak);
    say(lvl > wasLevel ? 'FASTER' : 'BLOCKED');
    wasLevel = lvl;
    swingK = Math.max(swingK, 0.6);
    drawHud(true);
  }
  function hurt(b) {
    b.live = false; b.g.visible = false;
    stung(tr); wasLevel = 0;
    audio?.sting();
    shake = 1;
    if (sting) { sting.classList.add('on'); setTimeout(() => sting?.classList.remove('on'), 60); }
    say('STUNG');
    drawHud();
  }
  function stepBolts(dt) {
    camera.updateMatrixWorld();
    inv.copy(camera.matrixWorldInverse);
    for (const b of bolts) {
      if (!b.live) continue;
      b.age += dt;
      if (b.back && b.home) {
        const want = tmp.copy(dronePos).sub(b.pos);
        if (want.length() < 0.09) { b.live = false; b.g.visible = false; returned(tr); audio?.zap(b.pos); burst(b.pos, want.normalize().negate(), 12); droneWob.set(Math.random() - 0.5, 0.6, Math.random() - 0.5).multiplyScalar(0.5); say('RIGHT BACK AT IT'); continue; }
        b.vel.lerp(want.normalize().multiplyScalar(b.vel.length()), Math.min(1, dt * 8));
      }
      const fromW = b.pos.clone();
      b.pos.addScaledVector(b.vel, dt);
      if (!b.back) {
        const f = fromW.applyMatrix4(inv), t = tmp2.copy(b.pos).applyMatrix4(inv);
        if (litK > 0.85 && meets(f.toArray(), t.toArray(), was, now).hit) deflect(b);
        else if (t.z > -0.3) { hurt(b); continue; }
      }
      if (b.age > 2.5 || b.pos.distanceTo(eyeAt) > 9) { b.live = false; b.g.visible = false; continue; }
      b.g.position.copy(b.pos);
      b.g.quaternion.setFromUnitVectors(UP, tmp.copy(b.vel).normalize());
    }
  }
  function stepSparks(dt) {
    if (!sparks.visible) return;
    let any = false;
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) { sparkPos[i * 3 + 1] = -100; continue; }
      sparkLife[i] -= dt; any = true;
      sparkVel[i * 3 + 1] -= 6 * dt;
      for (let k = 0; k < 3; k++) sparkPos[i * 3 + k] += sparkVel[i * 3 + k] * dt;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparks.visible = any;
  }

  // ---------- the drone ----------
  function stepDrone(dt, t) {
    if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.time);
      const k = smooth(flight.t), [p0, p1, p2] = flight.path;
      dronePos.set(0, 0, 0).addScaledVector(p0, (1 - k) * (1 - k)).addScaledVector(p1, 2 * k * (1 - k)).addScaledVector(p2, k * k);
      // It grows as it leaves the case and shrinks as it settles back in.
      const g = flight.grow ? smooth(Math.min(1, flight.t * 2)) : smooth(Math.max(0, flight.t * 2 - 1));
      drone.group.scale.setScalar(flight.s0 + ((flight.grow ? AWAY : 1) - flight.s0) * g);
      if (flight.t >= 1) { const done = flight.done; flight = null; done?.(); }
    } else if (active) {
      // It drifts about in front of you while it works, never so far to the side that it leaves a narrow screen.
      if ((wanderT -= dt) <= 0) {
        wanderT = 1.2 + Math.random() * 1.4;
        const side = Math.min(0.7, view.tanX * AHEAD * 0.55);
        droneGoal.copy(station).add(tmp.set(0, (Math.random() - 0.5) * 0.5, 0)).addScaledVector(tmp2.set(-ahead.z, 0, ahead.x), (Math.random() * 2 - 1) * side);
      }
      dronePos.lerp(droneGoal, Math.min(1, dt * 1.6));
    }
    droneWob.multiplyScalar(Math.max(0, 1 - dt * 3));
    const hover = active || flight ? Math.sin(t * 2.3) * 0.012 : 0;
    drone.group.position.copy(dronePos).add(tmp.set(0, hover, 0));
    if (active || flight) {
      drone.group.lookAt(camera.position);
      drone.group.rotateX(droneWob.x); drone.group.rotateZ(droneWob.z + Math.sin(t * 1.7) * 0.06);
    }
    tellK = Math.max(0, tellK - dt * 1.6);
    flash = Math.max(0, flash - dt * 6);
    const k = 1 + 2.2 * tellK + 3 * flash;
    drone.lens.color.setRGB(1.2 * k, 0.55 * k, 0.1 * k);
  }
  function flyTo(path, time, grow, done) { flight = { path, time, t: 0, grow, done, s0: drone.group.scale.x }; }

  // ---------- the blade ----------
  function stepBlade(dt) {
    const k = dt > 0 ? dt : 0;
    if (held.size) {
      const sp = 1.8 * k;
      if (held.has('left')) pointer.x -= sp;
      if (held.has('right')) pointer.x += sp;
      if (held.has('up')) pointer.y += sp;
      if (held.has('down')) pointer.y -= sp;
      pointer.x = THREE.MathUtils.clamp(pointer.x, -1, 1); pointer.y = THREE.MathUtils.clamp(pointer.y, -1, 1);
    }
    const g = guard(pointer.x, pointer.y, view);
    handAt.lerp(tmp.fromArray(g.hand), Math.min(1, k * 26));
    dirAt.lerp(tmp.fromArray(g.dir), Math.min(1, k * 15)).normalize();
    litK = THREE.MathUtils.clamp(litK + (lit ? k / LIGHT_UP : -k / GO_OUT), 0, 1);
    was.a = now.a; was.b = now.b;
    const ends = bladeEnds({ hand: handAt.toArray(), dir: dirAt.toArray() }, litK);
    now.a = ends.a; now.b = ends.b;
    const speed = k > 0 ? Math.hypot(now.b[0] - was.b[0], now.b[1] - was.b[1], now.b[2] - was.b[2]) / k : 0;
    const h = hum(litK > 0.9 ? speed : 0);
    swingK = Math.max(h.swing, swingK - k * 3);
    // The view comes in from below on the way in, so the saber rises into the hand.
    const rise = (1 - smooth(Math.min(1, enterK * 1.3))) * 0.35;
    saber.position.set(handAt.x, handAt.y - rise, handAt.z);
    saber.quaternion.setFromUnitVectors(UP, dirAt);
    blade.visible = litK > 0.001;
    blade.scale.y = Math.max(0.001, litK);
    const fl = 0.93 + 0.07 * Math.sin(performance.now() * 0.037) * Math.sin(performance.now() * 0.0233);
    glowMat.uniforms.k.value = fl * (1 + 0.35 * swingK);
    redLight.intensity = 0.25 * litK * fl;
    redLight.position.set(handAt.x + dirAt.x * 0.25, handAt.y + dirAt.y * 0.25, handAt.z + dirAt.z * 0.25);
    // The trail runs from halfway up the blade to its tip, oldest faintest, brightest along the tip's path.
    trailAt.unshift([now.a.map((v, i) => v + (now.b[i] - v) * 0.5), now.b.slice()]);
    if (trailAt.length > TRAIL) trailAt.pop();
    trail.visible = litK > 0.9 && swingK > 0.1 && trailAt.length > 2;
    if (trail.visible) {
      for (let i = 0; i < TRAIL; i++) {
        const [p, q] = trailAt[Math.min(i, trailAt.length - 1)], f = Math.pow(1 - i / (TRAIL - 1), 2.2) * swingK * 0.3;
        trailPos.set(p, i * 6); trailPos.set(q, i * 6 + 3);
        trailCol.set([0, 0, 0, f, f * 0.1, f * 0.07], i * 6);
      }
      trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
    }
    audio?.hum(active && litK > 0.05 ? 0.16 * litK : 0, h);
  }

  const api = {
    get active() { return active; },
    get lit() { return lit; },
    get training() { return tr; },
    get best() { return best; },
    get blade() { return { a: now.a.slice(), b: now.b.slice(), k: litK }; },
    get drone() { return dronePos.clone(); },
    get knight() { return { removed: knight.removed, out: knight.out, root: knight.root }; },
    get bolts() { return bolts.filter(b => b.live).map(b => ({ pos: b.pos.clone(), back: b.back })); },
    enter() {
      if (active) return false;
      active = true; enterK = 0; lit = false; litK = 0; shake = 0; swingK = 0; wasLevel = 0; held.clear(); touchId = null;
      pointer.x = 0.25; pointer.y = -0.15;
      const g = guard(pointer.x, pointer.y, view);
      handAt.fromArray(g.hand); dirAt.fromArray(g.dir);
      tr = newTraining((Math.random() * 1e9) | 1, best);
      from.p.copy(camera.position); from.q.copy(camera.quaternion);
      knight.setOut(true);
      for (const b of bolts) { b.live = false; b.g.visible = false; }
      showHud(); listen(true);
      // The drone lifts off its plinth, up through the open lid, and out to its spot.
      flyTo([dronePos.clone(), above, station], 1.5, true);
      wanderT = 1.5; trailAt.length = 0; hold = false;
      return true;
    },
    exit() {
      if (!active) return;
      active = false; lit = false; litK = 0; held.clear();
      listen(false);
      for (const b of bolts) { b.live = false; b.g.visible = false; }
      audio?.hum(0);
      for (const e of [hud, bar, pop, sting]) e?.remove();
      hud = bar = pop = sting = lightBtn = null;
      flyTo([dronePos.clone(), above, home], 1.6, false, () => { if (!active) { knight.setOut(false); dronePos.copy(home); drone.group.position.copy(home); drone.group.lookAt(tmp.copy(home).add(new THREE.Vector3(1, 0, 0.6))); } });
      onExit?.();
    },
    // Keys while holding it: Space or F lights it or puts it out, the arrows or WASD move the blade, Esc or E put it back.
    key(e, down) {
      const c = e.code, dirs = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
      if (dirs[c]) { if (down) held.add(dirs[c]); else held.delete(dirs[c]); return true; }
      if (!down || e.repeat) return c === 'Space' || c === 'KeyF';
      if (c === 'Escape' || c === 'KeyE') { api.exit(); return true; }
      if (c === 'Space' || c === 'KeyF') { if (enterK >= 1) setLit(!lit); return true; }
      return false;
    },
    // Puts the camera at my eye, looking out at the drone's spot, gliding there from wherever it was.
    pose(dt, lookAt) {
      enterK = Math.min(1, enterK + dt / GLIDE);
      const k = smooth(enterK);
      camera.position.lerpVectors(from.p, eyeAt, k);
      camera.quaternion.slerpQuaternions(from.q, facing, k);
      if (shake > 0) {
        shake = Math.max(0, shake - dt * 4);
        camera.rotateX((Math.random() - 0.5) * 0.03 * shake); camera.rotateY((Math.random() - 0.5) * 0.03 * shake);
      }
      lookAt.copy(camera.position).add(tmp.set(0, 0, -3).applyQuaternion(camera.quaternion));
    },
    tick(dt, t, eye) {
      const step = Math.min(dt, 0.05);
      // The view's reach, for keeping the blade and the drone on screen whatever its shape.
      view.tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); view.tanX = view.tanY * camera.aspect;
      if (hand.camera.fov !== camera.fov || hand.camera.aspect !== camera.aspect) { hand.camera.fov = camera.fov; hand.camera.aspect = camera.aspect; hand.camera.updateProjectionMatrix(); }
      stepDrone(step, t);
      if (active) {
        stepBlade(step);
        if (lit && litK >= 1 && enterK >= 1 && !flight && !hold) {
          for (const ev of stepTraining(tr, step)) {
            if (ev.type === 'tell') { tellK = 1; audio?.tell(dronePos); } else fire(ev);
          }
        }
      }
      stepBolts(step);
      stepSparks(step);
      knight.tick(step, t, active ? null : eye);
      // The case's own saber hums softly when you are close to it.
      const near = !knight.out && eye && eye.distanceTo(knight.root.position) < 3;
      audio?.caseHum(near ? 0.05 : 0, near ? knight.saberAt() : null);
    },
    // For the checks: hold the pointer at a place, keep the drone from firing by itself, and fire a bolt straight at
    // the blade or wide of it.
    point(x, y) { pointer.x = x; pointer.y = y; },
    hold(on) { hold = !!on; },
    test(kind) {
      if (!active || !tr) return false;
      fire({ aim: kind === 'wide' ? [pointer.x > 0 ? -0.85 : 0.85, -pointer.y] : [pointer.x, pointer.y], along: 0.6, speed: 3 });
      return true;
    },
  };
  return api;
}

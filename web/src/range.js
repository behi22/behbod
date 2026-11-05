import * as THREE from 'three';
import { b2t } from './engine.js';

// The holo range: holographic targets flicker up at the far end, you click or tap to hit them before they fade.
// A round lasts 40 seconds; the score goes to the progress system, which hands out the unlocks.
const ROUND = 40;
const CSS = `
.rg-hud { position: fixed; inset: 0; pointer-events: none; z-index: 30; font: 600 14px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #bfefff; }
.rg-top { position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); display: flex; gap: 18px; padding: 8px 16px; border-radius: 999px;
  background: rgba(6, 16, 26, .72); border: 1px solid rgba(90, 200, 255, .35); white-space: nowrap; }
.rg-top b { color: #fff; font-size: 18px; }
.rg-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: auto; text-align: center; padding: 22px 26px; border-radius: 16px;
  background: rgba(6, 16, 26, .9); border: 1px solid rgba(90, 200, 255, .4); width: min(340px, calc(100vw - 32px)); box-sizing: border-box; }
.rg-card h2 { margin: 0 0 6px; font-size: 13px; letter-spacing: .14em; color: #5ad2ff; }
.rg-card .big { font-size: 40px; color: #fff; margin: 6px 0; }
.rg-card p { margin: 6px 0; color: #9fc6d8; font-weight: 400; }
.rg-card button { font: inherit; color: #e8f6ff; background: rgba(90, 200, 255, .12); border: 1px solid rgba(90, 200, 255, .5); border-radius: 999px; padding: 8px 16px; margin: 8px 4px 0; cursor: pointer; }
.rg-exit { position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); pointer-events: auto; font: inherit; color: #e8f6ff;
  background: rgba(6, 16, 26, .72); border: 1px solid rgba(90, 200, 255, .35); border-radius: 999px; padding: 8px 14px; cursor: pointer; }
`;

export function makeRange(scene, camera, meta, { sfx, best, onScore, onExit }) {
  const R = meta.range, stand = b2t(...meta.points.range_stand);
  const eye = stand.clone().add(new THREE.Vector3(0, 1.45, 0));
  const look = b2t((R.x0 + R.x1) / 2 + 2, (R.y0 + R.y1) / 2, (R.z0 + R.z1) / 2);
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const ringGeo = new THREE.RingGeometry(0.13, 0.2, 40), dotGeo = new THREE.CircleGeometry(0.07, 24);
  const glowMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const targets = [];
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, glowMat(new THREE.Color(0.3, 1.6, 2.4))), dot = new THREE.Mesh(dotGeo, glowMat(new THREE.Color(2.4, 0.5, 0.4)));
    t.add(ring, dot); t.rotation.y = -Math.PI / 2; t.visible = false; group.add(t);
    targets.push({ t, ring, dot, alive: false, born: 0, life: 0, gold: false, vx: 0, base: new THREE.Vector3() });
  }
  // The shot: a bright line from just below my eye to where it landed.
  const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beam = new THREE.Line(beamGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(0.5, 2, 3), transparent: true }));
  beam.visible = false; group.add(beam);
  let beamT = 0;
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glowMat(new THREE.Color(3, 2.4, 1)));
  flash.visible = false; group.add(flash);

  let active = false, playing = false, t0 = 0, now = 0, score = 0, streak = 0, nextSpawn = 0, hud = null, top = null;
  const ray = new THREE.Raycaster();
  if (!document.getElementById('rg-css')) { const s = document.createElement('style'); s.id = 'rg-css'; s.textContent = CSS; document.head.append(s); }

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function showHud() {
    hud = el('div', 'rg-hud');
    top = el('div', 'rg-top');
    const exit = el('button', 'rg-exit', 'Leave');
    exit.addEventListener('click', () => api.exit());
    hud.append(top, exit);
    document.body.append(hud);
  }
  function card(title, big, lines, buttons) {
    hud.querySelector('.rg-card')?.remove();
    const c = el('div', 'rg-card');
    c.append(el('h2', '', title), el('div', 'big', big), ...lines.map(l => el('p', '', l)));
    for (const [label, fn] of buttons) { const b = el('button', '', label); b.addEventListener('click', fn); c.append(b); }
    hud.append(c);
  }
  function drawTop() {
    if (!top) return;
    const left = playing ? Math.max(0, Math.ceil(ROUND - (now - t0))) : ROUND;
    top.replaceChildren(el('span', '', 'SCORE '), el('b', '', String(score)), el('span', '', `  TIME ${left}s`), el('span', '', streak >= 3 ? `  STREAK x${streak}` : ''));
  }
  function startRound() {
    hud.querySelector('.rg-card')?.remove();
    playing = true; t0 = now; score = 0; streak = 0; nextSpawn = now + 0.6;
    for (const g of targets) { g.alive = false; g.t.visible = false; }
    drawTop();
  }
  function spawn() {
    const g = targets.find(x => !x.alive);
    if (!g) return;
    const x = THREE.MathUtils.lerp(R.x0 + 2, R.x1 - 0.3, Math.random()), y = THREE.MathUtils.lerp(R.y0 + 0.25, R.y1 - 0.25, Math.random());
    const z = THREE.MathUtils.lerp(R.z0 + 0.1, R.z1 - 0.2, Math.random());
    g.base.copy(b2t(x, y, z)); g.t.position.copy(g.base);
    g.gold = Math.random() < 0.12;
    g.ring.material.color.copy(g.gold ? new THREE.Color(3, 2.2, 0.5) : new THREE.Color(0.3, 1.6, 2.4));
    g.vx = Math.random() < 0.35 ? (Math.random() < 0.5 ? -1 : 1) * 0.5 : 0;
    // Targets get quicker as the round goes on.
    const k = (now - t0) / ROUND;
    g.alive = true; g.born = now; g.life = THREE.MathUtils.lerp(2.3, 1.3, k) * (g.gold ? 0.75 : 1); g.t.visible = true;
  }
  function endRound() {
    playing = false;
    for (const g of targets) { g.alive = false; g.t.visible = false; }
    const before = best();
    const unlocked = onScore(score);
    const lines = [score > before ? 'A new best.' : `Best: ${before}`];
    if (unlocked.length) lines.push('Unlocked: ' + unlocked.join(', ') + '.');
    else lines.push(score < 20 ? '20 unlocks the keeper kit.' : score < 35 ? '35 unlocks the gold colourway.' : score < 50 ? '50 unlocks the red visor and the secret room.' : 'Everything is unlocked.');
    card('ROUND OVER', String(score), lines, [['Again', startRound], ['Leave', () => api.exit()]]);
    drawTop();
  }

  const api = {
    get active() { return active; },
    get score() { return score; },
    // Where the live targets are (for the checks, which aim at them like a player would).
    live: () => targets.filter(g => g.alive).map(g => g.t.position.clone()),
    enter() {
      active = true; group.visible = true;
      showHud();
      card('HOLO RANGE', `${ROUND}s`, ['Click or tap the targets before they fade.', 'Gold ones are worth 3. Keep a streak going for bonus points.', `Best: ${best()}`], [['Start', startRound], ['Leave', () => api.exit()]]);
      drawTop();
    },
    exit() {
      if (!active) return;
      active = false; playing = false; group.visible = false;
      for (const g of targets) { g.alive = false; g.t.visible = false; }
      hud?.remove(); hud = null; top = null;
      onExit();
    },
    // The camera for the range: standing at the counter, aim drifting a little toward the pointer.
    view(out, aimPt, px, py) {
      out.copy(eye);
      // Facing east, my right is three's +z.
      aimPt.copy(look).add(new THREE.Vector3(0, py * 0.35, px * 0.6));
    },
    fire(ndc) {
      if (!playing) return;
      ray.setFromCamera(ndc, camera);
      const live = targets.filter(g => g.alive);
      const hit = ray.intersectObjects(live.map(g => g.t), true)[0];
      const from = eye.clone().add(new THREE.Vector3(0.15, -0.25, 0));
      const to = hit ? hit.point : ray.ray.at(9, new THREE.Vector3());
      beamGeo.setFromPoints([from, to]); beam.visible = true; beamT = now + 0.08;
      if (hit) {
        const g = live.find(x => x.t === hit.object.parent);
        g.alive = false; g.t.visible = false;
        streak++;
        score += (g.gold ? 3 : 1) + (streak % 5 === 0 ? 1 : 0);
        flash.position.copy(hit.point); flash.visible = true;
        sfx?.hit(hit.point);
      } else { streak = 0; sfx?.miss(); }
      drawTop();
    },
    tick(dt, t) {
      now = t;
      if (!active) return;
      if (beam.visible && t > beamT) { beam.visible = false; flash.visible = false; }
      if (!playing) return;
      if (t - t0 >= ROUND) { endRound(); return; }
      if (t > nextSpawn) { spawn(); nextSpawn = t + THREE.MathUtils.lerp(0.75, 0.45, (t - t0) / ROUND); }
      for (const g of targets) {
        if (!g.alive) continue;
        const age = (t - g.born) / g.life;
        if (age >= 1) { g.alive = false; g.t.visible = false; streak = 0; drawTop(); continue; }
        const s = age < 0.12 ? age / 0.12 : age > 0.85 ? (1 - age) / 0.15 : 1;
        g.t.scale.setScalar(Math.max(0.05, s));
        g.t.position.copy(g.base); g.t.position.z += Math.sin((t - g.born) * 2.4) * g.vx;
        g.ring.material.opacity = 0.6 + 0.3 * Math.sin(t * 20 + g.born);
      }
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) drawTop();
    },
  };
  return api;
}

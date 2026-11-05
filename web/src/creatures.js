import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { b2t } from './engine.js';

// The loft's residents, built from simple shapes: BH-22 the droid, the mouse droid it chases, Pishi the grey tabby
// and Jessi the white Shih Tzu. They walk the same path grid I do and run small daily routines.
const tb = v => [v.x, -v.z, v.y];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const E = new THREE.Euler(), Q = new THREE.Quaternion(), M4 = new THREE.Matrix4(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();

// A shape moved into place and painted, ready to merge into one mesh. `color` is a hex, or fn(x, y, z) giving one.
function piece(geo, color, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  geo.deleteAttribute('uv');
  geo.applyMatrix4(M4.compose(V.set(...at), Q.setFromEuler(E.set(...rot)), S.set(...scale)));
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  // The room is baked and unlit, so the residents are too: soft light from above is painted into their colours.
  const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    C.set(typeof color === 'function' ? color(p.getX(i), p.getY(i), p.getZ(i)) : color);
    const k = 0.5 + 0.35 * (0.5 + 0.5 * n.getY(i));
    c[i * 3] = C.r * k; c[i * 3 + 1] = C.g * k * 0.98; c[i * 3 + 2] = C.b * k * 0.95;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const FUR = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
const SHELL = FUR;
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
function mesh(pieces, mat, parent) { const m = new THREE.Mesh(mergeGeometries(pieces), mat); parent.add(m); return m; }
const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const cyl = (a, b, h, n = 14) => new THREE.CylinderGeometry(a, b, h, n);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

function buildBH22() {
  const root = new THREE.Group(), body = new THREE.Group(), dome = new THREE.Group();
  root.add(body); body.add(dome); dome.position.y = 0.5;
  const W = '#eef0f3', T = '#2bb8a6', D = '#3a3f48', O = '#e8893a';
  mesh([
    piece(cyl(0.155, 0.15, 0.36, 24), W, [0, 0.32, 0]),
    piece(cyl(0.158, 0.158, 0.03, 24), T, [0, 0.475, 0]),
    piece(box(0.07, 0.11, 0.02), T, [-0.05, 0.36, 0.148]),
    piece(box(0.05, 0.05, 0.02), O, [0.05, 0.385, 0.148]),
    piece(box(0.1, 0.035, 0.02), D, [0, 0.25, 0.146]),
    ...[-1, 1].flatMap(s => [
      piece(box(0.05, 0.4, 0.09), W, [s * 0.185, 0.24, 0]),
      piece(cyl(0.055, 0.055, 0.05, 16), T, [s * 0.185, 0.42, 0], [0, 0, Math.PI / 2]),
      piece(box(0.08, 0.06, 0.16), D, [s * 0.185, 0.03, 0.01]),
    ]),
    piece(box(0.07, 0.06, 0.12), D, [0, 0.03, 0]),
    piece(cyl(0.03, 0.05, 0.12, 12), D, [0, 0.1, 0]),
  ], SHELL, body);
  mesh([
    piece(new THREE.SphereGeometry(0.152, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), (x, y) => (y > 0.1 ? '#dfe3e8' : '#c4cad2')),
    piece(box(0.05, 0.035, 0.02), T, [0.06, 0.05, 0.135], [0, 0.4, 0]),
    piece(box(0.03, 0.03, 0.02), T, [-0.065, 0.085, 0.115], [-0.5, -0.45, 0]),
    piece(sph(0.032, 12, 8), '#15171b', [0, 0.075, 0.135]),
    piece(cyl(0.004, 0.004, 0.08, 6), D, [0.05, 0.18, -0.02]),
  ], SHELL, dome);
  const eye = new THREE.Mesh(sph(0.012, 10, 8), glow(3, 0.7, 0.55));
  eye.position.set(0, 0.078, 0.163); dome.add(eye);
  // The glass of tea it carries on its dome.
  const cup = mesh([piece(cyl(0.03, 0.024, 0.07, 14), '#c7902f', [0, 0.04, 0]), piece(cyl(0.045, 0.045, 0.006, 16), '#cdb77d')], SHELL, dome);
  cup.position.y = 0.152; cup.visible = false;
  return { root, body, dome, eye, cup };
}

function buildMouse() {
  const root = new THREE.Group();
  mesh([
    piece(box(0.15, 0.07, 0.24), '#1d2025', [0, 0.06, 0]),
    piece(box(0.12, 0.03, 0.17), '#5a616c', [0, 0.11, -0.01]),
    piece(box(0.1, 0.025, 0.05), '#2a2e35', [0, 0.06, 0.13]),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => piece(cyl(0.025, 0.025, 0.02, 12), '#0d0e10', [sx * 0.078, 0.025, sz * 0.08], [0, 0, Math.PI / 2])),
  ], SHELL, root);
  const light = new THREE.Mesh(box(0.016, 0.01, 0.01), glow(3, 0.4, 0.2));
  light.position.set(0.04, 0.126, 0.07); root.add(light);
  return { root, light };
}

// Four legs on hip pivots, so a walk is just swinging them.
function legs(parent, mat, spots, hipY, len, r, color, paw) {
  return spots.map(([x, z], i) => {
    const hip = new THREE.Group(); hip.position.set(x, hipY, z); parent.add(hip);
    mesh([piece(cyl(r, r * 0.85, len, 8), color, [0, -len / 2, 0]), piece(sph(r * 1.1, 8, 6), paw, [0, -len, r * 0.3], [0, 0, 0], [1, 0.6, 1.3])], mat, hip);
    return { hip, ph: i === 0 || i === 3 ? 0 : Math.PI, front: z > 0 };
  });
}

function buildPishi() {
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(), tail = new THREE.Group();
  root.add(body); body.add(head, tail);
  const W = '#f1efe9', G = '#8b9098', K = '#4b4f57';
  // Tabby stripes ring the body; the chest and belly are white.
  const coat = (x, y, z) => (z > 0.07 && y < 0.2 ? W : y < 0.13 ? '#d9dbde' : Math.sin(z * 70 + Math.sin(x * 40) * 1.4) > 0.3 ? K : G);
  mesh([piece(sph(0.1, 22, 16), coat, [0, 0.19, 0], [0, 0, 0], [0.85, 0.78, 2.0])], FUR, body);
  head.position.set(0, 0.29, 0.19);
  mesh([
    piece(sph(0.075, 18, 14), (x, y, z) => (y < -0.012 && z > 0.02 ? W : Math.sin(x * 95) > 0.55 && y > 0.03 ? K : G), [0, 0, 0], [0, 0, 0], [1.05, 0.92, 0.95]),
    piece(sph(0.034, 12, 10), W, [0, -0.026, 0.055], [0, 0, 0], [1.35, 0.85, 0.9]),
    piece(sph(0.009, 8, 6), '#d98c8c', [0, -0.012, 0.086]),
    ...[-1, 1].flatMap(s => [
      piece(new THREE.ConeGeometry(0.03, 0.06, 4), '#7f848c', [s * 0.042, 0.075, -0.005], [-0.15, 0, s * -0.3]),
      piece(sph(0.013, 10, 8), '#a6d36a', [s * 0.03, 0.013, 0.064]),
      piece(sph(0.006, 6, 5), '#101010', [s * 0.03, 0.013, 0.076]),
    ]),
  ], FUR, head);
  tail.position.set(0, 0.23, -0.19);
  mesh(Array.from({ length: 8 }, (_, i) => { const a = 0.25 + i * 0.16; return piece(sph(0.019, 8, 6), i % 2 ? K : G, [0, Math.sin(a) * i * 0.028, -Math.cos(a) * i * 0.028]); }), FUR, tail);
  return { root, body, head, tail, legs: legs(body, FUR, [[-0.045, 0.12], [0.045, 0.12], [-0.045, -0.12], [0.045, -0.12]], 0.16, 0.15, 0.019, '#80858d', W) };
}

function buildJessi() {
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(), tail = new THREE.Group();
  root.add(body); body.add(head, tail);
  const W = '#f6f3ee', CR = '#eadfca', K = '#1a1515';
  mesh([piece(sph(0.12, 18, 14), W, [0, 0.2, 0], [0, 0, 0], [0.95, 0.85, 1.45]), piece(sph(0.07, 12, 10), W, [0, 0.16, 0.11])], FUR, body);
  head.position.set(0, 0.31, 0.17);
  mesh([
    piece(sph(0.095, 18, 14), W),
    piece(sph(0.052, 14, 10), '#f3ede2', [0, -0.035, 0.075], [0, 0, 0], [1.15, 0.85, 0.8]),
    piece(sph(0.016, 8, 6), K, [0, -0.012, 0.119]),
    ...[-1, 1].flatMap(s => [
      piece(sph(0.013, 8, 6), K, [s * 0.036, 0.018, 0.086]),
      piece(sph(0.05, 12, 10), CR, [s * 0.085, -0.03, -0.005], [0, 0, s * 0.2], [0.55, 1.35, 0.85]),
    ]),
    piece(sph(0.022, 8, 6), W, [0, 0.096, -0.01]),
    piece(box(0.052, 0.022, 0.012), '#ff7aa8', [0, 0.1, 0.014]),
  ], FUR, head);
  tail.position.set(0, 0.28, -0.15);
  mesh([piece(sph(0.055, 12, 10), W, [0, 0.04, -0.02], [-0.9, 0, 0], [0.7, 0.9, 1.5])], FUR, tail);
  return { root, body, head, tail, legs: legs(body, FUR, [[-0.06, 0.1], [0.06, 0.1], [-0.06, -0.1], [0.06, -0.1]], 0.13, 0.12, 0.03, W, CR) };
}

let shadowTex = null;
function blob(scene, r) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1; scene.add(m);
  return m;
}

// A speech bubble over a head. `quiet` bubbles (snoring, purring) are dark and small.
function bubble(parent, y) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 112;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.5, 0.22, 1); sp.position.y = y; sp.visible = false; sp.renderOrder = 6;
  parent.add(sp);
  let until = 0;
  return {
    say(text, t, dur = 2.8, quiet = false) {
      g.clearRect(0, 0, 256, 112);
      g.font = '600 38px system-ui, sans-serif';
      const w = Math.min(244, g.measureText(text).width + 44), x = (256 - w) / 2;
      g.fillStyle = quiet ? 'rgba(18,22,30,.8)' : 'rgba(250,250,248,.95)';
      g.beginPath();
      if (g.roundRect) g.roundRect(x, 6, w, 74, 30); else g.rect(x, 6, w, 74);
      g.moveTo(116, 79); g.lineTo(128, 104); g.lineTo(142, 79);
      g.fill();
      g.fillStyle = quiet ? '#cfe9ff' : '#141820'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 128, 44, 222);
      tex.needsUpdate = true; until = t + dur; sp.visible = true;
    },
    tick(t) { const left = until - t; sp.visible = left > 0; if (sp.visible) sp.material.opacity = Math.min(1, left * 2.5); },
  };
}

// BH-22's tips, in order, one each time you talk to it.
const TIPS = [
  'Beep. Welcome in. Walk up to anything glowing and press E.',
  'The red book in the library is not a book.',
  'Press G to flip your hood, O for the wardrobe.',
  'A top score at the holo range unlocks the gold kit.',
  'Sit at the desk and type help. Pishi may join you.',
  'Jessi loves the ball. Press E next to her.',
  'Look through the telescope on the balcony. Something is up there.',
  'I chase the mouse droid. I have not caught it yet.',
];
const WORDS = ['beep', 'boop', 'bwee!', 'brrt', 'dweet', 'bip bip'];

// `fx` is the audio module's effects (positioned in the room); without it the simple synth tones stand in.
export function makeCreatures(scene, meta, { nav, groundAt, sound, fx, keyboard, onEvent = () => {}, toast = () => {} }) {
  const P = meta.points, agents = [], queue = [], waits = [], lastPlayer = new THREE.Vector3();
  const items = Object.fromEntries(['bh22', 'pishi', 'jessi'].map(id => [id, { id, r: 1.1, label: '', x: 0, y: 0, z: 0 }]));
  let now = 0, lastMode = 'walk';
  const blip = (fn, a, player) => { if (!player || a.pos.distanceTo(player) < 9) fn(a.pos); };
  let purring = 0;
  const sfx = {
    chirp: p => { if (fx) { fx.bh22(pick(['', 'curious', 'curious']), p); return; } const n = 2 + Math.floor(rnd(0, 3)); for (let i = 0; i < n; i++) { const f = rnd(1400, 3000); sound.tone(f, f * rnd(0.6, 1.7), 0.07, 0.04, i * 0.09); } },
    alert: p => (fx ? fx.bh22('alert', p) : sfx.chirp(p)),
    word: (w, p) => (fx ? fx.bh22Word(w, p) : sfx.chirp(p)),
    purr: p => { if (fx) { fx.purr(true, p); purring = now + 2.6; return; } for (let i = 0; i < 6; i++) sound.burst(90, 3, 0.22, 0.12, i * 0.26); },
    bark: p => { if (fx) { fx.woof(p); return; } sound.tone(640, 380, 0.09, 0.07, 0, 'sawtooth'); sound.tone(720, 420, 0.08, 0.05, 0.17, 'sawtooth'); },
    meow: p => { if (fx) { fx.meow(p); return; } sound.tone(620, 900, 0.22, 0.035, 0, 'triangle'); sound.tone(900, 560, 0.3, 0.035, 0.2, 'triangle'); },
    squeak: p => (fx ? fx.mouse(p) : sound.tone(3200, 4400, 0.05, 0.02, 0, 'square')),
    hiss: () => sound.burst(5200, 0.6, 0.45, 0.07),
  };

  function agent(model, speed, headY, shadowR) {
    const a = { ...model, pos: new THREE.Vector3(), facing: 0, speed, base: speed, route: [], then: null, pending: null, hop: null,
      moving: false, state: '', timer: 0, phase: 0, sitK: 0, sleepK: 0, epoch: 0, onFloor: true, bub: bubble(model.root, headY), shadow: blob(scene, shadowR) };
    scene.add(model.root); agents.push(a);
    return a;
  }
  function place(a, p) { a.pos.copy(p); a.route = []; a.hop = null; a.then = null; a.epoch++; }
  // Paths are planned one per frame, so several residents changing their minds never cost a frame.
  function goTo(a, target, then) { a.route = []; a.hop = null; a.then = null; a.epoch++; a.pending = { target, then }; if (!queue.includes(a)) queue.push(a); }
  function hop(a, to, then, dur = 0.45, h = 0.22) { a.route = []; a.pending = null; a.epoch++; a.hop = { a: a.pos.clone(), b: to.clone(), k: 0, dur, h, then }; a.onFloor = false; }
  function hops(a, list, then) { if (!list.length) { then?.(); return; } hop(a, list[0], () => hops(a, list.slice(1), then)); }
  function wait(a, sec, fn) { waits.push({ a, epoch: a.epoch, at: now + sec, fn }); }
  function plan() {
    const a = queue.shift();
    if (!a || !a.pending) return;
    const { target, then } = a.pending;
    a.pending = null;
    const p = nav().path(tb(a.pos), target);
    if (!p) { then?.(false); return; }
    a.route = p.slice(1).map(q => b2t(...q)); a.then = then; a.onFloor = true;
    if (!a.route.length) { a.then = null; then?.(true); }
  }
  function turn(a, dx, dz, dt, k = 10) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-5) return;
    let d = Math.atan2(dx, dz) - a.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
    a.facing += d * Math.min(1, dt * k);
  }
  function move(a, dt) {
    if (a.hop) {
      const h = a.hop;
      h.k = Math.min(1, h.k + dt / h.dur);
      a.pos.lerpVectors(h.a, h.b, h.k); a.pos.y += Math.sin(Math.PI * h.k) * h.h;
      turn(a, h.b.x - h.a.x, h.b.z - h.a.z, dt, 14);
      a.moving = false;
      if (h.k >= 1) { a.hop = null; a.pos.copy(h.b); h.then?.(); }
      return;
    }
    const next = a.route[0];
    if (!next) { a.moving = false; return; }
    const dx = next.x - a.pos.x, dz = next.z - a.pos.z, len = Math.hypot(dx, dz), s = a.speed * dt;
    if (len <= s) {
      a.pos.x = next.x; a.pos.z = next.z; a.route.shift();
      if (!a.route.length) { a.pos.y = groundAt(a.pos.x, a.pos.z, a.pos.y); a.moving = false; const t = a.then; a.then = null; t?.(true); return; }
    } else { a.pos.x += dx / len * s; a.pos.z += dz / len * s; }
    turn(a, dx, dz, dt);
    a.pos.y = groundAt(a.pos.x, a.pos.z, a.pos.y);
    a.moving = true;
  }
  const faceTo = (a, p, dt) => turn(a, p.x - a.pos.x, p.z - a.pos.z, dt, 6);

  // Hearts that float up when someone is happy.
  const heartTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#ff5a7a';
    g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(2, 34, 10, 6, 32, 22); g.bezierCurveTo(54, 6, 62, 34, 32, 56); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const hearts = Array.from({ length: 8 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
    s.scale.setScalar(0.09); s.visible = false; s.renderOrder = 6; scene.add(s);
    return { s, t0: -9, base: new THREE.Vector3(), dx: 0 };
  });
  function love(at) {
    let n = 0;
    for (const h of hearts) if (n < 3 && now - h.t0 > 1.8) { h.t0 = now + n * 0.25; h.base.copy(at); h.dx = rnd(-0.12, 0.12); n++; }
  }

  // ---------- BH-22 ----------
  const r2 = agent(buildBH22(), 0.9, 0.8, 0.2);
  const dock = b2t(...P.bh22_dock);
  place(r2, dock); r2.facing = Math.PI / 2; r2.state = 'dock'; r2.timer = rnd(12, 22); r2.chaseCool = 20; r2.stops = 0;
  let tipAt = 0;
  const STOPS = [meta.spots.lounge, meta.spots.window, meta.spots.desk, [14.6, 9.4, 0], [16.0, 8.9, 0], [9.0, 3.6, 0], [2.6, 2.4, 0], [12.0, 12.0, 0]].filter(Boolean);
  function r2Next() {
    if (r2.stops-- <= 0) {
      r2.state = 'home';
      // The walk grid keeps clear of the dock's post, so it rolls the last bit straight on.
      goTo(r2, P.bh22_dock, () => { r2.route = [dock.clone()]; r2.then = () => { r2.state = 'dock'; r2.timer = rnd(30, 50); }; });
      return;
    }
    r2.state = 'patrol';
    const visit = Math.random() < 0.3 && jessi.onFloor;
    goTo(r2, visit ? tb(jessi.pos) : pick(STOPS), ok => {
      r2.state = 'pause'; r2.timer = ok ? rnd(3, 6) : 0.5;
      if (!ok) return;
      r2.bub.say(visit ? 'hi Jessi' : pick(WORDS), now); blip(sfx.chirp, r2, lastPlayer);
      if (visit && jessi.state !== 'nap') wait(jessi, 0.7, () => { jessi.bub.say('woof!', now); blip(sfx.bark, jessi, lastPlayer); });
    });
  }
  function bringTea(stand) {
    if (!['dock', 'pause', 'patrol'].includes(r2.state)) return;
    r2.state = 'tea';
    const giveUp = () => { r2.cup.visible = false; r2.state = 'pause'; r2.timer = 1; r2.stops = 1; };
    goTo(r2, [14.6, 9.4, 0], ok => {
      if (!ok) { giveUp(); return; }
      r2.cup.visible = true; r2.bub.say('pouring', now);
      // Only a glass that reaches me counts: if I have stood up or it cannot get there, it takes the tea back.
      wait(r2, 2, () => goTo(r2, stand, ok2 => {
        if (!ok2 || lastMode !== 'sit' || r2.pos.distanceTo(lastPlayer) > 2.5) { r2.bub.say('oh', now); giveUp(); return; }
        r2.bub.say('tea!', now); blip(sfx.chirp, r2);
        toast('BH-22 brought you a glass of tea.'); onEvent('tea');
        wait(r2, 2.5, giveUp);
      }));
    });
  }
  function tickR2(dt, ctx) {
    r2.chaseCool -= dt;
    const look = r2.moving ? 0 : r2.state === 'talk' ? null : Math.sin(now * (r2.state === 'dock' ? 0.4 : 1.3)) * 0.9;
    if (look !== null) r2.dome.rotation.y += (look - r2.dome.rotation.y) * Math.min(1, dt * 3);
    r2.body.rotation.x += ((r2.moving ? 0.07 : 0) - r2.body.rotation.x) * Math.min(1, dt * 5);
    r2.eye.visible = (now % 3.1) > 0.12;
    if (r2.state === 'dock' && !r2.moving) turn(r2, 1, 0, dt, 3);
    if (r2.state === 'dock' && (r2.timer -= dt) < 0) { r2.stops = 2 + Math.floor(rnd(0, 3)); r2Next(); }
    else if (r2.state === 'pause' && (r2.timer -= dt) < 0) r2Next();
    else if (r2.state === 'talk') {
      faceTo(r2, ctx.player, dt);
      if ((r2.timer -= dt) < 0) { r2.state = 'pause'; r2.timer = 1; }
    } else if (r2.state === 'chase') {
      if ((r2.timer -= dt) < 0) { r2.state = 'pause'; r2.timer = 2; r2.speed = r2.base; r2.bub.say('next time', now); }
      else if ((r2.repath -= dt) < 0) { r2.repath = 0.9; goTo(r2, tb(mouse.pos), null); }
    }
    // It goes after the mouse droid whenever it gets close.
    if ((r2.state === 'pause' || r2.state === 'patrol') && r2.chaseCool < 0 && r2.pos.distanceTo(mouse.pos) < 2.5 && Math.abs(r2.pos.y - mouse.pos.y) < 0.3) {
      r2.state = 'chase'; r2.timer = 6; r2.repath = 0; r2.speed = 1.5; r2.chaseCool = 60; mouse.flee = 6;
      r2.bub.say('!!', now); blip(sfx.alert, r2, ctx.player);
    }
  }

  // ---------- the mouse droid ----------
  const mouse = agent(buildMouse(), 1.1, 0.3, 0.12);
  place(mouse, b2t(2.2, 6.4, 0)); mouse.state = 'wait'; mouse.timer = 4; mouse.flee = 0;
  const FLOOR = [];
  for (let x = 1.5; x < 21; x += 1.6) for (let y = 1.5; y < 14.4; y += 1.6) FLOOR.push([x, y, 0]);
  function tickMouse(dt, ctx) {
    mouse.flee -= dt;
    const scared = mouse.flee > 0 || mouse.pos.distanceTo(ctx.player) < 1.1;
    mouse.speed = scared ? 2.1 : 1.1;
    if (mouse.state === 'wait' && ((mouse.timer -= dt) < 0 || scared)) {
      mouse.state = 'zip';
      blip(sfx.squeak, mouse, ctx.player);
      goTo(mouse, pick(FLOOR), () => { mouse.state = 'wait'; mouse.timer = rnd(1.5, 5); });
    }
    mouse.light.visible = (now * 3) % 1 > 0.4;
  }

  // ---------- Pishi ----------
  const pishi = agent(buildPishi(), 0.75, 0.48, 0.16);
  const catWindow = b2t(...P.cat_window), windowFloor = [5.4, 13.9, 0];
  place(pishi, catWindow); pishi.facing = Math.PI; pishi.state = 'window'; pishi.timer = rnd(40, 70); pishi.onFloor = false;
  // Up the cat tree's three decks, along the wall shelves, to the perch over the fire.
  const treeFloor = [1.35, 14.1, 0];
  const climbUp = [[0.8, 14.05, 0.625], [0.88, 14.2, 1.225], [0.72, 14.05, 1.825]].map(p => b2t(...p));
  const walkUp = [...climbUp, ...meta.catwalk.slice(1).map(p => b2t(...p))];
  const WANDER = [meta.spots.lounge, [3.0, 13.0, 0], [11.5, 11.0, 0], [10.6, 11.6, 0], [6.6, 6.4, 0], [14.0, 10.5, 0]].filter(Boolean);
  let deskT = 0, keysTip = false;
  const deskFloor = () => [P.chair[0] - 0.3, P.chair[1] - 0.8, P.chair[2]];
  function pishiNext() {
    pishi.speed = pishi.base;
    const r = Math.random();
    if (r < 0.35) {
      pishi.state = 'towindow';
      goTo(pishi, windowFloor, ok => ok ? hop(pishi, catWindow, () => { pishi.state = 'window'; pishi.timer = rnd(40, 80); pishi.facing = Math.PI; }, 0.5, 0.3) : pishiNext());
    } else if (r < 0.65) {
      pishi.state = 'climb';
      goTo(pishi, treeFloor, ok => ok ? hops(pishi, walkUp, () => { pishi.state = 'perch'; pishi.timer = rnd(50, 90); }) : pishiNext());
    } else {
      pishi.state = 'wander';
      goTo(pishi, pick(WANDER), () => { pishi.state = 'sit'; pishi.timer = rnd(5, 10); });
    }
  }
  function pishiDown(list, then) { pishi.state = 'down'; hops(pishi, list, then); }
  function pishiShoo() {
    if (pishi.state !== 'keys') return false;
    pishi.bub.say('mrrow', now); blip(sfx.meow, pishi);
    pishiDown([b2t(...deskFloor())], () => { pishi.onFloor = true; pishi.pos.y = groundAt(pishi.pos.x, pishi.pos.z, pishi.pos.y + 0.1); pishiNext(); });
    return true;
  }
  function tickPishi(dt, ctx) {
    const st = pishi.state;
    deskT = ctx.mode === 'desk' ? deskT + dt : 0;
    // Sit at the desk for a few seconds and she comes to walk on the keyboard.
    const kb = keyboard();
    if (kb && deskT > 4 && ['window', 'sit', 'wander'].includes(st) && !pishi.hop) {
      pishi.state = 'todesk'; pishi.speed = 1.4;
      const go = () => goTo(pishi, deskFloor(), ok => ok && lastMode === 'desk' ? hop(pishi, kb, () => { pishi.state = 'keys'; pishi.timer = 25; pishi.keyAt = 1.5; }, 0.55, 0.35) : pishiNext());
      if (st === 'window') hop(pishi, b2t(...windowFloor), () => { pishi.onFloor = true; go(); }); else go();
    }
    if (st === 'keys') {
      if (!keysTip && ctx.mode === 'desk') { keysTip = true; toast('Pishi is walking on the keyboard. Type shoo to move her.'); }
      if ((pishi.keyAt -= dt) < 0) {
        pishi.keyAt = rnd(1.8, 3.2);
        onEvent('pishi_keys', Array.from({ length: 2 + Math.floor(rnd(0, 4)) }, () => pick('asdfjkl;ghqwe')).join(''));
        if (Math.random() < 0.3) pishi.bub.say('mrrp', now);
      }
      if ((pishi.timer -= dt) < 0 || ctx.mode !== 'desk') pishiShoo();
    }
    if ((st === 'window' || st === 'sit') && (pishi.timer -= dt) < 0) {
      // The state changes as the jump starts, or the next frame would start the jump again.
      if (st === 'window') { pishi.state = 'down'; hop(pishi, b2t(...windowFloor), () => { pishi.onFloor = true; pishiNext(); }); } else pishiNext();
    }
    if (st === 'perch') {
      if ((pishi.zz = (pishi.zz || 0) - dt) < 0) { pishi.zz = 7; pishi.bub.say('z z z', now, 2.5, true); }
      if ((pishi.timer -= dt) < 0) pishiDown([...walkUp].reverse().slice(1).concat(b2t(...treeFloor)), () => { pishi.onFloor = true; pishiNext(); });
    }
    if (st === 'petted' && (pishi.timer -= dt) < 0) { pishi.state = 'sit'; pishi.timer = 3; }
    if (st === 'treesit' && (pishi.timer -= dt) < 0) pishiDown([climbUp[0], b2t(...treeFloor)], () => { pishi.onFloor = true; pishiNext(); });
    // She runs up the cat tree when Jessi comes too close.
    if (pishi.onFloor && !pishi.hop && jessi.onFloor && !['flee', 'keys', 'todesk'].includes(pishi.state) && pishi.pos.distanceTo(jessi.pos) < 0.9) {
      pishi.state = 'flee'; pishi.speed = 2.2;
      pishi.bub.say('hss!', now); blip(sfx.hiss, pishi, ctx.player);
      goTo(pishi, treeFloor, ok => {
        pishi.speed = pishi.base;
        if (ok) hops(pishi, climbUp.slice(0, 2), () => { pishi.state = 'treesit'; pishi.timer = 15; }); else pishiNext();
      });
    }
    const sit = ['window', 'sit', 'keys', 'treesit', 'petted'].includes(pishi.state) && !pishi.hop && !pishi.moving;
    pishi.sitK += ((sit ? 1 : 0) - pishi.sitK) * Math.min(1, dt * 4);
    pishi.sleepK += ((pishi.state === 'perch' ? 1 : 0) - pishi.sleepK) * Math.min(1, dt * 2);
  }

  // ---------- Jessi ----------
  const jessi = agent(buildJessi(), 0.85, 0.52, 0.2);
  const bed = b2t(...P.jessi_bed), bedFloor = [13.6, 13.5, 0];
  place(jessi, bed); jessi.state = 'nap'; jessi.timer = rnd(25, 50); jessi.onFloor = false;
  const ball = new THREE.Mesh(sph(0.032, 14, 10), new THREE.MeshStandardMaterial({ color: '#cde23c', roughness: 0.8 }));
  ball.visible = false; scene.add(ball);
  let flight = null, ballGone = 0;
  const JESSI_GO = [[11.5, 12.6, 0], [14.6, 9.4, 0], [10.4, 7.0, 0], [3.0, 13.0, 0], [16.5, 12.0, 0], meta.spots.lounge].filter(Boolean);
  function jessiWake(then) {
    if (jessi.onFloor) { then(); return; }
    jessi.state = 'waking';
    jessi.bub.say('*yawn*', now);
    hop(jessi, b2t(...bedFloor), () => { jessi.onFloor = true; jessi.pos.y = groundAt(jessi.pos.x, jessi.pos.z, 0.1); then(); }, 0.4, 0.15);
  }
  function jessiNext(ctx) {
    if ((jessi.stops = (jessi.stops ?? 3) - 1) < 0) {
      jessi.stops = 2 + Math.floor(rnd(0, 3));
      jessi.state = 'tobed';
      goTo(jessi, bedFloor, ok => ok ? hop(jessi, bed, () => { jessi.state = 'nap'; jessi.onFloor = false; jessi.timer = rnd(40, 80); }, 0.4, 0.15) : (jessi.state = 'sniff', jessi.timer = 2));
      return;
    }
    // Now and then she decides to follow you around for a while.
    if (ctx && Math.random() < 0.35 && jessi.pos.distanceTo(ctx.player) < 6) { jessi.state = 'follow'; jessi.timer = rnd(18, 28); jessi.repath = 0; return; }
    jessi.state = 'wander';
    goTo(jessi, pick(JESSI_GO), () => { jessi.state = 'sniff'; jessi.timer = rnd(2, 5); });
  }
  const inLoft = p => -p.z > 0.1 && -p.z < 14.8;
  function throwBall(ctx) {
    const dir = new THREE.Vector3(Math.sin(ctx.facing), 0, Math.cos(ctx.facing));
    const from = tb(ctx.player);
    let land = null;
    for (const d of [4.5, 3.5, 2.5, 1.6]) {
      const to = ctx.player.clone().addScaledVector(dir, d);
      if (nav().clear(from, tb(to))) { land = to; land.y = groundAt(to.x, to.z, ctx.player.y + 0.1); break; }
    }
    if (!land) { toast('No room to throw here.'); return; }
    flight = { a: ctx.player.clone().add(new THREE.Vector3(0, 1.1, 0)), b: land, k: 0 };
    ball.visible = true;
    jessi.state = 'fetch'; jessi.speed = 2.4;
    jessi.bub.say('!', now); blip(sfx.bark, jessi);
    ballGone = 0;
    goTo(jessi, tb(land), ok => {
      if (!ok) { jessi.state = 'sniff'; jessi.timer = 2; jessi.speed = jessi.base; ballGone = now + 2; return; }
      jessi.carry = true;
      // Back to just in front of me, wherever I have walked to since.
      wait(jessi, 0.3, () => goTo(jessi, tb(lastPlayer.clone().add(jessi.pos.clone().sub(lastPlayer).setY(0).normalize().multiplyScalar(0.7))), () => {
        jessi.carry = false; jessi.speed = jessi.base;
        ball.position.copy(jessi.pos).add(new THREE.Vector3(Math.sin(jessi.facing) * 0.25, 0.03, Math.cos(jessi.facing) * 0.25));
        jessi.state = 'happy'; jessi.timer = 3; love(jessi.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
        jessi.bub.say('woof!', now); blip(sfx.bark, jessi);
        toast('Good girl. Jessi gets a treat.'); onEvent('jessi');
        ballGone = now + 2.5;
      }));
    });
  }
  function tickJessi(dt, ctx) {
    if (flight) {
      flight.k = Math.min(1, flight.k + dt / 0.9);
      ball.position.lerpVectors(flight.a, flight.b, flight.k); ball.position.y += Math.sin(Math.PI * flight.k) * 1.0 + 0.03;
      if (flight.k >= 1) flight = null;
    } else if (jessi.carry) {
      ball.position.copy(jessi.head.getWorldPosition(V)).add(new THREE.Vector3(Math.sin(jessi.facing) * 0.11, -0.05, Math.cos(jessi.facing) * 0.11));
    } else if (ballGone && now > ballGone) { ball.visible = false; ballGone = 0; }
    const st = jessi.state;
    if (st === 'nap') {
      if ((jessi.zz = (jessi.zz || 0) - dt) < 0) { jessi.zz = 6; jessi.bub.say('z z z', now, 2.5, true); }
      if ((jessi.timer -= dt) < 0) jessiWake(() => jessiNext(ctx));
    }
    if (st === 'sniff' && (jessi.timer -= dt) < 0) jessiNext(ctx);
    if (st === 'happy' && (jessi.timer -= dt) < 0) { jessi.state = 'follow'; jessi.timer = rnd(10, 18); jessi.repath = 0; }
    if (st === 'follow') {
      const d = jessi.pos.distanceTo(ctx.player);
      if ((jessi.timer -= dt) < 0) jessiNext(ctx);
      else if (inLoft(ctx.player) && d > 1.7 && (jessi.repath -= dt) < 0) {
        jessi.repath = 1.2;
        const behind = ctx.player.clone().sub(jessi.pos).setY(0).normalize().multiplyScalar(-1.1).add(ctx.player);
        goTo(jessi, tb(behind), null);
      } else if (d < 1.4 && !jessi.moving) faceTo(jessi, ctx.player, dt);
    }
    const sit = (st === 'happy' || (st === 'follow' && !jessi.moving)) && !jessi.hop;
    jessi.sitK += ((sit ? 1 : 0) - jessi.sitK) * Math.min(1, dt * 4);
    jessi.sleepK += ((st === 'nap' ? 1 : 0) - jessi.sleepK) * Math.min(1, dt * 2);
    jessi.wag = st === 'happy' || st === 'fetch' || (st === 'follow' && jessi.pos.distanceTo(ctx.player) < 2) ? 1 : 0.25;
  }

  // ---------- poses ----------
  function animatePet(a, dt, size) {
    a.phase += dt * (a.moving ? a.speed * 15 : 0);
    const walkK = a.moving ? 1 : 0;
    for (const l of a.legs) {
      const fold = l.front ? 0 : a.sitK * 1.2;
      l.hip.rotation.x = Math.sin(a.phase + l.ph) * 0.6 * walkK - fold;
      l.hip.scale.y = 1 - a.sleepK * 0.85;
    }
    a.body.rotation.x = -a.sitK * 0.45;
    a.body.position.set(0, -a.sleepK * size * 0.5 - a.sitK * size * 0.15, -a.sitK * size * 0.2);
    a.head.rotation.x = a.sleepK * 0.55 + Math.sin(now * 0.7) * 0.05 + a.sitK * 0.35;
    a.head.rotation.y = a.moving ? 0 : Math.sin(now * 0.33 + size * 9) * 0.4 * (1 - a.sleepK);
  }

  return {
    pishi, jessi, bh22: r2, mouse,
    // BH-22 and Jessi go through the balcony door, so it opens for them too (the mouse droid would keep it busy).
    positions: [r2.pos, jessi.pos],
    tick(dt, t, ctx) {
      now = t;
      if (purring && now > purring) { fx?.purr(false); purring = 0; }
      lastPlayer.copy(ctx.player);
      plan();
      for (let i = waits.length - 1; i >= 0; i--) { const w = waits[i]; if (w.at > t) continue; waits.splice(i, 1); if (w.a.epoch === w.epoch) w.fn(); }
      if (ctx.mode === 'sit' && lastMode !== 'sit' && ctx.stand && Math.random() < 0.6) bringTea(ctx.stand);
      lastMode = ctx.mode;
      tickR2(dt, ctx); tickMouse(dt, ctx); tickPishi(dt, ctx); tickJessi(dt, ctx);
      for (const a of agents) {
        move(a, dt);
        a.root.position.copy(a.pos);
        a.root.rotation.y = a.facing;
        a.bub.tick(t);
        const gy = groundAt(a.pos.x, a.pos.z, a.pos.y + 0.05);
        a.shadow.visible = a.pos.y - gy < 0.6;
        a.shadow.position.set(a.pos.x, gy + 0.012, a.pos.z);
      }
      animatePet(pishi, dt, 0.2);
      pishi.tail.rotation.y = Math.sin(t * (pishi.sleepK > 0.5 ? 0.6 : 2.2)) * 0.35;
      pishi.tail.rotation.x = pishi.sitK * 0.9 - pishi.sleepK * 0.6;
      animatePet(jessi, dt, 0.22);
      jessi.tail.rotation.z = Math.sin(t * 14) * 0.5 * jessi.wag;
      for (const h of hearts) {
        const k = (t - h.t0) / 1.6;
        h.s.visible = k >= 0 && k < 1;
        if (h.s.visible) { h.s.position.copy(h.base).add(V.set(h.dx * k, 0.1 + 0.45 * k, 0)); h.s.material.opacity = 1 - k; }
      }
    },
    // The closest resident in reach, shaped like the room's interact spots.
    nearest(p) {
      let best = null, bd = Infinity;
      for (const [a, id, label] of [[r2, 'bh22', 'Talk to BH-22'], [pishi, 'pishi', 'Pet Pishi'], [jessi, 'jessi', jessi.state === 'nap' ? 'Wake Jessi' : 'Throw the ball for Jessi']]) {
        if (a.hop || Math.abs(p.y - a.pos.y) > 1.0 || (id === 'jessi' && a.state === 'fetch')) continue;
        const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z);
        if (d <= 1.1 && d < bd) { bd = d; best = items[id]; Object.assign(best, { label, x: a.pos.x, y: a.pos.y, z: a.pos.z }); }
      }
      return best;
    },
    act(id, ctx) {
      if (id === 'bh22') {
        if (r2.pos.distanceTo(ctx.player) > 2.5) { toast('BH-22 is out on patrol somewhere in the loft.'); return; }
        // Talking interrupts whatever it was doing, so drop the errand's leftovers too.
        r2.state = 'talk'; r2.timer = 3.5; r2.route = []; r2.pending = null; r2.epoch++;
        r2.cup.visible = false; r2.speed = r2.base;
        r2.bub.say(pick(WORDS), now); sfx.word(tipAt === 0 ? 'hello' : pick(['yay', 'behbod', 'hello']), r2.pos);
        toast('BH-22: ' + TIPS[tipAt++ % TIPS.length]);
        onEvent('bh22');
      } else if (id === 'pishi') {
        if (pishiShoo()) return;
        // On the window sill she stays put and just enjoys it; on the floor she sits for it.
        if (pishi.state === 'window') pishi.timer = Math.max(pishi.timer, 8);
        else { pishi.state = 'petted'; pishi.timer = 4; pishi.route = []; pishi.pending = null; pishi.epoch++; faceTo(pishi, ctx.player, 1); }
        love(pishi.pos.clone().add(new THREE.Vector3(0, 0.4, 0))); sfx.purr(pishi.pos); pishi.bub.say('prrr', now, 2.5, true);
        onEvent('pishi');
      } else if (id === 'jessi') {
        if (jessi.state === 'nap') { jessiWake(() => { jessi.state = 'happy'; jessi.timer = 2; love(jessi.pos.clone().add(new THREE.Vector3(0, 0.5, 0))); }); return; }
        throwBall(ctx);
      }
    },
    // Which resident a click landed on, if any.
    hit(ray) {
      for (const [a, id] of [[pishi, 'pishi'], [jessi, 'jessi'], [r2, 'bh22']]) if (ray.intersectObject(a.root, true).some(h => !h.object.isSprite)) return id;
      return null;
    },
    shoo: () => pishiShoo(),
  };
}

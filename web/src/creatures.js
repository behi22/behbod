import * as THREE from 'three';
import { piece, mesh, glow, sph, cyl, box, rbox, torus, PAINT } from './shapes.js';
import { b2t } from './engine.js';

// The loft's residents, built from simple shapes: BH-22 the droid, the mouse droid it chases, Pishi the grey tabby
// and Jessi the white Shih Tzu. They walk the same path grid I do and run small daily routines.
const tb = v => [v.x, -v.z, v.y];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const V = new THREE.Vector3();
const FUR = PAINT, SHELL = PAINT;

// BH-22, the Hopper (picked in Room Lab round 4): a matte black rounded body with a face screen and LED dot eyes, an
// antenna, edges lit in the room's RGB, and two legs that end in wheels. About 40 cm tall. `dome` is the upper body,
// which turns to look around; `rgb` are the lit edges, recoloured with the room's light scene.
function buildBH22() {
  const root = new THREE.Group(), body = new THREE.Group(), dome = new THREE.Group();
  root.add(body); body.add(dome); dome.position.y = 0.17;
  const K = '#1b1e23', K2 = '#2a2e35', RUB = '#101114';
  // Legs: hip, knee and wheel on each side, angled out a little.
  const wheels = [];
  mesh([...[-1, 1].flatMap(s => [
    piece(rbox(0.026, 0.07, 0.034, 0.01), K2, [s * 0.066, 0.135, -0.004], [0.25, 0, s * -0.32]),
    piece(sph(0.017, 12, 8), K, [s * 0.081, 0.1, -0.012]),
    piece(rbox(0.022, 0.06, 0.03, 0.009), K2, [s * 0.081, 0.068, 0.0], [-0.2, 0, s * 0.08]),
  ])], PAINT, body);
  for (const s of [-1, 1]) {
    const w = mesh([piece(cyl(0.045, 0.045, 0.026, 24), RUB, [0, 0, 0], [0, 0, Math.PI / 2]), piece(cyl(0.028, 0.028, 0.03, 16), K2, [0, 0, 0], [0, 0, Math.PI / 2])], PAINT, body);
    w.position.set(s * 0.083, 0.045, 0.004);
    wheels.push(w);
  }
  // The body: a rounded block with a recessed face screen.
  mesh([
    piece(rbox(0.2, 0.14, 0.16, 0.04, 4), K, [0, 0.07, 0]),
    piece(rbox(0.152, 0.092, 0.012, 0.018, 3), '#050607', [0, 0.072, 0.077], [0, 0, 0], [1, 1, 1], 0.2),
    piece(cyl(0.0045, 0.0045, 0.075, 8), K2, [0.058, 0.17, -0.01], [0, 0, -0.22]),
    piece(cyl(0.014, 0.018, 0.012, 16), K2, [0.05, 0.141, -0.01]),
  ], PAINT, dome);
  // Lit parts: the antenna tip, the frame round the face, the waist and top edges (in the room's RGB), the eyes.
  const tip = new THREE.Mesh(sph(0.009, 12, 8), glow(3, 0.7, 0.45));
  tip.position.set(0.066, 0.205, -0.01); dome.add(tip);
  const rgbMat = glow(0.15, 1.6, 1.4);
  const rgb = mesh([
    piece(rbox(0.16, 0.1, 0.004, 0.02, 3), '#ffffff', [0, 0.072, 0.0705], [0, 0, 0], [1, 1, 1], 0),
    piece(rbox(0.203, 0.006, 0.163, 0.003, 2), '#ffffff', [0, 0.012, 0], [0, 0, 0], [1, 1, 1], 0),
  ], rgbMat, dome);
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.075, 0.0845);
  const eyeMat = glow(0.5, 2.6, 2.2);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(rbox(0.017, 0.026, 0.004, 0.006, 2), eyeMat); e.position.x = s * 0.03; eyes.add(e); }
  dome.add(eyes);
  // The glass of tea it carries on its head.
  const cup = mesh([piece(cyl(0.025, 0.02, 0.06, 14), '#c7902f', [0, 0.034, 0]), piece(cyl(0.038, 0.038, 0.005, 16), '#cdb77d')], PAINT, dome);
  cup.position.set(-0.03, 0.142, 0); cup.visible = false;
  return { root, body, dome, eye: eyes, eyeMat, cup, wheels, rgb: rgbMat };
}

// The mouse droid: a low black box on hidden wheels with a slanted nose, panelled sides, a ridged top deck, a small
// arm tucked under the nose and a blinking light, zipping about the floor.
function buildMouse() {
  const root = new THREE.Group();
  const K = '#1c1e22', P = '#3d424a', L = '#5c636e';
  mesh([
    piece(rbox(0.15, 0.06, 0.25, 0.012), K, [0, 0.05, -0.01]),
    // The nose slopes down to the front.
    piece(rbox(0.15, 0.045, 0.08, 0.01), K, [0, 0.07, 0.1], [0.42, 0, 0]),
    piece(rbox(0.12, 0.022, 0.16, 0.008), P, [0, 0.087, -0.03]),
    ...[-0.08, -0.04, 0, 0.04].map(z => piece(box(0.1, 0.006, 0.012), L, [0, 0.1, z - 0.03])),
    ...[-1, 1].flatMap(s => [
      piece(box(0.004, 0.034, 0.18), P, [s * 0.076, 0.05, -0.02]),
      piece(box(0.005, 0.01, 0.12), L, [s * 0.078, 0.06, -0.02]),
    ]),
    piece(box(0.04, 0.012, 0.03), L, [0, 0.03, 0.14]),
    piece(cyl(0.006, 0.006, 0.05, 8), L, [0, 0.03, 0.17], [Math.PI / 2, 0, 0]),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => piece(cyl(0.018, 0.018, 0.014, 12), '#0b0c0e', [sx * 0.066, 0.018, sz * 0.08], [0, 0, Math.PI / 2])),
  ], PAINT, root);
  const light = new THREE.Mesh(box(0.016, 0.008, 0.008), glow(3, 0.4, 0.2));
  light.position.set(0.045, 0.1, 0.06); root.add(light);
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

// The poses a pet can ease into on top of walking, sitting and sleeping (see animatePet).
const POSES = ['bow', 'paw', 'roll', 'beg', 'groom', 'lean', 'blink'];

// Eyelids in the fur's colour, shown only while the eyes close.
function lids(head, color, x, y, z, r) {
  const mat = new THREE.MeshBasicMaterial({ color, fog: true });
  return [-1, 1].map(s => { const l = new THREE.Mesh(sph(r, 10, 8), mat); l.position.set(s * x, y, z); l.visible = false; head.add(l); return l; });
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
  return { root, body, head, tail, lids: lids(head, '#767b83', 0.03, 0.013, 0.064, 0.0145), legs: legs(body, FUR, [[-0.045, 0.12], [0.045, 0.12], [-0.045, -0.12], [0.045, -0.12]], 0.16, 0.15, 0.019, '#80858d', W) };
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
  return { root, body, head, tail, lids: lids(head, '#d9d5cf', 0.036, 0.018, 0.086, 0.0145), legs: legs(body, FUR, [[-0.06, 0.1], [0.06, 0.1], [-0.06, -0.1], [0.06, -0.1]], 0.13, 0.12, 0.03, W, CR) };
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
  'Three stars on a stage at the range unlocks the gold kit.',
  'Sit at the desk and type help. Pishi may join you.',
  'Jessi loves the ball. Press E next to her.',
  'Look through the telescope on the balcony. Something is up there.',
  'I chase the mouse droid. I have not caught it yet.',
];
const WORDS = ['beep', 'boop', 'bwee!', 'brrt', 'dweet', 'bip bip'];

// `fx` is the audio module's effects (positioned in the room); without it the simple synth tones stand in.
// `findPath(from, to)` resolves to a path or null (planned off the main thread); `clear(from, to)` says whether a straight
// line between two points stays on walkable floor.
export function makeCreatures(scene, meta, { findPath, clear, groundAt, sound, fx, keyboard, onEvent = () => {}, toast = () => {} }) {
  const P = meta.points, agents = [], waits = [], lastPlayer = new THREE.Vector3();
  const items = Object.fromEntries(['bh22', 'pishi', 'jessi'].map(id => [id, { id, r: 1.1, label: '', x: 0, y: 0, z: 0 }]));
  // Pressing E takes turns through each one's things to do, so a visit is never the same thing twice running.
  const TURNS = { pishi: ['pet', 'play', 'treat'], jessi: ['fetch', 'pet', 'trick'], bh22: ['talk', 'pet', 'play'] };
  const LABELS = {
    pishi: { pet: 'Pet Pishi', play: 'Play with Pishi', treat: 'Give Pishi a treat' },
    jessi: { fetch: 'Throw the ball for Jessi', pet: 'Pet Jessi', trick: 'Ask Jessi for a trick' },
    bh22: { talk: 'Talk to BH-22', pet: 'Pet BH-22', play: 'Play with BH-22' },
  };
  const turnAt = { pishi: 0, jessi: 0, bh22: 0 };
  // Up on the sill or the tree, Pishi can only be petted.
  const actionFor = id => (id === 'pishi' && !pishi.onFloor ? 'pet' : TURNS[id][turnAt[id] % TURNS[id].length]);
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
      moving: false, state: '', timer: 0, phase: 0, sitK: 0, sleepK: 0, epoch: 0, onFloor: true, bub: bubble(model.root, headY), shadow: blob(scene, shadowR),
      pose: Object.fromEntries(POSES.map(k => [k, 0])), want: {} };
    scene.add(model.root); agents.push(a);
    return a;
  }
  function place(a, p) { a.pos.copy(p); a.route = []; a.hop = null; a.then = null; a.epoch++; }
  // Paths are planned off the main thread; the answer arrives a frame or two later and is dropped if the resident has
  // been given something else to do in the meantime.
  function goTo(a, target, then) {
    a.route = []; a.hop = null; a.then = null;
    const epoch = ++a.epoch;
    a.pending = true;
    findPath(tb(a.pos), target).then(p => {
      if (a.epoch !== epoch) return;
      a.pending = null;
      if (!p) { then?.(false); return; }
      a.route = p.slice(1).map(q => b2t(...q)); a.then = then; a.onFloor = true;
      if (!a.route.length) { a.then = null; then?.(true); }
    });
  }
  function hop(a, to, then, dur = 0.45, h = 0.22) { a.route = []; a.pending = null; a.epoch++; a.hop = { a: a.pos.clone(), b: to.clone(), k: 0, dur, h, then }; a.onFloor = false; }
  function hops(a, list, then) { if (!list.length) { then?.(); return; } hop(a, list[0], () => hops(a, list.slice(1), then)); }
  function wait(a, sec, fn) { waits.push({ a, epoch: a.epoch, at: now + sec, fn }); }
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
  const r2 = agent(buildBH22(), 0.9, 0.5, 0.15);
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
  // Ends a pet or a play early or on time: its eye colour, dome tilt and hop height go back to normal.
  function endR2Fun() {
    if (r2.eyeWas !== undefined) { r2.eyeMat.color.setHex(r2.eyeWas); r2.eyeWas = undefined; }
    r2.dome.rotation.z = 0;
    if ((r2.state === 'play' || r2.state === 'petted') && r2.baseY !== undefined) r2.pos.y = r2.baseY;
  }
  function r2Fun(kind) {
    endR2Fun();
    r2.route = []; r2.pending = null; r2.epoch++;
    r2.cup.visible = false; r2.speed = r2.base;
    Object.assign(r2, { state: kind === 'pet' ? 'petted' : 'play', timer: kind === 'pet' ? 2.6 : 3.6, funT: 0, baseY: r2.pos.y, eyeWas: r2.eyeWas ?? r2.eyeMat.color.getHex() });
    r2.bub.say(kind === 'pet' ? '<3' : 'dance!', now);
    sfx.word(kind === 'pet' ? 'yay' : pick(['yay', 'behbod']), r2.pos);
    if (kind === 'pet') love(r2.pos.clone().add(new THREE.Vector3(0, 0.45, 0)));
  }
  function tickR2Fun(dt, ctx) {
    r2.funT += dt;
    if (r2.state === 'petted') {
      faceTo(r2, ctx.player, dt);
      r2.eyeMat.color.set('#ff5a9a');
      r2.dome.rotation.z = Math.sin(r2.funT * 3) * 0.18;
    } else {
      // Two hops, a spin, and its lights running through the colours.
      if (r2.funT > 1.2 && r2.funT < 2.4) r2.facing += dt * 5.2; else faceTo(r2, ctx.player, dt);
      r2.pos.y = r2.baseY + (r2.funT < 1.2 || r2.funT > 2.6 ? Math.abs(Math.sin(r2.funT * 5.2)) * 0.07 : 0);
      r2.eyeMat.color.setHSL((r2.funT * 0.8) % 1, 0.9, 0.6);
    }
    if ((r2.timer -= dt) > 0) return;
    endR2Fun();
    if (r2.state === 'play') { love(r2.pos.clone().add(new THREE.Vector3(0, 0.45, 0))); r2.bub.say('again?', now); }
    r2.state = 'pause'; r2.timer = 1.5;
  }
  function tickR2(dt, ctx) {
    r2.chaseCool -= dt;
    const look = r2.moving ? 0 : r2.state === 'talk' ? null : Math.sin(now * (r2.state === 'dock' ? 0.4 : 1.3)) * 0.9;
    if (look !== null) r2.dome.rotation.y += (look - r2.dome.rotation.y) * Math.min(1, dt * 3);
    r2.body.rotation.x += ((r2.moving ? 0.07 : 0) - r2.body.rotation.x) * Math.min(1, dt * 5);
    // Wheels roll with the ground covered; the body bobs a little on its legs; the LED eyes blink.
    if (r2.moving) for (const w of r2.wheels) w.rotation.x += dt * r2.speed / 0.045;
    r2.dome.position.y = 0.17 + (r2.moving ? Math.abs(Math.sin(now * 11)) * 0.006 : Math.sin(now * 2) * 0.002);
    r2.eye.scale.y = (now % 3.1) < 0.12 ? 0.15 : 1;
    // In goal for penalties: square to the spot, sliding and hopping across the goal mouth to where it guessed.
    if (r2.state === 'keeper' && r2.keep) {
      const k = r2.keep;
      faceTo(r2, k.face, dt);
      r2.pos.x = k.at.x;
      r2.pos.z += (k.at.z - k.dy - r2.pos.z) * Math.min(1, dt * (k.dive ? 12 : 4));
      k.dive = Math.max(0, k.dive - dt);
      r2.pos.y = k.at.y + Math.sin(Math.PI * Math.min(1, k.dive ? (0.45 - k.dive) / 0.45 : 1)) * k.hop;
      r2.body.rotation.z += ((k.dive ? Math.sign(k.dy) * 0.45 : 0) - r2.body.rotation.z) * Math.min(1, dt * 10);
      return;
    }
    if (r2.state === 'dock' && !r2.moving) turn(r2, 1, 0, dt, 3);
    if (r2.state === 'dock' && (r2.timer -= dt) < 0) { r2.stops = 2 + Math.floor(rnd(0, 3)); r2Next(); }
    else if (r2.state === 'pause' && (r2.timer -= dt) < 0) r2Next();
    else if (r2.state === 'petted' || r2.state === 'play') tickR2Fun(dt, ctx);
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
  let deskT = 0, keysTip = false, deskRoll = null, lastKeys = -1e9;
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
  // The feather wand: a stick in my hand, a cord, and a feather she stalks, pounces on and bats at.
  const wandLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#d8c6a4' }));
  const feather = mesh([piece(sph(0.02, 8, 6), '#ff7aa8', [0, 0, 0], [0, 0, 0], [0.6, 0.6, 2.2]), piece(sph(0.016, 8, 6), '#3ee6c4', [0.012, 0.006, -0.02], [0.4, 0, 0], [0.6, 0.6, 2])], PAINT);
  const treat = mesh([piece(sph(0.014, 8, 6), '#8a5a2c', [0, 0, 0], [0, 0, 0], [1.3, 0.7, 1])], PAINT);
  wandLine.frustumCulled = false;
  wandLine.visible = feather.visible = treat.visible = false;
  scene.add(wandLine, feather, treat);
  const PLAY_T = 4.5, TREAT_T = 3.4;
  const stopPishi = () => { pishi.route = []; pishi.pending = null; pishi.epoch++; };
  // Each new thing she does starts clean: no wand or treat left out, no pose held over from the last one.
  function freshPishi() {
    wandLine.visible = feather.visible = treat.visible = false;
    for (const k of POSES) pishi.want[k] = 0;
    pishi.blinkOff = pishi.leanOff = pishi.groomUntil = 0;
  }
  function pishiPlay(ctx) {
    stopPishi(); freshPishi();
    Object.assign(pishi, { state: 'play', timer: PLAY_T, pounced: false });
    faceTo(pishi, ctx.player, 1);
    wandLine.visible = feather.visible = true;
    pishi.bub.say('!', now);
  }
  function tickPishiPlay(dt, ctx) {
    const t = PLAY_T - pishi.timer, toMe = ctx.player.clone().sub(pishi.pos).setY(0).normalize();
    const at = pishi.pos.clone().addScaledVector(toMe, pishi.pounced ? 0.12 : 0.3).setY(pishi.pos.y + 0.06 + Math.abs(Math.sin(now * 6)) * 0.12);
    feather.position.copy(at); feather.rotation.y = now * 3;
    const hand = ctx.player.clone().addScaledVector(toMe, -0.25).setY(ctx.player.y + 0.95), tip = hand.clone().lerp(at, 0.55).setY(hand.y + 0.12);
    const pa = wandLine.geometry.attributes.position;
    pa.setXYZ(0, hand.x, hand.y, hand.z); pa.setXYZ(1, tip.x, tip.y, tip.z); pa.setXYZ(2, at.x, at.y, at.z); pa.needsUpdate = true;
    faceTo(pishi, at, dt);
    // Crouched low and watching, then the pounce, then batting at it with a paw.
    pishi.want.bow = t < 1.3 ? 1 : 0;
    if (t > 1.3 && !pishi.pounced && !pishi.hop) { pishi.pounced = true; hop(pishi, pishi.pos.clone().addScaledVector(toMe, 0.18), null, 0.3, 0.15); pishi.bub.say('mrrp!', now); }
    pishi.want.paw = t > 1.8 && t < 3.9 ? 1 : 0;
    if ((pishi.timer -= dt) > 0) return;
    wandLine.visible = feather.visible = false;
    pishi.want.paw = pishi.want.bow = 0;
    pishi.state = 'sit'; pishi.timer = 3;
    love(pishi.pos.clone().add(new THREE.Vector3(0, 0.4, 0)));
    onEvent('pishi');
  }
  function pishiTreat(ctx) {
    stopPishi(); freshPishi();
    Object.assign(pishi, { state: 'treat', timer: TREAT_T });
    faceTo(pishi, ctx.player, 1);
    const toMe = ctx.player.clone().sub(pishi.pos).setY(0).normalize();
    treat.position.copy(pishi.pos).addScaledVector(toMe, 0.16).setY(pishi.pos.y + 0.012);
    treat.visible = true;
    pishi.bub.say('?', now);
  }
  function tickPishiTreat(dt) {
    const t = TREAT_T - pishi.timer;
    // A sniff, then head down to eat it, then a happy meow and a slow blink.
    pishi.want.bow = t > 0.6 && t < 2.6 ? 0.55 : 0;
    if (t > 2.3) treat.visible = false;
    if ((pishi.timer -= dt) > 0) return;
    pishi.state = 'sit'; pishi.timer = 4;
    pishi.want.blink = 0.85; pishi.blinkOff = now + 1.6;
    love(pishi.pos.clone().add(new THREE.Vector3(0, 0.4, 0)));
    pishi.bub.say('mrow!', now); blip(sfx.meow, pishi);
  }
  function pishiShoo() {
    if (pishi.state !== 'keys') return false;
    pishi.bub.say('mrrow', now); blip(sfx.meow, pishi);
    pishiDown([b2t(...deskFloor())], () => { pishi.onFloor = true; pishi.pos.y = groundAt(pishi.pos.x, pishi.pos.z, pishi.pos.y + 0.1); pishiNext(); });
    return true;
  }
  function tickPishi(dt, ctx) {
    const st = pishi.state;
    deskT = ctx.mode === 'desk' ? deskT + dt : 0;
    // Sit at the desk a while and, now and then, she comes to walk on the keyboard: about one sitting in four, and not
    // again for a few minutes after.
    const kb = keyboard();
    if (!deskT) deskRoll = null;
    else if (kb && deskT > 4 && deskRoll === null) deskRoll = Math.random() < 0.25 && now - lastKeys > 240;
    if (kb && deskRoll && ['window', 'sit', 'wander'].includes(st) && !pishi.hop) {
      deskRoll = false; lastKeys = now;
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
    if (pishi.blinkOff && now > pishi.blinkOff) { pishi.want.blink = 0; pishi.blinkOff = 0; }
    if (st === 'perch') {
      if ((pishi.zz = (pishi.zz || 0) - dt) < 0) { pishi.zz = 7; pishi.bub.say('z z z', now, 2.5, true); }
      if ((pishi.timer -= dt) < 0) pishiDown([...walkUp].reverse().slice(1).concat(b2t(...treeFloor)), () => { pishi.onFloor = true; pishiNext(); });
    }
    if (st === 'petted' && (pishi.timer -= dt) < 0) { pishi.state = 'sit'; pishi.timer = 3; pishi.want.roll = 0; pishi.want.lean = 0; }
    if (pishi.leanOff && now > pishi.leanOff) { pishi.want.lean = 0; pishi.leanOff = 0; }
    if (st === 'sit' && !pishi.groomUntil && Math.random() < dt * 0.12) pishi.groomUntil = now + rnd(2.5, 4);
    if (pishi.groomUntil && (now > pishi.groomUntil || st !== 'sit')) pishi.groomUntil = 0;
    pishi.want.groom = pishi.groomUntil ? 1 : 0;
    if (st === 'play') tickPishiPlay(dt, ctx);
    if (st === 'treat') tickPishiTreat(dt);
    if (st === 'treesit' && (pishi.timer -= dt) < 0) pishiDown([climbUp[0], b2t(...treeFloor)], () => { pishi.onFloor = true; pishiNext(); });
    // She runs up the cat tree when Jessi comes too close.
    if (pishi.onFloor && !pishi.hop && jessi.onFloor && !['flee', 'keys', 'todesk', 'play', 'treat'].includes(pishi.state) && pishi.pos.distanceTo(jessi.pos) < 0.9) {
      pishi.state = 'flee'; pishi.speed = 2.2;
      pishi.bub.say('hss!', now); blip(sfx.hiss, pishi, ctx.player);
      goTo(pishi, treeFloor, ok => {
        pishi.speed = pishi.base;
        if (ok) hops(pishi, climbUp.slice(0, 2), () => { pishi.state = 'treesit'; pishi.timer = 15; }); else pishiNext();
      });
    }
    const sit = ['window', 'sit', 'keys', 'treesit', 'petted', 'treat'].includes(pishi.state) && !pishi.hop && !pishi.moving;
    pishi.sitK += ((sit ? 1 : 0) - pishi.sitK) * Math.min(1, dt * 4);
    pishi.sleepK += ((pishi.state === 'perch' ? 1 : 0) - pishi.sleepK) * Math.min(1, dt * 2);
  }

  // ---------- Jessi ----------
  const jessi = agent(buildJessi(), 0.85, 0.52, 0.2);
  const bed = b2t(...P.jessi_bed), bedFloor = [13.6, 13.5, 0];
  place(jessi, bed); jessi.state = 'nap'; jessi.timer = rnd(25, 50); jessi.onFloor = false;
  const ball = new THREE.Mesh(sph(0.032, 14, 10), new THREE.MeshStandardMaterial({ color: '#cde23c', roughness: 0.8 }));
  ball.visible = false; scene.add(ball);
  let flight = null, ballGone = 0, roll = null;
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
  // Fetch: the ball arcs out, bounces twice and rolls to a stop; Jessi chases it to wherever it really ends up,
  // pounces on it, trots back, drops it at my feet and bows for another go.
  function throwBall(ctx) {
    const dir = new THREE.Vector3(Math.sin(ctx.facing), 0, Math.cos(ctx.facing));
    const from = tb(ctx.player);
    let land = null;
    for (const d of [3.8, 3.0, 2.2, 1.5]) {
      const to = ctx.player.clone().addScaledVector(dir, d);
      if (clear(from, tb(to))) { land = to; land.y = groundAt(to.x, to.z, ctx.player.y + 0.1); break; }
    }
    if (!land) { toast('No room to throw here.'); return false; }
    flight = { a: ctx.player.clone().add(new THREE.Vector3(0, 1.1, 0)), b: land, k: 0, dir };
    ball.visible = true; roll = null; ballGone = 0;
    jessi.route = []; jessi.pending = null; jessi.epoch++;
    Object.assign(jessi, { state: 'fetch', speed: 2.6, got: false, repath: 0.25, fetchT: 0 });
    for (const k of POSES) jessi.want[k] = 0;
    jessi.bub.say('!', now); blip(sfx.bark, jessi);
    return true;
  }
  function stepBall(dt) {
    if (flight) {
      flight.k = Math.min(1, flight.k + dt / 0.8);
      ball.position.lerpVectors(flight.a, flight.b, flight.k); ball.position.y += Math.sin(Math.PI * flight.k) * 0.9 + 0.03;
      if (flight.k >= 1) { roll = { v: flight.dir.clone().multiplyScalar(2.0), vy: 1.4, bounces: 2 }; flight = null; }
      return;
    }
    if (!roll) return;
    const next = ball.position.clone().addScaledVector(roll.v, dt);
    // A wall, a step or the edge of the floor sends it back a little.
    if (roll.v.lengthSq() > 1e-6 && !clear(tb(ball.position), tb(next))) roll.v.multiplyScalar(-0.3);
    else { ball.position.x = next.x; ball.position.z = next.z; }
    const ground = groundAt(ball.position.x, ball.position.z, ball.position.y + 0.2) + 0.032;
    roll.vy -= 9.8 * dt;
    ball.position.y += roll.vy * dt;
    if (ball.position.y <= ground) {
      ball.position.y = ground;
      if (roll.bounces-- > 0 && Math.abs(roll.vy) > 0.4) { roll.vy = -roll.vy * 0.45; roll.v.multiplyScalar(0.7); }
      else { roll.vy = 0; roll.v.multiplyScalar(Math.max(0, 1 - 2.2 * dt)); }
    }
    ball.rotation.x += (roll.v.length() * dt) / 0.032;
    if (roll.v.length() < 0.04 && roll.vy === 0) roll.v.set(0, 0, 0);
  }
  function tickFetch(dt) {
    if (jessi.got) return;
    // If it ended up somewhere she cannot get to, she gives up after a while.
    if ((jessi.fetchT += dt) > 12) { jessi.state = 'sniff'; jessi.timer = 2; jessi.speed = jessi.base; ballGone = now + 1; return; }
    if ((jessi.repath -= dt) < 0 && !jessi.hop) { jessi.repath = 0.35; goTo(jessi, tb(ball.position), null); }
    const d = Math.hypot(ball.position.x - jessi.pos.x, ball.position.z - jessi.pos.z);
    if (d > 0.5 || flight || (roll && roll.v.length() > 0.9) || jessi.hop) return;
    // The pounce: a little hop onto it, and it is in her mouth.
    jessi.got = true;
    hop(jessi, ball.position.clone().setY(jessi.pos.y), () => {
      roll = null; jessi.carry = true; jessi.speed = 1.6;
      jessi.bub.say('got it!', now);
      const toMe = () => tb(lastPlayer.clone().add(jessi.pos.clone().sub(lastPlayer).setY(0).normalize().multiplyScalar(0.7)));
      wait(jessi, 0.35, () => goTo(jessi, toMe(), ok => {
        jessi.carry = false; jessi.speed = jessi.base;
        faceTo(jessi, lastPlayer, 1);
        // Dropped at my feet, where it rolls a little toward me.
        ball.position.copy(jessi.pos).add(new THREE.Vector3(Math.sin(jessi.facing) * 0.22, 0.032, Math.cos(jessi.facing) * 0.22));
        roll = { v: lastPlayer.clone().sub(ball.position).setY(0).normalize().multiplyScalar(0.25), vy: 0, bounces: 0 };
        jessi.state = 'happy'; jessi.timer = 3; jessi.want.bow = 1;
        love(jessi.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
        jessi.bub.say('woof!', now); blip(sfx.bark, jessi);
        if (ok) { toast('Good girl. Jessi gets a treat.'); onEvent('jessi'); }
        ballGone = now + 3;
      }));
    }, 0.3, 0.12);
  }
  // Petting: she sits, leans into my hand with her eyes half closed, and sometimes rolls over for a belly rub.
  function jessiPet(ctx) {
    jessi.route = []; jessi.pending = null; jessi.epoch++;
    for (const k of POSES) jessi.want[k] = 0;
    jessi.state = 'petted'; jessi.timer = 3.2;
    faceTo(jessi, ctx.player, 1);
    const belly = Math.random() < 0.3;
    Object.assign(jessi.want, { lean: belly ? 0 : 1, blink: 0.65, roll: belly ? 1 : 0 });
    love(jessi.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    jessi.bub.say(belly ? 'belly rubs!' : 'happy sigh', now);
  }
  // Her tricks, in turn: a spin, a high five, sitting up to beg, rolling over, and playing dead.
  const TRICKS = [['spin', 'spin!'], ['paw', 'high five!'], ['beg', 'pretty please'], ['roll', 'roll over!'], ['dead', 'bang!']];
  let trickAt = 0;
  function jessiTrick(ctx) {
    const [name, line] = TRICKS[trickAt++ % TRICKS.length];
    jessi.route = []; jessi.pending = null; jessi.epoch++;
    for (const k of POSES) jessi.want[k] = 0;
    Object.assign(jessi, { state: 'trick', trick: name, timer: name === 'dead' ? 3.2 : 2.4 });
    faceTo(jessi, ctx.player, 1);
    jessi.bub.say(line, now); blip(sfx.bark, jessi);
    Object.assign(jessi.want, { paw: name === 'paw' ? 1 : 0, beg: name === 'beg' ? 1 : 0, roll: name === 'dead' ? 1 : 0, blink: name === 'dead' ? 1 : 0 });
  }
  function tickTrick(dt, ctx) {
    if (jessi.trick === 'spin') jessi.facing += dt * 7;
    // Over on her side and back up again, twice.
    if (jessi.trick === 'roll') jessi.want.roll = jessi.timer % 1.2 < 0.6 ? 1 : 0;
    if ((jessi.timer -= dt) > 0) return;
    for (const k of POSES) jessi.want[k] = 0;
    jessi.state = 'happy'; jessi.timer = 1.8;
    faceTo(jessi, ctx.player, 1);
    love(jessi.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    jessi.bub.say('woof!', now); blip(sfx.bark, jessi);
  }
  function tickJessi(dt, ctx) {
    if (jessi.carry) ball.position.copy(jessi.head.getWorldPosition(V)).add(new THREE.Vector3(Math.sin(jessi.facing) * 0.11, -0.05, Math.cos(jessi.facing) * 0.11));
    else stepBall(dt);
    if (ballGone && now > ballGone && jessi.state !== 'fetch') { ball.visible = false; ballGone = 0; roll = null; }
    const st = jessi.state;
    if (st === 'nap') {
      if ((jessi.zz = (jessi.zz || 0) - dt) < 0) { jessi.zz = 6; jessi.bub.say('z z z', now, 2.5, true); }
      if ((jessi.timer -= dt) < 0) jessiWake(() => jessiNext(ctx));
    }
    if (st === 'sniff' && (jessi.timer -= dt) < 0) jessiNext(ctx);
    if (st === 'happy' && (jessi.timer -= dt) < 0) { jessi.state = 'follow'; jessi.timer = rnd(10, 18); jessi.repath = 0; jessi.want.bow = 0; }
    if (st === 'petted' && (jessi.timer -= dt) < 0) { jessi.state = 'follow'; jessi.timer = rnd(8, 14); jessi.repath = 0; Object.assign(jessi.want, { lean: 0, roll: 0, blink: 0 }); }
    if (st === 'trick') tickTrick(dt, ctx);
    if (st === 'fetch') tickFetch(dt);
    if (st === 'follow') {
      const d = jessi.pos.distanceTo(ctx.player);
      if ((jessi.timer -= dt) < 0) jessiNext(ctx);
      else if (inLoft(ctx.player) && d > 1.7 && (jessi.repath -= dt) < 0) {
        jessi.repath = 1.2;
        const behind = ctx.player.clone().sub(jessi.pos).setY(0).normalize().multiplyScalar(-1.1).add(ctx.player);
        goTo(jessi, tb(behind), null);
      } else if (d < 1.4 && !jessi.moving) faceTo(jessi, ctx.player, dt);
    }
    const sit = (st === 'happy' || st === 'petted' || (st === 'trick' && jessi.trick !== 'spin') || (st === 'follow' && !jessi.moving)) && !jessi.hop;
    jessi.sitK += ((sit ? 1 : 0) - jessi.sitK) * Math.min(1, dt * 4);
    jessi.sleepK += ((st === 'nap' ? 1 : 0) - jessi.sleepK) * Math.min(1, dt * 2);
    jessi.wag = st === 'happy' || st === 'fetch' || st === 'petted' || st === 'trick' || (st === 'follow' && jessi.pos.distanceTo(ctx.player) < 2) ? 1 : 0.25;
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
    // The extra poses, each eased in and out: a play bow, a raised paw, over on her side, sitting up to beg, washing a
    // paw, leaning into a hand. Eyes blink now and then, close when asleep, and close slowly when she is happy.
    const q = a.pose, w = a.want;
    if (now > (a.blinkAt || 0)) { a.blinkUntil = now + 0.13; a.blinkAt = now + rnd(2.5, 6); }
    const blink = Math.max(a.sleepK > 0.5 ? 1 : 0, now < (a.blinkUntil || 0) ? 1 : 0, w.blink || 0);
    for (const k of POSES) q[k] += ((k === 'blink' ? blink : w[k] || 0) - q[k]) * Math.min(1, dt * (k === 'blink' ? 12 : 5));
    a.legs.forEach((l, i) => {
      if (l.front) l.hip.rotation.x += -q.bow * 0.9 + q.beg * 0.9 - (i === 0 ? q.groom * 1.0 : 0) - (i === 1 ? q.paw * (1.5 + Math.sin(now * 9) * 0.25) : 0);
      else l.hip.rotation.x += q.beg * 0.4;
    });
    a.body.rotation.x += q.bow * 0.35 - q.beg * 0.9;
    a.body.rotation.z = q.roll * 1.6;
    a.body.position.y += -q.bow * size * 0.25 + q.beg * size * 0.3 - q.roll * size * 0.25;
    a.head.rotation.x += q.groom * (0.55 + Math.sin(now * 8) * 0.12) - q.beg * 0.35;
    a.head.rotation.z = q.lean * 0.35;
    if (a.lids) for (const l of a.lids) { l.visible = q.blink > 0.08; l.scale.y = Math.max(0.15, q.blink); }
  }

  return {
    pishi, jessi, bh22: r2, mouse,
    // BH-22 in goal for penalties at the mini goal: it rolls to `at` (three.js), faces `face`, and stays until released.
    // Returns false when it is busy (out with a glass of tea).
    keeper(at, face, onReady) {
      if (r2.state === 'tea') return false;
      endR2Fun();
      r2.speed = r2.base;
      r2.state = 'keeperGo'; r2.route = []; r2.bub.say('my goal!', now);
      const go = () => { r2.state = 'keeper'; r2.keep = { at: at.clone(), face: face.clone(), dy: 0, dive: 0, hop: 0 }; onReady?.(); };
      goTo(r2, tb(at), ok => { if (!ok) { r2.route = [at.clone()]; r2.then = go; } else go(); });
      return true;
    },
    // A dive: `dy` metres across the goal mouth (room y), with a hop of `hop` metres.
    keeperDive(dy, hop) { if (r2.keep) Object.assign(r2.keep, { dy, hop, dive: 0.45 }); },
    keeperReset() { if (r2.keep) Object.assign(r2.keep, { dy: 0, hop: 0, dive: 0 }); },
    keeperRelease() {
      // Drop the walk to the goal too, or arriving after I left would put it back in goal for good.
      r2.keep = null; r2.body.rotation.z = 0;
      r2.route = []; r2.then = null; r2.pending = null; r2.epoch++; r2.speed = r2.base;
      if (r2.state.startsWith('keeper')) { r2.state = 'pause'; r2.timer = 1.5; r2.stops = 2; r2.bub.say('good game', now); }
    },
    // BH-22 and Jessi go through the balcony door, so it opens for them too (the mouse droid would keep it busy).
    positions: [r2.pos, jessi.pos],
    tick(dt, t, ctx) {
      now = t;
      if (purring && now > purring) { fx?.purr(false); purring = 0; }
      lastPlayer.copy(ctx.player);
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
      for (const [a, id] of [[r2, 'bh22'], [pishi, 'pishi'], [jessi, 'jessi']]) {
        if (a.hop || Math.abs(p.y - a.pos.y) > 1.0 || (id === 'jessi' && a.state === 'fetch')) continue;
        if (id === 'bh22' && r2.state.startsWith('keeper')) continue;
        const label = id === 'jessi' && jessi.state === 'nap' ? 'Wake Jessi' : LABELS[id][actionFor(id)];
        const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z);
        if (d <= 1.1 && d < bd) { bd = d; best = items[id]; Object.assign(best, { label, x: a.pos.x, y: a.pos.y, z: a.pos.z }); }
      }
      return best;
    },
    // What pressing E next to one of them does. Returns { crouch } when it is a pet or a treat, so I bend down to them.
    act(id, ctx) {
      const what = actionFor(id);
      if (id === 'bh22') {
        if (r2.pos.distanceTo(ctx.player) > 2.5) { toast('BH-22 is out on patrol somewhere in the house.'); return null; }
        if (r2.state.startsWith('keeper')) return null;
        turnAt.bh22++;
        if (what !== 'talk') { r2Fun(what); return { crouch: what === 'pet' }; }
        // Talking interrupts whatever it was doing, so drop the errand's leftovers too.
        endR2Fun();
        r2.state = 'talk'; r2.timer = 3.5; r2.route = []; r2.pending = null; r2.epoch++;
        r2.cup.visible = false; r2.speed = r2.base;
        r2.bub.say(pick(WORDS), now); sfx.word(tipAt === 0 ? 'hello' : pick(['yay', 'behbod', 'hello']), r2.pos);
        toast('BH-22: ' + TIPS[tipAt++ % TIPS.length]);
        onEvent('bh22');
        return null;
      }
      if (id === 'pishi') {
        if (pishiShoo()) return null;
        if (pishi.onFloor) turnAt.pishi++;
        if (what === 'play') { pishiPlay(ctx); return null; }
        if (what === 'treat') { pishiTreat(ctx); return { crouch: true }; }
        // A pet: she leans into it with a slow blink, and on the floor now and then rolls over for a belly rub. On the
        // window sill she stays put and just enjoys it.
        const belly = pishi.onFloor && Math.random() < 0.3;
        freshPishi();
        if (pishi.state === 'window') pishi.timer = Math.max(pishi.timer, 8);
        else { stopPishi(); pishi.state = 'petted'; pishi.timer = 4; faceTo(pishi, ctx.player, 1); }
        Object.assign(pishi.want, { lean: belly ? 0 : 1, roll: belly ? 1 : 0, blink: 0.8 });
        pishi.blinkOff = pishi.leanOff = now + 3.5;
        love(pishi.pos.clone().add(new THREE.Vector3(0, 0.4, 0))); sfx.purr(pishi.pos); pishi.bub.say(belly ? 'belly?' : 'prrr', now, 2.5, true);
        onEvent('pishi');
        return { crouch: pishi.onFloor };
      }
      if (id === 'jessi') {
        if (jessi.state === 'nap') { jessiWake(() => { jessi.state = 'happy'; jessi.timer = 2; love(jessi.pos.clone().add(new THREE.Vector3(0, 0.5, 0))); }); return null; }
        if (what === 'fetch') { if (throwBall(ctx)) turnAt.jessi++; return null; }
        turnAt.jessi++;
        if (what === 'pet') { jessiPet(ctx); return { crouch: true }; }
        jessiTrick(ctx);
        return null;
      }
      return null;
    },
    // Which resident a click landed on, if any.
    hit(ray) {
      for (const [a, id] of [[pishi, 'pishi'], [jessi, 'jessi'], [r2, 'bh22']]) if (ray.intersectObject(a.root, true).some(h => !h.object.isSprite)) return id;
      return null;
    },
    shoo: () => pishiShoo(),
  };
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lit } from './lit.js';
import { spring, springStep, kick, critical } from '../pure/springs.js';

// The range's robots, made like designer toys: soft white and orange vinyl over dark joints, lit eyes, chunky hands and
// boots. The walker strolls across the hall side on, its core glowing through a porthole on each flank (the weak
// spot), and now and then turns its screen face to look at you. The drone is a round little copter with one big amber
// eye (its weak spot) and four guarded rotors. Each moving part is one mesh per finish, built once and shared by every
// robot in the pool; every robot has its own materials, so it can flash when hit and run hot when hurt on its own.
const PAL = { shell: 0xece7dd, cream: 0xd3ccbf, orange: 0xff6a1c, char: 0x2a2d34, ink: 0x131519, steel: 0x8a919b };
const TEAL = [0.35, 2.4, 2.25], AMBER = [3.3, 1.35, 0.25], HOT = [4.6, 0.4, 0.7], BURN = [4.4, 0.7, 0.18], RED = [3.6, 0.25, 0.15], DEAD = [0.05, 0.035, 0.03];

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
// Places a piece within its part and paints it one colour (the vinyl takes its colour from the vertices).
function put(geo, hex, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  geo.applyMatrix4(M4.compose(P.set(...p), Array.isArray(r) ? Q.setFromEuler(E.set(...r)) : r, S.set(...s)));
  const c = typeof hex === 'number' ? new THREE.Color(hex) : new THREE.Color(...hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function merge(list) {
  const all = list.some(g => !g.index) ? list.map(g => (g.index ? g.toNonIndexed() : g)) : list;
  const out = mergeGeometries(all);
  for (const g of new Set([...list, ...all])) g.dispose();
  return out;
}
// The shapes, at a level of detail: q 1 for most screens, under half on phones and the lowest quality.
function shapes(q) {
  const n = k => Math.max(5, Math.round(k * q)), bev = q < 1 ? 1 : 2;
  return {
    // Thin pieces get one bevel step: their rounding is too small to see.
    rb: (w, h, d, r) => new RoundedBoxGeometry(w, h, d, Math.min(w, h, d) < 0.05 ? 1 : bev, Math.min(r, w / 2.05, h / 2.05, d / 2.05)),
    sph: (r, a = 18, b = 12, t0 = 0, t1 = Math.PI) => new THREE.SphereGeometry(r, n(a), n(b), 0, Math.PI * 2, t0, t1),
    cyl: (r0, r1, h, a = 16) => new THREE.CylinderGeometry(r0, r1, h, n(a)),
    cap: (r, len, a = 12) => new THREE.CapsuleGeometry(r, len, Math.max(2, Math.round(4 * q)), n(a)),
    tor: (R, r, a = 26, b = 8) => new THREE.TorusGeometry(R, r, n(b), n(a)),
    disc: (r, a = 24) => new THREE.CircleGeometry(r, n(a)),
    lathe: (pts, a = 24) => new THREE.LatheGeometry(pts, n(a)),
  };
}

// ---------- the walker ----------
// Model axes: x ahead (the way it walks), y up, z to its left; 1.1 times this size in the hall.
export const WALKER = { scale: 1.1, core: [0, 1.26, 0], coreR: 0.12, head: [0.01, 1.7, 0], headR: 0.17, chest: [0, 1.45, 0] };
function walkerGeo(q) {
  const { rb, sph, cyl, cap, tor, disc, lathe } = shapes(q), { shell, cream, orange, char, ink, steel } = PAL, PI = Math.PI;
  const egg = [];
  for (let i = 0; i <= 16; i++) { const s = -1 + 2 * i / 16; egg.push(new THREE.Vector2(Math.max(1e-4, 0.25 * Math.sqrt(1 - s * s) * (1 + 0.14 * s)), 0.3 * s)); }
  const side = k => [
    put(sph(0.075, 14, 10), char),
    put(sph(0.105, 18, 8, 0, PI / 2), orange, [0, 0.012, 0.012 * k], [0, 0, 0], [1, 0.72, 1]),
    put(cap(0.052, 0.14), shell, [0, -0.15, 0]),
  ];
  const fore = () => [
    put(sph(0.055, 12, 8), char),
    put(cap(0.064, 0.12), shell, [0, -0.13, 0]),
    put(tor(0.062, 0.016, 18, 6), char, [0, -0.225, 0], [PI / 2, 0, 0]),
    put(sph(0.078, 14, 10), cream, [0, -0.31, 0], [0, 0, 0], [0.86, 1.1, 0.78]),
    put(cap(0.024, 0.045, 8), cream, [0.055, -0.285, 0], [0, 0, -0.5]),
  ];
  const slats = [0, 1, 2].map(i => put(rb(0.012, 0.018, 0.17, 0.006), steel, [0.222, 0.06 + i * 0.04, 0]));
  return {
    pelvis: merge([put(rb(0.26, 0.16, 0.3, 0.06), char), put(rb(0.3, 0.05, 0.35, 0.02), orange, [0, 0.07, 0]),
      put(sph(0.07, 12, 8), char, [0, -0.05, 0.12]), put(sph(0.07, 12, 8), char, [0, -0.05, -0.12])]),
    torso: merge([put(lathe(egg, 28), shell, [0, 0, 0], [0, 0, 0], [0.84, 1, 1]), put(tor(0.214, 0.026, 32, 8), orange, [0, -0.12, 0], [PI / 2, 0, 0], [0.84, 1, 1]),
      put(tor(0.088, 0.02, 24, 8), char, [0, 0.02, 0.255]), put(tor(0.088, 0.02, 24, 8), char, [0, 0.02, -0.255]),
      put(rb(0.03, 0.15, 0.2, 0.012), ink, [0.205, 0.1, 0]), ...slats,
      put(rb(0.13, 0.3, 0.3, 0.05), cream, [-0.2, 0.03, 0]), put(rb(0.145, 0.06, 0.31, 0.025), orange, [-0.2, 0.19, 0]),
      put(cyl(0.028, 0.028, 0.08, 10), char, [-0.27, -0.05, 0.08], [0, 0, PI / 2]), put(cyl(0.028, 0.028, 0.08, 10), char, [-0.27, -0.05, -0.08], [0, 0, PI / 2]),
      put(cyl(0.065, 0.075, 0.1, 14), char, [0, 0.33, 0])]),
    core: merge([put(disc(0.072), 0xffffff, [0, 0.02, 0.258]), put(disc(0.072), 0xffffff, [0, 0.02, -0.258], [0, PI, 0])]),
    head: merge([put(rb(0.3, 0.25, 0.33, 0.085), shell), put(rb(0.22, 0.045, 0.335, 0.02), orange, [-0.02, 0.12, 0]),
      put(cyl(0.072, 0.072, 0.04, 20), orange, [-0.01, 0, 0.175], [PI / 2, 0, 0]), put(cyl(0.072, 0.072, 0.04, 20), orange, [-0.01, 0, -0.175], [PI / 2, 0, 0]),
      put(cyl(0.04, 0.04, 0.012, 14), char, [-0.01, 0, 0.199], [PI / 2, 0, 0]), put(cyl(0.04, 0.04, 0.012, 14), char, [-0.01, 0, -0.199], [PI / 2, 0, 0]),
      put(rb(0.1, 0.03, 0.2, 0.012), char, [0.12, -0.125, 0]), put(cyl(0.009, 0.012, 0.16, 8), char, [-0.07, 0.205, 0])]),
    face: put(rb(0.035, 0.175, 0.255, 0.045), 0xffffff, [0.135, 0, 0]),
    eyes: merge([put(rb(0.012, 0.06, 0.045, 0.012), 0xffffff, [0, 0, 0.06]), put(rb(0.012, 0.06, 0.045, 0.012), 0xffffff, [0, 0, -0.06])]),
    lamps: merge([put(tor(0.048, 0.008, 18, 6), 0xffffff, [-0.01, 0, 0.207]), put(tor(0.048, 0.008, 18, 6), 0xffffff, [-0.01, 0, -0.207]), put(sph(0.026, 10, 8), 0xffffff, [-0.07, 0.295, 0])]),
    armL: merge(side(1)), armR: merge(side(-1)), fore: merge(fore()),
    thigh: merge([put(sph(0.08, 14, 10), char), put(cap(0.074, 0.22), char, [0, -0.2, 0]), put(rb(0.05, 0.22, 0.13, 0.02), cream, [0.06, -0.2, 0])]),
    shin: merge([put(sph(0.072, 12, 8), char), put(rb(0.07, 0.1, 0.13, 0.03), orange, [0.065, 0.005, 0]), put(cyl(0.078, 0.1, 0.3, 16), shell, [0, -0.18, 0])]),
    foot: merge([put(rb(0.28, 0.1, 0.17, 0.045), char, [0.045, -0.03, 0]), put(rb(0.1, 0.085, 0.175, 0.04), orange, [0.15, -0.03, 0]), put(rb(0.29, 0.025, 0.18, 0.01), ink, [0.045, -0.072, 0])]),
  };
}

// ---------- the drone ----------
// Model axes: -z is its face (it turns that toward the firing line); 1.4 times this size in the hall.
export const DRONE = { scale: 1.4, eye: [0, -0.01, -0.2], eyeR: 0.09, bodyR: 0.36 };
const ROTORS = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => ({ sx, sz, at: [sx * 0.25, 0.035, sz * 0.215] }));
function droneGeo(q) {
  const { rb, sph, cyl, cap, tor, disc } = shapes(q), { shell, orange, char, ink } = PAL, PI = Math.PI;
  const rotor = ({ sx, sz }) => {
    // The arm runs from the hull out to the rotor, which is built round its own middle.
    const a = new THREE.Vector3(-sx * 0.13, -0.015, -sz * 0.115), len = a.length() + 0.02, dir = a.clone().normalize();
    return merge([put(cap(0.022, len, 8), char, a.clone().multiplyScalar(0.5).toArray(), new THREE.Quaternion().setFromUnitVectors(UP, dir)),
      put(tor(0.11, 0.013, 30, 6), shell, [0, 0, 0], [PI / 2, 0, 0]), put(cyl(0.022, 0.026, 0.05, 10), char, [0, -0.01, 0]),
      put(cyl(0.006, 0.006, 0.05, 6), char, [sx * 0.08, -0.03, sz * 0.08])]);
  };
  return {
    hull: merge([put(sph(0.19, 26, 10, 0, PI / 2), orange, [0, 0, 0], [0, 0, 0], [1, 0.72, 1.06]), put(sph(0.19, 26, 8, PI / 2, PI / 2), char, [0, 0, 0], [0, 0, 0], [1, 0.6, 1.06]),
      put(tor(0.19, 0.02, 34, 8), shell, [0, 0, 0], [PI / 2, 0, 0], [1, 1.06, 1]), put(tor(0.088, 0.024, 26, 8), ink, [0, -0.01, -0.192]),
      put(disc(0.03, 16), ink, [0, -0.01, -0.233], [0, PI, 0]), put(rb(0.025, 0.085, 0.12, 0.012), shell, [0, 0.15, 0.06]),
      put(cap(0.013, 0.2, 8), char, [0.085, -0.16, 0], [PI / 2, 0, 0]), put(cap(0.013, 0.2, 8), char, [-0.085, -0.16, 0], [PI / 2, 0, 0]),
      ...[[0.085, 0.06], [0.085, -0.06], [-0.085, 0.06], [-0.085, -0.06]].map(([x, z]) => put(cyl(0.008, 0.008, 0.07, 6), char, [x, -0.125, z])),
      put(cyl(0.024, 0.02, 0.05, 10), char, [0, 0, 0.205], [PI / 2, 0, 0])]),
    eye: put(sph(0.074, 18, 12), 0xffffff, [0, -0.01, -0.19], [0, 0, 0], [1, 1, 0.55]),
    lamps: merge([...ROTORS.map(({ sx, sz }) => put(sph(0.014, 8, 6), sz < 0 ? TEAL : RED, [sx * 0.362, 0.035, sz * 0.215])), put(sph(0.016, 8, 6), AMBER, [0, 0.2, 0.06])]),
    rotor: Object.fromEntries(ROTORS.map(r => [`${r.sx}${r.sz}`, rotor(r)])),
    blade: merge([put(rb(0.2, 0.006, 0.022, 0.003), char, [0, 0.03, 0]), put(cyl(0.012, 0.012, 0.02, 8), char, [0, 0.028, 0])]),
    blur: put(disc(0.1, 20), 0xffffff, [0, 0.03, 0], [-PI / 2, 0, 0]),
  };
}

// A soft round glow, for the charge gathering in a drone's eye.
let dot = null;
function glowDot() {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (dot = new THREE.CanvasTexture(c));
}

const cache = new Map();
export function makeFoeKit({ low = false } = {}) {
  const q = low ? 0.45 : 1;
  if (!cache.has(q)) cache.set(q, { walker: walkerGeo(q), drone: droneGeo(q) });
  const G = cache.get(q);
  const vinyl = () => lit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.04, emissive: 0x000000 }));
  const gloss = lit(new THREE.MeshStandardMaterial({ color: 0x0c0f13, roughness: 0.14, metalness: 0.3 }));
  const glow = rgb => new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), fog: false });
  const lampsMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const blur = new THREE.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const group = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };

  function walker() {
    const W = G.walker, mat = { vinyl: vinyl(), eyes: glow(TEAL), core: glow(AMBER) };
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    const part = {};
    part.pelvis = group(0, 0.92, 0); part.pelvis.add(mesh(W.pelvis, mat.vinyl));
    part.torso = group(0, 1.24, 0); part.torso.add(mesh(W.torso, mat.vinyl), part.core = mesh(W.core, mat.core));
    part.head = group(0.01, 1.7, 0);
    part.eyes = mesh(W.eyes, mat.eyes, 0.155, 0.012, 0);
    part.head.add(mesh(W.head, mat.vinyl), mesh(W.face, gloss), part.eyes, mesh(W.lamps, mat.eyes));
    const limb = (k, arm) => {
      const top = group(0, arm ? 1.44 : 0.86, k * (arm ? 0.3 : 0.12)), low = group(0, arm ? -0.3 : -0.42, 0);
      top.add(mesh(arm ? (k > 0 ? W.armL : W.armR) : W.thigh, mat.vinyl), low);
      low.add(mesh(arm ? W.fore : W.shin, mat.vinyl));
      if (!arm) { const foot = group(0, -0.36, 0); foot.add(mesh(W.foot, mat.vinyl)); low.add(foot); low.userData.foot = foot; }
      top.userData.low = low;
      return top;
    };
    part.armL = limb(1, true); part.armR = limb(-1, true); part.legL = limb(1, false); part.legR = limb(-1, false);
    const whole = [part.pelvis, part.torso, part.head, part.armL, part.armR, part.legL, part.legR];
    body.add(...whole);
    g.scale.setScalar(WALKER.scale);
    const o = { kind: 'walker', g, body, part, mat, homes: whole.map(p => ({ p, pos: p.position.clone() })),
      flinch: spring(140, 9), nod: spring(170, 10), lean: spring(90, 8), look: spring(40, critical(40)), flash: 0, flare: 0, squint: 0, blink: 2, glance: 3, glancing: 0, smoke: 0, hurt: 0, lastStep: 0, red: 0 };
    o.reset = () => {
      for (const h of o.homes) { body.add(h.p); h.p.position.copy(h.pos); h.p.quaternion.identity(); h.p.scale.setScalar(1); h.p.visible = true; }
      for (const s of [o.flinch, o.nod, o.lean, o.look]) s.x = s.v = 0;
      Object.assign(o, { flash: 0, flare: 0, squint: 0, blink: 1 + Math.random() * 2, glance: 2 + Math.random() * 3, glancing: 0, smoke: 0, hurt: 0, lastStep: 0, red: 0 });
      mat.eyes.color.setRGB(...TEAL); mat.core.color.setRGB(...AMBER); mat.vinyl.emissive.setRGB(0, 0, 0);
      part.eyes.scale.set(1, 1, 1); part.core.scale.setScalar(1);
    };
    return o;
  }

  function drone() {
    const D = G.drone, mat = { vinyl: vinyl(), eye: glow(AMBER) };
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    const core = group();
    const eye = mesh(D.eye, mat.eye);
    core.add(mesh(D.hull, mat.vinyl), eye, mesh(D.lamps, lampsMat));
    const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot(), color: new THREE.Color(...HOT), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    charge.position.set(0, -0.01, -0.25); charge.scale.setScalar(0.001);
    core.add(charge);
    body.add(core);
    const rotors = ROTORS.map(r => {
      const arm = group(...r.at), spin = group();
      arm.add(mesh(D.rotor[`${r.sx}${r.sz}`], mat.vinyl), spin);
      if (!low) spin.add(mesh(D.blade, mat.vinyl));
      spin.add(mesh(D.blur, blur));
      body.add(arm);
      return { arm, spin, home: arm.position.clone() };
    });
    g.scale.setScalar(DRONE.scale);
    const o = { kind: 'drone', g, body, core, eye, charge, rotors, mat, flinch: spring(160, 8), yaw: spring(60, 4), last: new THREE.Vector3(), vx: 0, flash: 0, smoke: 0, hurt: 0, charging: null, fall: null };
    o.reset = () => {
      body.add(core); core.position.set(0, 0, 0); core.quaternion.identity(); core.visible = true;
      for (const r of rotors) { body.add(r.arm); r.arm.position.copy(r.home); r.arm.quaternion.identity(); r.arm.visible = true; }
      for (const s of [o.flinch, o.yaw]) s.x = s.v = 0;
      Object.assign(o, { vx: 0, flash: 0, smoke: 0, hurt: 0, charging: null, fall: null });
      g.quaternion.identity(); body.rotation.set(0, 0, 0);
      mat.eye.color.setRGB(...AMBER); mat.vinyl.emissive.setRGB(0, 0, 0); eye.scale.setScalar(1); charge.scale.setScalar(0.001); charge.visible = false;
    };
    return o;
  }

  return { walker, drone, low, colours: { TEAL, AMBER, HOT, RED, DEAD } };
}

// ---------- moving them ----------
const tmp = new THREE.Vector3();
// A walker at `at` (its place in the room already set on g), `stride` metres along its way. `ctx` carries the frame:
// { dt, t, steps(pos) }.
export function poseWalker(o, at, stride, ctx) {
  const { dt, t } = ctx, P = o.part;
  o.g.rotation.y = at.heading > 0 ? 0 : Math.PI;
  const ph = stride * (2 * Math.PI / 1.3), f = springStep(o.flinch, 0, dt), nod = springStep(o.nod, 0, dt), lean = springStep(o.lean, 0, dt);
  for (const [leg, off] of [[P.legL, 0], [P.legR, Math.PI]]) {
    const sw = Math.sin(ph + off), fold = Math.max(0, Math.cos(ph + off));
    leg.rotation.z = 0.5 * sw;
    leg.userData.low.rotation.z = -(0.12 + 0.85 * fold * fold);
    leg.userData.low.userData.foot.rotation.z = -(leg.rotation.z + leg.userData.low.rotation.z) * 0.8;
  }
  // A footfall each half stride: a soft clank where the boot comes down.
  const step = Math.floor(ph / Math.PI);
  if (step !== o.lastStep) { o.lastStep = step; ctx.steps?.(o.g.position); }
  for (const [arm, off] of [[P.armL, Math.PI], [P.armR, 0]]) { arm.rotation.z = 0.42 * Math.sin(ph + off); arm.userData.low.rotation.z = 0.35 + 0.2 * Math.sin(ph + off); }
  o.body.position.y = 0.022 * Math.cos(ph * 2) - 0.02;
  P.torso.rotation.set(0, 0.07 * Math.sin(ph) + f * 0.5, -0.06 + f * 0.35 + lean * 0.4);
  P.pelvis.rotation.y = -0.09 * Math.sin(ph);
  // Now and then it turns its screen to look at the line, then gets on with its walk.
  o.glance -= dt;
  if (o.glance <= 0 && !o.glancing && o.hurt < 0.75) { o.glancing = 1.3; ctx.spotted?.(o.g.position); }
  if (o.glancing) { o.glancing = Math.max(0, o.glancing - dt); if (!o.glancing) o.glance = 3 + Math.random() * 4; }
  const look = springStep(o.look, o.glancing ? (at.heading > 0 ? 1.2 : -1.2) : 0, dt);
  P.head.rotation.set(0, -0.05 * Math.sin(ph) + look + f * 0.3, nod * 0.5 + 0.03 * Math.sin(ph * 2));
  // The eyes blink, squint when it is hit, and flicker once it is badly hurt.
  o.blink -= dt;
  if (o.blink < -0.12) o.blink = 1.5 + Math.random() * 3;
  o.squint = Math.max(0, o.squint - dt);
  const flick = o.hurt > 0.55 && Math.sin(t * 37 + o.g.id) > 0.8 ? 0.2 : 1;
  P.eyes.scale.y = o.blink < 0 ? 0.12 : o.squint > 0 ? 0.3 : flick;
  o.red = Math.max(0, o.red - dt * 2.5);
  o.mat.eyes.color.setRGB(TEAL[0] + (RED[0] - TEAL[0]) * o.red, TEAL[1] + (RED[1] - TEAL[1]) * o.red, TEAL[2] + (RED[2] - TEAL[2]) * o.red);
  // The core runs hotter and faster as it is hurt; a hit makes it flare.
  o.flare = Math.max(0, o.flare - dt * 3);
  const pulse = 1 + (0.03 + 0.05 * o.hurt) * Math.sin(t * (5 + 9 * o.hurt));
  P.core.scale.setScalar(pulse + o.flare * 0.12);
  const heat = Math.min(1, o.hurt * 0.8 + o.flare);
  o.mat.core.color.setRGB(AMBER[0] + (BURN[0] - AMBER[0]) * heat, AMBER[1] + (BURN[1] - AMBER[1]) * heat, AMBER[2] + (BURN[2] - AMBER[2]) * heat);
  o.flash = Math.max(0, o.flash - dt * 9);
  o.mat.vinyl.emissive.setScalar(0.55 * o.flash * o.flash);
  // Badly hurt, it smokes from the chest.
  if (o.hurt > 0.45) { o.smoke -= dt; if (o.smoke <= 0) { o.smoke = 0.22; ctx.smoke?.(P.torso.getWorldPosition(tmp), 0.6); } }
}

// zone: where it was hit; left: the share of its strength it still has.
export function hurtWalker(o, zone, left) {
  o.hurt = Math.max(o.hurt, 1 - left);
  o.flash = 1;
  if (zone === 'head') { kick(o.nod, -4.5); o.squint = 0.4; o.red = 1; kick(o.flinch, 1.5); }
  else if (zone === 'core') { kick(o.flinch, 4.5); kick(o.lean, 2.5); o.flare = 1; o.squint = 0.25; }
  else if (zone === 'limb') kick(o.flinch, 2.2);
  else { kick(o.flinch, 3.5); kick(o.lean, 1.2); }
}

// A drone at `at` (in the room), `age` seconds after it appeared. ctx: { dt, t, home (where it comes in from), smoke(pos, k) }.
export function poseDrone(o, room, s, age, ctx) {
  const { dt, t } = ctx;
  // It drops in from high at the far end over the first moments, then flies its own pattern.
  const inK = Math.min(1, age / 0.8), e = 1 - Math.pow(1 - inK, 3);
  o.g.position.lerpVectors(ctx.home, room, e);
  const wob = o.hurt > 0.45 ? 0.05 * Math.sin(t * 13 + s.ph) : 0;
  o.g.position.y += Math.sin(t * 5.3 + s.ph) * 0.02 + wob;
  const vx = (o.g.position.x - o.last.x) / Math.max(dt, 1e-3);
  o.vx += (vx - o.vx) * Math.min(1, dt * 6);
  o.last.copy(o.g.position);
  const f = springStep(o.flinch, 0, dt), yaw = springStep(o.yaw, 0, dt);
  o.body.rotation.set(0.06 + f * 0.6 + wob * 3, yaw, THREE.MathUtils.clamp(-o.vx * 0.16, -0.5, 0.5) + f * 0.4 + wob * 2);
  const sputter = o.hurt > 0.45 && Math.sin(t * 23 + s.ph) > 0.6 ? 0.25 : 1;
  for (const r of o.rotors) r.spin.rotation.y += dt * 70 * sputter;
  o.flash = Math.max(0, o.flash - dt * 9);
  o.mat.vinyl.emissive.setScalar(0.55 * o.flash * o.flash);
  // On Hard it gathers a bolt in its eye before it fires: the eye runs hot, pulses faster, and the glow swells.
  const c = o.charging;
  if (c) {
    const k = Math.min(1, Math.max(0, (age - c.from) / c.span));
    o.mat.eye.color.setRGB(AMBER[0] + (HOT[0] - AMBER[0]) * k, AMBER[1] + (HOT[1] - AMBER[1]) * k, AMBER[2] + (HOT[2] - AMBER[2]) * k);
    o.eye.scale.setScalar(1 + 0.18 * k * (0.5 + 0.5 * Math.sin(t * (10 + 30 * k))));
    o.charge.visible = true; o.charge.scale.setScalar(0.04 + 0.26 * k * k);
  }
  if (o.hurt > 0.45) { o.smoke -= dt; if (o.smoke <= 0) { o.smoke = 0.12; ctx.smoke?.(o.g.getWorldPosition(tmp), 0.45); } }
}

export function chargeDrone(o, from, span) { o.charging = { from, span }; }
export function calmDrone(o, fired) {
  o.charging = null;
  o.mat.eye.color.setRGB(...AMBER); o.eye.scale.setScalar(1); o.charge.visible = false; o.charge.scale.setScalar(0.001);
  if (fired) kick(o.flinch, -3);
}
export function hurtDrone(o, zone, left) {
  o.hurt = Math.max(o.hurt, 1 - left);
  o.flash = 1;
  kick(o.flinch, zone === 'eye' ? 6 : 4.5);
  kick(o.yaw, (Math.random() < 0.5 ? -1 : 1) * (zone === 'eye' ? 3 : 2));
}

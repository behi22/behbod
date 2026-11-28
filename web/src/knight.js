import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { b2t } from './engine.js';

const S = 0.27, PLINTH = 1.0, BASE_H = 0.022, CASE = [0.66, 0.7, 0.66], LID = 0.2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);

// Plain triangles with creased normals, so all pieces of one material can merge.
function finish(g, crease = 1.2) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const out = toCreasedNormals(g, crease);
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  return out;
}
const place = (g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => g.applyMatrix4(new THREE.Matrix4().compose(V(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V(...s)));
function between(g, a, b, unit = false) {
  const d = V(...b).sub(V(...a)), k = unit ? d.length() : 1;
  return g.applyMatrix4(new THREE.Matrix4().compose(V(...a), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()), V(1, k, 1)));
}
function limb(a, b, r0, r1, bulge = 0, seg = 12) {
  const len = V(...b).distanceTo(V(...a)), pts = [];
  for (let i = 0; i <= 3; i++) { const t = -Math.PI / 2 + (i / 3) * (Math.PI / 2); pts.push(V2(Math.cos(t) * r0, Math.sin(t) * r0 * 0.8)); }
  for (let i = 1; i < 6; i++) { const t = i / 6; pts.push(V2(r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * t), t * len)); }
  for (let i = 0; i <= 3; i++) { const t = (i / 3) * (Math.PI / 2); pts.push(V2(Math.cos(t) * r1, len + Math.sin(t) * r1 * 0.8)); }
  return between(new THREE.LatheGeometry(pts, seg), a, b);
}
function band(y0, y1, r0, r1, t = 0.008, phiL = Math.PI * 2, seg = 28, mid = 0) {
  const pts = [V2(r0 - t, y0), V2(r0, y0), V2(r1, y1), V2(r1 - t, y1), V2(r0 - t, y0)];
  return new THREE.LatheGeometry(pts, seg, mid - phiL / 2, phiL);
}
const ellipsoid = (r, at, seg = 16) => place(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), at, [0, 0, 0], r);
const cap = (r, thetaL, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * thetaL / Math.PI)), 0, Math.PI * 2, 0, thetaL);
function sculpt(g, f) {
  const p = g.attributes.position, v = V(0, 0, 0);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); f(v); p.setXYZ(i, v.x, v.y, v.z); }
  return g;
}

// One two-sided sheet instead of two meshes: the lining shows from inside.
const LINED = 'vec4 diffuseColor = vec4( diffuse, opacity );';
function lined(m, lining) {
  m.onBeforeCompile = s => {
    s.uniforms.lining = { value: new THREE.Color(lining) };
    s.fragmentShader = s.fragmentShader.replace('uniform vec3 diffuse;', 'uniform vec3 diffuse; uniform vec3 lining;').replace(LINED, 'vec4 diffuseColor = vec4( gl_FrontFacing ? diffuse : lining, opacity );');
  };
  m.customProgramCacheKey = () => 'knight-lined';
  return m;
}
if (!THREE.ShaderChunk.meshphysical_frag.includes(LINED)) console.warn('[loft] three\'s shaders have changed; the knight\'s cape lining will not show');

export function knightMaterials(env) {
  const std = (color, roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: env, envMapIntensity: 1, ...extra });
  const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
  return {
    // Two sided because the shoulder plates and knee cops are open shells.
    lacquer: std(0x0b0c0f, 0.2, 0.15, { envMapIntensity: 1.35, side: THREE.DoubleSide }),
    steel: std(0x80858f, 0.3, 1, { envMapIntensity: 1.1 }),
    dark: std(0x2c2f35, 0.38, 1),
    suit: std(0x17181c, 0.86, 0),
    leather: std(0x141416, 0.5, 0.05),
    grip: std(0x0d0d0e, 0.62, 0),
    cloth: lined(std(0x0c0c0f, 0.8, 0, { envMapIntensity: 0.6, side: THREE.DoubleSide }), 0x52090e),
    visor: std(0x1c0709, 0.04, 0.55, { envMapIntensity: 2.2 }),
    glow: glow(3.2, 0.3, 0.22),
    lights: new THREE.MeshBasicMaterial({ vertexColors: true }),
    core: glow(3.6, 3.0, 2.9),
  };
}

// `tint` colours one piece of the vertex-coloured `lights`, so every lamp on him is one draw.
function bucketer() {
  const b = new Map();
  const add = (mat, g, crease, tint) => {
    const out = finish(g, crease);
    if (tint) { const n = out.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(tint, i * 3); out.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    if (!b.has(mat)) b.set(mat, []);
    b.get(mat).push(out);
  };
  add.build = (group, M) => {
    for (const [name, list] of b) {
      const mesh = new THREE.Mesh(mergeGeometries(list), M[name]);
      mesh.name = 'knight_' + name;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    return group;
  };
  return add;
}

export const HILT = 0.27;
export function buildHilt(M, seg = 28) {
  const add = bucketer(), lathe = pts => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg);
  add('steel', lathe([[0, 0], [0.012, 0], [0.018, 0.006], [0.019, 0.022], [0.0165, 0.03]]), 0.6);
  const ridges = [[0.0165, 0.03]];
  for (let i = 0; i < 9; i++) { const y = 0.035 + i * 0.015; ridges.push([0.0168, y], [0.0178, y + 0.004], [0.0178, y + 0.009], [0.0168, y + 0.013]); }
  ridges.push([0.0165, 0.172]);
  add('grip', lathe(ridges), 0.6);
  add('steel', lathe([[0.0165, 0.172], [0.0195, 0.176], [0.0195, 0.196], [0.016, 0.2], [0.0145, 0.205], [0.0145, 0.226], [0.0175, 0.232], [0.022, 0.258], [0.0205, HILT], [0.012, HILT]]), 0.6);
  add('dark', place(new THREE.BoxGeometry(0.012, 0.03, 0.01), [0, 0.186, 0.019]), 0.5);
  add('glow', place(new THREE.BoxGeometry(0.006, 0.007, 0.004), [0, 0.19, 0.0245]), 0.5);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    add('steel', place(new THREE.BoxGeometry(0.005, 0.018, 0.008), [Math.sin(a) * 0.021, HILT + 0.004, Math.cos(a) * 0.021], [0, a, 0]), 0.5);
  }
  return add;
}

export function bladeGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(1.0, 0.09, 0.05) }, k: { value: 1 } },
    vertexShader: 'varying vec3 vN, vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float k; varying vec3 vN, vV; void main() { float f = abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(color * pow(f, 2.4) * 1.6 * k, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
export function buildBlade(len, r, M, glowMat) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(place(new THREE.CapsuleGeometry(r, len - 2 * r, 6, 12), [0, len / 2, 0]), M.core);
  const halo = new THREE.Mesh(place(new THREE.CapsuleGeometry(r * 3.2, len - 2 * r, 8, 16), [0, len / 2, 0]), glowMat);
  core.name = 'blade_core'; halo.name = 'blade_glow';
  halo.renderOrder = 4;
  g.add(core, halo);
  return g;
}

function chestComputer(add) {
  const y = 1.37, f = 0.173, box = (w, h, d, x, yy, z) => place(new THREE.BoxGeometry(w, h, d), [x, yy, z]);
  const RED = [3.2, 0.28, 0.2], AMBER = [2.6, 1.15, 0.12], GREEN = [0.35, 2.2, 1.0], WHITE = [2.4, 2.3, 2.1], OFF = [0.2, 0.05, 0.04];
  add('steel', box(0.156, 0.104, 0.056, 0, y, f - 0.028), 0.5);
  add('dark', box(0.14, 0.088, 0.004, 0, y, f + 0.002), 0.5);
  for (let i = 0; i < 7; i++) add('lights', box(0.013, 0.011, 0.003, -0.054 + i * 0.018, y + 0.026, f + 0.005), 0.5, i < 4 ? GREEN : i < 5 ? AMBER : OFF);
  [RED, RED, WHITE, AMBER].forEach((c, i) => {
    add('steel', box(0.019, 0.016, 0.004, -0.054 + i * 0.021, y, f + 0.005), 0.5);
    add('lights', box(0.014, 0.011, 0.005, -0.054 + i * 0.021, y, f + 0.007), 0.5, c);
  });
  for (const x of [0.04, 0.057]) {
    add('dark', box(0.012, 0.02, 0.004, x, y + 0.001, f + 0.005), 0.5);
    add('steel', between(new THREE.CylinderGeometry(0.0026, 0.0032, 1, 6).translate(0, 0.5, 0), [x, y - 0.002, f + 0.006], [x, y + 0.01, f + 0.02], true), 0.6);
  }
  add('lights', box(0.07, 0.0065, 0.003, -0.026, y - 0.027, f + 0.005), 0.5, RED);
  add('steel', place(new THREE.CylinderGeometry(0.011, 0.012, 0.007, 12), [0.048, y - 0.026, f + 0.005], [Math.PI / 2, 0, 0]), 0.6);
  add('lights', place(new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 8), [0.048, y - 0.026, f + 0.01], [Math.PI / 2, 0, 0]), 0.6, RED);
}

function buildBody(M) {
  const add = bucketer();
  for (const s of [-1, 1]) {
    const x = s * 0.125;
    add('leather', sculpt(ellipsoid([0.062, 0.052, 0.14], [x, 0.052, 0.05]), v => { v.y = Math.max(v.y, 0.012); }), 1.3);
    add('dark', place(new THREE.BoxGeometry(0.118, 0.018, 0.28), [x, 0.009, 0.045]), 0.6);
    add('lacquer', sculpt(ellipsoid([0.066, 0.047, 0.074], [x, 0.062, 0.135]), v => { v.y = Math.max(v.y, 0.03); }), 1.1);
    add('leather', limb([x, 0.05, 0], [x, 0.35, 0.005], 0.07, 0.066), 1.2);
    add('lacquer', place(band(0.3, 0.37, 0.075, 0.083, 0.008, Math.PI * 2, 24), [x, 0, 0.005]), 0.7);
    add('suit', limb([x, 0.3, 0.005], [x * 0.98, 0.6, 0.01], 0.063, 0.072, 0.007), 1.2);
    add('lacquer', place(band(0.0, 0.25, 0.083, 0.078, 0.008, 3.4, 24), [x, 0.34, 0.012]), 0.7);
    add('steel', place(new THREE.TorusGeometry(0.077, 0.005, 6, 32, 3.4), [x, 0.59, 0.012], [Math.PI / 2, 0, Math.PI / 2 - 1.7]), 0.8);
    add('lacquer', place(cap(0.078, 1.15, 14), [x, 0.61, 0.048], [1.35, 0, 0], [1, 1, 0.85]), 0.9);
    add('steel', place(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 10), [x, 0.62, 0.112], [1.35, 0, 0]), 0.6);
    add('suit', limb([x * 0.98, 0.58, 0.01], [s * 0.105, 0.98, 0.0], 0.078, 0.104, 0.014), 1.2);
    add('lacquer', place(band(0.0, 0.2, 0.11, 0.106, 0.008, 2.4, 18), [s * 0.11, 0.74, 0.008]), 0.7);
    for (let i = 0; i < 3; i++) {
      const y0 = 1.03 - i * 0.07, r0 = 0.172 + i * 0.012;
      add('lacquer', place(band(y0 - 0.13, y0, r0 + 0.035, r0, 0.007, 0.95, 14, s * 1.15), [0, 0, 0], [0, 0, 0], [1, 1, 0.8]), 0.7);
      add('steel', place(band(y0 - 0.136, y0 - 0.126, r0 + 0.04, r0 + 0.037, 0.006, 0.95, 14, s * 1.15), [0, 0, 0], [0, 0, 0], [1, 1, 0.8]), 0.7);
    }
  }
  add('suit', ellipsoid([0.17, 0.1, 0.118], [0, 0.97, 0]), 1.2);
  add('leather', place(band(1.0, 1.08, 0.166, 0.169, 0.012, Math.PI * 2, 32), [0, 0, 0], [0, 0, 0], [1, 1, 0.76]), 0.7);
  add('steel', place(new THREE.LatheGeometry([V2(0, 0), V2(0.032, 0), V2(0.036, 0.004), V2(0.036, 0.01), V2(0.03, 0.014), V2(0, 0.014)], 16), [0, 1.04, 0.122], [Math.PI / 2, 0, 0]), 0.6);
  add('dark', place(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 12), [0, 1.04, 0.137], [Math.PI / 2, 0, 0]), 0.6);
  add('suit', place(new THREE.LatheGeometry([V2(0, 1.0), V2(0.15, 1.03), V2(0.142, 1.16), V2(0.155, 1.28), V2(0, 1.3)], 24), [0, 0, 0], [0, 0, 0], [1, 1, 0.74]), 1.2);
  for (let i = 0; i < 3; i++) add('lacquer', place(band(1.085 + i * 0.058, 1.135 + i * 0.058, 0.152 + i * 0.004, 0.156 + i * 0.006, 0.01, 3.4, 24), [0, 0, 0], [0, 0, 0], [1, 1, 0.78]), 0.6);
  add('lacquer', place(new THREE.LatheGeometry([V2(0.155, 1.25), V2(0.172, 1.27), V2(0.215, 1.36), V2(0.226, 1.42), V2(0.205, 1.49), V2(0.135, 1.535), V2(0.07, 1.555), V2(0, 1.56)], 40), [0, 0, 0], [0, 0, 0], [1, 1, 0.66]), 0.75);
  add('steel', place(band(1.245, 1.262, 0.162, 0.164, 0.012, Math.PI * 2, 36), [0, 0, 0], [0, 0, 0], [1, 1, 0.68]), 0.7);
  chestComputer(add);
  add('lacquer', place(band(1.5, 1.6, 0.125, 0.085, 0.01, Math.PI * 2, 28), [0, 0, 0], [0, 0, 0], [1, 1, 0.86]), 0.8);
  add('steel', place(band(1.5, 1.512, 0.127, 0.125, 0.008, Math.PI * 2, 28), [0, 0, 0], [0, 0, 0], [1, 1, 0.86]), 0.7);
  for (const s of [-1, 1]) {
    add('steel', between(new THREE.LatheGeometry([V2(0, 0), V2(0.026, 0), V2(0.03, 0.005), V2(0.024, 0.012), V2(0, 0.013)], 14), [s * 0.165, 1.5, 0.066], [s * 0.665, 2.05, 0.716]), 0.6);
  }
  const collar = new THREE.LatheGeometry([V2(0.17, 1.5), V2(0.168, 1.57), V2(0.185, 1.64), V2(0.205, 1.69)], 22, Math.PI - 1.9, 3.8);
  add('cloth', place(collar, [0, 0, -0.03], [0, 0, 0], [1, 1, 0.82]), 1.3);
  const ARMS = {
    [-1]: { sh: [-0.25, 1.46, 0], el: [-0.32, 1.21, 0.0], wr: [-0.25, 1.125, 0.19], hand: [-0.228, 1.11, 0.222], thumb: [[0.03, 0.012, -0.01], [0.012, 0.03, 0.022]], back: [-0.9, 0, 0.42] },
    [1]: { sh: [0.25, 1.46, 0], el: [0.305, 1.205, 0.035], wr: [0.29, 0.99, 0.085], hand: [0.285, 0.955, 0.095], thumb: [[-0.03, 0.01, 0.01], [-0.022, -0.018, 0.032]], back: [1, 0, 0.1] },
  };
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      add('lacquer', place(cap(0.13 - i * 0.013, 1.2, 18), [s * (0.25 + i * 0.024), 1.48 - i * 0.052, 0], [0, 0, -s * (0.42 + i * 0.2)], [1, 0.72, 1.06]), 0.9);
    }
    const A = ARMS[s];
    add('suit', limb(A.sh, A.el, 0.066, 0.055, 0.012), 1.2);
    add('suit', limb(A.el, A.wr, 0.055, 0.042, 0.008), 1.2);
    const ua = V(...A.el).sub(V(...A.sh)).length();
    add('lacquer', between(band(ua * 0.32, ua * 0.78, 0.07, 0.064, 0.007, Math.PI * 2, 18), A.sh, A.el), 0.7);
    add('lacquer', place(cap(0.056, 1.3, 12), A.el, [0, 0, 0], [1, 0.8, 1]), 0.9);
    const len = V(...A.wr).sub(V(...A.el)).length();
    add('lacquer', between(band(len * 0.12, len * 0.86, 0.064, 0.052, 0.007, Math.PI * 2, 18), A.el, A.wr), 0.7);
    add('steel', between(band(len * 0.84, len * 0.88, 0.056, 0.055, 0.006, Math.PI * 2, 18), A.el, A.wr), 0.7);
    add('leather', ellipsoid([0.046, 0.042, 0.05], A.hand), 1.2);
    const [t0, t1] = A.thumb.map(d => A.hand.map((h, k) => h + d[k]));
    add('leather', limb(t0, t1, 0.013, 0.012), 1.2);
    const n = V(...A.back).normalize();
    add('lacquer', place(new THREE.BoxGeometry(0.05, 0.05, 0.012), [A.hand[0] + n.x * 0.046, A.hand[1], A.hand[2] + n.z * 0.046], [0, Math.atan2(n.x, n.z), 0]), 0.5);
  }
  const nu = 32, nv = 24, pos = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, A = 3.35 - 0.6 * v, R = 0.215 + 0.25 * Math.pow(v, 0.85), y = Math.max(0.012, 1.53 - v * 1.56);
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, th = Math.PI + (u - 0.5) * A;
      const fold = (0.007 + 0.045 * v) * Math.sin(u * Math.PI * 11 + v * 2.2) + 0.014 * v * Math.sin(u * Math.PI * 4 - 1);
      const r = R + fold, pool = Math.max(0, 1.53 - v * 1.56 - 0.012) <= 0 ? (v * 1.56 - 1.518) * 0.9 : 0;
      pos.push(Math.sin(th) * r + 0.04 * v * v, y, Math.cos(th) * r * 0.78 - 0.035 - 0.17 * Math.pow(v, 1.6) - pool);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const cape = new THREE.BufferGeometry();
  cape.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cape.setIndex(idx);
  add('cloth', cape, 1.4);
  return add;
}

// The visor dips to the middle, so the brow above it scowls.
const visorLat = a => 0.07 + 0.2 * Math.abs(a);
// Shared with every plate on the helm, so they all sit on its surface.
function helmAt(v, out = 0) {
  const a = Math.atan2(v.x, v.z), l = Math.asin(THREE.MathUtils.clamp(v.y, -1, 1));
  const low = Math.max(0, -v.y), front = Math.max(0, v.z), face = front * Math.max(0, 1 - Math.abs(a) / 1.3);
  let x = v.x * (0.112 + out), y = v.y * (0.13 + out) * (1 - 0.1 * Math.max(0, v.y) ** 2), z = v.z * (0.128 + out);
  z -= 0.03 * face * Math.abs(v.x);
  z += 0.055 * front * Math.max(0, 1 - Math.abs(a) / 0.75) * Math.min(1, low * 1.8 + 0.1);
  const dv = l - visorLat(a);
  z += face * (0.02 * Math.exp(-(((dv - 0.13) / 0.055) ** 2)) - 0.012 * Math.exp(-((dv / 0.08) ** 2)));
  x *= 1 - 0.2 * low;
  if (v.z < 0) z *= 1.06;
  if (y < -0.1) y = -0.1 + (y + 0.1) * 0.4;
  return v.set(x, y, z);
}
const across = (a0, a1, lat) => (u, t) => { const a = a0 + (a1 - a0) * u, l = lat(a, t); return V(Math.sin(a) * Math.cos(l), Math.sin(l), Math.cos(a) * Math.cos(l)); };
const over = (w, p0, p1) => (u, t) => { const q = (2 * u - 1) * w, p = p0 + (p1 - p0) * t; return V(Math.sin(q), Math.cos(q) * Math.sin(p), Math.cos(q) * Math.cos(p)); };
// A plate lying `out` off the helm, walled down to it so it reads as a thick piece.
function helmPlate(dir, out, nu = 12, nv = 2, wall = true) {
  const pos = [], idx = [];
  const at = (u, t, o) => { const v = helmAt(dir(u, t).normalize(), o); pos.push(v.x, v.y, v.z); return pos.length / 3 - 1; };
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) at(i / nu, j / nv, out);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const p = j * (nu + 1) + i, q = p + 1, r = p + nu + 1, s = r + 1; idx.push(p, q, r, q, s, r); }
  if (wall) {
    const ring = [];
    for (let i = 0; i <= nu; i++) ring.push([i, 0]);
    for (let j = 1; j <= nv; j++) ring.push([nu, j]);
    for (let i = nu - 1; i >= 0; i--) ring.push([i, nv]);
    for (let j = nv - 1; j >= 1; j--) ring.push([0, j]);
    const base = ring.map(([i, j]) => at(i / nu, j / nv, 0)), top = ring.map(([i, j]) => j * (nu + 1) + i);
    for (let k = 0; k < ring.length; k++) { const n = (k + 1) % ring.length; idx.push(base[k], base[n], top[n], base[k], top[n], top[k]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function buildHead(M) {
  const add = bucketer();
  const at = [0, 0.165, 0.015], put = g => place(g, at);
  add('lacquer', put(sculpt(new THREE.SphereGeometry(1, 40, 28), v => helmAt(v))), 0.9);
  add('visor', put(helmPlate(across(-1.05, 1.05, (a, t) => visorLat(a) - 0.065 + 0.13 * t), 0.002, 28, 2, false)), 0.6);
  add('lacquer', put(helmPlate(over(0.075, 0.42, 2.55), 0.01, 2, 16)), 0.5);
  add('steel', put(helmPlate(over(0.02, 0.95, 2.45), 0.013, 1, 12, false)), 0.5);
  add('steel', put(helmPlate(across(-1.07, 1.07, (a, t) => visorLat(a) + 0.062 + 0.022 * t), 0.006, 28, 1)), 0.6);
  for (const s of [-1, 1]) add('lights', put(helmPlate(across(s > 0 ? 0.12 : -0.44, s > 0 ? 0.44 : -0.12, (a, t) => visorLat(a) - 0.014 + 0.026 * t), 0.004, 6, 1, false)), 0.6, [1.4, 0.08, 0.05]);
  const G0 = -0.76, G1 = -0.36, GA = 0.36;
  add('dark', put(helmPlate(across(-GA, GA, (a, t) => G0 + (G1 - G0) * t), 0.002, 8, 2, false)), 0.6);
  add('lacquer', put(helmPlate(across(-GA - 0.08, GA + 0.08, (a, t) => G1 + 0.075 * t), 0.012, 10, 1)), 0.6);
  add('lacquer', put(helmPlate(across(-GA - 0.08, GA + 0.08, (a, t) => G0 - 0.07 + 0.07 * t), 0.012, 10, 1)), 0.6);
  for (const s of [-1, 1]) add('lacquer', put(helmPlate(across(s > 0 ? GA : -GA - 0.08, s > 0 ? GA + 0.08 : -GA, (a, t) => G0 + (G1 - G0) * t), 0.012, 1, 3)), 0.6);
  for (let i = 0; i < 5; i++) {
    const l0 = G0 + 0.02 + i * 0.077;
    add('steel', put(helmPlate(across(-GA, GA, (a, t) => l0 + 0.04 * t), 0.008, 8, 1)), 0.6);
  }
  for (const s of [-1, 1]) {
    const a0 = s > 0 ? 0.56 : -1.4, a1 = s > 0 ? 1.4 : -0.56;
    add('lacquer', put(helmPlate(across(a0, a1, (a, t) => -0.86 + (visorLat(a) - 0.09 + 0.86) * t), 0.008, 8, 4)), 0.6);
    const e0 = s > 0 ? 0.56 : -0.6, e1 = s > 0 ? 0.6 : -0.56;
    add('steel', put(helmPlate(across(e0, e1, (a, t) => -0.86 + (visorLat(a) - 0.09 + 0.86) * t), 0.0095, 1, 4)), 0.6);
    const fin = new THREE.Shape();
    fin.moveTo(0, 0); fin.quadraticCurveTo(-0.07, 0.012, -0.15, 0.085); fin.quadraticCurveTo(-0.09, 0.02, -0.045, -0.02); fin.lineTo(0, -0.014);
    const blade = place(new THREE.ExtrudeGeometry(fin, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 8 }).translate(0, 0, -0.004), [0, 0, 0], [0, -Math.PI / 2, 0]);
    add('lacquer', place(blade, [s * 0.106, 0.2, 0.035], [0, 0, -s * 0.22]), 0.6);
  }
  for (let i = 0; i < 3; i++) {
    const y1 = 0.075 - i * 0.032, r1 = 0.1 + i * 0.011;
    add('lacquer', band(y1 - 0.046, y1, r1 + 0.012, r1, 0.008, 3.5, 18, Math.PI), 0.7);
    add('steel', band(y1 - 0.05, y1 - 0.044, r1 + 0.0135, r1 + 0.0125, 0.006, 3.5, 18, Math.PI), 0.7);
  }
  return add;
}

// Black lacquer is nearly all reflection, so this studio is most of how he looks.
function studio(pm, more) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), new THREE.MeshBasicMaterial({ color: 0x07090d, side: THREE.BackSide })));
  const panel = (w, h, hex, k, p, at) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(...at); s.add(m); };
  panel(2.6, 2.6, 0xfff0e2, 2.4, [0, 3.3, 0], [0, 0, 0]);
  panel(1.5, 4.5, 0x9db6ff, 1.1, [-5.8, 1.2, 0.5], [0, 1.2, 0.5]);
  panel(3, 1.6, 0xffb46e, 0.9, [3.5, 1.2, -5.8], [0, 1, 0]);
  panel(2.2, 1.2, 0xffc890, 0.7, [5.8, 1.8, 3], [0, 1, 0]);
  panel(0.25, 3.5, 0xff2a1a, 1.6, [1.6, 1.0, 3.5], [0, 1, 0]);
  panel(12, 12, 0x15110e, 1, [0, -3.4, 0], [0, 0, 0]);
  more?.(panel);
  return { env: pm.fromScene(s, 0.035).texture, done: () => s.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }) };
}

export function clearCase(roots, lo, hi, skip = () => false) {
  let gone = 0;
  const box = new THREE.Box3(lo, hi), test = new THREE.Box3(), p = V(0, 0, 0);
  const inside = v => v.x > lo.x && v.x < hi.x && v.y > lo.y && v.y < hi.y && v.z > lo.z && v.z < hi.z;
  for (const root of roots) root.traverse(o => {
    if (!o.isMesh || skip(o)) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    o.updateWorldMatrix(true, false);
    if (!test.copy(g.boundingBox).applyMatrix4(o.matrixWorld).intersectsBox(box)) return;
    const pos = g.attributes.position, n = g.index ? g.index.count : pos.count, keep = [];
    const at = i => p.fromBufferAttribute(pos, g.index ? g.index.getX(i) : i).applyMatrix4(o.matrixWorld);
    for (let i = 0; i < n; i += 3) { if (inside(at(i)) && inside(at(i + 1)) && inside(at(i + 2))) gone++; else keep.push(i); }
    if (keep.length * 3 === n) return;
    if (g.index) {
      const out = new (g.index.array.constructor)(keep.length * 3);
      keep.forEach((i, k) => { out[k * 3] = g.index.getX(i); out[k * 3 + 1] = g.index.getX(i + 1); out[k * 3 + 2] = g.index.getX(i + 2); });
      g.setIndex(new THREE.BufferAttribute(out, 1));
    } else {
      for (const [name, attr] of Object.entries(g.attributes)) {
        const w = attr.itemSize, out = new attr.array.constructor(keep.length * 3 * w);
        keep.forEach((i, k) => out.set(attr.array.subarray(i * w, (i + 3) * w), k * 3 * w));
        g.setAttribute(name, new THREE.BufferAttribute(out, w, attr.normalized));
      }
    }
    g.computeBoundingSphere(); g.computeBoundingBox();
  });
  return gone;
}

// The studio's plain shaders built ahead in the background (stand-ins share them: three keys a program by its settings,
// not its material), so making the knight does not hold the page while the graphics card builds them. Call what this
// gives back once he is made, to let the stand-ins go.
export async function readyKnight(renderer) {
  if (!renderer?.compileAsync) return () => {};
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const mats = [THREE.BackSide, THREE.DoubleSide].map(side => new THREE.MeshBasicMaterial({ side }));
  const picture = new THREE.WebGLRenderTarget(1, 1), eye = new THREE.PerspectiveCamera(), was = renderer.getRenderTarget(), jobs = [];
  try { renderer.setRenderTarget(picture); for (const m of mats) jobs.push(renderer.compileAsync(new THREE.Mesh(g, m), eye)); } finally { renderer.setRenderTarget(was); }
  try { await Promise.all(jobs); } finally { picture.dispose(); }
  return () => { for (const m of mats) m.dispose(); g.dispose(); };
}

export function makeKnight(scene, meta, roots, { renderer }) {
  const c = meta.colliders?.find(x => x.name === 'vader');
  if (!c) return null;
  const cx = (c.min[0] + c.max[0]) / 2, cy = (c.min[1] + c.max[1]) / 2;
  // The old figure is baked into the lounge, so it is cut out rather than rebaked.
  const lo = b2t(cx - CASE[0] / 2 + 0.005, cy + CASE[2] / 2 - 0.005, PLINTH + 0.004), hi = b2t(cx + CASE[0] / 2 - 0.005, cy - CASE[2] / 2 + 0.005, PLINTH + CASE[1] + 0.012);
  const removed = clearCase(roots, lo.clone().min(hi), lo.clone().max(hi), o => o.name === 'vader_glass' || o.isSkinnedMesh);
  const oldGlass = roots.map(r => r.getObjectByName('vader_glass')).find(Boolean);
  if (oldGlass) oldGlass.visible = false;

  // Between the front door's view and the spot where you take the saber.
  const facing = THREE.MathUtils.degToRad(30), front = V(Math.sin(facing), 0, Math.cos(facing));
  // The lamp and the blade's red live in his reflections: real lights cost every lit material in the house each frame.
  // One generator for both, and the first studio kept till the second is made, so the second builds no shaders of its own.
  const pm = new THREE.PMREMGenerator(renderer), plain = studio(pm), lit = studio(pm, panel => {
    const lamp = front.clone().multiplyScalar(0.27).add(V(0, 0.45, 0)).normalize().multiplyScalar(3.2);
    panel(1.8, 1.8, 0xfff0e4, 3.2, lamp.toArray(), [0, 0, 0]);
    const glow = front.clone().add(V(-0.1, 0.15, 0)).normalize().multiplyScalar(3);
    panel(0.45, 2.6, 0xff2a18, 2.2, glow.toArray(), [0, glow.y, 0]);
  });
  pm.dispose(); plain.done(); lit.done();
  const env = plain.env, M = knightMaterials(lit.env);
  const root = new THREE.Group();
  root.name = 'knight';
  root.position.copy(b2t(cx, cy, PLINTH));
  scene.add(root);
  const figure = new THREE.Group();
  figure.position.y = BASE_H;
  figure.rotation.y = facing;
  figure.scale.setScalar(S);
  root.add(figure);
  buildBody(M).build(figure, M);
  const head = new THREE.Group();
  head.position.set(0, 1.56, 0);
  buildHead(M).build(head, M);
  figure.add(head);
  const glowMat = bladeGlowMaterial();
  const saber = new THREE.Group();
  saber.position.set(-0.228, 1.02, 0.222);
  buildHilt(M, 14).build(saber, M);
  const blade = buildBlade(0.95, 0.011, M, glowMat);
  blade.position.y = HILT;
  saber.add(blade);
  figure.add(saber);
  const base = new THREE.Group();
  base.add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, BASE_H, 48), M.lacquer).translateY(BASE_H / 2));
  base.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.0025, 6, 64), M.steel).rotateX(Math.PI / 2).translateZ(-BASE_H));
  base.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.0012, 4, 64), M.glow).rotateX(Math.PI / 2).translateZ(-0.004));
  root.add(base);

  const [w, h, d] = CASE, gl = 0.008;
  const tint = new THREE.MeshBasicMaterial({ color: 0x9fb6d8, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  const shine = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 0, envMap: env, envMapIntensity: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glass = new THREE.Group(), lid = new THREE.Group();
  // A plain tint plus an additive reflection: three dims the reflections of transparent materials.
  const panes = (parent, list) => {
    const g = mergeGeometries(list.map(([pw, ph, p, r]) => place(new THREE.PlaneGeometry(pw, ph), p, r)));
    for (const m of [tint, shine]) { const q = new THREE.Mesh(g, m); q.renderOrder = 3; parent.add(q); }
  };
  const y0 = 0.01, y1 = 0.01 + h, ym = (y0 + y1) / 2;
  panes(glass, [[w, h, [0, ym, d / 2], [0, 0, 0]], [w, h, [0, ym, -d / 2], [0, Math.PI, 0]], [d, h, [w / 2, ym, 0], [0, Math.PI / 2, 0]], [d, h, [-w / 2, ym, 0], [0, -Math.PI / 2, 0]]]);
  panes(lid, [[w, d, [0, 0, 0], [-Math.PI / 2, 0, 0]]]);
  const edges = bucketer();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) edges('steel', place(new THREE.BoxGeometry(gl, h, gl), [sx * w / 2, (y0 + y1) / 2, sz * d / 2]), 0.5);
  for (const sz of [-1, 1]) edges('steel', place(new THREE.BoxGeometry(w + gl, gl, gl), [0, y0, sz * d / 2]), 0.5);
  for (const sx of [-1, 1]) edges('steel', place(new THREE.BoxGeometry(gl, gl, d + gl), [sx * w / 2, y0, 0]), 0.5);
  edges.build(glass, M);
  const lidEdges = bucketer();
  for (const sz of [-1, 1]) lidEdges('steel', place(new THREE.BoxGeometry(w + gl, gl, gl), [0, 0, sz * d / 2]), 0.5);
  for (const sx of [-1, 1]) lidEdges('steel', place(new THREE.BoxGeometry(gl, gl, d + gl), [sx * w / 2, 0, 0]), 0.5);
  lidEdges.build(lid, M);
  lid.position.y = y1;
  root.add(glass, lid);

  let out = false, lidK = 0, look = 0, flick = 0;
  const local = V(0, 0, 0), tipAt = V(0, 0, 0);
  return {
    root, env, materials: M, removed, glowMat,
    saberAt: () => saber.localToWorld(tipAt.set(0, HILT + 0.45, 0)),
    get out() { return out; },
    setOut(on) { out = !!on; saber.visible = !out; },
    tick(dt, t, eye) {
      lidK += ((out ? 1 : 0) - lidK) * Math.min(1, dt * 4);
      lid.position.y = y1 + LID * lidK * lidK * (3 - 2 * lidK);
      let want = 0;
      if (eye) {
        local.copy(eye); figure.worldToLocal(local);
        const dist = Math.hypot(local.x, local.z) * S;
        if (dist < 3.2 && local.z > -0.2) want = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.5, 0.5);
      }
      look += (want - look) * Math.min(1, dt * 1.6);
      head.rotation.y = look;
      flick = 0.94 + 0.06 * Math.sin(t * 37) * Math.sin(t * 23.3 + 1);
      glowMat.uniforms.k.value = flick;
    },
  };
}

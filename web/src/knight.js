import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { b2t } from './engine.js';

// The figure in the glass case by the stairs: a dark knight in lacquered armour, hooded, caped, holding his saber upright
// in both hands. An original design built here from shapes, in real lit materials: glossy armour that catches the
// light, brushed steel trim, cloth, and a lit blade. He is modelled life size (1.9 m, facing +z) and shrunk into the
// case. The baked stand-in from the lounge bake is taken out of the room when he arrives.
const S = 0.24, PLINTH = 1.0, BASE_H = 0.022, CASE = [0.66, 0.7, 0.66], LID = 0.2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);

// ---------- shapes ----------
// Every piece ends as plain triangles with normals smoothed up to `crease`, so the pieces of one material merge.
function finish(g, crease = 1.2) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const out = toCreasedNormals(g, crease);
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  return out;
}
const place = (g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => g.applyMatrix4(new THREE.Matrix4().compose(V(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V(...s)));
// A shape modelled up the y axis from 0, stood between two points (`unit`: modelled 1 long, stretched to fit).
function between(g, a, b, unit = false) {
  const d = V(...b).sub(V(...a)), k = unit ? d.length() : 1;
  return g.applyMatrix4(new THREE.Matrix4().compose(V(...a), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()), V(1, k, 1)));
}
// A limb: rounded at both ends, r0 at the start and r1 at the end, swelling by `bulge` in the middle.
function limb(a, b, r0, r1, bulge = 0, seg = 12) {
  const len = V(...b).distanceTo(V(...a)), pts = [];
  for (let i = 0; i <= 3; i++) { const t = -Math.PI / 2 + (i / 3) * (Math.PI / 2); pts.push(V2(Math.cos(t) * r0, Math.sin(t) * r0 * 0.8)); }
  for (let i = 1; i < 6; i++) { const t = i / 6; pts.push(V2(r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * t), t * len)); }
  for (let i = 0; i <= 3; i++) { const t = (i / 3) * (Math.PI / 2); pts.push(V2(Math.cos(t) * r1, len + Math.sin(t) * r1 * 0.8)); }
  return between(new THREE.LatheGeometry(pts, seg), a, b);
}
// A thin plate wrapped round the y axis, from radius r0 at y0 to r1 at y1, `phiL` of the way round centred on +z.
function band(y0, y1, r0, r1, t = 0.008, phiL = Math.PI * 2, seg = 28, mid = 0) {
  const pts = [V2(r0 - t, y0), V2(r0, y0), V2(r1, y1), V2(r1 - t, y1), V2(r0 - t, y0)];
  return new THREE.LatheGeometry(pts, seg, mid - phiL / 2, phiL);
}
const ellipsoid = (r, at, seg = 16) => place(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), at, [0, 0, 0], r);
// A cap of a sphere: thetaL down from its pole, all the way round.
const cap = (r, thetaL, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * thetaL / Math.PI)), 0, Math.PI * 2, 0, thetaL);
// Moves every point of a shape by a function of where it is.
function sculpt(g, f) {
  const p = g.attributes.position, v = V(0, 0, 0);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); f(v); p.setXYZ(i, v.x, v.y, v.z); }
  return g;
}

// ---------- materials ----------
// The cloth is one sheet seen from both sides: black outside, the crimson lining from within.
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
    // Two sided: the shoulder plates and knee cops are open shells.
    lacquer: std(0x0b0c0f, 0.2, 0.15, { envMapIntensity: 1.35, side: THREE.DoubleSide }),
    steel: std(0x80858f, 0.3, 1, { envMapIntensity: 1.1 }),
    dark: std(0x2c2f35, 0.38, 1),
    suit: std(0x17181c, 0.86, 0),
    leather: std(0x141416, 0.5, 0.05),
    grip: std(0x0d0d0e, 0.62, 0),
    cloth: lined(std(0x0c0c0f, 0.8, 0, { envMapIntensity: 0.6, side: THREE.DoubleSide }), 0x52090e),
    glow: glow(3.2, 0.3, 0.22),
    core: glow(3.6, 3.0, 2.9),
  };
}

// Pieces gathered by material and merged into one mesh each.
function bucketer() {
  const b = new Map();
  const add = (mat, g, crease) => { if (!b.has(mat)) b.set(mat, []); b.get(mat).push(finish(g, crease)); };
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

// ---------- the saber's hilt and blade (the figure's, and the one in the hand) ----------
// Up the y axis from the pommel (0) to the emitter (HILT); an original design: ridged grip, a collar with its switch,
// a slim neck and a three-pronged emitter crown.
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

// The blade: a white-hot core and a red glow round it that is brightest face on and fades at its edges.
export function bladeGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(1.0, 0.09, 0.05) }, k: { value: 1 } },
    vertexShader: 'varying vec3 vN, vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float k; varying vec3 vN, vV; void main() { float f = abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(color * pow(f, 2.4) * 1.6 * k, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
// Up the y axis from 0 to `len`; scale its y to draw it shorter while it lights.
export function buildBlade(len, r, M, glowMat) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(place(new THREE.CapsuleGeometry(r, len - 2 * r, 6, 12), [0, len / 2, 0]), M.core);
  const halo = new THREE.Mesh(place(new THREE.CapsuleGeometry(r * 3.2, len - 2 * r, 8, 16), [0, len / 2, 0]), glowMat);
  core.name = 'blade_core'; halo.name = 'blade_glow';
  halo.renderOrder = 4;
  g.add(core, halo);
  return g;
}

// ---------- the knight ----------
function buildBody(M) {
  const add = bucketer();
  for (const s of [-1, 1]) {
    const x = s * 0.115;
    // Boots: the foot, a sole, a toe cap and the shaft.
    add('leather', sculpt(ellipsoid([0.058, 0.05, 0.135], [x, 0.05, 0.05]), v => { v.y = Math.max(v.y, 0.012); }), 1.3);
    add('dark', place(new THREE.BoxGeometry(0.112, 0.018, 0.27), [x, 0.009, 0.045]), 0.6);
    add('lacquer', sculpt(ellipsoid([0.062, 0.045, 0.07], [x, 0.06, 0.13]), v => { v.y = Math.max(v.y, 0.03); }), 1.1);
    add('leather', limb([x, 0.05, 0], [x, 0.34, 0.005], 0.062, 0.058), 1.2);
    // Greaves over the shins, a knee cop, the thigh.
    add('suit', limb([x, 0.3, 0.005], [x * 0.98, 0.6, 0.01], 0.055, 0.064, 0.006), 1.2);
    add('lacquer', place(band(0.0, 0.27, 0.074, 0.07, 0.008, 3.6, 24), [x, 0.31, 0.008]), 0.7);
    add('steel', place(new THREE.TorusGeometry(0.069, 0.005, 6, 32, 3.6), [x, 0.58, 0.008], [Math.PI / 2, 0, Math.PI / 2 - 1.8]), 0.8);
    add('lacquer', place(cap(0.068, 1.15, 14), [x, 0.6, 0.04], [1.35, 0, 0], [1, 1, 0.85]), 0.9);
    add('suit', limb([x * 0.98, 0.58, 0.01], [s * 0.1, 0.98, 0.0], 0.068, 0.092, 0.012), 1.2);
    // Tassets: three overlapping plates hanging over each hip.
    for (let i = 0; i < 3; i++) {
      const y0 = 1.03 - i * 0.07, r0 = 0.168 + i * 0.012;
      add('lacquer', place(band(y0 - 0.13, y0, r0 + 0.035, r0, 0.007, 0.95, 14, s * 1.15), [0, 0, 0], [0, 0, 0], [1, 1, 0.8]), 0.7);
      add('steel', place(band(y0 - 0.136, y0 - 0.126, r0 + 0.04, r0 + 0.037, 0.006, 0.95, 14, s * 1.15), [0, 0, 0], [0, 0, 0], [1, 1, 0.8]), 0.7);
    }
  }
  // Hips, belt and buckle.
  add('suit', ellipsoid([0.165, 0.1, 0.115], [0, 0.97, 0]), 1.2);
  add('leather', place(band(1.0, 1.08, 0.162, 0.165, 0.012, Math.PI * 2, 32), [0, 0, 0], [0, 0, 0], [1, 1, 0.76]), 0.7);
  const hex = new THREE.Shape();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; hex[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 0.036, Math.sin(a) * 0.03); }
  add('steel', place(new THREE.ExtrudeGeometry(hex, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }), [0, 1.04, 0.122]), 0.5);
  add('glow', place(new THREE.BoxGeometry(0.03, 0.004, 0.004), [0, 1.04, 0.136]), 0.5);
  // The body: the suit at the waist, plated bands over the stomach, the breastplate, the gorget.
  add('suit', place(new THREE.LatheGeometry([V2(0, 1.0), V2(0.15, 1.03), V2(0.142, 1.16), V2(0.15, 1.28), V2(0, 1.3)], 24), [0, 0, 0], [0, 0, 0], [1, 1, 0.74]), 1.2);
  for (let i = 0; i < 3; i++) add('lacquer', place(band(1.085 + i * 0.058, 1.135 + i * 0.058, 0.152 + i * 0.004, 0.156 + i * 0.006, 0.01, 3.4, 24), [0, 0, 0], [0, 0, 0], [1, 1, 0.78]), 0.6);
  const chest = new THREE.LatheGeometry([V2(0.155, 1.25), V2(0.168, 1.27), V2(0.2, 1.36), V2(0.205, 1.42), V2(0.18, 1.49), V2(0.12, 1.53), V2(0.07, 1.55), V2(0, 1.555)], 40);
  // A keel down the middle of the breastplate.
  add('lacquer', sculpt(place(chest, [0, 0, 0], [0, 0, 0], [1, 1, 0.66]), v => { if (v.z > 0) v.z += 0.016 * Math.exp(-((v.x / 0.03) ** 2)) * Math.min(1, (v.y - 1.25) / 0.08); }), 0.75);
  add('steel', place(band(1.245, 1.262, 0.162, 0.164, 0.012, Math.PI * 2, 36), [0, 0, 0], [0, 0, 0], [1, 1, 0.68]), 0.7);
  // The crest on the chest: a gem with two steel lines rising from it to the shoulders.
  add('glow', place(new THREE.OctahedronGeometry(0.018, 0), [0, 1.37, 0.152], [0, 0, 0], [0.8, 1.25, 0.5]), 0.3);
  add('steel', place(new THREE.OctahedronGeometry(0.03, 0), [0, 1.37, 0.146], [0, 0, 0], [0.9, 1.3, 0.35]), 0.3);
  for (const s of [-1, 1]) add('steel', between(place(new THREE.BoxGeometry(0.008, 1, 0.005), [0, 0.5, 0]), [s * 0.025, 1.39, 0.142], [s * 0.15, 1.47, 0.105], true), 0.5);
  add('lacquer', place(band(1.5, 1.6, 0.12, 0.08, 0.01, Math.PI * 2, 28), [0, 0, 0], [0, 0, 0], [1, 1, 0.86]), 0.8);
  // Shoulders: three stacked plates each, and the arms down to the two hands on the hilt.
  const ARMS = {
    [-1]: { sh: [-0.235, 1.46, 0], el: [-0.262, 1.19, 0.06], wr: [-0.15, 1.17, 0.235], hand: [-0.12, 1.17, 0.265] },
    [1]: { sh: [0.235, 1.46, 0], el: [0.21, 1.2, 0.12], wr: [-0.075, 1.255, 0.25], hand: [-0.12, 1.255, 0.265] },
  };
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      add('lacquer', place(cap(0.118 - i * 0.012, 1.2, 18), [s * (0.235 + i * 0.022), 1.475 - i * 0.05, 0], [0, 0, -s * (0.42 + i * 0.2)], [1, 0.72, 1.06]), 0.9);
    }
    add('steel', place(new THREE.TorusGeometry(0.105, 0.004, 6, 40), [s * 0.282, 1.385, 0], [Math.PI / 2, -s * 0.82, 0], [1, 1.06, 1]), 0.8);
    const A = ARMS[s];
    add('suit', limb(A.sh, A.el, 0.062, 0.052, 0.012), 1.2);
    add('suit', limb(A.el, A.wr, 0.052, 0.04, 0.008), 1.2);
    add('lacquer', place(cap(0.052, 1.3, 12), A.el, [0, 0, 0], [1, 0.8, 1]), 0.9);
    // The vambrace over the forearm, with a steel ring at each end.
    const fa = V(...A.wr).sub(V(...A.el)), len = fa.length();
    add('lacquer', between(band(len * 0.12, len * 0.86, 0.058, 0.05, 0.007, Math.PI * 2, 18), A.el, A.wr), 0.7);
    add('steel', between(band(len * 0.84, len * 0.88, 0.054, 0.053, 0.006, Math.PI * 2, 18), A.el, A.wr), 0.7);
    // The gloved hand round the grip, thumb over the top.
    add('leather', ellipsoid([0.044, 0.04, 0.048], A.hand), 1.2);
    add('leather', limb([A.hand[0] + 0.03, A.hand[1] + 0.012, A.hand[2] - 0.01], [A.hand[0] + 0.012, A.hand[1] + 0.03, A.hand[2] + 0.022], 0.012, 0.011), 1.2);
  }
  // The cape: from round the shoulders to the floor, falling back in folds, black outside and crimson within.
  const nu = 30, nv = 24, pos = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, A = 3.25 - 0.95 * v, R = 0.205 + 0.25 * Math.pow(v, 0.85), y = Math.max(0.012, 1.53 - v * 1.56);
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, th = Math.PI + (u - 0.5) * A;
      const fold = (0.006 + 0.04 * v) * Math.sin(u * Math.PI * 11 + v * 2.2) + 0.012 * v * Math.sin(u * Math.PI * 4 - 1);
      const r = R + fold, pool = Math.max(0, 1.53 - v * 1.56 - 0.012) <= 0 ? (v * 1.56 - 1.518) * 0.9 : 0;
      pos.push(Math.sin(th) * r + 0.04 * v * v, y, Math.cos(th) * r * 0.78 - 0.035 - 0.2 * Math.pow(v, 1.6) - pool);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const cape = new THREE.BufferGeometry();
  cape.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cape.setIndex(idx);
  add('cloth', cape, 1.4);
  return add;
}

// The helm's shape: a unit sphere point moved onto it (rounded over the top, a keel down the face, narrower at the jaw).
// The visor and the slats use it too, so they sit on the helm's surface.
function helmAt(v, out = 0) {
  v.x *= 0.104 + out; v.y *= 0.142 + out; v.z *= 0.128 + out;
  if (v.z > 0.045) v.z = 0.045 + (v.z - 0.045) * 0.55;
  const low = Math.max(0, -v.y / 0.142), high = Math.max(0, v.y / 0.142);
  // A keel down the face to a pointed chin, and a brow over the visor.
  if (v.z > 0) v.z += 0.055 * Math.max(0, 1 - Math.abs(v.x) / 0.08) * Math.min(1, low * 1.8 + 0.1);
  if (v.z > 0.03) v.z += 0.012 * Math.exp(-(((v.y - 0.03) / 0.018) ** 2));
  v.x *= 1 - 0.24 * low;
  // Swept back over the top into a low ridge.
  if (v.z < 0) v.y += 0.02 * high * (-v.z / 0.128);
  if (v.y < -0.105) v.y = -0.105 + (v.y + 0.105) * 0.4;
  return v;
}
// A strip of the helm's surface round the face: `lat` up from its middle, `h` high, `w` radians each side of the front.
const helmStrip = (lat, h, w, out) => sculpt(new THREE.SphereGeometry(1, 28, 2, Math.PI / 2 - w, 2 * w, Math.PI / 2 - lat - h / 2, h), v => helmAt(v, out));

function buildHead(M) {
  const add = bucketer();
  const at = [0, 0.16, 0.012];
  add('lacquer', place(sculpt(new THREE.SphereGeometry(1, 36, 26), v => helmAt(v)), at), 0.9);
  // The visor: one narrow lit slit round the face, sunk in a dark band.
  add('dark', place(helmStrip(0.03, 0.11, 0.95, 0.002), at), 0.8);
  add('glow', place(helmStrip(0.03, 0.03, 0.8, 0.0045), at), 0.8);
  // Three breathing slats down the keel, cheek plates, and a steel crest from brow to nape.
  for (let i = 0; i < 3; i++) add('steel', place(helmStrip(-0.32 - i * 0.13, 0.04, 0.16 - i * 0.03, 0.004), at), 0.6);
  // Steel lines along each jaw.
  for (const s of [-1, 1]) add('steel', place(sculpt(new THREE.SphereGeometry(1, 3, 24, s > 0 ? Math.PI / 2 - 1.15 : Math.PI / 2 + 0.95, 0.2, Math.PI / 2 + 0.25, 0.75), v => helmAt(v, 0.003)), at), 0.6);
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.absarc(0, 0, 0.142, 0.15, Math.PI - 0.35, false); fin.absarc(0, 0, 0.126, Math.PI - 0.35, 0.15, true);
  add('steel', place(new THREE.ExtrudeGeometry(fin, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 24 }), [0.006, 0.17, 0.0], [0, -Math.PI / 2, 0]), 0.6);
  // The hood over the helm, open at the face; its lining shows round the opening.
  const hood = new THREE.SphereGeometry(0.168, 28, 18, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, 2.4);
  // Peaked at the back of the head, and falling back to the shoulders behind the neck.
  add('cloth', sculpt(place(hood, [0, 0.175, -0.012], [0, 0, 0], [1.04, 1.08, 1.06]), v => {
    if (v.z < 0 && v.y > 0.2) { const k = Math.min(1, -v.z / 0.15) * (v.y - 0.2) / 0.16; v.y += 0.03 * k; v.z -= 0.04 * k; }
    if (v.y < 0.1) v.z -= (0.1 - v.y) * 0.3;
  }), 1.3);
  return add;
}

// The room's look in a small studio: a soft light overhead (the case's own), the window's cool light from the west, the
// warm lamps of the loft, and the saber's red. Black lacquer is all reflection, so this is most of how he looks.
function studio(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), new THREE.MeshBasicMaterial({ color: 0x07090d, side: THREE.BackSide })));
  const panel = (w, h, hex, k, p, at) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(...at); s.add(m); };
  panel(2.6, 2.6, 0xfff0e2, 2.4, [0, 3.3, 0], [0, 0, 0]);
  panel(1.5, 4.5, 0x9db6ff, 1.1, [-5.8, 1.2, 0.5], [0, 1.2, 0.5]);
  panel(3, 1.6, 0xffb46e, 0.9, [3.5, 1.2, -5.8], [0, 1, 0]);
  panel(2.2, 1.2, 0xffc890, 0.7, [5.8, 1.8, 3], [0, 1, 0]);
  panel(0.25, 3.5, 0xff2a1a, 1.6, [1.6, 1.0, 3.5], [0, 1, 0]);
  panel(12, 12, 0x15110e, 1, [0, -3.4, 0], [0, 0, 0]);
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  s.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return env;
}

// Takes the baked stand-in out: every triangle wholly inside the case, above the plinth, in any mesh of the room
// (the glass is the case's own and is swapped, not cut). Returns how many triangles went.
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

export function makeKnight(scene, meta, roots, { renderer }) {
  const c = meta.colliders?.find(x => x.name === 'vader');
  if (!c) return null;
  const cx = (c.min[0] + c.max[0]) / 2, cy = (c.min[1] + c.max[1]) / 2;
  // Out with the stand-in (its pieces were baked into the lounge, and its saber was a loose red rod).
  const lo = b2t(cx - CASE[0] / 2 + 0.005, cy + CASE[2] / 2 - 0.005, PLINTH + 0.004), hi = b2t(cx + CASE[0] / 2 - 0.005, cy - CASE[2] / 2 + 0.005, PLINTH + CASE[1] + 0.012);
  const removed = clearCase(roots, lo.clone().min(hi), lo.clone().max(hi), o => o.name === 'vader_glass' || o.isSkinnedMesh);
  const oldGlass = roots.map(r => r.getObjectByName('vader_glass')).find(Boolean);
  if (oldGlass) oldGlass.visible = false;

  const env = studio(renderer), M = knightMaterials(env);
  const root = new THREE.Group();
  root.name = 'knight';
  root.position.copy(b2t(cx, cy, PLINTH));
  scene.add(root);
  // He faces between the way in from the front door and the spot where you take the saber.
  const figure = new THREE.Group();
  figure.position.y = BASE_H;
  figure.rotation.y = THREE.MathUtils.degToRad(30);
  figure.scale.setScalar(S);
  root.add(figure);
  buildBody(M).build(figure, M);
  const head = new THREE.Group();
  head.position.set(0, 1.56, 0);
  buildHead(M).build(head, M);
  figure.add(head);
  // His saber, upright between his hands.
  const glowMat = bladeGlowMaterial();
  const saber = new THREE.Group();
  saber.position.set(-0.12, 1.115, 0.265);
  buildHilt(M, 14).build(saber, M);
  const blade = buildBlade(0.95, 0.011, M, glowMat);
  blade.position.y = HILT;
  saber.add(blade);
  figure.add(saber);
  // The display base: black, a steel lip, a thin red line round its foot.
  const base = new THREE.Group();
  base.add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, BASE_H, 48), M.lacquer).translateY(BASE_H / 2));
  base.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.0025, 6, 64), M.steel).rotateX(Math.PI / 2).translateZ(-BASE_H));
  base.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.0012, 4, 64), M.glow).rotateX(Math.PI / 2).translateZ(-0.004));
  root.add(base);

  // The case: glass panes with a faint tint and a clear reflection, steel edges, and a lid that lifts.
  const [w, h, d] = CASE, gl = 0.008;
  const tint = new THREE.MeshBasicMaterial({ color: 0x9fb6d8, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  const shine = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 0, envMap: env, envMapIntensity: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glass = new THREE.Group(), lid = new THREE.Group();
  // Each set of panes is drawn twice: the tint, and the reflection added over it.
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

  // The case's own light from the lid, and the blade's red on his armour.
  // The lamp sits in the lid's front corner, toward where you stand, so it lights his front and not the top of his hood.
  const front = V(Math.sin(figure.rotation.y), 0, Math.cos(figure.rotation.y));
  const key = new THREE.SpotLight(0xfff0e4, 0.4, 1.4, 0.8, 0.8, 2);
  key.position.copy(root.position).addScaledVector(front, 0.27).add(V(0, y1 - 0.02, 0));
  key.target.position.copy(root.position).add(V(0, 0.24, 0));
  const red = new THREE.PointLight(0xff2a18, 0.06, 0.9, 2);
  scene.add(key, key.target, red);

  let out = false, lidK = 0, look = 0, flick = 0;
  const local = V(0, 0, 0), tipAt = V(0, 0, 0);
  return {
    root, env, materials: M, removed, glowMat,
    // Where his saber is in the room (its middle), for its hum.
    saberAt: () => saber.localToWorld(tipAt.set(0, HILT + 0.45, 0)),
    get out() { return out; },
    // The saber is in my hand (true) or back in his (false); the lid lifts while it is out.
    setOut(on) { out = !!on; saber.visible = !out; },
    tick(dt, t, eye) {
      lidK += ((out ? 1 : 0) - lidK) * Math.min(1, dt * 4);
      lid.position.y = y1 + LID * lidK * lidK * (3 - 2 * lidK);
      // He turns his head toward whoever stands close to the case.
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
      red.intensity = out ? 0 : 0.06 * flick;
      saber.updateWorldMatrix(true, false);
      red.position.copy(saber.localToWorld(tipAt.set(0, HILT + 0.3, 0.06)));
    },
  };
}

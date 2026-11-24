// Packs the hand from blender/build_hand.py: the mesh into web/assets/hand/hand.glb (meshopt; no skin, the page binds
// its own bones), and what the hand's math needs into web/src/pure/handrig.js: the joints, each digit's nail and pad,
// points over the palm, and a spread of points over the whole hand with their weights, for fitting it round things.
//   GLTF_TRANSFORM=<node_modules with @gltf-transform/core, functions 4.5.1 and meshoptimizer 0.22.0> node blender/pack_hand.js
const path = require('path'), fs = require('fs');
const M = process.env.GLTF_TRANSFORM;
if (!M) { console.error('Set GLTF_TRANSFORM to a node_modules folder holding @gltf-transform/* and meshoptimizer.'); process.exit(1); }
const need = name => require(path.join(M, name));
const { Document, NodeIO } = need('@gltf-transform/core');
const { ALL_EXTENSIONS } = need('@gltf-transform/extensions');
const { meshopt } = need('@gltf-transform/functions');
const { MeshoptEncoder } = need('meshoptimizer');

const ROOT = path.join(__dirname, '..');
const IN = path.join(ROOT, 'blender/build/hand_mesh.json');
const GLB = path.join(ROOT, 'web/assets/hand/hand.glb');
const RIG = path.join(ROOT, 'web/src/pure/handrig.js');
const DIGITS = ['index', 'middle', 'ring', 'pinky', 'thumb'];
const r5 = x => Math.round(x * 1e5) / 1e5;

(async () => {
  const H = JSON.parse(fs.readFileSync(IN, 'utf8')), n = H.nail.length, B = H.bones;
  const at = i => [H.pos[i * 3], H.pos[i * 3 + 1], H.pos[i * 3 + 2]], nor = i => [H.nor[i * 3], H.nor[i * 3 + 1], H.nor[i * 3 + 2]];
  const top = i => B[H.joint4[i * 4]];
  const add = (a, b) => a.map((v, k) => v + b[k]), unit = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
  // Each digit's nail: the mean normal over its nail.
  const nails = {};
  for (const d of DIGITS) {
    let s = [0, 0, 0], c = 0;
    for (let i = 0; i < n; i++) if (H.nail[i] > 0.5 && top(i) === d + '3') { s = add(s, nor(i)); c++; }
    if (!c) throw new Error('no nail found on the ' + d);
    nails[d] = unit(s).map(r5);
  }
  // Points over the palm's inside face (normals facing out of the palm), one in each 6 mm cell.
  const cell = (list, size) => { const seen = new Set(), out = []; for (const i of list) { const k = at(i).map(v => Math.round(v / size)).join(); if (!seen.has(k)) { seen.add(k); out.push(i); } } return out; };
  const palmIdx = [];
  for (let i = 0; i < n; i++) if (/^(hand|index0|middle0|ring0|pinky0)$/.test(top(i)) && nor(i)[1] < -0.7 && H.weight4[i * 4] > 0.6) palmIdx.push(i);
  const palm = cell(palmIdx, 0.006).map(i => at(i).map(r5));
  // A spread of points over the hand, one in each 4.5 mm cell, with their two strongest bones.
  const all = [];
  for (let i = 0; i < n; i++) if (top(i) !== 'arm') all.push(i);
  const pts = cell(all, 0.0045), points = { p: [], j: [], w: [] };
  for (const i of pts) {
    const w0 = H.weight4[i * 4], w1 = H.weight4[i * 4 + 1], s = w0 + w1;
    points.p.push(...at(i).map(r5)); points.j.push(H.joint4[i * 4], w1 > 0.02 ? H.joint4[i * 4 + 1] : H.joint4[i * 4]); points.w.push(r5(w0 / s));
  }
  // Each digit's pad: on its last bone, the point furthest into the palm between 40 and 75% of the way along it.
  const J = H.joints, ends = { index: ['finger-2-3', 'finger-2-4'], middle: ['finger-3-3', 'finger-3-4'], ring: ['finger-4-3', 'finger-4-4'], pinky: ['finger-5-3', 'finger-5-4'], thumb: ['finger-1-3', 'finger-1-4'] };
  const pads = {};
  for (const d of DIGITS) {
    const a = J[ends[d][0]], b = J[ends[d][1]], ax = unit(b.map((v, k) => v - a[k])), L = Math.hypot(...b.map((v, k) => v - a[k]));
    let best = null, bestY = Infinity;
    for (let i = 0; i < n; i++) {
      if (top(i) !== d + '3') continue;
      const p = at(i), rel = p.map((v, k) => v - a[k]), u = rel.reduce((s, v, k) => s + v * ax[k], 0) / L;
      if (u < 0.4 || u > 0.75) continue;
      // Furthest against the nail's way out.
      const y = p.reduce((s, v, k) => s + v * nails[d][k], 0);
      if (y < bestY) { bestY = y; best = p; }
    }
    pads[d] = best.map(r5);
  }
  const joints = Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v.map(r5)]));
  fs.writeFileSync(RIG, `// Made by blender/pack_hand.js from blender/build_hand.py (MakeHuman's base mesh, CC0): do not edit by hand.
// The right hand at rest in its own axes (x from the wrist to the middle knuckle, y out of the back, z toward the little
// finger), in metres: the joints, each digit's nail (its outward normal) and pad, points over the palm, and a spread of
// points over the hand (p: positions, j: their two strongest bones by number in BONES, w: the first one's share).
export const BONES = ${JSON.stringify(B)};
export const JOINTS = ${JSON.stringify(joints)};
export const NAILS = ${JSON.stringify(nails)};
export const PADS = ${JSON.stringify(pads)};
export const PALM = ${JSON.stringify(palm)};
export const POINTS = ${JSON.stringify(points)};
`);

  // ---------- the mesh ----------
  await MeshoptEncoder.ready;
  const doc = new Document(), buf = doc.createBuffer();
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array(H.pos)))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array(H.nor)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(H.uv)))
    .setAttribute('JOINTS_0', acc('VEC4', new Uint8Array(H.joint4)))
    .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(H.weight4)))
    .setAttribute('_NAIL', acc('SCALAR', new Float32Array(H.nail)))
    .setIndices(acc('SCALAR', n > 65535 ? new Uint32Array(H.index) : new Uint16Array(H.index)));
  doc.createScene().addChild(doc.createNode('hand').setMesh(doc.createMesh('hand').addPrimitive(prim)));
  // Quantized, the positions' scale and offset move onto the node: the page puts them back before binding its bones.
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  fs.mkdirSync(path.dirname(GLB), { recursive: true });
  await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).write(GLB, doc);
  console.log('hand', n, 'vertices,', H.index.length / 3, 'triangles:', fs.statSync(GLB).size, 'bytes;', 'rig', fs.statSync(RIG).size, 'bytes,', pts.length, 'points,', palm.length, 'on the palm');
})().catch(e => { console.error(e); process.exit(1); });

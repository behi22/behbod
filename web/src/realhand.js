import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { BONES, localsFor, rest } from './pure/realhand.js';
import { JOINTS } from './pure/handrig.js';

// The realistic hand (blender/build_hand.py, MakeHuman's CC0 base mesh): loaded once when first asked for, a right hand
// and its mirror image for the left, each a skinned mesh on its own bones, posed from pure/realhand.js.

let geometry = null;
// The right hand's mesh at rest in its own axes. Its positions are packed small with their scale on the node, so they
// are unpacked here before any bones are bound. A fetch that failed is tried again on the next call.
export function loadHand(url = new URL('../assets/hand/hand.glb', import.meta.url).href) {
  geometry ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then(gltf => {
    let mesh = null;
    gltf.scene.traverse(o => { if (o.isMesh) mesh = o; });
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry, p = g.attributes.position, out = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).toArray(out, i * 3);
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    g.computeBoundingSphere();
    return g;
  }).catch(e => { geometry = null; throw e; });
  return geometry;
}

// The same mesh mirrored across z: positions and normals turned over, and every triangle's winding reversed. Made once
// and shared by every left hand (the desk's and each gun's).
const mirrors = new WeakMap();
function mirrored(g) {
  if (mirrors.has(g)) return mirrors.get(g);
  const m = g.clone(), p = m.attributes.position, n = m.attributes.normal, nf = new Float32Array(n.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) p.setZ(i, -p.getZ(i));
  for (let i = 0; i < n.count; i++) { v.fromBufferAttribute(n, i).toArray(nf, i * 3); nf[i * 3 + 2] *= -1; }
  m.setAttribute('normal', new THREE.BufferAttribute(nf, 3));
  const idx = m.index.array.slice();
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  m.computeBoundingSphere();
  mirrors.set(g, m);
  return m;
}

// The nails a touch glossier than the skin round them (the mesh carries how much of each point is nail).
function withNails(m, gloss) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float _nail;\nvarying float vNail;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNail = _nail;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vNail;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, ${gloss.toFixed(3)}, smoothstep(0.2, 0.8, vNail));`);
  };
  m.customProgramCacheKey = () => 'hand-nails';
  return m;
}

// The two looks: real skin (its picture is fetched only for this look), and the character's soft white.
export function handMaterial(look, { skinUrl = 'assets/hand/skin.webp', prepare = m => m } = {}) {
  const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  if (look === 'skin') {
    const map = new THREE.TextureLoader().load(skinUrl);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return prepare(withNails(new THREE.MeshPhysicalMaterial({ name: 'M_HandSkin', map, roughness: 0.56, metalness: 0, sheen: 0.35, sheenRoughness: 0.55, sheenColor: lin(0.9, 0.55, 0.45) }), 0.3));
  }
  // The character's own soft white (as M_Toy on the range's hands).
  return prepare(withNails(new THREE.MeshStandardMaterial({ name: 'M_HandToy', color: lin(0.83, 0.82, 0.79), roughness: 0.5, metalness: 0 }), 0.3));
}

// The hoodie's sleeve over the forearm, along the arm bone (x toward the elbow): a ribbed cuff that starts two
// centimetres up from the wrist, then the loose knit, both oval like the forearm and centred a little toward the palm.
function sleeveGeometry(rib) {
  const rings = [], R = 26, cy = -0.005;
  const ring = (x, rz, ry) => rings.push({ x, rz, ry });
  if (rib) {
    ring(0.019, 0.026, 0.023);
    for (let i = 0; i <= 8; i++) { const u = i / 8; ring(0.02 + 0.055 * u, 0.031 + 0.0012 * Math.sin(Math.PI * u), 0.0285 + 0.0012 * Math.sin(Math.PI * u)); }
  } else {
    for (let i = 0; i <= 14; i++) { const u = i / 14; ring(0.07 + 0.28 * u, 0.0335 + 0.016 * u ** 0.8, 0.031 + 0.014 * u ** 0.8); }
  }
  const pos = [], uv = [], idx = [];
  rings.forEach((r, i) => {
    for (let k = 0; k <= R; k++) {
      const a = 2 * Math.PI * k / R, f = rib ? 1 : 1 + 0.03 * Math.sin(i * 0.9 + k * 0.45) * Math.sin(k * 0.3 + 1) * Math.min(1, i / 3);
      pos.push(r.x, cy + r.ry * f * Math.cos(a), r.rz * f * Math.sin(a));
      uv.push(k / R, i / (rings.length - 1));
    }
  });
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < R; k++) {
    const a = i * (R + 1) + k, b = a + 1, c = a + R + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function makeSleeve(mats) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(sleeveGeometry(true), mats.rib), new THREE.Mesh(sleeveGeometry(false), mats.cloth));
  g.name = 'sleeve';
  return g;
}

// One hand: its group, its bones in BONES' order, and pose(p, elbow) with both in the group's parent space.
export function makeRealHand(side, g, material) {
  const root = new THREE.Group();
  root.name = 'realhand_' + side;
  const bones = BONES.map(name => { const b = new THREE.Bone(); b.name = `${side}_${name}`; return b; });
  const parent = name => (name === 'hand' ? 'arm' : /0$|thumb1/.test(name) ? 'hand' : name.replace(/\d$/, n => String(+n - 1)));
  BONES.forEach((name, i) => { if (name === 'arm') root.add(bones[i]); else bones[BONES.indexOf(parent(name))].add(bones[i]); });
  const set = L => L.forEach((t, i) => { bones[i].position.set(...t.p); bones[i].quaternion.set(...t.q); });
  set(localsFor(side, rest(), side === 'left' ? [JOINTS.elbow[0], JOINTS.elbow[1], -JOINTS.elbow[2]] : JOINTS.elbow));
  root.updateMatrixWorld(true);
  const mesh = new THREE.SkinnedMesh(side === 'left' ? mirrored(g) : g, material);
  mesh.name = side + '_realhand';
  mesh.frustumCulled = false;
  root.add(mesh);
  mesh.bind(new THREE.Skeleton(bones));
  return {
    root, mesh, bones,
    pose(p, elbow = null) { set(localsFor(side, p, elbow)); },
    setMaterial(m) { mesh.material = m; },
  };
}

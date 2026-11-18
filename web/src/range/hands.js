import * as THREE from 'three';
import { HAND, DIGITS, boneTurns, baseOf, digitDef, digit, qFrame, qConj, qMul, qRot, sub, norm } from '../pure/hands.js';

// Built here, nothing to download: one skinned mesh for the hand and one for the sleeve, so a hand is a few draws.
const RADIAL = 14;

// A rounded rod along x from 0 to L, radius r0 at its start and r1 at its end, its ends closed by half balls.
function rodGeometry(r0, r1, L) {
  const rings = [];
  for (let i = 0; i <= 4; i++) { const t = Math.PI - (Math.PI / 2) * i / 4; rings.push([r0 * Math.cos(t), r0 * Math.sin(t), Math.cos(t), Math.sin(t)]); }
  const s = (r1 - r0) / L, n = Math.hypot(1, s);
  for (const u of [0.33, 0.66]) rings.push([L * u, r0 + (r1 - r0) * u, -s / n, 1 / n]);
  for (let i = 0; i <= 4; i++) { const t = (Math.PI / 2) * (1 - i / 4); rings.push([L + r1 * Math.cos(t), r1 * Math.sin(t), Math.cos(t), Math.sin(t)]); }
  return tube(rings, RADIAL);
}
// Rings of [x, radius, normal x, normal radius] swept round x.
function tube(rings, radial, bump) {
  const pos = [], nor = [], uv = [], idx = [];
  rings.forEach(([x, r, nx, nr], i) => {
    for (let k = 0; k < radial; k++) {
      const a = 2 * Math.PI * k / radial, c = Math.cos(a), s = Math.sin(a), rr = r * (bump ? bump(i, k) : 1);
      pos.push(x, rr * c, rr * s); nor.push(nx, nr * c, nr * s); uv.push(k / radial, i / (rings.length - 1));
    }
  });
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * radial + k, b = i * radial + (k + 1) % radial, c = a + radial, d = b + radial;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
// The palm: a soft-edged slab, narrower at the wrist.
function palmGeometry(side) {
  const { centre: c, half: h, wrist } = HAND.palm, s = side === 'left' ? -1 : 1;
  const g = new THREE.SphereGeometry(1, 28, 18), p = g.attributes.position;
  const pw = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    // The sphere's poles run along z (across the palm), so its seam stays on the palm's edge.
    const x = pw(p.getX(i), 0.42), y = pw(p.getY(i), 0.6), z = pw(p.getZ(i), 0.5);
    const along = (x + 1) / 2, taper = wrist + (1 - wrist) * Math.min(1, along * 1.4);
    // A little arch across the back of the hand.
    p.setXYZ(i, c[0] + x * h[0], c[1] + y * h[1] + 0.003 * (1 - z * z) * (y > 0 ? 1 : 0.4), s * (c[2] + z * h[2] * taper));
  }
  g.computeVertexNormals();
  return g;
}
// The sleeve along the arm bone's x (toward the elbow): a ribbed cuff, then loose cloth with soft folds.
function sleeveGeometry() {
  const cuff = [], cloth = [];
  for (let i = 0; i <= 6; i++) { const x = -0.012 + 0.056 * i / 6; cuff.push([x, 0.0262 + 0.0016 * Math.sin(Math.PI * i / 6), 0, 1]); }
  cuff.unshift([-0.0125, 0.02, -1, 0]);
  for (let i = 0; i <= 14; i++) { const x = 0.04 + 0.3 * i / 14, u = i / 14; cloth.push([x, 0.0305 + 0.019 * Math.pow(u, 0.8), 0, 1]); }
  const rib = tube(cuff, 28);
  const fold = tube(cloth, 28, (i, k) => 1 + 0.035 * Math.sin(i * 0.9 + k * 0.45) * Math.sin(k * 0.3 + 1.0) * Math.min(1, i / 3));
  rib.computeVertexNormals(); fold.computeVertexNormals();
  return [rib, fold];
}

// A skinned copy of a geometry, every point on one bone, placed by that bone's rest turn and place.
function onBone(g, bone, q, at) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion(...q), new THREE.Vector3(1, 1, 1));
  const out = g.clone().applyMatrix4(m), n = out.attributes.position.count;
  out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? bone : 0)), 4));
  out.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  return out;
}
function merge(parts) {
  let n = 0, m = 0;
  for (const g of parts) { n += g.attributes.position.count; m += g.index.count; }
  const out = new THREE.BufferGeometry(), idx = new Uint32Array(m);
  for (const name of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) {
    const size = parts[0].attributes[name].itemSize, Arr = name === 'skinIndex' ? Uint16Array : Float32Array, a = new Arr(n * size);
    let o = 0;
    for (const g of parts) { a.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, name === 'skinIndex' ? new THREE.Uint16BufferAttribute(a, size) : new THREE.Float32BufferAttribute(a, size));
  }
  let vo = 0, io = 0;
  for (const g of parts) { const s = g.index.array; for (let i = 0; i < s.length; i++) idx[io + i] = s[i] + vo; io += s.length; vo += g.attributes.position.count; }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// A knit's surface for the sleeve and ribs for the cuff, drawn here: a little picture whose slopes are the normals.
function knitNormal(rib) {
  const N = 64, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  const h = (x, y) => rib ? Math.sin(x / N * Math.PI * 2 * 8) : Math.sin(x / N * Math.PI * 2 * 12) * 0.5 + Math.abs(Math.sin((y / N + 0.5 * Math.abs(Math.sin(x / N * Math.PI * 12))) * Math.PI * 16)) * 0.7;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), k = rib ? 0.9 : 0.6, l = Math.hypot(dx * k, dy * k, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx * k / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy * k / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rib ? 3 : 4, rib ? 1 : 6);
  return t;
}

export function makeHandMaterials(prepare = m => m) {
  const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  return {
    skin: prepare(new THREE.MeshStandardMaterial({ name: 'M_Toy', color: lin(0.83, 0.82, 0.79), roughness: 0.5, metalness: 0 })),
    cloth: prepare(new THREE.MeshStandardMaterial({ name: 'M_Hoodie', color: lin(0.04, 0.055, 0.11), roughness: 0.9, metalness: 0, normalMap: knitNormal(false), normalScale: new THREE.Vector2(0.35, 0.35) })),
    rib: prepare(new THREE.MeshStandardMaterial({ name: 'M_Hoodie_Rib', color: lin(0.035, 0.05, 0.1), roughness: 0.92, metalness: 0, normalMap: knitNormal(true), normalScale: new THREE.Vector2(0.8, 0.8) })),
  };
}

// One hand: its group, its bones, and pose(p, elbow), both given in the group's parent space.
export function makeHand(side, mats) {
  const root = new THREE.Group();
  root.name = 'hand_' + side;
  const arm = new THREE.Bone(), hand = new THREE.Bone(), bones = [arm, hand], at = {};
  arm.name = side + '_arm'; hand.name = side + '_hand';
  arm.add(hand);
  const parts = [onBone(palmGeometry(side), 1, [0, 0, 0, 1], [0, 0, 0])];
  const wrist = rodGeometry(0.0205, 0.0215, 0.045);
  wrist.scale(1, 0.82, 1);
  parts.push(onBone(wrist, 1, [0, 0, 0, 1], [-0.028, -0.001, 0]));
  for (const d of DIGITS) {
    const def = digitDef(d), rest = digit(side, d, [0, 0, 0, 0]), turns = boneTurns(side, d, [0, 0, 0, 0]);
    let parent = hand;
    for (let b = 0; b < 3; b++) {
      const bone = new THREE.Bone();
      bone.name = `${side}_${d}${b + 1}`;
      if (b === 0) bone.position.set(...baseOf(side, d)); else bone.position.set(def.len[b - 1], 0, 0);
      bone.quaternion.set(...turns[b]);
      parent.add(bone); parent = bone;
      at[`${d}${b + 1}`] = bone;
      bones.push(bone);
      parts.push(onBone(rodGeometry(def.r[b], def.r[b + 1], def.len[b]), bones.length - 1, rest.turns[b], rest.pts[b]));
    }
  }
  const skeleton = new THREE.Skeleton(bones);
  root.add(arm);
  root.updateMatrixWorld(true);
  const handMesh = new THREE.SkinnedMesh(merge(parts), mats.skin);
  const [ribG, foldG] = sleeveGeometry();
  const sleeve = new THREE.SkinnedMesh(merge([onBone(ribG, 0, [0, 0, 0, 1], [0, 0, 0]), onBone(foldG, 0, [0, 0, 0, 1], [0, 0, 0])]), [mats.rib, mats.cloth]);
  sleeve.geometry.addGroup(0, ribG.index.count, 0); sleeve.geometry.addGroup(ribG.index.count, foldG.index.count, 1);
  for (const m of [handMesh, sleeve]) { m.frustumCulled = false; root.add(m); m.bind(skeleton); }
  handMesh.name = side + '_hand_skin'; sleeve.name = side + '_sleeve';
  return {
    root, bones, meshes: [handMesh, sleeve],
    // p: { at, q, digits } in the root's space; elbow: where the forearm goes back to, in that space.
    pose(p, elbow) {
      // The forearm points at the elbow, its seam kept on the side the back of the hand faces.
      const qArm = qFrame(norm(sub(elbow, p.at)), qRot(p.q, [0, 1, 0]));
      arm.position.set(...p.at); arm.quaternion.set(...qArm);
      hand.quaternion.set(...qMul(qConj(qArm), p.q));
      for (const d of DIGITS) {
        const t = boneTurns(side, d, p.digits[d]);
        for (let b = 0; b < 3; b++) at[`${d}${b + 1}`].quaternion.set(...t[b]);
      }
    },
  };
}

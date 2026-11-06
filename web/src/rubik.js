import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { solvedCube, turn, inLayer, scramble, solution } from './pure/rubik.js';

// The Rubik's cube on the desk scrambles itself, has a think, then solves itself a layer at a time. It is drawn as two
// meshes, the layer turning and the rest, rebuilt between moves, and it only moves while you are near enough to see it.
const STICKER = { '0,1': 0xc41e3a, '0,-1': 0xff5800, '1,1': 0xf4f4f0, '1,-1': 0xffd500, '2,1': 0x009e60, '2,-1': 0x0051ba };
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const LIGHT = new THREE.Vector3(-0.4, 0.85, 0.35).normalize();

function piece(home, step) {
  const parts = [];
  const tint = (g, hex) => {
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('base', new THREE.BufferAttribute(a, 3));
    g.setAttribute('color', new THREE.BufferAttribute(a.slice(), 3));
    g.deleteAttribute('uv');
    return g;
  };
  parts.push(tint(new THREE.BoxGeometry(step * 0.97, step * 0.97, step * 0.97).toNonIndexed(), 0x121214));
  home.forEach((v, axis) => {
    if (!v) return;
    const g = new THREE.PlaneGeometry(step * 0.8, step * 0.8).toNonIndexed();
    // The plane faces +z; turn it to face out along this axis.
    if (axis === 0) g.rotateY(v * Math.PI / 2);
    if (axis === 1) g.rotateX(-v * Math.PI / 2);
    if (axis === 2 && v < 0) g.rotateY(Math.PI);
    const off = [0, 0, 0]; off[axis] = v * step * 0.487;
    g.translate(...off);
    parts.push(tint(g, STICKER[`${axis},${v}`]));
  });
  return mergeGeometries(parts);
}

export function makeRubik(scene, at, { size = 0.057, yaw = 0.35 } = {}) {
  const step = size / 3, pieces = solvedCube(), base = new Map();
  for (const p of pieces) base.set(p, piece(p.home, step));
  const group = new THREE.Group();
  group.position.copy(at).add(new THREE.Vector3(0, size / 2, 0));
  group.rotation.y = yaw;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  const rest = new THREE.Mesh(new THREE.BufferGeometry(), mat), turning = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  rest.name = 'rubik'; turning.name = 'rubik_layer';
  group.add(rest, turning);
  scene.add(group);

  const m4 = new THREE.Matrix4(), n = new THREE.Vector3();
  function placed(p) {
    const t = p.turn;
    m4.set(t[0], t[1], t[2], p.at[0] * step, t[3], t[4], t[5], p.at[1] * step, t[6], t[7], t[8], p.at[2] * step, 0, 0, 0, 1);
    const g = base.get(p).clone().applyMatrix4(m4);
    // Shade each face by where it points now, so the cube reads as solid with only flat colours.
    const nor = g.attributes.normal, b = g.attributes.base, c = g.attributes.color;
    for (let i = 0; i < nor.count; i++) {
      n.fromBufferAttribute(nor, i).applyAxisAngle(AXES[1], yaw);
      const k = 0.55 + 0.45 * Math.max(0, n.dot(LIGHT));
      c.setXYZ(i, b.getX(i) * k, b.getY(i) * k, b.getZ(i) * k);
    }
    return g;
  }
  function rebuild(move) {
    const a = [], b = [];
    for (const p of pieces) (move && inLayer(p, move) ? b : a).push(placed(p));
    for (const [mesh, list] of [[rest, a], [turning, b]]) {
      mesh.geometry.dispose();
      mesh.geometry = list.length ? mergeGeometries(list) : new THREE.BufferGeometry();
      for (const g of list) g.dispose();
      mesh.visible = list.length > 0;
      mesh.rotation.set(0, 0, 0);
    }
  }

  // It starts scrambled, so the first thing you see is it solving.
  let queue = scramble(20);
  for (const m of queue) turn(pieces, m);
  queue = solution(queue);
  let phase = 'solve', move = null, k = 0, wait = 1.5, scrambled = [];
  rebuild(null);
  const SPEED = { solve: 0.34, scramble: 0.13 };

  return {
    group,
    get phase() { return phase; },
    tick(dt, cam) {
      if (cam.distanceToSquared(group.position) > 36) return;
      if (wait > 0) { wait -= dt; return; }
      if (!move) {
        if (!queue.length) {
          if (phase === 'solve') { phase = 'rest'; wait = 5; return; }
          if (phase === 'rest') { phase = 'scramble'; queue = scramble(20); scrambled = []; return; }
          // Scrambled: a moment to look at it, then solve it the way it came.
          phase = 'solve'; queue = solution(scrambled); wait = 1.2; return;
        }
        move = queue.shift();
        if (phase === 'scramble') scrambled.push(move);
        k = 0;
        rebuild(move);
      }
      k = Math.min(1, k + dt / SPEED[phase]);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      turning.rotation.set(0, 0, 0);
      turning.rotateOnAxis(AXES[move.axis], move.dir * e * Math.PI / 2);
      if (k >= 1) {
        turn(pieces, move);
        move = null;
        if (phase === 'solve') wait = 0.08 + Math.random() * 0.25;
        if (!queue.length) rebuild(null);
      }
    },
  };
}

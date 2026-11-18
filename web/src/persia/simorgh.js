import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, plain, paperMaterial, toShape, ellipse, ribbon, leaf, scallops, curve, bounds } from './kit.js';

// In the wall's own frame: u runs north along it, v is height, each of the five layers further off the wall.
const C = {
  indigo: '#2b3b7c', lapis: '#22306a', teal: '#2f9a93', jade: '#1f6f6b', saffron: '#e7a83e', gold: '#f2c96b',
  vermilion: '#c64a30', rose: '#dc8a74', cream: '#f3e6c6', ink: '#1b1a28', edge: '#efe5cf',
};
const DEPTH = [0.03, 0.06, 0.09, 0.12, 0.15], PAPER = 0.004;

function layers() {
  const L = [[], [], [], [], []];
  const put = (i, pts, color) => L[i].push({ pts, color });

  // ---------- the far wing, behind everything ----------
  const farTips = Array.from({ length: 7 }, (_, i) => { const a = (88 - i * 9) * Math.PI / 180; return [5.6 + Math.cos(a) * 0.62, 5.42 + Math.sin(a) * 0.66]; });
  farTips.forEach((tip, i) => put(0, leaf([5.55 + i * 0.05, 5.42 - i * 0.005], tip, 0.13, { bend: -0.04 }), i % 2 ? C.lapis : C.indigo));
  put(1, scallops([5.5, 5.55], [5.9, 5.78], 4, 0.06, { band: 0.1 }), C.jade);

  // ---------- the tail: long plumes down the stairs, each ending in an eye ----------
  const plumes = [
    { layer: 0, color: C.indigo, w: [0.13, 0.05], spine: [[6.3, 5.16], [6.8, 5.02], [7.3, 4.74], [7.8, 4.46], [8.3, 4.36], [8.72, 4.5]] },
    { layer: 0, color: C.lapis, w: [0.1, 0.04], spine: [[6.3, 5.24], [6.8, 5.36], [7.25, 5.42], [7.7, 5.54]] },
    { layer: 1, color: C.teal, w: [0.12, 0.05], spine: [[6.3, 5.12], [6.85, 4.88], [7.35, 4.5], [7.85, 4.16], [8.3, 4.02], [8.55, 4.06]] },
    { layer: 1, color: C.vermilion, w: [0.09, 0.04], spine: [[6.3, 5.1], [6.75, 4.78], [7.05, 4.42], [7.22, 4.06], [7.28, 3.93]] },
    { layer: 2, color: C.saffron, w: [0.1, 0.04], spine: [[6.3, 5.2], [6.85, 5.2], [7.4, 5.06], [7.9, 4.96], [8.4, 5.02], [8.7, 5.16]] },
  ];
  for (const p of plumes) {
    put(p.layer, ribbon(p.spine, p.w[0], p.w[1], { n: 28, round: true }), p.color);
    // Barbs along both edges, swept back, every so often.
    const line = curve(p.spine, 18);
    for (let i = 3; i < line.length - 2; i += 2) {
      const [u, v] = line[i], [u2, v2] = line[i + 1], du = u2 - u, dv = v2 - v, l = Math.hypot(du, dv), nu = -dv / l, nv = du / l;
      for (const s of [1, -1]) put(p.layer, leaf([u, v], [u + du * 1.6 + nu * s * 0.12, v + dv * 1.6 + nv * s * 0.12], 0.035, { n: 5 }), p.color);
    }
    const end = p.spine.at(-1), prev = p.spine.at(-2), a = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
    const eye = r => ellipse([end[0] + Math.cos(a) * r * 0.4, end[1] + Math.sin(a) * r * 0.4], r * 1.35, r, a, 16);
    put(Math.min(4, p.layer + 1), eye(0.085), C.gold);
    put(Math.min(4, p.layer + 2), eye(0.055), C.vermilion);
    put(Math.min(4, p.layer + 3), eye(0.028), C.lapis);
  }

  // ---------- the body, neck and head ----------
  const body = curve([[4.78, 5.69], [4.92, 5.8], [5.05, 5.845], [5.17, 5.8], [5.25, 5.66], [5.37, 5.52], [5.62, 5.46], [5.98, 5.42], [6.3, 5.3], [6.44, 5.2],
    [6.38, 5.08], [6.05, 5.01], [5.72, 5.03], [5.45, 5.13], [5.25, 5.34], [5.11, 5.52], [4.99, 5.62], [4.85, 5.64], [4.78, 5.69]], 70);
  put(1, body, C.teal);
  // Breast scallops in cream, neck scallops in gold.
  put(2, scallops([5.2, 5.38], [5.62, 5.08], 5, 0.045, { band: 0.08 }), C.cream);
  put(2, scallops([5.12, 5.62], [5.3, 5.42], 3, 0.035, { band: 0.06 }), C.gold);
  put(2, scallops([5.45, 5.23], [5.95, 5.06], 5, 0.035, { band: 0.06 }), C.rose);
  // The hooked beak, the wattle, the crest, the eye.
  put(2, curve([[4.98, 5.73], [4.87, 5.745], [4.775, 5.71], [4.745, 5.655], [4.79, 5.675], [4.86, 5.67], [4.97, 5.67], [4.98, 5.73]], 30), C.gold);
  put(2, leaf([4.98, 5.64], [4.97, 5.5], 0.07, { bend: 0.15 }), C.vermilion);
  for (const [k, spine] of [[0, [[5.04, 5.83], [5.06, 5.97], [5.16, 6.06], [5.26, 6.04]]], [1, [[5.09, 5.82], [5.16, 5.93], [5.27, 5.98], [5.35, 5.93]]], [2, [[5.13, 5.8], [5.23, 5.86], [5.33, 5.86], [5.39, 5.8]]]]) {
    put(2, ribbon(spine, 0.045, 0.018, { n: 18, round: true }), k === 1 ? C.vermilion : C.saffron);
    const e = spine.at(-1);
    put(3, ellipse(e, 0.03, 0.022, 0.4, 14), C.gold);
  }
  put(3, ellipse([5.03, 5.752], 0.026, 0.022, 0.1, 18), C.cream);
  put(4, ellipse([5.025, 5.752], 0.013, 0.013, 0, 12), C.ink);
  put(3, ribbon([[5.05, 5.756], [5.1, 5.768], [5.16, 5.79]], 0.012, 0.004, { n: 8 }), C.ink);

  // ---------- the near wing: saffron flight feathers fanned up and back, red and cream coverts over their roots ----------
  for (let i = 0; i < 9; i++) {
    const a = (84 - i * 8.6) * Math.PI / 180, tip = [5.95 + Math.cos(a) * 0.86, 5.43 + Math.sin(a) * 0.64];
    const base = [5.78 + i * 0.06, 5.5 - i * 0.012];
    put(2, leaf(base, tip, 0.15, { bend: -0.05 }), i % 2 ? C.gold : C.saffron);
    put(3, leaf([base[0] + (tip[0] - base[0]) * 0.2, base[1] + (tip[1] - base[1]) * 0.2], [base[0] + (tip[0] - base[0]) * 0.9, base[1] + (tip[1] - base[1]) * 0.9], 0.012), C.vermilion);
  }
  put(3, [...curve([[5.6, 5.42], [5.64, 5.62], [5.78, 5.8], [5.98, 5.9]], 14), ...scallops([5.98, 5.9], [6.5, 5.44], 6, 0.07).slice(1), [6.2, 5.36], [5.85, 5.38]], C.vermilion);
  put(4, [...curve([[5.62, 5.44], [5.67, 5.6], [5.78, 5.72]], 8), ...scallops([5.78, 5.72], [6.12, 5.45], 4, 0.05).slice(1), [5.85, 5.4]], C.cream);
  put(4, ribbon([[5.6, 5.44], [5.65, 5.63], [5.8, 5.81], [6.0, 5.915]], 0.03, 0.012, { n: 16 }), C.gold);
  return L;
}

// Pale cut edges and a faint shadow on the layer behind are what make flat card read as layered paper.
export function makeSimorgh(place) {
  const x0 = place.wall, [z0, z1] = place.z;
  const m = new THREE.Matrix4(), paper = [], shade = [];
  const light = (n, p) => {
    const up = THREE.MathUtils.clamp((p.y - z0) / (z1 - z0), 0, 1);
    return Math.abs(n.x) > 0.5 ? 0.66 + 0.3 * up : 0.7 + 0.3 * Math.max(0, n.y) - 0.25 * Math.max(0, -n.y);
  };
  const L = layers();
  L.forEach((list, i) => {
    const d = x0 + DEPTH[i];
    m.set(0, 0, 1, d, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);
    for (const { pts, color } of list) {
      const g = plain(new THREE.ExtrudeGeometry(toShape(pts), { depth: PAPER, bevelEnabled: false, curveSegments: 4 }));
      g.applyMatrix4(m);
      const face = new THREE.Color(color), edge = new THREE.Color(C.edge);
      paint(g, n => (Math.abs(n.x) > 0.5 ? face : edge), light);
      paper.push(g);
      if (i) {
        const s = plain(new THREE.ShapeGeometry(toShape(pts.map(([u, v]) => [u + 0.008, v - 0.014])), 3));
        m.set(0, 0, 1, x0 + DEPTH[i - 1] + PAPER + 0.003, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);
        s.applyMatrix4(m);
        shade.push(s);
        m.set(0, 0, 1, d, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);
      }
    }
  });
  const group = new THREE.Group();
  group.name = 'simorgh';
  const mesh = new THREE.Mesh(mergeGeometries(paper), paperMaterial());
  const shadows = new THREE.Mesh(mergeGeometries(shade), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }));
  paper.forEach(g => g.dispose()); shade.forEach(g => g.dispose());
  group.add(mesh, shadows, wallShadow(L, x0));
  group.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  return { group, mesh, triangles: mesh.geometry.attributes.position.count / 3 };
}

// The whole bird's soft shadow on the wall behind it: painted small, so stretching it over the wall softens it.
function wallShadow(L, x0) {
  const all = L.flat().map(p => p.pts), b = bounds(...all), pad = 0.25;
  const u0 = b.u0 - pad, v0 = b.v0 - pad, w = b.u1 - b.u0 + pad * 2, h = b.v1 - b.v0 + pad * 2;
  const c = document.createElement('canvas');
  c.width = 96; c.height = Math.round(96 * h / w);
  const g = c.getContext('2d'), sx = c.width / w, sy = c.height / h;
  g.fillStyle = '#000';
  for (const pts of all) { g.beginPath(); pts.forEach(([u, v], i) => { const X = (u - u0 + 0.05) * sx, Y = (v0 + h - v + 0.09) * sy; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.32, depthWrite: false, color: 0x000000 }));
  plane.position.set(x0 + 0.004, v0 + h / 2, -(u0 + w / 2));
  plane.rotation.y = Math.PI / 2;
  return plane;
}

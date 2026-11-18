import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The house's light is baked, so these pieces carry theirs in their vertex colours, like the printer's prints and the
// cube: one plain material for all of them, one mesh per piece.
let shared = null;
export function paperMaterial() {
  shared ||= new THREE.MeshBasicMaterial({ vertexColors: true });
  return shared;
}

const L = new THREE.Vector3(0.3, 1, 0.45).normalize();
// A soft light from above and a little from the room; with `floor`, a contact shadow within `reach` above it.
export function soft(n, p, o = {}) {
  const sky = 0.5 + 0.5 * n.y, key = Math.max(0, n.dot(o.light || L));
  let k = (o.ambient ?? 0.5) + (o.sky ?? 0.26) * sky + (o.key ?? 0.2) * key;
  if (o.floor !== undefined) k *= 1 - (o.ao ?? 0.25) * Math.max(0, 1 - (p.y - o.floor) / (o.reach ?? 0.12));
  return k;
}

// Paints every vertex of a (non-indexed) geometry: `color` (sRGB hex or a function of normal and position) times the
// light at that vertex.
const _n = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
export function paint(geo, color, light = soft, o = {}) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count, out = new Float32Array(n * 3);
  const base = typeof color === 'function' ? null : new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    _n.fromBufferAttribute(nor, i); _p.fromBufferAttribute(pos, i);
    const c = base || _c.set(color(_n, _p));
    const k = light(_n, _p, o);
    out[i * 3] = c.r * k; out[i * 3 + 1] = c.g * k; out[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return geo;
}

// Every part the same shape of data (positions, normals, colours; no index, no uv), so they merge into one.
export function plain(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  g.clearGroups();
  return g;
}

// A builder for one piece: parts are placed with a matrix, painted, and merged into one mesh at the end.
export function makeKit(defaults = {}) {
  const parts = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), t = new THREE.Vector3();
  function add(geo, color, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], light, ...o } = {}) {
    const g = plain(geo);
    m4.compose(t.set(...at), q.setFromEuler(e.set(...rot)), s.set(...(typeof scale === 'number' ? [scale, scale, scale] : scale)));
    g.applyMatrix4(m4);
    paint(g, color, light || defaults.light || soft, { ...defaults, ...o });
    parts.push(g);
    return g;
  }
  return {
    add,
    box: (w, h, d, color, o) => add(new THREE.BoxGeometry(w, h, d), color, o),
    cyl: (r0, r1, h, color, o = {}) => add(new THREE.CylinderGeometry(r0, r1, h, o.seg || 16, 1, !!o.open), color, o),
    ball: (r, color, o = {}) => add(new THREE.SphereGeometry(r, o.seg || 12, o.rings || 8), color, o),
    lathe: (pts, color, o = {}) => add(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), o.seg || 20), color, o),
    geometry() { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); parts.length = 0; return g; },
    mesh(material = paperMaterial()) { const m = new THREE.Mesh(this.geometry(), material); m.matrixAutoUpdate = false; return m; },
  };
}

// ---------- flat shapes, in a plane's own (u, v) ----------
export const toShape = pts => { const s = new THREE.Shape(); pts.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v))); s.closePath(); return s; };
export function ellipse([cu, cv], ru, rv, rot = 0, n = 24) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * ru, y = Math.sin(a) * rv; return [cu + x * c - y * s, cv + x * s + y * c]; });
}
// A smooth curve through the points (Catmull-Rom), as `n` points.
export function curve(pts, n = 24) {
  const c = new THREE.CatmullRomCurve3(pts.map(([u, v]) => new THREE.Vector3(u, v, 0)), false, 'centripetal');
  return c.getPoints(n - 1).map(p => [p.x, p.y]);
}
// A ribbon along a curve, `w` wide at each end (a function of 0..1 for more), its ends pointed or round.
export function ribbon(spine, w0, w1 = w0, { n = 28, round = false } = {}) {
  const pts = curve(spine, n), left = [], right = [];
  const width = typeof w0 === 'function' ? w0 : t => w0 + (w1 - w0) * t;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv) || 1;
    const w = width(i / (pts.length - 1)) / 2, nu = -dv / l * w, nv = du / l * w;
    left.push([pts[i][0] + nu, pts[i][1] + nv]); right.push([pts[i][0] - nu, pts[i][1] - nv]);
  }
  const end = [];
  if (round) {
    const p = pts.at(-1), q = pts.at(-2), a0 = Math.atan2(p[1] - q[1], p[0] - q[0]), w = width(1) / 2;
    for (let k = 1; k < 8; k++) { const a = a0 + Math.PI / 2 - (k / 8) * Math.PI; end.push([p[0] + Math.cos(a) * w, p[1] + Math.sin(a) * w]); }
  }
  return [...left, ...end, ...right.reverse()];
}
// A feather or leaf from base to tip: `w` at its widest, `bend` sideways at its middle (a share of its length).
export function leaf([u0, v0], [u1, v1], w, { bend = 0, at = 0.4, n = 14, base = 0.25 } = {}) {
  const du = u1 - u0, dv = v1 - v0, l = Math.hypot(du, dv), tu = du / l, tv = dv / l, nu = -tv, nv = tu;
  const side = s => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, sh = t < at ? base + (1 - base) * Math.sin((t / at) * Math.PI / 2) : Math.cos(((t - at) / (1 - at)) * Math.PI / 2) ** 0.8;
    const off = s * sh * w / 2 + bend * l * Math.sin(t * Math.PI);
    return [u0 + du * t + nu * off, v0 + dv * t + nv * off];
  });
  return [...side(1), ...side(-1).reverse().slice(1, -1)];
}
// A row of scallops (rounded feather ends) along a line, bulging to its left.
export function scallops([u0, v0], [u1, v1], count, depth, { n = 6, band = 0 } = {}) {
  const du = (u1 - u0) / count, dv = (v1 - v0) / count, l = Math.hypot(du, dv), nu = -dv / l, nv = du / l, out = [];
  for (let i = 0; i < count; i++) for (let k = 0; k <= n; k++) {
    if (i && !k) continue;
    const t = k / n, bulge = Math.sin(t * Math.PI) * depth;
    out.push([u0 + du * (i + t) + nu * bulge, v0 + dv * (i + t) + nv * bulge]);
  }
  if (band) out.push([u1 - nu * band, v1 - nv * band], [u0 - nu * band, v0 - nv * band]);
  return out;
}
// The bounding box of some point lists.
export function bounds(...lists) {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const l of lists) for (const [u, v] of l) { u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v); }
  return { u0, v0, u1, v1 };
}

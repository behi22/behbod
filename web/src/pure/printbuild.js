// A generator, so a build can be spread over frames where there is no worker.
import { meshSdf } from './mesher.js';
import { rod, blend } from './sdf.js';
import { MODEL } from './models.js';
import { keychain } from './keychain.js';

const { PI, sin, cos, hypot, max, min, round, abs } = Math;
// Centimetres. Models are drawn a little small and printed GROW times over, so they fill the 30 cm bed.
export const REACH = 12, TALLEST = 20, GROW = 1.25;
const KEY = (() => { const v = [-0.5, 0.75, 0.62], l = hypot(...v); return v.map(c => c / l); })();

// Cones on a rough mesh's surface, spread evenly and none pointing into the bed, for models with nothing to sharpen.
function* spiky(f, bounds, lip, depth, count) {
  const rough = yield* meshSdf(f, bounds, { points: 14000, lip });
  const [x0, y0, z0, x1, y1, z1] = bounds, size = max(x1 - x0, y1 - y0, z1 - z0), L = depth * size * 0.3, r = 0.25 + L * 0.3;
  const P = rough.pos, N = rough.normal, n = P.length / 3, ok = [];
  for (let i = 0; i < n; i++) if (N[i * 3 + 1] > -0.3 && P[i * 3 + 1] > y0 + r * 2) ok.push(i);
  const far = new Float64Array(ok.length).fill(Infinity), picks = [];
  let next = ok.reduce((a, i, k) => (P[i * 3 + 1] > P[ok[a] * 3 + 1] ? k : a), 0);
  for (let s = 0; s < count && ok.length; s++) {
    const i = ok[next];
    picks.push(i);
    let best = 0;
    for (let k = 0; k < ok.length; k++) {
      const j = ok[k], d = (P[j * 3] - P[i * 3]) ** 2 + (P[j * 3 + 1] - P[i * 3 + 1]) ** 2 + (P[j * 3 + 2] - P[i * 3 + 2]) ** 2;
      if (d < far[k]) far[k] = d;
      if (far[k] > far[best]) best = k;
    }
    next = best;
  }
  const cones = picks.map(i => {
    const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], d = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
    return rod(p.map((v, k) => v - d[k] * r), p.map((v, k) => v + d[k] * L), r, 0.04);
  });
  const all = (x, y, z) => { let d = Infinity; for (const c of cones) { const e = c(x, y, z); if (e < d) d = e; } return d; };
  return { f: blend(r * 0.8, f, all), grow: L + r };
}

function shapeOf(p, field) {
  if (p.model === 'word') {
    const s = keychain(field);
    return { ...s, own: false };
  }
  const m = MODEL[p.model];
  const sides = m.sides ? p.sides : 8;
  const s = m.make({ sides, depth: m.spiky ? p.depth : 0 });
  return { ...s, own: !!m.spiky };
}

export function* buildPrint(p, { field = null, points = 240000, layerMm = 3 } = {}) {
  let { f, bounds, lip, own } = shapeOf(p, field);
  // Spikes enlarge the box but keep the model's own grid step, or it would come out softer.
  const cell = Math.cbrt((bounds[3] - bounds[0]) * (bounds[4] - bounds[1]) * (bounds[5] - bounds[2]) / points);
  if (!own && p.depth > 0.001) {
    const s = yield* spiky(f, bounds, lip, p.depth, 2 * (MODEL[p.model]?.sides ? 8 : p.sides));
    f = s.f;
    bounds = [bounds[0] - s.grow, bounds[1], bounds[2] - s.grow, bounds[3] + s.grow, bounds[4] + s.grow, bounds[5] + s.grow];
  }
  const m = yield* meshSdf(f, bounds, { points, lip, cell });
  const n = m.pos.length / 3, P = m.pos, N = m.normal;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H0 = Math.max(1e-6, y1 - y0);
  const sw = GROW * p.size * p.width, sh = GROW * p.size * p.height;
  // The old ring shapes' settings (taller, wider, curvy, twist) work on any model.
  const bend = (x, y, z, out) => {
    const t = (y - y0) / H0, k = (1 + p.bulge * sin(PI * t)) * (1 - p.taper * t), a = p.twist * PI * t, c = cos(a), s = sin(a);
    const px = (x - cx) * sw * k, pz = (z - cz) * sw * k;
    out[0] = px * c - pz * s; out[1] = (y - y0) * sh; out[2] = px * s + pz * c;
  };
  const Q = new Float32Array(n * 3), o = [0, 0, 0];
  let reach = 0, top = 0;
  for (let i = 0; i < n; i++) {
    bend(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], o);
    Q[i * 3] = o[0]; Q[i * 3 + 1] = o[1]; Q[i * 3 + 2] = o[2];
    reach = max(reach, hypot(o[0], o[2])); top = max(top, o[1]);
  }
  yield 0;
  const fit = min(1, REACH / reach, TALLEST / top) * 0.01;
  // Normals turned by the inverse of the stretch, or a stretched print would be lit wrongly.
  const shade = new Float32Array(n), uv = new Float32Array(n * 2), L = max(24, min(80, round((top * fit * 1000) / layerMm)));
  const layerH = (top * fit) / L, a = [0, 0, 0], b = [0, 0, 0], e = 0.02;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const J = [];
    for (const [dx, dy, dz] of [[e, 0, 0], [0, e, 0], [0, 0, e]]) {
      bend(x + dx, y + dy, z + dz, a); bend(x - dx, y - dy, z - dz, b);
      J.push([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
    }
    const [c0, c1, c2] = J, cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const r0 = cr(c1, c2), r1 = cr(c2, c0), r2 = cr(c0, c1), nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    let qx = nx * r0[0] + ny * r1[0] + nz * r2[0], qy = nx * r0[1] + ny * r1[1] + nz * r2[1], qz = nx * r0[2] + ny * r1[2] + nz * r2[2];
    const ql = hypot(qx, qy, qz) || 1;
    qx /= ql; qy /= ql; qz /= ql;
    const key = max(0, qx * KEY[0] + qy * KEY[1] + qz * KEY[2]), sky = 0.5 + 0.5 * qy, rim = (1 - abs(qz)) * max(0, qy + 0.3) * 0.08;
    const op = m.open[i];
    shade[i] = (0.2 + 0.62 * key + 0.24 * sky + rim) * (0.45 + 0.55 * op);
    Q[i * 3] *= fit; Q[i * 3 + 1] *= fit; Q[i * 3 + 2] *= fit;
    uv[i * 2 + 1] = Q[i * 3 + 1] / layerH / 2;
    if ((i & 1023) === 1023) yield 0;
  }
  const height = top * fit, radius = reach * fit;
  const path = yield* slice(Q, m.index, L, height);
  return { pos: Q, shade, uv, index: m.index, height, radius, layers: L, path };
}

export const PATH = 48;
export function* slice(Q, index, L, height) {
  const path = new Float32Array(L * PATH * 2), T = index.length / 3, nv = Q.length / 3;
  // Sorted by lowest point, so each layer looks only at the triangles that reach it.
  const lo = new Float32Array(T), hi = new Float32Array(T), order = new Uint32Array(T);
  for (let t = 0; t < T; t++) {
    const a = Q[index[t * 3] * 3 + 1], b = Q[index[t * 3 + 1] * 3 + 1], c = Q[index[t * 3 + 2] * 3 + 1];
    lo[t] = min(a, b, c); hi[t] = max(a, b, c); order[t] = t;
  }
  order.sort((p, q) => lo[p] - lo[q]);
  const active = [];
  let next = 0;
  for (let l = 0; l < L; l++) {
    const y = ((l + 0.5) / L) * height;
    while (next < T && lo[order[next]] <= y) active.push(order[next++]);
    for (let k = active.length - 1; k >= 0; k--) if (hi[active[k]] < y) { active[k] = active[active.length - 1]; active.pop(); }
    const at = new Map(), pts = [], links = [];
    const point = (i, j) => {
      const key = i < j ? i * nv + j : j * nv + i;
      let p = at.get(key);
      if (p === undefined) {
        const yi = Q[i * 3 + 1], yj = Q[j * 3 + 1], s = (y - yi) / (yj - yi);
        p = pts.length / 2;
        pts.push(Q[i * 3] + (Q[j * 3] - Q[i * 3]) * s, Q[i * 3 + 2] + (Q[j * 3 + 2] - Q[i * 3 + 2]) * s);
        links.push([]);
        at.set(key, p);
      }
      return p;
    };
    for (const t of active) {
      const v = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]], ends = [];
      for (let k = 0; k < 3; k++) {
        const i = v[k], j = v[(k + 1) % 3], yi = Q[i * 3 + 1], yj = Q[j * 3 + 1];
        if ((yi < y) !== (yj < y)) ends.push(point(i, j));
      }
      if (ends.length === 2) { links[ends[0]].push(ends[1]); links[ends[1]].push(ends[0]); }
    }
    const seen = new Uint8Array(pts.length / 2), loops = [];
    for (let s = 0; s < seen.length; s++) {
      if (seen[s]) continue;
      const loop = [];
      for (let c = s, prev = -1; c !== undefined && !seen[c];) {
        seen[c] = 1; loop.push(c);
        const nx = links[c].find(q => q !== prev && !seen[q]);
        prev = c; c = nx;
      }
      if (loop.length > 2) loops.push(loop);
    }
    const lens = loops.map(lp => { let s = 0; for (let k = 0; k < lp.length; k++) { const a = lp[k], b = lp[(k + 1) % lp.length]; s += hypot(pts[a * 2] - pts[b * 2], pts[a * 2 + 1] - pts[b * 2 + 1]); } return s; });
    const total = lens.reduce((s, v) => s + v, 0);
    let w = 0;
    for (let li = 0; li < loops.length && w < PATH; li++) {
      const lp = loops[li], want = li === loops.length - 1 ? PATH - w : max(2, round((PATH * lens[li]) / total));
      for (let k = 0; k < want && w < PATH; k++) {
        const g = lp[Math.floor((k / want) * lp.length)];
        path[(l * PATH + w) * 2] = pts[g * 2]; path[(l * PATH + w) * 2 + 1] = pts[g * 2 + 1]; w++;
      }
    }
    // A layer with nothing found (never in a closed model) keeps the nozzle in the middle.
    for (; w < PATH; w++) { path[(l * PATH + w) * 2] = w ? path[(l * PATH + w - 1) * 2] : 0; path[(l * PATH + w) * 2 + 1] = w ? path[(l * PATH + w - 1) * 2 + 1] : 0; }
    if (l & 1) yield 0;
  }
  return path;
}

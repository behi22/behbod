import { KEYS, DESK, U } from './typing.js';

// The desk keyboard's backlight as plain numbers, in the keyboard's own axes (x toward the monitor, y up, z right):
// a lit legend over each key and the glowing plate the keys stand on. kblegends.js turns them into meshes.
export const ROWS = 5;
const TEAL = [0.12, 0.95, 0.85], PURPLE = [0.62, 0.34, 1.0];
// The studio's teal on the left fading to purple on the right, times k.
export const colourAt = (z, k) => { const t = (z / (8 * U) + 1) / 2; return TEAL.map((a, i) => (a + (PURPLE[i] - a) * t) * k); };
// Every labelled key carries a lit legend except Escape, whose cap is the pomegranate.
export const LIT = KEYS.filter(k => k.label && k.id !== 'Escape');

function quads() {
  const g = { pos: [], uv: [], colour: [], key: [], index: [] };
  // Corners in the order (x0, z0), (x0, z1), (x1, z0), (x1, z1); both triangles wound to face up, seen from above.
  g.add = (x0, x1, z0, z1, y, [u0, u1, v0, v1], k, bright) => {
    const n = g.pos.length / 3;
    for (const [x, z, u, v] of [[x0, z0, u0, v0], [x0, z1, u1, v0], [x1, z0, u0, v1], [x1, z1, u1, v1]]) {
      g.pos.push(x, y, z); g.uv.push(u, v); g.key.push(k); g.colour.push(...colourAt(z, bright));
    }
    g.index.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
  };
  return g;
}

// The legends, just over each cap's top, each mapped to its cell in a 16 by ROWS atlas (a key wide per cell).
export function legendGeometry() {
  const g = quads();
  for (const k of LIT) {
    const u0 = (k.z - k.w / 2) / U + 8, u1 = (k.z + k.w / 2) / U + 8, v0 = (k.row + 0.5) / ROWS - k.d / U / 2 / ROWS, v1 = (k.row + 0.5) / ROWS + k.d / U / 2 / ROWS;
    g.add(k.x - k.d / 2, k.x + k.d / 2, k.z - k.w / 2, k.z + k.w / 2, DESK.key.top + 0.0003, [u0 / 16, u1 / 16, v0, v1], k.index, 1.25);
  }
  return g;
}

// The plate under the keys, on the case's top, seen glowing in the gaps between them.
export function plateGeometry() {
  const g = quads(), X = 2.5 * U, Z = 8 * U;
  g.add(-X, X, -Z, Z, DESK.case.at[1] + DESK.case.size[1] / 2 + 0.0002, [0, 1, 0, 1], -1, 0.7);
  return g;
}

// Each triangle's normal (not normalised), from its corners in index order.
export function normals({ pos, index }) {
  const P = i => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]], out = [];
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [P(index[t]), P(index[t + 1]), P(index[t + 2])], e = b.map((v, i) => v - a[i]), f = c.map((v, i) => v - a[i]);
    out.push([e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]]);
  }
  return out;
}

// Khatam, the Persian marquetry: six-pointed stars of tiny triangles of bone, brass and dyed wood, glued up in rods
// and sliced. Here a strip of it is laid out on a lattice of equilateral triangles of side `s`: one row of whole stars
// tip to tip down the middle, half stars along both edges, the little hexagons between them in dark wood, and a
// sawtooth border between brass lines on each side. Everything is in the strip's own units: x along it, y across it,
// 0 at its outer edge.

const R3 = Math.sqrt(3);
// Across the strip, in units of `s`: brass, sawtooth, brass, the stars (2 root 3), then the same again mirrored.
const EDGE = [0.16, 0.72, 0.14];
export const UNITS = 2 * R3 + 2 * EDGE.reduce((a, b) => a + b, 0);
export const sideOf = h => h / UNITS;
// The side for a strip drawn `k` canvas pixels to the unit: one repeat (6 sides) comes to a whole number of pixels, so
// the strip can be filled from one drawn repeat with no seam; its height then differs from `h` by under half a pixel.
export const tileSide = (h, k) => Math.max(1, Math.round(6 * sideOf(h) * k)) / (6 * k);

// Star centres sit on lattice points (i, j) with both even and j - i a multiple of 6, so stars touch tip to tip and
// leave a hexagon of six triangles between each three of them.
const isStar = (i, j) => i % 2 === 0 && j % 2 === 0 && (((j - i) % 6) + 6) % 6 === 0;
// Normals of the two big triangles whose overlap is the star: each points away from one tip.
const N1 = [270, 30, 150].map(d => [Math.cos(d * Math.PI / 180), Math.sin(d * Math.PI / 180)]);
const N2 = [90, 210, 330].map(d => [Math.cos(d * Math.PI / 180), Math.sin(d * Math.PI / 180)]);
const inside = (N, x, y, r) => N.every(([a, b]) => a * x + b * y <= r + 1e-9);

// Where a lattice triangle falls: the star's middle ('core'), one of its points ('tip'), or between stars ('gap').
// `u`, `v` are its centroid in lattice units (i + 1/3, j + 1/3 pointing up; i + 2/3, j + 2/3 pointing down).
export function role(u, v) {
  let best = null, bd = Infinity;
  for (let I = Math.floor(u) - 4; I <= Math.floor(u) + 4; I++) {
    for (let J = Math.floor(v) - 4; J <= Math.floor(v) + 4; J++) {
      if (!isStar(I, J)) continue;
      const x = (u - I) + (v - J) / 2, y = (v - J) * R3 / 2, d = x * x + y * y;
      if (d < bd) { bd = d; best = [x, y]; }
    }
  }
  const [x, y] = best, r = R3 / 2, a = inside(N1, x, y, r), b = inside(N2, x, y, r);
  return a && b ? 'core' : a || b ? 'tip' : 'gap';
}
// The pattern repeats every 6 steps along both lattice axes, so each triangle's role is looked up, not searched for.
const mod6 = n => ((n % 6) + 6) % 6;
const TABLE = Array.from({ length: 72 }, (_, k) => { const i = Math.floor(k / 12), j = Math.floor(k / 2) % 6, up = k % 2 === 0; return up ? role(i + 1 / 3, j + 1 / 3) : role(i + 2 / 3, j + 2 / 3); });
export const roleAt = (i, j, up) => TABLE[mod6(i) * 12 + mod6(j) * 2 + (up ? 0 : 1)];

// The wood and metal each piece is cut from.
export const KHATAM = { bone: '#ece2c8', brass: '#c9a24e', green: '#2f6a4c', ebony: '#1b120c', rose: '#6e2a1c', walnut: '#3c2416' };
const PAINT = { core: ['green', 'brass'], tip: ['bone', 'bone'], gap: ['ebony', 'walnut'] };

// A strip `len` long and `h` across. The middle star of the row sits halfway along, so a bar reads as centred.
// Returns the side `s`, the brass lines as bands across the strip, and every triangle with its material.
export function khatamStrip(len, h) {
  const s = sideOf(h), th = s * R3 / 2, mid = h / 2, x0 = len / 2;
  const bands = [], tris = [];
  let y = 0;
  const saw = (ya, yb, inward) => {
    // A row of triangles one lattice step wide, bone points facing the stars, dark wood between.
    const k0 = Math.floor(-x0 / s) - 1, k1 = Math.ceil((len - x0) / s) + 1, out = inward ? ya : yb, inn = inward ? yb : ya;
    for (let k = k0; k <= k1; k++) {
      const xa = x0 + k * s, xb = xa + s;
      tris.push({ p: [xa, out, xb, out, (xa + xb) / 2, inn], m: 'bone' });
      tris.push({ p: [(xa + xb) / 2, inn, xb, out, xb + s / 2, inn], m: 'ebony' });
    }
  };
  for (const [part, w] of [['brass', EDGE[0]], ['saw', EDGE[1]], ['brass', EDGE[2]]]) {
    if (part === 'brass') bands.push([y, y + w * s]); else saw(y, y + w * s, true);
    y += w * s;
  }
  // The stars: four rows of lattice triangles, from 2 rows above the middle line to 2 below.
  const P = (i, j) => [x0 + (i + j / 2) * s, mid + j * th];
  for (let j = -2; j < 2; j++) {
    const i0 = Math.floor((-x0) / s - j / 2) - 2, i1 = Math.ceil((len - x0) / s - j / 2) + 2;
    for (let i = i0; i <= i1; i++) {
      const [ax, ay] = P(i, j), [bx, by] = P(i + 1, j), [cx, cy] = P(i, j + 1), [dx, dy] = P(i + 1, j + 1);
      tris.push({ p: [ax, ay, bx, by, cx, cy], m: PAINT[roleAt(i, j, true)][0] });
      tris.push({ p: [bx, by, dx, dy, cx, cy], m: PAINT[roleAt(i, j, false)][1] });
    }
  }
  y = mid + 2 * th;
  for (const [part, w] of [['brass', EDGE[2]], ['saw', EDGE[1]], ['brass', EDGE[0]]]) {
    if (part === 'brass') bands.push([y, y + w * s]); else saw(y, y + w * s, false);
    y += w * s;
  }
  return { s, bands, tris };
}

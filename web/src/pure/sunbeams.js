// The morning sun through the glass wall, in three's axes (x east, y up, z = minus north). The wall faces north, so the
// sun can only reach in while it is still north of east: from about April to mid-September, between sunrise and the
// moment it swings past due east (up to three and a half hours in June).
import { astro, makeAstro, vanDate } from './outside.js';

export const GLASS = { z: -15.06, x0: 0, x1: 22, y0: 0, y1: 6.5 };
const RAD = Math.PI / 180;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// How much sunlight comes through, 0 to 1: none before the sun clears the hills, and less and less as it grazes the
// glass, which then reflects most of it (Schlick's Fresnel on both faces of the pane, 1 straight on).
export function sunThrough(s) {
  const [x, y, z] = s;
  if (x <= 0 || z >= 0) return 0;
  const el = Math.asin(Math.min(1, Math.max(-1, y))) / RAD;
  const c = -z / Math.hypot(x, y, z), r = 0.04 + 0.96 * (1 - c) ** 5;
  return smooth(1, 5, el) * ((1 - r) ** 2) / (0.96 ** 2);
}

// Where a sunbeam through the glass at (gx, gy) lands on a level floor at height `floor`, and the other way round.
export function landing(s, gx, gy, floor = 0) {
  const t = (gy - floor) / s[1];
  return [gx - s[0] * t, floor, GLASS.z - s[2] * t];
}
export function throughGlass(s, p) {
  const t = (p[2] - GLASS.z) / -s[2];
  return [p[0] + s[0] * t, p[1] + s[1] * t];
}

// The glass seen along the light as a projection, row by row: a point's x and y in clip space are its place on the glass
// (traced back along the light `d`, which points into the room), its depth how far the light has come, near to far.
export function glassView(d, near, far) {
  const kx = d[0] / d[2], ky = d[1] / d[2], w = GLASS.x1 - GLASS.x0, h = GLASS.y1 - GLASS.y0, z = GLASS.z, n = 2 / (far - near);
  return [
    2 / w, 0, -2 * kx / w, (2 / w) * (kx * z - GLASS.x0) - 1,
    0, 2 / h, -2 * ky / h, (2 / h) * (ky * z - GLASS.y0) - 1,
    0, 0, n / d[2], -n * (z / d[2] + near) - 1,
    0, 0, 0, 1,
  ];
}

// The sun the ?sunbeams flag shows when the real one cannot reach in: Midsummer morning at a quarter to seven.
export function midsummer(year) {
  const a = astro(vanDate(year, 6, 21, 6, 45), makeAstro());
  return a.sun;
}

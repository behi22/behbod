// The letters come in as a picture drawn in whatever font the browser has, so any script prints.
import { box, torus, extrude, blend, union, cut } from './sdf.js';
import { never } from './mesher.js';

const { sqrt, min, max, floor, hypot } = Math;
const INF = 1e20;

// The squared distance to the nearest set point along a row (Felzenszwalb and Huttenlocher).
function edt1(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
}
function* edt(grid, w, h, due) {
  const n = max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
    if (due()) yield 0;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
    if (due()) yield 0;
  }
}

export const FONT_PX = 96;
const FONT = `900 ${FONT_PX}px system-ui, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", Tahoma, Arial, sans-serif`;
// Generators, like the build, so a page without a worker can spread them over frames (`due`, as in mesher.js).
export function* drawLetters(text, make, due = never) {
  const s = String(text), words = s.split(' ');
  let lines = [s];
  if (Array.from(s).length > 12 && words.length > 1) {
    let best = 1, gap = Infinity;
    for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - s.length / 2); if (d < gap) { gap = d; best = i; } }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  const step = Math.round(FONT_PX * 1.25);
  let g = make(8, 8);
  g.font = FONT;
  const w = Math.min(2200, Math.ceil(Math.max(...lines.map(l => g.measureText(l).width)) + 40)), h = step * lines.length + 30;
  g = make(w, h);
  g.font = FONT; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
  lines.forEach((l, i) => g.fillText(l, w / 2, Math.round(FONT_PX * 1.1) + i * step));
  // Read back a strip at a time, keeping only how covered each pixel is.
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 4) {
    const rows = Math.min(4, h - y), rgba = g.getImageData(0, y, w, rows).data;
    for (let i = 0, j = 3, o = y * w; i < rows * w; i++, j += 4) data[o + i] = rgba[j];
    if (due()) yield 0;
  }
  return { w, h, data };
}

export function* letterField({ w, h, data }, due = never) {
  const out = new Float64Array(w * h), inn = new Float64Array(w * h);
  let any = false;
  for (let i = 0; i < w * h; i++) {
    const on = data[i] >= 128; any ||= on; out[i] = on ? 0 : INF; inn[i] = on ? INF : 0;
    if ((i & 2047) === 2047 && due()) yield 0;
  }
  if (!any) return null;
  yield* edt(out, w, h, due); yield* edt(inn, w, h, due);
  const sd = new Float32Array(w * h);
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let i = 0; i < w * h; i++) {
    sd[i] = sqrt(out[i]) - sqrt(inn[i]);
    if (data[i] >= 128) { const x = i % w, y = floor(i / w); x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y); }
    if ((i & 2047) === 2047 && due()) yield 0;
  }
  return { w, h, sd, box: [x0, y0, x1 + 1, y1 + 1] };
}

export function keychain(field, { px = FONT_PX, tall = 4.2, wide = 17 } = {}) {
  // Letters that drew nothing (a font without them) leave a plain tag.
  if (!field) field = { w: 2, h: 2, sd: new Float32Array(4).fill(px), box: [0, 0, 1, 1] };
  const [bx0, by0, bx1, by1] = field.box;
  let k = tall / px;
  if ((bx1 - bx0) * k > wide) k = wide / (bx1 - bx0);
  const W = (bx1 - bx0) * k, H = (by1 - by0) * k, bar = 1.0, cx = (bx0 + bx1) / 2, w = field.w, h = field.h, sd = field.sd;
  const text = (u, v) => {
    const fx = cx + u / k - 0.5, fy = by1 - v / k - 0.5;
    const ix = min(w - 2, max(0, floor(fx))), iy = min(h - 2, max(0, floor(fy))), tx = min(1, max(0, fx - ix)), ty = min(1, max(0, fy - iy));
    const a = sd[iy * w + ix], b = sd[iy * w + ix + 1], c = sd[(iy + 1) * w + ix], d = sd[(iy + 1) * w + ix + 1];
    const inner = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    const ox = max(0, -fx, fx - (w - 1)), oy = max(0, -fy, fy - (h - 1));
    return inner * k + hypot(ox, oy) * k;
  };
  const lift = (u, v) => text(u, v - bar + 0.15);
  const letters = extrude((u, v) => lift(u, v) - 0.14, 0.62, 0.12, 'z');
  const outline = extrude((u, v) => lift(u, v) - 0.5, 0.34, -0.16, 'z');
  const left = -W / 2 - 0.4;
  const base = box([(W + 0.8) / 2 + 1.0, bar / 2, 0.5], [-1.0, bar / 2, 0], 0.25);
  const rx = left - 1.75, ry = bar + 1.15;
  const ring = cut(blend(0.3, box([0.9, 0.7, 0.42], [rx + 0.2, bar + 0.3, 0], 0.4), torus(1.15, 0.42, [rx, ry, 0], 'z')), (x, y) => hypot(x - rx, y - ry) - 0.72);
  const f = blend(0.25, union(letters, outline), base, ring);
  return { f, bounds: [left - 3.6, 0, -1.2, W / 2 + 1.0, bar + max(H + 1.4, 3.0), 1.2], lip: 1.5 };
}

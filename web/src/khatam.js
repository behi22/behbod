// Khatam drawn on a canvas: a strip, a bar, and the board on the balcony table. The pattern itself is in pure/khatam.js.
import { khatamStrip, tileSide, UNITS, KHATAM } from './pure/khatam.js';

// One repeat of a strip `h` across, drawn once at the canvas's own resolution (`k` pixels to the unit) and kept: every
// strip of that size is filled from it, so a whole board costs a few hundred triangles, not thousands.
// A board painted on the processor takes `soft` tiles: one kept on the graphics card is read back at every strip.
const tiles = new Map();
function tile(h, k, soft) {
  const key = `${h}|${k}|${soft}`;
  if (tiles.has(key)) return tiles.get(key);
  const s = tileSide(h, k), hh = UNITS * s, period = 6 * s, k3 = khatamStrip(period * 3, hh);
  const c = document.createElement('canvas');
  c.width = Math.round(period * k); c.height = Math.ceil(hh * k);
  const g = c.getContext('2d', { willReadFrequently: soft });
  g.scale(k, k);
  // The glue between the pieces shows as fine dark lines.
  g.fillStyle = KHATAM.ebony; g.fillRect(0, 0, period, hh);
  // The middle repeat of three, its star in the middle of the tile; the neighbours' edges fill the tile's ends.
  g.translate(-period, 0);
  const paths = {};
  for (const { p, m } of k3.tris) {
    const path = paths[m] ||= new Path2D();
    path.moveTo(p[0], p[1]); path.lineTo(p[2], p[3]); path.lineTo(p[4], p[5]); path.closePath();
  }
  for (const [m, path] of Object.entries(paths)) { g.fillStyle = KHATAM[m]; g.fill(path); }
  const brass = g.createLinearGradient(0, 0, 0, hh);
  brass.addColorStop(0, '#e2c27a'); brass.addColorStop(1, '#a8803a');
  g.fillStyle = brass;
  for (const [y0, y1] of k3.bands) g.fillRect(0, y0, period * 3, y1 - y0);
  const t = { c, hh, period };
  tiles.set(key, t);
  return t;
}

// A strip from the current origin along +x, `len` long and `h` across (0 is its outer edge), its middle star halfway
// along. `mitre` cuts both ends at 45 degrees, as the four sides of a frame meet.
export function strip(g, len, h, mitre = false, soft = false) {
  const m = g.getTransform(), k = Math.hypot(m.a, m.b) || 1, t = tile(h, k, soft), y0 = (h - t.hh) / 2;
  g.save();
  g.beginPath();
  if (mitre) { g.moveTo(0, 0); g.lineTo(len, 0); g.lineTo(len - h, h); g.lineTo(h, h); } else g.rect(0, 0, len, h);
  g.closePath();
  g.clip();
  g.fillStyle = KHATAM.ebony; g.fillRect(0, 0, len, h);
  const pattern = g.createPattern(t.c, 'repeat-x');
  pattern.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, len / 2 - t.period / 2, y0]));
  g.fillStyle = pattern; g.fillRect(0, y0, len, t.hh);
  // The lacquer over it: warm, a touch brighter along the middle.
  const sheen = g.createLinearGradient(0, 0, 0, h);
  sheen.addColorStop(0, 'rgba(255,214,150,0.02)'); sheen.addColorStop(0.5, 'rgba(255,224,170,0.10)'); sheen.addColorStop(1, 'rgba(255,214,150,0.02)');
  g.fillStyle = sheen; g.fillRect(0, 0, len, h);
  g.restore();
}

// The four mitred sides of a frame round the inside edge of a rectangle, `band` wide, one side at a time.
function* frameSides(g, x, y, w, h, band) {
  for (const [tx, ty, rot, len] of [[x, y, 0, w], [x + w, y, 0.5, h], [x + w, y + h, 1, w], [x, y + h, 1.5, h]]) {
    g.save(); g.translate(tx, ty); g.rotate(rot * Math.PI); strip(g, len, band, true, true); g.restore();
    yield;
  }
}

// A strip standing upright, `w` across and `h` tall, its middle star halfway up.
export function bar(g, x, y, w, h, soft = false) {
  g.save(); g.translate(x + w, y); g.rotate(Math.PI / 2); strip(g, h, w, false, soft); g.restore();
}

// The open board on the balcony table, 460 by 320 mm, `k` canvas pixels to the millimetre: a khatam frame and middle
// bar round two walnut fields, and the points in bone and red. It is painted in small steps (a field's wood, a few lines
// of its grain, a pair of points, a strip tile, a side of the frame, the bar), so the page can paint a few at a time and
// never hold a frame for the whole board.
const NARD = { w: 460, h: 320, band: 13, bar: 16, point: 120 };
export function* nardSteps(g, k) {
  const { w, h, band, bar: bw, point } = NARD;
  g.save();
  g.scale(k, k);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const fx0 = band, fx1 = (w - bw) / 2, rx0 = (w + bw) / 2, rx1 = w - band, fy0 = band, fy1 = h - band;
  for (const [x0, x1] of [[fx0, fx1], [rx0, rx1]]) {
    const f = g.createLinearGradient(0, fy0, 0, fy1);
    f.addColorStop(0, '#5e3c20'); f.addColorStop(0.5, '#4f3119'); f.addColorStop(1, '#5e3c20');
    g.fillStyle = f; g.fillRect(x0, fy0, x1 - x0, fy1 - fy0);
    yield;
    // Walnut grain running the length of each field.
    g.save(); g.beginPath(); g.rect(x0, fy0, x1 - x0, fy1 - fy0); g.clip();
    for (let i = 0; i < 46; i++) {
      const y = fy0 + rnd() * (fy1 - fy0), amp = 0.6 + rnd() * 2.2, ph = rnd() * 6, wl = 30 + rnd() * 50;
      g.strokeStyle = `rgba(${rnd() < 0.5 ? '30,16,6' : '140,96,58'},${0.10 + rnd() * 0.14})`;
      g.lineWidth = 0.3 + rnd() * 0.8;
      g.beginPath();
      for (let x = x0; x <= x1; x += 4) g.lineTo(x, y + Math.sin(x / wl + ph) * amp);
      g.stroke();
      if (i % 4 === 3) yield;
    }
    g.restore();
    yield;
    const pw = (x1 - x0) / 6;
    for (let i = 0; i < 6; i++) {
      for (const top of [true, false]) {
        const px = x0 + i * pw, base = top ? fy0 : fy1, tip = top ? fy0 + point : fy1 - point;
        const red = (i + (top ? 0 : 1)) % 2 === 0;
        const gr = g.createLinearGradient(0, base, 0, tip);
        gr.addColorStop(0, red ? '#9a2420' : '#efe4c8'); gr.addColorStop(1, red ? '#7a1a17' : '#d9c79f');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(px + 1.2, base); g.lineTo(px + pw - 1.2, base); g.lineTo(px + pw / 2, tip); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(201,162,78,.75)'; g.lineWidth = 0.5; g.stroke();
      }
      yield;
    }
    // A brass stringing line round the field, inside the khatam.
    g.strokeStyle = '#c9a24e'; g.lineWidth = 0.8;
    g.strokeRect(x0 + 0.6, fy0 + 0.6, x1 - x0 - 1.2, fy1 - fy0 - 1.2);
    yield;
  }
  // Each strip tile is made in a step of its own: making one is the board's costliest single step.
  tile(band, k, true);
  yield;
  tile(bw, k, true);
  yield;
  yield* frameSides(g, 0, 0, w, h, band);
  bar(g, fx1, band, bw, h - 2 * band, true);
  g.restore();
}
export function nardBoard(g, k) {
  const steps = nardSteps(g, k);
  while (!steps.next().done) continue;
}

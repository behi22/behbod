// The printer screen's model pictures, drawn from the models themselves: node blender/printer_pictures.mjs
// With PLAYWRIGHT_CORE set, a Chrome turns the sheet into web/assets/printer/models.webp.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { MODELS } from '../web/src/pure/models.js';
import { buildPrint } from '../web/src/pure/printbuild.js';
import { finish } from '../web/src/pure/mesher.js';
import { COLOURS } from '../web/src/pure/printer.js';
import { SHEET } from '../web/src/printscreen.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'web/assets/printer');
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), srgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hex = h => [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16) / 255));

function draw(b, colour, S, eye, at, fov = 28, SS = 3) {
  const W = S * SS, zb = new Float32Array(W * W).fill(Infinity), col = new Float32Array(W * W * 3), cov = new Uint8Array(W * W);
  const f = at.map((v, i) => v - eye[i]), fl = Math.hypot(...f); f.forEach((v, i) => { f[i] = v / fl; });
  const rl = Math.hypot(f[2], f[0]), r = [-f[2] / rl, 0, f[0] / rl], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const t = Math.tan((fov * Math.PI) / 360), n = b.pos.length / 3, sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const px = b.pos[i * 3] - eye[0], py = b.pos[i * 3 + 1] - eye[1], pz = b.pos[i * 3 + 2] - eye[2];
    const cz = px * f[0] + py * f[1] + pz * f[2];
    sx[i] = ((px * r[0] + py * r[1] + pz * r[2]) / cz / t * 0.5 + 0.5) * W; sy[i] = (0.5 - (px * u[0] + py * u[1] + pz * u[2]) / cz / t * 0.5) * W; sz[i] = cz;
  }
  const c = hex(colour), I = b.index;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k], bb = I[k + 1], cc = I[k + 2], area = (sx[bb] - sx[a]) * (sy[cc] - sy[a]) - (sx[cc] - sx[a]) * (sy[bb] - sy[a]);
    if (area >= 0) continue;
    const x0 = Math.max(0, Math.floor(Math.min(sx[a], sx[bb], sx[cc]))), x1 = Math.min(W - 1, Math.ceil(Math.max(sx[a], sx[bb], sx[cc])));
    const y0 = Math.max(0, Math.floor(Math.min(sy[a], sy[bb], sy[cc]))), y1 = Math.min(W - 1, Math.ceil(Math.max(sy[a], sy[bb], sy[cc])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((sx[cc] - sx[bb]) * (py - sy[bb]) - (sy[cc] - sy[bb]) * (px - sx[bb])) / area, w1 = ((sx[a] - sx[cc]) * (py - sy[cc]) - (sy[a] - sy[cc]) * (px - sx[cc])) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * sz[a] + w1 * sz[bb] + w2 * sz[cc], o = y * W + x;
      if (z >= zb[o]) continue;
      zb[o] = z; cov[o] = 1;
      let s = w0 * b.colour[a * 3] + w1 * b.colour[bb * 3] + w2 * b.colour[cc * 3];
      if (Math.floor((w0 * b.uv[a * 2 + 1] + w1 * b.uv[bb * 2 + 1] + w2 * b.uv[cc * 2 + 1]) * 2) % 2) s *= 0.93;
      col[o * 3] = c[0] * s; col[o * 3 + 1] = c[1] * s; col[o * 3 + 2] = c[2] * s;
    }
  }
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let R = 0, G = 0, B = 0, A = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) { const o = (y * SS + j) * W + x * SS + i; if (cov[o]) { R += col[o * 3]; G += col[o * 3 + 1]; B += col[o * 3 + 2]; A++; } }
    const o = (y * S + x) * 4, k = A ? 1 / A : 0;
    [R, G, B].forEach((v, q) => { out[o + q] = Math.round(srgb(Math.min(1, v * k)) * 255); });
    out[o + 3] = Math.round((A / (SS * SS)) * 255);
  }
  return out;
}

const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (type, data) => { const len = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]); len.writeUInt32BE(data.length); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const S = SHEET.tile, cols = SHEET.cols, rows = Math.ceil(MODELS.length / cols), sheet = new Uint8Array(cols * S * rows * S * 4);
MODELS.forEach((m, k) => {
  const p = { model: m.id, size: 1, height: 1, width: 1, twist: 0, bulge: 0, taper: 0, depth: 0, sides: m.sides ? m.sides[2] : 8 };
  const b = finish(buildPrint(p, { points: 300000 }));
  const h = b.height, d = Math.hypot(h / 2, b.radius) * 4.1, yaw = -0.32, eye = [Math.sin(yaw) * d, h * 0.5 + d * 0.32, Math.cos(yaw) * d];
  const img = draw(b, COLOURS[m.colour === 'black' ? 'grey' : m.colour], S, eye, [0, h * 0.47, 0]);
  const ox = (k % cols) * S, oy = Math.floor(k / cols) * S;
  for (let y = 0; y < S; y++) sheet.set(img.subarray(y * S * 4, (y + 1) * S * 4), ((oy + y) * cols * S + ox) * 4);
  console.log(m.id, `${b.index.length / 3} triangles`);
});
fs.mkdirSync(OUT, { recursive: true });
const pngPath = path.join(OUT, 'models.png');
fs.writeFileSync(pngPath, png(cols * S, rows * S, sheet));
console.log('wrote', pngPath, fs.statSync(pngPath).size, 'bytes');
if (process.env.PLAYWRIGHT_CORE) {
  const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE);
  const browser = await pw.chromium.launch({ channel: 'chrome' }), page = await browser.newPage();
  const url = await page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.9);
  }, 'data:image/png;base64,' + fs.readFileSync(pngPath).toString('base64'));
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'models.webp'), Buffer.from(url.split(',')[1], 'base64'));
  fs.rmSync(pngPath);
  console.log('wrote models.webp', fs.statSync(path.join(OUT, 'models.webp')).size, 'bytes');
}

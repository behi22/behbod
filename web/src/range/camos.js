import * as THREE from 'three';
import { CAMO } from '../pure/smith.js';

// The finishes are painted here, never downloaded, each the first time it is picked.
const SIZE = 256, cache = new Map();

// A repeatable random sequence, so a finish looks the same on every visit.
function rng(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
const seedOf = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
// Smooth noise that repeats every `cells` cells across the picture.
function noise(cells, r) {
  const g = Array.from({ length: cells * cells }, r);
  return (x, y) => {
    const fx = x / SIZE * cells, fy = y / SIZE * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), at = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
}
// Draws a shape at its place and at the eight places one picture away, so it carries across the edges.
const wrapped = (g, draw) => { for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) { g.save(); g.translate(dx, dy); draw(); g.restore(); } };
// A picture from a field of 0..1 values cut into the colours at the given steps.
function field(g, f, colours, steps) {
  const img = g.createImageData(SIZE, SIZE), rgb = colours.map(h => new THREE.Color(h)).map(c => [c.r * 255, c.g * 255, c.b * 255]);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const v = f(x, y);
    let k = 0;
    while (k < steps.length && v > steps[k]) k++;
    const c = rgb[Math.min(k, rgb.length - 1)], i = (y * SIZE + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

const PAINT = {
  // Long thin angular shards, all leaning one way.
  splinter(g, c, r) {
    g.fillStyle = c[0]; g.fillRect(0, 0, SIZE, SIZE);
    for (const [colour, n] of [[c[1], 34], [c[2], 14]]) for (let i = 0; i < n; i++) {
      const x = r() * SIZE, y = r() * SIZE, a = -0.5 + (r() - 0.5) * 0.5, l = 30 + r() * 70, w = 4 + r() * 12, ca = Math.cos(a), sa = Math.sin(a);
      const pts = [[0, 0], [l, w * 0.4], [l * 0.85, w], [l * 0.1, w * 0.7]].map(([u, v]) => [x + u * ca - v * sa, y + u * sa + v * ca]);
      g.fillStyle = colour;
      wrapped(g, () => { g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill(); });
    }
  },
  // Blocky pixels in four tones, clumped by noise.
  pixels(g, c, r) {
    const n1 = noise(6, r), n2 = noise(14, r), cell = 8, img = g.createImageData(SIZE, SIZE), rgb = c.map(h => new THREE.Color(h)).map(x => [x.r * 255, x.g * 255, x.b * 255]);
    for (let cy = 0; cy < SIZE / cell; cy++) for (let cx = 0; cx < SIZE / cell; cx++) {
      const v = n1(cx * cell, cy * cell) * 0.7 + n2(cx * cell, cy * cell) * 0.3 + (r() - 0.5) * 0.08;
      const col = rgb[v < 0.38 ? 0 : v < 0.5 ? 1 : v < 0.62 ? 2 : 3];
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const i = ((cy * cell + y) * SIZE + cx * cell + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
  },
  // Soft rounded patches in three sands.
  blobs(g, c, r) { const n1 = noise(4, r), n2 = noise(9, r); field(g, (x, y) => n1(x, y) * 0.75 + n2(x, y) * 0.25, c, [0.42, 0.56]); },
  // Torn bands running across, broken by noise.
  stripes(g, c, r) {
    const n = noise(8, r), w = noise(3, r);
    field(g, (x, y) => { const v = Math.sin((y / SIZE) * Math.PI * 2 * 5 + Math.sin(x / SIZE * Math.PI * 2 * 2) * 1.2 + w(x, y) * 4) * 0.5 + 0.5; return v * 0.7 + n(x, y) * 0.3; }, c, [0.36, 0.62]);
  },
  // A toy's speckle: round dots of three colours on a pale ground.
  dots(g, c, r) {
    g.fillStyle = c[0]; g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 70; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 3 + r() * 9, flat = 0.7 + r() * 0.3, turn = r() * 3;
      g.fillStyle = c[1 + (i % 3)];
      wrapped(g, () => { g.beginPath(); g.ellipse(x, y, rad, rad * flat, turn, 0, Math.PI * 2); g.fill(); });
    }
  },
  // An anodised fade along the gun; the picture mirrors at its edges so the colours run back smoothly.
  fade(g, c, r) {
    const grad = g.createLinearGradient(0, 0, SIZE, 0);
    c.forEach((h, i) => grad.addColorStop(i / (c.length - 1), h));
    g.fillStyle = grad; g.fillRect(0, 0, SIZE, SIZE);
    const n = noise(16, r), img = g.getImageData(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const i = (y * SIZE + x) * 4, k = 0.94 + n(x, y) * 0.12; for (let j = 0; j < 3; j++) img.data[i + j] = Math.min(255, img.data[i + j] * k); }
    g.putImageData(img, 0, 0);
  },
  // Traces and pads, like a circuit board.
  circuit(g, c, r) {
    g.fillStyle = c[0]; g.fillRect(0, 0, SIZE, SIZE);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [colour, n, width] of [[c[1], 46, 3], [c[2], 16, 2]]) for (let i = 0; i < n; i++) {
      let x = Math.round(r() * 32) * 8, y = Math.round(r() * 32) * 8;
      const pts = [[x, y]];
      for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
        const d = [[1, 0], [0, 1], [1, 1], [1, -1]][Math.floor(r() * 4)], l = 16 + Math.floor(r() * 5) * 8;
        x += d[0] * l; y += d[1] * l; pts.push([x, y]);
      }
      g.strokeStyle = colour; g.fillStyle = colour; g.lineWidth = width;
      wrapped(g, () => {
        g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
        for (const [px, py] of [pts[0], pts[pts.length - 1]]) { g.beginPath(); g.arc(px, py, width + 1.5, 0, Math.PI * 2); g.fill(); }
      });
    }
  },
  solid(g, c) { g.fillStyle = c[0]; g.fillRect(0, 0, SIZE, SIZE); },
};

// The picture for a finish, painted once.
const pictures = new Map();
export function camoCanvas(id) {
  const c = CAMO[id];
  if (!c || c.kind === 'none') return null;
  if (!pictures.has(id)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    PAINT[c.kind](canvas.getContext('2d'), c.colours, rng(seedOf(id)));
    pictures.set(id, canvas);
  }
  return pictures.get(id);
}
// A strip of it for the bench's choices.
export function camoSwatch(id) {
  const pic = camoCanvas(id);
  if (!pic) return null;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 34;
  c.getContext('2d').drawImage(pic, 0, 0, SIZE, SIZE * 34 / 128, 0, 0, 128, 34);
  return c;
}

// What a gun's painted parts take for a finish: { map, tint, rough, metal }, or null for the gun's own.
export function paintCamo(id) {
  const c = CAMO[id];
  if (!c || c.kind === 'none') return null;
  if (!cache.has(id)) {
    const t = new THREE.CanvasTexture(camoCanvas(id));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = c.kind === 'fade' ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
    t.anisotropy = 4;
    // The gun's surfaces are mapped in metres, so a repeat every `metres`.
    t.repeat.setScalar(1 / c.metres);
    cache.set(id, { map: t, tint: new THREE.Color(1, 1, 1), rough: c.rough, metal: c.metal });
  }
  return cache.get(id);
}

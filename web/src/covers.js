// The game cases' art, drawn in code: a spine for each case on the shelf and a cover for each in the games panel. One
// house style for the set (the art full bleed, the title in a band along the foot, the number in the corner), and an
// original scene for each game in its own colours. No logos, characters, key art or real cover layouts.
import { titleLines } from './pure/shelf.js';

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, Consolas, monospace";

function rng(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  s = s % 2147483646 + 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const mix = (a, b, t) => {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};
function vgrad(g, x, y, w, h, stops) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  stops.forEach((c, i) => gr.addColorStop(Array.isArray(c) ? c[0] : i / (stops.length - 1), Array.isArray(c) ? c[1] : c));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}
function glow(g, x, y, r, colour) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, colour); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
function poly(g, pts, colour) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = colour; g.fill(); }
// A city's silhouette along `base`, buildings `h0` to `h1` tall; lit windows when `lit` is a colour.
function skyline(g, r, w, base, h0, h1, colour, lit = null, { min = 0.05, max = 0.13, spires = 0 } = {}) {
  let x = -r() * w * 0.05;
  while (x < w) {
    const bw = w * (min + r() * (max - min)), bh = h0 + r() * (h1 - h0);
    g.fillStyle = colour; g.fillRect(x, base - bh, bw + 1, bh + 1);
    if (spires && r() < spires) poly(g, [[x + bw * 0.3, base - bh], [x + bw * 0.5, base - bh - bh * 0.35], [x + bw * 0.7, base - bh]], colour);
    if (lit) {
      g.fillStyle = lit;
      const cw = Math.max(1, bw / 7), ch = Math.max(1, cw * 1.3);
      for (let yy = base - bh + ch * 1.4; yy < base - ch; yy += ch * 2) for (let xx = x + cw; xx < x + bw - cw; xx += cw * 2) if (r() < 0.32) g.fillRect(xx, yy, cw, ch);
    }
    x += bw + w * 0.004;
  }
}
function hills(g, r, w, base, amp, colour, bottom, step = 0.04) {
  g.beginPath(); g.moveTo(0, bottom);
  let y = base;
  for (let x = 0; x <= w + 1; x += w * step) { y = base - amp * (0.4 + 0.6 * Math.abs(Math.sin(x / w * 7 + r() * 0.8))); g.lineTo(x, y); }
  g.lineTo(w, bottom); g.closePath(); g.fillStyle = colour; g.fill();
}
function streaks(g, r, w, h, n, colour, angle, len, width = 1) {
  g.save(); g.strokeStyle = colour; g.lineWidth = width; g.beginPath();
  for (let i = 0; i < n; i++) { const x = r() * w * 1.2 - w * 0.1, y = r() * h, l = len * (0.6 + r() * 0.8); g.moveTo(x, y); g.lineTo(x + Math.sin(angle) * l, y + Math.cos(angle) * l); }
  g.stroke(); g.restore();
}
function dots(g, r, x0, y0, w, h, n, colour, size) {
  g.fillStyle = colour;
  for (let i = 0; i < n; i++) { const s = size * (0.4 + r() * 0.9); g.beginPath(); g.arc(x0 + r() * w, y0 + r() * h, s, 0, Math.PI * 2); g.fill(); }
}
// Film grain: one tile of light and dark dots, made once and laid over each picture at its own offset in a single fill.
let grainTile = null;
function grain(g, r, w, h, alpha) {
  if (!grainTile) {
    const S = 128, q = rng('grain');
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = S;
    const t = grainTile.getContext('2d', { willReadFrequently: true });
    for (let i = 0; i < Math.round(S * S / 90); i++) { t.fillStyle = `rgba(${q() < 0.5 ? '255,255,255' : '0,0,0'},${0.4 + q() * 0.6})`; t.fillRect(q() * S, q() * S, 1 + q(), 1 + q()); }
  }
  const p = g.createPattern(grainTile, 'repeat');
  p.setTransform(new DOMMatrix([1, 0, 0, 1, -r() * 128, -r() * 128]));
  g.save(); g.globalAlpha = alpha; g.fillStyle = p; g.fillRect(0, 0, w, h); g.restore();
}
function vignette(g, w, h, k) {
  const gr = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.78);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${k})`);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function palm(g, x, base, hgt, colour, lean = 0.12) {
  g.strokeStyle = colour; g.lineWidth = hgt * 0.035; g.lineCap = 'round';
  const tx = x + hgt * lean, ty = base - hgt;
  g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + hgt * lean * 0.2, base - hgt * 0.5, tx, ty); g.stroke();
  g.lineWidth = hgt * 0.022;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.95 + i * Math.PI * 0.32, l = hgt * (0.32 + (i % 2) * 0.08);
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * l * 0.6, ty + Math.sin(a) * l * 0.6 - hgt * 0.06, tx + Math.cos(a) * l, ty + Math.sin(a) * l + hgt * 0.1); g.stroke();
  }
}

// Each scene in a w by h box. `r` is the game's own random stream, `P` its colours.
const ART = {
  ring(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#3b4a2a', '#2c3820', '#232c19']);
    // The sea in one corner, then contour lines over the land.
    g.fillStyle = '#26333a'; g.beginPath(); g.moveTo(w, h * 0.55); g.bezierCurveTo(w * 0.8, h * 0.62, w * 0.72, h * 0.8, w * 0.78, h); g.lineTo(w, h); g.fill();
    g.lineWidth = Math.max(1, w * 0.004);
    for (let k = 0; k < 16; k++) {
      g.strokeStyle = k % 4 ? 'rgba(200,210,150,.14)' : 'rgba(220,230,170,.28)';
      g.beginPath();
      for (let i = 0; i <= 40; i++) { const t = i / 40, x = t * w, y = h * (0.06 + k * 0.058) + Math.sin(t * 9 + k * 0.7) * h * 0.02 + Math.sin(t * 3.3 + k) * h * 0.035; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    // Roads and a town of little blocks.
    g.strokeStyle = 'rgba(30,30,22,.55)'; g.lineWidth = w * 0.012;
    g.beginPath(); g.moveTo(0, h * 0.7); g.quadraticCurveTo(w * 0.4, h * 0.55, w * 0.62, h * 0.18); g.moveTo(w * 0.1, h * 0.25); g.lineTo(w * 0.7, h * 0.5); g.stroke();
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(205,200,170,.5)'; g.fillRect(w * (0.32 + r() * 0.22), h * (0.34 + r() * 0.18), w * 0.025, w * 0.02); }
    // The ring closing in, glowing orange, and the safe circle inside it.
    const cx = w * 0.46, cy = h * 0.42, R = w * 0.36;
    g.save(); g.globalAlpha = 0.18; g.fillStyle = P.accent; g.beginPath(); g.rect(0, 0, w, h); g.arc(cx, cy, R, 0, Math.PI * 2, true); g.fill('evenodd'); g.restore();
    g.strokeStyle = P.accent; g.lineWidth = w * 0.012; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.setLineDash([w * 0.02, w * 0.015]); g.strokeStyle = '#f4efe0'; g.lineWidth = w * 0.006; g.beginPath(); g.arc(cx + w * 0.05, cy - h * 0.03, R * 0.45, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // Drop markers falling in.
    for (const [x, y] of [[0.3, 0.3], [0.58, 0.36], [0.5, 0.58]]) { g.fillStyle = P.accent; poly(g, [[w * x, h * y], [w * (x - 0.025), h * (y - 0.04)], [w * (x + 0.025), h * (y - 0.04)]], P.accent); }
  },
  rain(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#4a4d4a', '#5c5a50', '#3a3832']);
    hills(g, r, w, h * 0.6, h * 0.05, '#46463f', h);
    // The plant: sheds, a stack and a water tower, wires sagging between poles.
    const base = h * 0.74, dark = '#22221e';
    g.fillStyle = dark;
    g.fillRect(w * 0.05, base - h * 0.16, w * 0.32, h * 0.16); poly(g, [[w * 0.05, base - h * 0.16], [w * 0.21, base - h * 0.22], [w * 0.37, base - h * 0.16]], dark);
    g.fillRect(w * 0.42, base - h * 0.42, w * 0.06, h * 0.42); g.fillRect(w * 0.4, base - h * 0.44, w * 0.1, h * 0.03);
    g.fillRect(w * 0.55, base - h * 0.2, w * 0.4, h * 0.2);
    g.fillRect(w * 0.78, base - h * 0.36, w * 0.012, h * 0.16); g.fillRect(w * 0.88, base - h * 0.36, w * 0.012, h * 0.16);
    g.beginPath(); g.ellipse(w * 0.835, base - h * 0.39, w * 0.08, h * 0.045, 0, 0, Math.PI * 2); g.fill();
    // Rust streaks on the sheds and smoke from the stack.
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(138,75,42,.35)'; g.fillRect(w * (0.07 + r() * 0.85), base - h * 0.15, w * 0.006, h * (0.04 + r() * 0.08)); }
    g.fillStyle = 'rgba(70,70,64,.5)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w * (0.45 + i * 0.04), base - h * (0.48 + i * 0.05), w * (0.03 + i * 0.012), 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = dark; g.lineWidth = w * 0.006;
    for (const x of [0.02, 0.98]) g.fillRect(w * x, base - h * 0.3, w * 0.008, h * 0.3);
    g.beginPath(); g.moveTo(w * 0.02, base - h * 0.29); g.quadraticCurveTo(w * 0.5, base - h * 0.2, w * 0.98, base - h * 0.29); g.stroke();
    // The one way out: a green exit light over a door.
    g.fillStyle = '#0d0d0b'; g.fillRect(w * 0.7, base - h * 0.11, w * 0.06, h * 0.11);
    g.fillStyle = '#3dff7a'; g.fillRect(w * 0.695, base - h * 0.14, w * 0.07, h * 0.022);
    glow(g, w * 0.73, base - h * 0.13, w * 0.12, 'rgba(61,255,122,.7)');
    vgrad(g, 0, base, w, h - base, ['#2a2a25', '#1a1a17']);
    g.fillStyle = 'rgba(61,255,122,.12)'; g.fillRect(w * 0.69, base + h * 0.02, w * 0.08, h * 0.12);
    streaks(g, r, w, h, 220, 'rgba(220,225,230,.22)', 0.12, h * 0.05, Math.max(1, w * 0.002));
  },
  storm(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, [[0, '#0b1424'], [0.45, '#2a2a3a'], [0.62, '#b4451a'], [0.7, '#ff8a2a'], [0.72, '#3a2418'], [1, '#160f0c']]);
    // Smoke columns leaning in the wind.
    for (let k = 0; k < 4; k++) {
      const x0 = w * (0.15 + k * 0.24 + r() * 0.05);
      for (let i = 0; i < 14; i++) { const t = i / 14; g.fillStyle = `rgba(${20 + i * 2},${18 + i * 2},${22 + i * 2},${0.55 - t * 0.35})`; g.beginPath(); g.arc(x0 + t * w * 0.18, h * 0.7 - t * h * 0.55, w * (0.03 + t * 0.07), 0, Math.PI * 2); g.fill(); }
    }
    skyline(g, r, w, h * 0.72, h * 0.02, h * 0.07, '#140d0a', null, { min: 0.03, max: 0.08 });
    for (let i = 0; i < 18; i++) glow(g, r() * w, h * (0.69 + r() * 0.03), w * 0.03, 'rgba(255,150,60,.6)');
    // Two jets and their trails.
    for (const [x, y, s] of [[0.62, 0.22, 1], [0.72, 0.3, 0.75]]) {
      g.strokeStyle = 'rgba(230,230,240,.35)'; g.lineWidth = w * 0.006 * s; g.beginPath(); g.moveTo(w * (x - 0.4), h * (y + 0.12)); g.lineTo(w * x, h * y); g.stroke();
      poly(g, [[w * (x + 0.04 * s), h * (y - 0.012 * s)], [w * (x - 0.02 * s), h * (y + 0.005 * s)], [w * (x - 0.01 * s), h * (y + 0.03 * s)], [w * (x - 0.03 * s), h * (y + 0.01 * s)]], '#0e1118');
    }
    dots(g, r, 0, h * 0.4, w, h * 0.3, 40, 'rgba(255,170,90,.55)', w * 0.003);
  },
  nvg(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#0b1a0b', '#143014', '#0a170a']);
    // A corridor in perspective, a lit door at its end.
    const cx = w * 0.5, cy = h * 0.42, dw = w * 0.14, dh = h * 0.2;
    g.strokeStyle = 'rgba(140,230,120,.35)'; g.lineWidth = Math.max(1, w * 0.004);
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(cx + (x ? dw : -dw), cy + (y ? dh : -dh)); g.stroke(); }
    for (let i = 1; i < 6; i++) { const t = i / 6, k = 1 - t * t; g.strokeRect(cx - (w / 2) * k - dw * (1 - k), cy - (h / 2) * k - dh * (1 - k), w * k + 2 * dw * (1 - k), h * k + 2 * dh * (1 - k)); }
    g.fillStyle = '#9dff8a'; g.fillRect(cx - dw * 0.55, cy - dh * 0.8, dw * 1.1, dh * 1.8);
    glow(g, cx, cy, w * 0.35, 'rgba(150,255,130,.45)');
    // The door swung part way in, its edge catching the light.
    poly(g, [[cx - dw * 0.55, cy - dh * 0.8], [cx - dw * 0.05, cy - dh * 0.62], [cx - dw * 0.05, cy + dh * 0.82], [cx - dw * 0.55, cy + dh]], '#0f2a10');
    g.fillStyle = 'rgba(190,255,170,.6)'; g.fillRect(cx - dw * 0.07, cy - dh * 0.62, Math.max(1, dw * 0.04), dh * 1.44);
    // A laser across the dark, scan lines and the round edge of the goggles.
    g.strokeStyle = 'rgba(255,60,40,.85)'; g.lineWidth = w * 0.005; g.beginPath(); g.moveTo(w * 0.05, h * 0.9); g.lineTo(cx + dw * 0.3, cy + dh * 0.3); g.stroke();
    glow(g, cx + dw * 0.3, cy + dh * 0.3, w * 0.025, 'rgba(255,80,60,1)');
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += Math.max(2, h / 160)) g.fillRect(0, y, w, Math.max(1, h / 400));
    dots(g, r, 0, 0, w, h, 160, 'rgba(180,255,170,.18)', w * 0.002);
    g.fillStyle = '#020502'; g.beginPath(); g.rect(0, 0, w, h); g.ellipse(w / 2, h * 0.45, w * 0.62, h * 0.5, 0, 0, Math.PI * 2, true); g.fill('evenodd');
  },
  dust(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h * 0.5, ['#3f74b8', '#8fb8e0']);
    // A sandstone wall with an arch, the sky beyond it, and its long shadow.
    const wall = h * 0.12;
    g.fillStyle = '#d7b47c'; g.fillRect(0, wall, w, h * 0.66);
    for (let y = wall; y < wall + h * 0.66; y += h * 0.045) for (let x = ((y / (h * 0.045)) % 2) * w * 0.06; x < w; x += w * 0.12) { g.strokeStyle = 'rgba(120,85,45,.35)'; g.lineWidth = 1; g.strokeRect(x, y, w * 0.12, h * 0.045); }
    g.fillStyle = '#8fb8e0'; g.beginPath(); g.moveTo(w * 0.3, wall + h * 0.66); g.lineTo(w * 0.3, h * 0.36); g.arc(w * 0.5, h * 0.36, w * 0.2, Math.PI, 0); g.lineTo(w * 0.7, wall + h * 0.66); g.fill();
    g.fillStyle = '#c99e62'; g.fillRect(w * 0.3, h * 0.36, w * 0.4, wall + h * 0.66 - h * 0.36); g.fillStyle = '#9cc2e6'; g.fillRect(w * 0.33, h * 0.38, w * 0.34, wall + h * 0.66 - h * 0.38);
    g.fillStyle = '#e8d4a8'; g.fillRect(0, wall + h * 0.66, w, h);
    poly(g, [[0, wall + h * 0.66], [w, wall + h * 0.66], [w, h * 0.86], [0, h * 0.82]], 'rgba(140,100,60,.35)');
    // Crates: plank lines and a darker frame.
    for (const [x, y, s] of [[0.06, 0.62, 0.2], [0.26, 0.66, 0.16], [0.13, 0.46, 0.17], [0.7, 0.64, 0.22]]) {
      const cs = w * s, X = w * x, Y = h * y;
      g.fillStyle = '#b07a3e'; g.fillRect(X, Y, cs, cs);
      g.strokeStyle = '#6a4420'; g.lineWidth = cs * 0.06; g.strokeRect(X, Y, cs, cs);
      g.lineWidth = cs * 0.02; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(X, Y + cs * i / 4); g.lineTo(X + cs, Y + cs * i / 4); g.stroke(); }
      g.lineWidth = cs * 0.06; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + cs, Y + cs); g.stroke();
    }
    g.fillStyle = 'rgba(255,240,200,.12)'; g.fillRect(0, 0, w, h);
  },
  tactic(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#16263a', '#1b2a3a', '#101c2a']);
    g.strokeStyle = 'rgba(120,170,220,.12)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += w / 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += w / 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // Corridors of the plan.
    g.strokeStyle = 'rgba(190,215,240,.55)'; g.lineWidth = w * 0.05; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(w * 0.15, h * 0.9); g.lineTo(w * 0.15, h * 0.5); g.lineTo(w * 0.3, h * 0.28); g.lineTo(w * 0.3, h * 0.12);
    g.moveTo(w * 0.15, h * 0.62); g.lineTo(w * 0.62, h * 0.62); g.lineTo(w * 0.62, h * 0.35); g.lineTo(w * 0.85, h * 0.35);
    g.moveTo(w * 0.62, h * 0.62); g.lineTo(w * 0.85, h * 0.8); g.stroke();
    g.strokeStyle = '#16263a'; g.lineWidth = w * 0.032; g.stroke();
    // The two sites, and routes to them.
    for (const [x, y, l] of [[0.3, 0.16, 'A'], [0.84, 0.36, 'B']]) {
      g.fillStyle = 'rgba(242,169,59,.18)'; g.beginPath(); g.arc(w * x, h * y, w * 0.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = P.accent; g.lineWidth = w * 0.008; g.stroke();
      g.fillStyle = P.accent; g.font = `800 ${Math.round(w * 0.11)}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l, w * x, h * y + w * 0.005);
    }
    g.setLineDash([w * 0.025, w * 0.018]); g.strokeStyle = P.accent; g.lineWidth = w * 0.009;
    g.beginPath(); g.moveTo(w * 0.15, h * 0.86); g.lineTo(w * 0.15, h * 0.52); g.lineTo(w * 0.28, h * 0.27); g.stroke();
    g.strokeStyle = '#f1f3f6'; g.beginPath(); g.moveTo(w * 0.2, h * 0.62); g.lineTo(w * 0.6, h * 0.6); g.lineTo(w * 0.62, h * 0.38); g.lineTo(w * 0.76, h * 0.36); g.stroke(); g.setLineDash([]);
    for (const [x, y] of [[0.28, 0.27], [0.76, 0.36]]) poly(g, [[w * x, h * y], [w * (x - 0.03), h * (y - 0.02)], [w * (x - 0.02), h * (y + 0.03)]], x < 0.5 ? P.accent : '#f1f3f6');
  },
  bayou(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h * 0.62, [[0, '#1f2a22'], [0.55, '#4e4a30'], [0.85, '#8a5a2a'], [1, '#6a1e14']]);
    glow(g, w * 0.62, h * 0.5, w * 0.3, 'rgba(230,190,120,.55)');
    g.fillStyle = '#e6cf9a'; g.beginPath(); g.arc(w * 0.62, h * 0.5, w * 0.05, 0, Math.PI * 2); g.fill();
    vgrad(g, 0, h * 0.62, w, h * 0.38, ['#3a2a18', '#141a12']);
    // Mist on the water.
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(200,190,160,${0.05 + i * 0.02})`; g.fillRect(0, h * (0.6 + i * 0.015), w, h * 0.02); }
    // Cypress trees with flared trunks and ragged crowns hung with moss, the shack on its stilts, a lantern in its window.
    const tree = (x, s) => {
      const base = h * 0.66, top = h * (0.62 - 0.42 * s), tw = w * 0.022 * s;
      g.fillStyle = '#0e130d';
      g.beginPath(); g.moveTo(w * x - tw * 2.6, base); g.quadraticCurveTo(w * x - tw * 0.6, base - h * 0.06, w * x - tw * 0.5, top); g.lineTo(w * x + tw * 0.5, top); g.quadraticCurveTo(w * x + tw * 0.6, base - h * 0.06, w * x + tw * 2.6, base); g.fill();
      for (let k = 0; k < 16; k++) { const a = r() * Math.PI * 2, d = r(); g.beginPath(); g.arc(w * x + Math.cos(a) * w * 0.12 * s * d, top + h * 0.02 + Math.sin(a) * h * 0.07 * s * d, w * (0.03 + r() * 0.035) * s, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(70,82,52,.85)'; g.lineWidth = Math.max(1, w * 0.004);
      for (let k = 0; k < 18; k++) { const mx = w * x + (r() - 0.5) * w * 0.26 * s, my = top + h * (0.03 + r() * 0.08) * s; g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx + w * 0.004, my + h * 0.04 * s, mx + (r() - 0.5) * w * 0.012, my + h * (0.05 + r() * 0.1) * s); g.stroke(); }
    };
    tree(0.14, 1.1); tree(0.88, 1); tree(0.36, 0.65);
    g.fillStyle = '#120e09'; g.fillRect(w * 0.5, h * 0.5, w * 0.22, h * 0.1); poly(g, [[w * 0.48, h * 0.5], [w * 0.61, h * 0.43], [w * 0.74, h * 0.5]], '#120e09');
    for (const x of [0.52, 0.6, 0.69]) g.fillRect(w * x, h * 0.6, w * 0.01, h * 0.07);
    g.fillStyle = '#ffb347'; g.fillRect(w * 0.56, h * 0.53, w * 0.03, h * 0.03); glow(g, w * 0.575, h * 0.545, w * 0.1, 'rgba(255,170,70,.8)');
    g.fillStyle = 'rgba(255,170,70,.18)'; g.fillRect(w * 0.55, h * 0.68, w * 0.05, h * 0.1);
    dots(g, r, 0, h * 0.2, w, h * 0.5, 30, 'rgba(230,220,150,.5)', w * 0.003);
  },
  pitch(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#0b1220', '#101a2c']);
    // The pitch in perspective, mown in stripes, its lines and the ball on the spot.
    const top = h * 0.24, bot = h * 1.02, tl = w * 0.2, tr = w * 0.8, bl = -w * 0.25, br = w * 1.25;
    const at = (u, v) => [tl + (bl - tl) * v + ((tr + (br - tr) * v) - (tl + (bl - tl) * v)) * u, top + (bot - top) * v];
    for (let i = 0; i < 10; i++) { const v0 = (i / 10) ** 1.25, v1 = ((i + 1) / 10) ** 1.25; poly(g, [at(0, v0), at(1, v0), at(1, v1), at(0, v1)], i % 2 ? '#1c8a43' : '#1a7a3b'); }
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1, w * 0.006);
    const line = pts => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke(); };
    line([at(0.03, 0.02), at(0.97, 0.02), at(0.97, 0.98), at(0.03, 0.98), at(0.03, 0.02)]);
    line([at(0.03, 0.45), at(0.97, 0.45)]);
    g.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, p = at(0.5 + Math.cos(a) * 0.13, 0.45 + Math.sin(a) * 0.1); i ? g.lineTo(...p) : g.moveTo(...p); } g.stroke();
    line([at(0.3, 0.02), at(0.3, 0.12), at(0.7, 0.12), at(0.7, 0.02)]);
    const [bx, by] = at(0.5, 0.45);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(bx + w * 0.012, by + h * 0.006, w * 0.035, h * 0.012, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(bx, by - h * 0.012, w * 0.03, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1a1a'; poly(g, [0, 1, 2, 3, 4].map(k => [bx + Math.cos(k * 1.2566 - 1.57) * w * 0.011, by - h * 0.012 + Math.sin(k * 1.2566 - 1.57) * w * 0.011]), '#1a1a1a');
    // The crowd, and the floodlights.
    dots(g, r, 0, h * 0.12, w, h * 0.1, 320, 'rgba(220,230,255,.35)', w * 0.003);
    for (const x of [0.06, 0.94]) { glow(g, w * x, h * 0.1, w * 0.3, 'rgba(255,255,240,.65)'); g.fillStyle = '#fffbe8'; g.fillRect(w * x - w * 0.04, h * 0.08, w * 0.08, h * 0.03); }
    g.fillStyle = P.accent; g.fillRect(0, h * 0.215, w, h * 0.008);
  },
  sunset(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h * 0.7, ['#2a1640', '#7a2a6a', '#ff5f8a', '#ffae42']);
    // A striped sun going down behind the city.
    const sx = w * 0.5, sy = h * 0.52, R = w * 0.27;
    g.save(); g.beginPath(); g.arc(sx, sy, R, 0, Math.PI * 2); g.clip();
    vgrad(g, sx - R, sy - R, R * 2, R * 2, ['#fff1a8', '#ffb347', '#ff5f8a']);
    g.fillStyle = '#ff7a8a'; for (let i = 0; i < 7; i++) { const yy = sy + R * (0.05 + i * 0.13); g.fillRect(sx - R, yy, R * 2, R * 0.025 * (i + 1)); }
    g.restore();
    skyline(g, r, w, h * 0.7, h * 0.04, h * 0.2, '#1f1033', 'rgba(255,200,140,.7)', { spires: 0.15 });
    vgrad(g, 0, h * 0.7, w, h * 0.3, ['#1a0d2a', '#0c0616']);
    // Light trails on the highway, and the palms in front.
    for (let k = 0; k < 6; k++) {
      g.strokeStyle = k % 2 ? 'rgba(255,95,138,.8)' : 'rgba(31,181,176,.8)'; g.lineWidth = w * 0.006;
      g.beginPath(); g.moveTo(-w * 0.1, h * (0.98 - k * 0.015)); g.bezierCurveTo(w * 0.3, h * (0.8 - k * 0.01), w * 0.7, h * (0.8 - k * 0.012), w * 1.1, h * (0.74 - k * 0.012)); g.stroke();
    }
    palm(g, w * 0.1, h * 1.0, h * 0.62, '#12081e', 0.1);
    palm(g, w * 0.86, h * 1.0, h * 0.5, '#12081e', -0.12);
    palm(g, w * 0.74, h * 1.0, h * 0.36, '#12081e', -0.06);
  },
  snow(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#c9dae6', '#8fb0c8', '#203a55']);
    skyline(g, r, w, h * 0.8, h * 0.18, h * 0.42, '#30506e', null, { min: 0.07, max: 0.14 });
    skyline(g, r, w, h * 0.86, h * 0.08, h * 0.26, '#1a3048', 'rgba(47,210,255,.75)', { min: 0.06, max: 0.12 });
    vgrad(g, 0, h * 0.86, w, h * 0.14, ['#dfeaf2', '#b8ccdc']);
    // A cold line of light across the street, and snow drifting down.
    g.fillStyle = P.accent; g.fillRect(0, h * 0.858, w, Math.max(2, h * 0.006));
    glow(g, w * 0.5, h * 0.86, w * 0.6, 'rgba(47,210,255,.35)');
    g.strokeStyle = '#0d1f33'; g.lineWidth = w * 0.01; g.beginPath(); g.moveTo(w * 0.8, h * 0.86); g.lineTo(w * 0.8, h * 0.55); g.lineTo(w * 0.72, h * 0.55); g.stroke();
    glow(g, w * 0.72, h * 0.565, w * 0.12, 'rgba(220,245,255,.8)');
    dots(g, r, 0, 0, w, h, 260, 'rgba(255,255,255,.85)', w * 0.006);
    dots(g, r, 0, 0, w, h, 120, 'rgba(255,255,255,.5)', w * 0.012);
  },
  gold(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#0e0c0a', '#2a2014', '#5a4220', '#1a140d']);
    glow(g, w * 0.55, h * 0.58, w * 0.75, 'rgba(230,180,80,.75)');
    glow(g, w * 0.55, h * 0.6, w * 0.25, 'rgba(255,230,160,.8)');
    hills(g, r, w, h * 0.64, h * 0.06, '#2a2016', h, 0.05);
    // An arcade in ruins: two arches still standing, the third fallen, its stones on the ground.
    const base = h * 0.7, pw = w * 0.04, ph = h * 0.24, gap = w * 0.17, x0 = w * 0.06, c = '#140f0a';
    g.fillStyle = c; g.strokeStyle = c; g.lineWidth = pw * 0.85; g.lineCap = 'butt';
    for (let i = 0; i < 4; i++) g.fillRect(x0 + i * gap, base - ph * (i === 3 ? 0.45 : 1), pw, ph * (i === 3 ? 0.45 : 1));
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x0 + i * gap + gap / 2 + pw / 2, base - ph, gap / 2, Math.PI, i === 2 ? Math.PI * 1.38 : Math.PI * 2); g.stroke(); }
    g.fillRect(x0 - pw * 0.3, base - ph - gap / 2 - pw * 0.9, gap * 2 + pw * 1.6, pw * 0.5);
    for (let i = 0; i < 6; i++) g.fillRect(x0 + gap * (2.6 + r() * 1.4), base - pw * (0.4 + r() * 0.5), pw * (0.6 + r() * 0.7), pw * 0.55);
    vgrad(g, 0, base, w, h - base, ['#14100b', '#0a0806']);
    for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(220,190,130,${0.05 + i * 0.03})`; g.fillRect(0, h * (0.62 + i * 0.025), w, h * 0.03); }
    // Gold leaves falling through the air.
    for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h * 0.9, s = w * (0.004 + r() * 0.006); g.fillStyle = `rgba(240,200,110,${0.4 + r() * 0.6})`; g.beginPath(); g.ellipse(x, y, s * 1.8, s, r() * 3, 0, Math.PI * 2); g.fill(); }
  },
  rooftops(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, [[0, '#14183a'], [0.45, '#5a1838'], [0.7, '#d7192f'], [1, '#2a0d1c']]);
    skyline(g, r, w, h * 0.78, h * 0.25, h * 0.6, '#1a1030', 'rgba(255,215,160,.65)', { min: 0.06, max: 0.11, spires: 0.25 });
    skyline(g, r, w, h * 0.92, h * 0.12, h * 0.3, '#0c0818', 'rgba(255,215,160,.5)', { min: 0.1, max: 0.18 });
    // A rooftop in front with its water tower, and a cable strung across the gap.
    g.fillStyle = '#05030a'; g.fillRect(0, h * 0.86, w * 0.55, h * 0.14);
    for (const x of [0.12, 0.3]) g.fillRect(w * x, h * 0.72, w * 0.014, h * 0.14);
    g.fillRect(w * 0.08, h * 0.6, w * 0.26, h * 0.13); poly(g, [[w * 0.07, h * 0.6], [w * 0.21, h * 0.52], [w * 0.35, h * 0.6]], '#05030a');
    g.strokeStyle = 'rgba(40,20,40,1)'; g.lineWidth = w * 0.004; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(w * 0.08, h * (0.62 + i * 0.03)); g.lineTo(w * 0.34, h * (0.62 + i * 0.03)); g.stroke(); }
    g.strokeStyle = 'rgba(230,230,240,.5)'; g.lineWidth = Math.max(1, w * 0.003); g.beginPath(); g.moveTo(w * 0.34, h * 0.6); g.quadraticCurveTo(w * 0.7, h * 0.5, w * 1.02, h * 0.3); g.stroke();
    dots(g, r, 0, 0, w, h * 0.3, 40, 'rgba(255,255,255,.6)', w * 0.003);
  },
  ember(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#1c1a18', '#2c2825', '#110f0d']);
    glow(g, w * 0.5, h * 0.64, w * 0.8, 'rgba(232,105,42,.5)');
    // A ruined arch over a small fire: one pillar standing, the other broken off, the arch fallen short.
    g.fillStyle = '#0f0d0c'; g.strokeStyle = '#0f0d0c';
    g.fillRect(w * 0.1, h * 0.28, w * 0.1, h * 0.72); g.fillRect(w * 0.76, h * 0.46, w * 0.1, h * 0.54);
    poly(g, [[w * 0.76, h * 0.46], [w * 0.81, h * 0.41], [w * 0.86, h * 0.48]], '#0f0d0c');
    g.lineWidth = w * 0.085; g.beginPath(); g.arc(w * 0.48, h * 0.3, w * 0.33, Math.PI, Math.PI * 1.55); g.stroke();
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(90,80,70,.5)'; g.fillRect(w * 0.1, h * (0.34 + i * 0.07), w * 0.1, Math.max(1, h * 0.003)); }
    vgrad(g, 0, h * 0.72, w, h * 0.28, ['#1a1612', '#0d0b09']);
    // The fire: crossed logs, tall flames, its glow on the ground.
    g.fillStyle = 'rgba(255,150,70,.3)'; g.beginPath(); g.ellipse(w * 0.5, h * 0.73, w * 0.32, h * 0.04, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a120c'; g.lineWidth = w * 0.028;
    g.beginPath(); g.moveTo(w * 0.39, h * 0.745); g.lineTo(w * 0.61, h * 0.71); g.moveTo(w * 0.39, h * 0.71); g.lineTo(w * 0.61, h * 0.745); g.stroke();
    glow(g, w * 0.5, h * 0.64, w * 0.28, 'rgba(255,190,90,.95)');
    for (let i = 0; i < 7; i++) { const x = w * (0.41 + i * 0.03), t = h * (0.47 + ((i * 37) % 5) * 0.03); poly(g, [[x - w * 0.03, h * 0.72], [x + w * 0.005, t], [x + w * 0.035, h * 0.72]], i % 2 ? '#ffb347' : '#e8692a'); }
    poly(g, [[w * 0.46, h * 0.72], [w * 0.5, h * 0.55], [w * 0.54, h * 0.72]], '#ffe2a0');
    // Embers going up, ash coming down.
    for (let i = 0; i < 70; i++) { const t = r(); g.fillStyle = `rgba(255,${120 + Math.round(r() * 80)},60,${0.95 - t * 0.7})`; g.fillRect(w * (0.5 + (r() - 0.5) * (0.1 + t * 0.6)), h * (0.6 - t * 0.55), w * 0.007, w * 0.007); }
    dots(g, r, 0, 0, w, h, 120, 'rgba(190,185,175,.35)', w * 0.003);
  },
  noir(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#1a120c', '#3a2a1e', '#120c08']);
    // Art deco towers, a lamp throwing its cone over an old car, and rain.
    skyline(g, r, w, h * 0.66, h * 0.26, h * 0.52, '#140e0a', 'rgba(255,210,140,.55)', { min: 0.12, max: 0.2, spires: 0.6 });
    vgrad(g, 0, h * 0.66, w, h * 0.34, ['#3a2a1e', '#0e0a07']);
    g.fillStyle = '#0c0806'; g.fillRect(w * 0.72, h * 0.3, w * 0.014, h * 0.42); g.fillRect(w * 0.66, h * 0.29, w * 0.1, h * 0.012);
    poly(g, [[w * 0.66, h * 0.3], [w * 0.36, h * 0.76], [w * 0.98, h * 0.76], [w * 0.68, h * 0.3]], 'rgba(255,220,160,.12)');
    glow(g, w * 0.67, h * 0.31, w * 0.08, 'rgba(255,220,150,.9)');
    g.fillStyle = 'rgba(255,220,160,.4)'; g.beginPath(); g.ellipse(w * 0.66, h * 0.755, w * 0.36, h * 0.035, 0, 0, Math.PI * 2); g.fill();
    const cx = w * 0.56, cy = h * 0.745;
    g.fillStyle = '#060403';
    g.beginPath(); g.moveTo(cx - w * 0.3, cy); g.lineTo(cx - w * 0.29, cy - h * 0.05); g.quadraticCurveTo(cx - w * 0.22, cy - h * 0.07, cx - w * 0.15, cy - h * 0.065);
    g.quadraticCurveTo(cx - w * 0.1, cy - h * 0.13, cx + w * 0.04, cy - h * 0.13); g.quadraticCurveTo(cx + w * 0.12, cy - h * 0.12, cx + w * 0.15, cy - h * 0.06);
    g.quadraticCurveTo(cx + w * 0.26, cy - h * 0.06, cx + w * 0.28, cy); g.closePath(); g.fill();
    for (const x of [-0.2, 0.18]) { g.beginPath(); g.arc(cx + w * x, cy, w * 0.045, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3a2a1e'; g.beginPath(); g.arc(cx + w * x, cy, w * 0.018, 0, Math.PI * 2); g.fill(); g.fillStyle = '#060403'; }
    g.strokeStyle = 'rgba(255,220,160,.45)'; g.lineWidth = Math.max(1, w * 0.004);
    g.beginPath(); g.moveTo(cx - w * 0.1, cy - h * 0.128); g.quadraticCurveTo(cx + w * 0.1, cy - h * 0.13, cx + w * 0.15, cy - h * 0.06); g.stroke();
    g.fillStyle = 'rgba(255,220,160,.6)'; g.fillRect(cx + w * 0.255, cy - h * 0.04, w * 0.02, h * 0.012);
    g.fillStyle = P.accent; g.fillRect(w * 0.06, h * 0.42, w * 0.16, h * 0.04); glow(g, w * 0.14, h * 0.44, w * 0.15, 'rgba(200,30,30,.6)');
    streaks(g, r, w, h, 180, 'rgba(230,215,190,.18)', 0.06, h * 0.04, Math.max(1, w * 0.002));
    g.fillStyle = 'rgba(239,226,196,.06)'; g.fillRect(0, 0, w, h);
  },
  tower(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#f4efe4', '#e6dccb', '#c9bba4']);
    glow(g, w * 0.72, h * 0.3, w * 0.4, 'rgba(255,240,210,.8)');
    // The bell tower, its banner, and the old roofs below.
    const tx = w * 0.42, tw = w * 0.14, ttop = h * 0.28;
    g.fillStyle = '#6a6258'; g.fillRect(tx, ttop, tw, h);
    poly(g, [[tx - w * 0.01, ttop], [tx + tw / 2, ttop - h * 0.12], [tx + tw + w * 0.01, ttop]], '#5a5249');
    g.fillStyle = '#3a342e'; for (const y of [0.34, 0.46]) { g.beginPath(); g.moveTo(tx + tw * 0.3, h * (y + 0.06)); g.lineTo(tx + tw * 0.3, h * y + tw * 0.2); g.arc(tx + tw / 2, h * y + tw * 0.2, tw * 0.2, Math.PI, 0); g.lineTo(tx + tw * 0.7, h * (y + 0.06)); g.fill(); }
    g.strokeStyle = '#3a342e'; g.lineWidth = w * 0.006; g.beginPath(); g.moveTo(tx + tw / 2, ttop - h * 0.12); g.lineTo(tx + tw / 2, ttop - h * 0.2); g.stroke();
    poly(g, [[tx + tw / 2, ttop - h * 0.2], [tx + tw / 2 + w * 0.13, ttop - h * 0.18], [tx + tw / 2 + w * 0.1, ttop - h * 0.15], [tx + tw / 2, ttop - h * 0.14]], P.accent);
    for (let k = 0; k < 3; k++) {
      let x = -w * 0.05;
      const base = h * (0.66 + k * 0.12), shade = ['#b4643c', '#9a5434', '#7a4028'][k];
      while (x < w) { const bw = w * (0.12 + r() * 0.1), bh = h * (0.08 + r() * 0.06); g.fillStyle = '#d8ccb6'; g.fillRect(x, base - bh * 0.6, bw, bh + h); poly(g, [[x - w * 0.01, base - bh * 0.6], [x + bw / 2, base - bh], [x + bw + w * 0.01, base - bh * 0.6]], shade); x += bw + w * 0.01; }
    }
    // Birds wheeling round the tower.
    g.strokeStyle = '#2a2622'; g.lineWidth = Math.max(1, w * 0.004);
    for (let i = 0; i < 9; i++) { const bx = w * (0.55 + r() * 0.35), by = h * (0.08 + r() * 0.25), s = w * (0.012 + r() * 0.012); g.beginPath(); g.moveTo(bx - s, by); g.quadraticCurveTo(bx - s / 2, by - s * 0.6, bx, by); g.quadraticCurveTo(bx + s / 2, by - s * 0.6, bx + s, by); g.stroke(); }
  },
  blizzard(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#050b14', '#0c1826', '#1a2c42']);
    skyline(g, r, w, h * 0.72, h * 0.3, h * 0.62, '#081220', 'rgba(200,220,255,.35)', { min: 0.08, max: 0.16 });
    vgrad(g, 0, h * 0.72, w, h * 0.28, ['#1a2a3c', '#0a121c']);
    // One streetlight, a red neon glow and its smear on the wet road.
    g.fillStyle = '#04080e'; g.fillRect(w * 0.24, h * 0.36, w * 0.014, h * 0.4); g.fillRect(w * 0.24, h * 0.36, w * 0.09, h * 0.01);
    glow(g, w * 0.32, h * 0.375, w * 0.22, 'rgba(200,225,255,.7)');
    poly(g, [[w * 0.3, h * 0.38], [w * 0.12, h * 0.75], [w * 0.52, h * 0.75], [w * 0.34, h * 0.38]], 'rgba(200,225,255,.1)');
    g.fillStyle = P.accent; g.fillRect(w * 0.66, h * 0.5, w * 0.2, h * 0.03); glow(g, w * 0.76, h * 0.515, w * 0.22, 'rgba(196,32,42,.7)');
    g.fillStyle = 'rgba(196,32,42,.25)'; g.fillRect(w * 0.64, h * 0.76, w * 0.24, h * 0.16);
    g.fillStyle = 'rgba(200,225,255,.12)'; g.fillRect(w * 0.27, h * 0.76, w * 0.08, h * 0.2);
    // Snow, thick and slanting, some flakes streaked as if time slowed.
    streaks(g, r, w, h, 60, 'rgba(255,255,255,.25)', 1.25, w * 0.08, Math.max(1, w * 0.004));
    dots(g, r, 0, 0, w, h, 300, 'rgba(255,255,255,.8)', w * 0.005);
    dots(g, r, 0, 0, w, h, 80, 'rgba(255,255,255,.45)', w * 0.012);
  },
  breach(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#1d232b', '#232a33', '#161b21']);
    g.strokeStyle = 'rgba(160,180,200,.08)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += w / 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += w / 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // The house plan: walls, doorways, a stair.
    g.strokeStyle = '#cfd6dd'; g.lineWidth = w * 0.014; g.lineCap = 'square';
    const wall = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(w * x0, h * y0); g.lineTo(w * x1, h * y1); g.stroke(); };
    wall(0.1, 0.1, 0.9, 0.1); wall(0.9, 0.1, 0.9, 0.85); wall(0.9, 0.85, 0.1, 0.85); wall(0.1, 0.85, 0.1, 0.1);
    wall(0.5, 0.1, 0.5, 0.32); wall(0.5, 0.42, 0.5, 0.6); wall(0.1, 0.5, 0.36, 0.5); wall(0.44, 0.5, 0.5, 0.5); wall(0.5, 0.6, 0.9, 0.6); wall(0.7, 0.6, 0.7, 0.85);
    g.lineWidth = Math.max(1, w * 0.004); for (let i = 0; i < 7; i++) wall(0.56 + i * 0.045, 0.66, 0.56 + i * 0.045, 0.8);
    g.strokeStyle = '#8a6a40'; g.lineWidth = w * 0.01; for (let i = 0; i < 3; i++) wall(0.36 + i * 0.03, 0.47, 0.38 + i * 0.03, 0.53);
    // Breach marks on the walls, and the drone's dotted path between rooms.
    for (const [x, y] of [[0.9, 0.36], [0.3, 0.1], [0.1, 0.7]]) {
      g.fillStyle = 'rgba(242,107,29,.25)'; g.beginPath(); g.arc(w * x, h * y, w * 0.07, 0, Math.PI * 2); g.fill();
      g.strokeStyle = P.accent; g.lineWidth = w * 0.01; g.stroke();
      g.beginPath(); g.moveTo(w * (x - 0.03), h * y - w * 0.03); g.lineTo(w * (x + 0.03), h * y + w * 0.03); g.moveTo(w * (x + 0.03), h * y - w * 0.03); g.lineTo(w * (x - 0.03), h * y + w * 0.03); g.stroke();
    }
    g.setLineDash([w * 0.012, w * 0.014]); g.strokeStyle = '#e9edf1'; g.lineWidth = w * 0.006;
    g.beginPath(); g.moveTo(w * 0.2, h * 0.75); g.lineTo(w * 0.4, h * 0.56); g.lineTo(w * 0.5, h * 0.37); g.lineTo(w * 0.72, h * 0.25); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#e9edf1'; g.beginPath(); g.arc(w * 0.72, h * 0.25, w * 0.018, 0, Math.PI * 2); g.fill();
  },
  glitch(g, w, h, r, P) {
    g.fillStyle = '#060707'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,209,193,.14)'; g.lineWidth = 1;
    for (let i = 0; i < 18; i++) { const y = h * 0.62 + i * i * h * 0.0016; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(w / 2 + i * w * 0.02, h * 0.62); g.lineTo(w / 2 + i * w * 0.14, h); g.stroke(); }
    // A wireframe city: outlines only, a few windows lit.
    const blocks = [];
    for (let x = 0; x < w;) { const bw = w * (0.06 + r() * 0.1), bh = h * (0.15 + r() * 0.4); blocks.push({ x, bw, bh, hot: r() < 0.2, lit: Array.from({ length: 5 }, () => (r() < 0.6 ? [r(), r()] : null)) }); x += bw + w * 0.01; }
    const city = dx => {
      g.lineWidth = Math.max(1, w * 0.003);
      for (const b of blocks) {
        g.strokeStyle = b.hot ? 'rgba(0,209,193,.9)' : 'rgba(240,244,244,.55)'; g.strokeRect(b.x + dx, h * 0.62 - b.bh, b.bw, b.bh);
        g.fillStyle = 'rgba(240,244,244,.5)';
        for (const l of b.lit) if (l) g.fillRect(b.x + dx + l[0] * b.bw * 0.8, h * 0.62 - l[1] * b.bh, w * 0.01, w * 0.006);
      }
    };
    city(0);
    // Glitch bars tearing across it: a slice of the city shifted sideways, a stripe of colour over it.
    for (let i = 0; i < 12; i++) {
      const y = h * (0.1 + r() * 0.55), bh = h * (0.006 + r() * 0.02), off = (r() - 0.5) * w * 0.12;
      g.save(); g.beginPath(); g.rect(0, y, w, bh); g.clip(); g.fillStyle = '#060707'; g.fillRect(0, y, w, bh); city(off); g.restore();
      g.fillStyle = r() < 0.5 ? 'rgba(0,209,193,.45)' : 'rgba(255,40,140,.3)'; g.fillRect(r() * w * 0.6, y, w * (0.1 + r() * 0.4), bh);
    }
    dots(g, r, 0, 0, w, h * 0.6, 50, 'rgba(0,209,193,.6)', w * 0.003);
  },
  waste(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h * 0.66, ['#4a5a26', '#9aa64a', '#d8c870']);
    g.fillStyle = 'rgba(255,250,210,.85)'; g.beginPath(); g.arc(w * 0.7, h * 0.3, w * 0.06, 0, Math.PI * 2); g.fill();
    glow(g, w * 0.7, h * 0.3, w * 0.3, 'rgba(240,240,170,.5)');
    hills(g, r, w, h * 0.62, h * 0.06, '#7a6a3a', h, 0.06);
    vgrad(g, 0, h * 0.64, w, h * 0.36, ['#a08a54', '#5a4a2a']);
    // The road running away to the horizon.
    poly(g, [[w * 0.47, h * 0.64], [w * 0.53, h * 0.64], [w * 0.9, h], [w * 0.1, h]], '#3a3428');
    g.fillStyle = '#d8c870'; for (let i = 0; i < 7; i++) { const t = (i / 7) ** 1.6, y = h * (0.65 + t * 0.35); g.fillRect(w * 0.5 - w * 0.004 * (1 + t * 4), y, w * 0.008 * (1 + t * 4), h * 0.01 * (1 + t * 3)); }
    // A ruined billboard and a leaning pole.
    g.fillStyle = '#2a2418'; g.fillRect(w * 0.12, h * 0.42, w * 0.012, h * 0.24); g.fillRect(w * 0.28, h * 0.42, w * 0.012, h * 0.24);
    poly(g, [[w * 0.06, h * 0.3], [w * 0.36, h * 0.32], [w * 0.35, h * 0.44], [w * 0.22, h * 0.43], [w * 0.2, h * 0.4], [w * 0.07, h * 0.42]], '#2a2418');
    g.fillStyle = 'rgba(159,209,79,.5)'; g.fillRect(w * 0.09, h * 0.33, w * 0.1, h * 0.06);
    g.strokeStyle = '#2a2418'; g.lineWidth = w * 0.01; g.beginPath(); g.moveTo(w * 0.82, h * 0.7); g.lineTo(w * 0.9, h * 0.36); g.moveTo(w * 0.85, h * 0.42); g.lineTo(w * 0.95, h * 0.45); g.stroke();
    dots(g, r, 0, h * 0.4, w, h * 0.6, 120, 'rgba(240,220,160,.25)', w * 0.004);
  },
  gotham(g, w, h, r, P) {
    vgrad(g, 0, 0, w, h, ['#1c2030', '#2c3040', '#0b0c10']);
    // Searchlights crossing in the clouds.
    for (const [x, a] of [[0.2, -0.32], [0.78, 0.38], [0.55, -0.12]]) {
      g.save(); g.translate(w * x, h); g.rotate(a);
      const gr = g.createLinearGradient(0, 0, 0, -h * 1.1); gr.addColorStop(0, 'rgba(245,197,24,.7)'); gr.addColorStop(0.7, 'rgba(245,197,24,.25)'); gr.addColorStop(1, 'rgba(245,197,24,0)');
      poly(g, [[-w * 0.025, 0], [w * 0.025, 0], [w * 0.14, -h * 1.1], [-w * 0.14, -h * 1.1]], gr); g.restore();
    }
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(70,74,90,.55)'; g.beginPath(); g.ellipse(r() * w, h * (0.05 + r() * 0.2), w * (0.15 + r() * 0.2), h * 0.035, 0, 0, Math.PI * 2); g.fill(); }
    for (const [x, y] of [[0.02, 0.2], [0.98, 0.16], [0.5, 0.08]]) glow(g, w * x, h * y, w * 0.18, 'rgba(245,197,24,.35)');
    // Gothic towers with pointed spires.
    let x = -w * 0.02;
    while (x < w) {
      const bw = w * (0.08 + r() * 0.1), bh = h * (0.3 + r() * 0.45), base = h * 0.98;
      g.fillStyle = '#07080b'; g.fillRect(x, base - bh, bw, bh);
      poly(g, [[x, base - bh], [x + bw / 2, base - bh - h * (0.08 + r() * 0.1)], [x + bw, base - bh]], '#07080b');
      for (const s of [0.15, 0.85]) poly(g, [[x + bw * s - bw * 0.06, base - bh], [x + bw * s, base - bh - h * 0.05], [x + bw * s + bw * 0.06, base - bh]], '#07080b');
      g.fillStyle = 'rgba(245,197,24,.55)'; for (let k = 0; k < 4; k++) if (r() < 0.5) g.fillRect(x + bw * (0.3 + r() * 0.4), base - bh + h * (0.05 + r() * 0.3), w * 0.008, h * 0.014);
      x += bw + w * 0.008;
    }
    streaks(g, r, w, h, 200, 'rgba(200,205,220,.18)', 0.1, h * 0.05, Math.max(1, w * 0.002));
  },
};

// Each cover drawn once at the games panel's size (about 160 by 198 css pixels, at the screen's pixel ratio up to 2),
// on the processor so the drawing happens when it is asked for, and kept for the visit.
const kept = new Map();
let size = null;
export function coverCanvas(game, n) {
  if (!kept.has(game.id)) {
    const k = Math.min(2, globalThis.devicePixelRatio || 1);
    size ||= [Math.round(160 * k), Math.round(198 * k)];
    const c = document.createElement('canvas');
    [c.width, c.height] = size;
    paintCover(c.getContext('2d', { willReadFrequently: true }), game, n, ...size);
    kept.set(game.id, c);
  }
  return kept.get(game.id);
}
export const coverReady = game => kept.has(game.id);

// A cover, w by h, `n` its place on the shelf (1 to 20).
export function paintCover(g, game, n, w, h) {
  const r = rng(game.id), band = h * 0.2;
  g.save();
  g.beginPath(); g.rect(0, 0, w, h); g.clip();
  (ART[game.art] || ART.ring)(g, w, h, r, game);
  vignette(g, w, h, 0.45);
  // The foot band: the title, set the same way on every case.
  const foot = g.createLinearGradient(0, h - band * 1.5, 0, h);
  foot.addColorStop(0, 'rgba(0,0,0,0)'); foot.addColorStop(0.35, game.bg + 'e6'); foot.addColorStop(1, game.bg);
  g.fillStyle = foot; g.fillRect(0, h - band * 1.5, w, band * 1.5);
  g.fillStyle = game.accent; g.fillRect(w * 0.08, h - band * 0.98, w * 0.16, Math.max(2, h * 0.008));
  const lines = titleLines(game.title, 16), px0 = Math.round(h * (lines.length > 1 ? 0.058 : 0.074));
  g.fillStyle = game.ink; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  lines.forEach((l, i) => {
    let px = px0;
    g.font = `800 ${px}px ${SANS}`;
    const wd = g.measureText(l).width;
    if (wd > w * 0.84) { px = Math.floor(px * w * 0.84 / wd); g.font = `800 ${px}px ${SANS}`; }
    g.fillText(l, w * 0.08, h - band * 0.98 + px0 * (1.25 + i * 1.08));
  });
  g.font = `500 ${Math.round(h * 0.03)}px ${MONO}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.textAlign = 'right';
  g.fillText(String(n).padStart(2, '0'), w * 0.93, h * 0.06);
  grain(g, r, w, h, 0.05);
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = Math.max(1, w * 0.006); g.strokeRect(w * 0.025, w * 0.025, w - w * 0.05, h - w * 0.05);
  g.restore();
}

// A small sign at the top of each spine, one of a few plain shapes.
function mark(g, kind, x, y, s, colour) {
  g.save(); g.translate(x, y); g.fillStyle = colour; g.strokeStyle = colour; g.lineWidth = s * 0.14;
  const P = pts => poly(g, pts.map(([a, b]) => [a * s, b * s]), colour);
  if (kind === 'ring') { g.beginPath(); g.arc(0, 0, s * 0.4, 0, Math.PI * 2); g.stroke(); }
  else if (kind === 'hex') P([0, 1, 2, 3, 4, 5].map(k => [Math.cos(k * 1.047) * 0.45, Math.sin(k * 1.047) * 0.45]));
  else if (kind === 'chevron') { g.beginPath(); g.moveTo(-0.4 * s, 0.2 * s); g.lineTo(0, -0.2 * s); g.lineTo(0.4 * s, 0.2 * s); g.stroke(); }
  else if (kind === 'cross') { g.beginPath(); g.arc(0, 0, s * 0.3, 0, Math.PI * 2); g.moveTo(-s * 0.5, 0); g.lineTo(s * 0.5, 0); g.moveTo(0, -s * 0.5); g.lineTo(0, s * 0.5); g.stroke(); }
  else if (kind === 'square') g.fillRect(-s * 0.32, -s * 0.32, s * 0.64, s * 0.64);
  else if (kind === 'diamond') P([[0, -0.45], [0.38, 0], [0, 0.45], [-0.38, 0]]);
  else if (kind === 'drop') { g.beginPath(); g.moveTo(0, -s * 0.48); g.quadraticCurveTo(s * 0.4, s * 0.05, 0, s * 0.4); g.quadraticCurveTo(-s * 0.4, s * 0.05, 0, -s * 0.48); g.fill(); }
  else if (kind === 'ball') { g.beginPath(); g.arc(0, 0, s * 0.4, 0, Math.PI * 2); g.stroke(); P([0, 1, 2, 3, 4].map(k => [Math.cos(k * 1.2566 - 1.57) * 0.16, Math.sin(k * 1.2566 - 1.57) * 0.16])); }
  else if (kind === 'sun') { g.beginPath(); g.arc(0, 0, s * 0.4, Math.PI, 0); g.fill(); g.fillRect(-s * 0.45, s * 0.08, s * 0.9, s * 0.07); g.fillRect(-s * 0.4, s * 0.22, s * 0.8, s * 0.06); }
  else if (kind === 'tri') P([[0, -0.42], [0.42, 0.32], [-0.42, 0.32]]);
  else if (kind === 'star') P(Array.from({ length: 8 }, (_, k) => [Math.cos(k * 0.785 - 1.57) * (k % 2 ? 0.16 : 0.48), Math.sin(k * 0.785 - 1.57) * (k % 2 ? 0.16 : 0.48)]));
  else if (kind === 'bars') for (let i = 0; i < 3; i++) g.fillRect(-s * 0.4 + i * s * 0.3, -s * (0.1 + i * 0.12), s * 0.2, s * (0.4 + i * 0.12));
  else if (kind === 'flame') { g.beginPath(); g.moveTo(0, -s * 0.5); g.quadraticCurveTo(s * 0.45, 0, s * 0.2, s * 0.4); g.lineTo(-s * 0.2, s * 0.4); g.quadraticCurveTo(-s * 0.45, 0, 0, -s * 0.5); g.fill(); }
  else if (kind === 'flake') { g.beginPath(); for (let k = 0; k < 3; k++) { const a = k * 1.047; g.moveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45); g.lineTo(-Math.cos(a) * s * 0.45, -Math.sin(a) * s * 0.45); } g.stroke(); }
  else if (kind === 'disc') { g.beginPath(); g.arc(0, 0, s * 0.42, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(0, 0, s * 0.18, 0, Math.PI * 2); g.fill(); }
  else if (kind === 'spire') P([[0, -0.5], [0.22, 0.1], [0.4, 0.42], [-0.4, 0.42], [-0.22, 0.1]]);
  g.restore();
}

// A spine, w across and h tall: the sign at the top, the title reading down it, the shelf number at the foot.
export function paintSpine(g, game, n, w, h) {
  const r = rng(game.id + 'spine');
  g.save();
  g.beginPath(); g.rect(0, 0, w, h); g.clip();
  const side = g.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, mix(game.bg, '#000000', 0.25)); side.addColorStop(0.18, game.bg); side.addColorStop(0.6, mix(game.bg, '#ffffff', 0.08)); side.addColorStop(1, mix(game.bg, '#000000', 0.3));
  g.fillStyle = side; g.fillRect(0, 0, w, h);
  const top = w * 1.25;
  g.fillStyle = mix(game.bg, '#000000', 0.35); g.fillRect(0, 0, w, top);
  mark(g, game.mark, w / 2, top / 2, w * 0.62, game.accent);
  g.fillStyle = game.accent; g.fillRect(0, top, w, Math.max(1, w * 0.06)); g.fillRect(0, h - w * 1.1, w, Math.max(1, w * 0.06));
  // The title runs top to bottom, as on a case stood on a shelf.
  const lines = titleLines(game.title, 18), room = h - top - w * 1.5, across = w * (lines.length > 1 ? 0.36 : 0.58);
  g.save(); g.translate(w / 2, top + w * 0.2 + room / 2); g.rotate(Math.PI / 2);
  g.fillStyle = game.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    let px = across / 0.72;
    g.font = `800 ${px}px ${SANS}`;
    const wd = g.measureText(l).width, squeeze = Math.min(1, room * 0.94 / wd);
    g.save(); g.translate(0, lines.length > 1 ? (i - 0.5) * px * 1.05 : 0); g.scale(squeeze, 1); g.fillText(l, 0, 0); g.restore();
  });
  g.restore();
  g.font = `600 ${Math.round(w * 0.42)}px ${MONO}`; g.fillStyle = game.ink; g.globalAlpha = 0.8; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n).padStart(2, '0'), w / 2, h - w * 0.55);
  g.globalAlpha = 1;
  grain(g, r, w, h, 0.04);
  g.restore();
}

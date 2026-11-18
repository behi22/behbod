// Paintings in the manner of Persian miniatures, drawn with the 2D canvas: flat colour, gold skies, outlined rocks,
// figures and horses in profile. The reader's pictures, the desktop's wallpapers and the Haft Khan game are made from
// these pieces. Every function draws in its own units; `cover` fits a scene to any box.
export const C = {
  ink: '#2a1d14', gold: '#d9ad4a', goldHi: '#f0d27c', goldLo: '#a77c25', lapis: '#1d3a85', lapisLo: '#122554', night: '#0c1430',
  ochre: '#d3923a', saffron: '#e8b04a', vermilion: '#c43d2b', rose: '#d98c84', lilac: '#a58bb5', jade: '#3f8f5f', jadeLo: '#2b6a45',
  teal: '#2b9c97', ivory: '#f4ead0', paper: '#eadcb5', skin: '#efc9a0', white: '#f7f3ea', stone: '#b9a68a', black: '#1b1714',
};
export const FA_FONT = "'Noto Nastaliq Urdu', serif";

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const TAU = Math.PI * 2;
function path(g, pts, close = true) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
}
// A smooth closed shape through points (Catmull-Rom as curves).
function blob(g, pts) {
  const n = pts.length, P = i => pts[(i + n) % n];
  g.beginPath(); g.moveTo(P(0)[0], P(0)[1]);
  for (let i = 0; i < n; i++) {
    const [a, b, c, d] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    g.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
  g.closePath();
}
function fillLine(g, fill, line = C.ink, w = 1.4) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (line) { g.strokeStyle = line; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
}
const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); };
function limb(g, pts, w, colour) {
  g.strokeStyle = C.ink; g.lineWidth = w + 2.2; g.lineCap = 'round'; g.lineJoin = 'round'; path(g, pts, false); g.stroke();
  g.strokeStyle = colour; g.lineWidth = w; path(g, pts, false); g.stroke();
}

// Draws `fn` (which paints a bw by bh scene) to cover a w by h box, centred, cropping what spills over.
export function cover(g, w, h, bw, bh, fn, focusY = 0.5) {
  const k = Math.max(w / bw, h / bh);
  g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
  g.translate((w - bw * k) / 2, Math.min(0, Math.max(h - bh * k, h / 2 - bh * k * focusY))); g.scale(k, k);
  fn(g);
  g.restore();
}

// ---------- the ground, the sky, rocks, trees ----------
export function goldSky(g, w, h) {
  const s = g.createLinearGradient(0, 0, 0, h);
  s.addColorStop(0, C.goldHi); s.addColorStop(1, C.gold);
  g.fillStyle = s; g.fillRect(0, 0, w, h);
}
export function nightSky(g, w, h, seed = 3, stars = 60) {
  const s = g.createLinearGradient(0, 0, 0, h);
  s.addColorStop(0, C.night); s.addColorStop(1, C.lapis);
  g.fillStyle = s; g.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < stars; i++) { g.fillStyle = `rgba(255,240,200,${0.35 + r() * 0.6})`; g.beginPath(); g.arc(r() * w, r() * h * 0.7, 0.6 + r() * 1.4, 0, TAU); g.fill(); }
}
// A curling cloud, the Chinese-style band clouds of the miniatures.
export function cloud(g, x, y, s, colour = C.white) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(-40, 0);
  g.bezierCurveTo(-40, -14, -22, -16, -16, -6); g.bezierCurveTo(-12, -20, 8, -22, 12, -8);
  g.bezierCurveTo(18, -18, 38, -14, 36, 0); g.bezierCurveTo(30, 8, 14, 4, 10, 2); g.bezierCurveTo(4, 8, -14, 8, -18, 2); g.bezierCurveTo(-26, 8, -40, 8, -40, 0);
  g.closePath(); fillLine(g, colour, 'rgba(42,29,20,.55)', 1.4);
  g.strokeStyle = 'rgba(42,29,20,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(-4, -4, 6, 0.4, 3.6); g.stroke();
  g.restore();
}
// Ground from y down, a gently rolling top edge, dotted with tufts and flowers.
export function ground(g, w, y, h, colour, seed = 1, flowers = true) {
  const r = rng(seed);
  g.beginPath(); g.moveTo(0, h); g.lineTo(0, y);
  for (let x = 0; x <= w; x += w / 6) g.quadraticCurveTo(x + w / 12, y + (r() - 0.5) * 18, x + w / 6, y + (r() - 0.5) * 8);
  g.lineTo(w, h); g.closePath(); fillLine(g, colour, C.ink, 1.2);
  if (!flowers) return;
  for (let i = 0; i < w / 14; i++) {
    const fx = r() * w, fy = y + 14 + r() * (h - y - 18);
    g.strokeStyle = C.jadeLo; g.lineWidth = 1.2; g.beginPath();
    for (const a of [-0.5, 0, 0.5]) { g.moveTo(fx, fy); g.lineTo(fx + a * 7, fy - 7); }
    g.stroke();
    if (r() < 0.45) { g.fillStyle = [C.vermilion, C.white, C.saffron, C.rose][Math.floor(r() * 4)]; g.beginPath(); g.arc(fx, fy - 8, 2.2, 0, TAU); g.fill(); }
  }
}
// The lumpy, outlined rocks of the miniatures, piled into a hill or a peak: x, base y, width, height.
export function rocks(g, x, y, w, h, colour, seed = 2, steps = 5) {
  const r = rng(seed), lumps = [];
  // Lumps scattered through a peak's outline, wide at the foot and narrow at the top, drawn from the top down so the
  // nearer ones overlap the ones behind.
  for (let i = 0; i < steps * 4; i++) {
    const k = Math.pow(r(), 0.8), cy = y - h * k, half = w / 2 * (1 - k * 0.82);
    const size = (w * 0.16 + r() * w * 0.1) * (1 - k * 0.55);
    lumps.push({ cx: x + (r() * 2 - 1) * Math.max(0, half - size * 0.5), cy: cy + size * 0.3, size, tone: r() });
  }
  lumps.push({ cx: x, cy: y - h + w * 0.05, size: w * 0.1, tone: 0.5 });
  lumps.sort((a, b) => a.cy - b.cy);
  for (const L of lumps) {
    const pts = [];
    for (let a = 0; a < 9; a++) { const t = a / 9 * TAU, rr = L.size * (0.75 + r() * 0.3); pts.push([L.cx + Math.cos(t) * rr, L.cy + Math.sin(t) * rr * 0.72]); }
    blob(g, pts); fillLine(g, shade(colour, 0.84 + L.tone * 0.24), C.ink, 1.3);
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(L.cx - L.size * 0.2, L.cy - L.size * 0.15, L.size * 0.38, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
  }
  // The foot of the pile sits flat on the ground.
  g.fillStyle = shade(colour, 0.9); g.fillRect(x - w / 2, y - 2, w, 2);
}
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
export function cypress(g, x, y, h) {
  blob(g, [[x, y - h], [x + h * 0.11, y - h * 0.6], [x + h * 0.1, y - h * 0.12], [x, y], [x - h * 0.1, y - h * 0.12], [x - h * 0.11, y - h * 0.6]]);
  fillLine(g, C.jadeLo, C.ink, 1.2);
  g.strokeStyle = 'rgba(160,220,170,.35)'; g.lineWidth = 1;
  for (let i = 1; i < 7; i++) { const yy = y - h * i / 7; g.beginPath(); g.moveTo(x - h * 0.05, yy + 6); g.lineTo(x, yy); g.lineTo(x + h * 0.05, yy + 6); g.stroke(); }
}
// A blossoming tree: a crooked trunk and round clusters of leaves with white and pink flowers.
export function tree(g, x, y, s, seed = 4) {
  const r = rng(seed);
  limb(g, [[x, y], [x - 4 * s, y - 30 * s], [x + 3 * s, y - 56 * s]], 6 * s, '#6b4a2c');
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6, d = 18 * s + r() * 14 * s;
    ell(g, x + Math.cos(a) * d, y - 62 * s + Math.sin(a) * d * 0.7, 14 * s, 11 * s); fillLine(g, i % 2 ? C.jade : C.jadeLo, C.ink, 1);
  }
  for (let i = 0; i < 14; i++) { g.fillStyle = r() < 0.5 ? C.white : C.rose; g.beginPath(); g.arc(x + (r() - 0.5) * 60 * s, y - 62 * s + (r() - 0.6) * 44 * s, 2 * s, 0, TAU); g.fill(); }
}

// ---------- people, horses, beasts ----------
// A figure in profile from the feet up, about 100 units tall at s = 1, facing right (dir -1: left).
// o: robe, coat ('tiger' for Rostam's tiger-skin), head ('helmet', 'turban', 'crown', 'veil'), beard, arm ('down', 'up', 'forward'),
// hold ('mace', 'sword', 'lasso', 'lute'), skin.
export function figure(g, x, y, s, o = {}) {
  const dir = o.dir || 1, robe = o.robe || C.vermilion, skin = o.skin || C.skin;
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  // Legs and boots under the robe.
  if (!o.seated) { g.fillStyle = C.black; g.fillRect(-9, -8, 7, 8); g.fillRect(2, -8, 7, 8); }
  // The robe, wider at the hem.
  const hem = o.seated ? -40 : -6;
  path(g, [[-11, -74], [11, -74], [17, hem], [-17, hem]]); fillLine(g, robe, C.ink, 1.4);
  if (o.coat === 'tiger') {
    path(g, [[-12, -72], [12, -72], [15, -30], [-15, -30]]); fillLine(g, C.saffron, C.ink, 1.2);
    g.strokeStyle = '#3b2412'; g.lineWidth = 2.2;
    for (const [a, b] of [[-8, -64], [2, -58], [-5, -48], [6, -42], [-9, -38]]) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(a + 3, b - 4, a + 6, b); g.stroke(); }
  }
  if (!o.seated) { g.strokeStyle = C.goldLo; g.lineWidth = 3; g.beginPath(); g.moveTo(-12, -46); g.lineTo(12, -46); g.stroke(); }
  // The far arm, then the head, then the near arm on top.
  const arm = o.arm || 'down';
  const hand = arm === 'up' ? [14, -102] : arm === 'forward' ? [26, -62] : [6, -36];
  limb(g, [[2, -70], [arm === 'up' ? 10 : 8, arm === 'up' ? -86 : -54], hand], 6, robe);
  ell(g, hand[0], hand[1], 3.4, 3.4); fillLine(g, skin, C.ink, 1);
  if (o.hold === 'mace') {
    limb(g, [[hand[0] - 2, hand[1] + 10], [hand[0] + 4, hand[1] - 22]], 2.4, '#7a5a30');
    ell(g, hand[0] + 5, hand[1] - 26, 7, 6); fillLine(g, C.gold, C.ink, 1.2);
    g.fillStyle = C.ink; g.beginPath(); g.arc(hand[0] + 8, hand[1] - 27, 1.2, 0, TAU); g.fill();
  } else if (o.hold === 'sword') {
    limb(g, [[hand[0], hand[1]], [hand[0] + 6, hand[1] - 40]], 2, '#d8dde3');
  } else if (o.hold === 'lasso') {
    g.strokeStyle = '#c9a36a'; g.lineWidth = 2; g.beginPath(); g.ellipse(hand[0] + 6, hand[1] - 10, 9, 13, 0.4, 0, TAU); g.stroke();
  }
  // Head and neck.
  ell(g, 2, -84, 8.5, 9.5); fillLine(g, skin, C.ink, 1.3);
  path(g, [[9, -86], [12, -83], [9, -81]], false); g.strokeStyle = C.ink; g.lineWidth = 1; g.stroke();
  g.fillStyle = C.ink; g.beginPath(); g.arc(6, -87, 1.1, 0, TAU); g.fill();
  if (o.beard) { blob(g, [[-3, -82], [9, -80], [8, -72], [2, -66], [-3, -72]]); fillLine(g, o.beard, C.ink, 1); }
  const head = o.head || 'turban';
  if (head === 'helmet') {
    blob(g, [[-9, -88], [-4, -98], [4, -99], [10, -90], [10, -86], [-9, -86]]); fillLine(g, '#9aa3ad', C.ink, 1.2);
    path(g, [[0, -98], [1, -108], [2, -98]]); fillLine(g, C.gold, C.ink, 1);
    path(g, [[-9, -86], [-11, -74], [-3, -74], [-3, -86]]); fillLine(g, '#7c858f', C.ink, 1);
  } else if (head === 'turban') {
    blob(g, [[-10, -88], [-6, -98], [6, -99], [11, -90], [8, -86], [-9, -85]]); fillLine(g, o.turban || C.white, C.ink, 1.2);
    g.strokeStyle = 'rgba(42,29,20,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-8, -91); g.quadraticCurveTo(0, -96, 9, -91); g.stroke();
  } else if (head === 'crown') {
    path(g, [[-8, -90], [-8, -100], [-4, -95], [0, -103], [4, -95], [8, -100], [8, -90]]); fillLine(g, C.gold, C.ink, 1.1);
  } else if (head === 'veil') {
    blob(g, [[-11, -88], [-4, -98], [6, -97], [10, -88], [4, -86], [-13, -60], [-16, -70]]); fillLine(g, o.veil || C.white, C.ink, 1.1);
  }
  limb(g, [[-2, -70], [-6, -50], [-2, -36]], 6, robe);
  g.restore();
}

// A horse in profile facing right, its hooves on y; about 110 units long at s = 1. o: colour, spots, gallop, mane, saddle.
export function horse(g, x, y, s, o = {}) {
  const dir = o.dir || 1, col = o.colour || '#8a5a32', dark = shade(col, 0.6), gal = o.gallop ? 1 : 0;
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  const legs = gal
    ? [[[-30, -52], [-44, -30], [-52, -14]], [[-24, -52], [-34, -28], [-30, -8]], [[24, -54], [40, -40], [52, -46]], [[30, -52], [44, -34], [56, -30]]]
    : [[[-30, -52], [-32, -24], [-30, 0]], [[-22, -52], [-20, -24], [-18, 0]], [[22, -54], [24, -26], [24, 0]], [[30, -52], [32, -26], [34, 0]]];
  // The far legs a shade darker, behind the body.
  for (const l of [legs[0], legs[2]]) limb(g, l, 6.5, dark);
  // The tail.
  g.strokeStyle = C.ink; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(-36, -64); g.bezierCurveTo(-56, -64, -58, -40, -54 + gal * -10, -24 + gal * -10); g.stroke();
  g.strokeStyle = o.mane || dark; g.lineWidth = 6.5; g.stroke();
  // Body, chest and neck as one outline.
  blob(g, [[-38, -62], [-20, -72], [10, -72], [28, -78], [40, -100], [48, -108], [58, -104], [70, -86], [66, -80], [52, -88], [44, -70], [36, -48], [10, -46], [-24, -46], [-38, -52]]);
  fillLine(g, col, C.ink, 1.5);
  if (o.spots) { const r = rng(9); g.fillStyle = o.spots; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(-30 + r() * 62, -66 + r() * 16, 1.6 + r() * 2, 0, TAU); g.fill(); } }
  // Mane, ear, eye, nostril.
  g.strokeStyle = o.mane || dark; g.lineWidth = 4; g.beginPath(); g.moveTo(28, -80); g.quadraticCurveTo(38, -98, 50, -106); g.stroke();
  path(g, [[50, -106], [52, -116], [56, -105]]); fillLine(g, col, C.ink, 1.1);
  g.fillStyle = C.ink; g.beginPath(); g.arc(57, -99, 1.6, 0, TAU); g.fill(); g.beginPath(); g.arc(67, -85, 1.1, 0, TAU); g.fill();
  if (o.saddle !== false) {
    blob(g, [[-14, -72], [12, -73], [14, -58], [-14, -57]]); fillLine(g, o.saddle || C.vermilion, C.ink, 1.2);
    g.strokeStyle = C.gold; g.lineWidth = 2; g.beginPath(); g.moveTo(-13, -60); g.lineTo(13, -61); g.stroke();
    g.strokeStyle = C.ink; g.lineWidth = 1.2; g.beginPath(); g.moveTo(66, -84); g.lineTo(40, -82); g.lineTo(14, -70); g.stroke();
  }
  for (const l of [legs[1], legs[3]]) limb(g, l, 7, col);
  for (const l of legs) { const [hx, hy] = l[2]; g.fillStyle = C.black; g.fillRect(hx - 4, hy - 4, 8, 4); }
  g.restore();
}
// A rider on a horse: the horse's scale s, the rider's options o, the horse's h.
export function rider(g, x, y, s, o = {}, h = {}) {
  horse(g, x, y, s, h);
  const dir = h.dir || 1;
  figure(g, x - 2 * s * dir, y - 58 * s, s * 0.8, { ...o, seated: true, dir });
  // The rider's leg down the horse's side.
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  limb(g, [[-2, -66], [4, -50], [0, -34]], 7, o.robe || C.vermilion);
  g.fillStyle = C.black; g.fillRect(-4, -36, 9, 5);
  g.restore();
}
export function lion(g, x, y, s, o = {}) {
  const dir = o.dir || 1, leap = o.leap ? 1 : 0;
  g.save(); g.translate(x, y); g.scale(s * dir, s); g.rotate(-0.28 * leap);
  const legs = leap ? [[[-26, -26], [-42, -14], [-54, -12]], [[24, -28], [42, -36], [52, -30]]] : [[[-24, -26], [-26, -12], [-24, 0]], [[22, -26], [24, -12], [26, 0]]];
  for (const l of legs) limb(g, l, 7, '#b77a2e');
  g.strokeStyle = C.ink; g.lineWidth = 4.5; g.beginPath(); g.moveTo(-32, -34); g.bezierCurveTo(-48, -40, -50, -60, -40, -62); g.stroke();
  g.strokeStyle = '#c98b3a'; g.lineWidth = 2.5; g.stroke();
  ell(g, -40, -63, 4, 5); fillLine(g, '#5a3414', C.ink, 1);
  ell(g, 0, -34, 34, 14); fillLine(g, '#d39a48', C.ink, 1.4);
  // Mane as a ring of flames round the head.
  const pts = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = i % 2 ? 15 : 21; pts.push([30 + Math.cos(a) * r, -44 + Math.sin(a) * r]); }
  blob(g, pts); fillLine(g, '#8a4d1c', C.ink, 1.3);
  ell(g, 34, -44, 11, 10); fillLine(g, '#e0aa58', C.ink, 1.2);
  g.fillStyle = C.ink; g.beginPath(); g.arc(38, -47, 1.6, 0, TAU); g.fill();
  path(g, [[40, -40], [46, -38], [40, -36]]); fillLine(g, C.vermilion, C.ink, 0.8);
  for (const l of leap ? [[[-20, -26], [-36, -10], [-48, -4]], [[30, -26], [50, -30], [62, -22]]] : [[[-18, -26], [-18, -12], [-16, 0]], [[28, -26], [30, -12], [32, 0]]]) limb(g, l, 7.5, '#d39a48');
  g.restore();
}
// A dragon: a long coiling body along a curve from its tail to its raised head at the end. `k` 0..1 how much shows.
export function dragon(g, x, y, s, o = {}) {
  const dir = o.dir || 1;
  g.save(); g.translate(x, y); g.scale(s * dir, s); g.globalAlpha *= o.alpha ?? 1;
  const spine = [[-120, -10], [-80, -40], [-40, -10], [0, -40], [30, -70], [50, -92]];
  g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(...spine[0]); for (let i = 1; i < spine.length - 1; i++) { const m = [(spine[i][0] + spine[i + 1][0]) / 2, (spine[i][1] + spine[i + 1][1]) / 2]; g.quadraticCurveTo(spine[i][0], spine[i][1], m[0], m[1]); } g.lineTo(...spine.at(-1)); g.stroke(); };
  stroke(26, C.ink); stroke(22, '#3f7d4a'); stroke(8, '#d8c56a');
  // Spines along its back.
  for (let i = 0; i < 9; i++) {
    const t = i / 9, a = spine[Math.floor(t * 5)], b = spine[Math.floor(t * 5) + 1], u = t * 5 % 1;
    const px = a[0] + (b[0] - a[0]) * u, py = a[1] + (b[1] - a[1]) * u - 12;
    path(g, [[px - 5, py + 3], [px, py - 9], [px + 5, py + 3]]); fillLine(g, C.vermilion, C.ink, 1);
  }
  // The head, jaws open, a flicker of fire.
  blob(g, [[40, -96], [58, -110], [80, -104], [90, -94], [72, -90], [86, -82], [66, -78], [46, -84]]); fillLine(g, '#3f7d4a', C.ink, 1.4);
  g.fillStyle = '#f2e27a'; g.beginPath(); g.arc(66, -101, 3, 0, TAU); g.fill(); g.fillStyle = C.ink; g.beginPath(); g.arc(67, -101, 1.3, 0, TAU); g.fill();
  path(g, [[56, -110], [52, -124], [62, -112]]); fillLine(g, C.vermilion, C.ink, 1);
  if (o.fire) { path(g, [[88, -88], [112, -98], [104, -88], [118, -84], [102, -80], [110, -72], [88, -84]]); fillLine(g, C.saffron, C.vermilion, 1.4); }
  g.restore();
}
// A div: a big horned figure with spotted skin. o.colour, o.size.
export function div(g, x, y, s, o = {}) {
  const dir = o.dir || 1, col = o.colour || '#5b6f8f', spot = o.spot || shade(col, 0.7);
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  for (const l of [[[-10, -50], [-14, -24], [-12, 0]], [[10, -50], [14, -24], [14, 0]]]) limb(g, l, 12, col);
  blob(g, [[-22, -112], [22, -112], [26, -70], [18, -48], [-18, -48], [-26, -70]]); fillLine(g, col, C.ink, 1.6);
  blob(g, [[-20, -58], [20, -58], [24, -36], [-24, -36]]); fillLine(g, C.saffron, C.ink, 1.2);
  g.strokeStyle = '#3b2412'; g.lineWidth = 2; for (const a of [-14, -2, 10]) { g.beginPath(); g.moveTo(a, -54); g.quadraticCurveTo(a + 3, -48, a + 6, -54); g.stroke(); }
  const r = rng(5); g.fillStyle = spot; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(-18 + r() * 36, -108 + r() * 48, 1.8 + r() * 2.2, 0, TAU); g.fill(); }
  const arm = o.arm || 'down';
  limb(g, arm === 'up' ? [[16, -104], [34, -122], [30, -146]] : [[16, -104], [32, -84], [34, -60]], 10, col);
  limb(g, [[-16, -104], [-30, -84], [-30, -62]], 10, col);
  ell(g, 0, -126, 15, 16); fillLine(g, col, C.ink, 1.5);
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 8, -138); g.quadraticCurveTo(sx * 18, -154, sx * 10, -164); g.quadraticCurveTo(sx * 13, -150, sx * 3, -140); g.closePath(); fillLine(g, C.ivory, C.ink, 1.2); }
  g.fillStyle = '#f2d24a'; for (const sx of [-6, 6]) { g.beginPath(); g.arc(sx, -128, 3, 0, TAU); g.fill(); }
  g.fillStyle = C.ink; for (const sx of [-6, 6]) { g.beginPath(); g.arc(sx, -128, 1.3, 0, TAU); g.fill(); }
  path(g, [[-7, -117], [7, -117], [5, -113], [-5, -113]]); fillLine(g, C.vermilion, C.ink, 1);
  for (const sx of [-4, 4]) { path(g, [[sx - 1.5, -117], [sx, -122], [sx + 1.5, -117]]); fillLine(g, C.ivory, null); }
  g.restore();
}
// The Simorgh: wings spread, a crested head, long ribbon tail feathers in many colours. Facing right, centred on x, y.
export function simorgh(g, x, y, s, o = {}) {
  const dir = o.dir || 1, flap = o.flap || 0;
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  const tails = [[C.vermilion, -10], [C.teal, 0], [C.gold, 12], [C.lapis, 22], [C.rose, 32]];
  for (const [c, k] of tails) {
    g.strokeStyle = C.ink; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-30, 6); g.bezierCurveTo(-90, 10 + k, -120, 60 + k * 1.6, -180 - k, 30 + k * 2); g.bezierCurveTo(-210, 10 + k, -200, -20 + k, -175, -8 + k); g.stroke();
    g.strokeStyle = c; g.lineWidth = 6; g.stroke();
    g.fillStyle = c; g.beginPath(); g.arc(-175, -8 + k, 6, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke();
  }
  // Two wings raised over the back: an arm from the shoulder to the wrist, long flight feathers fanning back from it.
  const wing = (sx, sy, wx, wy, k, far) => {
    const feathers = 9;
    for (let i = feathers - 1; i >= 0; i--) {
      const t = i / (feathers - 1), bx = sx + (wx - sx) * (0.25 + 0.75 * t), by = sy + (wy - sy) * (0.25 + 0.75 * t);
      const ang = -2.2 - t * 0.9 + flap * 0.2, len = k * (46 + 52 * t);
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      const nx = -Math.sin(ang) * 7 * k, ny = Math.cos(ang) * 7 * k;
      g.beginPath(); g.moveTo(bx, by);
      g.quadraticCurveTo((bx + ex) / 2 + nx, (by + ey) / 2 + ny, ex, ey);
      g.quadraticCurveTo((bx + ex) / 2 - nx, (by + ey) / 2 - ny, bx, by);
      fillLine(g, far ? shade(i % 2 ? C.vermilion : C.gold, 0.8) : i % 2 ? C.vermilion : C.gold, C.ink, 1.1);
      g.strokeStyle = 'rgba(42,29,20,.45)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    }
    blob(g, [[sx - 6, sy + 6], [sx + 4, sy - 6], [wx + 6, wy - 4], [wx - 4, wy + 2], [(sx + wx) / 2 - 18, (sy + wy) / 2 + 14]]);
    fillLine(g, far ? shade(C.teal, 0.8) : C.teal, C.ink, 1.2);
    for (let i = 1; i < 4; i++) { const t = i / 4; g.strokeStyle = 'rgba(244,234,208,.6)'; g.lineWidth = 1; g.beginPath(); g.arc(sx + (wx - sx) * t - 4, sy + (wy - sy) * t + 6, 6, 0.2, 2.6); g.stroke(); }
  };
  wing(-4, -18, -30 - flap * 10, -96 + flap * 30, 1, true);
  blob(g, [[-34, 4], [-10, -22], [20, -26], [36, -12], [28, 10], [-6, 18]]); fillLine(g, C.gold, C.ink, 1.5);
  wing(8, -16, 4 - flap * 8, -104 + flap * 32, 1.08, false);
  // Neck, head and crest.
  blob(g, [[22, -20], [36, -46], [50, -58], [62, -52], [56, -40], [40, -14]]); fillLine(g, C.teal, C.ink, 1.3);
  path(g, [[60, -54], [74, -50], [60, -46]]); fillLine(g, C.saffron, C.ink, 1.1);
  g.fillStyle = C.ink; g.beginPath(); g.arc(55, -52, 1.8, 0, TAU); g.fill();
  for (const [a, b] of [[48, -58], [44, -60], [40, -61]]) { g.strokeStyle = C.vermilion; g.lineWidth = 2; g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo(a - 6, b - 12, a - 14, b - 14); g.stroke(); }
  g.restore();
}
export function flames(g, x, y, w, h, t = 0, seed = 7) {
  const r = rng(seed), n = Math.max(3, Math.round(w / 22));
  for (const [c, k] of [[C.vermilion, 1], [C.saffron, 0.72], ['#f7e08a', 0.42]]) {
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i <= n; i++) {
      const fx = x + w * i / n, tip = h * k * (0.7 + 0.3 * Math.sin(t * 6 + i * 1.7 + r() * 3));
      g.quadraticCurveTo(fx - w / n * 0.5, y - tip * 0.4, fx - w / n * 0.25, y - tip);
      g.quadraticCurveTo(fx, y - tip * 0.5, fx, y - h * 0.15 * k);
    }
    g.lineTo(x + w, y); g.closePath(); fillLine(g, c, k === 1 ? C.ink : null, 1.2);
  }
}
export function goblet(g, x, y, s, colour = C.gold) {
  g.save(); g.translate(x, y); g.scale(s, s);
  path(g, [[-16, -60], [16, -60], [10, -36], [3, -30], [3, -10], [12, -2], [12, 0], [-12, 0], [-12, -2], [-3, -10], [-3, -30], [-10, -36]]);
  fillLine(g, colour, C.ink, 1.4);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, -55); g.lineTo(-6, -40); g.stroke();
  g.fillStyle = C.vermilion; g.beginPath(); g.arc(0, -46, 3, 0, TAU); g.fill();
  g.restore();
}
// A gold cartouche with a Persian title in Nastaliq, the way miniatures label their scenes.
export function cartouche(g, x, y, w, h, text) {
  g.save();
  blob(g, [[x, y + h / 2], [x + h * 0.4, y], [x + w - h * 0.4, y], [x + w, y + h / 2], [x + w - h * 0.4, y + h], [x + h * 0.4, y + h]]);
  fillLine(g, C.ivory, C.goldLo, 2);
  g.fillStyle = C.ink; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // Nastaliq reaches well above and below its line, so the words are fitted and centred on their inked extent.
  let px = h * 0.5;
  g.font = `500 ${px}px ${FA_FONT}`;
  let m = g.measureText(text);
  const inkW = () => (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width), inkH = () => (m.actualBoundingBoxAscent || px) + (m.actualBoundingBoxDescent || 0);
  const k = Math.min(w * 0.8 / inkW(), h * 0.74 / inkH());
  if (k < 1) { px *= k; g.font = `500 ${px}px ${FA_FONT}`; m = g.measureText(text); }
  const cx = x + w / 2 + ((m.actualBoundingBoxLeft || 0) - (m.actualBoundingBoxRight || 0)) / 2;
  g.fillText(text, cx, y + h / 2 + ((m.actualBoundingBoxAscent || px) - (m.actualBoundingBoxDescent || 0)) / 2);
  g.restore();
}
// The page's border: gold rules with a red line inside and small rosettes in the corners.
export function border(g, w, h, k = 1) {
  g.save();
  const b = 7 * k;
  g.strokeStyle = C.goldLo; g.lineWidth = b * 2; g.strokeRect(0, 0, w, h);
  g.strokeStyle = C.goldHi; g.lineWidth = b * 0.5; g.strokeRect(b * 0.9, b * 0.9, w - b * 1.8, h - b * 1.8);
  g.strokeStyle = C.vermilion; g.lineWidth = 1.2 * k; g.strokeRect(b * 1.6, b * 1.6, w - b * 3.2, h - b * 3.2);
  for (const [cx, cy] of [[b, b], [w - b, b], [b, h - b], [w - b, h - b]]) {
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.fillStyle = i % 2 ? C.vermilion : C.lapis; g.beginPath(); g.arc(cx + Math.cos(a) * b * 0.7, cy + Math.sin(a) * b * 0.7, b * 0.32, 0, TAU); g.fill(); }
    g.fillStyle = C.goldHi; g.beginPath(); g.arc(cx, cy, b * 0.4, 0, TAU); g.fill();
  }
  g.restore();
}

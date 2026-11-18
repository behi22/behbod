// Drawn in a 768 x 1024 design space and scaled to whatever canvas it is given.
export const DESIGN = [768, 1024];

const INK = '#2b1a10', LAPIS = '#1d3888', GOLD = '#d4a43e', GOLD_L = '#efce78', GOLD_D = '#9c7022';
const CREAM = '#efe2c3', RED = '#b8352a', SKIN = '#efc7a2', TIGER = '#dd8a2e', DIV = '#f3f0e7', MAIL = '#8d97ab';
const ROCKS = [['#bba4cc', '#8d77a3'], ['#e3a99e', '#b0756c'], ['#a5cfb6', '#6f9c84'], ['#dcc38c', '#a98f59'], ['#aab9d1', '#76879f']];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// A smooth closed (or open) path through points, added to the current path.
function trace(g, pts, closed = true) {
  const n = pts.length;
  if (!closed) {
    g.moveTo(...pts[0]);
    for (let i = 1; i < n - 1; i++) { const m = mid(pts[i], pts[i + 1]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    g.lineTo(...pts[n - 1]);
    return;
  }
  const m0 = mid(pts[n - 1], pts[0]);
  g.moveTo(...m0);
  for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  g.closePath();
}
// A tapered limb from a to b, wa and wb wide, as a closed path.
function capsule(g, a, b, wa, wb) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, t = Math.atan2(ny, nx);
  g.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2);
  g.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
  g.arc(b[0], b[1], wb / 2, t, t - Math.PI, true);
  g.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2);
  g.arc(a[0], a[1], wa / 2, t + Math.PI, t, true);
  g.closePath();
}
const shapeOf = s => g => (s.limb ? capsule(g, ...s.limb) : s.circle ? g.arc(s.circle[0], s.circle[1], s.circle[2], 0, Math.PI * 2) : s.ellipse ? g.ellipse(...s.ellipse, 0, Math.PI * 2) : trace(g, s.pts));
// Every piece is stroked before any is filled, so the outline goes round the part and not where its pieces join.
function part(g, pieces, fill, { line = INK, lw = 2.2, pattern = null } = {}) {
  const fns = pieces.map(shapeOf);
  if (line) { g.strokeStyle = line; g.lineWidth = lw * 2; g.lineJoin = 'round'; for (const f of fns) { g.beginPath(); f(g); g.stroke(); } }
  g.fillStyle = fill;
  for (const f of fns) { g.beginPath(); f(g); g.fill(); }
  if (pattern) for (const f of fns) { g.save(); g.beginPath(); f(g); g.clip(); pattern(g); g.restore(); }
}
const stroke = (g, pts, color, w, closed = false) => { g.beginPath(); trace(g, pts, closed); g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.stroke(); };

// ---------- the border: a lapis band with a gold vine, rosettes at the corners, then the rules ----------
function border(g, W, H) {
  g.fillStyle = LAPIS; g.fillRect(0, 0, W, H);
  const r = rng(11);
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < 1400; i++) g.fillRect(r() * W, r() * H, 1.5, 1.5);
  const B = 56, mids = [[B / 2, B / 2, W - B / 2, B / 2], [W - B / 2, B / 2, W - B / 2, H - B / 2], [W - B / 2, H - B / 2, B / 2, H - B / 2], [B / 2, H - B / 2, B / 2, B / 2]];
  g.strokeStyle = GOLD; g.fillStyle = GOLD; g.lineCap = 'round';
  for (const [x0, y0, x1, y1] of mids) {
    const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux, step = 58, A = 10;
    const at = (s, o) => [x0 + ux * s + nx * o, y0 + uy * s + ny * o];
    g.lineWidth = 2.4; g.beginPath();
    for (let s = 34; s <= len - 34; s += 2) { const p = at(s, A * Math.sin((s - 34) / step * Math.PI * 2)); s === 34 ? g.moveTo(...p) : g.lineTo(...p); }
    g.stroke();
    // A spiral tendril from each crest, ending in a little three-lobed leaf, alternating sides.
    for (let s = 34 + step / 4, k = 0; s < len - 40; s += step / 2, k++) {
      const side = k % 2 ? -1 : 1, pts = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16, a = t * Math.PI * 1.6, rr = 13 * (1 - t * 0.75); pts.push(at(s + side * (Math.sin(a) * rr) + 6 * t, side * (A - 2 + (1 - Math.cos(a)) * rr * 0.9))); }
      g.lineWidth = 1.6; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke();
      const [lx, ly] = at(s + step / 4 * 0.55, -side * (A + 4));
      for (const [dx, dy, rr] of [[0, 0, 3.6], [ux * 4 + nx * 2.5, uy * 4 + ny * 2.5, 2.6], [-ux * 4 + nx * 2.5, -uy * 4 + ny * 2.5, 2.6]]) { g.beginPath(); g.arc(lx + dx * side, ly + dy * side, rr, 0, 7); g.fill(); }
    }
  }
  for (const [x, y] of [[B / 2, B / 2], [W - B / 2, B / 2], [W - B / 2, H - B / 2], [B / 2, H - B / 2]]) {
    g.fillStyle = GOLD;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.ellipse(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 8, 4.5, a, 0, 7); g.fill(); }
    g.beginPath(); g.arc(x, y, 8.5, 0, 7); g.fill();
    g.fillStyle = RED; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    g.fillStyle = GOLD_L; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill();
  }
  // The rules: gold, cream, a red hairline, cream, then the picture.
  const rule = (o, c) => { g.fillStyle = c; g.fillRect(o, o, W - 2 * o, H - 2 * o); };
  rule(B, GOLD); rule(B + 4, CREAM); rule(B + 7, RED); rule(B + 8.5, CREAM); rule(B + 11, INK); rule(B + 12, GOLD_L);
  return B + 13;
}

// ---------- the picture ----------
// One rock form: a leaning, lumpy mound like the spongy rocks of the old paintings, with contour lines inside it.
function rockForm(g, x, y, rx, ry, [fill, dark], seed, lean = 0) {
  const r = rng(seed), ph = [r() * 6, r() * 6, r() * 6], pts = [];
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, top = Math.max(0, -Math.sin(a));
    const k = 1 + top * (0.1 * Math.sin(5 * a + ph[0]) + 0.06 * Math.sin(11 * a + ph[1]) + 0.035 * Math.sin(19 * a + ph[2]));
    const yy = Math.sin(a) > 0 ? Math.sin(a) * 0.55 : Math.sin(a);
    pts.push([x + Math.cos(a) * rx * k + lean * (-yy) * ry, y + yy * ry * k]);
  }
  const ring = s => pts.map(([px, py]) => [x + (px - x) * s, y + ry * 0.35 + (py - y - ry * 0.35) * s]);
  g.beginPath(); trace(g, pts); g.fillStyle = fill; g.fill();
  g.save(); g.beginPath(); trace(g, pts); g.clip();
  const grd = g.createLinearGradient(x - rx, y - ry, x + rx * 0.6, y + ry * 0.6);
  grd.addColorStop(0, 'rgba(255,255,255,0.22)'); grd.addColorStop(0.55, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(40,20,40,0.2)');
  g.fillStyle = grd; g.fillRect(x - rx * 1.6, y - ry * 1.4, rx * 3.2, ry * 2.8);
  g.strokeStyle = dark; g.globalAlpha = 0.55;
  for (const s of [0.78, 0.56, 0.34]) { g.lineWidth = 1.1; g.beginPath(); trace(g, ring(s)); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = dark;
  for (let i = 0; i < (rx * ry) / 260; i++) { const a = r() * 6.28, d = Math.sqrt(r()); g.beginPath(); g.arc(x + Math.cos(a) * rx * d * 0.8, y + Math.sin(a) * ry * d * 0.7, 0.7 + r(), 0, 7); g.fill(); }
  g.restore();
  g.beginPath(); trace(g, pts); g.strokeStyle = dark; g.lineWidth = 1.8; g.stroke();
  g.beginPath(); trace(g, ring(0.93).slice(36, 60), false); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.6; g.stroke();
}
function rocks(g, list, seed) { list.forEach(([x, y, rx, ry, k, lean = 0], i) => rockForm(g, x, y, rx, ry, ROCKS[k], seed + i * 7, lean)); }

function cloud(g, x, y, s, flip = 1) {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 3.2; pts.push([x + flip * (t * 120 - 60) * s + flip * Math.cos(a) * 12 * s, y + Math.sin(a) * 9 * s - Math.sin(t * Math.PI) * 10 * s]); }
  g.lineCap = 'round';
  stroke(g, pts, '#3f5f9a', 11 * s);
  stroke(g, pts, '#f4f1ea', 7.5 * s);
  for (const [dx, sg] of [[-62, -1], [62, 1]]) {
    const c = [x + flip * dx * s, y + 2 * s];
    g.beginPath(); g.arc(c[0], c[1], 7 * s, 0, 7); g.fillStyle = '#f4f1ea'; g.fill(); g.strokeStyle = '#3f5f9a'; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(c[0] + flip * sg * 2 * s, c[1], 3 * s, 0, 7); g.strokeStyle = '#3f5f9a'; g.lineWidth = 1.4; g.stroke();
  }
}

function flowers(g, x0, y0, x1, y1, n, seed) {
  const r = rng(seed), cols = ['#f6f1e6', '#d9443a', '#3a5fb0', '#f1c75b', '#e48aa6'];
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), h = 10 + r() * 16, c = cols[(r() * cols.length) | 0];
    g.strokeStyle = '#3f6a35'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 3, y - h / 2, x + (r() - 0.5) * 4, y - h); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 4, y - h * 0.35, 4, 1.6, s * 0.6, 0, 7); g.fillStyle = '#4c7d3f'; g.fill(); }
    g.fillStyle = c;
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; g.beginPath(); g.arc(x + Math.cos(a) * 2.8, y - h + Math.sin(a) * 2.8, 2.3, 0, 7); g.fill(); }
    g.fillStyle = '#e9b23c'; g.beginPath(); g.arc(x, y - h, 1.4, 0, 7); g.fill();
  }
  // Tufts of grass.
  g.strokeStyle = '#5d8a45'; g.lineWidth = 1.1;
  for (let i = 0; i < n * 1.5; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + k * 2, y - 5, x + k * 3.5, y - 8 - r() * 3); g.stroke(); } }
}

function tree(g, base, seed) {
  const r = rng(seed), [x, y] = base;
  part(g, [{ pts: [[x - 14, y], [x - 9, y - 120], [x - 14, y - 220], [x - 30, y - 290], [x - 14, y - 296], [x + 2, y - 236], [x + 14, y - 300], [x + 26, y - 292], [x + 10, y - 210], [x + 8, y - 110], [x + 16, y]] }], '#7a5434', { lw: 1.8 });
  stroke(g, [[x - 2, y - 20], [x - 4, y - 120], [x - 2, y - 200]], '#5b3b22', 1.6);
  // Leaf clusters: dark masses with lighter five-pointed plane leaves on top.
  const clusters = [[x - 40, y - 330, 54], [x + 30, y - 345, 48], [x - 80, y - 288, 42], [x + 58, y - 292, 38], [x - 10, y - 392, 46], [x - 72, y - 376, 38]];
  const scallop = ([cx, cy, rr]) => [{ circle: [cx, cy, rr * 0.9] }, ...Array.from({ length: 12 }, (_, i) => ({ circle: [cx + Math.cos(i * 0.5236) * rr * 0.86, cy + Math.sin(i * 0.5236) * rr * 0.86, rr * 0.2] }))];
  part(g, clusters.flatMap(scallop), '#2c5634', { line: '#1b3620', lw: 1.3 });
  for (const [cx, cy, rr] of clusters) for (let i = 0; i < rr * 0.7; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rr * 0.85, lx = cx + Math.cos(a) * d, ly = cy + Math.sin(a) * d, s = 3.2 + r() * 2.6, t = r() * Math.PI * 2;
    g.fillStyle = r() < 0.5 ? '#4f8a4a' : '#6ea45a';
    g.beginPath(); g.ellipse(lx, ly, s, s * 0.45, t, 0, 7); g.fill();
    g.strokeStyle = '#24452a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(lx - Math.cos(t) * s, ly - Math.sin(t) * s); g.lineTo(lx + Math.cos(t) * s, ly + Math.sin(t) * s); g.stroke();
  }
}

function stream(g, pts) {
  g.save();
  g.beginPath(); trace(g, pts); g.fillStyle = '#cbd5de'; g.fill(); g.strokeStyle = '#7c8ea3'; g.lineWidth = 2; g.stroke();
  g.clip();
  g.strokeStyle = '#7f94aa'; g.lineWidth = 1.3;
  for (let y = 700; y < 1000; y += 9) { g.beginPath(); for (let x = 0; x < 768; x += 4) { const yy = y + Math.sin(x / 14 + y) * 2.5; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
  g.restore();
}

// Rakhsh, Rostam's horse, standing outside the cave facing it: rose-chestnut, dappled, a red saddle cloth.
function rakhsh(g) {
  const coat = '#c98a63', dark = '#5a2f22', dapple = () => { const r = rng(5); g.fillStyle = 'rgba(255,236,214,0.28)'; for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(520 + r() * 190, 770 + r() * 120, 2 + r() * 4, 0, 7); g.fill(); } };
  part(g, [{ limb: [[640, 868], [652, 928], 15, 10] }, { limb: [[566, 870], [556, 930], 15, 10] }], '#b07a57');
  part(g, [{ ellipse: [608, 838, 82, 40, -0.05] }, { limb: [[548, 830], [512, 770], 46, 30] }, { pts: [[515, 752], [482, 770], [470, 790], [478, 800], [500, 795], [522, 778]] },
    { limb: [[650, 862], [668, 930], 16, 10] }, { limb: [[575, 866], [578, 930], 16, 10] }], coat, { pattern: dapple });
  for (const [x, y] of [[652, 930], [556, 932], [668, 932], [578, 932]]) part(g, [{ ellipse: [x, y, 9, 5, 0] }], '#2c2018', { lw: 1 });
  part(g, [{ pts: [[688, 830], [706, 850], [714, 890], [700, 920], [708, 935], [690, 930], [694, 890], [684, 852]] }], dark, { lw: 1.4 });
  part(g, [{ pts: [[528, 752], [544, 770], [552, 800], [560, 820], [546, 806], [532, 782], [516, 760]] }], dark, { lw: 1.2 });
  part(g, [{ pts: [[574, 812], [636, 808], [650, 846], [640, 872], [584, 874], [570, 846]] }], RED, { lw: 1.6, pattern: g2 => { g2.strokeStyle = GOLD; g2.lineWidth = 3; g2.strokeRect(578, 816, 66, 52); g2.fillStyle = GOLD; for (let i = 0; i < 4; i++) { g2.beginPath(); g2.arc(590 + i * 15, 842, 3, 0, 7); g2.fill(); } } });
  part(g, [{ ellipse: [606, 806, 22, 8, 0] }], '#6b3a1e', { lw: 1.2 });
  stroke(g, [[480, 783], [500, 778], [520, 768]], GOLD_D, 2);
  stroke(g, [[498, 772], [530, 800], [575, 812]], GOLD_D, 1.6);
  g.fillStyle = INK; g.beginPath(); g.arc(497, 773, 2.4, 0, 7); g.fill();
  part(g, [{ pts: [[516, 750], [520, 734], [526, 750]] }], coat, { lw: 1.2 });
}

// The White Div: huge, pale, spotted, horned, fighting back on one knee.
function div(g, layer) {
  const spots = g2 => { const r = rng(9); g2.fillStyle = 'rgba(40,40,46,0.85)'; for (let i = 0; i < 60; i++) { g2.beginPath(); g2.ellipse(400 + r() * 220, 380 + r() * 380, 1.6 + r() * 2.6, 1.3 + r() * 2, r() * 3, 0, 7); g2.fill(); } };
  const shade = g2 => { spots(g2); g2.fillStyle = 'rgba(120,120,140,0.16)'; g2.fillRect(400, 380, 240, 380); };
  if (layer === 'back') {
    part(g, [{ limb: [[498, 500], [548, 452], 34, 26] }, { limb: [[548, 452], [568, 400], 26, 20] }], DIV, { pattern: spots });
    part(g, [{ pts: [[560, 400], [566, 382], [572, 398], [580, 386], [580, 404], [590, 398], [578, 414], [566, 412]] }], DIV);
    part(g, [{ limb: [[520, 612], [580, 652], 48, 34] }, { limb: [[580, 652], [592, 736], 34, 22] }], DIV, { pattern: shade });
    part(g, [{ ellipse: [598, 742, 20, 8, 0] }], DIV);
    return;
  }
  if (layer === 'body') {
    part(g, [{ pts: [[452, 488], [500, 482], [534, 520], [538, 590], [518, 626], [478, 624], [458, 580], [446, 528]] }], DIV, { pattern: spots });
    stroke(g, [[476, 520], [492, 548], [488, 590]], '#9a98a2', 1.4);
    // A red loincloth with a gold belt.
    part(g, [{ pts: [[462, 588], [526, 586], [540, 640], [506, 660], [488, 640], [460, 652], [452, 612]] }], RED, { pattern: g2 => { g2.fillStyle = 'rgba(0,0,0,0.15)'; for (let x = 440; x < 560; x += 10) g2.fillRect(x, 600, 3, 70); } });
    part(g, [{ limb: [[458, 592], [530, 590], 10, 10] }], GOLD, { lw: 1.4 });
    part(g, [{ limb: [[494, 632], [466, 726], 46, 30] }, { limb: [[466, 726], [548, 740], 28, 16] }], DIV, { pattern: shade });
    part(g, [{ ellipse: [558, 742, 16, 7, 0] }], DIV);
    part(g, [{ limb: [[536, 732], [538, 746], 12, 12] }], GOLD, { lw: 1.2 });
    return;
  }
  if (layer === 'head') {
    part(g, [{ pts: [[452, 452], [446, 420], [438, 392], [446, 366], [458, 352], [452, 374], [452, 398], [464, 430]] }, { pts: [[486, 444], [500, 412], [520, 392], [544, 386], [532, 400], [514, 418], [500, 452]] }], '#3a3530', { lw: 1.4, pattern: g2 => { g2.strokeStyle = '#6b655c'; g2.lineWidth = 1.2; for (let i = 0; i < 12; i++) { g2.beginPath(); g2.arc(470, 470, 50 + i * 7, 3.6, 5.4); g2.stroke(); } } });
    part(g, [{ pts: [[500, 436], [522, 452], [528, 480], [516, 504], [494, 500]] }], '#2e2a28', { lw: 1.2 });
    part(g, [{ ellipse: [478, 462, 36, 40, -0.25] }], DIV, { pattern: spots });
    part(g, [{ pts: [[446, 452], [430, 460], [432, 474], [444, 472]] }], DIV, { lw: 1.6 });
    part(g, [{ pts: [[446, 488], [474, 494], [490, 506], [470, 512], [450, 506]] }], '#3b2b26', { lw: 1.4 });
    g.fillStyle = '#fff'; for (const x of [454, 464, 474]) { g.beginPath(); g.moveTo(x, 492); g.lineTo(x + 3, 501); g.lineTo(x + 6, 492); g.fill(); }
    part(g, [{ ellipse: [460, 448, 8, 5.5, -0.2] }], '#f7e9c4', { lw: 1.2 });
    g.fillStyle = '#c0281e'; g.beginPath(); g.arc(458, 448, 3.4, 0, 7); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(457, 448, 1.6, 0, 7); g.fill();
    stroke(g, [[446, 438], [458, 432], [474, 436]], INK, 3);
    part(g, [{ pts: [[506, 448], [520, 436], [518, 458]] }], DIV, { lw: 1.4 });
    return;
  }
  if (layer === 'arm') {
    part(g, [{ limb: [[462, 506], [428, 548], 30, 24] }, { limb: [[428, 548], [404, 514], 24, 18] }], DIV, { pattern: spots });
    part(g, [{ limb: [[446, 528], [440, 536], 14, 14] }], GOLD, { lw: 1.2 });
    part(g, [{ pts: [[396, 504], [404, 498], [412, 506], [410, 520], [398, 522], [392, 514]] }], DIV, { lw: 1.4 });
  }
}

// Rostam: the tiger-skin coat over mail, the leopard-head helmet, a forked black beard, a dagger raised.
function rostam(g, layer) {
  const stripes = g2 => {
    g2.strokeStyle = '#1f150f'; g2.lineCap = 'round';
    const r = rng(3);
    for (let y = 450; y < 700; y += 12) for (let x = 240; x < 440; x += 26) {
      const yy = y + (r() - 0.5) * 6, l = 8 + r() * 10;
      g2.lineWidth = 2.6 + r() * 1.6; g2.beginPath(); g2.moveTo(x, yy); g2.quadraticCurveTo(x + l * 0.5, yy + 4, x + l, yy - 1); g2.stroke();
    }
  };
  if (layer === 'back') {
    // The far leg, stretched back, and the raised arm with the dagger.
    part(g, [{ limb: [[312, 590], [280, 654], 36, 28] }, { limb: [[280, 654], [262, 728], 28, 20] }], '#3d6c8c');
    part(g, [{ pts: [[248, 700], [276, 700], [272, 738], [282, 746], [240, 748], [246, 728]] }], '#6b2a1c');
    part(g, [{ limb: [[300, 470], [282, 424], 26, 22] }], TIGER, { pattern: stripes });
    part(g, [{ limb: [[282, 424], [300, 380], 20, 16] }], MAIL, { pattern: g2 => { g2.strokeStyle = 'rgba(40,46,60,0.5)'; g2.lineWidth = 1; for (let y = 370; y < 440; y += 4) { g2.beginPath(); g2.moveTo(270, y); g2.lineTo(320, y); g2.stroke(); } } });
    part(g, [{ pts: [[294, 386], [314, 362], [326, 330], [318, 360], [306, 386]] }], '#dfe3ea', { lw: 1.4 });
    part(g, [{ limb: [[296, 392], [304, 384], 10, 10] }, { limb: [[290, 386], [310, 392], 5, 5] }], GOLD, { lw: 1.2 });
    part(g, [{ circle: [300, 378, 8] }], SKIN, { lw: 1.4 });
    return;
  }
  if (layer === 'body') {
    part(g, [{ limb: [[330, 592], [378, 640], 38, 30] }, { limb: [[378, 640], [372, 726], 30, 20] }], '#3d6c8c');
    part(g, [{ pts: [[356, 700], [386, 700], [390, 736], [414, 742], [412, 750], [354, 750]] }], '#6b2a1c');
    // The coat: shoulders to a skirt over the thighs, the tiger's own tail and paws hanging from it.
    part(g, [{ pts: [[296, 462], [346, 456], [360, 500], [356, 560], [372, 612], [386, 650], [340, 664], [296, 660], [278, 640], [292, 586], [290, 520]] }], TIGER, { pattern: stripes });
    part(g, [{ limb: [[300, 650], [282, 700], 10, 6] }], TIGER, { pattern: stripes, lw: 1.6 });
    part(g, [{ limb: [[290, 568], [362, 566], 12, 12] }], GOLD, { lw: 1.6, pattern: g2 => { g2.fillStyle = RED; for (let x = 298; x < 362; x += 14) { g2.beginPath(); g2.arc(x, 567, 2.6, 0, 7); g2.fill(); } } });
    return;
  }
  if (layer === 'head') {
    part(g, [{ pts: [[304, 436], [346, 432], [356, 452], [344, 462], [306, 462]] }], '#e8e2d4', { lw: 1.4 });
    part(g, [{ ellipse: [330, 432, 21, 25, 0.1] }], SKIN);
    // The beard, black and forked.
    part(g, [{ pts: [[314, 440], [346, 440], [350, 470], [340, 492], [332, 478], [324, 496], [314, 474]] }], '#1a1412', { lw: 1.2 });
    stroke(g, [[332, 446], [342, 444], [350, 448]], '#1a1412', 3);
    g.fillStyle = INK; g.beginPath(); g.ellipse(340, 425, 4.5, 2.2, 0.1, 0, 7); g.fill();
    stroke(g, [[333, 418], [341, 416], [349, 419]], INK, 2);
    stroke(g, [[349, 424], [353, 436], [348, 438]], '#b07a5a', 1.4);
    // The helmet: a snow leopard's head, pale and spotted, its face over the brow.
    part(g, [{ pts: [[306, 426], [306, 400], [318, 384], [338, 380], [356, 392], [360, 414], [352, 420], [330, 412], [314, 418]] }], '#ece7da', { pattern: g2 => { g2.fillStyle = '#2b2622'; const r = rng(4); for (let i = 0; i < 16; i++) { const x = 308 + r() * 50, y = 384 + r() * 30; g2.beginPath(); g2.arc(x, y, 2.2, 0, 7); g2.arc(x + 4, y + 1, 1.6, 0, 7); g2.fill(); } } });
    part(g, [{ pts: [[318, 388], [322, 372], [330, 386]] }, { pts: [[342, 384], [350, 372], [352, 390]] }], '#ece7da', { lw: 1.2 });
    part(g, [{ pts: [[352, 400], [366, 404], [368, 414], [356, 418]] }], '#ece7da', { lw: 1.2 });
    g.fillStyle = INK; g.beginPath(); g.arc(358, 402, 1.6, 0, 7); g.fill();
    part(g, [{ limb: [[306, 418], [356, 418], 6, 6] }], GOLD, { lw: 1.2 });
    return;
  }
  if (layer === 'arm') {
    part(g, [{ limb: [[344, 476], [384, 512], 26, 22] }], TIGER, { pattern: stripes });
    part(g, [{ limb: [[384, 512], [436, 484], 20, 16] }], MAIL, { pattern: g2 => { g2.strokeStyle = 'rgba(40,46,60,0.5)'; g2.lineWidth = 1; for (let x = 380; x < 446; x += 4) { g2.beginPath(); g2.moveTo(x, 470); g2.lineTo(x, 512); g2.stroke(); } } });
    part(g, [{ circle: [441, 480, 9] }], SKIN, { lw: 1.4 });
  }
}

export function paintMiniature(g, w, h) {
  const [W, H] = DESIGN;
  g.save();
  g.scale(w / W, h / H);
  const I = border(g, W, H), x0 = I, y0 = I, x1 = W - I, y1 = H - I;
  g.save();
  g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  // The gold sky, with a little sheen.
  const sky = g.createLinearGradient(x0, y0, x1, 420);
  sky.addColorStop(0, '#e7bd5b'); sky.addColorStop(0.5, GOLD); sky.addColorStop(1, '#c39234');
  g.fillStyle = sky; g.fillRect(x0, y0, x1 - x0, 460);
  const r = rng(21);
  g.fillStyle = 'rgba(255,240,190,0.18)';
  for (let i = 0; i < 500; i++) g.fillRect(x0 + r() * (x1 - x0), y0 + r() * 400, 1.2, 1.2);
  cloud(g, 540, 128, 1.05);
  cloud(g, 214, 150, 0.8, -1);
  // The ground, pale green, before the rocks are piled on it.
  g.fillStyle = '#aec27c'; g.fillRect(x0, 600, x1 - x0, y1 - 600);
  g.fillStyle = 'rgba(80,110,50,0.08)';
  for (let i = 0; i < 400; i++) g.fillRect(x0 + r() * (x1 - x0), 600 + r() * (y1 - 600), 3, 2);
  // The mountain: tiers of pastel rock, the skyline first, then the two sides of the cave.
  rocks(g, [[120, 330, 72, 112, 4, -0.15], [700, 350, 52, 100, 0], [230, 290, 62, 100, 0, 0.1], [630, 300, 66, 106, 4, 0.12], [330, 262, 56, 84, 2, -0.1],
    [530, 270, 58, 96, 1, -0.1], [430, 252, 62, 86, 3, 0.15]], 30);
  rocks(g, [[200, 380, 52, 92, 3], [580, 362, 52, 84, 1], [110, 440, 72, 112, 1, 0.1], [646, 430, 66, 112, 2, -0.1], [182, 530, 64, 100, 2],
    [600, 530, 58, 100, 3, 0.1], [104, 612, 66, 92, 3, -0.1], [676, 612, 62, 92, 0]], 50);
  // The cave's mouth, dark, its lip pale, knobs of rock hanging over it.
  const mouth = [[255, 350], [300, 300], [370, 276], [440, 272], [505, 290], [560, 335], [590, 410], [598, 520], [604, 640], [606, 740], [420, 775], [240, 760], [222, 650], [226, 520], [236, 420]];
  g.beginPath(); trace(g, mouth); g.strokeStyle = '#d4c3de'; g.lineWidth = 9; g.stroke();
  g.strokeStyle = '#8d77a3'; g.lineWidth = 2; g.stroke();
  const dark = g.createRadialGradient(410, 560, 30, 410, 540, 300);
  dark.addColorStop(0, '#4a3326'); dark.addColorStop(0.6, '#2c1e17'); dark.addColorStop(1, '#1a120e');
  g.fillStyle = dark; g.beginPath(); trace(g, mouth); g.fill();
  rocks(g, [[330, 292, 26, 30, 0], [452, 282, 30, 30, 0, 0.1], [540, 322, 22, 30, 0, -0.1]], 70);
  div(g, 'back');
  rostam(g, 'back');
  div(g, 'body');
  div(g, 'head');
  rostam(g, 'body');
  rostam(g, 'head');
  rostam(g, 'arm');
  div(g, 'arm');
  // The ground in front of the cave: a ledge of rock, the stream, flowers, Rakhsh waiting.
  rocks(g, [[150, 768, 74, 62, 4], [280, 798, 60, 44, 0, 0.1], [584, 798, 56, 46, 2, -0.1], [690, 762, 62, 64, 3]], 80);
  stream(g, [[x0 - 10, 870], [120, 880], [230, 900], [330, 936], [420, 952], [x0, y1 + 10]]);
  flowers(g, x0 + 10, 800, 480, y1 - 6, 34, 71);
  flowers(g, 440, 900, x1 - 6, y1 - 4, 10, 72);
  rakhsh(g);
  g.restore();
  // The plane tree on the left breaks out over the rules into the margin, as trees do in the old pages.
  tree(g, [118, 880], 81);
  // Age: a faint warm wash and a soft darkening at the edges.
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  vig.addColorStop(0, 'rgba(255,240,210,0)'); vig.addColorStop(1, 'rgba(60,35,10,0.18)');
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
  g.restore();
}

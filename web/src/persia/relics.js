import * as THREE from 'three';
import { makeKit, paint } from './kit.js';

// Walnut, to match the bookcase beside it.
const WALNUT = '#8f6748', DARK = '#4e3524', BLACK = '#1d1c1f', STONE = '#8a8278', CLAY = '#a98d6c', BRASS = '#c89b4a';
const BOOKS = ['#5b1d1f', '#20382c', '#1f2747', '#3a2418', '#6a2a1c', '#1b1b1f'];

export function makeShelf({ min, max }) {
  const W = max[0] - min[0], D = max[1] - min[1], H = max[2] - min[2];
  const cx = (min[0] + max[0]) / 2, front = -max[1], back = -min[1], zc = (front + back) / 2;
  const kit = makeKit({ floor: 0, reach: 0.25, ao: 0.2 }), T = 0.022;
  // The case.
  for (const s of [-1, 1]) kit.box(T, H, D, WALNUT, { at: [cx + s * (W / 2 - T / 2), H / 2, zc] });
  kit.box(W, 0.03, D, WALNUT, { at: [cx, H - 0.015, zc] });
  kit.box(W - 0.03, 0.08, D - 0.04, BLACK, { at: [cx, 0.04, zc + 0.01] });
  kit.box(W - 2 * T, 0.022, D, WALNUT, { at: [cx, 0.091, zc] });
  kit.box(W - 2 * T, H - 0.12, 0.01, DARK, { at: [cx, H / 2 + 0.04, back - 0.006] });
  const SHELVES = [0.5, 0.92, 1.34];
  for (const y of SHELVES) kit.box(W - 2 * T, 0.022, D - 0.02, BLACK, { at: [cx, y, zc + 0.008] });
  kit.box(W - 0.06, 0.008, 0.012, '#ffd9a6', { at: [cx, H - 0.036, front + 0.03], light: () => 1.7 });

  // Books: a row and a stack on the lowest shelf, a row on the next, Shahnameh volumes against the bookend on top.
  let n = 0;
  const row = (y, x0, x1, hMin, hMax, gold = false) => {
    let x = x0;
    while (x < x1) {
      const t = 0.028 + ((n * 37) % 11) / 400, h = hMin + ((n * 53) % 13) / 13 * (hMax - hMin), col = BOOKS[n % BOOKS.length];
      if (x + t > x1) break;
      kit.box(t, h, 0.2, col, { at: [x + t / 2, y + h / 2, front + 0.13] });
      if (gold) for (const k of [0.18, 0.82]) kit.box(t + 0.002, 0.008, 0.004, '#d8ae55', { at: [x + t / 2, y + h * k, front + 0.03] });
      x += t + 0.003; n++;
    }
  };
  const top = y => y + 0.011;
  row(0.102, cx - W / 2 + T + 0.01, cx + 0.035, 0.27, 0.33);
  for (let i = 0; i < 3; i++) kit.box(0.22 - i * 0.02, 0.045, 0.19 - i * 0.01, BOOKS[(i + 2) % 6], { at: [cx + 0.165, 0.102 + 0.0225 + i * 0.045, front + 0.13], rot: [0, 0.08 * (i - 1), 0] });
  row(top(SHELVES[0]), cx - W / 2 + T + 0.12, cx + W / 2 - T - 0.01, 0.24, 0.3);
  kit.cyl(0.05, 0.035, 0.05, BRASS, { at: [cx - W / 2 + T + 0.06, top(SHELVES[0]) + 0.025, front + 0.12], seg: 18 });
  row(top(SHELVES[2]), cx - W / 2 + T + 0.01, cx + 0.105, 0.25, 0.27, true);

  // The bookend: a short column with the twin-bull top, the books against its shaft, the bulls looking along the shelf.
  const bx = cx + 0.15, by = top(SHELVES[2]), bz = front + 0.13;
  kit.box(0.08, 0.022, 0.08, '#6d665e', { at: [bx, by + 0.011, bz], floor: by, reach: 0.05 });
  kit.cyl(0.029, 0.031, 0.235, STONE, { at: [bx, by + 0.022 + 0.1175, bz], seg: 20, floor: by, reach: 0.06 });
  kit.cyl(0.036, 0.03, 0.018, '#7a736a', { at: [bx, by + 0.266, bz], seg: 20 });
  capital(kit, [bx, by + 0.275, bz]);

  // The Cyrus Cylinder's cradle, and the stand for its card.
  const cy = top(SHELVES[1]), at = [cx - 0.06, cy, front + 0.15];
  kit.box(0.17, 0.018, 0.07, BLACK, { at: [at[0], cy + 0.009, at[2]] });
  for (const s of [-1, 1]) kit.box(0.025, 0.03, 0.06, BLACK, { at: [at[0] + s * 0.065, cy + 0.033, at[2]] });
  kit.box(0.06, 0.05, 0.005, BLACK, { at: [cx + 0.15, cy + 0.026, front + 0.082], rot: [0.35, 0, 0] });
  kit.box(0.07, 0.004, 0.035, BLACK, { at: [cx + 0.15, cy + 0.002, front + 0.08] });
  const group = new THREE.Group();
  group.name = 'persia_shelf';
  group.add(kit.mesh());

  // The cylinder: barrel-shaped, about 23 cm long, lying on its side, its lines of wedges running along it.
  const prof = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14 * 2 - 1; prof.push(new THREE.Vector2(0.041 + 0.01 * (1 - t * t), t * 0.112)); }
  prof.unshift(new THREE.Vector2(0.0001, -0.112)); prof.push(new THREE.Vector2(0.0001, 0.112));
  const cg = new THREE.LatheGeometry(prof, 28);
  cg.rotateZ(Math.PI / 2); cg.rotateX(0.5);
  cg.translate(at[0], cy + 0.095, at[2]);
  const cyl = new THREE.Mesh(plainUV(cg), new THREE.MeshBasicMaterial({ map: canvasTex(drawCylinder, 512, 256), vertexColors: true }));
  paint(cyl.geometry, '#ffffff');
  cyl.name = 'cyrus_cylinder';
  // Its card, leaning on the little stand in front.
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.058), new THREE.MeshBasicMaterial({ map: canvasTex(drawCard, 256, 166), vertexColors: true }));
  card.geometry = plainUV(card.geometry);
  card.geometry.rotateX(-0.35);
  card.geometry.rotateY(Math.PI);
  card.geometry.translate(cx + 0.15, cy + 0.036, front + 0.072);
  paint(card.geometry, '#ffffff', () => 0.8);
  group.add(cyl, card);
  group.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  return { group };
}

// Positions, normals, colours and the texture's uv, nothing else, for the two textured pieces.
function plainUV(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return g;
}
function canvasTex(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Baked clay with rows of wedge marks (made up, not the real text), a darker broken patch at one end and two cracks.
function drawCylinder(g, w, h) {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = CLAY; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,62,36' : '235,214,176'},${0.04 + r() * 0.08})`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 9, 0, 7); g.fill(); }
  // Lines of text run along the cylinder: here, columns down the picture, around its girth.
  g.fillStyle = 'rgba(52,34,18,0.85)';
  for (let x = 8; x < w - 4; x += 9) {
    for (let y = 10 + r() * 6; y < h - 10; y += 5 + r() * 4) {
      const k = r();
      g.beginPath();
      if (k < 0.55) { g.moveTo(x, y); g.lineTo(x + 4, y + 1.2); g.lineTo(x, y + 2.4); }
      else if (k < 0.85) { g.moveTo(x - 1, y); g.lineTo(x + 1, y + 4); g.lineTo(x + 3, y); }
      else { g.moveTo(x, y); g.lineTo(x + 5, y + 0.8); g.lineTo(x + 5, y + 1.8); g.lineTo(x, y + 1.2); }
      g.fill();
    }
    g.fillStyle = 'rgba(70,48,28,0.3)'; g.fillRect(x + 6, 6, 1, h - 12); g.fillStyle = 'rgba(52,34,18,0.85)';
  }
  // The broken end: a rough patch where the clay is missing, darker and pitted.
  g.fillStyle = '#9b7f58';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.42, 0);
  for (let y = 0; y <= h * 0.32; y += 6) g.lineTo(w * 0.42 - y * 0.6 + (r() - 0.5) * 14, y);
  g.lineTo(0, h * 0.34); g.closePath(); g.fill();
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(60,40,22,${0.15 + r() * 0.2})`; g.fillRect(r() * w * 0.38, r() * h * 0.3, 2 + r() * 3, 2 + r() * 3); }
  g.strokeStyle = 'rgba(55,36,20,0.7)'; g.lineWidth = 1.4;
  for (const [x0, y0] of [[w * 0.55, 0], [w * 0.8, h]]) { g.beginPath(); g.moveTo(x0, y0); let x = x0, y = y0; for (let i = 0; i < 9; i++) { x += (r() - 0.5) * 24; y += (y0 ? -1 : 1) * (6 + r() * 9); g.lineTo(x, y); } g.stroke(); }
}

function drawCard(g, w, h) {
  g.fillStyle = '#f4efe3'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b39a6a'; g.lineWidth = 2; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#22201c'; g.textAlign = 'left';
  g.font = "700 21px Georgia, 'Times New Roman', serif"; g.fillText('CYRUS CYLINDER', 18, 38);
  g.font = "italic 16px Georgia, 'Times New Roman', serif"; g.fillText('Replica', 18, 60);
  g.font = "15px Georgia, 'Times New Roman', serif";
  ['Babylon, 539 BCE', 'Clay, Akkadian cuneiform', 'Original: British Museum'].forEach((l, i) => g.fillText(l, 18, 92 + i * 22));
}

// The twin-bull capital, small: two kneeling bulls back to back, the saddle between their necks.
function capital(kit, [x, y, z]) {
  const o = { floor: y, reach: 0.05, ao: 0.3 }, S = STONE;
  kit.box(0.16, 0.03, 0.075, '#6d665e', { at: [x, y + 0.015, z] });
  kit.ball(1, S, { at: [x, y + 0.062, z], scale: [0.06, 0.032, 0.03], seg: 16, rings: 10, ...o });
  for (const s of [-1, 1]) {
    kit.ball(1, S, { at: [x + s * 0.05, y + 0.064, z], scale: [0.034, 0.036, 0.031], seg: 14, rings: 10, ...o });
    for (const k of [-1, 1]) {
      kit.cyl(0.0085, 0.008, 0.055, S, { at: [x + s * 0.06, y + 0.04, z + k * 0.016], rot: [0, 0, Math.PI / 2], seg: 8, ...o });
      kit.box(0.014, 0.016, 0.014, '#7a736a', { at: [x + s * 0.09, y + 0.039, z + k * 0.016], ...o });
    }
    kit.cyl(0.021, 0.024, 0.05, S, { at: [x + s * 0.07, y + 0.09, z], rot: [0, 0, -s * 0.75], seg: 12, ...o });
    kit.cyl(0.026, 0.026, 0.008, '#7a736a', { at: [x + s * 0.062, y + 0.082, z], rot: [0, 0, -s * 0.75], seg: 12, ...o });
    kit.ball(1, S, { at: [x + s * 0.097, y + 0.104, z], scale: [0.03, 0.017, 0.018], rot: [0, 0, s * 0.3], seg: 12, rings: 8, ...o });
    kit.ball(0.0115, S, { at: [x + s * 0.124, y + 0.096, z], seg: 10, rings: 6, ...o });
    for (const k of [-1, 1]) {
      kit.cyl(0.0035, 0.0065, 0.028, '#6d665e', { at: [x + s * 0.092, y + 0.124, z + k * 0.011], rot: [k * 0.5, 0, s * 0.45], seg: 6, ...o });
      kit.cyl(0.002, 0.0065, 0.02, S, { at: [x + s * 0.083, y + 0.112, z + k * 0.022], rot: [k * 1.2, 0, 0], seg: 6, ...o });
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) kit.ball(0.0046, '#9a9288', { at: [x + s * (0.077 + r * 0.004), y + 0.045 + r * 0.013, z - 0.018 + c * 0.012], seg: 6, rings: 4, ...o });
  }
}

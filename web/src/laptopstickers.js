import * as THREE from 'three';
import { b2t } from './engine.js';
import { SHEET, STICKERS, LOGO, onSheet } from './pure/laptop.js';

// The closed laptop's lid (pure/laptop.js): eight stickers of my own drawing, each die-cut with a white border and a
// faint shadow under its edge, and my logo etched in the middle. One picture laid just over the lid's flat top.
const W = 2048, H = Math.round(W * SHEET.d / SHEET.w), PX = W / SHEET.w;

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const star = (g, x, y, ro, ri, n = 5, a0 = -Math.PI / 2) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = a0 + i * Math.PI / n; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); };

// Each sticker's shape (its outline, for the die cut) and its art, in millimetres round its middle.
const ART = {
  pomegranate: {
    outline: g => { g.beginPath(); g.arc(0, 3, 22, 0, Math.PI * 2); g.moveTo(-7, -17); g.lineTo(-9, -27); g.lineTo(-3, -22); g.lineTo(0, -29); g.lineTo(3, -22); g.lineTo(9, -27); g.lineTo(7, -17); g.closePath(); },
    draw: g => {
      const grd = g.createRadialGradient(-7, -4, 3, 0, 3, 23); grd.addColorStop(0, '#ff5a5f'); grd.addColorStop(0.6, '#c81d34'); grd.addColorStop(1, '#7d0f22');
      g.fillStyle = grd; g.beginPath(); g.arc(0, 3, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8f1428'; g.beginPath(); g.moveTo(-7, -17); g.lineTo(-9, -27); g.lineTo(-3, -22); g.lineTo(0, -29); g.lineTo(3, -22); g.lineTo(9, -27); g.lineTo(7, -17); g.closePath(); g.fill();
      // A slice cut away, showing the seeds.
      g.fillStyle = '#ffe3d6'; g.beginPath(); g.moveTo(2, 3); g.arc(2, 3, 15, -0.2, 1.3); g.closePath(); g.fill();
      for (const [a, d] of [[0.1, 6], [0.5, 9], [0.9, 7], [0.25, 12], [0.7, 12.5], [1.1, 11], [0.45, 4]]) {
        g.fillStyle = '#e0123a'; g.beginPath(); g.ellipse(2 + d * Math.cos(a), 3 + d * Math.sin(a), 1.7, 1.2, a, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(1.6 + d * Math.cos(a), 2.6 + d * Math.sin(a), 0.45, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-10, -6, 5, 3, -0.6, 0, 7); g.fill();
    },
  },
  bh22: {
    outline: g => rr(g, -22, -22, 44, 44, 9),
    draw: g => {
      g.fillStyle = '#10161f'; rr(g, -22, -22, 44, 44, 9); g.fill();
      // BH-22's round head: a white dome, a dark visor and two teal eyes.
      g.fillStyle = '#f2f4f7'; g.beginPath(); g.arc(0, 2, 15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b2433'; rr(g, -11, -3, 22, 10, 5); g.fill();
      g.fillStyle = '#3ee6c4'; for (const x of [-5, 5]) { g.beginPath(); g.arc(x, 2, 2.4, 0, 7); g.fill(); }
      g.strokeStyle = '#f2f4f7'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -13); g.lineTo(0, -18); g.stroke();
      g.fillStyle = '#3ee6c4'; g.beginPath(); g.arc(0, -19, 1.8, 0, 7); g.fill();
      g.fillStyle = '#3ee6c4'; g.font = '700 6px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('BH-22', 0, 20.5);
    },
  },
  vancouver: {
    outline: g => rr(g, -35, -22.5, 70, 45, 7),
    draw: g => {
      g.save(); rr(g, -35, -22.5, 70, 45, 7); g.clip();
      const sky = g.createLinearGradient(0, -22, 0, 10); sky.addColorStop(0, '#2b4b8c'); sky.addColorStop(1, '#f2a65a'); g.fillStyle = sky; g.fillRect(-35, -23, 70, 46);
      g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(14, -4, 6, 0, 7); g.fill();
      // The North Shore mountains, snow on their tops, then the water.
      g.fillStyle = '#3a4f7a'; g.beginPath(); g.moveTo(-35, 8); g.lineTo(-22, -8); g.lineTo(-14, -1); g.lineTo(-4, -13); g.lineTo(8, 2); g.lineTo(18, -6); g.lineTo(35, 8); g.closePath(); g.fill();
      g.fillStyle = '#eef3fb'; for (const [x, y] of [[-22, -8], [-4, -13], [18, -6]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3.2, y + 4); g.lineTo(x + 3.2, y + 4); g.closePath(); g.fill(); }
      g.fillStyle = '#1f3557'; g.fillRect(-35, 8, 70, 15);
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 0.8; for (const y of [11, 14.5]) { g.beginPath(); g.moveTo(-28, y); g.lineTo(-10, y); g.moveTo(4, y + 1); g.lineTo(26, y + 1); g.stroke(); }
      g.restore();
      g.fillStyle = '#ffffff'; g.font = '800 6.2px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('VANCOUVER', 0, 19.5);
    },
  },
  soccer: {
    outline: g => { g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); },
    draw: g => {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 21, 0, 7); g.fill();
      const pent = (x, y, r, a) => { g.beginPath(); for (let i = 0; i < 5; i++) { const t = a + i * Math.PI * 2 / 5; g.lineTo(x + r * Math.cos(t), y + r * Math.sin(t)); } g.closePath(); g.fill(); };
      g.save(); g.beginPath(); g.arc(0, 0, 21, 0, 7); g.clip();
      g.fillStyle = '#16181d'; pent(0, 0, 7, -Math.PI / 2);
      for (let i = 0; i < 5; i++) { const t = -Math.PI / 2 + i * Math.PI * 2 / 5 + Math.PI / 5; pent(17 * Math.cos(t), 17 * Math.sin(t), 6, t); }
      g.strokeStyle = '#16181d'; g.lineWidth = 1;
      for (let i = 0; i < 5; i++) { const t = -Math.PI / 2 + i * Math.PI * 2 / 5; g.beginPath(); g.moveTo(7 * Math.cos(t), 7 * Math.sin(t)); g.lineTo(13 * Math.cos(t), 13 * Math.sin(t)); g.stroke(); }
      g.restore();
      g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.arc(4, 4, 21, 0.2, 1.9); g.arc(0, 0, 21, 1.9, 0.2, true); g.fill();
    },
  },
  starball: {
    outline: g => { g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); },
    draw: g => {
      g.fillStyle = '#f7f8fb'; g.beginPath(); g.arc(0, 0, 21, 0, 7); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, 21, 0, 7); g.clip();
      // Stars round the ball in two tones, my own pattern.
      for (const [x, y, s, c] of [[0, 0, 7, '#1d2a5c'], [-14, -8, 5, '#1d2a5c'], [13, -10, 5, '#1d2a5c'], [-11, 13, 5, '#1d2a5c'], [12, 12, 5, '#1d2a5c'], [0, -19, 4, '#3b56b8'], [-20, 4, 4, '#3b56b8'], [20, 2, 4, '#3b56b8'], [2, 19, 4, '#3b56b8']]) {
        g.fillStyle = c; star(g, x, y, s, s * 0.42); g.fill();
      }
      g.restore();
      g.strokeStyle = 'rgba(29,42,92,.25)'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, 20.6, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-8, -10, 5, 2.6, -0.6, 0, 7); g.fill();
    },
  },
  heart: {
    outline: g => { const P = [[1, 0], [3, 0], [3, 1], [4, 1], [4, 0], [6, 0], [7, 1], [7, 4], [6, 5], [5, 6], [4, 7], [3, 7], [2, 6], [1, 5], [0, 4], [0, 1]]; g.beginPath(); for (const [x, y] of P) g.lineTo(x * 4.6 - 16.1, y * 4.6 - 16.1); g.closePath(); },
    draw: g => {
      const c = 4.6, o = -16.1, cells = ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'];
      cells.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') { g.fillStyle = '#e8243c'; g.fillRect(o + x * c, o + y * c, c + 0.05, c + 0.05); } }));
      g.fillStyle = '#ffffff'; for (const [x, y] of [[1, 1], [1, 2], [2, 1]]) g.fillRect(o + x * c, o + y * c, c + 0.05, c + 0.05);
      g.fillStyle = '#9e1022'; for (const [x, y] of [[5, 3], [5, 4], [4, 5]]) g.fillRect(o + x * c, o + y * c, c + 0.05, c + 0.05);
    },
  },
  controller: {
    outline: g => { g.beginPath(); g.moveTo(-20, -15); g.bezierCurveTo(-8, -18, 8, -18, 20, -15); g.bezierCurveTo(30, -12, 32, 6, 28, 14); g.bezierCurveTo(24, 21, 16, 19, 12, 11); g.lineTo(-12, 11); g.bezierCurveTo(-16, 19, -24, 21, -28, 14); g.bezierCurveTo(-32, 6, -30, -12, -20, -15); g.closePath(); },
    draw(g) {
      this.outline(g); const grd = g.createLinearGradient(0, -18, 0, 20); grd.addColorStop(0, '#3a3f4b'); grd.addColorStop(1, '#1d2028'); g.fillStyle = grd; g.fill();
      g.fillStyle = '#c9ced8'; g.fillRect(-21, -4.5, 12, 4); g.fillRect(-17, -8.5, 4, 12);
      for (const [x, y, c] of [[16, -7, '#3ee6c4'], [21, -2.5, '#ff5a5f'], [11, -2.5, '#4f7cff'], [16, 2, '#ffd36b']]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 2.3, 0, 7); g.fill(); }
      g.fillStyle = '#555b68'; for (const x of [-6, 6]) { g.beginPath(); g.arc(x, 5, 4, 0, 7); g.fill(); }
      g.fillStyle = '#9ba3b3'; g.fillRect(-3, -9, 2.2, 1.3); g.fillRect(1, -9, 2.2, 1.3);
    },
  },
  pressf: {
    outline: g => rr(g, -33, -14, 66, 28, 6),
    draw: g => {
      g.fillStyle = '#121722'; rr(g, -33, -14, 66, 28, 6); g.fill();
      // A keycap with an F on it, and the words beside it.
      g.fillStyle = '#d9dde6'; rr(g, -29, -10, 20, 20, 3.5); g.fill();
      g.fillStyle = '#f4f6fa'; rr(g, -27.2, -9.2, 16.4, 15.5, 2.6); g.fill();
      g.fillStyle = '#1b2230'; g.font = '800 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('F', -19, -1.2);
      g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.font = '800 6.4px system-ui, sans-serif'; g.fillText('PRESS F', -5, -4.5);
      g.fillStyle = '#9aa6bd'; g.font = '600 5px system-ui, sans-serif'; g.fillText('to pay respects', -5, 3.8);
      g.textBaseline = 'alphabetic';
    },
  },
};

function drawSheet() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // The logo, etched: a little darker than the aluminium, with a faint light edge below it.
  const [lx, ly] = onSheet(LOGO.at, W, H), mm = PX / 1000;
  g.save(); g.translate(lx, ly); g.scale(mm, mm); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 9px system-ui, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillText(LOGO.text, 0, 0.35);
  g.fillStyle = 'rgba(40,44,52,.32)'; g.fillText(LOGO.text, 0, 0);
  g.restore();
  for (const s of STICKERS) {
    const [x, y] = onSheet(s.at, W, H), art = ART[s.id];
    g.save(); g.translate(x, y); g.rotate(s.turn * Math.PI / 180); g.scale(mm, mm);
    // The sticker's thickness: a soft shadow off its die-cut edge, then the white border round its shape.
    g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 2.2 * mm; g.shadowOffsetX = 0.5 * mm; g.shadowOffsetY = 0.7 * mm;
    art.outline(g); g.lineJoin = 'round'; g.lineWidth = 4.4; g.strokeStyle = '#ffffff'; g.stroke(); g.fillStyle = '#ffffff'; g.fill();
    g.restore();
    art.outline(g); g.lineJoin = 'round'; g.lineWidth = 4.4; g.strokeStyle = '#ffffff'; g.stroke();
    art.draw.call(art, g);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Laid 0.6 mm over the lid's top, its picture's top edge toward the hinge, so it reads from the laptop's front.
export function makeLaptopStickers(scene, meta) {
  const at = meta.points.laptop_lid;
  if (!at) return null;
  const geo = new THREE.PlaneGeometry(SHEET.w, SHEET.d).rotateX(-Math.PI / 2).rotateY(Math.PI);
  const mat = new THREE.MeshBasicMaterial({ name: 'M_LaptopStickers', map: drawSheet(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'laptop_stickers';
  mesh.position.copy(b2t(...at)).add(new THREE.Vector3(0, 0.0006, 0));
  mesh.renderOrder = 1;
  scene.add(mesh);
  return mesh;
}

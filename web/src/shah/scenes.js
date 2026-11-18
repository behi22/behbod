import { C, cover, goldSky, nightSky, cloud, ground, rocks, cypress, tree, figure, horse, rider, simorgh, div, flames, cartouche, border, rng, shade } from './art.js';
import { storyById } from '../pure/shahnameh.js';

// ---------- the reader's pictures, one per story, painted at 600 by 600 and fitted to the box ----------
const SCENES = {
  zal(g) {
    goldSky(g, 600, 600);
    cloud(g, 120, 120, 1.3); cloud(g, 470, 90, 1.1); cloud(g, 520, 250, 0.8);
    rocks(g, 230, 600, 460, 430, C.lilac, 11, 7);
    rocks(g, 520, 600, 260, 200, C.rose, 12, 4);
    ground(g, 600, 540, 600, C.jade, 13);
    // The nest on the peak, and the white-haired child in it.
    g.fillStyle = '#7a5530'; g.beginPath(); g.ellipse(232, 182, 46, 14, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.3; g.stroke();
    g.strokeStyle = '#4e351c'; g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(190 + i * 10, 176); g.lineTo(200 + i * 9, 190); g.stroke(); }
    g.fillStyle = C.skin; g.beginPath(); g.arc(236, 166, 8, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = C.white; g.beginPath(); g.arc(234, 161, 7.5, Math.PI * 0.95, Math.PI * 2.05); g.fill(); g.stroke();
    simorgh(g, 360, 210, 1.05, { dir: -1 });
    cypress(g, 70, 560, 120); cypress(g, 560, 570, 100);
    tree(g, 470, 560, 1.2, 5);
  },
  labours(g) {
    goldSky(g, 600, 600);
    cloud(g, 130, 100, 1.2); cloud(g, 480, 80, 1);
    rocks(g, 460, 470, 300, 300, C.stone, 21, 6);
    // The dark mouth of the White Div's cave.
    g.fillStyle = '#1a1310'; g.beginPath(); g.ellipse(470, 420, 52, 60, 0, Math.PI, 0); g.lineTo(522, 470); g.lineTo(418, 470); g.closePath(); g.fill();
    div(g, 476, 470, 0.72, { colour: '#e9e4d8', spot: '#8d8a80', arm: 'up', dir: -1 });
    rocks(g, 120, 480, 240, 160, C.rose, 22, 4);
    ground(g, 600, 460, 600, '#c9b27c', 23);
    rider(g, 230, 560, 1.45, { coat: 'tiger', head: 'helmet', beard: '#2b1a10', arm: 'up', hold: 'mace', robe: C.jadeLo }, { colour: '#c9803d', spots: '#e8b36a', mane: '#5a3418' });
    cypress(g, 40, 470, 90);
  },
  siavash(g) {
    nightSky(g, 600, 600, 31, 50);
    g.fillStyle = 'rgba(255,140,60,.25)'; g.fillRect(0, 200, 600, 400);
    // The city wall behind, the watching crowd small on it.
    g.fillStyle = shade(C.stone, 0.6); g.fillRect(0, 300, 600, 70);
    for (let x = 0; x < 600; x += 30) g.fillRect(x, 288, 18, 14);
    g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(-2, 300, 604, 70);
    ground(g, 600, 370, 600, '#9a7a4a', 32, false);
    flames(g, -20, 470, 250, 190, 0.3, 33);
    flames(g, 370, 470, 260, 200, 1.1, 34);
    rider(g, 300, 520, 1.25, { head: 'crown', robe: C.white, arm: 'down' }, { colour: '#1d1a1c', mane: '#000', saddle: C.lapis, gallop: true });
    flames(g, -20, 600, 240, 120, 2, 35); flames(g, 380, 600, 260, 130, 0.7, 36);
  },
  sohrab(g) {
    const s = g.createLinearGradient(0, 0, 0, 600);
    s.addColorStop(0, '#2b3f7a'); s.addColorStop(0.55, '#d27a4a'); s.addColorStop(1, '#f0c070');
    g.fillStyle = s; g.fillRect(0, 0, 600, 600);
    g.fillStyle = 'rgba(255,230,160,.9)'; g.beginPath(); g.arc(300, 330, 46, 0, Math.PI * 2); g.fill();
    rocks(g, 90, 420, 260, 140, C.lilac, 41, 4); rocks(g, 520, 420, 280, 160, C.lilac, 42, 4);
    ground(g, 600, 410, 600, '#b89a62', 43);
    // Two tents, two camps.
    for (const [x, c] of [[70, C.vermilion], [530, C.lapis]]) {
      g.beginPath(); g.moveTo(x - 50, 470); g.lineTo(x, 400); g.lineTo(x + 50, 470); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.3; g.stroke();
      g.fillStyle = C.goldHi; g.beginPath(); g.arc(x, 398, 4, 0, Math.PI * 2); g.fill();
    }
    figure(g, 220, 560, 2.1, { coat: 'tiger', head: 'helmet', beard: '#d8d4cc', robe: C.jadeLo, arm: 'forward', hold: 'sword' });
    figure(g, 380, 560, 2.0, { dir: -1, head: 'helmet', robe: C.vermilion, arm: 'forward', hold: 'sword' });
  },
};
// A story's picture in a w by h box, with its Persian title and the gold border.
export function paintStory(g, id, w, h) {
  const story = storyById(id), fn = SCENES[id] || SCENES.zal;
  cover(g, w, h, 600, 600, fn, id === 'zal' ? 0.32 : 0.62);
  const k = Math.max(0.6, Math.min(1.4, Math.min(w, h) / 360));
  if (story) cartouche(g, w / 2 - 110 * k, 16 * k, 220 * k, 44 * k, story.fa);
  border(g, w, h, k);
}

// ---------- the desktop's wallpapers, painted at the desktop's size and fitted to the box ----------
// Dark enough that windows and their writing stay easy to read on top.
const WALLS = {
  persepolis(g, w, h) {
    const s = g.createLinearGradient(0, 0, 0, h);
    s.addColorStop(0, '#0d1230'); s.addColorStop(0.45, '#3a2a5a'); s.addColorStop(0.72, '#b4583a'); s.addColorStop(0.86, '#e39a52');
    g.fillStyle = s; g.fillRect(0, 0, w, h);
    const r = rng(51);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,240,210,${0.2 + r() * 0.5})`; g.beginPath(); g.arc(r() * w, r() * h * 0.4, 0.6 + r() * 1.2, 0, Math.PI * 2); g.fill(); }
    // The low mountain behind the terrace, under the last of the light.
    g.fillStyle = '#2a1a2a'; g.beginPath(); g.moveTo(0, h * 0.78); g.lineTo(w * 0.18, h * 0.68); g.lineTo(w * 0.34, h * 0.72); g.lineTo(w * 0.52, h * 0.63); g.lineTo(w * 0.7, h * 0.7); g.lineTo(w * 0.88, h * 0.66); g.lineTo(w, h * 0.72); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    // The terrace with its double stair in the middle, and the tall columns of the Apadana, some still standing and
    // some broken, a few still carrying their twin-bull capitals.
    const base = h * 0.84, col = '#140d18';
    g.fillStyle = col; g.fillRect(0, base, w, h - base);
    for (let i = 0; i < 8; i++) { g.fillRect(w * 0.44 - i * 7, base - 4 - i * 4, w * 0.12 + i * 14, 4); }
    const xs = [0.06, 0.12, 0.18, 0.24, 0.3, 0.36, 0.41, 0.59, 0.64, 0.7, 0.76, 0.82, 0.88, 0.94], tall = [1, 0.35, 1, 0.8, 1, 0.5, 1, 0.7, 1, 0.9, 0.3, 1, 1, 0.45];
    xs.forEach((fx, i) => {
      const x = w * fx, top = base - h * 0.6 * tall[i], cw = Math.max(5, w * 0.008);
      g.fillStyle = col;
      g.fillRect(x - cw / 2, top, cw, base - top);
      g.fillRect(x - cw * 1.2, base - 12, cw * 2.4, 12);
      g.beginPath(); g.ellipse(x, base - 13, cw * 1.1, 5, 0, Math.PI, 0); g.fill();
      if (tall[i] === 1) {
        // Two bulls back to back: a chest and bent forelegs each way, heads with horns and ears at the ends.
        g.fillRect(x - cw * 0.9, top - 26, cw * 1.8, 26);
        g.beginPath(); g.moveTo(x - cw * 3.6, top - 30); g.lineTo(x + cw * 3.6, top - 30); g.lineTo(x + cw * 3.2, top - 18); g.lineTo(x - cw * 3.2, top - 18); g.closePath(); g.fill();
        for (const sd of [-1, 1]) {
          const hx = x + sd * cw * 3.4;
          g.beginPath(); g.moveTo(hx, top - 30); g.lineTo(hx + sd * cw * 1.6, top - 26); g.lineTo(hx + sd * cw * 1.4, top - 20); g.lineTo(hx, top - 22); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(hx - sd * cw * 0.2, top - 30); g.quadraticCurveTo(hx + sd * cw * 0.2, top - 42, hx + sd * cw * 1.2, top - 40); g.lineTo(hx + sd * cw * 0.4, top - 30); g.closePath(); g.fill();
          g.fillRect(hx - sd * cw * 1.6 - cw * 0.3, top - 18, cw * 0.6, 7);
        }
      } else { g.beginPath(); g.moveTo(x - cw / 2, top); g.lineTo(x - cw / 5, top - 10); g.lineTo(x + cw / 2, top - 4); g.closePath(); g.fill(); }
    });
    g.fillStyle = 'rgba(5,7,13,.1)'; g.fillRect(0, 0, w, h);
  },
  simorgh(g, w, h) {
    const s = g.createLinearGradient(0, 0, 0, h);
    s.addColorStop(0, '#06141c'); s.addColorStop(0.7, '#0e3340'); s.addColorStop(1, '#1b4a4a');
    g.fillStyle = s; g.fillRect(0, 0, w, h);
    const r = rng(61);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(230,240,255,${0.15 + r() * 0.5})`; g.beginPath(); g.arc(r() * w, r() * h * 0.6, 0.5 + r() * 1.2, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,236,190,.85)'; g.beginPath(); g.arc(w * 0.82, h * 0.2, h * 0.06, 0, Math.PI * 2); g.fill();
    // The Alborz, range behind range.
    for (const [y0, c, seed] of [[0.62, '#123640', 1], [0.72, '#0c2830', 2], [0.84, '#081b21', 3]]) {
      const q = rng(70 + seed);
      g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w + 60; x += 60) g.lineTo(x, h * y0 - q() * h * 0.14);
      g.lineTo(w, h); g.closePath(); g.fill();
    }
    g.save(); g.globalAlpha = 0.9;
    simorgh(g, w * 0.5, h * 0.42, h / 330, {});
    g.restore();
    g.fillStyle = 'rgba(5,7,13,.12)'; g.fillRect(0, 0, w, h);
  },
  isfahan(g, w, h) {
    g.fillStyle = '#0d2350'; g.fillRect(0, 0, w, h);
    const S = 96;
    const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.72 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); };
    for (let j = -1; j <= Math.ceil(h / S) + 1; j++) for (let i = -1; i <= Math.ceil(w / S) + 1; i++) {
      const x = i * S, y = j * S;
      // An eight-pointed star in turquoise with a white edge, a cross in cobalt between the stars.
      star(x, y, S * 0.42); g.fillStyle = '#1d8f9a'; g.fill(); g.strokeStyle = '#e8e2cf'; g.lineWidth = 2.4; g.stroke();
      star(x, y, S * 0.26); g.fillStyle = '#123c84'; g.fill(); g.strokeStyle = '#e8c35a'; g.lineWidth = 1.6; g.stroke();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.fillStyle = '#e8e2cf'; g.beginPath(); g.ellipse(x + Math.cos(a) * S * 0.12, y + Math.sin(a) * S * 0.12, S * 0.07, S * 0.035, a, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(x, y, S * 0.04, 0, Math.PI * 2); g.fill();
      const cx = x + S / 2, cy = y + S / 2;
      g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(cx, cy, S * 0.06, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.fillStyle = '#c4433a'; g.beginPath(); g.ellipse(cx + Math.cos(a) * S * 0.12, cy + Math.sin(a) * S * 0.12, S * 0.06, S * 0.03, a, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = 'rgba(5,7,13,.3)'; g.fillRect(0, 0, w, h);
  },
};
export { WALLPAPERS } from '../pure/desktop.js';
export function paintWallpaper(g, id, w, h) {
  if (!WALLS[id]) return false;
  WALLS[id](g, w, h);
  return true;
}

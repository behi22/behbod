import { C, goldSky, nightSky, cloud, ground, rocks, cypress, tree, figure, horse, rider, lion, dragon, div, goblet } from './art.js';
import { FIELD, LABOURS, LION, DRAGON, CUPS, OLAD, WHITE, cupX } from '../pure/haftkhan.js';

// Haft Khan's pictures: each labour's scene in field units (720 by 420), with its words between rounds.
const SERIF = "Georgia, 'Times New Roman', serif";
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
const DONE = ['Rakhsh kills the lion.', 'The ram leads him to a spring.', 'The dragon is slain.', 'He sees through her.', 'Olad is caught.', 'Arzhang is beaten.', 'The White Div falls.'];
const G = FIELD.ground;

function text(g, s, x, y, px, colour, weight = 400, align = 'center') {
  g.font = `${weight} ${px}px ${SERIF}`; g.fillStyle = colour; g.textAlign = align; g.textBaseline = 'alphabetic';
  g.fillText(s, x, y);
}
function marks(g, n, of, x, y) {
  for (let i = 0; i < of; i++) { g.beginPath(); g.arc(x + i * 18, y, 6, 0, Math.PI * 2); g.fillStyle = i < n ? C.goldHi : 'rgba(255,255,255,.18)'; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); }
}
function meter(g, x, y, w, k, colour, label) {
  g.fillStyle = 'rgba(20,14,10,.55)'; g.fillRect(x, y, w, 12);
  g.fillStyle = colour; g.fillRect(x + 2, y + 2, Math.max(0, Math.min(1, k)) * (w - 4), 8);
  g.strokeStyle = C.goldLo; g.lineWidth = 1.5; g.strokeRect(x, y, w, 12);
  text(g, label, x, y - 5, 13, C.ivory, 700, 'left');
}
function ram(g, x, y, dir) {
  g.save(); g.translate(x, y); g.scale(dir, 1);
  for (const lx of [-14, -6, 8, 14]) { g.strokeStyle = C.ink; g.lineWidth = 4; g.beginPath(); g.moveTo(lx, -14); g.lineTo(lx, 0); g.stroke(); }
  g.beginPath(); g.ellipse(0, -22, 22, 12, 0, 0, Math.PI * 2); g.fillStyle = '#f1ead8'; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.3; g.stroke();
  g.beginPath(); g.ellipse(24, -30, 8, 6, 0.4, 0, Math.PI * 2); g.fillStyle = '#d8ccb0'; g.fill(); g.stroke();
  g.beginPath(); g.arc(20, -36, 6, 0.5, 5.5); g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; g.stroke();
  g.restore();
}
function lying(g, x, y) {
  g.save(); g.translate(x, y); g.rotate(-Math.PI / 2);
  figure(g, 0, 0, 0.62, { coat: 'tiger', head: 'helmet', beard: '#2b1a10', robe: C.jadeLo });
  g.restore();
  text(g, 'z z', x + 4, y - 30, 16, C.ivory, 700);
}

// The scene behind each labour.
const SCENES = {
  lion(g, r, t) {
    nightSky(g, 720, 420, 4, 40);
    ground(g, 720, 300, 420, '#3d5a3a', 5);
    for (let i = 0; i < 18; i++) { g.strokeStyle = i % 2 ? C.jade : C.jadeLo; g.lineWidth = 3; g.beginPath(); g.moveTo(14 + i * 9, 330); g.quadraticCurveTo(10 + i * 9, 280, 20 + i * 9 + Math.sin(t + i) * 4, 250 - (i % 3) * 14); g.stroke(); }
    lying(g, 70, 344);
    g.setLineDash([8, 7]); g.strokeStyle = C.goldHi; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse((LION.ring[0] + LION.ring[1]) / 2, G + 4, (LION.ring[1] - LION.ring[0]) / 2, 12, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    horse(g, 150, G + 8, 0.95, { colour: '#c9803d', spots: '#e8b36a', mane: '#5a3418', saddle: false, gallop: r.cool > 0.2 });
    if (r.x < 800) lion(g, r.x + 44, G + 8, 1, { dir: -1, leap: r.x < 430 });
    marks(g, r.kicks, LION.need, 600, 40);
  },
  desert(g, r) {
    goldSky(g, 720, 420);
    g.fillStyle = 'rgba(255,246,200,.85)'; g.beginPath(); g.arc(600, 90, 42, 0, Math.PI * 2); g.fill();
    for (const [y, c] of [[250, '#e2b867'], [290, '#d9a752']]) { g.beginPath(); g.moveTo(0, 420); for (let x = 0; x <= 720; x += 60) g.quadraticCurveTo(x + 30, y - 22, x + 60, y); g.lineTo(720, 420); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.1; g.stroke(); }
    ground(g, 720, 330, 420, '#cf9d4c', 6, false);
    if (r.got >= 1) { g.beginPath(); g.ellipse(r.ram + 50, G + 8, 50, 10, 0, 0, Math.PI * 2); g.fillStyle = C.teal; g.fill(); g.strokeStyle = C.ink; g.stroke(); }
    ram(g, r.ram, G + 6, r.to >= r.ram ? 1 : -1);
    figure(g, r.rx, G + 10, 0.9, { coat: 'tiger', head: 'helmet', beard: '#2b1a10', robe: C.jadeLo, dir: r.ram >= r.rx ? 1 : -1 });
    meter(g, 30, 34, 200, r.water, '#5bb7e8', 'water');
    meter(g, 490, 34, 200, r.got, C.jade, 'the way to the spring');
  },
  dragon(g, r, t) {
    nightSky(g, 720, 420, 9, 70);
    rocks(g, 600, 340, 260, 170, '#4b4a6a', 10, 4);
    rocks(g, 110, 340, 200, 120, '#3c3b58', 12, 3);
    ground(g, 720, 330, 420, '#2c3b2a', 11, false);
    if (r.at) {
      const k = Math.min(1, (DRAGON.show - r.show) * 5 + 0.25);
      dragon(g, r.at.x - 30, r.at.y + 60, 0.75, { alpha: Math.min(1, k), fire: Math.sin(t * 8) > 0 });
    }
    rider(g, 120, G + 8, 0.8, { coat: 'tiger', head: 'helmet', beard: '#2b1a10', robe: C.jadeLo, arm: 'up', hold: 'sword' }, { colour: '#c9803d', spots: '#e8b36a', mane: '#5a3418' });
    marks(g, r.hits, 3, 600, 40);
  },
  sorceress(g, r, t) {
    goldSky(g, 720, 420);
    cloud(g, 160, 70, 1); cloud(g, 560, 60, 0.8);
    tree(g, 70, 300, 1.4, 3); tree(g, 650, 300, 1.3, 8); cypress(g, 600, 300, 110);
    ground(g, 720, 290, 420, C.jade, 7);
    g.fillStyle = C.vermilion; g.beginPath(); g.moveTo(110, 280 + 40); g.lineTo(610, 320); g.lineTo(640, 372); g.lineTo(80, 372); g.closePath(); g.fill(); g.strokeStyle = C.gold; g.lineWidth = 3; g.stroke();
    figure(g, 660, 330, 0.85, { head: 'veil', robe: '#7c3f8f', dir: -1, veil: C.ivory });
    for (const cup of [0, 1, 2]) {
      const { x, lift } = cupX(r, cup), y = 350 + lift;
      const shown = (r.stage === 'show' || r.picked !== null) && cup === r.charmed;
      if (shown) { g.fillStyle = 'rgba(110,40,140,.55)'; g.beginPath(); g.ellipse(x, y - 70, 26 + Math.sin(t * 6) * 3, 16, 0, 0, Math.PI * 2); g.fill(); }
      goblet(g, x, y, 0.95, shown ? '#b48ad0' : C.gold);
    }
    if (r.stage === 'pick') {
      const x = CUPS.slots[r.picked ?? r.sel];
      g.fillStyle = C.ivory; g.beginPath(); g.moveTo(x, 362); g.lineTo(x - 9, 376); g.lineTo(x + 9, 376); g.closePath(); g.fill();
      text(g, 'Which cup did she charm?', 360, 60, 22, C.ink, 700);
    } else if (r.stage === 'show') text(g, 'She charms one cup.', 360, 60, 22, C.ink, 700);
  },
  olad(g, r) {
    goldSky(g, 720, 420);
    rocks(g, 140, 270, 300, 150, C.lilac, 14, 4); rocks(g, 560, 270, 320, 170, C.rose, 15, 4);
    ground(g, 720, 260, 420, '#7aa35a', 16);
    rider(g, r.ox, G - 10, 0.75, { head: 'turban', robe: C.lapis, arm: 'down' }, { colour: '#b9b4ab', mane: '#5c5852', gallop: true, dir: r.ov >= 0 ? 1 : -1 });
    figure(g, 46, 400, 0.85, { coat: 'tiger', head: 'helmet', beard: '#2b1a10', robe: C.jadeLo, arm: 'up', hold: 'lasso' });
    const ax = r.lasso ? r.lasso.x : r.aim;
    g.strokeStyle = r.lasso ? 'rgba(255,255,255,.25)' : C.ivory; g.lineWidth = 2; g.setLineDash([5, 5]);
    g.beginPath(); g.ellipse(ax, G + 4, OLAD.reach, 10, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    if (r.lasso) {
      const k = Math.min(1, r.lasso.t / OLAD.fly), x = 60 + (r.lasso.x - 60) * k, y = 316 + (G - 70 - 316) * k - Math.sin(k * Math.PI) * 120;
      g.strokeStyle = '#c9a36a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(60, 316); g.quadraticCurveTo((60 + x) / 2, y - 80, x, y); g.stroke();
      g.beginPath(); g.ellipse(x, y + 6, 18, 9, 0, 0, Math.PI * 2); g.stroke();
    }
  },
  arzhang(g, r) {
    goldSky(g, 720, 420);
    for (const [x, c] of [[90, C.vermilion], [630, '#4b3a6a'], [520, '#4b3a6a']]) { g.beginPath(); g.moveTo(x - 46, 300); g.lineTo(x, 236); g.lineTo(x + 46, 300); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.3; g.stroke(); }
    ground(g, 720, 296, 420, '#a88f58', 17);
    const clash = 140 + Math.max(0, Math.min(1, r.bar)) * 440;
    div(g, clash + 58, G + 30, 1.05, { colour: '#3e6a63', spot: '#2a4a45', arm: 'down', dir: -1 });
    figure(g, clash - 44, G + 30, 1.3, { coat: 'tiger', head: 'helmet', beard: '#2b1a10', robe: C.jadeLo, arm: 'forward', hold: 'mace' });
    meter(g, 160, 34, 400, r.bar, C.goldHi, 'push him back');
  },
  whitediv(g, r, t) {
    g.fillStyle = '#0d0a0c'; g.fillRect(0, 0, 720, 420);
    const glow = g.createRadialGradient(360, 260, 20, 360, 260, 380);
    glow.addColorStop(0, 'rgba(160,110,60,.55)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 720, 420);
    rocks(g, 60, 360, 200, 330, '#2a2326', 18, 5); rocks(g, 670, 360, 200, 330, '#2a2326', 19, 5);
    ground(g, 720, 340, 420, '#2e2620', 20, false);
    div(g, 360, 300, 1.25, { colour: '#ece8dc', spot: '#9c988c', arm: r.open > 0 ? 'down' : 'up' });
    if (r.open > 0) { g.strokeStyle = `rgba(255,214,120,${0.5 + 0.4 * Math.sin(t * 14)})`; g.lineWidth = 4; g.beginPath(); g.ellipse(360, 230, 70, 100, 0, 0, Math.PI * 2); g.stroke(); text(g, 'Strike now!', 360, 60, 24, C.goldHi, 700); }
    if (r.rock) {
      const k = Math.min(1, r.rock.t / WHITE.warn);
      g.fillStyle = `rgba(0,0,0,${0.25 + 0.4 * k})`; g.beginPath(); g.ellipse(r.rock.x, G + 14, WHITE.reach * (0.5 + 0.5 * k), 9, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(r.rock.x, 20 + (G - 20) * k * k, 26, 0, Math.PI * 2); g.fillStyle = '#7d756c'; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.5; g.stroke();
    }
    figure(g, r.rx, G + 30, 1.05, { coat: 'tiger', head: 'helmet', beard: '#2b1a10', robe: C.jadeLo, arm: 'up', hold: 'sword' });
    marks(g, r.strikes, WHITE.need, 600, 40);
  },
};

// The whole picture for the quest's state; `t` in seconds for the flames and the reeds.
export function paintQuest(g, st, t = 0) {
  const i = Math.min(st.labour, LABOURS.length - 1), L = LABOURS[i];
  g.save(); g.beginPath(); g.rect(0, 0, FIELD.w, FIELD.h); g.clip();
  SCENES[L.id](g, st.r, t);
  // Rostam's lives, in the corner.
  for (let k = 0; k < 3; k++) { g.save(); g.translate(30 + k * 26, FIELD.h - 22); g.beginPath(); g.moveTo(0, -10); g.lineTo(8, 0); g.lineTo(0, 10); g.lineTo(-8, 0); g.closePath(); g.fillStyle = k < st.lives ? C.goldHi : 'rgba(255,255,255,.15)'; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.stroke(); g.restore(); }
  if (st.phase === 'intro' || st.phase === 'won' || st.phase === 'hurt') {
    g.fillStyle = 'rgba(12,8,6,.66)'; g.fillRect(0, 0, FIELD.w, FIELD.h);
    if (st.phase === 'intro') {
      text(g, `The ${ORDINAL[i]} labour`, 360, 150, 18, C.goldHi, 400);
      text(g, L.name, 360, 196, 38, C.ivory, 700);
      text(g, L.how, 360, 240, 18, C.ivory, 400);
    } else if (st.phase === 'won') text(g, DONE[i], 360, 210, 30, C.goldHi, 700);
    else { text(g, 'Rostam falls back.', 360, 196, 30, C.vermilion, 700); text(g, `${st.lives} ${st.lives === 1 ? 'life' : 'lives'} left. Again.`, 360, 236, 18, C.ivory); }
  }
  g.restore();
}

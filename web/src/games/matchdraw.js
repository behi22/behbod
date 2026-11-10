// The five-a-side match drawn like a TV broadcast: a camera high on the far side following the ball, the pitch in
// perspective, the players in their kits, the score bug and the LIVE tag. Used by the TV in the room and by the game
// when you join in.
import { LEN, WID, GOAL } from '../pure/match.js';

export const KITS = [
  { name: 'BEHI FC', short: 'BEHI', shirt: '#f3f4f8', trim: '#7d4fe0', shorts: '#e3e4ec', keeper: '#7d4fe0', keeperTrim: '#f3f4f8', ink: '#2b2140' },
  { name: 'BOTS', short: 'BOTS', shirt: '#1f2533', trim: '#ff8a3d', shorts: '#161b26', keeper: '#ff8a3d', keeperTrim: '#1b1f29', ink: '#ffd7bd' },
];
const SANS = "'Segoe UI', system-ui, sans-serif", MONO = "'JetBrains Mono', ui-monospace, Consolas, monospace";
const VIEW = 26;

// A camera that follows the ball across, easing so the picture never jumps.
export function makeCamera() { return { x: 0 }; }
export function follow(cam, m, dt) {
  const target = Math.max(-LEN + VIEW / 2 - 2, Math.min(LEN - VIEW / 2 + 2, m.ball.x));
  cam.x += (target - cam.x) * Math.min(1, dt * 2.2);
}

// Pitch metres to the picture: far touchline high and narrow, near touchline low and wide.
function projector(w, h, cam) {
  const top = h * 0.3, bottom = h * 0.97, ppm = w / VIEW;
  return (x, y) => {
    const t = (WID - y) / (2 * WID), s = 0.62 + 0.38 * t;
    return { x: w / 2 + (x - cam.x) * ppm * s, y: top + t * (bottom - top), s: s * ppm };
  };
}

// The stadium behind the pitch never changes, so it is drawn once per picture size and copied in each frame: the sky
// with its floodlights, and the far stand's crowd, which slides with the camera and wraps round.
const stadiums = new Map();
function stadium(w, h, sc) {
  const key = `${w}x${h}x${sc}`;
  if (stadiums.has(key)) return stadiums.get(key);
  if (stadiums.size > 3) stadiums.clear();
  const make = () => { const e = document.createElement('canvas'); e.width = Math.ceil(w * sc); e.height = Math.ceil(h * 0.3 * sc); const x = e.getContext('2d'); x.setTransform(sc, 0, 0, sc, 0, 0); return [e, x]; };
  const [sky, k] = make(), [crowd, q] = make();
  const grad = k.createLinearGradient(0, 0, 0, h * 0.32);
  grad.addColorStop(0, '#0a1120'); grad.addColorStop(1, '#1c2b45');
  k.fillStyle = grad; k.fillRect(0, 0, w, h * 0.3);
  for (let i = 0; i < 5; i++) {
    const x = ((i + 0.5) / 5) * w, glow = k.createRadialGradient(x, h * 0.04, 0, x, h * 0.04, w * 0.14);
    glow.addColorStop(0, 'rgba(255,255,235,.55)'); glow.addColorStop(1, 'rgba(255,255,235,0)');
    k.fillStyle = glow; k.fillRect(x - w * 0.14, 0, w * 0.28, h * 0.3);
  }
  k.fillStyle = '#232c42'; k.fillRect(0, h * 0.16, w, h * 0.14);
  q.globalAlpha = 0.32;
  for (let i = 0; i < 520; i++) {
    q.fillStyle = ['#e8e3d8', '#7d4fe0', '#ff8a3d', '#9fb1d6'][i % 4];
    q.fillRect(((i * 53.17) % w + w) % w, h * 0.17 + ((i * 37) % 100) / 100 * h * 0.12, w / 360, h / 160);
  }
  const out = { sky, crowd };
  stadiums.set(key, out);
  return out;
}

export function drawMatch(g, w, h, m, cam, { you = null, minute = 0, live = true, banner = '' } = {}) {
  const P = projector(w, h, cam);
  g.fillStyle = '#1c2b45'; g.fillRect(0, 0, w, h);
  const st = stadium(w, h, Math.max(1, Math.abs(g.getTransform().a))), shift = ((cam.x * 9) % w + w) % w;
  g.drawImage(st.sky, 0, 0, w, h * 0.3);
  g.drawImage(st.crowd, -shift, 0, w, h * 0.3); g.drawImage(st.crowd, w - shift, 0, w, h * 0.3);
  // The pitch, mown in stripes.
  const corners = [P(-LEN - 2, WID + 1), P(LEN + 2, WID + 1), P(LEN + 2, -WID - 1), P(-LEN - 2, -WID - 1)];
  g.fillStyle = '#2b7a39';
  poly(g, corners); g.fill();
  for (let x = -LEN; x < LEN; x += 4) {
    if (Math.round((x + LEN) / 4) % 2) continue;
    g.fillStyle = 'rgba(255,255,255,.045)';
    poly(g, [P(x, WID), P(x + 4, WID), P(x + 4, -WID), P(x, -WID)]); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,.78)'; g.lineWidth = Math.max(1, w / 640);
  poly(g, [P(-LEN, WID), P(LEN, WID), P(LEN, -WID), P(-LEN, -WID)]); g.stroke();
  line(g, P(0, WID), P(0, -WID));
  g.beginPath();
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2, q = P(Math.cos(a) * 3, Math.sin(a) * 3); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }
  g.stroke();
  for (const s of [-1, 1]) {
    poly(g, [P(s * LEN, 5.5), P(s * (LEN - 5), 5.5), P(s * (LEN - 5), -5.5), P(s * LEN, -5.5)]); g.stroke();
  }
  // The goals: a frame standing on each goal line with its net behind.
  const goal = s => {
    const a = P(s * LEN, GOAL), b = P(s * LEN, -GOAL), hh = 1.1;
    const back = [P(s * (LEN + 1.2), GOAL), P(s * (LEN + 1.2), -GOAL)];
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1;
    for (let k = 0; k <= 8; k++) { const t = k / 8; line(g, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - hh * (a.s + (b.s - a.s) * t) }, { x: back[0].x + (back[1].x - back[0].x) * t, y: back[0].y + (back[1].y - back[0].y) * t }); }
    g.strokeStyle = '#f4f4f0'; g.lineWidth = Math.max(2, w / 360);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x, a.y - hh * a.s); g.lineTo(b.x, b.y - hh * b.s); g.lineTo(b.x, b.y); g.stroke();
  };
  goal(-1); goal(1);
  // Players, far side first, and the ball in its place among them.
  const drawn = m.players.map(p => ({ kind: 'p', p, y: p.y })).concat([{ kind: 'b', y: m.ball.y }]).sort((a, b) => b.y - a.y);
  for (const d of drawn) {
    if (d.kind === 'b') {
      const q = P(m.ball.x, m.ball.y), r = Math.max(2, q.s * 0.14);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(q.x, q.y, r * 1.3, r * 0.45, 0, 0, 7); g.fill();
      g.fillStyle = '#f7f7f2'; g.beginPath(); g.arc(q.x, q.y - r, r, 0, 7); g.fill();
      continue;
    }
    const p = d.p, q = P(p.x, p.y), k = KITS[p.team], u = q.s, keeper = p.role === 'keeper';
    const run = Math.sin((m.clock * 9 + p.num) * (p === m.ball.owner ? 1.2 : 1)) * 0.18 * u;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(q.x, q.y, u * 0.32, u * 0.1, 0, 0, 7); g.fill();
    g.strokeStyle = '#1c1d22'; g.lineWidth = Math.max(1.5, u * 0.11);
    line(g, { x: q.x - u * 0.08, y: q.y - u * 0.7 }, { x: q.x - u * 0.08 + run, y: q.y });
    line(g, { x: q.x + u * 0.08, y: q.y - u * 0.7 }, { x: q.x + u * 0.08 - run, y: q.y });
    g.fillStyle = keeper ? k.keeper : k.shorts; g.fillRect(q.x - u * 0.17, q.y - u * 0.85, u * 0.34, u * 0.22);
    g.fillStyle = keeper ? k.keeper : k.shirt; g.fillRect(q.x - u * 0.2, q.y - u * 1.38, u * 0.4, u * 0.56);
    g.fillStyle = keeper ? k.keeperTrim : k.trim; g.fillRect(q.x - u * 0.2, q.y - u * 1.38, u * 0.4, u * 0.07);
    if (u > 14) { g.fillStyle = keeper ? k.keeperTrim : k.ink; g.font = `700 ${Math.round(u * 0.26)}px ${SANS}`; g.textAlign = 'center'; g.fillText(String(p.num), q.x, q.y - u * 0.98); }
    g.fillStyle = '#c99a78'; g.beginPath(); g.arc(q.x, q.y - u * 1.55, u * 0.14, 0, 7); g.fill();
    if (p === you) {
      g.fillStyle = '#3ee6c4'; g.beginPath(); g.moveTo(q.x, q.y - u * 1.78); g.lineTo(q.x - u * 0.16, q.y - u * 2.05); g.lineTo(q.x + u * 0.16, q.y - u * 2.05); g.fill();
    }
  }
  // The score bug and the LIVE tag.
  const fs = Math.round(h / 22), pad = fs * 0.6;
  g.font = `800 ${fs}px ${SANS}`; g.textAlign = 'left';
  const label = `${KITS[0].short} ${m.score[0]} - ${m.score[1]} ${KITS[1].short}`, lw = g.measureText(label).width;
  g.fillStyle = 'rgba(8,10,16,.86)'; g.fillRect(pad, pad, lw + fs * 4.6, fs * 1.7);
  g.fillStyle = KITS[0].trim; g.fillRect(pad, pad, fs * 0.25, fs * 1.7);
  g.fillStyle = KITS[1].trim; g.fillRect(pad + lw + fs * 4.35, pad, fs * 0.25, fs * 1.7);
  g.fillStyle = '#e8edf5'; g.fillText(label, pad + fs * 0.7, pad + fs * 1.18);
  g.font = `600 ${Math.round(fs * 0.8)}px ${MONO}`; g.fillStyle = '#9aa6bd'; g.fillText(`${minute}'`, pad + lw + fs * 1.4, pad + fs * 1.15);
  if (live) {
    g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(w - pad - fs * 3.2, pad + fs * 0.85, fs * 0.28, 0, 7); g.fill();
    g.fillStyle = '#e8edf5'; g.font = `700 ${Math.round(fs * 0.8)}px ${MONO}`; g.fillText('LIVE', w - pad - fs * 2.7, pad + fs * 1.15);
  }
  const msg = banner || (m.phase === 'goal' ? 'GOAL!' : '');
  if (msg) {
    g.textAlign = 'center'; g.fillStyle = 'rgba(8,10,16,.72)'; g.fillRect(w / 2 - w * 0.22, h * 0.42, w * 0.44, h * 0.13);
    g.fillStyle = '#ffd54a'; g.font = `800 ${Math.round(h / 12)}px ${SANS}`; g.fillText(msg, w / 2, h * 0.515);
  }
  g.textAlign = 'left';
}

function poly(g, pts) { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); }
function line(g, a, b) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }

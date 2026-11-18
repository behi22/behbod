import { COURT, LEVELS, newDuel, step as stepDuel } from './pure/paddle.js';
import { SKY, newOrbit, step as stepOrbit, score as orbitScore, place as orbitPlace } from './pure/orbit.js';
import { FIELD, KINDS, newHunt, step as stepHunt, swat, left as huntLeft } from './pure/bughunt.js';
import { GAMES, gameById, fitGame, toGame, readBest } from './pure/arcade.js';

// The three games on the computer, played in the Games window while you sit at the desk. The rules are in src/pure;
// this runs them, draws them on a 2D canvas, takes the mouse, a finger or the keys, and keeps the best scores.
const INK = '#d8e0ee', DIM = '#7f8aa0', ACCENT = '#3ee6c4', WARM = '#ffb35c', BAD = '#ff6b5c', BG = '#05080d', FONT = "'JetBrains Mono', ui-monospace, Consolas, monospace";
const KEY = 'home.games', TRAIL = 6;
// A fixed sky of faint stars behind Orbit.
const STARS = (() => { let s = 22; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); return Array.from({ length: 46 }, () => [r() * SKY.size, r() * SKY.size, 0.6 + r() * 1.1, 0.15 + r() * 0.35]); })();

function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Paints one game's picture in its own units. `o`: t (seconds, for wobbles), thrust, done, trail, pops, cover ({ title, sub, good }).
function paint(g, id, st, o = {}) {
  const [gw, gh] = gameById(id).size;
  g.fillStyle = BG; g.fillRect(0, 0, gw, gh);
  if (id === 'paddle') {
    g.strokeStyle = 'rgba(127,138,160,.22)'; g.lineWidth = 2; g.setLineDash([10, 12]); g.beginPath(); g.moveTo(0, gh / 2); g.lineTo(gw, gh / 2); g.stroke(); g.setLineDash([]);
    g.font = `700 54px ${FONT}`; g.textAlign = 'center'; g.fillStyle = 'rgba(216,224,238,.12)';
    g.fillText(String(st.score.ai), gw / 2, gh / 2 - 34); g.fillText(String(st.score.you), gw / 2, gh / 2 + 76);
    g.fillStyle = DIM; rrect(g, st.ai - COURT.paddle / 2, COURT.edge, COURT.paddle, COURT.thick, 6); g.fill();
    g.fillStyle = ACCENT; rrect(g, st.you - COURT.paddle / 2, gh - COURT.edge - COURT.thick, COURT.paddle, COURT.thick, 6); g.fill();
    (o.trail || []).forEach(([x, y], i, all) => { g.fillStyle = `rgba(216,224,238,${0.05 + 0.12 * (i + 1) / all.length})`; g.beginPath(); g.arc(x, y, COURT.ball * (0.5 + 0.4 * (i + 1) / all.length), 0, 7); g.fill(); });
    const halo = g.createRadialGradient(st.ball.x, st.ball.y, 0, st.ball.x, st.ball.y, COURT.ball * 3);
    halo.addColorStop(0, 'rgba(216,224,238,.35)'); halo.addColorStop(1, 'rgba(216,224,238,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(st.ball.x, st.ball.y, COURT.ball * 3, 0, 7); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(st.ball.x, st.ball.y, COURT.ball, 0, 7); g.fill();
  } else if (id === 'orbit') {
    const c = gw / 2;
    for (const [x, y, r, a] of STARS) { g.fillStyle = `rgba(216,224,238,${a})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    for (const r of [SKY.low, SKY.high]) { g.strokeStyle = r === SKY.low ? 'rgba(255,107,92,.35)' : 'rgba(127,138,160,.3)'; g.lineWidth = 1.5; g.setLineDash([4, 8]); g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }
    g.setLineDash([]);
    const glow = g.createRadialGradient(c - 12, c - 14, 4, c, c, SKY.planet);
    glow.addColorStop(0, '#5fe3d0'); glow.addColorStop(1, '#0e3a44');
    g.fillStyle = glow; g.beginPath(); g.arc(c, c, SKY.planet, 0, 7); g.fill();
    for (const rk of st.rocks) { const [x, y] = orbitPlace(rk.a, rk.r); g.fillStyle = '#8a93a6'; g.beginPath(); g.arc(x, y, rk.size, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(x + rk.size * 0.25, y + rk.size * 0.2, rk.size * 0.45, 0, 7); g.fill(); }
    if (st.spark) { const [x, y] = orbitPlace(st.spark.a, st.spark.r), p = 4 + Math.sin((o.t || 0) * 6) * 1.5; g.fillStyle = WARM; g.beginPath(); g.arc(x, y, p, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,179,92,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, p + 5, 0, 7); g.stroke(); }
    const [sx, sy] = orbitPlace(st.a, st.r);
    g.save(); g.translate(sx, sy); g.rotate(st.a + Math.PI / 2 - Math.atan2(st.vr, 140));
    if (o.thrust && !o.done) { g.fillStyle = WARM; g.beginPath(); g.moveTo(-3, 6); g.lineTo(0, 13 + Math.sin((o.t || 0) * 40) * 2.5); g.lineTo(3, 6); g.fill(); }
    g.fillStyle = o.done ? BAD : INK; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath(); g.fill();
    g.restore();
  } else {
    // A page of code for the bugs to crawl on.
    for (let i = 0; i < 20; i++) { g.fillStyle = i % 5 === 0 ? 'rgba(62,230,196,.2)' : 'rgba(127,138,160,.16)'; g.fillRect(28 + (i % 4) * 14, 16 + i * 20, 90 + ((i * 53) % 420), 8); }
    const t = o.t || 0;
    for (const b of st.bugs) {
      const K = KINDS[b.kind], s = K.size / 15;
      g.save(); g.translate(b.x, b.y); g.rotate(Math.atan2(b.vy, b.vx)); g.scale(s, s);
      g.strokeStyle = '#0c0f14'; g.lineWidth = 1.6;
      for (const leg of [-5, 0, 5]) { g.beginPath(); g.moveTo(leg, -8); g.lineTo(leg + 2 * Math.sin(t * 22 + leg), -13); g.moveTo(leg, 8); g.lineTo(leg - 2 * Math.sin(t * 22 + leg), 13); g.stroke(); }
      g.fillStyle = b.kind === 'friend' ? '#e2452f' : b.kind === 'quick' ? WARM : '#7fd35c'; g.beginPath(); g.ellipse(0, 0, 10, 7.5, 0, 0, 7); g.fill();
      g.fillStyle = '#10151c'; g.beginPath(); g.arc(9, 0, 4.2, 0, 7); g.fill();
      if (b.kind === 'friend') for (const [x, y] of [[-3, -3], [2, 3], [-5, 3], [3, -3]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
      g.restore();
    }
  }
  g.font = `700 16px ${FONT}`; g.textAlign = 'center';
  for (const p of o.pops || []) { g.globalAlpha = Math.max(0, 1 - p.t / 0.8); g.fillStyle = p.bad ? BAD : WARM; g.fillText(p.text, p.at[0], p.at[1] - 14 - p.t * 30); }
  g.globalAlpha = 1;
  if (o.cover) {
    g.fillStyle = 'rgba(5,8,13,.72)'; g.fillRect(0, 0, gw, gh);
    g.fillStyle = INK; g.font = `700 30px ${FONT}`; g.fillText(o.cover.title, gw / 2, gh / 2 - 8);
    g.font = `400 15px ${FONT}`; g.fillStyle = o.cover.good ? ACCENT : DIM; g.fillText(o.cover.sub, gw / 2, gh / 2 + 22);
  }
  g.textAlign = 'left';
}

// Still pictures for the launcher's cards: each game a moment in.
const STILLS = {
  paddle: () => { const d = newDuel('normal'); Object.assign(d, { you: 430, ai: 300, score: { you: 3, ai: 2 } }); Object.assign(d.ball, { x: 470, y: 150 }); return { st: d, trail: [[530, 252], [516, 228], [502, 204], [488, 180]] }; },
  orbit: () => { const o = newOrbit(); Object.assign(o, { a: -0.5, r: 132, vr: 30, spark: { a: 0.9, r: 150 } }); o.rocks = [{ a: 2.2, r: 110, size: 10 }, { a: 3.6, r: 170, size: 8 }, { a: -2.2, r: 90, size: 12 }]; return { st: o, thrust: true }; },
  bughunt: () => { const h = newHunt(); h.bugs = [[180, 140, 1, 0.3, 'bug'], [420, 250, -1, 0.5, 'quick'], [560, 120, 0, 1, 'friend'], [300, 330, 1, -0.6, 'bug']].map(([x, y, vx, vy, kind], i) => ({ id: i, kind, x, y, vx, vy })); return { st: h, t: 0.3, pops: [{ text: '+11', at: [250, 200], t: 0.25 }] }; },
};

export function makeDeskGames({ store, sfx, onEvent } = {}) {
  let saved = null;
  try { saved = store?.get(KEY); } catch (e) { /* storage refused: the bests last this visit */ }
  const best = readBest(saved);
  const save = () => { try { store?.set(KEY, JSON.stringify(best)); } catch (e) { /* kept for this visit only */ } };
  // What is being played: { id, st (the game's own state), level, paused, done, note, record, t }.
  let play = null;
  const held = { left: false, right: false, thrust: false }, pointer = { x: null, down: false };
  const pops = [], trail = [];

  function record(id, value) {
    if (!(value > (best[id] || 0))) return false;
    best[id] = Math.min(1e6, Math.floor(value)); save();
    return true;
  }
  function finish(note, value) {
    play.done = true;
    play.note = note;
    play.record = record(play.id, value);
    onEvent?.('over', { game: play.id, value, level: play.level, record: play.record });
  }
  const release = () => { held.left = held.right = held.thrust = false; pointer.down = false; };

  const api = {
    GAMES,
    get playing() { return play; },
    best: id => best[id] || 0,
    get bests() { return { ...best }; },
    levels: LEVELS,
    start(id, level = 'normal') {
      if (!gameById(id)) return false;
      const L = Object.hasOwn(LEVELS, level) ? level : 'normal';
      play = { id, level: L, paused: false, done: false, note: '', record: false, t: 0, st: id === 'paddle' ? newDuel(L) : id === 'orbit' ? newOrbit() : newHunt() };
      release(); pointer.x = null; pops.length = 0; trail.length = 0;
      return true;
    },
    again() { return play ? api.start(play.id, play.level) : false; },
    stop() { play = null; release(); },
    // Pauses (or carries on); says whether anything changed. A finished game stays finished.
    pause(on = !play?.paused) {
      if (!play || play.done || play.paused === on) return false;
      play.paused = on; release();
      return true;
    },
    release,
    // dt in seconds. Moves whichever game is on.
    tick(dt) {
      if (!play || play.paused || play.done || !(dt > 0)) return;
      dt = Math.min(dt, 0.05);
      play.t += dt;
      const st = play.st;
      if (play.id === 'paddle') {
        for (const e of stepDuel(st, dt, pointer.x !== null ? { to: pointer.x } : held)) {
          if (e.type === 'hit') sfx?.click?.(); else if (e.type === 'point') (e.to === 'you' ? sfx?.blip : sfx?.miss)?.();
          else if (e.type === 'win') { finish(e.by === 'you' ? 'You win' : 'The computer wins', st.best); onEvent?.('duel', { won: e.by === 'you', level: play.level, rally: st.best }); }
        }
        trail.push([st.ball.x, st.ball.y]);
        while (trail.length > TRAIL) trail.shift();
        if (st.wait > 0) trail.length = 0;
      } else if (play.id === 'orbit') {
        for (const e of stepOrbit(st, dt, held.thrust || pointer.down)) {
          if (e.type === 'spark') { sfx?.blip?.(); pops.push({ text: '+3', at: orbitPlace(st.a, st.r), t: 0 }); }
          else if (e.type === 'crash') { sfx?.miss?.(); finish(e.why === 'planet' ? 'Burned up' : e.why === 'space' ? 'Lost to space' : 'Hit a rock', orbitScore(st)); }
        }
      } else {
        for (const e of stepHunt(st, dt)) if (e.type === 'end') finish("Time's up", st.score);
      }
      for (const p of pops) p.t += dt;
      while (pops.length && pops[0].t > 0.8) pops.shift();
    },
    // A press or a move on the picture, in the game's own units. kind: down, move, up or leave.
    point(x, y, kind) {
      if (!play || play.done || !Number.isFinite(x) || !Number.isFinite(y)) { if (kind === 'up' || kind === 'leave') pointer.down = false; return; }
      if (kind === 'up' || kind === 'leave') { pointer.down = false; if (kind === 'leave' || play.id !== 'paddle') pointer.x = null; return; }
      if (kind === 'down') pointer.down = true;
      if (play.id === 'paddle') pointer.x = x;
      if (play.id === 'bughunt' && kind === 'down' && !play.paused) {
        for (const e of swat(play.st, x, y)) {
          if (e.type === 'squash') { sfx?.hit?.(); pops.push({ text: `+${e.points}${e.combo > 2 ? ' x' + e.combo : ''}`, at: [x, y], t: 0 }); }
          else if (e.type === 'ouch') { sfx?.miss?.(); pops.push({ text: '-5 s', at: [x, y], t: 0, bad: true }); }
        }
      }
    },
    // A point on a w by h box the game is drawn in, in the game's own units.
    at: (x, y, w, h) => (play ? toGame(play.id, x, y, w, h) : [NaN, NaN]),
    // A key going down or up (`repeat`: the key is held and the browser is repeating it). True when the game used it.
    key(code, down, repeat = false) {
      if (!play) return false;
      if (code === 'ArrowLeft' || code === 'KeyA') { held.left = down; if (down) pointer.x = null; return true; }
      if (code === 'ArrowRight' || code === 'KeyD') { held.right = down; if (down) pointer.x = null; return true; }
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') { held.thrust = down; return true; }
      if (code === 'KeyP') { if (down && !repeat) api.pause(); return true; }
      return false;
    },
    // The score line over the picture.
    status() {
      if (!play) return '';
      const st = play.st;
      if (play.id === 'paddle') return `you ${st.score.you} : ${st.score.ai} computer   rally ${st.rally}   ${LEVELS[play.level].name}`;
      if (play.id === 'orbit') return `score ${orbitScore(st)}   sparks ${st.sparks}   rocks ${st.rocks.length}`;
      return `${Math.ceil(huntLeft(st))} s   score ${st.score}   squashed ${st.squashed}`;
    },
    // Paints the game being played, as big as fits and centred in the w by h box at the context's origin. It paints
    // only the game's own picture, so whatever is around it stays as it was.
    draw(g, w, h) {
      if (!play) return;
      const f = fitGame(play.id, w, h);
      const cover = play.done ? { title: play.note, sub: play.record ? 'A new best.' : `Best: ${best[play.id] || 0}`, good: play.record } : play.paused ? { title: 'Paused', sub: 'Go on, or press P' } : null;
      g.save(); g.translate(f.x, f.y); g.scale(f.k, f.k);
      paint(g, play.id, play.st, { t: play.t, thrust: held.thrust || pointer.down, done: play.done, trail: play.id === 'paddle' ? trail : null, pops, cover });
      g.restore();
    },
    // A still of a game for its card, in the same way.
    preview(g, id, w, h) {
      if (!STILLS[id]) return;
      const f = fitGame(id, w, h), s = STILLS[id]();
      g.save(); g.translate(f.x, f.y); g.scale(f.k, f.k);
      paint(g, id, s.st, s);
      g.restore();
    },
  };
  return api;
}

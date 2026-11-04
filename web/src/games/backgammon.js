// Backgammon against a bot on a walnut board. You play the ivory checkers, moving from your 24 point home to your 1 point.
import * as B from './pure/backgammon.js';
import { h, button, fit, endCard, injectStyles, ACCENT, DIM, INK, MONO, reducedMotion } from './ui.js';

const STYLE = { id: 'backgammon', css: `
.g-bg { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; }
.g-bg-board { flex: none; position: relative; }
.g-bg-board canvas { display: block; touch-action: none; cursor: pointer; border-radius: 8px; }
.g-bg-bar { flex: none; display: flex; align-items: center; gap: 10px 16px; flex-wrap: wrap; justify-content: space-between; }
.g-bg-info { min-width: 0; flex: 1 1 260px; }
.g-bg-status { font-size: 13px; color: ${INK}; min-height: 18px; }
.g-bg-pips { font-size: 11px; color: ${DIM}; margin-top: 2px; }
.g-bg-bar .g-row { flex: none; }
.g-bg-bar .g-btn[hidden] { display: none; }
@media (max-width: 560px) { .g-bg { padding: 10px 8px 12px; gap: 10px; } .g-bg-bar .g-row { width: 100%; } .g-bg-bar .g-row .g-btn { flex: 1; } }
` };

const C = {
  frame: ['#7a4e2d', '#55331b'], field: '#2a1910', red: ['#b53a33', '#8f2a25'], cream: ['#efe3c7', '#d6c39d'],
  ivory: ['#fbf4e4', '#d9c8a6', '#9d8661'], walnut: ['#4a3023', '#1c120c', '#b07a4f'],
};
const tally = { you: 0, them: 0 };
const ease = t => 1 - Math.pow(1 - t, 3);

export function mount(body, api) {
  injectStyles(STYLE);
  const calm = reducedMotion();
  const coarse = matchMedia('(pointer: coarse)').matches;
  const canvas = h('canvas', { 'aria-label': 'Backgammon board. Pick a checker, then where it goes.' });
  const boardBox = h('div', { class: 'g-bg-board' }, canvas);
  const status = h('div', { class: 'g-bg-status', 'aria-live': 'polite' });
  const pips = h('div', { class: 'g-bg-pips' });
  const undoBtn = button('Undo', () => undo());
  const rollBtn = button('Roll', () => roll(), 'g-main');
  const doneBtn = button('Done', () => endTurn(), 'g-main');
  const controls = h('div', { class: 'g-bg-bar' }, h('div', { class: 'g-bg-info' }, status, pips), h('div', { class: 'g-row' }, undoBtn, rollBtn, doneBtn));
  const wrap = h('div', { class: 'g-bg' }, boardBox, controls);
  body.append(wrap);

  let g, G = null, bg = null;
  let state, shown, phase, dice = null, opening = null, seqs = [], played = [], turnStart = null, sel = null, card = null;
  let queue = [], cur = null, timers = [], gen = 0, raf = 0, alive = true;
  const later = (fn, ms) => { const mine = gen; const id = setTimeout(() => { timers = timers.filter(t => t !== id); if (mine === gen && alive) fn(); }, ms); timers.push(id); };
  const die = () => 1 + Math.floor(Math.random() * 6);

  // ---------- geometry ----------
  function layout() {
    const r = body.getBoundingClientRect();
    const ctrlH = controls.getBoundingClientRect().height + 12;
    const narrow = r.width <= 560;
    const maxW = Math.min(r.width - (narrow ? 16 : 32), ((r.height - ctrlH - (narrow ? 22 : 32)) * 15.36) / 11.74, 1000);
    const pw = Math.max(16, Math.floor(maxW / 15.36));
    const fr = Math.round(pw * 0.42), barW = Math.round(pw * 0.95), trayW = Math.round(pw * 1.15);
    const W = fr + 12 * pw + barW + fr + trayW + fr, H = Math.round(fr * 2 + pw * 10.9);
    ({ g } = fit(canvas, W, H));
    const leftX = fr, barX = fr + 6 * pw, rightX = barX + barW, fieldEnd = rightX + 6 * pw, trayX = fieldEnd + fr;
    G = { W, H, pw, fr, barW, trayW, leftX, barX, rightX, fieldEnd, trayX, top: fr, bottom: H - fr, mid: H / 2, d: pw * 0.94, pointH: pw * 4.7 };
    controls.style.width = W + 'px';
    controls.style.maxWidth = '100%';
    bg = paintBoard();
  }

  // Player-side index 0..23 to the column's centre x and whether it hangs from the top.
  function col(i) {
    const { pw, leftX, rightX } = G;
    if (i < 6) return { x: rightX + (5 - i + 0.5) * pw, top: false };
    if (i < 12) return { x: leftX + (11 - i + 0.5) * pw, top: false };
    if (i < 18) return { x: leftX + (i - 12 + 0.5) * pw, top: true };
    return { x: rightX + (i - 18 + 0.5) * pw, top: true };
  }
  const step = n => (n > 5 ? Math.min(G.d, (G.pointH - G.d) / (n - 1)) : G.d);
  function slot(side, idx, k, n) {
    if (idx === B.BAR) {
      const x = G.barX + G.barW / 2, off = G.d * 0.75 + k * G.d * 0.9;
      return { x, y: side === 0 ? G.mid + off : G.mid - off };
    }
    if (idx === B.OFF) {
      const slab = G.d * 0.27, x = G.trayX + G.trayW / 2;
      return { x, y: side === 0 ? G.bottom - 4 - slab / 2 - k * slab : G.top + 4 + slab / 2 + k * slab, slab: true };
    }
    const c = col(side === 0 ? idx : 23 - idx), s = step(Math.max(n, k + 1));
    return { x: c.x, y: c.top ? G.top + G.d / 2 + k * s : G.bottom - G.d / 2 - k * s };
  }

  function paintBoard() {
    const c = document.createElement('canvas');
    const { g: b } = fit(c, G.W, G.H);
    const { W, H, pw, fr } = G;
    const wood = b.createLinearGradient(0, 0, W, H);
    wood.addColorStop(0, C.frame[0]); wood.addColorStop(1, C.frame[1]);
    b.fillStyle = wood; round(b, 0, 0, W, H, Math.max(6, pw * 0.25)); b.fill();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    b.save(); round(b, 0, 0, W, H, Math.max(6, pw * 0.25)); b.clip();
    for (let i = 0; i < 70; i++) {
      const y = rnd() * H, amp = 2 + rnd() * 6, ph = rnd() * 6;
      b.strokeStyle = `rgba(${rnd() < 0.5 ? '40,20,8' : '150,100,60'},${0.08 + rnd() * 0.12})`;
      b.lineWidth = 0.6 + rnd() * 1.4;
      b.beginPath();
      for (let x = 0; x <= W; x += 12) b.lineTo(x, y + Math.sin(x / (40 + amp * 10) + ph) * amp);
      b.stroke();
    }
    b.restore();
    const field = (x, w) => {
      const f = b.createLinearGradient(0, G.top, 0, G.bottom);
      f.addColorStop(0, '#2f1c11'); f.addColorStop(0.5, '#23150c'); f.addColorStop(1, '#2f1c11');
      b.fillStyle = f; b.fillRect(x, G.top, w, G.bottom - G.top);
      b.strokeStyle = 'rgba(0,0,0,.45)'; b.lineWidth = 2; b.strokeRect(x + 1, G.top + 1, w - 2, G.bottom - G.top - 2);
    };
    field(G.leftX, 6 * pw); field(G.rightX, 6 * pw);
    const tray = b.createLinearGradient(G.trayX, 0, G.trayX + G.trayW, 0);
    tray.addColorStop(0, '#140b06'); tray.addColorStop(1, '#22150c');
    b.fillStyle = tray; b.fillRect(G.trayX, G.top, G.trayW, G.bottom - G.top);
    b.fillStyle = 'rgba(0,0,0,.35)'; b.fillRect(G.trayX, G.mid - 1, G.trayW, 2);
    b.fillStyle = 'rgba(0,0,0,.25)'; b.fillRect(G.barX + G.barW / 2 - 1, G.top, 2, G.bottom - G.top);
    for (let i = 0; i < 24; i++) {
      const { x, top } = col(i), red = i % 2 === 0;
      const tip = top ? G.top + G.pointH : G.bottom - G.pointH, base = top ? G.top : G.bottom;
      const grad = b.createLinearGradient(0, base, 0, tip);
      const pal = red ? C.red : C.cream;
      grad.addColorStop(0, pal[0]); grad.addColorStop(1, pal[1]);
      b.fillStyle = grad;
      b.beginPath(); b.moveTo(x - pw / 2 + 1, base); b.lineTo(x + pw / 2 - 1, base); b.lineTo(x, tip); b.closePath(); b.fill();
      b.strokeStyle = 'rgba(0,0,0,.25)'; b.lineWidth = 1; b.stroke();
      b.fillStyle = 'rgba(245,232,205,.55)';
      b.font = `400 ${Math.max(7, fr * 0.5)}px ${MONO}`; b.textAlign = 'center'; b.textBaseline = 'middle';
      b.fillText(String(i + 1), x, top ? fr / 2 : H - fr / 2);
    }
    const vig = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.28)');
    b.fillStyle = vig; b.fillRect(0, 0, W, H);
    return c;
  }

  // ---------- game flow ----------
  function newGame() {
    gen++; timers.forEach(clearTimeout); timers = [];
    state = B.newGame(); shown = B.clone(state);
    queue = []; cur = null; dice = null; seqs = []; played = []; sel = null;
    card?.remove(); card = null;
    opening = null;
    phase = 'start';
    api.score(tally.you, tally.them);
    say('Roll to see who goes first.');
    sync();
  }

  function roll() {
    if (card) return;
    if (phase === 'start') {
      const a = die(), b = die();
      opening = { you: a, them: b };
      if (a === b) { say(`You both rolled ${a}. Roll again.`); return sync(); }
      if (a > b) { say(`You rolled ${a}, the bot rolled ${b}. You start.`); startMove(a, b); }
      else { say(`The bot rolled ${b}, you rolled ${a}. The bot starts.`); phase = 'wait'; sync(); later(() => botTurn(b, a), 1100); }
      return;
    }
    if (phase === 'roll') startMove(die(), die());
  }

  function startMove(a, b) {
    opening = null;
    dice = { side: 0, values: a === b ? [a, a, a, a] : [a, b] };
    seqs = B.legalSequences(state, 0, a, b);
    played = []; sel = null; turnStart = B.clone(state);
    phase = 'move';
    if (!seqs[0].length) {
      say(`No moves with ${a} and ${b}. Your turn passes.`);
      phase = 'wait'; sync();
      return later(() => botTurn(), 1500);
    }
    autoSelect();
    hint();
    sync();
  }

  function hint() {
    if (phase !== 'move') return;
    const verb = coarse ? 'Tap' : 'Click';
    if (B.turnDone(seqs, played)) return say(`All moves made. ${verb} Done, or Undo.`);
    const rolled = played.length ? '' : `You rolled ${dice.values[0]} and ${dice.values[1]}. `;
    const opts = B.nextMoves(seqs, played);
    if (opts.every(m => m.from === B.BAR)) return say(`${rolled}Enter from the bar first: pick a point in the top right.`);
    if (sel != null) return say(`${rolled}Now pick where it goes.`);
    const left = seqs[0].length - played.length;
    const forced = seqs[0].length < dice.values.length ? ' Not every die can be used.' : '';
    say(`${rolled}${verb} a checker. ${left} move${left === 1 ? '' : 's'} left.${forced}`);
  }

  function autoSelect() {
    const froms = [...new Set(B.nextMoves(seqs, played).map(m => m.from))];
    sel = froms.length === 1 ? froms[0] : null;
  }

  function tap(target) {
    if (card) return;
    if (phase === 'start' || phase === 'roll') return roll();
    if (phase !== 'move') return;
    const froms = new Set(B.nextMoves(seqs, played).map(m => m.from));
    if (sel != null) {
      const key = target === 'off' ? B.OFF : typeof target === 'number' ? target : null;
      const found = B.targetsFrom(seqs, played, sel);
      if (key != null && found.has(key)) return move(found.get(key));
    }
    const from = target === 'bar' ? B.BAR : typeof target === 'number' ? target : null;
    sel = from != null && froms.has(from) && sel !== from ? from : null;
    hint(); sync();
  }

  function move(path) {
    for (const m of path) {
      played.push(m);
      state = B.applyMove(state, 0, m);
      queue.push({ side: 0, m });
    }
    sel = null;
    autoSelect();
    if (B.turnDone(seqs, played)) sel = null;
    hint(); sync();
    if (B.winner(state)) later(endTurn, 450);
  }

  function undo() {
    if (phase !== 'move' || !played.length) return;
    state = B.clone(turnStart); shown = B.clone(turnStart);
    queue = []; cur = null; played = [];
    autoSelect(); hint(); sync();
  }

  function endTurn() {
    if (phase !== 'move' || !B.turnDone(seqs, played)) return;
    sel = null;
    if (finishIfWon()) return;
    phase = 'wait'; sync();
    later(() => botTurn(), 350);
  }

  function botTurn(a = die(), b = die()) {
    phase = 'bot'; opening = null; sel = null;
    dice = { side: 1, values: a === b ? [a, a, a, a] : [a, b] };
    played = [];
    say(`The bot rolled ${a} and ${b}.`);
    sync();
    const seq = B.botMove(state, 1, a, b);
    if (!seq.length) {
      say(`The bot rolled ${a} and ${b} and has no moves.`);
      return later(yourRoll, 1400);
    }
    seq.forEach((m, i) => later(() => {
      state = B.applyMove(state, 1, m);
      played.push(m);
      queue.push({ side: 1, m });
      sync();
      if (i === seq.length - 1) later(() => { if (!finishIfWon()) yourRoll(); }, 650);
    }, 700 + i * 520));
  }

  function yourRoll() {
    phase = 'roll'; dice = null; played = [];
    say(`Your turn. ${coarse ? 'Tap Roll or the board' : 'Roll the dice, or press Space'}.`);
    sync();
  }

  function finishIfWon() {
    const w = B.winner(state);
    if (!w) return false;
    phase = 'over';
    const won = w.side === 0;
    if (won) tally.you += w.points; else tally.them += w.points;
    api.score(tally.you, tally.them);
    api.emit(won ? 'win' : 'lose', { points: w.points });
    const kind = w.points === 3 ? 'A backgammon, worth 3 points.' : w.points === 2 ? 'A gammon, worth 2 points.' : 'One point.';
    say(won ? 'You bore off all fifteen.' : 'The bot bore off all fifteen.');
    sync();
    later(() => { card = endCard(wrap, { title: won ? 'YOU WIN' : 'YOU LOSE', good: won, text: kind, again: newGame, close: api.close }); }, 700);
    return true;
  }

  const say = s => { status.textContent = s; };
  function sync() {
    rollBtn.hidden = !(phase === 'start' || phase === 'roll');
    doneBtn.hidden = !(phase === 'move');
    doneBtn.disabled = !(phase === 'move' && B.turnDone(seqs, played));
    undoBtn.disabled = !(phase === 'move' && played.length);
    undoBtn.hidden = phase === 'start';
    pips.textContent = `Pips: you ${B.pipCount(state, 0)}, bot ${B.pipCount(state, 1)}.  Off: you ${B.borneOff(state, 0)}, bot ${B.borneOff(state, 1)}.`;
    // The position as data, for tests and tools that cannot read a canvas.
    boardBox.dataset.phase = phase;
    boardBox.dataset.board = JSON.stringify({ b: state.b, dice: dice && dice.side === 0 ? dice.values : null, played: played.length });
  }

  // ---------- animation ----------
  function startNext() {
    cur = null;
    const a = queue.shift();
    if (!a) return;
    const own = shown.b[a.side];
    const from = slot(a.side, a.m.from, own[a.m.from] - 1, own[a.m.from]);
    const n = a.m.to === B.OFF ? B.borneOff(shown, a.side) : own[a.m.to];
    const to = slot(a.side, a.m.to, n, n + 1);
    let hit = null;
    if (a.m.hit) {
      const o = 1 - a.side, oi = 23 - a.m.to;
      hit = { from: slot(o, oi, 0, 1), to: slot(o, B.BAR, shown.b[o][B.BAR], shown.b[o][B.BAR] + 1), side: o };
    }
    cur = { ...a, from, to, hit, t: 0, dur: calm ? 0.01 : 0.32 };
  }

  function update(dt) {
    if (!cur && queue.length) startNext();
    if (cur) {
      cur.t += dt;
      if (cur.t >= cur.dur) {
        shown = B.applyMove(shown, cur.side, cur.m);
        startNext();
      }
    }
  }

  // ---------- drawing ----------
  function draw(time) {
    if (!g || !bg) return;
    g.clearRect(0, 0, G.W, G.H);
    g.drawImage(bg, 0, 0, G.W, G.H);
    const view = B.clone(shown);
    if (cur) {
      view.b[cur.side][cur.m.from]--;
      if (cur.hit) view.b[cur.hit.side][23 - cur.m.to]--;
    }
    const idle = !cur && !queue.length && phase === 'move';
    const froms = idle ? new Set(B.nextMoves(seqs, played).map(m => m.from)) : new Set();
    const found = idle && sel != null ? B.targetsFrom(seqs, played, sel) : new Map();
    if (found.has(B.OFF)) glowTray(time);
    for (const side of [0, 1]) {
      const own = view.b[side];
      for (let i = 0; i <= B.BAR; i++) {
        const n = own[i];
        for (let k = 0; k < n; k++) {
          const p = slot(side, i, k, n);
          checker(p.x, p.y, side);
          if (k === n - 1 && n > 5 && i !== B.BAR) count(p.x, p.y, n, side);
        }
        if (side === 0 && n && froms.has(i)) ring(slot(0, i, n - 1, n), i === sel, time);
      }
      const off = B.borneOff(shown, side);
      for (let k = 0; k < off; k++) { const p = slot(side, B.OFF, k, off); slab(p.x, p.y, side); }
    }
    for (const [to] of found) if (to !== B.OFF) { const n = view.b[0][to]; marker(slot(0, to, n, n + 1), time); }
    if (cur) {
      const u = ease(Math.min(1, cur.t / cur.dur));
      const x = cur.from.x + (cur.to.x - cur.from.x) * u, y = cur.from.y + (cur.to.y - cur.from.y) * u - Math.sin(u * Math.PI) * G.d * 0.5;
      if (cur.hit) checker(cur.hit.from.x + (cur.hit.to.x - cur.hit.from.x) * u, cur.hit.from.y + (cur.hit.to.y - cur.hit.from.y) * u, cur.hit.side);
      if (cur.to.slab && u > 0.85) slab(cur.to.x, cur.to.y, cur.side); else checker(x, y, cur.side, 1 + 0.12 * Math.sin(u * Math.PI));
    }
    drawDice(time);
  }

  function checker(x, y, side, scale = 1) {
    const r = (G.d / 2) * scale, pal = side === 0 ? C.ivory : C.walnut;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = r * 0.35; g.shadowOffsetY = r * 0.12;
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    grad.addColorStop(0, pal[0]); grad.addColorStop(1, pal[1]);
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = pal[2]; g.lineWidth = Math.max(1, r * 0.1);
    g.beginPath(); g.arc(x, y, r * 0.94, 0, 7); g.stroke();
    g.globalAlpha = 0.55; g.lineWidth = Math.max(1, r * 0.06);
    g.beginPath(); g.arc(x, y, r * 0.6, 0, 7); g.stroke();
    g.globalAlpha = 1;
  }
  function slab(x, y, side) {
    const w = G.trayW * 0.74, hh = G.d * 0.22, pal = side === 0 ? C.ivory : C.walnut;
    g.fillStyle = pal[1]; round(g, x - w / 2, y - hh / 2, w, hh, hh / 2); g.fill();
    g.strokeStyle = pal[2]; g.lineWidth = 1; g.stroke();
  }
  function count(x, y, n, side) {
    g.fillStyle = side === 0 ? '#3a2a1a' : '#f3e7cf';
    g.font = `700 ${Math.max(9, G.d * 0.42)}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), x, y + 1);
  }
  function ring(p, on, time) {
    g.save();
    g.strokeStyle = ACCENT; g.shadowColor = ACCENT; g.shadowBlur = on ? 14 : 8;
    g.lineWidth = on ? 3 : 2;
    g.globalAlpha = on ? 1 : 0.55 + 0.35 * Math.sin(time / 260);
    g.beginPath(); g.arc(p.x, p.y, G.d / 2 + 2, 0, 7); g.stroke();
    g.restore();
  }
  function marker(p, time) {
    g.save();
    g.fillStyle = 'rgba(62,230,196,.22)'; g.strokeStyle = ACCENT; g.shadowColor = ACCENT; g.shadowBlur = 12; g.lineWidth = 2;
    g.setLineDash([4, 3]); g.lineDashOffset = -time / 60;
    g.beginPath(); g.arc(p.x, p.y, G.d / 2 - 1, 0, 7); g.fill(); g.stroke();
    g.restore();
  }
  function glowTray(time) {
    g.save();
    g.strokeStyle = ACCENT; g.shadowColor = ACCENT; g.shadowBlur = 16; g.lineWidth = 2.5;
    g.globalAlpha = 0.7 + 0.3 * Math.sin(time / 200);
    g.strokeRect(G.trayX + 2, G.mid + 3, G.trayW - 4, G.bottom - G.mid - 6);
    g.fillStyle = 'rgba(62,230,196,.12)'; g.fillRect(G.trayX + 2, G.mid + 3, G.trayW - 4, G.bottom - G.mid - 6);
    g.restore();
  }

  function drawDice(time) {
    const size = G.pw * 0.82, gap = size * 0.3;
    const row = (vals, used, side, cx) => {
      const s = vals.length > 2 ? size * 0.8 : size;
      const total = vals.length * s + (vals.length - 1) * gap;
      vals.forEach((v, i) => dieFace(cx - total / 2 + i * (s + gap) + s / 2, G.mid, s, v, side, used[i]));
    };
    const rightC = G.rightX + 3 * G.pw, leftC = G.leftX + 3 * G.pw;
    if (opening) {
      dieFace(rightC, G.mid, size, opening.you, 0, false);
      dieFace(leftC, G.mid, size, opening.them, 1, false);
      return;
    }
    if (phase === 'roll' || phase === 'start') {
      g.save();
      g.globalAlpha = 0.55 + 0.25 * Math.sin(time / 300);
      g.fillStyle = 'rgba(245,232,205,.85)';
      g.font = `700 ${Math.max(10, G.pw * 0.32)}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(phase === 'start' ? 'ROLL TO START' : 'ROLL', rightC, G.mid);
      g.restore();
      return;
    }
    if (!dice) return;
    const used = dice.values.map(() => false);
    for (const m of played) { const i = dice.values.findIndex((v, k) => v === m.die && !used[k]); if (i >= 0) used[i] = true; }
    row(dice.values, used, dice.side, dice.side === 0 ? rightC : leftC);
  }

  function dieFace(x, y, s, v, side, used) {
    g.save();
    g.globalAlpha = used ? 0.3 : 1;
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = s * 0.2; g.shadowOffsetY = s * 0.06;
    g.fillStyle = side === 0 ? '#f6eedc' : '#2a1b13';
    round(g, x - s / 2, y - s / 2, s, s, s * 0.18); g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = side === 0 ? '#bfa983' : '#a3714a'; g.lineWidth = 1; g.stroke();
    g.fillStyle = side === 0 ? '#2a1b13' : '#f3e7cf';
    const o = s * 0.27, pr = s * 0.085;
    const spots = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
    for (const [a, b] of spots) { g.beginPath(); g.arc(x + a * o, y + b * o, pr, 0, 7); g.fill(); }
    g.restore();
  }

  // ---------- input ----------
  function hitTest(px, py) {
    if (px >= G.trayX && px <= G.trayX + G.trayW && py >= G.top && py <= G.bottom) return 'off';
    if (px >= G.barX && px < G.rightX) return 'bar';
    const top = py < G.mid;
    let c;
    if (px >= G.leftX && px < G.barX) { c = Math.floor((px - G.leftX) / G.pw); return top ? 12 + c : 11 - c; }
    if (px >= G.rightX && px < G.fieldEnd) { c = Math.floor((px - G.rightX) / G.pw); return top ? 18 + c : 5 - c; }
    return null;
  }
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    tap(hitTest(e.clientX - r.left, e.clientY - r.top));
  });
  function key(e) {
    if (card || e.target.closest?.('button')) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (phase === 'start' || phase === 'roll') roll();
      else if (phase === 'move' && B.turnDone(seqs, played)) endTurn();
    } else if (e.key === 'u' || e.key === 'U') undo();
  }

  const ro = new ResizeObserver(() => layout());
  ro.observe(body);
  newGame();
  layout();
  let last = 0;
  const frame = time => {
    if (!alive) return;
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    update(dt);
    draw(time);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { key, destroy() { alive = false; gen++; cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro.disconnect(); } };
}

function round(g, x, y, w, hh, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, hh, r); else g.rect(x, y, w, hh);
}

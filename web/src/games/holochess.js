// Holochess: chess against a small bot on a glowing hologram board. You play teal and move first.
import * as C from './pure/chess.js';
import { h, button, fit, endCard, injectStyles, ACCENT, DIM, INK, PURPLE, BAD, MONO, reducedMotion } from './ui.js';

const STYLE = { id: 'holochess', css: `
.g-ch { flex: 1; min-height: 0; display: flex; gap: 24px; padding: 16px; align-items: center; justify-content: center; }
.g-ch-board { position: relative; flex: none; }
.g-ch-board canvas { display: block; touch-action: none; cursor: pointer; }
.g-ch-side { width: 260px; flex: none; display: flex; flex-direction: column; gap: 12px; align-self: center; min-height: 0; }
.g-ch-turn { padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(62,230,196,.3); background: rgba(62,230,196,.06); color: ${ACCENT}; font-weight: 700; }
.g-ch-turn.g-bot { border-color: rgba(180,156,255,.35); background: rgba(180,156,255,.07); color: ${PURPLE}; }
.g-ch-turn.g-bot::after { content: ''; display: inline-block; width: 6px; height: 6px; margin-left: 8px; border-radius: 50%; background: currentColor; animation: g-ch-blink .8s infinite alternate; vertical-align: middle; }
.g-ch-turn small { display: block; font-weight: 400; color: ${DIM}; font-size: 11px; margin-top: 2px; }
.g-ch-caps { display: flex; align-items: center; gap: 6px; min-height: 24px; font-size: 11px; color: ${DIM}; }
.g-ch-caps span { flex: none; width: 58px; }
.g-ch-caps i { display: flex; flex-wrap: wrap; font-style: normal; align-items: center; }
.g-ch-caps svg { width: 20px; height: 20px; margin-right: -3px; overflow: visible; }
.g-ch-caps em { font-style: normal; color: ${INK}; margin-left: 8px; }
.g-ch-moves { height: 190px; overflow-y: auto; font-size: 12px; display: grid; grid-template-columns: 30px 1fr 1fr; gap: 3px 6px; align-content: start;
  padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.07); color: ${INK}; }
.g-ch-moves .g-n { color: ${DIM}; }
.g-ch-moves .g-b { color: ${PURPLE}; }
.g-ch-side .g-row .g-btn { flex: 1; }
@keyframes g-ch-blink { from { opacity: .25; } }
@media (max-width: 760px) {
  .g-ch { flex-direction: column; gap: 10px; padding: 10px 8px 12px; justify-content: center; }
  .g-ch-side { width: 100%; max-width: 520px; gap: 8px; }
  .g-ch-moves { display: none; }
  .g-ch-turn { padding: 8px 10px; }
}
` };

// Pieces drawn in a 100 by 100 box, used both on the canvas and in the captured lists.
const SHAPES = {
  [C.P]: 'M38 30A12 12 0 1 1 62 30A12 12 0 1 1 38 30ZM39 42L61 42L59 47L41 47ZM43 47C43 56 37 64 33 74L67 74C63 64 57 56 57 47ZM24 74L76 74L78 84L22 84Z',
  [C.R]: 'M28 40L72 40L72 21L63 21L63 28L55 28L55 21L45 21L45 28L37 28L37 21L28 21ZM33 40L67 40L69 74L31 74ZM24 74L76 74L78 84L22 84ZM33 46L67 46',
  [C.N]: 'M36 74C35 62 42 56 46 49C39 52 31 55 25 52C19 49 19 43 23 39L37 25L39 14L45 22L52 15L54 25C67 29 73 44 71 60L69 74ZM40 33A2.6 2.6 0 1 1 40.1 33ZM26 74L74 74L76 84L24 84Z',
  [C.B]: 'M45 15A5 5 0 1 1 55 15A5 5 0 1 1 45 15ZM50 21C67 32 67 50 61 61L39 61C33 50 33 32 50 21ZM55 31L45 44ZM39 61L61 61L64 74L36 74ZM24 74L76 74L78 84L22 84Z',
  [C.Q]: 'M30 74L21 34L33 53L36 27L45 50L50 22L55 50L64 27L67 53L79 34L70 74ZM17 30A4 4 0 1 1 25 30A4 4 0 1 1 17 30ZM32 23A4 4 0 1 1 40 23A4 4 0 1 1 32 23ZM46 18A4 4 0 1 1 54 18A4 4 0 1 1 46 18ZM60 23A4 4 0 1 1 68 23A4 4 0 1 1 60 23ZM75 30A4 4 0 1 1 83 30A4 4 0 1 1 75 30ZM24 74L76 74L78 84L22 84ZM31 66L69 66',
  [C.K]: 'M46 10L54 10L54 18L62 18L62 25L54 25L54 36L46 36L46 25L38 25L38 18L46 18ZM30 74C25 60 21 47 31 41C40 36 46 41 50 48C54 41 60 36 69 41C79 47 75 60 70 74ZM24 74L76 74L78 84L22 84ZM32 66L68 66',
};
const PATHS = typeof Path2D === 'function' ? Object.fromEntries(Object.entries(SHAPES).map(([k, d]) => [k, new Path2D(d)])) : {};
const RESULT_TEXT = { checkmate: 'Checkmate', stalemate: 'Stalemate', material: 'Not enough pieces left to mate', fifty: 'Fifty moves without a capture', repetition: 'The same position three times' };
const tally = { you: 0, them: 0 };
const ease = t => 1 - Math.pow(1 - t, 3);

export function mount(body, api) {
  injectStyles(STYLE);
  const calm = reducedMotion();
  const coarse = matchMedia('(pointer: coarse)').matches;
  const canvas = h('canvas', { 'aria-label': 'Chess board. Pick a piece, then a square. Arrow keys and Enter work too.' });
  const boardBox = h('div', { class: 'g-ch-board' }, canvas);
  const turn = h('div', { class: 'g-ch-turn', 'aria-live': 'polite' });
  const capsYou = h('i'), capsThem = h('i');
  const moveList = h('div', { class: 'g-ch-moves' });
  const undoBtn = button('Undo', () => undo());
  const resignBtn = button('Resign', () => resign());
  const side = h('div', { class: 'g-ch-side' }, turn,
    h('div', { class: 'g-ch-caps' }, h('span', { text: 'You took' }), capsYou),
    h('div', { class: 'g-ch-caps' }, h('span', { text: 'Bot took' }), capsThem),
    moveList, h('div', { class: 'g-row' }, undoBtn, resignBtn));
  const wrap = h('div', { class: 'g-ch' }, boardBox, side);
  body.append(wrap);

  let g, size = 0, sq = 0, pad = 0;
  let state, keys, log, sel = -1, targets = [], cursor = -1, anim = null, thinking = false, over = null, card = null;
  let gen = 0, timers = [], raf = 0, alive = true;
  const later = (fn, ms) => { const id = setTimeout(() => { timers = timers.filter(t => t !== id); fn(); }, ms); timers.push(id); };

  function layout() {
    const r = body.getBoundingClientRect();
    const narrow = r.width <= 760;
    const sideH = narrow ? side.getBoundingClientRect().height + 22 : 0;
    const avail = narrow ? Math.min(r.width - 16, r.height - sideH - 20, 560) : Math.min(r.height - 32, r.width - 260 - 24 - 32, 720);
    size = Math.max(200, Math.floor(avail));
    ({ g } = fit(canvas, size, size));
    pad = Math.round(size * 0.035);
    sq = (size - pad * 2) / 8;
  }

  function reset() {
    gen++; timers.forEach(clearTimeout); timers = [];
    state = C.newGame(); keys = [C.positionKey(state)]; log = [];
    sel = -1; targets = []; anim = null; thinking = false; over = null;
    card?.remove(); card = null;
    api.score(tally.you, tally.them);
    refresh();
  }

  const xy = i => ({ x: pad + C.fileOf(i) * sq, y: pad + (7 - C.rankOf(i)) * sq });
  const squareAt = (px, py) => {
    const f = Math.floor((px - pad) / sq), r = 7 - Math.floor((py - pad) / sq);
    return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1;
  };

  function play(m) {
    const prev = state;
    const san = C.toSAN(state, m);
    state = C.makeMove(state, m);
    keys.push(C.positionKey(state));
    log.push({ m, san, prev });
    anim = { m, t: 0, dur: calm ? 0.01 : 0.2 };
    sel = -1; targets = [];
    const s = C.status(state, keys);
    if (s.over) over = s;
    refresh();
    return s;
  }

  function playerMove(m) {
    if (m.promo && m.promo !== C.Q) return;
    const s = play(m);
    if (s.over) return later(finish, 450);
    thinking = true;
    refresh();
    const mine = gen;
    later(() => {
      if (mine !== gen) return;
      const reply = C.bestMove(state, { depth: 3, timeMs: 700 });
      if (mine !== gen || !reply) return;
      thinking = false;
      const s2 = play(reply);
      if (s2.over) later(finish, 500);
    }, 260);
  }

  function select(i) {
    if (over || thinking || state.turn !== 1) return;
    if (sel >= 0) {
      const m = targets.find(t => t.to === i && (!t.promo || t.promo === C.Q));
      if (m) return playerMove(m);
    }
    if (i >= 0 && state.b[i] > 0) {
      sel = sel === i ? -1 : i;
      targets = sel >= 0 ? C.legalMoves(state).filter(t => t.from === sel) : [];
    } else { sel = -1; targets = []; }
  }

  function undo() {
    if (!log.length || card) return;
    gen++; timers.forEach(clearTimeout); timers = [];
    thinking = false; over = null; anim = null; sel = -1; targets = [];
    // Back to the last position where it was your move.
    do { const last = log.pop(); keys.pop(); state = last.prev; } while (log.length && state.turn !== 1);
    refresh();
  }

  function resign() {
    if (over || card) return;
    gen++; timers.forEach(clearTimeout); timers = [];
    thinking = false;
    over = { over: true, result: 'resign', winner: -1 };
    finish();
  }

  function finish() {
    if (card || !over) return;
    const won = over.winner === 1, lost = over.winner === -1;
    if (won) tally.you++;
    if (lost) tally.them++;
    api.score(tally.you, tally.them);
    if (won || lost) api.emit(won ? 'win' : 'lose', {});
    const moves = Math.ceil(log.length / 2);
    const text = over.result === 'resign' ? 'You resigned. The bot takes this one.'
      : over.result === 'checkmate' ? `Checkmate in ${moves} move${moves === 1 ? '' : 's'}.` : `${RESULT_TEXT[over.result]}. It is a draw.`;
    card = endCard(wrap, { title: won ? 'YOU WIN' : lost ? 'YOU LOSE' : 'DRAW', good: !lost, text, again: reset, close: api.close });
    refresh();
  }

  function refresh() {
    const check = C.inCheck(state);
    turn.classList.toggle('g-bot', thinking || state.turn !== 1);
    let main, sub = '';
    if (over) { main = over.result === 'checkmate' ? 'Checkmate' : over.result === 'resign' ? 'Resigned' : 'Draw'; }
    else if (thinking || state.turn !== 1) main = 'Bot is thinking';
    else { main = check ? 'Your move. Check!' : 'Your move'; }
    const lastBot = [...log].reverse().find(l => l.m.piece < 0);
    if (!over && lastBot && state.turn === 1) sub = `Bot played ${lastBot.san}`;
    else if (!log.length) sub = `${coarse ? 'Tap' : 'Click'} a piece to see its moves.`;
    turn.replaceChildren(main, sub ? h('small', { text: sub }) : '');
    const took = side => log.filter(l => (l.m.piece > 0) === (side > 0) && l.m.cap).map(l => Math.abs(l.m.cap)).sort((a, b) => b - a);
    // Counted from the board, so a promoted pawn counts as the queen it became.
    const lead = Math.round(state.b.reduce((a, p) => a + Math.sign(p) * C.pieceValue(Math.abs(p)), 0) / 100);
    capsYou.replaceChildren(...took(1).map(t => icon(t, PURPLE)), lead > 0 ? h('em', { text: `+${lead}` }) : '');
    capsThem.replaceChildren(...took(-1).map(t => icon(t, ACCENT)), lead < 0 ? h('em', { text: `+${-lead}` }) : '');
    const rows = [];
    for (let i = 0; i < log.length; i += 2) rows.push(h('span', { class: 'g-n', text: `${i / 2 + 1}.` }), h('span', { text: log[i].san }), h('span', { class: 'g-b', text: log[i + 1]?.san || '' }));
    moveList.replaceChildren(...rows);
    moveList.scrollTop = moveList.scrollHeight;
    undoBtn.disabled = !log.length || !!card;
    resignBtn.disabled = !!over;
  }

  function icon(t, col) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', SHAPES[t]);
    p.setAttribute('fill', col); p.setAttribute('fill-opacity', '.25'); p.setAttribute('stroke', col); p.setAttribute('stroke-width', '5'); p.setAttribute('stroke-linejoin', 'round');
    s.style.filter = `drop-shadow(0 0 3px ${col})`;
    s.append(p);
    return s;
  }

  // ---------- drawing ----------
  let sweep = 0, scan = null;
  function draw(time) {
    if (!g) return;
    g.clearRect(0, 0, size, size);
    const glow = g.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.7);
    glow.addColorStop(0, 'rgba(62,230,196,.10)'); glow.addColorStop(1, 'rgba(62,230,196,0)');
    g.fillStyle = glow; g.fillRect(0, 0, size, size);
    g.fillStyle = 'rgba(3,9,12,.92)'; g.fillRect(pad, pad, sq * 8, sq * 8);
    for (let i = 0; i < 64; i++) {
      const { x, y } = xy(i);
      const light = (C.fileOf(i) + C.rankOf(i)) % 2 === 1;
      g.fillStyle = light ? 'rgba(62,230,196,.13)' : 'rgba(10,30,34,.55)';
      g.fillRect(x, y, sq, sq);
    }
    const lastMove = log[log.length - 1]?.m;
    if (lastMove) for (const i of [lastMove.from, lastMove.to]) { const { x, y } = xy(i); g.fillStyle = 'rgba(180,156,255,.16)'; g.fillRect(x, y, sq, sq); }
    g.strokeStyle = 'rgba(62,230,196,.22)'; g.lineWidth = 1;
    g.beginPath();
    for (let k = 1; k < 8; k++) { const v = pad + k * sq; g.moveTo(v, pad); g.lineTo(v, size - pad); g.moveTo(pad, v); g.lineTo(size - pad, v); }
    g.stroke();
    g.save(); g.shadowColor = ACCENT; g.shadowBlur = 14; g.strokeStyle = 'rgba(62,230,196,.85)'; g.lineWidth = 2;
    g.strokeRect(pad - 1, pad - 1, sq * 8 + 2, sq * 8 + 2); g.restore();
    g.font = `400 ${Math.max(8, sq * 0.16)}px ${MONO}`; g.fillStyle = 'rgba(62,230,196,.55)';
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    for (let f = 0; f < 8; f++) g.fillText('abcdefgh'[f], pad + f * sq + sq * 0.06, size - pad - sq * 0.06);
    g.textBaseline = 'top'; g.textAlign = 'right';
    for (let r = 0; r < 8; r++) g.fillText(String(8 - r), pad + 8 * sq - sq * 0.06, pad + r * sq + sq * 0.05);
    if (C.inCheck(state) || over?.result === 'checkmate') {
      const k = state.kings[state.turn > 0 ? 0 : 1], { x, y } = xy(k);
      const rg = g.createRadialGradient(x + sq / 2, y + sq / 2, 0, x + sq / 2, y + sq / 2, sq * 0.7);
      rg.addColorStop(0, 'rgba(255,107,122,.65)'); rg.addColorStop(1, 'rgba(255,107,122,0)');
      g.fillStyle = rg; g.fillRect(x - sq * 0.2, y - sq * 0.2, sq * 1.4, sq * 1.4);
    }
    if (sel >= 0) { const { x, y } = xy(sel); g.save(); g.strokeStyle = ACCENT; g.shadowColor = ACCENT; g.shadowBlur = 12; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, sq - 4, sq - 4); g.restore(); }
    for (const m of targets) {
      if (m.promo && m.promo !== C.Q) continue;
      const { x, y } = xy(m.to);
      g.save(); g.fillStyle = 'rgba(62,230,196,.6)'; g.strokeStyle = 'rgba(62,230,196,.75)'; g.shadowColor = ACCENT; g.shadowBlur = 8;
      if (m.cap) { g.lineWidth = Math.max(2, sq * 0.06); g.beginPath(); g.arc(x + sq / 2, y + sq / 2, sq * 0.43, 0, 7); g.stroke(); }
      else { g.beginPath(); g.arc(x + sq / 2, y + sq / 2, sq * 0.13, 0, 7); g.fill(); }
      g.restore();
    }
    if (cursor >= 0) { const { x, y } = xy(cursor); g.save(); g.setLineDash([5, 4]); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(x + 3, y + 3, sq - 6, sq - 6); g.restore(); }
    // Pieces, with the moving one drawn last so it glides over the others.
    const moving = anim ? anim.m : null, u = anim ? ease(Math.min(1, anim.t / anim.dur)) : 1;
    const rookMove = moving && (moving.flag === 3 || moving.flag === 4) ? (moving.flag === 3 ? [moving.to + 1, moving.to - 1] : [moving.to - 2, moving.to + 1]) : null;
    for (let i = 0; i < 64; i++) {
      const p = state.b[i];
      if (!p) continue;
      if (moving && (i === moving.to || (rookMove && i === rookMove[1]))) continue;
      piece(p, xy(i), time, i);
    }
    if (moving) {
      const a = xy(moving.from), b = xy(moving.to);
      if (rookMove) { const ra = xy(rookMove[0]), rb = xy(rookMove[1]); piece(state.b[rookMove[1]], { x: ra.x + (rb.x - ra.x) * u, y: ra.y + (rb.y - ra.y) * u }, time, rookMove[1]); }
      piece(state.b[moving.to], { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, time, moving.to, 1 + 0.08 * Math.sin(u * Math.PI));
    }
    // Scanlines and a slow bright sweep sell the hologram.
    if (!scan || scan.width !== canvas.width) scan = scanlines();
    g.drawImage(scan, 0, 0, size, size);
    if (!calm) {
      sweep = (time / 5200) % 1;
      const sy = -size * 0.2 + sweep * size * 1.4;
      const band = g.createLinearGradient(0, sy - 30, 0, sy + 30);
      band.addColorStop(0, 'rgba(62,230,196,0)'); band.addColorStop(0.5, 'rgba(62,230,196,.07)'); band.addColorStop(1, 'rgba(62,230,196,0)');
      g.fillStyle = band; g.fillRect(pad, Math.max(pad, sy - 30), sq * 8, 60);
    }
  }

  function scanlines() {
    const c = document.createElement('canvas');
    const { g: s } = fit(c, size, size);
    s.fillStyle = 'rgba(0,0,0,.16)';
    for (let y = 0; y < size; y += 3) s.fillRect(0, y, size, 1);
    return c;
  }

  function piece(p, { x, y }, time, i, scale = 1) {
    const path = PATHS[Math.abs(p)];
    if (!path) return;
    const col = p > 0 ? ACCENT : PURPLE;
    const flicker = calm ? 1 : 0.92 + 0.08 * Math.sin(time / 170 + i * 1.7) * Math.sin(time / 530 + i);
    const k = (sq / 100) * 0.86 * scale;
    g.save();
    g.translate(x + sq / 2, y + sq / 2);
    g.fillStyle = p > 0 ? 'rgba(62,230,196,.12)' : 'rgba(180,156,255,.12)';
    g.beginPath(); g.ellipse(0, sq * 0.33, sq * 0.3, sq * 0.07, 0, 0, 7); g.fill();
    g.scale(k, k);
    g.translate(-50, -52);
    g.globalAlpha = flicker;
    const grad = g.createLinearGradient(0, 10, 0, 86);
    grad.addColorStop(0, p > 0 ? 'rgba(62,230,196,.42)' : 'rgba(180,156,255,.42)');
    grad.addColorStop(1, p > 0 ? 'rgba(62,230,196,.10)' : 'rgba(180,156,255,.10)');
    g.fillStyle = grad; g.fill(path);
    g.shadowColor = col; g.shadowBlur = 10;
    g.strokeStyle = col; g.lineWidth = 3.2; g.lineJoin = 'round'; g.lineCap = 'round';
    g.stroke(path);
    g.restore();
  }

  // ---------- input ----------
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    cursor = -1;
    select(squareAt(e.clientX - r.left, e.clientY - r.top));
  });

  function key(e) {
    if (card || e.target.closest?.('button')) return;
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (dirs[e.key]) {
      e.preventDefault();
      // The first press only shows the cursor, on the selected piece or on e2.
      if (cursor < 0) { cursor = sel >= 0 ? sel : 12; return; }
      const f = Math.max(0, Math.min(7, C.fileOf(cursor) + dirs[e.key][0])), r = Math.max(0, Math.min(7, C.rankOf(cursor) + dirs[e.key][1]));
      cursor = r * 8 + f;
    } else if ((e.key === 'Enter' || e.key === ' ') && cursor >= 0) { e.preventDefault(); select(cursor); }
    else if (e.key === 'u' || e.key === 'U') undo();
  }

  const ro = new ResizeObserver(() => { layout(); scan = null; });
  ro.observe(body);
  layout();
  reset();
  let last = 0;
  const frame = time => {
    if (!alive) return;
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    if (anim) { anim.t += dt; if (anim.t >= anim.dur) anim = null; }
    draw(time);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    key,
    destroy() { alive = false; gen++; cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro.disconnect(); },
  };
}

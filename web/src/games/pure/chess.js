// Chess rules and a small bot. Squares are 0..63 with a1 = 0 and h8 = 63; white pieces are positive, black negative.
export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const LETTERS = ' pnbrqk';
const VALUE = [0, 100, 320, 330, 500, 900, 0];

export const fileOf = sq => sq & 7;
export const rankOf = sq => sq >> 3;
export const sqName = sq => 'abcdefgh'[sq & 7] + (1 + (sq >> 3));
export const sqFrom = name => (name.charCodeAt(0) - 97) + 8 * (+name[1] - 1);

const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const jumps = deltas => Array.from({ length: 64 }, (_, sq) => deltas
  .map(([df, dr]) => [fileOf(sq) + df, rankOf(sq) + dr])
  .filter(([f, r]) => f >= 0 && f < 8 && r >= 0 && r < 8).map(([f, r]) => r * 8 + f));
const KNIGHT = jumps([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]);
const KING = jumps([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]);
const rays = dirs => Array.from({ length: 64 }, (_, sq) => dirs.map(([df, dr]) => {
  const out = [];
  for (let f = fileOf(sq) + df, r = rankOf(sq) + dr; f >= 0 && f < 8 && r >= 0 && r < 8; f += df, r += dr) out.push(r * 8 + f);
  return out;
}));
const ROOK_RAYS = rays(ROOK_DIRS), BISHOP_RAYS = rays(BISHOP_DIRS);

// Castling rights as bits: white king side, white queen side, black king side, black queen side.
const WK = 1, WQ = 2, BK = 4, BQ = 8;
const RIGHTS_LOST = new Array(64).fill(15);
RIGHTS_LOST[4] = 15 & ~(WK | WQ); RIGHTS_LOST[0] = 15 & ~WQ; RIGHTS_LOST[7] = 15 & ~WK;
RIGHTS_LOST[60] = 15 & ~(BK | BQ); RIGHTS_LOST[56] = 15 & ~BQ; RIGHTS_LOST[63] = 15 & ~BK;

export function parseFEN(fen) {
  const [placement, turn, castle = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const b = new Int8Array(64);
  const rows = placement.split('/');
  for (let i = 0; i < 8; i++) {
    let f = 0;
    for (const ch of rows[i]) {
      if (/\d/.test(ch)) { f += +ch; continue; }
      const t = LETTERS.indexOf(ch.toLowerCase());
      b[(7 - i) * 8 + f] = ch === ch.toLowerCase() ? -t : t;
      f++;
    }
  }
  let c = 0;
  if (castle.includes('K')) c |= WK; if (castle.includes('Q')) c |= WQ;
  if (castle.includes('k')) c |= BK; if (castle.includes('q')) c |= BQ;
  return { b, turn: turn === 'b' ? -1 : 1, castle: c, ep: ep === '-' ? -1 : sqFrom(ep), half: +half, full: +full,
    kings: [b.indexOf(K), b.indexOf(-K)] };
}

export function toFEN(s) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', gap = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.b[r * 8 + f];
      if (!p) { gap++; continue; }
      if (gap) { row += gap; gap = 0; }
      const ch = LETTERS[Math.abs(p)];
      row += p > 0 ? ch.toUpperCase() : ch;
    }
    rows.push(row + (gap || ''));
  }
  const c = (s.castle & WK ? 'K' : '') + (s.castle & WQ ? 'Q' : '') + (s.castle & BK ? 'k' : '') + (s.castle & BQ ? 'q' : '');
  return `${rows.join('/')} ${s.turn > 0 ? 'w' : 'b'} ${c || '-'} ${s.ep < 0 ? '-' : sqName(s.ep)} ${s.half} ${s.full}`;
}

export const newGame = () => parseFEN(START);
const kingSq = (s, side) => s.kings[side > 0 ? 0 : 1];

export function attacked(b, sq, by) {
  const f = fileOf(sq);
  const from = sq - 8 * by;
  if (from >= 0 && from < 64) {
    if (f > 0 && b[from - 1] === P * by) return true;
    if (f < 7 && b[from + 1] === P * by) return true;
  }
  for (const t of KNIGHT[sq]) if (b[t] === N * by) return true;
  for (const t of KING[sq]) if (b[t] === K * by) return true;
  for (const ray of ROOK_RAYS[sq]) for (const t of ray) {
    const p = b[t];
    if (p) { if (p === R * by || p === Q * by) return true; break; }
  }
  for (const ray of BISHOP_RAYS[sq]) for (const t of ray) {
    const p = b[t];
    if (p) { if (p === B * by || p === Q * by) return true; break; }
  }
  return false;
}

export const inCheck = s => attacked(s.b, kingSq(s, s.turn), -s.turn);

// Moves that follow the piece rules but may leave the mover's own king in check.
function pseudoMoves(s, capturesOnly = false) {
  const { b, turn } = s, out = [];
  const add = (from, to, piece, flag = 0) => {
    const cap = flag === 2 ? -turn * P : b[to];
    if (Math.abs(piece) === P && (rankOf(to) === 7 || rankOf(to) === 0)) {
      for (const promo of [Q, N, R, B]) out.push({ from, to, piece, cap, promo, flag });
    } else out.push({ from, to, piece, cap, promo: 0, flag });
  };
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p || (p > 0) !== (turn > 0)) continue;
    const t = Math.abs(p);
    if (t === P) {
      const one = sq + 8 * turn, f = fileOf(sq);
      if (one < 0 || one > 63) continue;
      // Quiet promotions count as captures for the quiet search, since they swing the material just as much.
      if (!b[one] && (!capturesOnly || rankOf(one) === 7 || rankOf(one) === 0)) {
        add(sq, one, p);
        const two = one + 8 * turn;
        if (!capturesOnly && rankOf(sq) === (turn > 0 ? 1 : 6) && !b[two]) add(sq, two, p, 1);
      }
      for (const df of [-1, 1]) {
        if (f + df < 0 || f + df > 7) continue;
        const to = one + df;
        if (b[to] && (b[to] > 0) !== (turn > 0)) add(sq, to, p);
        else if (to === s.ep) add(sq, to, p, 2);
      }
    } else if (t === N || t === K) {
      for (const to of (t === N ? KNIGHT : KING)[sq]) {
        const q = b[to];
        if (q ? (q > 0) !== (turn > 0) : !capturesOnly) add(sq, to, p);
      }
    } else {
      const sets = t === R ? [ROOK_RAYS] : t === B ? [BISHOP_RAYS] : [ROOK_RAYS, BISHOP_RAYS];
      for (const set of sets) for (const ray of set[sq]) for (const to of ray) {
        const q = b[to];
        if (!q) { if (!capturesOnly) add(sq, to, p); continue; }
        if ((q > 0) !== (turn > 0)) add(sq, to, p);
        break;
      }
    }
  }
  if (!capturesOnly) {
    const home = turn > 0 ? 4 : 60, enemy = -turn;
    const [ks, qs] = turn > 0 ? [WK, WQ] : [BK, BQ];
    if (b[home] === K * turn && !attacked(b, home, enemy)) {
      if (s.castle & ks && b[home + 3] === R * turn && !b[home + 1] && !b[home + 2]
        && !attacked(b, home + 1, enemy) && !attacked(b, home + 2, enemy)) out.push({ from: home, to: home + 2, piece: K * turn, cap: 0, promo: 0, flag: 3 });
      if (s.castle & qs && b[home - 4] === R * turn && !b[home - 1] && !b[home - 2] && !b[home - 3]
        && !attacked(b, home - 1, enemy) && !attacked(b, home - 2, enemy)) out.push({ from: home, to: home - 2, piece: K * turn, cap: 0, promo: 0, flag: 4 });
    }
  }
  return out;
}

export function makeMove(s, m) {
  const b = s.b.slice(), turn = s.turn;
  b[m.from] = 0;
  b[m.to] = m.promo ? m.promo * turn : m.piece;
  if (m.flag === 2) b[m.to - 8 * turn] = 0;
  if (m.flag === 3) { b[m.to + 1] = 0; b[m.to - 1] = R * turn; }
  if (m.flag === 4) { b[m.to - 2] = 0; b[m.to + 1] = R * turn; }
  const kings = s.kings.slice();
  if (Math.abs(m.piece) === K) kings[turn > 0 ? 0 : 1] = m.to;
  return {
    b, turn: -turn, kings,
    castle: s.castle & RIGHTS_LOST[m.from] & RIGHTS_LOST[m.to],
    ep: m.flag === 1 ? m.from + 8 * turn : -1,
    half: Math.abs(m.piece) === P || m.cap ? 0 : s.half + 1,
    full: s.full + (turn < 0 ? 1 : 0),
  };
}

const leavesKingSafe = (s, m) => { const n = makeMove(s, m); return !attacked(n.b, kingSq(n, s.turn), n.turn); };
export const legalMoves = s => pseudoMoves(s).filter(m => leavesKingSafe(s, m));
const legalCaptures = s => pseudoMoves(s, true).filter(m => leavesKingSafe(s, m));

export function perft(s, depth) {
  const moves = legalMoves(s);
  if (depth <= 1) return depth === 1 ? moves.length : 1;
  let n = 0;
  for (const m of moves) n += perft(makeMove(s, m), depth - 1);
  return n;
}

// Same board, side, castling and a capturable en passant square: the test for repetition.
export function positionKey(s) {
  let ep = -1;
  if (s.ep >= 0 && legalMoves(s).some(m => m.flag === 2)) ep = s.ep;
  return `${s.b.join('')}|${s.turn}|${s.castle}|${ep}`;
}

function insufficient(b) {
  const minors = [];
  for (let sq = 0; sq < 64; sq++) {
    const t = Math.abs(b[sq]);
    if (t === P || t === R || t === Q) return false;
    if (t === N || t === B) minors.push({ t, light: (fileOf(sq) + rankOf(sq)) % 2 });
  }
  if (minors.length <= 1) return true;
  return minors.every(m => m.t === B && m.light === minors[0].light);
}

// keys: position keys of the game so far, including the current one.
export function status(s, keys = []) {
  const moves = legalMoves(s);
  const check = inCheck(s);
  if (!moves.length) return { over: true, result: check ? 'checkmate' : 'stalemate', winner: check ? -s.turn : 0, check, moves };
  if (insufficient(s.b)) return { over: true, result: 'material', winner: 0, check, moves };
  if (s.half >= 100) return { over: true, result: 'fifty', winner: 0, check, moves };
  const key = keys[keys.length - 1];
  if (key && keys.filter(k => k === key).length >= 3) return { over: true, result: 'repetition', winner: 0, check, moves };
  return { over: false, result: null, winner: 0, check, moves };
}

export function toSAN(s, m, moves = legalMoves(s)) {
  let san;
  if (m.flag === 3) san = 'O-O';
  else if (m.flag === 4) san = 'O-O-O';
  else {
    const t = Math.abs(m.piece);
    if (t === P) san = (m.cap ? 'abcdefgh'[fileOf(m.from)] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + LETTERS[m.promo].toUpperCase() : '');
    else {
      const rivals = moves.filter(o => o.piece === m.piece && o.to === m.to && o.from !== m.from);
      let dis = '';
      if (rivals.length) {
        if (!rivals.some(o => fileOf(o.from) === fileOf(m.from))) dis = 'abcdefgh'[fileOf(m.from)];
        else if (!rivals.some(o => rankOf(o.from) === rankOf(m.from))) dis = String(1 + rankOf(m.from));
        else dis = sqName(m.from);
      }
      san = LETTERS[t].toUpperCase() + dis + (m.cap ? 'x' : '') + sqName(m.to);
    }
  }
  const n = makeMove(s, m);
  if (inCheck(n)) san += legalMoves(n).length ? '+' : '#';
  return san;
}

// Piece square tables from white's side, a8 first, so a white piece on square sq reads index (7 - rank) * 8 + file.
const PST = {
  [P]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [N]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [B]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [R]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [Q]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [K]: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

// Score in centipawns from white's side.
export function evaluate(s) {
  const b = s.b;
  let score = 0, heavy = 0;
  for (let sq = 0; sq < 64; sq++) { const t = Math.abs(b[sq]); if (t > P && t < K) heavy += VALUE[t]; }
  const endgame = heavy <= 1300;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const t = Math.abs(p), f = fileOf(sq), r = rankOf(sq);
    const idx = p > 0 ? (7 - r) * 8 + f : r * 8 + f;
    const v = VALUE[t] + (t === K && endgame ? KING_END[idx] : PST[t][idx]);
    score += p > 0 ? v : -v;
  }
  return score;
}

const MATE = 100000;
const order = moves => moves.sort((a, b) => (b.cap ? 10 * VALUE[Math.abs(b.cap)] - VALUE[Math.abs(b.piece)] + 10000 : 0) + b.promo * 1000
  - ((a.cap ? 10 * VALUE[Math.abs(a.cap)] - VALUE[Math.abs(a.piece)] + 10000 : 0) + a.promo * 1000));

class OutOfTime extends Error {}

// A small alpha-beta search: a few plies, then captures only until things are quiet.
export function bestMove(s, { depth = 3, timeMs = 800, rng = Math.random, jitter = 12, now = () => Date.now() } = {}) {
  // Under-promotions only ever tie with a queen at this depth, and a bot that picks a rook looks broken.
  const root = order(legalMoves(s).filter(m => !m.promo || m.promo === Q));
  if (!root.length) return null;
  if (root.length === 1) return root[0];
  const deadline = now() + timeMs;
  let nodes = 0;
  const tick = () => { if ((++nodes & 1023) === 0 && now() > deadline) throw new OutOfTime(); };

  function quiesce(st, alpha, beta, qd) {
    tick();
    const stand = evaluate(st) * st.turn;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd <= 0) return alpha;
    for (const m of order(legalCaptures(st))) {
      const v = -quiesce(makeMove(st, m), -beta, -alpha, qd - 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function search(st, d, alpha, beta, ply) {
    tick();
    if (d <= 0) return quiesce(st, alpha, beta, 4);
    const moves = legalMoves(st);
    if (!moves.length) return inCheck(st) ? -MATE + ply : 0;
    if (st.half >= 100) return 0;
    let best = -Infinity;
    for (const m of order(moves)) {
      const v = -search(makeMove(st, m), d - 1, -beta, -alpha, ply + 1);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  let picked = root[0], scored = null;
  for (let d = 1; d <= depth; d++) {
    try {
      const results = [];
      let best = -Infinity;
      for (const m of root) {
        const floor = best === -Infinity ? -Infinity : best - jitter - 1;
        const v = -search(makeMove(s, m), d - 1, -Infinity, -floor, 1);
        if (v > floor) results.push({ m, v });
        if (v > best) best = v;
      }
      scored = results.filter(r => r.v >= best - (Math.abs(best) > MATE / 2 ? 0 : jitter));
      // Searching the best moves first next time makes the cut-offs bite sooner.
      root.sort((a, b) => (results.find(r => r.m === b)?.v ?? -Infinity) - (results.find(r => r.m === a)?.v ?? -Infinity));
      if (best > MATE / 2) break;
    } catch (e) {
      if (!(e instanceof OutOfTime)) throw e;
      break;
    }
  }
  if (scored && scored.length) {
    // A gain that looks just as good later is taken now, or the bot keeps putting it off past its horizon.
    const loud = scored.filter(r => r.m.cap || r.m.promo).sort((a, b) => b.v - a.v);
    picked = loud.length ? loud[0].m : scored[Math.floor(rng() * scored.length)].m;
  }
  return picked;
}

export const pieceValue = t => VALUE[t];

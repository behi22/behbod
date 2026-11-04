// Backgammon rules and a bot. Each side sees the board from its own end: b[side][0..23] are its points 1..24
// counted from its own home, and b[side][24] is its bar. The other side's index i is this side's 23 - i.
export const BAR = 24, OFF = -1;

export function newGame() {
  const s = new Array(25).fill(0);
  s[23] = 2; s[12] = 5; s[7] = 3; s[5] = 5;
  return { b: [s.slice(), s.slice()] };
}

export const clone = st => ({ b: [st.b[0].slice(), st.b[1].slice()] });
export const onBoard = (st, side) => st.b[side].reduce((a, n) => a + n, 0);
export const borneOff = (st, side) => 15 - onBoard(st, side);
export const pipCount = (st, side) => st.b[side].reduce((a, n, i) => a + n * (i + 1), 0);
export const allHome = own => { for (let i = 6; i <= BAR; i++) if (own[i]) return false; return true; };

export function canMove(st, side, from, die) {
  const own = st.b[side], opp = st.b[1 - side];
  if (!own[from]) return null;
  if (own[BAR] && from !== BAR) return null;
  const to = from - die;
  if (to >= 0) {
    const o = opp[23 - to];
    if (o >= 2) return null;
    return { from, to, die, hit: o === 1 };
  }
  if (from === BAR || !allHome(own)) return null;
  if (from + 1 === die) return { from, to: OFF, die, hit: false };
  // A bigger roll than needed bears off only the checker farthest from home.
  for (let i = from + 1; i < 6; i++) if (own[i]) return null;
  return { from, to: OFF, die, hit: false };
}

export function applyMove(st, side, m) {
  const n = clone(st), own = n.b[side], opp = n.b[1 - side];
  own[m.from]--;
  if (m.to >= 0) {
    own[m.to]++;
    if (m.hit) { opp[23 - m.to]--; opp[BAR]++; }
  }
  return n;
}

export const applySeq = (st, side, seq) => seq.reduce((s, m) => applyMove(s, side, m), st);
export const diceList = (d1, d2) => (d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]);
export const posKey = st => st.b[0].join(',') + '|' + st.b[1].join(',');

// Every legal way to play the roll: as many dice as possible, and the larger one when only one of two can be used.
export function legalSequences(st, side, d1, d2) {
  const all = [];
  const walk = (s, dice, seq) => {
    let moved = false;
    const tried = new Set();
    for (let k = 0; k < dice.length; k++) {
      const d = dice[k];
      if (tried.has(d)) continue;
      tried.add(d);
      const rest = dice.slice(0, k).concat(dice.slice(k + 1));
      for (let from = BAR; from >= 0; from--) {
        const m = canMove(s, side, from, d);
        if (!m) continue;
        moved = true;
        walk(applyMove(s, side, m), rest, seq.concat([m]));
      }
    }
    if (!moved) all.push(seq);
  };
  walk(st, diceList(d1, d2), []);
  const most = Math.max(...all.map(s => s.length));
  let keep = all.filter(s => s.length === most);
  if (most === 1 && d1 !== d2) {
    const big = Math.max(d1, d2);
    if (keep.some(s => s[0].die === big)) keep = keep.filter(s => s[0].die === big);
  }
  return keep;
}

const sameMove = (a, b) => a.from === b.from && a.to === b.to && a.die === b.die;

// What the player may do next, given the moves already made this turn.
export function nextMoves(seqs, played) {
  const live = seqs.filter(s => played.every((m, i) => s[i] && sameMove(s[i], m)));
  const out = [];
  for (const s of live) {
    const m = s[played.length];
    if (m && !out.some(o => sameMove(o, m))) out.push(m);
  }
  return out;
}

export const turnDone = (seqs, played) => !nextMoves(seqs, played).length;

// Destinations for one checker this turn, each with the moves that get it there, so one tap can use both dice.
export function targetsFrom(seqs, played, from) {
  const live = seqs.filter(s => played.every((m, i) => s[i] && sameMove(s[i], m)));
  const found = new Map();
  for (const s of live) {
    let at = from;
    const path = [];
    for (let i = played.length; i < s.length; i++) {
      const m = s[i];
      if (m.from !== at) break;
      path.push(m);
      const key = m.to;
      const prev = found.get(key);
      if (!prev || path.length < prev.length || (path.length === prev.length && path[0].die < prev[0].die)) found.set(key, path.slice());
      if (m.to < 0) break;
      at = m.to;
    }
  }
  return found;
}

export function winner(st) {
  for (const side of [0, 1]) if (onBoard(st, side) === 0) {
    const loser = 1 - side, lb = st.b[loser];
    let points = 1;
    if (borneOff(st, loser) === 0) {
      points = 2;
      // Still on the bar or in the winner's home board, which is the loser's 19 to 24 points.
      if (lb[BAR] || lb.slice(18, 24).some(n => n)) points = 3;
    }
    return { side, points };
  }
  return null;
}

const SHOTS = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1];

// Higher is better for `side`. Weights are hand tuned: hit, make points, keep blots out of reach, race when ahead.
export function evaluate(st, side) {
  const own = st.b[side], opp = st.b[1 - side];
  const myPips = pipCount(st, side), oppPips = pipCount(st, 1 - side);
  let myBack = -1, oppBack = -1;
  for (let i = BAR; i >= 0; i--) if (own[i]) { myBack = i; break; }
  for (let i = BAR; i >= 0; i--) if (opp[i]) { oppBack = i; break; }
  const contact = myBack >= 0 && oppBack >= 0 && myBack + oppBack > 23;
  const off = borneOff(st, side);
  if (!contact) {
    let wasted = 0;
    for (let i = 0; i < 6; i++) if (own[i] > 3) wasted += own[i] - 3;
    return (oppPips - myPips) * 2 + off * 3 - wasted * 0.5;
  }
  const myBoard = countMade(own, 0, 6), oppBoard = countMade(opp, 0, 6);
  let score = (oppPips - myPips) * 0.1 + off * 2;
  score += opp[BAR] * (4 + myBoard * 1.5);
  score -= own[BAR] * (4 + oppBoard * 1.5);
  const HOME = [1.5, 2.5, 3, 3.5, 4.2, 4];
  for (let i = 0; i < 6; i++) if (own[i] >= 2) score += HOME[i];
  for (let i = 6; i < 12; i++) if (own[i] >= 2) score += i === 6 ? 3.5 : 1.8;
  for (let i = 18; i < 24; i++) if (own[i] >= 2) score += 1.2;
  let run = 0, prime = 0;
  for (let i = 0; i < 12; i++) { run = own[i] >= 2 ? run + 1 : 0; prime = Math.max(prime, run); }
  score += prime >= 3 ? (prime - 2) * (prime - 2) * 1.5 : 0;
  // Where the other side's checkers sit in my numbering, the bar counting as just behind my 1 point.
  const threats = [];
  if (opp[BAR]) threats.push(-1);
  for (let j = 0; j < 24; j++) if (opp[j]) threats.push(23 - j);
  for (let i = 0; i < 24; i++) {
    if (own[i] !== 1) continue;
    let miss = 1;
    for (const p of threats) {
      const d = i - p;
      if (d > 0 && d < SHOTS.length) miss *= 1 - SHOTS[d] / 36;
    }
    // Being hit costs the pips walked so far, plus the trouble of coming back in against their board.
    score -= (1 - miss) * ((i + 1) * 0.1 + 1.5 + oppBoard * 0.8);
  }
  if (oppPips - myPips > 12) for (let i = 18; i < 24; i++) score -= own[i] * 0.8;
  return score;
}

function countMade(own, a, b) { let n = 0; for (let i = a; i < b; i++) if (own[i] >= 2) n++; return n; }

export function botMove(st, side, d1, d2) {
  const seqs = legalSequences(st, side, d1, d2);
  let best = seqs[0], bestScore = -Infinity;
  const seen = new Set();
  for (const s of seqs) {
    const after = applySeq(st, side, s);
    const key = posKey(after);
    if (seen.has(key)) continue;
    seen.add(key);
    const v = evaluate(after, side);
    if (v > bestScore) { bestScore = v; best = s; }
  }
  return best;
}

export function rollDice(rng = Math.random) { return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)]; }

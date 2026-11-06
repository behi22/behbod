// The desk's Rubik's cube: 27 pieces, each with a place (-1, 0 or 1 on every axis) and a turn (a 3 by 3 matrix of
// whole numbers). A move turns one layer a quarter; the cube solves itself by playing its scramble backwards.

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function solvedCube() {
  const pieces = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) pieces.push({ home: [x, y, z], at: [x, y, z], turn: I.slice() });
  return pieces;
}

// A quarter turn about axis (0 x, 1 y, 2 z), +1 anticlockwise looking down the axis, as a matrix.
export function quarter(axis, dir) {
  const c = 0, s = dir;
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
const mul = (a, b) => [0, 1, 2].flatMap(r => [0, 1, 2].map(c => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
const apply = (m, v) => [0, 1, 2].map(r => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);

export const inLayer = (piece, move) => piece.at[move.axis] === move.layer;
export function turn(pieces, move) {
  const q = quarter(move.axis, move.dir);
  for (const p of pieces) {
    if (!inLayer(p, move)) continue;
    p.at = apply(q, p.at);
    p.turn = mul(q, p.turn);
  }
  return pieces;
}
export const undo = move => ({ ...move, dir: -move.dir });

export function isSolved(pieces) {
  return pieces.every(p => p.at.every((v, i) => v === p.home[i]) && p.turn.every((v, i) => v === I[i]));
}

// A scramble of n moves that never undoes the move before it or turns the same layer three times running.
export function scramble(n, rand = Math.random) {
  const out = [];
  while (out.length < n) {
    const m = { axis: Math.floor(rand() * 3), layer: Math.floor(rand() * 3) - 1, dir: rand() < 0.5 ? 1 : -1 };
    const a = out[out.length - 1], b = out[out.length - 2];
    if (a && a.axis === m.axis && a.layer === m.layer && a.dir === -m.dir) continue;
    if (a && b && [a, b].every(o => o.axis === m.axis && o.layer === m.layer && o.dir === m.dir)) continue;
    out.push(m);
  }
  return out;
}
export const solution = moves => moves.slice().reverse().map(undo);

// Typing on the desk keyboard (15 keys across, 5 deep; row 0 nearest me, column 0 furthest right): which key a key
// press is, which finger touch-types it, and where a finger and its key are a moment into a stroke.

// Each row from column 13 (the left little finger's) toward the right; column 14 holds Esc, Tab, Caps, Shift and Ctrl.
const ROWS = { 4: '1234567890-=', 3: 'qwertyuiop[]\\', 2: 'asdfghjkl;\'', 1: 'zxcvbnm,./' };
const NAMED = { Escape: [4, 14], Tab: [3, 14], CapsLock: [2, 14], ShiftLeft: [1, 14], ControlLeft: [0, 14], Backspace: [4, 1], Enter: [2, 2], ShiftRight: [1, 2],
  Space: [0, 7], ArrowUp: [3, 12], ArrowLeft: [2, 13], ArrowDown: [2, 12], ArrowRight: [2, 11] };
// Arrows are played on W, A, S and D, the way a gamer's left hand rests.
export function keyFor(code, key = '') {
  if (NAMED[code]) return NAMED[code];
  const ch = (key || '').toLowerCase();
  if (ch === ' ') return NAMED.Space;
  for (const [row, chars] of Object.entries(ROWS)) { const i = chars.indexOf(ch); if (ch && i >= 0) return [+row, 13 - i]; }
  const m = /^Key([A-Z])$/.exec(code) || /^Digit(\d)$/.exec(code);
  return m ? keyFor('', m[1]) : null;
}
// The finger that touch-types a key: the left hand takes columns 9 and up, the right 8 and down; the thumbs the bottom row.
export function fingerFor([row, col]) {
  if (row === 0 && col >= 5 && col <= 10) return { side: col >= 8 ? 'left' : 'right', digit: 'thumb' };
  if (col >= 13) return { side: 'left', digit: 'pinky' };
  if (col === 12) return { side: 'left', digit: 'ring' };
  if (col === 11) return { side: 'left', digit: 'middle' };
  if (col >= 9) return { side: 'left', digit: 'index' };
  if (col >= 7) return { side: 'right', digit: 'index' };
  if (col === 6) return { side: 'right', digit: 'middle' };
  if (col === 5) return { side: 'right', digit: 'ring' };
  return { side: 'right', digit: 'pinky' };
}
// Where each finger rests between strokes, and the keys each finger can reach.
export const HOME = { left: { pinky: [2, 13], ring: [2, 12], middle: [2, 11], index: [2, 10], thumb: [0, 9] }, right: { index: [2, 7], middle: [2, 6], ring: [2, 5], pinky: [2, 4], thumb: [0, 7] } };
export function reachable(side, digit) {
  const out = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 15; col++) { const f = fingerFor([row, col]); if (f.side === side && f.digit === digit) out.push([row, col]); }
  return out;
}

// How far a key goes down when pressed to the bottom (metres).
export const TRAVEL = 0.0035;
// One stroke's timing (seconds): over to the key if it is not the one the finger rests on, down until the key bottoms
// out, a moment held, back up, then home again.
export const STROKE = { reach: 0.07, down: 0.045, hold: 0.035, up: 0.055, home: 0.11 };
const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// `t` seconds into a stroke: how far the finger is over toward its key (0 at home, 1 over it), how far down it is
// pressing (0 resting on the key's top, 1 the key at the bottom of its travel), how far lifted off the keys while it
// travels (0 to 1), and whether the stroke is over.
export function strokeAt(t, away) {
  const S = STROKE, r = away ? S.reach : 0, d0 = r, d1 = d0 + S.down, h1 = d1 + S.hold, u1 = h1 + S.up, end = u1 + (away ? S.home : 0);
  const over = away ? (t < r ? smooth(t / r) : t < u1 ? 1 : 1 - smooth((t - u1) / S.home)) : 0;
  const press = t < d0 ? 0 : t < d1 ? smooth((t - d0) / S.down) : t < h1 ? 1 : t < u1 ? 1 - smooth((t - h1) / S.up) : 0;
  const lift = away ? Math.max(0, Math.sin(Math.PI * Math.min(1, t / r)) * (t < r ? 1 : 0), t > u1 ? Math.sin(Math.PI * Math.min(1, (t - u1) / S.home)) : 0) : 0;
  return { over, press, lift, done: t >= end, length: end };
}

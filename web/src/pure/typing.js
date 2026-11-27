// Typing on the desk keyboard, a 65% board of 68 keys like a gaming keyboard's: where each key is and what it says,
// which key a key press is, which finger touch-types it, and where a finger and its key are a moment into a stroke.
// Desk space (blender/zones/studio.py), from the keyboard's middle on the desk: x toward the monitor, y up, z right.

// Keys 19.05 mm apart as on a real board, each cap 1.55 mm narrower than its place.
export const U = 0.01905;
const GAP = 0.00155;
// Each row from the left, row 0 nearest me: [legend, width in keys, the code a key press carries].
const ROWS = [
  [['Ctrl', 1.25, 'ControlLeft'], ['Super', 1.25, 'MetaLeft'], ['Alt', 1.25, 'AltLeft'], ['', 6.25, 'Space'], ['Alt', 1, 'AltRight'], ['Fn', 1, 'Fn'], ['Ctrl', 1, 'ControlRight'], ['←', 1, 'ArrowLeft'], ['↓', 1, 'ArrowDown'], ['→', 1, 'ArrowRight']],
  [['Shift', 2.25, 'ShiftLeft'], ...[...'ZXCVBNM'].map(c => [c, 1, 'Key' + c]), [',', 1, 'Comma'], ['.', 1, 'Period'], ['/', 1, 'Slash'], ['Shift', 1.75, 'ShiftRight'], ['↑', 1, 'ArrowUp'], ['End', 1, 'End']],
  [['Caps', 1.75, 'CapsLock'], ...[...'ASDFGHJKL'].map(c => [c, 1, 'Key' + c]), [';', 1, 'Semicolon'], ['\'', 1, 'Quote'], ['Enter', 2.25, 'Enter'], ['PgDn', 1, 'PageDown']],
  [['Tab', 1.5, 'Tab'], ...[...'QWERTYUIOP'].map(c => [c, 1, 'Key' + c]), ['[', 1, 'BracketLeft'], [']', 1, 'BracketRight'], ['\\', 1.5, 'Backslash'], ['PgUp', 1, 'PageUp']],
  [['Esc', 1, 'Escape'], ...[...'1234567890'].map(c => [c, 1, 'Digit' + c]), ['-', 1, 'Minus'], ['=', 1, 'Equal'], ['Backspace', 2, 'Backspace'], ['Del', 1, 'Delete']],
];
// Every key: its code, row, the middle of its top (x toward the monitor, z right), its cap's size and its legend.
export const KEYS = [];
ROWS.forEach((row, r) => {
  let u = 0;
  for (const [label, w, id] of row) {
    KEYS.push({ id, row: r, x: (r - 2) * U, z: (u + w / 2 - 8) * U, w: w * U - GAP, d: U - GAP, label, index: KEYS.length });
    u += w;
  }
});
export const KEY = Object.fromEntries(KEYS.map(k => [k.id, k]));

// The desk's keyboard, wrist rest and mouse: the keys' tops 3.9 cm over the desk, 1 cm tall.
export const DESK = {
  key: { top: 0.039, h: 0.01 },
  case: { at: [0, 0.018, 0], size: [0.115, 0.022, 0.325] },
  rest: { at: [-0.095, 0.012, 0], size: [0.07, 0.016, 0.32] },
  // The mouse on the right of the keyboard.
  mouse: { at: [-0.03, 0.018, 0.265], size: [0.11, 0.035, 0.065], r: 0.016 },
};

// What a character types as, for a key press that names no key (some phones' keyboards).
const SHIFTED = { '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', _: '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': '\'', '<': ',', '>': '.', '?': '/', '~': '`' };
const BY_CHAR = { ' ': KEY.Space, '`': KEY.Escape, '\n': KEY.Enter };
for (const k of KEYS) if (k.label.length === 1 && !/[←-↓]/.test(k.label)) BY_CHAR[k.label.toLowerCase()] = k;
// The key a key press is: by its code, else by what it typed; null for a key this board has not (F5, the numpad).
export function keyFor(code, key = '') {
  if (KEY[code]) return KEY[code];
  if (code === 'Backquote') return KEY.Escape;
  if (KEY[key]) return KEY[key];
  const ch = key.length === 1 ? key.toLowerCase() : '';
  return BY_CHAR[SHIFTED[ch] ?? ch] || null;
}
// The keys a change of an input's text was typed with: the characters added, or Backspace for each one taken away.
export function keysForText(before, after) {
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  const gone = before.length - i, added = after.slice(i);
  const out = [];
  for (let n = 0; n < Math.min(gone, 8); n++) out.push(KEY.Backspace);
  for (const ch of added.slice(-8)) { const k = keyFor('', ch); if (k) out.push(k); }
  return out;
}

// Which finger touch-types each key: each hand its half, the thumbs the space bar and Alt keys; the far right column
// and the arrows by the right hand moved over to them.
const FINGER = {};
const give = (side, digit, ids) => { for (const id of ids.split(' ')) FINGER[id] = { side, digit }; };
give('left', 'pinky', 'Escape Digit1 Tab KeyQ CapsLock KeyA ShiftLeft KeyZ ControlLeft MetaLeft');
give('left', 'ring', 'Digit2 KeyW KeyS KeyX');
give('left', 'middle', 'Digit3 KeyE KeyD KeyC');
give('left', 'index', 'Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB');
give('left', 'thumb', 'AltLeft');
give('right', 'thumb', 'Space AltRight');
give('right', 'index', 'Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM ArrowLeft');
give('right', 'middle', 'Digit8 KeyI KeyK Comma ArrowUp ArrowDown ArrowRight');
give('right', 'ring', 'Digit9 KeyO KeyL Period');
give('right', 'pinky', 'Digit0 Minus Equal Backspace Delete KeyP BracketLeft BracketRight Backslash PageUp Semicolon Quote Enter PageDown Slash ShiftRight End Fn ControlRight');
export const fingerFor = key => FINGER[key.id];
// Where each finger rests between strokes: the home row, both thumbs on the space bar.
export const HOME = {
  left: { pinky: 'KeyA', ring: 'KeyS', middle: 'KeyD', index: 'KeyF', thumb: 'Space' },
  right: { index: 'KeyJ', middle: 'KeyK', ring: 'KeyL', pinky: 'Semicolon', thumb: 'Space' },
};
// Where on its key a finger lands: the middle of a key a key wide; on a wider key, the end nearest that finger's own
// column (each thumb on its own part of the space bar).
const THUMB_AT = { left: -2 * U, right: 0.25 * U };
export function spotOn(key, side, digit) {
  const home = digit === 'thumb' ? THUMB_AT[side] : KEY[HOME[side][digit]].z, half = Math.max(0, (key.w - U + GAP) / 2);
  return [key.x, Math.min(key.z + half, Math.max(key.z - half, home))];
}
export const reachable = (side, digit) => KEYS.filter(k => FINGER[k.id].side === side && FINGER[k.id].digit === digit);

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
// A stroke's time `dt` later, never stepping over the moment its key is held at the bottom: on a slow frame the key
// still shows going all the way down.
export function advance(t, dt, away) {
  const d1 = (away ? STROKE.reach : 0) + STROKE.down, h1 = d1 + STROKE.hold;
  return t < d1 && t + dt > h1 ? (d1 + h1) / 2 : t + dt;
}

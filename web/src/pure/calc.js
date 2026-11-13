// The calculator on the computer: a pocket calculator that knows times and divide come before plus and minus.
// Pure: `press` takes the calculator and a key and changes it; `show` says what its two lines read.
// Keys: the digits, '.', '+', '-', '*', '/', '=', '%', 'neg' (change sign), 'back' (rub out a digit), 'C' (clear).
export const KEYS = [
  ['C', 'neg', '%', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', 'back', '='],
];
export const LABEL = { '/': '÷', '*': '×', '-': '−', '+': '+', neg: '±', back: '⌫', C: 'C', '=': '=', '%': '%', '.': '.' };
// What each key is called, for a screen reader (a digit is its own name).
export const NAME = { '/': 'Divide', '*': 'Times', '-': 'Minus', '+': 'Plus', neg: 'Change sign', back: 'Rub out', C: 'Clear', '=': 'Equals', '%': 'Percent', '.': 'Point' };
const OPS = new Set(['+', '-', '*', '/']), DIGITS = 12;
export const ZERO = 'Cannot divide by zero', BIG = 'Too big';

export function newCalc() {
  // tokens: the sum so far, numbers and operators in turn. entry: what is being typed, as text. fresh: the entry is an
  // answer or a starting 0, so the next digit starts a new number. value: an answer's full value (its text may be a
  // rounded power of ten). after: an operator was the last key that did anything, so another replaces it. done: the
  // finished sum, shown above its answer.
  return { tokens: [], entry: '0', fresh: true, value: null, after: false, error: '', done: '' };
}

// The display holds twelve figures. Inside, a times or a divide keeps fifteen (so a third times three is one again),
// and a plus or a minus is rounded where the bigger of its two numbers stops being exact, twelve figures in: that is
// what keeps 0.1 + 0.2 - 0.3 at 0 instead of the dust the machine's own arithmetic leaves behind.
const tidy = v => (Number.isFinite(v) ? +v.toPrecision(15) : v);
function add(a, b) {
  const v = a + b, big = Math.max(Math.abs(a), Math.abs(b));
  if (!Number.isFinite(v) || big === 0) return v;
  // The place of the bigger number's twelfth figure, as a power of ten; whatever its size, tiny or huge.
  const e = Math.floor(Math.log10(big)) - (DIGITS - 1);
  if (Math.abs(e) > 290) return v;
  return tidy(e < 0 ? Math.round(v * 10 ** -e) / 10 ** -e : Math.round(v / 10 ** e) * 10 ** e);
}

// A number as the display writes it: no trailing zeros, powers of ten only for the very big and the very small.
export function format(n) {
  if (!Number.isFinite(n)) return 'Error';
  // Rounded to the display's twelve figures first, so a number a hair under a trillion is not written with thirteen.
  n = +n.toPrecision(DIGITS);
  if (n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1e12 || a < 1e-9) return n.toExponential(6).replace(/\.?0+e/, 'e').replace('e+', 'e');
  // Between a billionth and a millionth the machine would write a power of ten by itself; written out instead.
  if (a < 1e-6) return n.toFixed(DIGITS - 1 - Math.floor(Math.log10(a))).replace(/0+$/, '');
  return String(+n.toPrecision(DIGITS));
}
// A number's own minus sign, written as a minus sign (the hyphen in a power of ten stays as it is).
const signed = text => text.replace(/^-/, '−');

// Works out a sum: times and divide first, left to right, then plus and minus. Returns the number, or ZERO or BIG
// when there is none to give.
export function work(tokens) {
  const t = tokens.slice();
  for (let i = 1; i < t.length - 1;) {
    if (t[i] === '*' || t[i] === '/') {
      if (t[i] === '/' && t[i + 1] === 0) return ZERO;
      t.splice(i - 1, 3, tidy(t[i] === '*' ? t[i - 1] * t[i + 1] : t[i - 1] / t[i + 1]));
    } else i += 2;
  }
  let v = t[0];
  for (let i = 1; i < t.length - 1; i += 2) v = add(v, t[i] === '+' ? t[i + 1] : -t[i + 1]);
  return Number.isFinite(v) ? v : BIG;
}

// The number the entry stands for: an answer's full value while it is still the answer, else what was typed.
const number = c => (c.fresh && c.value !== null ? c.value : +c.entry);
const answer = (c, v) => { c.entry = format(v); c.value = v; c.fresh = true; };
const fail = (c, why) => { c.error = why; c.tokens = []; c.entry = '0'; c.value = null; c.fresh = true; c.after = false; return c; };
const restart = c => { if (c.done) { c.tokens = []; c.done = ''; } };

export function press(c, key) {
  if (c.error) { if (key === 'C' || key === 'back') Object.assign(c, newCalc()); return c; }
  if (key === 'C') return Object.assign(c, newCalc());
  if (typeof key !== 'string') return c;
  if (/^[0-9]$/.test(key)) {
    c.after = false;
    if (c.fresh) { restart(c); c.entry = key; c.fresh = false; c.value = null; }
    else if (c.entry.replace(/[-.]/g, '').length < DIGITS) c.entry = c.entry === '0' ? key : c.entry === '-0' ? '-' + key : c.entry + key;
    return c;
  }
  if (key === '.') {
    c.after = false;
    if (c.fresh) { restart(c); c.entry = '0.'; c.fresh = false; c.value = null; }
    else if (!c.entry.includes('.')) c.entry += '.';
    return c;
  }
  if (key === 'back') {
    // Rubbing out only undoes typing; with nothing typed it does nothing at all (an operator just pressed stays pressed).
    if (c.fresh) return c;
    c.entry = c.entry.slice(0, -1);
    if (c.entry === '' || c.entry === '-') { c.entry = '0'; c.fresh = true; c.value = null; }
    return c;
  }
  if (key === 'neg') {
    // A decimal being typed takes its sign at once, even while it still reads 0.0; a plain 0 has none to take.
    if (number(c) === 0 && (c.fresh || !c.entry.includes('.'))) return c;
    c.after = false; c.done = '';
    if (c.fresh) answer(c, -number(c));
    else c.entry = c.entry.startsWith('-') ? c.entry.slice(1) : '-' + c.entry;
    return c;
  }
  if (key === '%') {
    // After plus or minus, a percentage of what came before (200 + 10 % is 200 + 20); otherwise a hundredth.
    const before = c.tokens.length >= 2 && !c.done && (c.tokens.at(-1) === '+' || c.tokens.at(-1) === '-') ? work(c.tokens.slice(0, -1)) : null;
    if (typeof before === 'string') return fail(c, before);
    const v = tidy(before === null ? number(c) / 100 : before * number(c) / 100);
    if (!Number.isFinite(v)) return fail(c, BIG);
    c.after = false;
    restart(c);
    answer(c, v);
    return c;
  }
  if (OPS.has(key)) {
    restart(c);
    // A second operator straight after the first replaces it.
    if (c.after && c.tokens.length) c.tokens[c.tokens.length - 1] = key; else c.tokens.push(number(c), key);
    c.fresh = true; c.after = true;
    return c;
  }
  if (key === '=') {
    if (c.done) return c;
    const sum = c.tokens.concat(number(c)), v = work(sum);
    c.after = false;
    c.done = line(sum) + ' =';
    if (typeof v === 'string') return fail(c, v);
    c.tokens = [];
    answer(c, v);
    return c;
  }
  return c;
}

const line = tokens => tokens.map(t => (typeof t === 'number' ? signed(format(t)) : LABEL[t])).join(' ');

// The two lines of the display: the sum so far above, the number being typed (or the answer) below.
export function show(c) {
  if (c.error) return { top: c.done, main: c.error };
  return { top: c.done || line(c.tokens), main: signed(c.entry) };
}

// The key a keyboard key stands for, or null.
export function fromKeyboard(key) {
  if (typeof key !== 'string') return null;
  if (/^[0-9]$/.test(key) || key === '.' || OPS.has(key) || key === '%') return key;
  if (key === 'Enter' || key === '=') return '=';
  if (key === 'Backspace') return 'back';
  if (key === 'Delete' || key === 'c' || key === 'C') return 'C';
  if (key === ',') return '.';
  if (key === 'x' || key === 'X') return '*';
  return null;
}

// How a keychain's words sit: on one line, or on two when that makes the letters bigger, and how big they print.
import { REACH, GROW } from './printer.js';

export const FONT_PX = 96, STEP = 1.25;
export const FONT = `900 ${FONT_PX}px system-ui, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", Tahoma, Arial, sans-serif`;
// Centimetres before printing: the letters' size at most, a line's length at most, and the bar's end and ring beyond the letters.
export const TALL = 4.2, WIDE = 17, END = 4.22;
// Printed letter sizes in cm (the font's size; a capital is about 0.7 of it). Below MIN they cannot be read from where a
// visitor stands or on the screen's view; one line is kept while it gives ONE or more.
export const MIN = 2.8, ONE = 3.2;

// The printed size of the letters when the longest line is this many pixels long at FONT_PX, at the print's own size.
export function sizeFor(px) {
  const k = Math.min(TALL / FONT_PX, WIDE / Math.max(1, px)), half = ((px * k + END) / 2) * GROW;
  return FONT_PX * k * GROW * Math.min(1, REACH / half);
}

// Letters as a reader sees them, so a break never parts a letter from its marks or an emoji from its pieces.
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const JOINS = /^[\p{M}\u200c\u200d\ufe0e\ufe0f\u{1f3fb}-\u{1f3ff}\u{e0020}-\u{e007f}]/u;
// Without Intl.Segmenter (Firefox before 125), marks, joiners and emoji modifiers stay with the letter before them.
export function roughGraphemes(s) {
  const out = [];
  for (const ch of s) { if (out.length && (JOINS.test(ch) || out[out.length - 1].endsWith('\u200d'))) out[out.length - 1] += ch; else out.push(ch); }
  return out;
}
export const graphemes = s => (SEG ? Array.from(SEG.segment(s), g => g.segment) : roughGraphemes(s));
// A word broken over two lines takes a hyphen in scripts that use one, and a joiner each side where its two letters join.
const HYPHEN = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]$/u, JOINED = /^(?=\p{L})[\p{Script=Arabic}\p{Script=Syriac}]$/u;
// Letters that never join the one after them (alef, dal, re, waw and their kin, and hamza): a joiner there would join what is apart.
const APART = /[\u0621-\u0625\u0627\u0629\u062f-\u0632\u0648\u0671-\u0673\u0675-\u0677\u0688-\u0699\u06c0\u06c3-\u06cb\u06cd\u06cf\u06d2\u06d3\u06d5\u06ee\u06ef\u0710\u0715-\u0719\u071e\u0728\u072a\u072c\u072f\u074d]/u;
function broken(a, b) {
  // The letter before the break is the one under any marks it carries.
  const x = Array.from(a.replace(/\p{M}+$/u, '') || a).pop(), y = Array.from(b)[0];
  if (HYPHEN.test(x) && HYPHEN.test(y)) return [a + '-', b];
  if (JOINED.test(x) && JOINED.test(y) && !APART.test(x) && y !== '\u0621') return [a + '\u200d', '\u200d' + b];
  return [a, b];
}

// The lines for these words and the size they print at; `fits` is false when even the best layout prints them too small to read.
export function layout(text, measure) {
  const one = sizeFor(measure(text));
  if (one >= ONE) return { lines: [text], size: one, fits: true };
  const g = graphemes(text);
  let best = null;
  for (let i = 1; i < g.length; i++) {
    const a = g.slice(0, i).join(''), b = g.slice(i).join(''), space = /\s/.test(g[i - 1]) || /\s/.test(g[i]);
    const lines = space ? [a.trimEnd(), b.trimStart()] : broken(a, b);
    if (!lines[0] || !lines[1]) continue;
    // A break between words is kept over one inside a word unless the word break is clearly better.
    const w = Math.max(measure(lines[0]), measure(lines[1])), score = space ? w : w * 1.15;
    if (!best || score < best.score) best = { lines, w, score };
  }
  const two = best ? sizeFor(best.w) : 0;
  return two > one ? { lines: best.lines, size: two, fits: two >= MIN } : { lines: [text], size: one, fits: one >= MIN };
}

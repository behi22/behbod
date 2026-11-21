// Any word that is not a model prints on a keychain; words like taller or red adjust the print on the bed.
import { MODELS, MODEL } from './catalog.js';

export const COLOURS = {
  red: '#e0453a', orange: '#f08a24', gold: '#f2b630', yellow: '#f5d43a', green: '#4cc46a', teal: '#3ee6c4', blue: '#3d7bf0',
  purple: '#8c4cf0', pink: '#f06aa8', white: '#eef2f6', black: '#2a2c33', grey: '#8a93a6', gray: '#8a93a6', silver: '#c4ccd8',
};
export const SWATCHES = ['red', 'orange', 'gold', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'white', 'silver', 'grey', 'black'];
// A few more models answer only to being typed.
export const SHOWN = MODELS.filter(m => !m.hidden).map(m => m.id);
export const MAX_TEXT = 24;
// Centimetres. Models are drawn a little small and printed GROW times over, so they fill the 30 cm bed.
export const REACH = 12, TALLEST = 20, GROW = 1.25;
export const TOO_LONG = 'That is too long for a keychain. Try fewer letters.';
const SPIKES = [4, 16, 8, 'spikes'];
export const sidesOf = id => MODEL[id]?.sides || SPIKES;

export const DEFAULT = Object.freeze({ model: 'rocket', text: '', colour: 'red', size: 1, height: 1, width: 1, twist: 0, bulge: 0, taper: 0, depth: 0, sides: 4 });

const RANGES = [['size', 0.5, 1.5], ['height', 0.4, 2.2], ['width', 0.5, 2], ['twist', -2, 2], ['bulge', -0.3, 0.8], ['taper', -0.4, 0.5], ['depth', 0, 0.6]];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// The joiners stay: Persian needs its half-space between letters, and an emoji family is held together by them.
const ends = s => s.replace(/^[\s\u200c\u200d]+|[\s\u200c\u200d]+$/g, '');
export function cleanText(t, max = MAX_TEXT) {
  const s = ends(String(t ?? '').normalize('NFC').replace(/\s+/g, ' ').replace(/(?![\u200c\u200d])\p{C}/gu, ''));
  return ends(Array.from(s).slice(0, max).join(''));
}
// Words a keychain cannot hold all of.
export const tooMany = t => Array.from(cleanText(t, Infinity)).length > MAX_TEXT;

// The shapes the printer made before its models, so a print saved then comes back as the nearest one now.
const OLD = { vase: 'vase', cup: 'mug', star: 'star', gear: 'gear', heart: 'heart', spiral: 'spiral', tower: 'rook', flower: 'flower' };

export function cleanPrint(q) {
  const p = { ...DEFAULT };
  if (!q || typeof q !== 'object') return p;
  if (q.model === undefined && typeof q.name === 'string') {
    const name = q.name.trim().toLowerCase();
    if (OLD[name] || WORDS.has(name)) p.model = OLD[name] || WORDS.get(name);
    else if (cleanText(q.name)) { p.model = 'word'; p.text = cleanText(q.name); }
    p.sides = sidesOf(p.model)[2];
    p.colour = Object.hasOwn(COLOURS, q.colour) ? q.colour : MODEL[p.model]?.colour || wordColour(p.text);
    return p;
  }
  if (q.model === 'word' && cleanText(q.text)) { p.model = 'word'; p.text = cleanText(q.text); }
  else if (typeof q.model === 'string' && q.model !== 'word' && Object.hasOwn(MODEL, q.model)) p.model = q.model;
  for (const [k, lo, hi] of RANGES) if (Number.isFinite(q[k])) p[k] = clamp(q[k], lo, hi);
  const [lo, hi, def] = sidesOf(p.model);
  p.sides = Number.isFinite(q.sides) ? clamp(Math.round(q.sides), lo, hi) : def;
  p.colour = Object.hasOwn(COLOURS, q.colour) ? q.colour : p.model === 'word' ? wordColour(p.text) : MODEL[p.model].colour;
  return p;
}

export const nameOf = p => (p.model === 'word' ? 'keychain' : MODEL[p.model]?.name || 'print');
const an = w => (/^[aeiou]/i.test(w) ? 'an' : 'a');
export function describe(p) {
  const what = `${p.colour === 'gray' ? 'grey' : p.colour} ${nameOf(p)}`;
  return `${an(what)} ${what}${p.model === 'word' ? ` that says ${p.text}` : ''}`;
}

// A print's colour in linear light, and a sheen for a dark one that grows with the light on each face: black shows its shape, its shadows stay black.
const SHEEN = 0.13;
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function printColour(name) {
  if (!Object.hasOwn(COLOURS, name)) return { base: [1, 1, 1], sheen: 0 };
  const base = [1, 3, 5].map(i => lin(parseInt(COLOURS[name].slice(i, i + 2), 16) / 255));
  return { base, sheen: SHEEN * Math.max(0, 1 - (0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2]) / 0.15) };
}

export function wordColour(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  const pick = SWATCHES.filter(c => c !== 'black' && c !== 'grey');
  return pick[(h >>> 0) % pick.length];
}

const WORDS = new Map(MODELS.flatMap(m => m.words.map(w => [w, m.id])));
const FILLER = new Set(['a', 'an', 'the', 'make', 'me', 'print', 'please', 'it', 'and', 'with', 'some', 'of', 'my', 'little', 'one', 'can', 'you', 'i', 'want', 'more', 'fewer', 'less', 'bit', 'very', 'much', 'again', 'reprint', 'now', 'too', 'so', 'than', 'to', 'in', 'mini', 'model', 'figure', 'toy']);
const LEAD = new Set(['a', 'an', 'the', 'make', 'me', 'print', 'please', 'can', 'you', 'i', 'want', 'some', 'my']);
const SIDE_WORDS = new Set(['side', 'sides', 'point', 'points', 'teeth', 'tooth', 'petal', 'petals', 'corner', 'corners', 'arm', 'arms', 'fin', 'fins', 'spike', 'spikes']);
const up = (k, f) => p => { p[k] *= f; };
const spikier = p => { p.depth += 0.15; };
const MODS = {
  taller: up('height', 1.25), higher: up('height', 1.25), tall: up('height', 1.25),
  shorter: up('height', 0.8), short: up('height', 0.8), flatter: up('height', 0.8), lower: up('height', 0.8), flat: up('height', 0.8),
  wider: up('width', 1.15), wide: up('width', 1.15), fatter: up('width', 1.15), fat: up('width', 1.15),
  thinner: up('width', 1 / 1.15), thin: up('width', 1 / 1.15), narrower: up('width', 1 / 1.15), slimmer: up('width', 1 / 1.15), slim: up('width', 1 / 1.15),
  bigger: up('size', 1.15), big: up('size', 1.15), larger: up('size', 1.15), huge: up('size', 1.3),
  smaller: up('size', 1 / 1.15), small: up('size', 1 / 1.15), tiny: up('size', 1 / 1.3),
  twist: p => { p.twist += 0.5; }, twisty: p => { p.twist += 0.5; }, twistier: p => { p.twist += 0.5; }, twisted: p => { p.twist += 0.5; },
  untwist: p => { p.twist = 0; }, straight: p => { p.twist = 0; }, straighter: p => { p.twist = 0; },
  spikier, spiky: spikier, pointier: spikier, sharper: spikier, spikey: spikier,
  rounder: p => { p.depth -= 0.15; }, smoother: p => { p.depth -= 0.15; }, softer: p => { p.depth -= 0.15; },
  curvy: p => { p.bulge += 0.2; }, curvier: p => { p.bulge += 0.2; }, bulgy: p => { p.bulge += 0.2; },
};
const PAIRS = new Set(['rubberduck', 'gamecontroller', 'chessknight', 'racecar', 'rocketship', 'spaceship']);
const joinPairs = s => s.replace(/\bbh[\s_-]*22\b/g, 'bh22').replace(/\bt[\s_-]*rex\b/g, 'trex')
  .replace(/\b(rubber|game|chess|race|rocket|space)\s+(duck|controller|knight|car|ship)\b/g, (m, a, b) => (PAIRS.has(a + b) ? a + b : m));
const keyOf = w => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

export function parsePrint(text, current = DEFAULT) {
  let raw = String(text ?? '').normalize('NFC');
  // Words in double quotes are always the keychain's, even a model's name.
  let quoted = null;
  const q = raw.match(/["“”«»]([^"“”«»]*)["“”«»]?/) || raw.match(/^\s*'(.*)'\s*$/);
  let cut = false;
  if (q) { quoted = cleanText(q[1]); cut = tooMany(q[1]); raw = raw.slice(0, q.index) + ' ' + raw.slice(q.index + q[0].length); }
  // Read word by word, punctuation at a word's ends set aside ("taller!" is taller); "<3" stays as it is.
  const spans = joinPairs(raw.toLowerCase()).split(/[\s()[\]{}]+/).filter(Boolean), words = spans.map(keyOf);
  let model = null, colour = null, sides = null, sideStep = 0;
  const mods = [], unknown = [], symbols = [], numbers = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (!w) symbols.push(spans[i]);
    else if (WORDS.has(w)) model ||= WORDS.get(w);
    else if (Object.hasOwn(COLOURS, w)) colour = w;
    else if (Object.hasOwn(MODS, w)) mods.push(w);
    else if (/^\d+[.,!?]*$/.test(spans[i])) numbers.push(+w);
    else if (SIDE_WORDS.has(w)) { if (prev === 'more') sideStep++; if (prev === 'fewer' || prev === 'less') sideStep--; }
    else if (!FILLER.has(w)) unknown.push(w);
  });
  const again = words.includes('again') || words.includes('reprint');
  if (quoted === '') quoted = null;
  // A number counts the model's fins or points when it has them in that range; otherwise it is words to print.
  const target = quoted ? 'word' : model || (unknown.length ? 'word' : current.model);
  const [lo, hi] = sidesOf(target);
  for (const n of numbers) { if (target !== 'word' && n >= lo && n <= hi) sides = n; else unknown.push(String(n)); }
  // Marks on their own ("<3", "!!!") are printed too; next to words they are only punctuation.
  const asked = model || colour || mods.length || sides !== null || sideStep || again || unknown.length;
  if (!asked && quoted === null && symbols.length) unknown.push(...symbols);
  if (!model && quoted === null && !unknown.length && !colour && !mods.length && sides === null && !sideStep && !again) return null;

  let p, fresh = true;
  if (quoted) p = { ...DEFAULT, model: 'word', text: quoted, colour: null };
  else if (model) p = { ...DEFAULT, model, colour: null };
  else if (unknown.length) {
    const t = keychainText(raw);
    cut = tooMany(keychainText(raw, Infinity));
    if (!t) return null;
    p = { ...DEFAULT, model: 'word', text: t, colour: null };
  } else { p = { ...current }; fresh = false; }
  if (fresh) p.sides = sidesOf(p.model)[2];
  for (const m of mods) MODS[m](p);
  if (sides !== null) p.sides = sides;
  if (sideStep) {
    p.sides += sideStep;
    // More points on a model with none of its own means spikes, so there have to be some.
    if (!MODEL[p.model]?.sides && p.depth < 0.15) p.depth = 0.15;
  }
  if (colour) p.colour = colour;
  p = cleanPrint(p);
  const counted = sides !== null || sideStep ? ` with ${p.sides} ${sidesOf(p.model)[3]}` : '';
  const said = fresh ? `Printing ${describe(p)}${counted}.` : `Reprinting the ${nameOf(p)}${mods.length ? `, ${mods.join(', ')}` : ''}${colour ? ` in ${colour === 'gray' ? 'grey' : colour}` : ''}${counted}.`;
  // `cut`: the keychain's words were more than it holds, so only their start is in p.
  return { p, said, cut };
}

// The asking round the words ("print me", "please") and colour or size words at either end are not printed.
function keychainText(raw, max = MAX_TEXT) {
  const spans = raw.trim().split(/\s+/).filter(Boolean);
  const drop = (w, lead) => { const k = keyOf(w); return k !== '' && ((lead && LEAD.has(k)) || Object.hasOwn(COLOURS, k) || Object.hasOwn(MODS, k) || k === 'please' || k === 'again' || k === 'now'); };
  while (spans.length > 1 && drop(spans[0], true)) spans.shift();
  while (spans.length > 1 && drop(spans[spans.length - 1], false)) spans.pop();
  return cleanText(spans.join(' '), max);
}

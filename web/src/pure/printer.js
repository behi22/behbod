// What the 3D printer makes from what you type: a named shape, a shape grown from any other word, or words that adjust
// the last print (taller, twist, more points, a colour). The print is a stack of rings, so the page can show it layer
// by layer.

export const COLOURS = {
  red: '#e0453a', orange: '#f08a24', gold: '#f2b630', yellow: '#f5d43a', green: '#4cc46a', teal: '#3ee6c4', blue: '#3d7bf0',
  purple: '#8c4cf0', pink: '#f06aa8', white: '#eef2f6', black: '#2a2c33', grey: '#8a93a6', gray: '#8a93a6', silver: '#c4ccd8',
};
const EDGES = ['round', 'poly', 'star', 'gear', 'petal', 'heart'];
const PRESETS = {
  vase: { edge: 'round', sides: 6, depth: 0, twist: 0, bulge: 0.45, taper: 0.35, lip: 0.35, height: 1.2, width: 1 },
  cup: { edge: 'round', sides: 6, depth: 0, twist: 0, bulge: 0, taper: -0.25, lip: 0, height: 0.75, width: 0.9 },
  star: { edge: 'star', sides: 5, depth: 0.5, twist: 0, bulge: 0, taper: 0, lip: 0, height: 0.35, width: 1.3 },
  gear: { edge: 'gear', sides: 12, depth: 0.2, twist: 0, bulge: 0, taper: 0, lip: 0, height: 0.3, width: 1.3 },
  heart: { edge: 'heart', sides: 6, depth: 0, twist: 0, bulge: 0, taper: 0, lip: 0, height: 0.35, width: 1.3 },
  spiral: { edge: 'star', sides: 4, depth: 0.35, twist: 1.5, bulge: 0, taper: 0.3, lip: 0, height: 1.4, width: 1 },
  tower: { edge: 'poly', sides: 6, depth: 0, twist: 0, bulge: 0, taper: 0.25, lip: 0, height: 1.6, width: 0.8 },
  flower: { edge: 'petal', sides: 6, depth: 0.4, twist: 0.4, bulge: 0.25, taper: 0, lip: 0, height: 1, width: 1 },
};
const SYNONYMS = { pot: 'vase', jar: 'vase', mug: 'cup', glass: 'cup', cog: 'gear', love: 'heart', swirl: 'spiral', twister: 'spiral', castle: 'tower', rook: 'tower', bloom: 'flower', rose: 'flower' };
export const SHAPES = Object.keys(PRESETS);
export const DEFAULT = { ...PRESETS.vase, colour: 'gold', name: 'vase' };

const FILLER = new Set(['a', 'an', 'the', 'make', 'me', 'print', 'please', 'it', 'and', 'with', 'some', 'of', 'my', 'little', 'one', 'can', 'you', 'i', 'want', 'more', 'fewer', 'less', 'bit', 'very', 'much', 'again', 'reprint', 'now', 'too', 'so', 'than', 'to', 'in']);
const SIDE_WORDS = new Set(['side', 'sides', 'point', 'points', 'teeth', 'tooth', 'petal', 'petals', 'corner', 'corners', 'arm', 'arms']);
const MODS = {
  taller: p => { p.height *= 1.25; }, higher: p => { p.height *= 1.25; }, tall: p => { p.height *= 1.25; },
  shorter: p => { p.height /= 1.25; }, short: p => { p.height /= 1.25; }, flatter: p => { p.height /= 1.25; }, lower: p => { p.height /= 1.25; }, flat: p => { p.height /= 1.25; },
  wider: p => { p.width *= 1.15; }, wide: p => { p.width *= 1.15; }, fatter: p => { p.width *= 1.15; }, fat: p => { p.width *= 1.15; },
  thinner: p => { p.width /= 1.15; }, thin: p => { p.width /= 1.15; }, narrower: p => { p.width /= 1.15; }, slimmer: p => { p.width /= 1.15; }, slim: p => { p.width /= 1.15; },
  bigger: p => { p.width *= 1.15; p.height *= 1.15; }, big: p => { p.width *= 1.15; p.height *= 1.15; }, larger: p => { p.width *= 1.15; p.height *= 1.15; },
  smaller: p => { p.width /= 1.15; p.height /= 1.15; }, small: p => { p.width /= 1.15; p.height /= 1.15; }, tiny: p => { p.width /= 1.3; p.height /= 1.3; },
  twist: p => { p.twist += 0.5; }, twisty: p => { p.twist += 0.5; }, twistier: p => { p.twist += 0.5; }, twisted: p => { p.twist += 0.5; },
  untwist: p => { p.twist = 0; }, straight: p => { p.twist = 0; }, straighter: p => { p.twist = 0; },
  spikier: p => { if (p.edge === 'round' || p.edge === 'poly') p.edge = 'star'; p.depth += 0.12; }, spiky: p => { if (p.edge === 'round' || p.edge === 'poly') p.edge = 'star'; p.depth += 0.12; },
  pointier: p => { if (p.edge === 'round' || p.edge === 'poly') p.edge = 'star'; p.depth += 0.12; }, sharper: p => { if (p.edge === 'round' || p.edge === 'poly') p.edge = 'star'; p.depth += 0.12; },
  rounder: p => { p.depth -= 0.12; }, smoother: p => { p.depth -= 0.12; }, softer: p => { p.depth -= 0.12; },
  curvy: p => { p.bulge += 0.2; }, curvier: p => { p.bulge += 0.2; }, bulgy: p => { p.bulge += 0.2; },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Keeps a print inside what the printer can make, and turns anything stored or typed into a valid one.
export function cleanPrint(q) {
  const p = { ...DEFAULT };
  if (!q || typeof q !== 'object') return p;
  if (EDGES.includes(q.edge)) p.edge = q.edge;
  for (const [k, lo, hi] of [['sides', 3, 12], ['depth', 0, 0.6], ['twist', -2, 2], ['bulge', -0.3, 0.8], ['taper', -0.4, 0.5], ['lip', 0, 0.5], ['height', 0.25, 1.8], ['width', 0.6, 1.5]]) {
    if (Number.isFinite(q[k])) p[k] = clamp(q[k], lo, hi);
  }
  p.sides = Math.round(p.sides);
  if (Object.hasOwn(COLOURS, q.colour)) p.colour = q.colour;
  if (typeof q.name === 'string' && q.name.trim()) p.name = q.name.trim().slice(0, 24);
  return p;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Any other word grows its own shape, the same one every time it is typed.
export function shapeFromWord(word) {
  const r = rng(hash(word));
  const edge = ['poly', 'star', 'petal', 'gear', 'round'][Math.floor(r() * 5)];
  const keys = Object.keys(COLOURS).filter(c => c !== 'gray');
  return cleanPrint({
    edge, sides: 3 + Math.floor(r() * 7), depth: edge === 'round' || edge === 'poly' ? 0 : 0.15 + r() * 0.35,
    twist: r() < 0.5 ? 0 : -1 + r() * 2, bulge: -0.2 + r() * 0.8, taper: -0.2 + r() * 0.6, lip: r() < 0.3 ? 0.3 : 0,
    height: 0.6 + r() * 0.8, width: 0.8 + r() * 0.4, colour: keys[Math.floor(r() * keys.length)], name: word,
  });
}

// Reads what was typed against the current print. Returns { p, said } for a new or adjusted print, or null when nothing
// in the text asks for anything.
export function parsePrint(text, current = DEFAULT) {
  const words = String(text || '').toLowerCase().match(/[a-z]+|\d+/g) || [];
  if (!words.length) return null;
  let shape = null, colour = null, sides = null, sideStep = 0;
  const mods = [], unknown = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (Object.hasOwn(PRESETS, w) || Object.hasOwn(SYNONYMS, w)) shape = SYNONYMS[w] || w;
    else if (Object.hasOwn(COLOURS, w)) colour = w;
    else if (Object.hasOwn(MODS, w)) mods.push(w);
    else if (/^\d+$/.test(w)) { if (+w >= 3 && +w <= 12) sides = +w; }
    else if (SIDE_WORDS.has(w)) { if (prev === 'more') sideStep++; if (prev === 'fewer' || prev === 'less') sideStep--; }
    else if (!FILLER.has(w)) unknown.push(w);
  });
  // "more twist" means a twist; "again" reprints what is there.
  const again = words.includes('again') || words.includes('reprint');
  if (!shape && !colour && !mods.length && sides === null && !sideStep && !unknown.length && !again) return null;
  let p, fresh = true;
  if (shape) p = { ...PRESETS[shape], colour: current.colour, name: shape };
  else if (unknown.length) p = shapeFromWord(unknown.join(' '));
  else { p = { ...current }; fresh = false; }
  for (const m of mods) MODS[m](p);
  if (sides !== null) p.sides = sides;
  p.sides += sideStep;
  if (colour) p.colour = colour;
  p = cleanPrint(p);
  const said = fresh ? `Printing ${/^[aeiou]/.test(p.colour) ? 'an' : 'a'} ${p.colour} ${p.name}.` : `Reprinting the ${p.name}${mods.length ? `, ${mods.join(', ')}` : ''}${colour ? ` in ${colour}` : ''}.`;
  return { p, said };
}

// One ring of the print's outline, radius about 1: [x, y] points round the shape, counter-clockwise.
export function section(p) {
  if (p.edge === 'heart') {
    const n = 96, pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([-x / 17, (y + 2.5) / 17]);
    }
    return pts;
  }
  const n = p.edge === 'round' ? 64 : p.sides * Math.ceil(96 / p.sides), pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, u = ((a * p.sides) / (Math.PI * 2)) % 1;
    let r = 1;
    if (p.edge === 'poly') r = Math.cos(Math.PI / p.sides) / Math.cos((u - 0.5) * (Math.PI * 2 / p.sides));
    else if (p.edge === 'star') r = 1 - p.depth * (1 - Math.abs(2 * u - 1));
    else if (p.edge === 'gear') r = u < 0.5 ? 1 : 1 - p.depth;
    else if (p.edge === 'petal') r = 1 - p.depth * Math.sin(Math.PI * u) ** 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

// How wide the print is at height t (0 at the bed, 1 at the top).
export function profile(p, t) {
  return (1 + p.bulge * Math.sin(Math.PI * t)) * (1 - p.taper * t) * (1 + p.lip * Math.max(0, (t - 0.8) / 0.2) ** 2);
}

// The print as triangles in three.js axes (y up), centred on the bed: the bottom first, then each layer's wall in
// order, then the top, so drawing the first part of the index shows the print up to a layer.
export const MAX_R = 0.1, BASE_R = 0.045, BASE_H = 0.1;
export function buildPrint(p, layers = 40) {
  const ring = section(p), n = ring.length, H = BASE_H * p.height;
  let widest = 0;
  for (let i = 0; i <= layers; i++) widest = Math.max(widest, profile(p, i / layers));
  const reach = Math.max(...ring.map(([x, y]) => Math.hypot(x, y)));
  const R = Math.min(BASE_R * p.width, MAX_R / (widest * reach));
  const pos = [], shade = [], index = [];
  const L = [-0.45, 0.55, 0.7], len = Math.hypot(...L);
  for (let i = 0; i <= layers; i++) {
    const t = i / layers, s = R * profile(p, t), a = p.twist * Math.PI * t, c = Math.cos(a), sn = Math.sin(a);
    // Every other layer a touch darker, like the lines of a real print.
    const line = i % 2 ? 0.9 : 1;
    for (const [x, y] of ring) {
      const rx = (x * c - y * sn) * s, ry = (x * sn + y * c) * s, d = Math.hypot(rx, ry) || 1;
      pos.push(rx, t * H, -ry);
      shade.push(line * (0.62 + 0.38 * Math.max(0, (rx / d * L[0] - ry / d * L[2]) / len + 0.35)));
    }
  }
  // Two centre points, for the bottom and the top caps.
  const bottomC = pos.length / 3; pos.push(0, 0, 0); shade.push(0.5);
  const topC = pos.length / 3; pos.push(0, H, 0); shade.push(1);
  for (let k = 0; k < n; k++) index.push(bottomC, (k + 1) % n, k);
  const bottom = index.length;
  for (let i = 0; i < layers; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * n + k, b = i * n + (k + 1) % n, c = a + n, d = b + n;
      index.push(a, b, d, a, d, c);
    }
  }
  const perLayer = n * 6;
  for (let k = 0; k < n; k++) index.push(topC, layers * n + k, layers * n + (k + 1) % n);
  return { pos: new Float32Array(pos), shade: new Float32Array(shade), index: new Uint32Array(index), bottom, perLayer, layers, height: H, ring, radius: R };
}

// Where the nozzle is at a moment of the print: on layer `layer`, a fraction `f` of the way round its outline.
export function nozzleAt(print, p, layer, f) {
  const t = layer / print.layers, s = print.radius * profile(p, t), a = p.twist * Math.PI * t;
  const n = print.ring.length, k = Math.floor(f * n) % n, [x, y] = print.ring[k];
  return { x: (x * Math.cos(a) - y * Math.sin(a)) * s, y: t * print.height, z: -(x * Math.sin(a) + y * Math.cos(a)) * s };
}

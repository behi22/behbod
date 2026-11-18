import { GUN, ATTACHMENTS, fit, stats } from './arsenal.js';

// The gunsmith's rules: the slots on a gun, the finishes and charms on offer, what each choice does to the numbers,
// and what a visitor's browser may hand back as a saved loadout. Pure: the bench (src/range/smith.js) draws them.

// The slots, in the order the bench lists them. An attachment slot offers 'none' and the attachments for it.
export const SLOTS = [
  { id: 'muzzle', name: 'Muzzle', none: 'Bare muzzle' },
  { id: 'optic', name: 'Optic', none: 'Iron sights' },
  { id: 'rail', name: 'Rail', none: 'Empty rail' },
  { id: 'mag', name: 'Magazine', none: 'Standard' },
  { id: 'camo', name: 'Camo' },
  { id: 'charm', name: 'Charm' },
];
export const optionsFor = slot => Object.keys(ATTACHMENTS).filter(id => ATTACHMENTS[id].slot === slot);
// What each attachment says about itself on the bench, beyond the numbers.
export const BLURBS = {
  light: 'Lights the way. L to switch it on (the LIGHT pad on a phone); always on when the hall goes dark.',
  suppressor: 'Much quieter, almost no flash, a little less kick and damage.',
  holo: 'A glowing ring and dot: quicker to the aim, steadier from the hip.',
  scope: 'Magnifies the view down the sights; slower to raise.',
  mag: 'More rounds, a slightly slower reload.',
};

// Finishes: drawn in the page (src/range/camos.js) from these, never downloaded. kind: how the pattern is drawn;
// colours from dark to light; rough and metal for the paint; metres: how big one repeat of the pattern is.
// unlock: { stars } on the range, or { achievement } for when achievements arrive (kept locked until then).
export const CAMOS = [
  { id: 'factory', name: 'Factory', kind: 'none' },
  { id: 'tidepool', name: 'Tidepool', kind: 'splinter', colours: ['#0b1a22', '#145a63', '#5fe3d0'], rough: 0.55, metal: 0, metres: 0.16 },
  { id: 'pine', name: 'Pine Pixel', kind: 'pixels', colours: ['#1b1f17', '#3b4a2c', '#6b7a45', '#8a6f4a'], rough: 0.62, metal: 0, metres: 0.12 },
  { id: 'dune', name: 'Dune', kind: 'blobs', colours: ['#7a5a3a', '#b8956a', '#d9c39a'], rough: 0.6, metal: 0, metres: 0.2 },
  { id: 'glacier', name: 'Glacier', kind: 'stripes', colours: ['#3d4a57', '#9fb0bd', '#eef3f6'], rough: 0.5, metal: 0, metres: 0.14 },
  { id: 'candy', name: 'Toybox', kind: 'dots', colours: ['#f7f2ea', '#ff7aa8', '#5fe3d0', '#ffc24a'], rough: 0.42, metal: 0, metres: 0.1 },
  { id: 'sunset', name: 'Sunset', kind: 'fade', colours: ['#3a1f5c', '#c2386b', '#ff9a4a'], rough: 0.32, metal: 0.65, metres: 0.5, unlock: { stars: 3 } },
  { id: 'circuit', name: 'Circuit', kind: 'circuit', colours: ['#06100f', '#123b36', '#5fe3d0'], rough: 0.45, metal: 0.2, metres: 0.12, unlock: { stars: 9 } },
  { id: 'gold', name: 'Gold', kind: 'solid', colours: ['#d8a93a'], rough: 0.24, metal: 1, metres: 1, unlock: { stars: 15 } },
];
// Charms: small original trinkets built in the page (src/range/charms.js), hung on a short chain.
export const CHARMS = [
  { id: 'none', name: 'No charm' },
  { id: 'pomegranate', name: 'Pomegranate' },
  { id: 'rivet', name: 'Toy robot' },
  { id: 'drone', name: 'Little drone' },
  { id: 'die', name: 'Lucky die' },
  { id: 'cat', name: 'Grey cat' },
  { id: 'tag', name: '22 tag' },
  { id: 'star', name: 'Gold star', unlock: { stars: 5 } },
];
export const CAMO = Object.fromEntries(CAMOS.map(c => [c.id, c]));
export const CHARM = Object.fromEntries(CHARMS.map(c => [c.id, c]));

// Whether a finish or charm is open: free, earned with range stars, or (later) an achievement this visitor has.
export function isOpen(item, stars = 0, has = null) {
  if (!item?.unlock) return !!item;
  if (item.unlock.stars !== undefined) return stars >= item.unlock.stars;
  if (item.unlock.achievement) return typeof has === 'function' && !!has(item.unlock.achievement);
  return false;
}
// What a locked item asks for, in words.
export const lockLine = item => (item?.unlock?.stars !== undefined ? `${item.unlock.stars} range stars` : item?.unlock?.achievement ? 'An achievement' : '');

export const BLANK = Object.freeze({ att: Object.freeze([]), camo: 'factory', charm: 'none' });
// One gun's saved loadout as the bench and the range may use it: from whatever the browser kept (old, edited or
// broken), only real attachments (one per slot), and a finish and charm that exist and are open to this visitor.
export function readKit(raw, stars = 0, has = null) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const camo = typeof r.camo === 'string' && Object.hasOwn(CAMO, r.camo) && isOpen(CAMO[r.camo], stars, has) ? r.camo : 'factory';
  const charm = typeof r.charm === 'string' && Object.hasOwn(CHARM, r.charm) && isOpen(CHARM[r.charm], stars, has) ? r.charm : 'none';
  return { att: fit(Array.isArray(r.att) ? r.att.filter(a => typeof a === 'string') : []), camo, charm };
}
// Every gun's loadout from the saved text (JSON of { gunId: kit }); unknown guns are dropped.
export function readKits(text, stars = 0, has = null) {
  let all = null;
  try { all = JSON.parse(text || '{}'); } catch (e) { all = null; }
  const out = {};
  for (const id of Object.keys(GUN)) out[id] = readKit(all && typeof all === 'object' ? (Object.hasOwn(all, id) ? all[id] : null) : null, stars, has);
  return out;
}
// The kit with one slot changed: an attachment id (or 'none') for an attachment slot, a camo or charm id for theirs.
export function choose(kit, slot, id) {
  const k = { att: [...kit.att], camo: kit.camo, charm: kit.charm };
  if (slot === 'camo') { if (Object.hasOwn(CAMO, id)) k.camo = id; return k; }
  if (slot === 'charm') { if (Object.hasOwn(CHARM, id)) k.charm = id; return k; }
  const rest = k.att.filter(a => ATTACHMENTS[a].slot !== slot);
  k.att = fit(Object.hasOwn(ATTACHMENTS, id) && ATTACHMENTS[id].slot === slot ? [...rest, id] : rest);
  return k;
}
// What sits in a slot now: an attachment id, a camo or charm id, or 'none'.
export function inSlot(kit, slot) {
  if (slot === 'camo') return kit.camo;
  if (slot === 'charm') return kit.charm;
  return kit.att.find(a => ATTACHMENTS[a].slot === slot) || 'none';
}

// ---------- the numbers on the bench ----------
// Each bar is 0 (worst of any gun however fitted) to 1 (best), so bars compare across guns; `text` is the real number.
const clamp01 = x => Math.min(1, Math.max(0, x));
const kickOf = s => s.kick.up * (1 + s.kick.climb / 2) + s.kick.side;
export const BARS = [
  { id: 'damage', name: 'Damage', of: s => s.damage, k: v => v / 160, text: v => String(Math.round(v)) },
  { id: 'range', name: 'Range', of: s => s.falloff[1], k: v => v / 200, text: v => `${Math.round(v)} m` },
  { id: 'rate', name: 'Fire rate', of: s => 60 / Math.max(s.interval, s.bolt || 0), k: v => v / 900, text: v => `${Math.round(v)} rpm` },
  { id: 'aim', name: 'Aim speed', of: s => s.ads, k: v => 1 - (v - 0.1) / 0.5, text: v => `${Math.round(v * 1000)} ms` },
  { id: 'control', name: 'Recoil control', of: kickOf, k: v => 1 - v / 4.5, text: v => v.toFixed(2) },
  { id: 'hip', name: 'Hip accuracy', of: s => s.spread.hip, k: v => 1 - v / 5.5, text: v => `${v.toFixed(2)}°` },
  { id: 'stealth', name: 'Stealth', of: s => s.loud, k: v => 1 - v, text: v => (v < 0.5 ? 'Quiet' : 'Loud') },
  { id: 'mag', name: 'Capacity', of: s => s.mag, k: v => Math.log(v) / Math.log(150), text: v => String(v) },
  { id: 'reload', name: 'Reload', of: s => s.reload.partial, k: v => 1 - (v - 1) / 4, text: v => `${v.toFixed(2)} s` },
  { id: 'zoom', name: 'Zoom', of: s => s.zoom, k: v => Math.log(v) / Math.log(8), text: v => `${+v.toFixed(2)}x` },
];
// The bars for a gun fitted with `att`.
export function bars(gunId, att = []) {
  const s = stats(gunId, att);
  if (!s) return [];
  return BARS.map(b => { const v = b.of(s); return { id: b.id, name: b.name, value: v, k: clamp01(b.k(v)), text: b.text(v) }; });
}
// Before and after a change, bar by bar: `change` is 1 better, -1 worse, 0 the same.
export function compare(gunId, before = [], after = []) {
  const a = bars(gunId, before), b = bars(gunId, after);
  return a.map((x, i) => {
    const y = b[i], d = y.k - x.k;
    return { id: x.id, name: x.name, from: x.k, to: y.k, fromText: x.text, toText: y.text, change: Math.abs(d) < 1e-9 ? 0 : d > 0 ? 1 : -1 };
  });
}

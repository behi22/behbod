// The range's guns and what fits on them. Five original designs (no real makers or models), each taking a flashlight,
// a suppressor, one optic (holo or long range, never both) and an extended magazine. Angles are in degrees, times in
// seconds, distances in metres; the view and the game read the numbers `stats()` works out and never these tables.
export const GUNS = [
  { id: 'pistol', name: 'P-22', kind: 'Pistol', auto: false, chamber: true, mag: 15, rpm: 420, damage: 34, falloff: [18, 45, 0.6],
    spread: { hip: 1.1, ads: 0.12, bloom: 0.45, max: 3.2, settle: 7 }, kick: { up: 1.5, side: 0.35, back: 0.022, climb: 0.5 },
    reload: { partial: 1.5, empty: 1.95, out: 0.32, in: 0.95, rack: 1.6 }, ads: 0.17, draw: 0.4, zoom: 1.25, stars: 0 },
  { id: 'smg', name: 'Vesper', kind: 'SMG', auto: true, chamber: true, mag: 30, rpm: 860, damage: 21, falloff: [14, 38, 0.55],
    spread: { hip: 1.5, ads: 0.22, bloom: 0.22, max: 3.6, settle: 8 }, kick: { up: 0.75, side: 0.4, back: 0.012, climb: 1.1 },
    reload: { partial: 1.75, empty: 2.2, out: 0.4, in: 1.1, rack: 1.8 }, ads: 0.2, draw: 0.5, zoom: 1.25, stars: 1 },
  { id: 'rifle', name: 'Keeper', kind: 'Rifle', auto: true, chamber: true, mag: 30, rpm: 660, damage: 30, falloff: [35, 80, 0.7],
    spread: { hip: 2.0, ads: 0.1, bloom: 0.2, max: 4.2, settle: 6.5 }, kick: { up: 1.0, side: 0.3, back: 0.016, climb: 1.4 },
    reload: { partial: 2.0, empty: 2.5, out: 0.45, in: 1.3, rack: 2.05 }, ads: 0.24, draw: 0.6, zoom: 1.3, stars: 4 },
  { id: 'sniper', name: 'Longview', kind: 'Sniper', auto: false, bolt: 0.95, mag: 5, rpm: 600, damage: 160, falloff: [120, 200, 0.85],
    spread: { hip: 5.0, ads: 0.0, bloom: 1.2, max: 6, settle: 5 }, kick: { up: 3.4, side: 0.5, back: 0.05, climb: 0 },
    reload: { partial: 2.6, empty: 3.1, out: 0.6, in: 1.75, rack: 2.55 }, ads: 0.34, draw: 0.75, zoom: 1.5, stars: 7 },
  { id: 'lmg', name: 'Gatekeeper', kind: 'Machine gun', auto: true, mag: 100, rpm: 720, damage: 28, falloff: [30, 75, 0.7],
    spread: { hip: 2.8, ads: 0.3, bloom: 0.12, max: 4.5, settle: 4.5 }, kick: { up: 0.8, side: 0.45, back: 0.014, climb: 1.0 },
    reload: { partial: 4.4, empty: 4.4, out: 1.0, in: 2.9, rack: 3.8 }, ads: 0.36, draw: 0.9, zoom: 1.25, stars: 10 },
];
export const GUN = Object.fromEntries(GUNS.map(g => [g.id, g]));

// What each attachment changes. The long scope magnifies by `zoom`, per gun; the holo sight does not magnify (the gun
// keeps its own aimed zoom) but comes up faster and steadies the hip.
export const ATTACHMENTS = {
  light: { name: 'Flashlight', slot: 'rail' },
  suppressor: { name: 'Suppressor', slot: 'muzzle', damage: 0.94, loud: 0.22, flash: 0.15, kick: 0.9 },
  holo: { name: 'Holo sight', slot: 'optic', ads: 0.92, hip: 0.9 },
  scope: { name: 'Long scope', slot: 'optic', zoom: { pistol: 2.5, smg: 2.5, rifle: 4, sniper: 8, lmg: 4 }, ads: 1.25 },
  mag: { name: 'Extended mag', slot: 'mag', size: { pistol: 21, smg: 45, rifle: 42, sniper: 8, lmg: 150 }, reload: 1.08 },
};
export const ATTACHMENT_IDS = Object.keys(ATTACHMENTS);

// The attachments a gun really carries from a list of wishes: unknown names dropped, one per slot, and of two wishes
// for the same slot the later one wins (so picking the scope takes the holo sight off).
export function fit(wanted) {
  const bySlot = new Map();
  for (const id of wanted || []) if (Object.hasOwn(ATTACHMENTS, id)) { bySlot.delete(ATTACHMENTS[id].slot); bySlot.set(ATTACHMENTS[id].slot, id); }
  return ATTACHMENT_IDS.filter(id => bySlot.get(ATTACHMENTS[id].slot) === id);
}

// Adds or removes one attachment, keeping the list valid.
export function toggle(list, id) {
  const on = fit(list);
  return on.includes(id) ? on.filter(a => a !== id) : fit([...on, id]);
}

// Everything the game and the view need to know about one gun as it is fitted out.
export function stats(gunId, attachments = []) {
  const g = Object.hasOwn(GUN, gunId) ? GUN[gunId] : null;
  if (!g) return null;
  const on = fit(attachments), has = id => on.includes(id);
  const sup = has('suppressor') ? ATTACHMENTS.suppressor : null, optic = has('scope') ? 'scope' : has('holo') ? 'holo' : null;
  const o = optic ? ATTACHMENTS[optic] : null, big = has('mag') ? ATTACHMENTS.mag : null;
  return {
    id: g.id, name: g.name, kind: g.kind, auto: g.auto, bolt: g.bolt || 0, attachments: on, optic, light: has('light'), suppressed: !!sup,
    mag: big ? big.size[g.id] : g.mag, chamber: g.chamber ? 1 : 0,
    interval: 60 / g.rpm,
    damage: g.damage * (sup ? sup.damage : 1), falloff: g.falloff,
    spread: { ...g.spread, hip: g.spread.hip * (o?.hip || 1) },
    kick: { up: g.kick.up * (sup ? sup.kick : 1), side: g.kick.side * (sup ? sup.kick : 1), back: g.kick.back, climb: g.kick.climb },
    reload: Object.fromEntries(Object.entries(g.reload).map(([k, v]) => [k, v * (big ? big.reload : 1)])),
    ads: g.ads * (o?.ads || 1), draw: g.draw,
    zoom: optic === 'scope' ? o.zoom[g.id] : g.zoom,
    loud: sup ? sup.loud : 1, flash: sup ? sup.flash : 1,
    stars: g.stars,
  };
}

// Damage at a distance: full to the first mark, easing down to the gun's floor by the second.
export function damageAt(s, metres) {
  const [near, far, floor] = s.falloff;
  const k = Math.min(1, Math.max(0, (metres - near) / (far - near)));
  return s.damage * (1 - (1 - floor) * k);
}

// The guns a visitor owns with this many stars, in order.
export const gunsFor = stars => GUNS.filter(g => g.stars <= stars).map(g => g.id);
// The next gun still locked and how many more stars it needs, or null when every gun is owned.
export function nextGun(stars) {
  const g = GUNS.find(x => x.stars > stars);
  return g ? { id: g.id, name: g.name, kind: g.kind, need: g.stars - stars } : null;
}

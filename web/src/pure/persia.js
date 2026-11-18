// No browser APIs, so the unit tests can run it. Blender axes (x east, y north, z up), metres.
import { EVENTS, vanTime } from './calendar.js';

// Each place is checked against the house's colliders and wall pieces in test/unit/persia.test.mjs.
export const PLACES = {
  simorgh: { wall: 0.02, u: [4.75, 9.0], z: [3.85, 6.1] },
  shelf: { min: [10.44, 0.0, 0], max: [11.06, 0.34, 1.86] },
  miniature: { center: [5.1, 0.0, 4.55], w: 0.84, h: 1.12, frame: 0.05 },
  table: { center: [4.5, 10.5, -0.03], size: [0.6, 1.1] },
};

export const SPOTS = [
  { id: 'simorgh', label: 'Look up at the Simorgh', at: [0.85, 4.15, 3.0], r: 0.6 },
  { id: 'persia_shelf', label: 'Look at the shelf', at: [10.75, 0.95, 0], r: 0.5 },
  { id: 'miniature', label: 'Look at the painting', at: [5.1, 0.85, 3.0], r: 0.55 },
];
export const FEAST_SPOTS = {
  haftsin: { id: 'haftsin', label: 'Look at the haft-sin', at: [3.85, 10.5, -0.45], r: 0.5 },
  yalda: { id: 'yalda', label: 'Look at the Yalda table', at: [3.85, 10.5, -0.45], r: 0.5 },
};

// What each piece says when pressed; the shelf answers for its two pieces in turn.
export const SAYS = {
  simorgh: ['The Simorgh, the wise bird of the Shahnameh. She found the baby Zal left alone on Mount Alborz, raised him in her nest, and sent him home with one of her feathers: burn it, and she would come.'],
  persia_shelf: [
    'A replica of the Cyrus Cylinder: a clay cylinder from 539 BCE recording Cyrus the Great\'s taking of Babylon and the return of deported peoples to their homes, often described as an early charter of rights. The original is in the British Museum.',
    'A bookend after a column top from the Apadana at Persepolis, the great hall begun by Darius the Great: two bulls back to back, and between them the saddle that held the roof beams.',
  ],
  miniature: ['Rostam and the White Div, the last of the Seven Labours: Rostam finds the giant asleep in his cave and wakes him rather than strike a sleeping foe. An original painting in the style of a Persian miniature.'],
  haftsin: ['The haft-sin for Nowruz, the Persian new year at the spring equinox: seven things whose names begin with the letter sin (س). Sabzeh, sprouts; samanu, a wheat pudding; senjed, oleaster; sir, garlic; sib, apples; somagh, sumac; serkeh, vinegar. With a mirror, goldfish and candles.'],
  yalda: ['Shab-e Yalda, the longest night of the year: up late with family over pomegranates and watermelon, a book of Hafez opened at random for a fortune, waiting for the light to come back.'],
};

// Days are Vancouver's, like the rest of the house; `force` is the ?holiday= preview.
const spanOf = (id, y) => EVENTS.find(e => e.id === id).span(y);
export const FEASTS = {
  haftsin: { holidays: ['suri', 'nowruz', 'sizdah'], from: y => spanOf('suri', y)[0], to: y => spanOf('sizdah', y)[1] },
  yalda: { holidays: ['yalda'], from: y => spanOf('yalda', y)[0], to: y => spanOf('yalda', y)[1] },
};
export function feastAt(date, force = null) {
  if (force) return Object.keys(FEASTS).find(k => FEASTS[k].holidays.includes(force)) || null;
  const v = vanTime(date), t = Date.UTC(v.y, v.m - 1, v.d);
  for (const [id, f] of Object.entries(FEASTS)) for (const y of [v.y, v.y - 1]) if (t >= f.from(y) && t <= f.to(y)) return id;
  return null;
}

// Must run before the collision, physics and walk grid are built from meta, so the shelf is solid in all three.
export function addPersia(meta, feast = null) {
  const { min, max } = PLACES.shelf, f = Object.hasOwn(FEAST_SPOTS, feast ?? '') ? feast : null;
  const collider = { name: 'persia_shelf', min: [...min], max: [...max], kind: 'solid' };
  const spots = [...SPOTS, ...(f ? [FEAST_SPOTS[f]] : [])].map(s => ({ ...s, at: [...s.at] }));
  (meta.colliders ||= []).push(collider);
  (meta.interact ||= []).push(...spots);
  return { collider, spots, feast: f };
}

// Pressing E on a piece: its next line, or null for anything that is not one of these.
export function makeSayer() {
  const turn = {};
  return id => {
    const lines = Object.hasOwn(SAYS, id) ? SAYS[id] : null;
    if (!lines) return null;
    const i = turn[id] || 0;
    turn[id] = (i + 1) % lines.length;
    return lines[i];
  };
}

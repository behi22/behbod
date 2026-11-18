// The Shahnameh and ancient Persia in the house: where each piece stands and what it says when pressed. Blender axes
// (x east, y north, z up), metres.

// The Simorgh in paper over the stairs, on the west wall above the project frames; the shelf in the library's
// south-east corner, between the bookcase and the partition; the painting on the mezzanine's back wall over the
// Shahnameh on its side table.
export const PLACES = {
  simorgh: { wall: 0.02, u: [4.75, 9.0], z: [3.85, 6.1] },
  shelf: { min: [10.44, 0.0, 0], max: [11.06, 0.34, 1.86] },
  miniature: { center: [5.1, 0.0, 4.55], w: 0.84, h: 1.12, frame: 0.05 },
};

export const SPOTS = [
  { id: 'simorgh', label: 'Look up at the Simorgh', at: [0.85, 4.15, 3.0], r: 0.6 },
  { id: 'persia_shelf', label: 'Look at the shelf', at: [10.75, 0.95, 0], r: 0.5 },
  { id: 'miniature', label: 'Look at the painting', at: [5.1, 0.85, 3.0], r: 0.55 },
];
// What each piece says when pressed; the shelf answers for its two pieces in turn.
export const SAYS = {
  simorgh: ['The Simorgh, the wise bird of the Shahnameh. She found the baby Zal left alone on Mount Alborz, raised him in her nest, and sent him home with one of her feathers: burn it, and she would come.'],
  persia_shelf: [
    'A replica of the Cyrus Cylinder: a clay cylinder from 539 BCE recording Cyrus the Great\'s taking of Babylon and the return of deported peoples to their homes, often described as an early charter of rights. The original is in the British Museum.',
    'A bookend after a column top from the Apadana at Persepolis, the great hall begun by Darius the Great: two bulls back to back, and between them the saddle that held the roof beams.',
  ],
  miniature: ['Rostam and the White Div, the last of the Seven Labours: Rostam finds the giant asleep in his cave and wakes him rather than strike a sleeping foe. An original painting in the style of a Persian miniature.'],
};

// The shelf stands on the floor, so it joins the colliders before the walls, the physics and the walk grid are built;
// the E spots join the house's own. Returns what was added.
export function addPersia(meta) {
  const { min, max } = PLACES.shelf;
  const collider = { name: 'persia_shelf', min: [...min], max: [...max], kind: 'solid' };
  const spots = SPOTS.map(s => ({ ...s, at: [...s.at] }));
  (meta.colliders ||= []).push(collider);
  (meta.interact ||= []).push(...spots);
  return { collider, spots };
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

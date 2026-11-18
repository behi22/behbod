// The Shahnameh and ancient Persia in the house: where each piece stands and what it says when pressed. Blender axes
// (x east, y north, z up), metres.

// The Simorgh in paper over the stairs, on the west wall above the project frames.
export const PLACES = {
  simorgh: { wall: 0.02, u: [4.75, 9.0], z: [3.85, 6.1] },
};

export const SPOTS = [
  { id: 'simorgh', label: 'Look up at the Simorgh', at: [0.85, 4.15, 3.0], r: 0.6 },
];
// What each piece says when pressed.
export const SAYS = {
  simorgh: ['The Simorgh, the wise bird of the Shahnameh. She found the baby Zal left alone on Mount Alborz, raised him in her nest, and sent him home with one of her feathers: burn it, and she would come.'],
};

// The E spots join the house's own. Returns what was added.
export function addPersia(meta) {
  const spots = SPOTS.map(s => ({ ...s, at: [...s.at] }));
  (meta.interact ||= []).push(...spots);
  return { spots };
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

// The closed laptop on the studio's return (blender/zones/studio_props.py LAPTOP): its lid, and where the page lays its
// eight stickers and its logo on it. Lid axes: x to the right and y away from me, standing at the laptop's front.
export const LID = { w: 0.31, d: 0.22, edge: 0.0025 };
// The sheet the stickers are drawn on, 4 mm in from the lid's edges, and how far any sticker keeps from them.
export const SHEET = { w: LID.w - 0.008, d: LID.d - 0.008, keep: 0.008 };
// Each sticker: its middle, the radius it fits in, its turn (degrees, clockwise) and how far its die-cut edge reaches
// from its middle (millimetres, white border included; laptopstickers.js draws it).
export const STICKERS = [
  { id: 'pomegranate', at: [-0.105, 0.06], r: 0.032, turn: -12, reach: 31.2 },
  { id: 'bh22', at: [-0.02, 0.07], r: 0.03, turn: 8, reach: 29.6 },
  { id: 'vancouver', at: [0.085, 0.06], r: 0.042, turn: -6, reach: 41.2 },
  { id: 'soccer', at: [-0.115, -0.005], r: 0.024, turn: 0, reach: 23.2 },
  { id: 'starball', at: [0.12, -0.005], r: 0.024, turn: 15, reach: 23.2 },
  { id: 'heart', at: [0, -0.068], r: 0.022, turn: -10, reach: 22 },
  { id: 'controller', at: [-0.085, -0.065], r: 0.035, turn: 10, reach: 34.8 },
  { id: 'pressf', at: [0.08, -0.064], r: 0.037, turn: -4, reach: 36.4 },
];
// My own mark in the lid's middle, etched rather than stuck on.
export const LOGO = { at: [0, 0], r: 0.03, text: 'behi22' };

// Where a point of the lid lands on the sheet's picture, w by h pixels (its top edge is the lid's far edge).
export const onSheet = ([x, y], w, h) => [(x / SHEET.w + 0.5) * w, (0.5 - y / SHEET.d) * h];

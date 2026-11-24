// Where the residents' new routines happen and the small rules inside them. Places are Blender axes (x east, y north,
// z up), in metres; "reach" spots are ones the 0.2 m walk grid can get to, and the last bit is a short straight walk.
import { throughGlass } from './sunbeams.js';

// The cat tree stands in a pocket between the console shelf, the egg chair and the wall that the walk grid (sized for
// me) cannot enter. Pishi walks to `reach`, then straight through the gap beside the shelf to the tree's foot.
export const TREE = { reach: [1.1, 12.4, 0], gap: [1.05, 13.05, 0], foot: [1.12, 13.62, 0] };
export const inPocket = ([x, y, z]) => x < 1.32 && y > 12.75 && y < 13.95 && z < 0.3;

// The piano: Pishi hops onto the bench from the east, onto the keys, walks along them and hops down to the west.
export const PIANO = { reach: [19.3, 10.0, 0.3], bench: [18.62, 10.03, 0.87], benchW: [18.08, 10.03, 0.87], keys: { x0: 17.67, x1: 19.03, y: 10.42, z: 1.065 }, off: [17.5, 9.6, 0.15] };
// The seats she steals: where she hops up from and where she curls up.
export const SEATS = {
  chair: { reach: [20.5, 2.0, 0.45], seat: [20.47, 1.2, 1.0] },
  bench: { reach: [19.3, 10.0, 0.3], seat: [18.35, 10.03, 0.87] },
};

// The pen lying on the desk by the keyboard that she knocks off, where it lands between the chair and the desk, and where
// BH-22 rolls in from (on the walk grid) to pick it up and put it back.
export const PEN = { home: [21.24, 1.48, 1.213], fall: [20.93, 1.62, 0.45], reach: [20.7, 2.4, 0.45], pick: [20.93, 1.86, 0.45] };
// Her pounce on the mouse droid mostly misses.
export const STALK_HIT = 0.2;
// One nap in three Jessi sleeps on her back.
export const BACK_SLEEP = 0.3;

// The plants BH-22 waters: each pot's middle and a spot beside it on the walk grid.
export const PLANTS = [
  { pot: [11.85, 0.5, 0.45], stand: [11.9, 1.2, 0.45] },
  { pot: [17.0, 0.45, 0.45], stand: [16.3, 0.4, 0.45] },
  { pot: [9.6, 14.45, 0], stand: [8.9, 14.4, 0] },
  { pot: [15.9, 13.7, 0], stand: [15.9, 13.0, 0] },
  { pot: [21.45, 11.45, 0], stand: [20.7, 11.4, 0] },
  { pot: [4.6, 3.75, 0], stand: [3.9, 3.8, 0] },
];
export const SCOPE = { stand: [7.5, 15.8, 0], look: [7.5, 16.7, 1.2] };
// Jessi's rope toy lives by her bed; she howls along from the foot of the piano's dais.
export const TOY = [12.9, 13.2, 0], HOWL = [17.1, 9.4, 0];
// The tea bar: within this far of the samovar's spot, I am at the tea bar.
export const TEA = { at: [13.9, 8.85, 0], r: 2.2 };
export const atTea = ([x, y]) => Math.hypot(x - TEA.at[0], y - TEA.at[1]) < TEA.r;
// Jessi brings her toy once I have stood still this long; she wags hardest when I come back after this long away.
export const STILL = 20, AWAY = 60;

// The floor by the glass wall where Pishi may nap in a sunbeam, nearest the glass first.
export const SUN_SPOTS = [[5.4, 13.9, 0], [6.5, 14.0, 0], [4.5, 14.0, 0], [7.9, 14.0, 0], [3.7, 13.6, 0], [8.9, 14.0, 0]];
// The first spot the morning sun `s` (three's axes, toward the sun) reaches straight through the glass wall's panes,
// or null.
export function sunSpot(s, spots = SUN_SPOTS) {
  if (!s || !(s[1] > 0.02) || !(s[2] < 0)) return null;
  for (const p of spots) {
    const [gx, gy] = throughGlass(s, [p[0], p[2], -p[1]]);
    if (gx > 0.4 && gx < 11 && gy > 0.15 && gy < 6.2) return p;
  }
  return null;
}

// The white keys of an 88-key piano (A0 to C8), as MIDI notes, left to right.
const BLACK = new Set([1, 3, 6, 8, 10]);
export const WHITES = Array.from({ length: 88 }, (_, i) => 21 + i).filter(m => !BLACK.has(m % 12));
// The white key under a paw at `x` along the keys.
export function keyUnder(x, keys = PIANO.keys) {
  const k = Math.floor((x - keys.x0) / (keys.x1 - keys.x0) * WHITES.length);
  return WHITES[Math.min(WHITES.length - 1, Math.max(0, k))];
}
// A paw comes down: the key under it, and now and then the one beside it too, a back paw landing.
export function pawNotes(x, rand, keys = PIANO.keys) {
  const m = keyUnder(x, keys), i = WHITES.indexOf(m);
  return rand < 0.35 && i > 0 ? [WHITES[i - 1], m] : [m];
}

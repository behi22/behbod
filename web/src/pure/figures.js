// The three figures on the desk shelf (a tiny Pishi, the BEHI 22 bobblehead, a tiny Jessi), where the room's three
// plain peg figures stood. The pegs are part of the studio's baked model (blender/zones/studio.py, the shelf above the
// desk: x 15.88, y 2.55, 2.7 and 2.85 there, moved onto the east wall by DESK_AT), so the page hides their triangles.

// Each peg in three's axes: its middle across the floor, and the shelf top it stands on.
export const SHELF_TOP = 2.965, PEG_X = 21.88, PEG_Z = [-1.55, -1.7, -1.85];
export const FIGURES = ['pishi', 'behi', 'jessi'];
// A box round each peg, a little bigger than it (a 2.8 cm body under a 2.8 cm head, 17.3 cm tall).
export const PEG_BOXES = PEG_Z.map(z => ({ min: [PEG_X - 0.035, SHELF_TOP - 0.004, z - 0.035], max: [PEG_X + 0.035, SHELF_TOP + 0.2, z + 0.035] }));

const inBox = (p, i, b) => p[i] >= b.min[0] && p[i] <= b.max[0] && p[i + 1] >= b.min[1] && p[i + 1] <= b.max[1] && p[i + 2] >= b.min[2] && p[i + 2] <= b.max[2];

// The triangles of an indexed mesh (`index`, flat `position` x y z) that lie wholly inside any of `boxes`, as the
// offsets of their first index. A triangle with any corner outside is left alone, so nothing round the pegs goes. A
// first corner outside the box round them all rules a triangle out at once (nearly every one of the model's). Only the
// triangles from index offset `from` up to `to` are looked at, added to `out`, so a long search can be done in parts.
export function trianglesInside(index, position, boxes, from = 0, to = index.length, out = []) {
  if (!boxes.length) return out;
  const all = { min: [0, 1, 2].map(i => Math.min(...boxes.map(b => b.min[i]))), max: [0, 1, 2].map(i => Math.max(...boxes.map(b => b.max[i]))) };
  for (let t = from - (from % 3); t + 2 < Math.min(to, index.length); t += 3) {
    if (!inBox(position, index[t] * 3, all)) continue;
    for (const b of boxes) if (inBox(position, index[t] * 3, b) && inBox(position, index[t + 1] * 3, b) && inBox(position, index[t + 2] * 3, b)) { out.push(t); break; }
  }
  return out;
}

// Folds those triangles to nothing (all three corners on its first), and says which run of the index changed.
export function foldTriangles(index, starts) {
  if (!starts.length) return null;
  for (const t of starts) { index[t + 1] = index[t]; index[t + 2] = index[t]; }
  return { start: starts[0], count: starts[starts.length - 1] + 3 - starts[0] };
}

// The bobblehead's head on its spring: two tilts (forward and sideways, radians) that ring down. A nudge sets it going;
// `stepBob` returns false once it has settled.
const W = 2 * Math.PI * 3.1, DAMP = 0.075, SUB = 1 / 240, MAX = 0.55;
export const newBob = () => ({ a: [0, 0], v: [0, 0], on: false });
export function nudgeBob(b, along, across) {
  b.v[0] += along; b.v[1] += across; b.on = true;
}
export function stepBob(b, dt) {
  if (!b.on) return false;
  for (let left = Math.min(dt, 0.1); left > 1e-9; left -= SUB) {
    const h = Math.min(SUB, left);
    for (let i = 0; i < 2; i++) {
      b.v[i] += (-W * W * b.a[i] - 2 * DAMP * W * b.v[i]) * h;
      b.a[i] = Math.max(-MAX, Math.min(MAX, b.a[i] + b.v[i] * h));
    }
  }
  if (Math.abs(b.a[0]) + Math.abs(b.a[1]) < 0.002 && Math.abs(b.v[0]) + Math.abs(b.v[1]) < 0.02) { b.a = [0, 0]; b.v = [0, 0]; b.on = false; }
  return b.on;
}

// "BEHI 22" for the bobblehead's base, three by five squares a letter: each row is three bits, the left one first.
const GLYPHS = { B: [6, 5, 6, 5, 6], E: [7, 4, 6, 4, 7], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], 2: [7, 1, 7, 4, 7], ' ': [0, 0, 0, 0, 0] };
// The lit squares of `text` as [column, row] from the top left, a blank column between letters, and its size.
export function pixelText(text) {
  const cells = [];
  [...text].forEach((ch, k) => (GLYPHS[ch] || GLYPHS[' ']).forEach((row, r) => { for (let c = 0; c < 3; c++) if (row & (4 >> c)) cells.push([k * 4 + c, r]); }));
  return { cells, cols: text.length * 4 - 1, rows: 5 };
}

// The seated view of the main monitor: how far back the eye sits, how far down it looks and how wide the lens is, by
// the view's shape. Three's axes from the monitor's middle: x toward the monitor, y up, z to my right.

// The monitor round its screen (blender/zones/studio.py): a 1.4 cm bezel above and below, 1.25% more curve at each
// side, and the light bar on top, 4.1 cm over the screen's top edge and 4.75 cm in front of it.
export const FRAME = { bezel: 0.014, side: 1.025, bar: { up: 0.041, out: 0.0475, half: 0.23 } };
// The bezel's top sits this far down the view, so the light bar and a strip of the screen above stay in sight.
export const TOP = 0.06;
// A wide view: the monitor takes this share of its width, unless that makes it taller than MAX_H of its height, which
// would leave no room for the keyboard below.
export const WIDE = { fov: 42, width: 0.82, maxH: 0.66 };
// An upright view: the monitor's full height, panned across its width as before.
export const TALL = { fov: 58, back: 1.0 };
// How far back the eye may sit: no further than my eyes in the chair, no nearer than a lean in.
export const BACK = { min: 0.8, max: 1.2 };
// The eye sits a centimetre over the monitor's middle, about where my eyes are.
export const EYE_UP = 0.01;

const rad = d => d * Math.PI / 180;

// Points round the monitor's frame, from its middle: along its top and bottom edges, and the light bar's top corners.
export function framePoints(s) {
  const half = s.w / 2 / s.r * FRAME.side, y = s.h / 2 + FRAME.bezel, out = { top: [], bottom: [], bar: [] };
  for (let i = 0; i <= 8; i++) {
    const a = -half + 2 * half * i / 8, x = -s.r * (1 - Math.cos(a)), z = s.r * Math.sin(a);
    out.top.push([x, y, z]); out.bottom.push([x, -y, z]);
  }
  for (const z of [-FRAME.bar.half, FRAME.bar.half]) out.bar.push([-FRAME.bar.out, s.h / 2 + FRAME.bar.up, z]);
  return out;
}

// A point on the view: x and y from 0 to 1 across and down it (0, 0 the top left), and whether it is in front.
export function onView(p, v, aspect) {
  const rx = p[0] + v.back, ry = p[1] - v.up, rz = p[2] - (v.pan || 0), c = Math.cos(v.pitch), s = Math.sin(v.pitch);
  const depth = rx * c - ry * s, up = rx * s + ry * c, ty = Math.tan(rad(v.fov) / 2), tx = ty * aspect;
  return { x: 0.5 + rz / (depth * tx) / 2, y: 0.5 - up / (depth * ty) / 2, front: depth > 0 };
}

// The frame's box on the view (0 to 1 each way), and the light bar's top.
export function frameBox(s, v, aspect) {
  const P = framePoints(s), box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, bar: Infinity };
  for (const p of [...P.top, ...P.bottom]) {
    const q = onView(p, v, aspect);
    box.x0 = Math.min(box.x0, q.x); box.x1 = Math.max(box.x1, q.x); box.y0 = Math.min(box.y0, q.y); box.y1 = Math.max(box.y1, q.y);
  }
  for (const p of P.bar) box.bar = Math.min(box.bar, onView(p, v, aspect).y);
  return box;
}

// Halving between lo and hi for the x where f(x) crosses 0 (f rising).
function solve(f, lo, hi) {
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
// The pitch that puts the bezel's top TOP down the view.
const pitchFor = (s, v, aspect) => solve(p => TOP - frameBox(s, { ...v, pitch: p }, aspect).y0, -0.2, 0.6);

// { fov (degrees), back (metres), up, pitch (radians, down), range (metres of pan each way) }.
export function seatView(s, aspect) {
  if (aspect < 1.2) {
    let v = { fov: TALL.fov, back: TALL.back, up: EYE_UP, pitch: 0 };
    v.pitch = pitchFor(s, v, aspect);
    // How far the eye pans each way to bring either end of the frame into view, with 2 cm to spare.
    const half = s.w / 2 / s.r * FRAME.side, chord = s.r * Math.sin(half), sag = s.r * (1 - Math.cos(half));
    const tx = Math.tan(rad(v.fov) / 2) * aspect;
    return { ...v, range: Math.max(0, chord - tx * (v.back - sag) * Math.cos(v.pitch) + 0.02) };
  }
  // How much the frame overfills what is asked of it: above 1 it is too big.
  const over = v => { const b = frameBox(s, v, aspect); return Math.max((b.x1 - b.x0) / WIDE.width, (b.y1 - b.y0) / WIDE.maxH); };
  let v = { fov: WIDE.fov, back: 1, up: EYE_UP, pitch: 0.1 };
  for (let k = 0; k < 3; k++) {
    v.back = solve(d => 1 - over({ ...v, back: d }), 0.3, 4);
    if (v.back > BACK.max) { v.back = BACK.max; v.fov = solve(f => 1 - over({ ...v, fov: f }), 10, 100); }
    else if (v.back < BACK.min) { v.back = BACK.min; v.fov = solve(f => 1 - over({ ...v, fov: f }), 10, 100); }
    else v.fov = WIDE.fov;
    v.pitch = pitchFor(s, v, aspect);
  }
  return { ...v, range: 0 };
}

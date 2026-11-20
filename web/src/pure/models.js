// Each model's best side faces +z, where the visitor stands.
import {
  sphere, ellipsoid, box, rod, cylinder, torus, polygon, lathe, extrude, union, blend, cut, carve, meet, inflate,
  move, scale, mirrorX, turn, around, onBed,
} from './sdf.js';

const { PI, sin, cos, abs, max, min, sqrt, atan2, hypot } = Math;
const B = (w, h, d, y0 = 0) => [-w, y0, -d, w, h, d];

// The old ring shapes, kept for the vase and the spiral.
function ringR(edge, sides, depth, a) {
  if (edge === 'round') return 1;
  const u = (((a * sides) / (2 * PI)) % 1 + 1) % 1;
  if (edge === 'poly') return cos(PI / sides) / cos((u - 0.5) * ((PI * 2) / sides));
  if (edge === 'star') return 1 - depth * (1 - abs(2 * u - 1));
  if (edge === 'gear') return 0.5 * (1 + (1 - depth)) + 0.5 * depth * Math.tanh(cos(u * 2 * PI) * 6);
  if (edge === 'petal') return 1 - depth * sin(PI * u) ** 2;
  return 1;
}
function ringShape({ edge = 'round', sides = 6, depth = 0, twist = 0, bulge = 0, taper = 0, lip = 0, height = 12, radius = 5, hollow = 0 }) {
  const prof = t => (1 + bulge * sin(PI * t)) * (1 - taper * t) * (1 + lip * max(0, (t - 0.8) / 0.2) ** 2);
  const side = (x, y, z) => {
    const t = min(1, max(0, y / height)), a = atan2(z, x) - twist * PI * t;
    return (hypot(x, z) - radius * prof(t) * ringR(edge, sides, depth, a)) * 0.6;
  };
  let f = (x, y, z) => max(side(x, y, z), -y, y - height);
  if (hollow) { const outer = f; f = (x, y, z) => max(outer(x, y, z), -(max(side(x, y, z) + hollow, 1.2 - y))); }
  const w = radius * 1.9 * (1 + max(0, bulge)) * (1 + lip);
  return { f, bounds: B(w, height + 0.5, w), lip: 2.2 };
}

// ---------- the chess pieces ----------
function knight() {
  const base = lathe([[4.3, 0], [4.3, 0.7], [3.9, 1.2], [3.3, 1.6], [3.3, 2.2]]);
  const profile = polygon([
    [-2.7, 1.8], [-2.8, 4.2], [-2.6, 6.6], [-2.0, 8.6], [-1.1, 10.2], [0.0, 11.0], [1.0, 10.7], [2.0, 9.9], [3.1, 8.8],
    [4.1, 7.8], [4.7, 7.0], [4.6, 6.2], [3.8, 5.9], [2.8, 6.0], [1.9, 6.4], [1.2, 5.9], [1.0, 4.9], [1.6, 3.6], [2.6, 2.6], [2.9, 1.8],
  ]);
  const head = inflate(extrude(profile, 1.05, 0, 'z'), 0.55);
  // The horse faces +x, so a visitor sees it side on.
  const ears = mirrorX(rod([0.55, 10.4, 0], [0.9, 12.3, 0], 0.55, 0.2));
  const earsAt = (x, y, z) => ears(z, y, x + 0.25);
  const maneP = polygon([[-3.5, 2.6], [-3.65, 4.4], [-3.45, 6.8], [-2.85, 8.9], [-1.95, 10.6], [-0.7, 11.75], [0.2, 11.45], [-1.1, 10.2], [-2.0, 8.6], [-2.55, 6.6], [-2.75, 4.2], [-2.65, 2.6]]);
  const maneBase = inflate(extrude(maneP, 0.3, 0, 'z'), 0.32);
  const mane = carve(0.12, maneBase, (x, y, z) => max(abs(((x * 0.55 + y * 0.84) % 0.95 + 0.95) % 0.95 - 0.475) - 0.09, -(maneBase(x, y, z) + 0.05) - 0.1, x + y * 0.1 - 1.0 > 0 ? 9 : -9));
  let f = blend(0.6, base, head, earsAt, mane);
  f = cut(f, sphere(0.42, [2.5, 9.1, 1.55]), sphere(0.42, [2.5, 9.1, -1.55]), sphere(0.3, [4.55, 7.0, 0.75]), sphere(0.3, [4.55, 7.0, -0.75]));
  f = carve(0.3, f, rod([3.0, 6.2, -2], [3.0, 6.2, 2], 0.18));
  return { f: onBed(f), bounds: [-4.6, 0, -4.6, 5.6, 12.8, 4.6], lip: 1.8 };
}
function rook() {
  const body = lathe([[4.1, 0], [4.1, 0.8], [3.6, 1.3], [3.3, 1.8], [2.7, 2.4], [2.45, 6.5], [2.9, 7.7], [3.5, 8.2], [3.5, 10.6]]);
  const slot = box([0.55, 1.2, 4], [0, 10.6, 0]);
  const f = carve(0.25, cut(body, cylinder(2.3, 9.4, 11, [0, 0])), around(slot, 6));
  return { f: onBed(blend(0.3, f, torus(2.55, 0.28, [0, 6.6, 0]), torus(3.0, 0.3, [0, 1.85, 0]))), bounds: B(4.4, 11, 4.4), lip: 1.6 };
}
function king() {
  const body = lathe([[4.1, 0], [4.1, 0.8], [3.6, 1.3], [3.1, 1.8], [2.3, 2.6], [1.8, 7.5], [2.9, 8.1], [1.9, 8.6], [2.6, 10.4], [1.6, 11.6], [0.9, 11.8]]);
  const cross = union(box([0.42, 1.5, 0.42], [0, 13.2, 0], 0.15), box([1.25, 0.42, 0.42], [0, 13.4, 0], 0.15));
  return { f: onBed(blend(0.35, body, cross, torus(1.95, 0.3, [0, 7.7, 0]), torus(3.0, 0.3, [0, 1.85, 0]))), bounds: B(4.4, 15, 4.4), lip: 1.6 };
}

// ---------- things that go ----------
function rocket(o) {
  const n = o.sides;
  const body = lathe([[1.2, 0.6], [1.5, 1.6], [2.3, 2.4], [2.4, 8.5], [2.2, 10.4], [1.6, 12.2], [0.8, 13.5], [0.15, 14.3]]);
  const bell = lathe([[1.6, 0], [1.25, 0.9], [1.1, 1.4], [1.4, 2.0]]);
  const finShape = polygon([[1.6, 0], [5.2, 0], [5.0, 1.0], [2.2, 5.6], [1.6, 6.0]]);
  const fin = inflate(extrude(finShape, 0.22, 0, 'x'), 0.12);
  const fins = around((x, y, z) => fin(x, y, z), n, PI / n);
  const window = torus(0.85, 0.22, [0, 8.6, 2.3], 'z');
  let f = blend(0.35, body, bell, fins, window, torus(2.42, 0.16, [0, 5.0, 0]), torus(2.35, 0.14, [0, 10.6, 0]));
  f = cut(f, ellipsoid([0.7, 0.7, 0.45], [0, 8.6, 2.5]));
  return { f: onBed(f), bounds: B(5.7, 14.6, 5.7), lip: 1.7 };
}
function car() {
  const side = polygon([[-6.2, 1.2], [-6.4, 2.8], [-5.8, 3.9], [-2.6, 4.2], [-1.6, 6.3], [2.0, 6.3], [3.4, 4.3], [6.0, 3.9], [6.5, 2.7], [6.3, 1.2]]);
  const shell = inflate(extrude(side, 2.3, 0, 'z'), 0.5);
  const arch = (x, y, z) => min(hypot(x - 3.8, y - 1.9), hypot(x + 3.8, y - 1.9)) - 2.05;
  const body = carve(0.3, shell, (x, y, z) => max(arch(x, y, z), 2.0 - abs(z)));
  const wheel = (x, y, z) => {
    const r = min(hypot(x - 3.8, y - 1.85), hypot(x + 3.8, y - 1.85)), w = abs(abs(z) - 2.15) - 0.75;
    return min(max(r - 1.8, w), 0) + hypot(max(r - 1.8, 0), max(w, 0)) - 0.15;
  };
  const hub = (x, y, z) => max(min(hypot(x - 3.8, y - 1.85), hypot(x + 3.8, y - 1.85)) - 0.75, abs(z) - 3.05);
  let f = union(body, wheel, hub);
  const win = polygon([[-1.3, 4.4], [-0.8, 5.9], [1.7, 5.9], [2.8, 4.4]]);
  f = carve(0.15, f, extrude((u, v) => max(win(u, v), -(abs(u - 0.45) - 0.18)), 3.2, 0, 'z'));
  f = cut(f, ellipsoid([0.35, 0.45, 0.9], [6.7, 3.3, 1.8]), ellipsoid([0.35, 0.45, 0.9], [6.7, 3.3, -1.8]));
  f = blend(0.2, f, ellipsoid([0.3, 0.35, 0.7], [-6.6, 3.2, 1.8]), ellipsoid([0.3, 0.35, 0.7], [-6.6, 3.2, -1.8]));
  return { f: onBed(move(f, [0, -0.05, 0])), bounds: [-7.4, 0, -3.6, 7.4, 7, 3.6], lip: 1.6 };
}
function boat() {
  const plan = (x, z) => hypot(x / 6.4, z / 2.9) - 1;
  const hull = (x, y, z) => {
    const t = min(1, max(0, y / 3.2)), k = 0.55 + 0.45 * sqrt(t), bow = x > 2 ? (x - 2) * 0.35 * (1 - t) : 0;
    return max(plan((x + bow) / k, z / k) * 2.6, -y, y - 3.2);
  };
  const deck = cut(hull, (x, y, z) => max(plan(x / 0.86, z / 0.8) * 2.6, 2.6 - y));
  const cabin = box([2.6, 1.3, 1.9], [-0.6, 4.3, 0], 0.3), house = box([1.5, 1.2, 1.6], [-0.9, 6.6, 0], 0.25);
  const roof = box([1.85, 0.18, 1.9], [-0.9, 7.85, 0], 0.1);
  const funnel = rod([-3.0, 4.6, 0], [-3.3, 8.6, 0], 0.75, 0.65);
  let f = blend(0.25, deck, cabin, house, roof, funnel, torus(0.6, 0.25, [5.1, 2.9, 2.55], 'x'));
  for (const x of [-1.9, -0.5, 0.9]) f = cut(f, box([0.45, 0.42, 3], [x, 4.6, 0], 0.1));
  f = cut(f, box([0.42, 0.45, 3], [-1.35, 6.7, 0], 0.1), box([0.42, 0.45, 3], [-0.35, 6.7, 0], 0.1), cylinder(0.45, 7, 9, [-3.3, 0]));
  return { f: onBed(blend(0.2, f, torus(0.62, 0.18, [-3.3, 8.6, 0]))), bounds: [-7, 0, -3.6, 7, 9.7, 3.6], lip: 2.2 };
}
function sneaker() {
  const vol = blend(1.5, ellipsoid([3.5, 2.2, 2.05], [3.0, 1.7, 0]), ellipsoid([3.3, 3.4, 1.95], [-1.2, 2.5, 0]), ellipsoid([2.3, 3.8, 1.75], [-4.3, 3.0, 0]));
  const outline = polygon([[-6.2, 0.8], [-6.45, 3.4], [-6.05, 5.6], [-5.3, 6.3], [-4.2, 5.7], [-2.7, 5.8], [-1.6, 6.9], [-0.8, 6.6], [1.4, 4.9], [3.8, 3.8], [5.8, 2.9], [6.7, 1.8], [6.5, 0.8]]);
  const upper = carve(0.5, vol, (x, y) => -outline(x, y));
  const sole = (x, y, z) => { const d = vol(x, 1.4, z) - 0.22, e = abs(y - 0.8) - 0.8; return min(max(d, e), 0) + hypot(max(d, 0), max(e, 0)) - 0.12; };
  let f = blend(0.3, sole, upper);
  const g = f, shell = (x, y, z) => g(x, y, z) - 0.12, inner = (x, y, z) => -(g(x, y, z) + 0.16);
  f = carve(0.06, f, meet((x, y) => abs(y - 1.0) - 0.07, inner));
  const stripe = (x, y) => max(abs(y - 2.3 - 0.075 * (x + 5.4) ** 2) - 0.32, abs(x + 3.0) - 2.4);
  f = union(f, meet(stripe, shell));
  f = carve(0.06, f, meet((x, y) => max(abs(x - 3.0 - 0.35 * (y - 1.6)) - 0.08, 1.75 - y), inner));
  f = carve(0.35, f, ellipsoid([2.0, 1.4, 1.35], [-3.8, 6.55, 0]));
  f = blend(0.3, f, turn(ellipsoid([0.55, 1.2, 0.95], [-1.75, 5.7, 0]), 'z', 0.45, [-1.75, 5.7, 0]));
  for (let i = 0; i < 4; i++) { const x = 0.8 - i * 0.8, y = 4.55 + i * 0.5; f = blend(0.1, f, rod([x, y, -1.3], [x - 0.1, y + 0.05, 1.3], 0.2)); }
  f = blend(0.2, f, box([0.3, 0.9, 0.55], [-6.15, 6.2, 0], 0.25));
  return { f: onBed(f), bounds: [-7.4, 0, -2.8, 7.4, 7.6, 2.8], lip: 2 };
}

// ---------- characters ----------
// Pishi sits, the way a figurine of a cat is made; the house's Pishi walks.
function pishi() {
  const body = blend(1.2,
    ellipsoid([3.0, 3.9, 3.0], [0, 3.6, -0.4]),
    ellipsoid([2.1, 1.6, 2.6], [-1.7, 1.6, -0.9]), ellipsoid([2.1, 1.6, 2.6], [1.7, 1.6, -0.9]),
    ellipsoid([2.6, 2.4, 2.2], [0, 5.6, 0.6]),
  );
  const legs = mirrorX(blend(0.4, rod([0.9, 0.5, 1.9], [0.8, 5.0, 1.2], 0.62, 0.7), ellipsoid([0.75, 0.45, 0.95], [0.95, 0.45, 2.3])));
  const head = blend(0.7, ellipsoid([2.45, 2.15, 2.15], [0, 9.0, 0.7]), ellipsoid([1.15, 0.8, 0.9], [0, 8.3, 2.5]));
  const cone = rod([1.3, 10.1, 0], [1.95, 12.45, 0], 1.05, 0.12);
  const ear = mirrorX((x, y, z) => cone(x, y, (z - 0.45) * 1.9) / 1.9);
  const tail = (x, y, z) => {
    const a = atan2(z + 0.2, x), r = hypot(x, z + 0.2);
    if (a > 1.2 || a < -2.6) return min(hypot(x - 1.0, y - 0.5, z - 2.6) - 0.62, 9);
    return hypot(r - 3.3, y - 0.65) - 0.62;
  };
  let f = blend(0.6, body, legs, head, ear, tail);
  f = cut(f, ellipsoid([0.34, 0.42, 0.28], [-0.88, 9.3, 2.62]), ellipsoid([0.34, 0.42, 0.28], [0.88, 9.3, 2.62]));
  f = blend(0.2, f, sphere(0.5, [-0.42, 8.3, 2.95]), sphere(0.5, [0.42, 8.3, 2.95]));
  f = blend(0.1, f, sphere(0.3, [0, 8.78, 3.32]));
  return { f: onBed(f), bounds: [-4.2, 0, -4.2, 4.6, 13.4, 4.2], lip: 2.2 };
}
function bh22() {
  const body = box([5.0, 3.5, 4.0], [0, 9.6, 0], 1.9);
  let f = carve(0.3, body, box([3.9, 2.45, 1], [0, 9.6, 4.35], 0.9));
  f = union(f, mirrorX(box([0.45, 0.68, 0.5], [1.5, 9.4, 3.55], 0.2)));
  const plate = box([5.15, 0.16, 4.15], [0, 6.25, 0], 0.12);
  const legs = mirrorX(blend(0.35, rod([2.9, 6.4, -0.6], [3.9, 4.5, -0.4], 0.62, 0.55), sphere(0.72, [3.95, 4.4, -0.4]), rod([3.95, 4.4, -0.4], [4.0, 2.4, 0.1], 0.5)));
  const wheels = mirrorX((x, y, z) => { const r = hypot(y - 2.25, z - 0.1) - 2.25, w = abs(x - 4.05) - 0.62; return min(max(r, w), 0) + hypot(max(r, 0), max(w, 0)) - 0.15; });
  const hubAt = (x, y, z) => max(hypot(y - 2.25, z - 0.1) - 1.0, abs(abs(x) - 4.05) - 0.8);
  const antenna = blend(0.25, cylinder(0.75, 12.9, 13.4, [2.9, -0.6], 0.2), rod([2.9, 13.2, -0.6], [3.3, 16.2, -0.6], 0.2, 0.16), sphere(0.5, [3.32, 16.5, -0.6]));
  f = blend(0.3, f, plate, legs, antenna);
  return { f: onBed(union(f, wheels, hubAt)), bounds: [-5.6, 0, -4.5, 5.6, 17.2, 4.8], lip: 1.6 };
}
function duck() {
  const body = blend(1.4, ellipsoid([4.3, 2.9, 3.4], [-0.3, 3.0, 0]), ellipsoid([1.6, 1.4, 1.5], [-4.0, 4.6, 0]));
  const head = sphere(2.35, [2.0, 7.0, 0]);
  const beak = blend(0.3, ellipsoid([1.4, 0.42, 1.0], [4.45, 6.7, 0]), ellipsoid([1.2, 0.32, 0.85], [4.25, 6.25, 0]));
  const wing = mirrorX(ellipsoid([2.2, 1.3, 0.6], [-0.9, 3.6, 3.15]));
  let f = blend(0.8, body, head, wing);
  f = blend(0.25, f, beak);
  f = cut(f, sphere(0.42, [3.2, 7.7, 1.45]), sphere(0.42, [3.2, 7.7, -1.45]));
  return { f: onBed(move(f, [0, -0.3, 0])), bounds: [-6, 0, -4, 6.2, 9.4, 4], lip: 1.7 };
}
function penguin() {
  const body = ellipsoid([3.2, 5.0, 2.9], [0, 5.0, 0]);
  const head = sphere(2.3, [0, 10.0, 0.2]);
  const flippers = mirrorX(turn(ellipsoid([0.6, 2.9, 1.45], [2.95, 5.8, -0.1]), 'z', 0.22, [2.95, 7.8, 0]));
  const feet = mirrorX(ellipsoid([1.05, 0.5, 1.55], [1.15, 0.45, 2.3]));
  let f = blend(0.9, body, head);
  const g = f;
  const belly = meet(ellipsoid([2.5, 4.3, 3.4], [0, 4.6, 1.6]), (x, y, z) => g(x, y, z) - 0.2);
  f = blend(0.25, union(g, belly), flippers, feet);
  f = blend(0.15, f, rod([0, 9.75, 2.2], [0, 9.55, 3.7], 0.58, 0.12));
  f = cut(f, sphere(0.38, [0.85, 10.65, 2.0]), sphere(0.38, [-0.85, 10.65, 2.0]));
  return { f: onBed(f), bounds: [-4.6, 0, -3.4, 4.6, 12.6, 4.4], lip: 1.8 };
}
function ghost() {
  const skirt = (x, y, z) => max((hypot(x, z) - (3.4 + 0.07 * (8.2 - y))) * 0.95, y - 8.2, 0.55 * cos(atan2(z, x) * 6) + 0.35 - y);
  const body = blend(0.4, sphere(3.4, [0, 8.2, 0]), skirt);
  const arms = mirrorX(rod([3.2, 6.0, 0.4], [4.6, 7.4, 0.8], 0.75, 0.55));
  let f = blend(0.6, body, arms);
  f = cut(f, ellipsoid([0.55, 0.85, 0.6], [-1.05, 9.0, 3.3]), ellipsoid([0.55, 0.85, 0.6], [1.05, 9.0, 3.3]), ellipsoid([0.6, 0.75, 0.6], [0, 7.0, 3.5]));
  return { f: onBed(f), bounds: [-5.8, 0, -4.4, 5.8, 12.2, 4.6], lip: 1.8 };
}
function skull() {
  const cranium = ellipsoid([4.0, 4.0, 4.4], [0, 7.0, -0.6]);
  const face = blend(1.0, ellipsoid([3.4, 2.4, 2.4], [0, 4.6, 1.4]), mirrorX(ellipsoid([1.0, 0.8, 1.3], [2.5, 4.4, 1.9])));
  const jaw = box([2.3, 1.3, 1.4], [0, 1.9, 1.7], 0.9);
  let f = blend(1.1, cranium, face);
  f = blend(0.6, f, jaw);
  f = cut(f, mirrorX(ellipsoid([1.15, 1.0, 1.2], [1.45, 5.5, 3.6])));
  const nose = polygon([[0, 4.1], [-0.6, 3.25], [0.6, 3.25]]);
  f = cut(f, (x, y, z) => max(nose(x, y) - 0.12, abs(z - 3.6) - 1.5));
  f = carve(0.08, f, (x, y, z) => max(abs(y - 2.55) - 0.09, abs(x) - 2.0, -(z - 1.8)));
  f = carve(0.06, f, (x, y, z) => max(abs((((x + 0.3) % 0.6) + 0.6) % 0.6 - 0.3) - 0.06, abs(y - 2.55) - 0.75, abs(x) - 1.8, -(z - 2.0)));
  return { f: onBed(move(f, [0, -0.6, 0])), bounds: [-4.6, 0, -5.2, 4.6, 11, 4.6], lip: 1.8 };
}
function dino() {
  const body = blend(1.3,
    ellipsoid([3.0, 2.4, 2.1], [0, 5.6, 0]),
    rod([-2.2, 5.6, 0], [-6.6, 3.9, 0], 1.7, 0.35),
    rod([1.8, 6.6, 0], [3.0, 8.8, 0], 1.45, 1.1),
  );
  const head = blend(0.6, box([1.9, 1.15, 1.2], [4.3, 9.7, 0], 0.8), box([1.6, 0.4, 0.95], [4.6, 8.5, 0], 0.3));
  const legs = mirrorX(blend(0.5, ellipsoid([1.4, 1.9, 0.9], [-0.6, 4.0, 1.3]), rod([-0.2, 3.0, 1.4], [0.3, 0.8, 1.4], 0.65, 0.5), ellipsoid([1.3, 0.4, 0.7], [0.8, 0.4, 1.4])));
  const arms = mirrorX(rod([2.6, 6.8, 1.0], [3.5, 6.0, 1.3], 0.32, 0.25));
  const spikes = union(...Array.from({ length: 7 }, (_, i) => {
    const t = i / 6, px = 2.6 - t * 7.4, py = 8.4 - t * 3.9 - 0.9 * sin(t * PI) + 0.4;
    return rod([px, py - 0.6, 0], [px - 0.2, py + 0.55 - t * 0.3, 0], 0.5 - t * 0.2, 0.08);
  }));
  let f = blend(0.6, body, head, legs, arms);
  f = blend(0.2, f, spikes);
  f = cut(f, sphere(0.3, [4.6, 10.2, 1.1]), sphere(0.3, [4.6, 10.2, -1.1]), box([1.5, 0.1, 1.6], [5.0, 8.95, 0]));
  return { f: onBed(f), bounds: [-7.4, 0, -3.2, 6.6, 11.4, 3.2], lip: 2 };
}
function octopus() {
  const head = blend(0.8, ellipsoid([3.0, 3.7, 2.9], [0, 6.4, -0.3]), ellipsoid([2.5, 1.5, 2.5], [0, 3.1, 0]));
  const segs = [];
  for (let i = 1, px = 0, py = 3.2, pz = 1.2; i <= 7; i++) {
    const t = i / 7, a = t * 2.6, r = 1.2 + 3.6 * sin(min(PI / 2, a)), nx = 0.9 * sin(t * 3.5) * t, ny = max(0.4, 3.2 - 3.6 * t) + (t > 0.75 ? (t - 0.75) * 5 : 0), nz = r - (t > 0.75 ? (t - 0.75) * 6 : 0);
    segs.push(rod([px, py, pz], [nx, ny, nz], 0.95 - 0.1 * (i - 1), 0.95 - 0.1 * i));
    px = nx; py = ny; pz = nz;
  }
  const arm = union(...segs);
  let f = blend(0.6, head, around(arm, 8, PI / 8));
  f = cut(f, sphere(0.45, [0.95, 5.8, 2.55]), sphere(0.45, [-0.95, 5.8, 2.55]));
  f = blend(0.2, f, torus(0.62, 0.16, [0.95, 5.8, 2.45], 'z'), torus(0.62, 0.16, [-0.95, 5.8, 2.45], 'z'));
  return { f: onBed(f), bounds: B(6.4, 10.6, 6.4), lip: 2.2 };
}

// ---------- things to keep ----------
function controller() {
  const shape = blend(1.4,
    box([3.4, 1.6, 1.25], [0, 0, 0], 1.1),
    turn(ellipsoid([1.6, 2.4, 1.45], [-3.7, -1.5, -0.1]), 'z', -0.45, [-3.7, -1.5, 0]),
    turn(ellipsoid([1.6, 2.4, 1.45], [3.7, -1.5, -0.1]), 'z', 0.45, [3.7, -1.5, 0]),
  );
  const dpad = union(box([0.95, 0.32, 0.35], [-3.3, 0.4, 1.3], 0.12), box([0.32, 0.95, 0.35], [-3.3, 0.4, 1.3], 0.12));
  const buttons = union(...[[3.3, 1.2], [3.3, -0.4], [2.5, 0.4], [4.1, 0.4]].map(([x, y]) => sphere(0.42, [x, y, 1.2])));
  const sticks = mirrorX(blend(0.25, rod([1.45, -1.05, 0.6], [1.45, -1.05, 1.45], 0.85), rod([1.45, -1.05, 1.45], [1.45, -1.05, 1.9], 0.6)));
  let f = blend(0.25, shape, dpad, buttons);
  f = union(f, sticks);
  f = blend(0.15, f, mirrorX(box([0.35, 0.18, 0.12], [0.55, 0.6, 1.33], 0.06)));
  f = blend(0.4, f, mirrorX(box([1.3, 0.35, 0.8], [2.9, 2.0, -0.2], 0.3)));
  // Stood up on its grips, leaning back, its face to the visitor.
  const stood = scale(turn(f, 'x', -0.55, [0, 0, 0]), 1.35);
  return { f: onBed((x, y, z) => stood(x, y - 5.5, z)), bounds: [-8.6, 0, -4.9, 8.6, 10.4, 4.9], lip: 1.8 };
}
function trophy() {
  const cup = lathe([[0.01, 7.3], [1.0, 7.4], [2.2, 8.0], [3.3, 9.2], [3.9, 11.0], [4.1, 12.6], [3.5, 12.6], [3.3, 11.2], [2.6, 9.6], [0.01, 8.9]]);
  const stem = lathe([[3.0, 0], [3.0, 1.1], [2.5, 1.4], [2.5, 2.2], [1.1, 2.6], [0.6, 3.4], [0.55, 5.6], [0.9, 6.3], [1.5, 7.4], [0.01, 7.8]]);
  const handles = mirrorX((x, y, z) => hypot(hypot(x - 3.9, y - 10.4) - 1.5, z) - 0.38);
  const handleArc = (x, y, z) => max(handles(x, y, z), -(abs(x) - 3.6));
  const star = extrude(polygon(Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * 2 * PI + PI / 2, r = i % 2 ? 0.42 : 1.0; return [cos(a) * r, 10.6 + sin(a) * r]; })), 0.2, 3.95, 'z');
  return { f: onBed(blend(0.35, cup, stem, handleArc, (x, y, z) => star(x, y, z))), bounds: B(5.9, 13, 4.4), lip: 1.7 };
}
function crown(o) {
  const n = o.sides;
  const band = cut(cylinder(4.0, 0, 3.0, [0, 0], 0.3), cylinder(3.3, -1, 9, [0, 0]));
  const point = (x, y, z) => {
    const h = min(1, max(0, (y - 2.5) / 4.0)), w = 1.35 * (1 - h) + 0.15;
    return max(abs(x) - w, y - 6.6, 2.4 - y, abs(z - 3.65) - 0.33 - 0.04 * h) * 0.8;
  };
  const balls = around(sphere(0.55, [0, 6.8, 3.65]), n);
  const gems = around(ellipsoid([0.55, 0.65, 0.3], [0, 1.5, 4.05]), n, PI / n);
  return { f: onBed(blend(0.3, band, around(point, n), balls, gems, torus(3.85, 0.25, [0, 0.35, 0]), torus(3.85, 0.25, [0, 2.75, 0]))), bounds: B(5, 7.6, 5), lip: 1.8 };
}
function teapot() {
  const body = lathe([[2.6, 0], [3.6, 0.6], [4.3, 2.4], [4.2, 4.6], [3.6, 5.9], [2.6, 6.6], [0.01, 6.7]]);
  const lid = blend(0.4, lathe([[2.7, 6.3], [2.5, 7.2], [1.6, 7.7], [0.01, 7.9]]), sphere(0.75, [0, 8.4, 0]));
  const segs = [];
  for (let i = 1, px = 3.4, py = 2.4; i <= 5; i++) { const t = i / 5, nx = 3.4 + 3.0 * t, ny = 2.4 + 4.6 * t * t; segs.push(rod([px, py, 0], [nx, ny, 0], 1.0 - 0.13 * (i - 1), 1.0 - 0.13 * i)); px = nx; py = ny; }
  const spout = union(...segs);
  const handle = (x, y, z) => max(hypot(hypot(x + 4.3, y - 3.6) - 2.1, z * 1.3) - 0.5, x + 4.0);
  let f = blend(0.5, body, spout, handle);
  f = blend(0.2, f, lid, torus(2.7, 0.18, [0, 6.35, 0]));
  return { f: onBed(f), bounds: [-7.2, 0, -4.6, 7.2, 9.4, 4.6], lip: 1.7 };
}
function mushroom() {
  const stem = lathe([[1.9, 0], [2.0, 0.6], [1.6, 2.5], [1.5, 4.8], [1.7, 5.4]]);
  const cap = (x, y, z) => {
    const r = hypot(x, z), d = ellipsoid([5.0, 3.6, 5.0], [0, 5.2, 0])(x, y, z);
    return max(d, 5.2 - y - 0.35 * min(1, r / 5) * 2);
  };
  const spots = union(...[[0, 8.4, 0, 0.9], [2.6, 7.8, 1.6, 0.75], [-2.4, 7.9, 1.9, 0.8], [0.4, 7.4, 3.6, 0.7], [3.7, 6.5, -1.2, 0.6], [-3.6, 6.6, -1.0, 0.65], [-1.1, 6.6, -3.6, 0.6], [1.9, 6.8, -3.0, 0.65], [3.9, 6.0, 2.2, 0.5], [-3.2, 6.0, 3.0, 0.5]]
    .map(([x, y, z, r]) => sphere(r, [x, y, z])));
  let f = blend(0.6, stem, cap);
  f = blend(0.2, f, meet(spots, inflate(f, 0.28)));
  return { f: onBed(f), bounds: B(5.6, 9.4, 5.6), lip: 1.8 };
}
function lighthouse() {
  const tower = lathe([[3.6, 0], [3.6, 1.0], [2.6, 1.4], [2.5, 2.0], [1.75, 10.2], [2.3, 10.5], [2.3, 10.9]]);
  const lantern = cylinder(1.45, 10.9, 12.7, [0, 0], 0.1);
  const roof = lathe([[1.9, 12.6], [1.9, 12.9], [0.2, 14.0], [0.01, 14.1]]);
  let f = blend(0.25, tower, lantern, roof, sphere(0.35, [0, 14.3, 0]), torus(2.25, 0.16, [0, 11.6, 0]));
  f = cut(f, around(box([0.42, 0.55, 2], [0, 11.8, 1.5], 0.1), 6));
  const t = f;
  f = union(f, ...[3.3, 6.0, 8.6].map(y0 => meet((x, y) => abs(y - y0) - 0.6, (x, y, z) => t(x, y, z) - 0.14)));
  f = carve(0.1, f, box([0.55, 0.85, 1], [0, 2.6, 2.55], 0.3));
  f = cut(f, box([0.28, 0.4, 1], [0, 7.3, 1.95], 0.1), box([0.28, 0.4, 1], [0, 4.6, 2.2], 0.1));
  return { f: onBed(f), bounds: B(4, 14.8, 4), lip: 1.6 };
}
function planet() {
  const ball = sphere(3.3, [0, 7.6, 0]);
  const ring = turn(turn((x, y, z) => max(abs(hypot(x, z) - 5.0) - 1.15, abs(y - 7.6) - 0.16), 'z', 0.38, [0, 7.6, 0]), 'x', 0.42, [0, 7.6, 0]);
  const stand = lathe([[2.6, 0], [2.6, 0.7], [1.0, 1.2], [0.5, 2.0], [0.45, 4.6]]);
  let f = blend(0.3, ball, stand);
  f = union(f, ring);
  f = carve(0.12, f, (x, y, z) => max(abs(((y - 7.6) % 1.3 + 1.3) % 1.3 - 0.65) - 0.08, hypot(x, y - 7.6, z) - 3.35));
  return { f: onBed(f), bounds: B(6.4, 12, 6.4), lip: 1.8 };
}
function heart() {
  // iq's heart, its tip on the bed.
  const h2 = (u, v) => {
    let x = abs(u) / 10, y = v / 10;
    if (y + x > 1) return (hypot(x - 0.25, y - 0.75) - Math.SQRT2 / 4) * 10;
    const a = hypot(x, y - 1), m = max(x + y, 0) * 0.5, b = hypot(x - m, y - m);
    return min(a, b) * Math.sign(x - y) * 10;
  };
  return { f: onBed(inflate(extrude((u, v) => h2(u, v + 0.4) + 0.7, 0.55, 0, 'z'), 1.1)), bounds: [-8.4, 0, -2, 8.4, 11.4, 2], lip: 1.4 };
}
function star(o) {
  const n = o.sides, inner = max(0.2, 0.5 - o.depth * 0.5);
  const pts = Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * 2 * PI + PI / 2, r = i % 2 ? 5.6 * inner : 5.6; return [cos(a) * r, 5.6 + sin(a) * r]; });
  const s2 = polygon(pts);
  const f = (x, y, z) => { const d = s2(x, y); return max(d * 0.85, abs(z) - max(0.25, -d * 0.55 + 0.25)); };
  return { f: onBed(inflate(f, 0.25)), bounds: [-6.1, 0, -2.4, 6.1, 11.9, 2.4], lip: 2 };
}
function gear(o) {
  const n = o.sides, R = 5.2, tooth = 0.9 + o.depth * 1.2;
  const g2 = (u, v) => {
    const a = atan2(v, u), r = hypot(u, v), k = 0.5 + 0.5 * Math.tanh(cos(a * n) * 4);
    return r - (R - tooth + tooth * k);
  };
  const rim = (u, v) => max(g2(u, v), -(hypot(u, v) - 1.1));
  const holes = (u, v) => { const a = atan2(v, u), s = (2 * PI) / 5, b = a - s * Math.round(a / s), r = hypot(u, v); return hypot(r * cos(b) - 2.7, r * sin(b)) - 1.05; };
  const face = (u, v) => max(rim(u, v), -holes(u, v));
  const disc = inflate(extrude(face, 0.75, 0, 'z'), 0.2), f = (x, y, z) => disc(x, y - R - 0.2, z);
  return { f: onBed(blend(0.4, (x, y, z) => f(x, y + 0.35, z), box([2.2, 0.5, 1.4], [0, 0.5, 0], 0.3))), bounds: [-6.4, 0, -1.6, 6.4, 11, 1.6], lip: 1.6 };
}
function flower(o) {
  const n = o.sides;
  const pot = lathe([[2.2, 0], [2.8, 3.6], [3.2, 3.7], [3.2, 4.4], [0.01, 4.4]]);
  const stem = rod([0, 4, 0], [0, 9.2, 0.4], 0.36);
  const leaf = mirrorX(turn(ellipsoid([1.7, 0.5, 0.25], [1.5, 6.4, 0.3]), 'z', 0.5, [0.2, 6.0, 0.3]));
  const petal = (x, y, z) => ellipsoid([0.95, 2.0, 0.42], [0, 2.0, 0])(x, y, z);
  // Petals round the middle, in the plane facing the visitor.
  const petals = (x, y, z) => {
    const px = x, py = y - 10.4, pz = z - 0.6, s = (2 * PI) / n;
    let a = atan2(px, py), r = hypot(px, py);
    a -= s * Math.round(a / s);
    return petal(r * sin(a), r * cos(a), pz + 0.12 * r);
  };
  let f = blend(0.3, pot, stem, leaf);
  f = blend(0.4, f, petals, sphere(1.25, [0, 10.4, 0.9]));
  return { f: onBed(f), bounds: B(5.2, 15, 3.6), lip: 2 };
}
function vase(o) { return ringShape({ edge: o.depth > 0 ? 'petal' : 'round', sides: o.sides, depth: o.depth * 0.6, twist: 0, bulge: 0.45, taper: 0.35, lip: 0.35, height: 13, radius: 3.6, hollow: 0.7 }); }
function spiral(o) { return ringShape({ edge: 'star', sides: o.sides, depth: 0.25 + o.depth * 0.5, twist: 1.5, bulge: 0, taper: 0.3, height: 14, radius: 4.6 }); }
function mug() {
  const body = lathe([[3.3, 0], [3.5, 0.4], [3.6, 8.2], [3.0, 8.2], [2.9, 1.0], [0.01, 1.0]]);
  const handle = (x, y, z) => max(hypot(hypot(x - 3.6, y - 4.3) - 2.0, z * 1.25) - 0.55, -(x - 3.3));
  return { f: onBed(blend(0.4, body, handle)), bounds: [-4.2, 0, -4.2, 6.6, 8.8, 4.2], lip: 1.6 };
}
function cube() {
  const c = box([4.2, 4.2, 4.2], [0, 4.2, 0], 0.5);
  const g = v => abs(abs(v) - 1.4) - 0.12;
  const grooves = (x, y, z) => max(min(g(x), g(y - 4.2), g(z)), -(c(x, y, z) + 0.3));
  return { f: onBed(carve(0.06, c, grooves)), bounds: B(5, 9, 5), lip: 1.6 };
}

export const MODELS = [
  { id: 'knight', name: 'chess knight', words: ['knight', 'horse', 'chess', 'chessknight', 'pony'], colour: 'white', make: knight },
  { id: 'rocket', name: 'rocket', words: ['rocket', 'spaceship', 'rocketship'], colour: 'red', sides: [3, 8, 4, 'fins'], make: rocket },
  { id: 'pishi', name: 'little Pishi', words: ['pishi', 'cat', 'kitty', 'kitten', 'pishy'], colour: 'grey', make: pishi },
  { id: 'bh22', name: 'mini BH-22', words: ['bh22', 'bh', 'robot', 'droid', 'bot'], colour: 'silver', make: bh22 },
  { id: 'controller', name: 'game controller', words: ['controller', 'gamepad', 'joystick', 'pad', 'gamecontroller'], colour: 'purple', make: controller },
  { id: 'trophy', name: 'trophy', words: ['trophy', 'award', 'prize', 'winner', 'champion'], colour: 'gold', make: trophy },
  { id: 'skull', name: 'skull', words: ['skull', 'skeleton', 'bones'], colour: 'white', make: skull },
  { id: 'car', name: 'car', words: ['car', 'auto', 'racecar', 'truck', 'automobile'], colour: 'blue', make: car },
  { id: 'sneaker', name: 'sneaker', words: ['sneaker', 'sneakers', 'shoe', 'shoes', 'trainer', 'trainers', 'kicks'], colour: 'white', make: sneaker },
  { id: 'duck', name: 'rubber duck', words: ['duck', 'ducky', 'duckie', 'rubberduck'], colour: 'yellow', make: duck },
  { id: 'teapot', name: 'teapot', words: ['teapot', 'tea', 'kettle', 'pot'], colour: 'teal', make: teapot },
  { id: 'crown', name: 'crown', words: ['crown', 'tiara'], colour: 'gold', sides: [4, 10, 6, 'points'], make: crown },
  { id: 'dino', name: 'dinosaur', words: ['dino', 'dinosaur', 'trex', 'rex', 'dragon'], colour: 'green', make: dino },
  { id: 'octopus', name: 'octopus', words: ['octopus', 'squid', 'kraken'], colour: 'pink', make: octopus },
  { id: 'penguin', name: 'penguin', words: ['penguin', 'pingu'], colour: 'black', make: penguin },
  { id: 'ghost', name: 'ghost', words: ['ghost', 'boo', 'spooky'], colour: 'white', make: ghost },
  { id: 'mushroom', name: 'mushroom', words: ['mushroom', 'shroom', 'toadstool'], colour: 'red', make: mushroom },
  { id: 'boat', name: 'tugboat', words: ['boat', 'tugboat', 'ship', 'tug'], colour: 'orange', make: boat },
  { id: 'lighthouse', name: 'lighthouse', words: ['lighthouse'], colour: 'white', make: lighthouse },
  { id: 'planet', name: 'planet', words: ['planet', 'saturn', 'space'], colour: 'orange', make: planet },
  { id: 'rook', name: 'castle', words: ['rook', 'castle', 'tower', 'fort'], colour: 'grey', make: rook },
  { id: 'king', name: 'chess king', words: ['king'], colour: 'black', make: king },
  { id: 'heart', name: 'heart', words: ['heart', 'love', 'hearts'], colour: 'pink', make: heart },
  { id: 'star', name: 'star', words: ['star', 'stars'], colour: 'gold', sides: [3, 12, 5, 'points'], spiky: true, make: star },
  { id: 'gear', name: 'gear', words: ['gear', 'cog', 'gears'], colour: 'silver', sides: [6, 20, 12, 'teeth'], spiky: true, make: gear },
  { id: 'flower', name: 'flower', words: ['flower', 'rose', 'bloom', 'daisy', 'flowers'], colour: 'pink', sides: [4, 12, 7, 'petals'], make: flower },
  { id: 'vase', name: 'vase', words: ['vase', 'jar', 'urn'], colour: 'gold', sides: [3, 12, 6, 'sides'], spiky: true, make: vase },
  { id: 'mug', name: 'mug', words: ['mug', 'cup', 'glass', 'coffee'], colour: 'white', make: mug },
  { id: 'spiral', name: 'spiral', words: ['spiral', 'swirl', 'twister', 'twisty'], colour: 'teal', sides: [3, 8, 4, 'arms'], spiky: true, make: spiral, hidden: true },
  { id: 'cube', name: 'puzzle cube', words: ['cube', 'rubik', 'rubiks', 'puzzle'], colour: 'white', make: cube, hidden: true },
];
export const MODEL = Object.fromEntries(MODELS.map(m => [m.id, m]));

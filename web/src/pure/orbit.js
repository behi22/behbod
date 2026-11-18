// Orbit, on the computer: a little ship circles a planet. Hold to climb, let go to sink; do not touch the planet, do
// not drift off into space, do not hit the rocks. The longer you last the more rocks there are. Pure: `step` moves
// it on and says what happened.
export const SKY = { size: 420, planet: 46, low: 62, high: 196, ship: 7, rocksAtStart: 2, rocksMost: 11, everyS: 7 };
const CLIMB = 210, SINK = 150, DRAG = 1.6, TURN = 1.2;

export function newOrbit() {
  return { t: 0, a: -Math.PI / 2, r: 124, vr: 0, rocks: [], spark: null, sparks: 0, over: false, why: '', next: 1.2, ids: 0 };
}
export const score = o => Math.floor(o.t) + o.sparks * 3;
// How far apart two angles are, the short way round.
const apart = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// The ship's turn rate at a height: quicker low down, slower high up, as orbits are.
export const rate = r => TURN * Math.pow(124 / r, 1.5);

function rock(o, rng) {
  // A new rock arrives on the far side of the planet from the ship, in its own lane, going either way round.
  const r = SKY.low + 14 + rng() * (SKY.high - SKY.low - 28), w = (0.25 + rng() * 0.55) * (rng() < 0.5 ? -1 : 1);
  return { id: ++o.ids, a: o.a + Math.PI + (rng() - 0.5) * 1.2, r, w, size: 6 + rng() * 7 };
}
function spark(o, rng) {
  return { a: o.a + Math.PI * (0.5 + rng()), r: SKY.low + 22 + rng() * (SKY.high - SKY.low - 44) };
}

// thrust: the button is held. Events: rock { id }, spark, crash { why: 'planet' | 'space' | 'rock' }.
export function step(o, dt, thrust, rng = Math.random) {
  const ev = [];
  if (o.over || !(dt > 0)) return ev;
  const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
  for (let i = 0; i < n && !o.over; i++) {
    o.t += h;
    o.vr += ((thrust ? CLIMB : -SINK) - o.vr * DRAG) * h;
    o.r += o.vr * h;
    o.a += rate(o.r) * h;
    for (const k of o.rocks) k.a += k.w * h;
    if (o.r <= SKY.low) { o.over = true; o.why = 'planet'; }
    else if (o.r >= SKY.high) { o.over = true; o.why = 'space'; }
    else if (o.rocks.some(k => Math.abs(k.r - o.r) < k.size + SKY.ship && apart(k.a, o.a) * o.r < k.size + SKY.ship)) { o.over = true; o.why = 'rock'; }
    if (o.over) { ev.push({ type: 'crash', why: o.why }); break; }
    if (o.spark && Math.abs(o.spark.r - o.r) < 16 && apart(o.spark.a, o.a) * o.r < 16) { o.sparks++; o.spark = null; ev.push({ type: 'spark' }); }
    o.next -= h;
    if (o.next <= 0) {
      const want = Math.min(SKY.rocksMost, SKY.rocksAtStart + Math.floor(o.t / SKY.everyS));
      if (o.rocks.length < want) { const k = rock(o, rng); o.rocks.push(k); ev.push({ type: 'rock', id: k.id }); o.next = 0.5; } else o.next = 0.25;
      if (!o.spark) o.spark = spark(o, rng);
    }
  }
  return ev;
}

// Where something at (angle, height) is on the square picture, y down.
export const place = (a, r) => [SKY.size / 2 + Math.cos(a) * r, SKY.size / 2 + Math.sin(a) * r];

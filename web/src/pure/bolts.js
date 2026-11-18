// The bolts a drone fires on Hard. It glows for a moment first (the warning), then lets go of a slow ball of light
// aimed at where your eyes were at that moment. The bolt flies straight: step along the line or duck while it is on
// its way and it misses; shoot it and it is gone. Places are in range space: x across, d downrange, h up.
export const BOLT = { charge: 1.0, speed: 6, radius: 0.12 };
// The body a bolt can strike, seen from downrange: this far either side of the eye, from the floor to over the head.
export const BODY = { half: 0.24, crown: 0.14 };

export function launch(from, eye, speed = BOLT.speed) {
  const dx = eye.x - from.x, dd = eye.d - from.d, dh = eye.h - from.h, n = Math.hypot(dx, dd, dh) || 1;
  return { x: from.x, d: from.d, h: from.h, vx: dx / n * speed, vd: dd / n * speed, vh: dh / n * speed };
}

export const boltAt = (b, age) => ({ x: b.x + b.vx * age, d: b.d + b.vd * age, h: b.h + b.vh * age });

// How long after launch the bolt reaches depth `d` (Infinity if it is not coming that way).
export function reach(b, d) {
  if (b.d <= d) return 0;
  return b.vd < 0 ? (d - b.d) / b.vd : Infinity;
}

// Whether a bolt at `p` (as it reaches the eye's depth) meets the body of a player whose eye is at `eye`.
export function strikes(p, eye) {
  return Math.abs(p.x - eye.x) <= BODY.half + BOLT.radius && p.h <= eye.h + BODY.crown + BOLT.radius && p.h >= -BOLT.radius;
}

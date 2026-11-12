// Springs and easing for things held in the hand: recoil that kicks and comes back, sway that lags the look, the
// gun settling into the aim. A spring is { x, v, k, c }: where it is, how fast it moves, its stiffness and its damping.
export const spring = (k, c, x = 0) => ({ x, v: 0, k, c });

// Moves a spring toward `target` over `dt` seconds, in steps of at most 8 ms so a long frame cannot make it blow up.
export function springStep(s, target, dt) {
  const n = dt > 0.008 ? Math.ceil(dt / 0.008) : 1, h = dt / n;
  for (let i = 0; i < n; i++) { s.v += ((target - s.x) * s.k - s.v * s.c) * h; s.x += s.v * h; }
  return s.x;
}

// A sudden push (a shot, a landing): the spring's speed jumps and it works its own way back.
export function kick(s, impulse) { s.v += impulse; return s; }

// The damping that brings a spring of stiffness k to rest fastest without swinging past.
export const critical = k => 2 * Math.sqrt(k);

// Eases 0..1 with no jolt at either end (smootherstep).
export function smoother(u) {
  const t = Math.min(1, Math.max(0, u));
  return t * t * t * (t * (6 * t - 15) + 10);
}

// Closes a share of the gap to `target` each second, the same whatever the frame rate.
export function approach(current, target, rate, dt) {
  return target + (current - target) * Math.exp(-rate * dt);
}

// A pose between keyframes: `keys` is [[time, value], ...] in rising time; values are numbers or equal-length arrays.
// Before the first key it holds the first value, after the last the last, and in between it eases.
export function track(keys, t, ease = smoother) {
  if (!keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i];
    if (t > t1) continue;
    const [t0, a] = keys[i - 1], u = ease((t - t0) / (t1 - t0 || 1));
    return Array.isArray(a) ? a.map((v, j) => v + (b[j] - v) * u) : a + (b - a) * u;
  }
  return keys[keys.length - 1][1];
}

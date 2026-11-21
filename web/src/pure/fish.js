// The tank's fish swim end to end and turn round near each end, about their own middle, over about a second and a
// half: the turn starts as the swim slows (|cos| under TURN) and the fish drifts a little toward where its head points.
export const SPEED = 0.4, AMP = 0.25, TURN = 0.3, DRIFT = 0.03;

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// t in seconds, ph the fish's own phase, amp how far it swims either side of its home. yaw is 0 heading +x, PI heading -x.
export function swim(t, ph, amp = AMP) {
  const s = t * SPEED + ph;
  const yaw = Math.PI * (1 - smooth(-TURN, TURN, Math.cos(s)));
  return { dx: Math.sin(s) * amp, dz: -Math.sin(yaw) * DRIFT, yaw };
}

// How far a fish centred at `mid` and `half` long may swim either side and stay `gap` inside the water from lo to hi.
export function reach(mid, half, lo, hi, gap = 0.01, amp = AMP) {
  return Math.max(0, Math.min(amp, hi - gap - half - mid, mid - (lo + gap + half)));
}

// The piano lamp while the piano plays: it warms up quickly and cools down slowly, and settles exactly on 0, so the lamp
// at rest is exactly as it always was.
export const WARM_UP = 2.2, COOL_DOWN = 0.55;
// How long after the last key struck it still counts as playing, so the gaps between notes keep it warm.
export const HOLD = 1.5;

export function warmth(k, playing, dt) {
  const to = playing ? 1 : 0, next = k + (to - k) * Math.min(1, dt * (playing ? WARM_UP : COOL_DOWN));
  return Math.abs(next - to) < 0.002 ? to : next;
}

// The extra glow under the shade at full warmth, in linear light before the light switch scales it: deep amber, so
// the lamp both brightens and warms.
export const GLOW = [1.5, 0.66, 0.2];
export const glowColour = k => GLOW.map(v => v * k);

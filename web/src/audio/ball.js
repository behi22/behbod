import { tone, noisy } from './drums.js';

// The keepy-up ball: a soft thump when it is touched up, a hollow knock off the floor or a wall. `k` (0 to 1) is how hard.
export function ballSounds(go) {
  return {
    ballTouch(pos, k = 1) {
      const S = go(pos);
      if (!S) return;
      const t = S.t, o = tone(S, 'sine', 150, 0.45 * k, 0.002, 0.11, t);
      o.frequency.exponentialRampToValueAtTime(62, t + 0.09);
      noisy(S, 'bandpass', 750, 1.1, 0.22 * k, 0.001, 0.035, t);
      S.play(t, t + 0.16);
    },
    ballBounce(pos, k = 1) {
      const S = go(pos, 0.12);
      if (!S) return;
      const t = S.t, o = tone(S, 'sine', 118, 0.5 * k, 0.001, 0.09, t);
      o.frequency.exponentialRampToValueAtTime(74, t + 0.08);
      const ring = tone(S, 'triangle', 340, 0.06 * k, 0.001, 0.06, t);
      ring.frequency.exponentialRampToValueAtTime(260, t + 0.05);
      noisy(S, 'lowpass', 900, 0.8, 0.18 * k, 0.001, 0.03, t);
      S.play(t, t + 0.14);
    },
  };
}

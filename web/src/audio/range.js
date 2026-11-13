import { tone, noisy } from './drums.js';

// The range's sounds, all made here rather than recorded: the shot (a crack, the body of the blast, a thump in the
// chest and the hall answering), the gun's own clicks, brass on the floor, steel ringing, and machines coming apart.
// `go(pos, wet)` starts a sound at a place in the room (or in the head when pos is null) with some of it sent to the reverb.
export function rangeSounds(go) {
  const ring = (S, t, parts, level) => { for (const [f, a, d] of parts) tone(S, 'sine', f, a * level, 0.001, d, t); };
  return {
    // loud: 1 for a bare muzzle, about 0.2 with a suppressor on.
    gunShot(loud = 1) {
      const S = go(null, 0.55 * loud + 0.1);
      if (!S) return;
      const t = S.t, k = 0.35 + 0.65 * loud;
      noisy(S, 'highpass', 2600, 0.7, 0.5 * loud, 0.0006, 0.045, t);
      noisy(S, 'bandpass', loud > 0.5 ? 820 : 1500, 0.6, 0.55 * k, 0.001, loud > 0.5 ? 0.12 : 0.06, t);
      const o = tone(S, 'sine', 170, 0.6 * loud, 0.001, 0.13, t);
      o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
      noisy(S, 'lowpass', 1500, 0.7, 0.16 * loud, 0.01, 0.5, t + 0.02);
      // The slide going back and home.
      noisy(S, 'bandpass', 3400, 2.5, 0.09, 0.0006, 0.018, t + 0.025);
      noisy(S, 'bandpass', 2300, 2.5, 0.11, 0.0006, 0.022, t + 0.07);
      S.play(t, t + 0.65);
    },
    gunDry() {
      const S = go(null);
      if (!S) return;
      const t = S.t, o = tone(S, 'square', 2100, 0.05, 0.0005, 0.012, t);
      o.frequency.exponentialRampToValueAtTime(1300, t + 0.012);
      noisy(S, 'highpass', 3500, 0.7, 0.1, 0.0005, 0.012, t);
      S.play(t, t + 0.06);
    },
    magOut() {
      const S = go(null, 0.1);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', 2900, 3, 0.12, 0.0006, 0.014, t);
      noisy(S, 'bandpass', 1300, 1.2, 0.09, 0.004, 0.08, t + 0.03);
      tone(S, 'triangle', 340, 0.05, 0.002, 0.04, t + 0.03);
      S.play(t, t + 0.2);
    },
    magIn() {
      const S = go(null, 0.12);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', 1500, 1, 0.1, 0.004, 0.05, t - 0.0);
      const o = tone(S, 'sine', 210, 0.3, 0.001, 0.06, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
      noisy(S, 'bandpass', 2600, 3, 0.2, 0.0006, 0.02, t + 0.05);
      noisy(S, 'highpass', 4200, 0.7, 0.07, 0.0005, 0.012, t + 0.058);
      S.play(t, t + 0.25);
    },
    slideRack() {
      const S = go(null, 0.15);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', 2400, 2.2, 0.16, 0.0006, 0.02, t);
      noisy(S, 'bandpass', 3300, 3, 0.22, 0.0006, 0.026, t + 0.045);
      tone(S, 'triangle', 760, 0.07, 0.001, 0.03, t + 0.045);
      S.play(t, t + 0.2);
    },
    casing(pos, k = 1) {
      const S = go(pos, 0.25);
      if (!S) return;
      const t = S.t, f = 4600 + Math.random() * 1800;
      ring(S, t, [[f, 0.05, 0.11], [f * 1.47, 0.03, 0.07], [f * 2.09, 0.015, 0.04]], k);
      noisy(S, 'highpass', 6000, 0.7, 0.02 * k, 0.0005, 0.01, t);
      S.play(t, t + 0.18);
    },
    plate(pos) {
      const S = go(pos, 0.5);
      if (!S) return;
      const t = S.t, f = 1050 + Math.random() * 260;
      noisy(S, 'bandpass', 2200, 1, 0.3, 0.0006, 0.03, t);
      ring(S, t, [[f, 0.22, 0.9], [f * 2.32, 0.12, 0.55], [f * 3.86, 0.07, 0.3], [f * 5.2, 0.035, 0.16]], 1);
      S.play(t, t + 1.1);
    },
    botHit(pos, weak) {
      const S = go(pos, 0.3);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', weak ? 3200 : 2100, 1.5, 0.26, 0.0006, 0.035, t);
      ring(S, t, weak ? [[1900, 0.1, 0.2], [2850, 0.06, 0.12]] : [[640, 0.12, 0.09], [1500, 0.05, 0.06]], 1);
      S.play(t, t + 0.3);
    },
    botDown(pos) {
      const S = go(pos, 0.5);
      if (!S) return;
      const t = S.t;
      noisy(S, 'lowpass', 900, 0.7, 0.5, 0.002, 0.22, t);
      noisy(S, 'bandpass', 2600, 1, 0.22, 0.001, 0.12, t);
      const o = tone(S, 'sawtooth', 260, 0.1, 0.01, 0.7, t + 0.03);
      o.frequency.setValueAtTime(260, t + 0.03); o.frequency.exponentialRampToValueAtTime(34, t + 0.7);
      for (let i = 0; i < 5; i++) noisy(S, 'highpass', 5000, 0.7, 0.07, 0.0005, 0.012, t + 0.12 + Math.random() * 0.5);
      S.play(t, t + 0.9);
    },
    droneDown(pos) {
      const S = go(pos, 0.5);
      if (!S) return;
      const t = S.t;
      noisy(S, 'bandpass', 1400, 0.7, 0.5, 0.001, 0.14, t);
      const o = tone(S, 'square', 1900, 0.06, 0.005, 0.55, t);
      o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.55);
      noisy(S, 'highpass', 5200, 0.7, 0.1, 0.001, 0.3, t + 0.03);
      S.play(t, t + 0.7);
    },
    // A shot into concrete or steel that was not a target.
    thud(pos, steel) {
      const S = go(pos, 0.2);
      if (!S) return;
      const t = S.t;
      if (steel) { noisy(S, 'bandpass', 3000, 2, 0.12, 0.0006, 0.02, t); ring(S, t, [[2400 + Math.random() * 900, 0.05, 0.12]], 1); }
      else noisy(S, 'lowpass', 1100, 0.7, 0.22, 0.001, 0.05, t);
      S.play(t, t + 0.2);
    },
    // The count before a run (three low, one high), and the stars when it ends.
    beep(high) {
      const S = go(null);
      if (!S) return;
      const t = S.t;
      tone(S, 'sine', high ? 1320 : 880, 0.12, 0.004, high ? 0.3 : 0.12, t);
      S.play(t, t + 0.4);
    },
    stars(n) {
      const S = go(null, 0.4);
      if (!S) return;
      const t = S.t;
      for (let i = 0; i < Math.max(1, n); i++) ring(S, t + i * 0.16, [[[784, 988, 1319][i] || 784, 0.14, 0.7], [[1568, 1976, 2637][i] || 1568, 0.05, 0.4]], n ? 1 : 0.5);
      S.play(t, t + 1.5);
    },
    // The hall's lights going out or coming back.
    breaker(on) {
      const S = go(null, 0.5);
      if (!S) return;
      const t = S.t;
      noisy(S, 'lowpass', on ? 2400 : 600, 0.7, 0.3, 0.002, 0.16, t);
      const o = tone(S, 'sine', on ? 60 : 110, 0.2, 0.01, 0.5, t);
      o.frequency.exponentialRampToValueAtTime(on ? 120 : 40, t + 0.4);
      S.play(t, t + 0.6);
    },
  };
}

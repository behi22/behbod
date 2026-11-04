import { shot, perc } from './core.js';

export const noisy = (S, type, f, q, peak, a, d, t) => {
  const n = S.at(S.noise(), t, t + a + d + 0.02), fl = S.filt(type, f, q), g = S.gain();
  n.connect(fl).connect(g).connect(S.out);
  perc(g.gain, t, peak, a, d);
  return fl;
};
export const tone = (S, type, f, peak, a, d, t) => {
  const o = S.at(S.osc(type, f), t, t + a + d + 0.02), g = S.gain();
  o.connect(g).connect(S.out);
  perc(g.gain, t, peak, a, d);
  return o;
};

export function lkick(e, P, t, { v }) {
  const S = shot(e, P.in);
  const o = tone(S, 'sine', 125, 0.85 * v, 0.004, 0.38, t);
  o.frequency.setValueAtTime(125, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
  noisy(S, 'lowpass', 1200, 0.7, 0.1 * v, 0.001, 0.025, t);
  S.play(t, t + 0.45);
}

export function lsnare(e, P, t, { v }) {
  const S = shot(e, P.in);
  const o = tone(S, 'triangle', 200, 0.3 * v, 0.002, 0.1, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  const n = S.noise(), bp = S.filt('bandpass', 1800, 0.8), lp = S.filt('lowpass', 5000), g = S.gain();
  n.connect(bp).connect(lp).connect(g).connect(S.out);
  perc(g.gain, t, 0.5 * v, 0.002, 0.22);
  S.play(t, t + 0.3);
}

export function lhat(e, P, t, { v }) {
  const S = shot(e, P.in);
  noisy(S, 'highpass', 6500, 0.7, 0.2 * v, 0.001, 0.045, t);
  S.play(t, t + 0.08);
}

export function rim(e, P, t, { v }) {
  const S = shot(e, P.in);
  tone(S, 'triangle', 1700, 0.2 * v, 0.001, 0.025, t);
  noisy(S, 'bandpass', 3000, 2, 0.18 * v, 0.001, 0.02, t);
  S.play(t, t + 0.06);
}

export function skick(e, P, t, { v }) {
  const S = shot(e, P.in);
  const o = tone(S, 'sine', 160, 0.95 * v, 0.003, 0.32, t);
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  noisy(S, 'highpass', 2500, 0.7, 0.08 * v, 0.001, 0.012, t);
  S.play(t, t + 0.4);
}

// A dense noise plateau cut off sharply: the gated-reverb snare in a single voice.
export function gsnare(e, P, t, { v }) {
  const S = shot(e, P.in);
  const n = S.noise(), bp = S.filt('bandpass', 1700, 0.6), lp = S.filt('lowpass', 7000), g = S.gain();
  n.connect(bp).connect(lp).connect(g).connect(S.out);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.6 * v, t + 0.002);
  g.gain.linearRampToValueAtTime(0.28 * v, t + 0.05);
  g.gain.linearRampToValueAtTime(0.22 * v, t + 0.22);
  g.gain.linearRampToValueAtTime(0, t + 0.24);
  const o = tone(S, 'triangle', 210, 0.35 * v, 0.002, 0.12, t);
  o.frequency.exponentialRampToValueAtTime(170, t + 0.1);
  S.play(t, t + 0.3);
}

export function shat(e, P, t, { v }) {
  const S = shot(e, P.in);
  noisy(S, 'highpass', 8000, 0.7, 0.18 * v, 0.001, 0.03, t);
  S.play(t, t + 0.05);
}

export function sohat(e, P, t, { v }) {
  const S = shot(e, P.in);
  noisy(S, 'highpass', 7000, 0.7, 0.13 * v, 0.002, 0.18, t);
  S.play(t, t + 0.25);
}

// Tombak centre stroke: a deep membrane with two faster upper modes.
export function tom(e, P, t, { v }) {
  const S = shot(e, P.in);
  const o = tone(S, 'sine', 96, 0.8 * v, 0.003, 0.38, t);
  o.frequency.setValueAtTime(100, t);
  o.frequency.exponentialRampToValueAtTime(84, t + 0.15);
  tone(S, 'sine', 153, 0.22 * v, 0.002, 0.16, t);
  tone(S, 'sine', 212, 0.12 * v, 0.002, 0.09, t);
  noisy(S, 'lowpass', 350, 0.7, 0.25 * v, 0.001, 0.04, t);
  S.play(t, t + 0.45);
}

export function bak(e, P, t, { v }) {
  const S = shot(e, P.in);
  const o = tone(S, 'sine', 540, 0.3 * v, 0.001, 0.08, t);
  o.frequency.exponentialRampToValueAtTime(500, t + 0.06);
  tone(S, 'sine', 860, 0.12 * v, 0.001, 0.04, t);
  noisy(S, 'bandpass', 2600, 1.5, 0.4 * v, 0.001, 0.045, t);
  S.play(t, t + 0.12);
}

export function tik(e, P, t, { v }) {
  const S = shot(e, P.in);
  noisy(S, 'bandpass', 4200, 2, 0.35 * v, 0.001, 0.018, t);
  tone(S, 'sine', 720, 0.1 * v, 0.001, 0.025, t);
  S.play(t, t + 0.05);
}

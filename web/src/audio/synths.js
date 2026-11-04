import { shot, perc } from './core.js';
import { midiToFreq } from './pure/notes.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function wave(e, key, amps) {
  if (!e.waves.has(key)) {
    const real = new Float32Array(amps.length + 1), imag = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => { imag[i + 1] = a; });
    e.waves.set(key, e.ctx.createPeriodicWave(real, imag));
  }
  return e.waves.get(key);
}

// Partials thin out up the keyboard, and the hammer striking near 1/8 of the string dips the 8th.
function pianoWave(e, midi) {
  const b = Math.floor(midi / 6), f = midiToFreq(b * 6 + 3), n = clamp(Math.floor(9000 / f), 1, 28);
  return wave(e, 'piano' + b, Array.from({ length: n }, (_, i) => (0.15 + Math.abs(Math.sin(Math.PI * (i + 1) / 7.6))) / Math.pow(i + 1, 1.1)));
}

export function pianoVoice(e, dest, t, midi, vel) {
  const f = midiToFreq(midi), v = clamp(vel, 0.05, 1), S = shot(e, dest), w = pianoWave(e, midi), x = (midi - 21) / 87;
  const tau1 = 0.32 - 0.22 * x, tau2 = 3.4 * Math.pow(2, -(midi - 21) / 30);
  const peak = 0.2 * Math.pow(v, 1.4) * (midi < 48 ? 1.15 : midi > 84 ? 0.8 : 1);
  const lp = S.filt('lowpass', Math.min(18000, f * (1.5 + 9 * v) + 1500 * v), 0);
  lp.frequency.setTargetAtTime(f * 1.6 + 250, t + 0.005, tau2 * 0.5);
  const det = 0.8 + 1.6 * (1 - x);
  for (const c of midi < 45 ? [0, det, -det] : [0, det]) {
    const o = S.osc(null, f);
    o.setPeriodicWave(w);
    o.detune.value = c;
    o.connect(lp);
  }
  const amp = S.gain(), rel = S.gain(1);
  lp.connect(amp).connect(rel).connect(S.out);
  // The quick drop then the long ring: the two-stage decay that makes a struck string sound like a piano.
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.003);
  amp.gain.setTargetAtTime(peak * 0.32, t + 0.003, tau1);
  amp.gain.setTargetAtTime(0, t + 0.003 + tau1 * 2.5, tau2);
  const n = S.at(S.noise(), t, t + 0.05), hb = S.filt('bandpass', clamp(f * 3, 700, 5000), 0.9), hg = S.gain();
  n.connect(hb).connect(hg).connect(S.out);
  perc(hg.gain, t, 0.05 * v * v, 0.0008, 0.03);
  const end = t + 0.003 + tau1 * 2.5 + tau2 * 5.5;
  S.play(t, end);
  return {
    S, midi, start: t, end,
    release(tr, rtau) {
      if (midi >= 89 && rtau === undefined) return;
      const at = Math.max(tr, t + 0.004), rt = rtau ?? (midi < 40 ? 0.14 : 0.08);
      rel.gain.setTargetAtTime(0, at, rt);
      S.stop(Math.min(end, at + rt * 7));
    },
  };
}

export function piano(e, P, t, { m, v, d }) {
  pianoVoice(e, P.in, t, m, v).release(t + d);
}

function rhodesVoice(e, P, t, m, v, d, bright) {
  const f = midiToFreq(m), S = shot(e, P.in);
  const car = S.osc('sine', f), mod = S.osc('sine', f), idx = S.gain(), amp = S.gain(), lp = S.filt('lowpass', 2800, 0), rel = S.gain(1);
  mod.connect(idx).connect(car.frequency);
  idx.gain.setValueAtTime(f * (bright ? 3 : 2.2) * v, t);
  idx.gain.setTargetAtTime(f * 0.35, t, 0.25);
  const bell = S.at(S.osc('sine', f * 4), t, t + 0.25), bg = S.gain();
  bell.connect(bg).connect(amp);
  perc(bg.gain, t, bright ? 0.35 : 0.18, 0.002, 0.15);
  car.connect(amp);
  const peak = (bright ? 0.12 : 0.15) * v;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.004);
  amp.gain.setTargetAtTime(0, t + 0.004, bright ? 0.9 : clamp(2.4 - (m - 48) * 0.04, 0.8, 2.4));
  amp.connect(lp).connect(rel).connect(S.out);
  rel.gain.setTargetAtTime(0, t + d, 0.1);
  S.play(t, t + d + 0.6);
}

export const rhodes = (e, P, t, { m, v, d }) => rhodesVoice(e, P, t, m, v, d, false);
export const keys = (e, P, t, { m, v, d }) => rhodesVoice(e, P, t, m, v, d, true);

export function lbass(e, P, t, { m, v, d }) {
  const f = midiToFreq(m), S = shot(e, P.in);
  const a = S.osc('sine', f), b = S.osc('triangle', f), bg = S.gain(0.3), lp = S.filt('lowpass', 600, 0), amp = S.gain(), rel = S.gain(1);
  a.connect(lp); b.connect(bg).connect(lp);
  lp.connect(amp).connect(rel).connect(S.out);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.42 * v, t + 0.01);
  amp.gain.setTargetAtTime(0.3 * v, t + 0.01, 0.3);
  rel.gain.setTargetAtTime(0, t + d, 0.06);
  S.play(t, t + d + 0.4);
}

export function sbass(e, P, t, { m, v, d }) {
  const f = midiToFreq(m), S = shot(e, P.in);
  const a = S.osc('sawtooth', f), sub = S.osc('sine', f), sg = S.gain(0.6), lp = S.filt('lowpass', 1200, 6), amp = S.gain(), rel = S.gain(1);
  lp.frequency.setValueAtTime(1300, t);
  lp.frequency.setTargetAtTime(300, t, 0.08);
  a.connect(lp).connect(amp); sub.connect(sg).connect(amp);
  amp.connect(rel).connect(S.out);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.28 * v, t + 0.005);
  rel.gain.setTargetAtTime(0, t + d, 0.04);
  S.play(t, t + d + 0.25);
}

export function pad(e, P, t, { m, v, d }) {
  const f = midiToFreq(m), S = shot(e, P.in), lp = S.filt('lowpass', 1500, 0), amp = S.gain();
  for (const c of [-9, 9]) { const o = S.osc('sawtooth', f); o.detune.value = c; o.connect(lp); }
  lp.connect(amp).connect(S.out);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.045 * v, t + 0.6);
  amp.gain.setTargetAtTime(0, t + d, 0.5);
  S.play(t, t + d + 2.6);
}

export function arp(e, P, t, { m, v, x = 0.6 }) {
  const S = shot(e, P.in), o = S.osc('sawtooth', midiToFreq(m)), lp = S.filt('lowpass', 800, 5), g = S.gain();
  lp.frequency.setValueAtTime(700 + 4200 * x * v, t);
  lp.frequency.setTargetAtTime(400 + 600 * x, t, 0.06);
  o.connect(lp).connect(g).connect(S.out);
  if (P.delay) g.connect(P.delay);
  perc(g.gain, t, 0.13 * v, 0.003, 0.2);
  S.play(t, t + 0.3);
}

export function lead(e, P, t, { m, v, d }) {
  const f = midiToFreq(m), S = shot(e, P.in);
  const a = S.osc('sawtooth', f), b = S.osc('square', f), bg = S.gain(0.5), lp = S.filt('lowpass', 2600, 1), amp = S.gain(), rel = S.gain(1);
  b.detune.value = -7;
  const lfo = S.osc('sine', 5.5), depth = S.gain(0);
  lfo.connect(depth); depth.connect(a.detune); depth.connect(b.detune);
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(9, t + 0.35);
  a.connect(lp); b.connect(bg).connect(lp);
  lp.connect(amp).connect(rel).connect(S.out);
  if (P.delay) rel.connect(P.delay);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.1 * v, t + 0.02);
  amp.gain.setTargetAtTime(0.085 * v, t + 0.02, 0.2);
  rel.gain.setTargetAtTime(0, t + d, 0.12);
  S.play(t, t + d + 0.8);
}

const SANTUR = [1, 0.75, 0.55, 0.5, 0.38, 0.3, 0.24, 0.18, 0.14, 0.1, 0.08, 0.06];

function strike(e, P, t, m, v, light) {
  const f = midiToFreq(m), S = shot(e, P.in), w = wave(e, 'santur', SANTUR);
  const lp = S.filt('lowpass', Math.min(16000, f * 14 + 2500), 0), amp = S.gain();
  lp.frequency.setTargetAtTime(f * 3 + 600, t, 0.12);
  // Each santur note is a course of four strings, never quite in tune with each other.
  const dets = light ? [-3, 4] : [-4, 0, 5];
  for (const c of dets) { const o = S.osc(null, f); o.setPeriodicWave(w); o.detune.value = c; o.connect(lp); }
  lp.connect(amp).connect(S.out);
  const tau = light ? 0.25 : clamp(1.3 - (m - 50) * 0.025, 0.45, 1.3), peak = 0.13 * v / Math.sqrt(dets.length);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.0015);
  amp.gain.setTargetAtTime(0, t + 0.0015, tau);
  const n = S.at(S.noise(), t, t + 0.03), hb = S.filt('bandpass', 3500, 1), hg = S.gain();
  n.connect(hb).connect(hg).connect(S.out);
  perc(hg.gain, t, 0.06 * v, 0.0005, 0.008);
  S.play(t, t + tau * 4);
}

export function santur(e, P, t, { m, v, d, riz }) {
  if (!riz) return strike(e, P, t, m, v, false);
  // Riz: the tremolo of quick alternating strokes a santur uses to hold a long note.
  const n = Math.max(2, Math.round(d * 11));
  strike(e, P, t, m, v, false);
  for (let k = 1; k < n; k++) strike(e, P, t + (k * d) / n, m, v * (k % 2 ? 0.55 : 0.68) * (1 - 0.25 * k / n), true);
}

export function drone(e, P, t, { m, v, d }) {
  const S = shot(e, P.in), lp = S.filt('lowpass', 900, 0), amp = S.gain();
  for (const [o, type, g] of [[-12, 'triangle', 0.7], [0, 'sine', 1], [7, 'triangle', 0.45], [12, 'sine', 0.25]]) {
    const osc = S.osc(type, midiToFreq(m + o)), og = S.gain(g);
    osc.connect(og).connect(lp);
  }
  const lfo = S.osc('sine', 0.08), depth = S.gain(250);
  lfo.connect(depth).connect(lp.frequency);
  lp.connect(amp).connect(S.out);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.05 * v, t + 1.2);
  amp.gain.setTargetAtTime(0, t + d - 1.2, 0.5);
  S.play(t, t + d + 0.6);
}

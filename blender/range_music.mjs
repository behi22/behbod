// The range's run music as one file: his song, then my track grown from the approved demo, crossing in his song's quiet end.
//   node blender/range_music.mjs <his song.mp3> <work folder>    (needs ffmpeg; writes web/assets/range/music/run.mp3)
// Every sound is made here sample by sample, nothing sampled or copied; a semitone above the demo to sit in his key (F).
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [song, work] = process.argv.slice(2);
if (!song || !work) { console.error('usage: node blender/range_music.mjs <his song.mp3> <work folder>'); process.exit(1); }

// Measured on his song: ebur128 for loudness, the onset envelope and a line through the beats for tempo and phase.
const HIS = { bpm: 124, beat0: 17.8074, loud: -13.1, end: 185.2, join: 333 };
const SR = 44100, BPM = HIS.bpm, BEAT = 60 / BPM, STEP = BEAT / 4, BAR = BEAT * 4;
const BARS = 92, TAIL = 2.4, N = Math.ceil((BARS * BAR + TAIL) * SR);
const bus = () => [new Float32Array(N), new Float32Array(N)];
const drums = bus(), bass = bus(), synth = bus(), fx = bus(), send = new Float32Array(N);

let seed = 22;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const hz = m => 440 * 2 ** ((m - 69) / 12);
const at = (bar, step) => bar * BAR + step * STEP;

function svf() {
  let a = 0, b = 0;
  return (x, fc, q) => {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR), k = 1 / q, a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - b, v1 = a1 * a + a2 * v3, v2 = b + a2 * a + a3 * v3;
    a = 2 * v1 - a; b = 2 * v2 - b;
    return [v2, v1, x - k * v1 - v2];
  };
}
function saw(freq) {
  let ph = rnd();
  const dt = freq / SR;
  return () => {
    let v = 2 * ph - 1;
    if (ph < dt) { const t = ph / dt; v -= t + t - t * t - 1; } else if (ph > 1 - dt) { const t = (ph - 1) / dt; v -= t * t + t + t + 1; }
    ph += dt; if (ph >= 1) ph -= 1;
    return v;
  };
}
function put(b, i, s, pan = 0) { if (i >= 0 && i < N) { b[0][i] += s * Math.min(1, 1 - pan); b[1][i] += s * Math.min(1, 1 + pan); } }

// ---------- the demo's instruments, as they were ----------
const kicks = [];
function kick(t0, gain = 1) {
  kicks.push(t0);
  let ph = 0;
  const i0 = Math.round(t0 * SR), n = Math.round(0.42 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 44 + 120 * Math.exp(-t * 36);
    ph += 2 * Math.PI * f / SR;
    const s = Math.sin(ph) * Math.exp(-t * 8.5) + noise() * 0.35 * Math.exp(-t * 380);
    put(drums, i0 + i, Math.tanh(s * 1.9) * 0.95 * gain);
  }
}
function clap(t0, gain = 1) {
  const f = svf(), i0 = Math.round(t0 * SR), n = Math.round(0.3 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = 0;
    for (const d of [0, 0.011, 0.023]) if (t >= d) env += Math.exp(-(t - d) * (d === 0.023 ? 16 : 90));
    const s = f(noise(), 1700, 1.4)[1] * env * 0.55 * gain;
    put(drums, i0 + i, s, 0.08); send[i0 + i] += s * 0.5;
  }
}
function hat(t0, open, gain = 1, pan = 0) {
  const f = svf(), i0 = Math.round(t0 * SR), n = Math.round((open ? 0.22 : 0.06) * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, s = f(noise(), 8200, 0.9)[2] * Math.exp(-t * (open ? 17 : 75)) * 0.36 * gain;
    put(drums, i0 + i, s, pan);
  }
}
function bassNote(t0, dur, midi, { open = 1, gain = 1 } = {}) {
  const o1 = saw(hz(midi)), o2 = saw(hz(midi) * 1.004), f = svf();
  let sub = 0;
  const i0 = Math.round(t0 * SR), n = Math.round((dur + 0.05) * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, amp = Math.min(1, t / 0.004) * (t < dur ? 0.72 + 0.28 * Math.exp(-t * 9) : Math.exp(-(t - dur) * 90));
    sub += 2 * Math.PI * hz(midi) / SR;
    const x = (o1() + o2()) * 0.5, cut = 110 + open * 1700 * Math.exp(-t * 15);
    const s = Math.tanh(f(x, cut, 2.2)[0] * 2.4) * 0.5 + Math.sin(sub) * 0.42;
    put(bass, i0 + i, s * amp * 0.62 * gain);
  }
}
function stab(t0, dur, midi, { gain = 1, pan = 0, bright = 1 } = {}) {
  const os = [saw(hz(midi) * 0.996), saw(hz(midi)), saw(hz(midi) * 1.0045), saw(hz(midi + 12) * 1.002)], f = svf();
  const i0 = Math.round(t0 * SR), n = Math.round((dur + 0.12) * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, amp = Math.min(1, t / 0.003) * (t < dur ? Math.exp(-t * 5.5) : Math.exp(-dur * 5.5) * Math.exp(-(t - dur) * 40));
    const x = (os[0]() + os[1]() + os[2]()) / 3 + os[3]() * 0.35, cut = 500 + bright * 5200 * Math.exp(-t * 8.5);
    const s = Math.tanh(f(x, cut, 3.2)[0] * 3.2) * amp * 0.34 * gain;
    put(synth, i0 + i, s, pan); send[i0 + i] += s * 0.55;
  }
}
function lead(t0, dur, midi, gain = 1) {
  const o1 = saw(hz(midi)), o2 = saw(hz(midi) * 1.007), f = svf();
  const i0 = Math.round(t0 * SR), n = Math.round((dur + 0.4) * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, amp = Math.min(1, t / 0.06) * (t < dur ? 1 : Math.exp(-(t - dur) * 7));
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t / 0.5);
    const x = (o1() + o2()) * 0.5 * vib, s = f(x, 900 + 2200 * Math.min(1, t / dur), 2.5)[1] * amp * 0.2 * gain;
    put(synth, i0 + i, s, 0.4); send[i0 + i] += s * 0.9;
  }
}
function drone(t0, dur, midi, gain = 1) {
  const o1 = saw(hz(midi)), o2 = saw(hz(midi) * 1.006), o3 = saw(hz(midi + 7) * 0.997), f = svf();
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, amp = Math.min(1, t / 2.5) * Math.min(1, (dur - t) / 0.4);
    const s = f((o1() + o2() + o3() * 0.6) / 2.6, 160 + 140 * Math.sin(t * 0.7) ** 2, 1.2)[0] * amp * 0.3 * gain;
    put(fx, i0 + i, s, Math.sin(t * 0.31) * 0.3);
  }
}
function riser(t0, dur, gain = 1) {
  const f = svf(), i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  for (let i = 0; i < n; i++) {
    const k = i / n, s = f(noise(), 300 * 30 ** k, 2.5)[1] * k * k * 0.5 * gain;
    put(fx, i0 + i, s, Math.sin(k * 40) * 0.5); send[i0 + i] += s * 0.4;
  }
}
function boom(t0, gain = 1) {
  let ph = 0;
  const i0 = Math.round(t0 * SR), n = Math.round(1.6 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += 2 * Math.PI * (34 + 60 * Math.exp(-t * 5)) / SR;
    const s = Math.sin(ph) * Math.exp(-t * 2.6) * 0.8 + noise() * 0.25 * Math.exp(-t * 6);
    put(fx, i0 + i, Math.tanh(s * 1.5) * 0.6 * gain); send[i0 + i] += s * 0.12;
  }
}

// ---------- new instruments, in the same family ----------
function pluck(t0, midi, { gain = 1, pan = 0 } = {}) {
  const o1 = saw(hz(midi)), o2 = saw(hz(midi) * 1.003), f = svf();
  const i0 = Math.round(t0 * SR), n = Math.round(0.26 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, amp = Math.min(1, t / 0.002) * Math.exp(-t * 14);
    const s = f((o1() + o2()) * 0.5, 400 + 3800 * Math.exp(-t * 30), 2.8)[0] * amp * 0.16 * gain;
    put(synth, i0 + i, s, pan); send[i0 + i] += s * 0.7;
  }
}
function pad(t0, dur, midis, gain = 1) {
  const os = midis.flatMap(m => [saw(hz(m) * 0.997), saw(hz(m) * 1.003)]), f = svf(), g = svf();
  const i0 = Math.round(t0 * SR), n = Math.round((dur + 0.6) * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, amp = Math.min(1, t / 0.9) * (t < dur ? 1 : Math.exp(-(t - dur) * 5));
    let l = 0, r = 0;
    os.forEach((o, k) => { const v = o(); if (k % 2) r += v; else l += v; });
    const cut = 380 + 900 * Math.min(1, t / dur);
    const sl = f(l / os.length, cut, 0.9)[0] * amp * 0.5 * gain, sr2 = g(r / os.length, cut, 0.9)[0] * amp * 0.5 * gain;
    if (i0 + i < N) { fx[0][i0 + i] += sl; fx[1][i0 + i] += sr2; send[i0 + i] += (sl + sr2) * 0.3; }
  }
}
function siren(t0, dur, midi, gain = 1) {
  const f = svf(), base = hz(midi);
  let ph = 0;
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, amp = Math.min(1, t / 0.8) * Math.min(1, (dur - t) / 0.6);
    ph += base * 2 ** (Math.sin(2 * Math.PI * 0.26 * t) / 12) / SR; ph -= Math.floor(ph);
    const s = f(2 * ph - 1, 1300, 4)[1] * amp * 0.11 * gain;
    put(synth, i0 + i, s, Math.sin(t * 0.9) * 0.6); send[i0 + i] += s * 0.8;
  }
}
function snare(t0, gain = 1) {
  const f = svf(), i0 = Math.round(t0 * SR), n = Math.round(0.18 * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += 2 * Math.PI * (190 + 60 * Math.exp(-t * 40)) / SR;
    const s = (f(noise(), 3200, 0.8)[1] * Math.exp(-t * 26) * 0.5 + Math.sin(ph) * Math.exp(-t * 30) * 0.3) * gain;
    put(drums, i0 + i, s, -0.05); send[i0 + i] += s * 0.3;
  }
}
function tom(t0, midi, gain = 1, pan = 0) {
  let ph = 0;
  const i0 = Math.round(t0 * SR), n = Math.round(0.4 * SR), f0 = hz(midi);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += 2 * Math.PI * f0 * (1 + 0.5 * Math.exp(-t * 25)) / SR;
    put(drums, i0 + i, Math.tanh(Math.sin(ph) * Math.exp(-t * 9) * 1.4) * 0.45 * gain, pan);
  }
}
function crash(t0, gain = 1) {
  const f = svf(), i0 = Math.round(t0 * SR), n = Math.round(2.2 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, s = f(noise(), 6500, 0.7)[2] * Math.exp(-t * 2.2) * 0.22 * gain;
    put(drums, i0 + i, s, Math.sin(t * 7) * 0.3); send[i0 + i] += s * 0.2;
  }
}

// ---------- the piece: F minor (the demo's E minor a semitone up), a tritone for menace ----------
const F1 = 29, Ab1 = 32, Bb1 = 34, B1 = 35, Db2 = 37, Eb2 = 39, C2 = 36, F3 = 53, Ab3 = 56, Bb3 = 58, B3 = 59, C4 = 60, Eb4 = 63, F4 = 65, G4 = 67, Ab4 = 68;
const RIFF = [
  [[0, F3], [3, F3], [6, Ab3], [8, F3], [11, B3], [12, Bb3], [14, Ab3]],
  [[0, F3], [3, F3], [6, Ab3], [8, Bb3], [10, C4], [12, Eb4], [14, C4]],
];
const LEAD = [F4, Eb4, C4 + 12, B3 + 12, Ab4, F4, G4, Ab4, Ab4, G4, F4, Eb4, C4 + 12, B3 + 12, Ab4, F4];
const ARP = [F3 + 12, Ab3 + 12, C4 + 12, Eb4 + 12, C4 + 12, Ab3 + 12, F3 + 12, C4];
const SECTIONS = [['intro', 8], ['a1', 16], ['a2', 8], ['break', 8], ['b1', 16], ['bridge', 16], ['b2', 16], ['outro', 4]];
const starts = {};
{ let b = 0; for (const [name, n] of SECTIONS) { starts[name] = [b, b + n]; b += n; } if (b !== BARS) throw new Error(`sections add to ${b} bars, not ${BARS}`); }
const section = bar => Object.entries(starts).find(([, [a, b]]) => bar >= a && bar < b)[0];

function fullBar(bar, { b = false, big = false, riffUp = false } = {}) {
  for (const s of [0, 4, 8, 12]) kick(at(bar, s));
  if (b && bar % 2 === 1) kick(at(bar, 14), 0.7);
  for (const s of [4, 12]) clap(at(bar, s));
  for (let s = 0; s < 16; s++) {
    if (s % 4 === 2) hat(at(bar, s), true, big ? 1.1 : 1, 0.35);
    else if (b || s % 2 === 1) hat(at(bar, s), false, s % 2 ? 0.55 : 0.8, s % 2 ? -0.5 : 0.5);
  }
  const turn = bar % 4 === 3;
  for (let q = 0; q < 4; q++) for (let k = 1; k <= 3; k++) {
    const note = turn && q === 3 ? [Ab1, Bb1, B1][k - 1] : turn && q === 2 && k === 3 ? Ab1 : F1;
    bassNote(at(bar, q * 4 + k), STEP * 0.85, note, { open: b ? 1 : 0.75 });
  }
  for (const [s, m] of RIFF[bar % 2]) stab(at(bar, s), STEP * (s === 12 ? 2.6 : 1.6), m + (riffUp && bar % 2 ? 12 : 0), { pan: s % 4 ? 0.5 : -0.5, bright: b ? 1.15 : 0.95 });
}
function arpBar(bar, gain = 1) {
  const turn = bar % 4 === 3;
  for (let s = 0; s < 16; s++) {
    let m = ARP[s % 8];
    if (turn && s >= 12) m = [Ab3, Bb3, B3, C4][s - 12] + 12;
    pluck(at(bar, s), m, { gain: gain * (s % 4 === 0 ? 1 : 0.7), pan: s % 2 ? 0.45 : -0.45 });
  }
}

drone(0, BARS * BAR + 1.5, F1 + 12, 1);
for (let bar = 0; bar < BARS; bar++) {
  const sec = section(bar), [s0, s1] = starts[sec], k = bar - s0, last = bar === s1 - 1;
  if (sec === 'intro') {
    for (let s = 0; s < 16; s += 2) bassNote(at(bar, s), STEP * 1.1, F1, { open: 0.06 + k * 0.06, gain: 0.8 });
    if (k >= 2) for (let s = 2; s < 16; s += 4) hat(at(bar, s), false, 0.5 + k * 0.06, 0.2);
    if (k >= 4) for (const [s, m] of RIFF[bar % 2].slice(0, k >= 6 ? 5 : 3)) stab(at(bar, s), STEP * 1.5, m, { gain: 0.3 + (k - 4) * 0.05, bright: 0.2 + (k - 4) * 0.06 });
    if (k >= 6) for (let s = 0; s < 16; s += 2) pluck(at(bar, s), ARP[(s / 2) % 8], { gain: 0.35 + (k - 6) * 0.2, pan: s % 4 ? 0.4 : -0.4 });
    if (last) { riser(at(bar, 0), BAR, 1); for (let s = 8; s < 16; s++) hat(at(bar, s), false, 0.5 + s * 0.05, -0.2); for (const s of [12, 14]) kick(at(bar, s), 0.6); }
    continue;
  }
  if (sec === 'a1' || sec === 'a2') {
    if (k === 0) { boom(at(bar, 0), 1); crash(at(bar, 0), sec === 'a1' ? 1 : 0.8); }
    fullBar(bar, { riffUp: sec === 'a2' });
    if (sec === 'a2') arpBar(bar, 0.8);
    if (sec === 'a1' && (k === 7 || last)) for (let s = 12; s < 16; s++) clap(at(bar, s), 0.5 + (s - 12) * 0.15);
    if (sec === 'a2' && last) for (const [s, m] of [[8, 50], [10, 47], [12, 45], [14, 42]]) tom(at(bar, s), m, 1, (s - 11) * 0.15);
    continue;
  }
  if (sec === 'break') {
    if (k === 0) { boom(at(bar, 0), 0.9); lead(at(bar, 0), BAR * 1.9, F4, 0.9); }
    for (const [s, m] of RIFF[bar % 2]) stab(at(bar, s), STEP * 1.8, m, { gain: k < 4 ? 0.55 : 0.4, bright: 0.45, pan: s % 4 ? 0.3 : -0.3 });
    for (let s = 0; s < 16; s += 4) bassNote(at(bar, s), STEP * 3.2, [F1, Db2 - 12, Eb2 - 12, C2 - 12][k >= 4 ? k - 4 : 0], { open: 0.15, gain: 0.7 });
    if (k >= 4) {
      pad(at(bar, 0), BAR, [[F3, Ab3, C4], [Db2 + 12, F3, Ab3], [Eb2 + 12, G4 - 12, Bb3], [C4 - 12, F3 - 1, G4 - 12]][k - 4], 0.9);
      kick(at(bar, 0), 0.5); kick(at(bar, 1), 0.35);
    }
    if (k === 6) for (let s = 0; s < 16; s += 2) snare(at(bar, s), 0.25 + s * 0.02);
    if (last) { riser(at(bar, 0), BAR, 1.2); for (let s = 0; s < 16; s++) snare(at(bar, s), 0.4 + s * 0.035); for (const s of [12, 13, 14, 15]) kick(at(bar, s), 0.55 + (s - 12) * 0.1); }
    continue;
  }
  if (sec === 'b1' || sec === 'b2') {
    if (k === 0 || (sec === 'b2' && k === 8)) { boom(at(bar, 0), 1); crash(at(bar, 0), 1); }
    fullBar(bar, { b: true, big: sec === 'b2', riffUp: true });
    if (sec === 'b1') lead(at(bar, 0), BAR * 0.95, LEAD[k], 0.8);
    else {
      lead(at(bar, 0), BAR * 0.47, LEAD[k], 0.85); lead(at(bar, 8), BAR * 0.47, LEAD[(k + 1) % 16] + (k % 4 === 3 ? 12 : 0), 0.7);
      arpBar(bar, 0.65);
    }
    if (k === 7 || last) for (let s = 12; s < 16; s++) clap(at(bar, s), 0.5 + (s - 12) * 0.15);
    continue;
  }
  if (sec === 'bridge') {
    const root = [F1, F1, Db2 - 12, Db2 - 12, Bb1, Bb1, C2, C2][Math.floor(k / 2) % 8];
    kick(at(bar, 0)); kick(at(bar, 10), 0.8);
    if (k % 4 === 3) kick(at(bar, 14), 0.6);
    clap(at(bar, 8), 1.1);
    for (let s = 2; s < 16; s += 4) hat(at(bar, s), k >= 8, k >= 8 ? 0.7 : 0.6, 0.3);
    bassNote(at(bar, 0), STEP * 7.5, root, { open: 0.4, gain: 0.9 });
    bassNote(at(bar, 8), STEP * 3.5, root, { open: 0.3, gain: 0.8 });
    bassNote(at(bar, 12), STEP * 3.5, k % 2 ? root + 7 : root, { open: 0.3, gain: 0.75 });
    if (k % 4 === 0) siren(at(bar, 0), BAR * 3.8, root + 36 + (k >= 8 ? 12 : 0), k >= 8 ? 1.2 : 1);
    if (k >= 8) for (const [s, m] of RIFF[bar % 2].slice(0, 2 + Math.floor((k - 8) / 2))) stab(at(bar, s), STEP * 1.4, m, { gain: 0.4, bright: 0.3 + (k - 8) * 0.08, pan: s % 4 ? 0.4 : -0.4 });
    if (k === 0) boom(at(bar, 0), 0.8);
    if (bar === s1 - 2) for (let s = 0; s < 16; s += 2) snare(at(bar, s), 0.3 + s * 0.02);
    if (last) { riser(at(bar, 0), BAR, 1.3); for (let s = 0; s < 16; s++) snare(at(bar, s), 0.45 + s * 0.035); for (const [s, m] of [[12, 50], [13, 47], [14, 45], [15, 42]]) tom(at(bar, s), m, 0.9, (s - 13.5) * 0.2); }
    continue;
  }
  if (k === 0) crash(at(bar, 0), 0.8);
  for (const s of [0, 4, 8, 12]) kick(at(bar, s), 1 - k * 0.15);
  if (k < 2) for (const s of [4, 12]) clap(at(bar, s), 0.8);
  for (let s = 2; s < 16; s += 4) hat(at(bar, s), true, 0.9 - k * 0.15, 0.35);
  for (const [s, m] of RIFF[bar % 2]) stab(at(bar, s), STEP * 1.6, m, { gain: 0.9 - k * 0.15, pan: s % 4 ? 0.5 : -0.5, bright: 0.9 - k * 0.12 });
  for (let s = 0; s < 16; s += 4) bassNote(at(bar, s), STEP * 2.2, F1, { open: 0.5, gain: 0.8 });
}
boom(at(BARS, 0), 1.1); stab(at(BARS, 0), 1.2, F3, { gain: 1.1 }); stab(at(BARS, 0), 1.2, F3 - 12, { gain: 0.9 });

// ---------- the kick pushes everything else down for a moment (the pump) ----------
const duck = new Float32Array(N).fill(1);
for (const t0 of kicks) { const i0 = Math.round(t0 * SR); for (let i = 0; i < 0.3 * SR && i0 + i < N; i++) duck[i0 + i] = Math.min(duck[i0 + i], 1 - 0.62 * Math.exp(-(i / SR) * 11)); }

// ---------- echo and room ----------
const wet = bus();
{
  const d = Math.round(STEP * 3 * SR), bl = new Float32Array(N), br = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const inL = send[i] + (i >= d ? br[i - d] * 0.42 : 0), inR = (i >= d ? bl[i - d] * 0.42 : 0);
    bl[i] = inL; br[i] = inR;
    if (i + d < N) { wet[0][i + d] += inL * 0.3; } if (i + 2 * d < N) { wet[1][i + 2 * d] += inL * 0.22; }
  }
  for (const [ch, taps] of [[0, [1557, 1617, 1491, 1422]], [1, [1583, 1640, 1513, 1447]]]) {
    for (const tap of taps) {
      const buf = new Float32Array(tap); let w = 0, lp = 0;
      for (let i = 0; i < N; i++) { const y = buf[w]; lp = y * 0.6 + lp * 0.4; buf[w] = send[i] * 0.5 + lp * 0.8; w = (w + 1) % tap; wet[ch][i] += y * 0.045; }
    }
  }
}

// ---------- the mix ----------
const out = drums;
let hpL = 0, hpR = 0, pL = 0, pR = 0, peak = 0;
for (let i = 0; i < N; i++) {
  const d = duck[i];
  const l = drums[0][i] + (bass[0][i] + synth[0][i] * 0.9 + fx[0][i] + wet[0][i]) * d;
  const r = drums[1][i] + (bass[1][i] + synth[1][i] * 0.9 + fx[1][i] + wet[1][i]) * d;
  hpL = 0.996 * (hpL + l - pL); pL = l; hpR = 0.996 * (hpR + r - pR); pR = r;
  out[0][i] = Math.tanh(hpL * 0.9); out[1][i] = Math.tanh(hpR * 0.9);
  peak = Math.max(peak, Math.abs(out[0][i]), Math.abs(out[1][i]));
}
const norm = 0.89 / peak, fade = Math.round(1.2 * SR);
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
let bad = 0;
for (let i = 0; i < N; i++) {
  const g = norm * Math.min(1, (N - i) / fade);
  for (let c = 0; c < 2; c++) {
    const v = out[c][i] * g;
    if (!Number.isFinite(v)) bad++;
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 4 + c * 2);
  }
}
if (bad) throw new Error(`${bad} broken samples`);
fs.mkdirSync(work, { recursive: true });
const mine = path.join(work, 'range-run.wav');
fs.writeFileSync(mine, pcm);
console.log(mine, (N / SR).toFixed(1) + ' s', 'peak before levelling', peak.toFixed(3));
for (const [name, [a, b]] of Object.entries(starts)) console.log('  ' + name.padEnd(7), `bars ${a}-${b - 1}`, `${(a * BAR).toFixed(1)}-${(b * BAR).toFixed(1)} s`);

// ---------- levelled to his song, then joined on his beat ----------
const ffmpeg = (...args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.slice(-2000));
  return r.stderr;
};
const loudness = file => +/I:\s+(-?[\d.]+) LUFS/.exec(ffmpeg('-i', file, '-af', 'ebur128', '-f', 'null', '-').split('Summary:').pop())[1];
const gain = +(HIS.loud - loudness(mine)).toFixed(2);
const join = +(HIS.beat0 + HIS.join * BEAT).toFixed(4), over = +(HIS.end - join).toFixed(3);
const target = path.join(ROOT, 'web/assets/range/music/run.mp3');
fs.mkdirSync(path.dirname(target), { recursive: true });
ffmpeg('-y', '-i', song, '-i', mine, '-filter_complex',
  `[0:a]atrim=0:${HIS.end},afade=t=out:st=${join}:d=${over}:curve=qsin[a];` +
  `[1:a]volume=${gain}dB,afade=t=in:st=0:d=2.5:curve=qsin,adelay=${Math.round(join * 1000)}:all=1[b];` +
  '[a][b]amix=inputs=2:normalize=0:duration=longest[o]',
  '-map', '[o]', '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-q:a', '5', '-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '1', target);
console.log('my track levelled by', gain, 'dB; it starts at', join, 's on his beat', HIS.join, 'and the two overlap', over, 's');
console.log(target, (fs.statSync(target).size / 1048576).toFixed(2), 'MB,', 'loudness', loudness(target), 'LUFS');


import { makeRng } from './rng.js';
import { MODES, CHORDS, degree, voiceChord } from './notes.js';

export const RECORDS = [
  { id: 'night-shift', title: 'Night Shift', mood: 'Chill lo-fi hip hop: dusty drums, warm Rhodes chords, vinyl crackle', bpm: 80, beatsPerBar: 4, bars: 32 },
  { id: 'lions-gate', title: 'Lions Gate', mood: 'Synthwave night drive: arpeggios, pads, gated snare', bpm: 100, beatsPerBar: 4, bars: 40 },
  { id: 'dastgah', title: 'Dastgah', mood: 'Persian-inspired: santur in Shur over tombak and a soft drone', bpm: 60, beatsPerBar: 2, bars: 46 },
  { id: 'rain-piano', title: 'Rain Piano', mood: 'Soft solo piano', bpm: 68, beatsPerBar: 4, bars: 26 },
];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function generateRecord(id) {
  const rec = RECORDS.find(r => r.id === id);
  if (!rec) return null;
  const beatDur = 60 / rec.bpm, duration = rec.bars * rec.beatsPerBar * beatDur;
  const r = makeRng('record:' + id);
  const events = [];
  const add = (beats, i, m, v, dBeats, extra) => events.push({ t: beats * beatDur, i, m, v: clamp(v, 0.02, 1), d: Math.max(0.01, dBeats * beatDur), ...extra });
  GEN[id](r, add);
  for (const e of events) e.t = clamp(e.t, 0, duration - 1e-3);
  events.sort((a, b) => a.t - b.t);
  return { ...rec, beatDur, duration, events };
}

function nightShift(r, add) {
  const tonic = 53 + r.pick([0, -3, 2]);
  const progs = [
    [[1, 'm9'], [4, 'dom9'], [0, 'maj9'], [5, 'm7']],
    [[0, 'maj7'], [2, 'm7'], [5, 'm9'], [3, 'maj7']],
    [[3, 'maj9'], [2, 'm7'], [1, 'm9'], [0, 'maj7']],
    [[5, 'm9'], [1, 'm7'], [4, 'dom9'], [0, 'maj9']],
  ];
  const A = r.pick(progs), B = progs[(progs.indexOf(A) + 1 + r.int(0, 2)) % progs.length];
  const sw = 0.08;
  const pos = (bar, step) => bar * 4 + Math.floor(step / 4) + [0, 0.25 + sw / 2, 0.5 + sw, 0.75 + sw / 2][step % 4];
  const chordAt = bar => (bar >= 16 && bar < 24 ? B : A)[bar % 4];
  const bassOf = deg => { let b = degree(tonic, MODES.major, deg); while (b > 48) b -= 12; while (b < 36) b += 12; return b; };
  const kicks = [[0, 10], [0, 7, 10], [0, 3, 10], [0, 10, 14]];
  let mel = 5;
  for (let bar = 0; bar < 32; bar++) {
    const [deg, q] = chordAt(bar);
    const root = degree(tonic, MODES.major, deg), bass = bassOf(deg);
    const drums = (bar >= 4 && bar < 16) || bar >= 20, brk = bar >= 16 && bar < 20, fill = drums && bar % 8 === 7;
    const notes = voiceChord(root, q.endsWith('9') ? CHORDS[q].slice(1) : CHORDS[q], 63);
    const pat = r.pick([[[0, 2.4], [2.5, 1.4]], [[0, 3.8]], [[0, 1.4], [1.5, 0.9], [2.5, 1.4]], [[0, 2.4], [3.5, 0.5]]]);
    for (const [b, d] of pat) {
      const at = bar * 4 + b + (b % 1 ? sw : 0), v = r.range(0.42, 0.56) * (b ? 0.85 : 1);
      notes.forEach((m, k) => add(at + k * 0.022 + r.jitter(0.008), 'rhodes', m, v - k * 0.02, d));
    }
    if (bar >= 2 && !(brk && bar % 2)) {
      add(bar * 4 + r.jitter(0.008), 'lbass', bass, r.range(0.7, 0.8), 1.6);
      add(bar * 4 + 2.5 + sw, 'lbass', r.pick([bass, bass + 7, bass + 12, bass]), 0.6, 1.1);
      if (r.chance(0.3)) add(bar * 4 + 3.5 + sw, 'lbass', bassOf(chordAt((bar + 1) % 32)[0]) - 1, 0.5, 0.45);
    }
    if (drums) {
      for (const s of fill ? [0, 10] : r.pick(kicks)) add(pos(bar, s) + r.jitter(0.008), 'lkick', 0, s === 0 ? 0.95 : 0.8, 0.5);
      add(pos(bar, 4) + r.jitter(0.01), 'lsnare', 0, 0.8, 0.5);
      add(pos(bar, 12) + r.jitter(0.01), 'lsnare', 0, 0.85, 0.5);
      if (r.chance(0.3)) add(pos(bar, r.pick([7, 15])), 'lsnare', 0, 0.18, 0.2);
      if (fill) for (const s of [13, 14, 15]) add(pos(bar, s), 'lsnare', 0, 0.25 + (s - 13) * 0.12, 0.2);
    }
    if (drums || brk) {
      for (let s = 0; s < 16; s += 2) add(pos(bar, s) + r.jitter(0.012), 'lhat', 0, (s % 4 ? 0.22 : 0.34) * r.range(0.8, 1.1), 0.1);
      if (r.chance(0.25)) add(pos(bar, 15), 'lhat', 0, 0.16, 0.1);
      if (brk) add(pos(bar, 12), 'rim', 0, 0.45, 0.1);
    }
    if (bar === 3) add(bar * 4 + 3.5 + sw, 'lkick', 0, 0.5, 0.5);
    if (bar >= 20 && bar < 31 && bar % 4 !== 3) {
      for (const b of r.pick([[0, 1.5], [0.5, 1, 2.5], [0, 2], [1.5, 2, 3], [0, 0.5, 1.5]])) {
        mel = clamp(mel + r.weighted([[-2, 1], [-1, 3], [0, 1], [1, 3], [2, 1]]), 3, 8);
        add(bar * 4 + b + (b % 1 ? sw : 0) + r.jitter(0.01), 'keys', degree(tonic + 12, MODES.majorPent, mel), r.range(0.35, 0.5), r.pick([0.5, 1, 1.5]));
      }
    }
  }
}

function lionsGate(r, add) {
  const tonic = r.pick([45, 43, 40]);
  const progs = [
    [[0, 'min'], [5, 'maj'], [2, 'maj'], [6, 'maj']],
    [[0, 'min'], [5, 'maj'], [6, 'maj'], [4, 'min']],
    [[0, 'min'], [3, 'min'], [5, 'maj'], [6, 'maj']],
  ];
  const P = r.pick(progs);
  const arp = r.pick([
    [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
    [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1],
    [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 1, 3, 2, 4, 3, 1],
  ]);
  const pump = r.chance(0.6);
  const cells = [[[0, 1.5], [1.5, 0.5], [2, 2]], [[0, 1], [1, 1], [2, 1], [3, 1]], [[0, 3], [3, 1]], [[0.5, 0.5], [1, 1], [2, 1.5], [3.5, 0.5]]];
  let mel = 4;
  for (let bar = 0; bar < 40; bar++) {
    const [deg, q] = P[bar % 4];
    let root = degree(tonic, MODES.minor, deg);
    if (root > tonic + 6) root -= 12;
    const ch = CHORDS[q];
    const sec = bar < 4 ? 'intro' : bar < 16 ? 'a' : bar < 24 ? 'b' : bar < 28 ? 'brk' : 'a2';
    const bright = { intro: 0.15 + bar * 0.1, a: 0.6, b: 0.8, brk: 0.4, a2: 1 }[sec];
    for (const m of voiceChord(root, ch, 64)) add(bar * 4, 'pad', m, sec === 'intro' ? 0.4 : 0.55, 4.25);
    let R = root + 12;
    while (R < 55) R += 12;
    const tones = [R, R + ch[1], R + 7, R + 12, R + 12 + ch[1]];
    for (let s = 0; s < 16; s++) add(bar * 4 + s / 4, 'arp', tones[arp[s]], (s % 4 ? 0.32 : 0.44) * (sec === 'intro' ? 0.7 : 1), 0.22, { x: bright });
    if (sec !== 'intro') {
      if (sec === 'brk') add(bar * 4, 'sbass', root, 0.7, 3.5);
      else for (let k = 0; k < 8; k++) add(bar * 4 + k / 2, 'sbass', pump && k % 2 ? root + 12 : root, k % 2 ? 0.6 : 0.75, 0.42);
    }
    if (sec === 'a' || sec === 'b' || sec === 'a2') {
      for (let b = 0; b < 4; b++) add(bar * 4 + b, 'skick', 0, b ? 0.85 : 0.95, 0.4);
      add(bar * 4 + 1, 'gsnare', 0, 0.8, 0.3);
      add(bar * 4 + 3, 'gsnare', 0, 0.85, 0.3);
      for (let s = 0; s < 16; s++) if (sec !== 'a' || s % 2 === 0) add(bar * 4 + s / 4, 'shat', 0, s % 4 === 2 ? 0.34 : 0.2, 0.05);
      if (sec === 'a2') for (let b = 0; b < 4; b++) add(bar * 4 + b + 0.5, 'sohat', 0, 0.28, 0.2);
    }
    if (sec === 'brk') add(bar * 4, 'skick', 0, 0.8, 0.4);
    if (bar === 3 || bar === 27) for (let s = 0; s < 4; s++) add(bar * 4 + 3 + s / 4, 'gsnare', 0, 0.3 + s * 0.15, 0.2);
    if ((sec === 'b' || sec === 'a2') && bar < 39) {
      const end = bar % 2 === 1;
      const cell = end ? r.pick([[[0, 1], [1, 3]], [[0, 4]], [[0, 1.5], [1.5, 2.5]]]) : r.pick(cells);
      cell.forEach(([b, d], k) => {
        mel = clamp(mel + r.weighted([[-2, 1], [-1, 3], [0, 0.5], [1, 3], [2, 1]]), 1, 8);
        if (end && k === cell.length - 1) mel = r.pick([0, 2, 3, 5]);
        add(bar * 4 + b, 'lead', degree(tonic + 24, MODES.minorPent, mel), r.range(0.5, 0.62), d * 0.95);
      });
    }
  }
}

function dastgah(r, add) {
  const T = 62, E = 1 / 3, mode = MODES.shur;
  const deg = d => degree(T, mode, d);
  for (let bar = 0; bar < 46; bar += 4) add(bar * 2, 'drone', 50, 0.6, Math.min(4, 46 - bar) * 2 + 1.2);
  const slow = [[6], [3, 3], [4, 2], [2, 4]];
  const reng = [[2, 1, 2, 1], [1, 1, 1, 2, 1], [3, 1, 1, 1], [2, 1, 3], [1, 1, 1, 1, 1, 1], [2, 1, 2, 1]];
  const forud = { 40: [[2, 4], [1, 3], [1, 2], [2, 3]], 41: [[3, 2], [3, 1]], 42: [[2, 2], [1, 1], [3, 0]], 43: [[1, 1], [1, 2], [1, 1], [3, 0]], 44: [[6, 0]], 45: [] };
  const ranges = { avaz: [-1, 4, 1], reng: [-2, 6, 2], owj: [3, 9, 7] };
  let d = 0;
  for (let bar = 0; bar < 46; bar++) {
    const sec = bar < 8 ? 'avaz' : bar < 32 ? 'reng' : bar < 40 ? 'owj' : 'forud';
    const end = bar % 2 === 1;
    let notes;
    if (sec === 'forud') notes = forud[bar];
    else if (bar === 0) notes = [[6, 0]];
    else {
      const [lo, hi, center] = ranges[sec];
      const cell = sec === 'avaz' ? r.pick(slow) : end ? r.pick([[2, 1, 3], [3, 3], [1, 1, 1, 3]]) : r.pick(reng);
      notes = cell.map((len, k) => {
        let step = r.weighted([[-1, 5], [1, 5], [0, 1.5], [-2, 1.5], [2, 1.5], [3, 0.4], [-3, 0.4]]);
        if (d + step > hi || d + step < lo) step = -step;
        d = clamp(d + step, lo, hi);
        if (Math.abs(d - center) > 3) d += Math.sign(center - d);
        if (end && k === cell.length - 1) d = r.pick(sec === 'owj' ? [7, 5, 3] : bar % 4 === 3 ? [0, 0, 2] : [2, 3, 0]);
        return [len, d];
      });
    }
    let at = 0;
    notes.forEach(([len, dd], k) => {
      const m = deg(dd), t = bar * 2 + at * E + r.jitter(0.01), riz = len >= 3;
      add(t, 'santur', m, (k === 0 ? 0.7 : 0.56) + r.jitter(0.05), len * E, { riz });
      if (k === 0 && m - 12 >= 50 && r.chance(0.35)) add(t + 0.01, 'santur', m - 12, 0.42, len * E, { riz: false });
      if (!riz && k > 0 && r.chance(0.12)) add(t - 0.07, 'santur', deg(dd + 1), 0.3, 0.07, { riz: false });
      at += len;
    });
    if (bar >= 8 && bar < 44) {
      const fill = bar % 4 === 3;
      const pat = fill ? 'T.b' : sec === 'owj' ? r.pick(['TkbTbk', 'T.bTbk']) : r.pick(['T.bTb.', 'TkbTb.', 'T.bTbk', 'T.bTb.']);
      [...pat].forEach((c, p) => {
        if (c === 'T') add(bar * 2 + p * E, 'tom', 0, p === 0 ? 0.95 : 0.72, 0.5);
        else if (c === 'b') add(bar * 2 + p * E, 'bak', 0, 0.6 + r.jitter(0.06), 0.2);
        else if (c === 'k') add(bar * 2 + p * E, 'tik', 0, 0.34 + r.jitter(0.05), 0.1);
      });
      if (fill) for (let s = 0; s < 6; s++) add(bar * 2 + (3 + s / 2) * E, s === 5 ? 'bak' : 'tik', 0, 0.3 + s * 0.08, 0.1);
    }
    if (bar === 44) add(bar * 2, 'tom', 0, 0.9, 0.6);
  }
}

function rainPiano(r, add) {
  const tonic = r.pick([49, 51, 48]);
  const progs = [
    [[0, 'maj'], [4, 'maj'], [5, 'min'], [3, 'maj']],
    [[0, 'maj'], [2, 'min'], [3, 'maj'], [3, 'min']],
    [[5, 'min'], [3, 'maj'], [0, 'maj'], [4, 'maj']],
    [[3, 'maj'], [0, 'maj'], [4, 'maj'], [5, 'min']],
  ];
  const A = r.pick(progs), B = progs[(progs.indexOf(A) + 1 + r.int(0, 2)) % progs.length];
  const lh = r.pick([[0, 7, 14, 'T', 19, 'T', 14, 7], [0, 7, 12, 'T', 19, 'T', 12, 7]]);
  const cells = [[[0, 2], [2, 2]], [[0, 1], [1, 1], [2, 2]], [[0, 3], [3, 1]], [[0, 1.5], [1.5, 0.5], [2, 2]], [[1, 1], [2, 1], [3, 1]]];
  const top = tonic + 12;
  const pitch = d => degree(top, MODES.major, d);
  let d = 7;
  for (let bar = 0; bar < 26; bar++) {
    const [deg, q] = bar >= 24 ? (bar === 24 ? [3, 'maj'] : [0, 'maj']) : (bar >= 10 && bar < 18 ? B : A)[bar % 4];
    let root = degree(tonic, MODES.major, deg);
    while (root > tonic + 5) root -= 12;
    const third = q === 'min' ? 3 : 4;
    if (bar === 25) {
      [0, 7, 12 + third, 19].forEach((o, k) => add(bar * 4 + k * 0.12, 'piano', root + o, 0.4 - k * 0.03, 3.8));
      add(bar * 4 + 0.6, 'piano', pitch(7), 0.36, 3.4);
      continue;
    }
    lh.forEach((o, k) => add(bar * 4 + k / 2 + r.jitter(0.015), 'piano', root + (o === 'T' ? 12 + third : o), (k ? 0.32 : 0.4) + r.jitter(0.03), (8 - k) / 2 + 0.3));
    if (bar < 2 || bar >= 24) continue;
    const pcs = [0, third, 7].map(x => (((root + x) % 12) + 12) % 12);
    const tone = dd => [0, -1, 1, -2, 2].map(o => dd + o).find(x => pcs.includes(((pitch(x) % 12) + 12) % 12)) ?? dd;
    const center = bar >= 10 && bar < 18 ? 9 : 7;
    const phraseEnd = bar % 4 === 1;
    const cell = phraseEnd ? r.pick([[[0, 4]], [[0, 3]]]) : r.pick(cells);
    cell.forEach(([b, len], k) => {
      d = clamp(d + r.weighted([[-1, 4], [1, 4], [-2, 1.5], [2, 1.5], [0, 1]]), 3, 12);
      if (Math.abs(d - center) > 3) d += Math.sign(center - d);
      if (b === 0 || phraseEnd) d = tone(d);
      const v = r.range(0.42, 0.54) + (k === 0 ? 0.04 : 0);
      add(bar * 4 + b + r.jitter(0.012), 'piano', pitch(d), v, len * 1.15);
      if (len >= 2 && r.chance(0.25)) add(bar * 4 + b + 0.02, 'piano', pitch(d - 2), v * 0.7, len * 1.1);
    });
  }
}

const GEN = { 'night-shift': nightShift, 'lions-gate': lionsGate, dastgah, 'rain-piano': rainPiano };

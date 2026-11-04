import { noteToMidi } from './notes.js';

const alt = (n, a, b) => Array.from({ length: n }, (_, i) => (i % 2 ? b : a));
const bars = (...xs) => xs.flat().join(' | ');

const GYM_PHRASE = ['r:1 F#5:1 A5:1', 'G5:1 F#5:1 C#5:1', 'B4:1 C#5:1 D5:1', 'A4:3', 'F#4:12'];

const FE_A = ['E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5', 'A4:1 r:.5 C4:.5 E4:.5 A4:.5', 'B4:1 r:.5 E4:.5 G#4:.5 B4:.5', 'C5:1 r:.5 E4:.5 E5:.5 D#5:.5',
  'E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5', 'A4:1 r:.5 C4:.5 E4:.5 A4:.5', 'B4:1 r:.5 E4:.5 C5:.5 B4:.5'];
const FE_B = ['E5:1.5 G4:.5 F5:.5 E5:.5', 'D5:1.5 F4:.5 E5:.5 D5:.5', 'C5:1.5 E4:.5 D5:.5 C5:.5', 'B4:1 r:.5 E4:.5 E5:.5 D#5:.5'];
const LA = 'A2:.5 E3:.5 A3:.5 r:1.5', LE = 'E2:.5 E3:.5 G#3:.5 r:1.5';
const FE_LA = ['r:3', LA, LE, LA, 'r:3', LA, LE];
const FE_LB = ['C3:.5 G3:.5 C4:.5 r:1.5', 'G2:.5 G3:.5 B3:.5 r:1.5', LA, LE];

const ODE_1 = ['E5:1 E5:1 F5:1 G5:1', 'G5:1 F5:1 E5:1 D5:1', 'C5:1 C5:1 D5:1 E5:1'];
const ODE_L1 = ['C3+G3:4', 'G2+D3:4', 'C3+G3:4'];

export const SONGS = [
  {
    id: 'gymnopedie', title: 'Gymnopedie No. 1', composer: 'Erik Satie, 1888', bpm: 72, beatsPerBar: 3, pedal: true,
    parts: {
      lead: bars('r:3', 'r:3', 'r:3', 'r:3', GYM_PHRASE, GYM_PHRASE, 'r:3'),
      bass: bars(alt(20, 'G2:3', 'D2:3'), 'G2:3'),
      chords: bars(alt(20, 'r:1 B3+D4+F#4:2', 'r:1 A3+C#4+F#4:2'), 'r:1 B3+D4+F#4:2'),
    },
    vel: { lead: 0.56, bass: 0.44, chords: 0.3 },
    duet: { part: 'lead', fromBar: 12, transpose: 12, vel: 0.42 },
  },
  {
    id: 'fur-elise', title: 'Fur Elise', composer: 'Ludwig van Beethoven, 1810', bpm: 132, beatsPerBar: 3, pedal: true,
    parts: {
      lead: bars('r:2 E5:.5 D#5:.5', FE_A, 'A4:1 r:1 E5:.5 D#5:.5', FE_A, 'A4:1 r:.5 B4:.5 C5:.5 D5:.5', FE_B, FE_A, 'A4:3'),
      left: bars('r:3', FE_LA, LA, FE_LA, LA, FE_LB, FE_LA, 'A2:.5 E3:.5 A3:2'),
    },
    vel: { lead: 0.55, left: 0.4 },
    duet: { part: 'lead', fromBar: 17, transpose: 12, vel: 0.36, minMidi: 69 },
  },
  {
    id: 'ode-to-joy', title: 'Ode to Joy', composer: 'Ludwig van Beethoven, 1824', bpm: 108, beatsPerBar: 4, pedal: false,
    parts: {
      lead: bars(ODE_1, 'E5:1.5 D5:.5 D5:2', ODE_1, 'D5:1.5 C5:.5 C5:2',
        'D5:1 D5:1 E5:1 C5:1', 'D5:1 E5:.5 F5:.5 E5:1 C5:1', 'D5:1 E5:.5 F5:.5 E5:1 D5:1', 'C5:1 D5:1 G4:2',
        ODE_1, 'D5:1.5 C5:.5 C5:2'),
      left: bars(ODE_L1, 'G2+D3:4', ODE_L1, 'G2+D3:2 C3+G3:2',
        'G2+D3:2 C3+G3:2', 'G2+D3:2 C3+G3:2', 'G2+D3:2 C3+G3:2', 'C3+G3:2 G2+D3:2',
        ODE_L1, 'G2+D3:2 C3+G3:2'),
    },
    vel: { lead: 0.58, left: 0.38 },
    duet: { part: 'lead', fromBar: 8, transpose: 12, vel: 0.4 },
  },
];

// Tokens are NOTE:beats, NOTE+NOTE:beats for a chord, r:beats for a rest; '|' marks a bar line and must land on one.
export function parsePart(str) {
  const notes = [], marks = [];
  let beat = 0;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') { marks.push(beat); continue; }
    const m = /^([^:]+):([\d.]+)$/.exec(tok);
    if (!m) throw new Error(`bad token "${tok}"`);
    const dur = +m[2];
    if (!(dur > 0)) throw new Error(`bad length "${tok}"`);
    if (m[1] !== 'r') for (const n of m[1].split('+')) notes.push({ beat, midi: noteToMidi(n), dur });
    beat += dur;
  }
  return { notes, marks, length: beat };
}

export function buildSong(id, { duet = false } = {}) {
  const s = SONGS.find(x => x.id === id);
  if (!s) return null;
  const beatDur = 60 / s.bpm, bpb = s.beatsPerBar, out = [];
  let length = 0;
  for (const [part, str] of Object.entries(s.parts)) {
    const p = parsePart(str);
    length = Math.max(length, p.length);
    for (const n of p.notes) {
      const barEnd = (Math.floor(n.beat / bpb + 1e-9) + 1) * bpb;
      const dur = s.pedal ? Math.max(n.dur, barEnd - n.beat) : n.dur * 0.92;
      const vel = Math.min(1, s.vel[part] + (Math.abs(n.beat % bpb) < 1e-9 ? 0.06 : 0));
      out.push({ t: n.beat * beatDur, midi: n.midi, dur: dur * beatDur, vel, part, who: 'piano' });
      const D = s.duet;
      if (duet && D.part === part && n.beat >= D.fromBar * bpb && n.midi >= (D.minMidi || 0) && n.midi + D.transpose <= 108) {
        out.push({ t: n.beat * beatDur, midi: n.midi + D.transpose, dur: dur * beatDur, vel: D.vel, part: 'duet', who: 'bh22' });
      }
    }
  }
  out.sort((a, b) => a.t - b.t || a.midi - b.midi);
  const duration = Math.max(length * beatDur, ...out.map(n => n.t + n.dur));
  return { id: s.id, title: s.title, composer: s.composer, bpm: s.bpm, beatsPerBar: bpb, beatDur, duration, notes: out };
}

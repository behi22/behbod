// The sheet music on the piano's desk: each song written out in bars, laid out on pages two at a time (an open book),
// and when each page turn starts, in seconds into the song. Pure, so the layout and the timing can be checked.
import { SONGS } from '../audio/pure/songs.js';
import { noteToMidi } from '../audio/pure/notes.js';

// How long a page takes to turn; it lands as the first bar of the next pages starts.
export const TURN = 0.9;
// The note values a page shows, longest first (whole, dotted half, half, dotted quarter, quarter, eighth).
export const VALUES = [4, 3, 2, 1.5, 1, 0.5];
const EPS = 1e-6;

// The song's own tokens: NOTE:beats, NOTE+NOTE:beats for a chord, r:beats for a rest, '|' on a bar line.
export function events(str) {
  const out = [];
  let at = 0;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') continue;
    const m = /^([^:]+):([\d.]+)$/.exec(tok);
    if (!m) throw new Error(`bad token "${tok}"`);
    const dur = +m[2];
    out.push({ at, dur, midis: m[1] === 'r' ? [] : m[1].split('+').map(noteToMidi).sort((a, b) => a - b) });
    at += dur;
  }
  return out;
}

// A length inside one bar as the values a page can show. A rest keeps to the beats (an off-beat eighth first) and a
// rest filling the bar is the one whole-bar rest; a note takes the longest values that fit.
export function pieces(beat, dur, rest, bpb) {
  if (rest && beat < EPS && Math.abs(dur - bpb) < EPS) return [[0, bpb]];
  const out = [];
  let b = beat, d = dur;
  while (d > EPS) {
    let v;
    if (rest) {
      const off = b - Math.floor(b + EPS);
      v = off > EPS ? Math.min(d, 1 - off) : d >= 2 - EPS && Math.round(b) % 2 === 0 ? 2 : d >= 1 - EPS ? 1 : 0.5;
    } else v = VALUES.find(x => x <= d + EPS) || d;
    out.push([b, v]);
    b += v; d -= v;
  }
  return out;
}

// A part cut into bars: [{ beat, dur, midis, tie }] per bar, where `tie` holds the note on into the next piece.
export function measures(str, bpb) {
  const bars = [];
  for (const ev of events(str)) {
    let at = ev.at, left = ev.dur;
    while (left > EPS) {
      const bar = Math.floor(at / bpb + EPS), beat = at - bar * bpb, here = Math.min(left, bpb - beat);
      const ps = pieces(beat, here, !ev.midis.length, bpb);
      (bars[bar] ||= []).push(...ps.map(([b, d]) => ({ beat: b, dur: d, midis: ev.midis, tie: !!ev.midis.length })));
      at += here; left -= here;
    }
    const last = bars[bars.length - 1].at(-1);
    last.tie = false;
  }
  return bars;
}

// Note names are spelled with sharps (the songs are in C, A minor and D): the staff step (C0 = 0, a step per letter)
// and whether it is sharp.
const LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6], SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
export const spell = midi => ({ step: (Math.floor(midi / 12) - 1) * 7 + LETTER[midi % 12], sharp: !!SHARP[midi % 12] });
// The letters a key signature sharpens, in the order they are written: F C G D A E B.
const ORDER = [3, 0, 4, 1, 5, 2, 6];
export const keyLetters = sharps => ORDER.slice(0, sharps);

// The sign each notehead needs: '#', 'n' (a natural) or ''. A sign lasts to the end of the bar at that step, and a note
// tied over from the bar before needs none.
export function accidentals(pieceList, sharps) {
  const key = new Set(keyLetters(sharps)), now = new Map();
  return pieceList.map(p => p.midis.map(m => {
    const { step, sharp } = spell(m), was = now.has(step) ? now.get(step) : key.has(step % 7);
    now.set(step, sharp);
    return p.held || was === sharp ? '' : sharp ? '#' : 'n';
  }));
}

// Eighths are beamed in pairs within a beat; a lone eighth keeps its flag.
export function beams(voice) {
  const groups = [];
  for (let i = 0; i < voice.length; i++) {
    const a = voice[i], b = voice[i + 1];
    if (a.midis.length && b?.midis.length && Math.abs(a.dur - 0.5) < EPS && Math.abs(b.dur - 0.5) < EPS && Math.abs(a.beat - Math.floor(a.beat + EPS)) < EPS && Math.abs(b.beat - a.beat - 0.5) < EPS) { groups.push([i, i + 1]); i++; }
  }
  return groups;
}

// Bars per page, two systems to a page, with every page break on a phrase end; a turn shows two new pages.
export function systemsOf(n) { return n <= 3 ? [n] : [Math.floor(n / 2), Math.ceil(n / 2)]; }

const cache = new Map();
export function score(id) {
  if (cache.has(id)) return cache.get(id);
  const s = SONGS.find(x => x.id === id);
  if (!s) return null;
  const bpb = s.beatsPerBar, barDur = (bpb * 60) / s.bpm;
  const parts = Object.entries(s.parts).map(([name, str]) => {
    const bars = measures(str, bpb), all = bars.flat().flatMap(p => p.midis);
    return { name, bars, mean: all.reduce((a, b) => a + b, 0) / Math.max(1, all.length) };
  });
  const nBars = Math.max(...parts.map(p => p.bars.length));
  // The tune on the upper staff; the rest below, the higher part with its stems up.
  const lower = parts.filter(p => p.name !== 'lead').sort((a, b) => b.mean - a.mean);
  const lead = parts.find(p => p.name === 'lead');
  const bars = Array.from({ length: nBars }, (_, i) => ({ treble: [lead.bars[i] || []], bass: lower.map(p => p.bars[i] || []) }));
  // A note tied over a bar line carries its sign with it.
  for (const staff of ['treble', 'bass']) {
    bars.forEach((bar, i) => bar[staff].forEach((voice, v) => {
      const prev = bars[i - 1]?.[staff][v]?.at(-1);
      if (voice[0] && prev?.tie) voice[0].held = true;
      for (let k = 1; k < voice.length; k++) if (voice[k - 1].tie) voice[k].held = true;
    }));
  }
  const pages = [];
  let at = 0;
  for (const n of s.pages) { pages.push({ from: at, to: at + n, systems: systemsOf(n) }); at += n; }
  if (at !== nBars) throw new Error(`${id}: pages hold ${at} bars, the song has ${nBars}`);
  const spreads = [];
  for (let i = 0; i < pages.length; i += 2) spreads.push({ left: i, right: i + 1 < pages.length ? i + 1 : null, from: pages[i].from });
  const out = { id, title: s.title, heading: s.heading || s.title, composer: s.composer, marking: s.marking || '', bpm: s.bpm, bpb, barDur, sharps: s.sharps || 0, bars, pages, spreads,
    // When the turn into each set of pages starts, in seconds into the song (none for the first).
    turns: spreads.map(sp => (sp.from ? sp.from * barDur - TURN : -Infinity)) };
  cache.set(id, out);
  return out;
}

// Which pages should be open at `t` seconds into the song, counting a turn as begun.
export function spreadAt(sc, t) {
  let i = 0;
  while (i + 1 < sc.spreads.length && t >= sc.turns[i + 1]) i++;
  return i;
}
// Which pages hold bar `bar`: a lesson turns the page when you reach the first note on the next ones.
export function spreadOfBar(sc, bar) {
  let i = 0;
  while (i + 1 < sc.spreads.length && bar >= sc.spreads[i + 1].from) i++;
  return i;
}
export const barAt = (sc, t) => Math.floor(t / sc.barDur + EPS);

// The music desk leans back (blender/zones/piano.py: 12 degrees, its centre 1.5 cm behind and 2 cm below the sheet's,
// 2 cm thick), but the sheet was modelled upright in front of it, so the desk hid its lower half. This lays the sheet
// along the desk's face, as close as it can be while it stays `clear` metres in front of both the desk and the piano's
// body (whose front face is 5 mm behind the sheet's modelled centre, its top 2 cm above): the tilt about the x axis and
// how far the centre moves (Blender axes).
export const DESK = { tilt: -12, at: [0, 0.015, -0.02], thick: 0.02, body: [0.005, 0.02] };
export function onDesk(clear = 0.002) {
  const t = (DESK.tilt * Math.PI) / 180, n = [0, -Math.cos(t), -Math.sin(t)], up = [0, -Math.sin(t), Math.cos(t)];
  const face = DESK.at.map((v, i) => v + n[i] * DESK.thick / 2);
  // How far the modelled centre already is in front of the desk's face.
  const d = -face.reduce((s, v, i) => s + v * n[i], 0);
  // Where the sheet crosses the top of the body it must still be in front of the body's face: e = gap - d.
  const [by, bz] = DESK.body, k = n[1] - (up[1] * n[2]) / up[2];
  const e = Math.max(clear - d, (by - clear - (up[1] * bz) / up[2]) / k);
  return { tilt: t, move: n.map(v => v * e), gap: d + e };
}

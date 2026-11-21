import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, parsePart, buildSong } from '../../web/src/audio/pure/songs.js';
import { TURN, VALUES, events, pieces, measures, spell, keyLetters, accidentals, beams, systemsOf, score, spreadAt, spreadOfBar, barAt } from '../../web/src/pure/sheet.js';
import { noteToMidi } from '../../web/src/audio/pure/notes.js';

const EPS = 1e-9;
// Every sounding note of a staff's voices, with ties joined back up: [beat in the song, midi, length].
function sounding(sc, staff) {
  const out = [];
  sc.bars.forEach((bar, i) => bar[staff].forEach((voice, v) => voice.forEach(p => {
    for (const m of p.midis) {
      if (p.held) { const n = out.findLast(x => x.v === v && x.midi === m && Math.abs(x.at + x.dur - (i * sc.bpb + p.beat)) < 1e-6); n.dur += p.dur; continue; }
      out.push({ v, at: i * sc.bpb + p.beat, midi: m, dur: p.dur });
    }
  })));
  return out.map(({ at, midi, dur }) => [at, midi, dur].join()).sort();
}

test('every bar of every song adds up, in every voice, on both staves', () => {
  for (const s of SONGS) {
    const sc = score(s.id);
    assert.ok(sc.bars.length > 10, s.id);
    sc.bars.forEach((bar, i) => {
      for (const staff of ['treble', 'bass']) bar[staff].forEach((voice, v) => {
        assert.ok(Math.abs(voice.reduce((a, p) => a + p.dur, 0) - sc.bpb) < EPS, `${s.id} bar ${i + 1} ${staff} voice ${v}`);
        let at = 0;
        for (const p of voice) { assert.ok(Math.abs(p.beat - at) < EPS, `${s.id} bar ${i + 1}: pieces follow on`); at += p.dur; }
        for (const p of voice) assert.ok(VALUES.includes(p.dur) || (!p.midis.length && Math.abs(p.dur - sc.bpb) < EPS), `${s.id} bar ${i + 1}: ${p.dur} is a value a page can show`);
      });
    });
  }
});

test('the sheet holds exactly the notes the piano plays: the tune on top, the rest below', () => {
  for (const s of SONGS) {
    const sc = score(s.id);
    const want = part => parsePart(s.parts[part]).notes.map(n => [n.beat, n.midi, n.dur].join());
    assert.deepEqual(sounding(sc, 'treble'), want('lead').sort(), `${s.id} tune`);
    assert.deepEqual(sounding(sc, 'bass'), Object.keys(s.parts).filter(p => p !== 'lead').flatMap(want).sort(), `${s.id} left hand`);
    // And the same as the piano's own playing of it, note for note.
    const played = buildSong(s.id).notes.filter(n => n.part !== 'duet');
    assert.equal(played.length, sounding(sc, 'treble').length + sounding(sc, 'bass').length, s.id);
  }
});

test('lengths become the values a page can show: rests keep to the beat, notes take the longest that fit', () => {
  assert.deepEqual(pieces(0, 3, true, 3), [[0, 3]]);
  assert.deepEqual(pieces(0, 2, true, 3), [[0, 2]]);
  assert.deepEqual(pieces(1.5, 1.5, true, 3), [[1.5, 0.5], [2, 1]]);
  // A rest from the second beat of four is two quarters, so the third beat still shows; from the third it is a half.
  assert.deepEqual(pieces(1, 2, true, 4), [[1, 1], [2, 1]]);
  assert.deepEqual(pieces(2, 2, true, 4), [[2, 2]]);
  assert.deepEqual(pieces(0, 1.5, false, 4), [[0, 1.5]]);
  assert.deepEqual(pieces(0, 2.5, false, 3), [[0, 2], [2, 0.5]]);
  assert.deepEqual(pieces(0, 4, false, 4), [[0, 4]]);
  // A note held over bar lines is tied from bar to bar, its sign written only once.
  const bars = measures('A4:3 | F#4:12 | r:3', 3);
  assert.equal(bars.length, 6);
  const held = bars.slice(1, 5).map(b => b[0]);
  assert.deepEqual(held.map(p => [p.dur, p.midis[0], p.tie]), [[3, 66, true], [3, 66, true], [3, 66, true], [3, 66, false]]);
  assert.deepEqual(bars[0][0].tie, false);
  assert.deepEqual(events('r:1 B3+D4+F#4:2'), [{ at: 0, dur: 1, midis: [] }, { at: 1, dur: 2, midis: [59, 62, 66] }]);
});

test('the staff steps, the key signature and the signs on the notes', () => {
  assert.deepEqual(spell(noteToMidi('C4')), { step: 28, sharp: false });
  assert.deepEqual(spell(noteToMidi('F#4')), { step: 31, sharp: true });
  // The treble staff runs E4 to F5, the bass staff G2 to A3.
  assert.deepEqual(['E4', 'F5', 'G2', 'A3'].map(n => spell(noteToMidi(n)).step), [30, 38, 18, 26]);
  assert.deepEqual(keyLetters(2), [3, 0]);
  assert.deepEqual(keyLetters(0), []);
  const v = ms => ms.map(m => ({ midis: [noteToMidi(m)] }));
  // A minor: D sharp is marked, again only after a natural, and a D after it is marked natural.
  assert.deepEqual(accidentals(v(['E5', 'D#5', 'E5', 'D#5', 'D5', 'D#5']), 0).flat(), ['', '#', '', '', 'n', '#']);
  // D major: F and C sharp are in the key; a C natural needs its sign.
  assert.deepEqual(accidentals(v(['F#5', 'C#5', 'G5', 'C5', 'C5']), 2).flat(), ['', '', '', 'n', '']);
  // A sign holds only at its own octave.
  assert.deepEqual(accidentals(v(['D#5', 'D#4']), 0).flat(), ['#', '#']);
  assert.deepEqual(accidentals([{ midis: [noteToMidi('D#5')], held: true }], 0).flat(), ['']);
  // Fur Elise's first full bar, as written: D sharp then D natural.
  const fe = score('fur-elise');
  assert.deepEqual(accidentals(fe.bars[1].treble[0], 0).flat(), ['', '#', '', '', 'n', '']);
});

test('eighths are beamed in pairs within a beat, a lone one keeps its flag', () => {
  const fe = score('fur-elise');
  assert.deepEqual(beams(fe.bars[1].treble[0]), [[0, 1], [2, 3], [4, 5]]);
  // A4, rest, C4 (alone), E4 and A4 together.
  const bar = fe.bars[2].treble[0];
  assert.deepEqual(bar.map(p => p.dur), [1, 0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(beams(bar), [[3, 4]]);
  assert.deepEqual(beams(score('ode-to-joy').bars[0].treble[0]), []);
});

test('pages break only where a phrase ends, and the pages turn where the music breathes', () => {
  const starts = { gymnopedie: [0, 4, 8, 12, 16], 'fur-elise': [0, 5, 9, 13, 17, 21, 25], 'ode-to-joy': [0, 4, 8, 12] };
  const turnBars = { gymnopedie: [8, 16], 'fur-elise': [9, 17, 25], 'ode-to-joy': [8] };
  for (const s of SONGS) {
    const sc = score(s.id);
    assert.deepEqual(sc.pages.map(p => p.from), starts[s.id], s.id);
    assert.equal(sc.pages.at(-1).to, sc.bars.length);
    sc.pages.forEach(p => assert.deepEqual(systemsOf(p.to - p.from).reduce((a, b) => a + b, 0), p.to - p.from));
    assert.deepEqual(sc.spreads.slice(1).map(sp => sp.from), turnBars[s.id], s.id);
    // No note of the tune is held across a page turn: each turn comes as a phrase ends.
    const tune = parsePart(s.parts.lead).notes;
    for (const bar of turnBars[s.id]) {
      const line = bar * sc.bpb;
      assert.ok(!tune.some(n => n.beat < line - EPS && n.beat + n.dur > line + EPS), `${s.id}: a tune note is held over the turn at bar ${bar + 1}`);
    }
    // Each turn starts TURN seconds before its bar, inside the song, and they never come too fast to follow.
    const duration = buildSong(s.id).duration;
    sc.turns.slice(1).forEach((t, i) => {
      assert.ok(Math.abs(t - (turnBars[s.id][i] * sc.barDur - TURN)) < EPS);
      assert.ok(t > 0 && t + TURN < duration);
    });
    const gaps = sc.turns.slice(1).map((t, i, a) => (i ? t - a[i - 1] : t));
    assert.ok(gaps.every(g => g > 8), `${s.id}: ${gaps.map(g => g.toFixed(1))}`);
    // The last pages may be a single page; every page is shown once, in order.
    assert.deepEqual(sc.spreads.flatMap(sp => [sp.left, sp.right]).filter(x => x !== null), sc.pages.map((_, i) => i));
  }
});

test('which pages are open: a song by its time (a turn counts from its start), a lesson by its bar', () => {
  const sc = score('fur-elise');
  assert.equal(spreadAt(sc, -0.2), 0);
  assert.equal(spreadAt(sc, sc.turns[1] - 0.001), 0);
  assert.equal(spreadAt(sc, sc.turns[1]), 1);
  assert.equal(spreadAt(sc, sc.turns[3] + 100), sc.spreads.length - 1);
  assert.equal(spreadOfBar(sc, 8), 0);
  assert.equal(spreadOfBar(sc, 9), 1);
  assert.equal(spreadOfBar(sc, 28), 3);
  assert.equal(barAt(sc, 9 * sc.barDur), 9);
  assert.equal(barAt(sc, 9 * sc.barDur - 0.01), 8);
  assert.equal(score('nope'), null);
  // The same score object every time: worked out once.
  assert.equal(score('fur-elise'), sc);
});

test('the sheet lies along the music desk as the house builds it, clear of the desk and of the piano\'s body', async () => {
  const { DESK, onDesk } = await import('../../web/src/pure/sheet.js');
  const { readFileSync } = await import('node:fs');
  const py = readFileSync(new URL('../../blender/zones/piano.py', import.meta.url), 'utf8');
  const desk = /box\('piano_music_desk', \(0\.6, ([\d.]+), [\d.]+\), \(px, py - ([\d.]+), z \+ ([\d.]+)\), M\['piano'\], tilt=\(math\.radians\((-?\d+)\)/.exec(py);
  const sheet = /plane\('screen_sheet', [\d.]+, ([\d.]+), \(px, py - ([\d.]+), z \+ ([\d.]+)\)/.exec(py);
  const body = /prism\('piano_body', grand_outline\(px, py\), z \+ [\d.]+, z \+ ([\d.]+)/.exec(py), front = /pts = \[\(-0\.74, (-[\d.]+)\)/.exec(py);
  assert.ok(desk && sheet && body && front, 'the desk, the sheet and the body are where the house builds them');
  assert.equal(+desk[4], DESK.tilt);
  assert.ok(Math.abs(+desk[1] - DESK.thick) < 1e-9);
  assert.ok(Math.abs((+sheet[2] - +desk[2]) - DESK.at[1]) < 1e-9, 'the desk sits behind the sheet');
  assert.ok(Math.abs((+desk[3] - +sheet[3]) - DESK.at[2]) < 1e-9, 'and below it');
  assert.ok(Math.abs((+sheet[2] + +front[1]) - DESK.body[0]) < 1e-9, 'the body\'s front face is behind the sheet');
  assert.ok(Math.abs((+body[1] - +sheet[3]) - DESK.body[1]) < 1e-9, 'and its top above the sheet\'s centre');
  const clear = 0.002, { tilt, move, gap } = onDesk(clear);
  const n = [0, -Math.cos(tilt), -Math.sin(tilt)], up = [0, -Math.sin(tilt), Math.cos(tilt)], face = DESK.at.map((v, i) => v + n[i] * DESK.thick / 2);
  // In front of the desk's face by the gap: at least the clearance, and only as much more as the body needs.
  const off = move.reduce((s, v, i) => s + (v - face[i]) * n[i], 0);
  assert.ok(Math.abs(off - gap) < 1e-9 && gap >= clear && gap < 0.015, `off the desk by ${off}`);
  // Every point of the sheet no higher than the body's top is in front of the body's face (smaller y).
  const h = +sheet[1];
  for (let u = -h / 2; u <= h / 2 + 1e-9; u += h / 40) {
    const y = move[1] + up[1] * u, z = move[2] + up[2] * u;
    if (z <= DESK.body[1]) assert.ok(y <= DESK.body[0] - clear + 1e-9, `at ${u.toFixed(3)} the sheet is ${((DESK.body[0] - y) * 1000).toFixed(1)} mm in front of the body`);
  }
  // Only the sheet's own leaning: it moves less than a centimetre, not sideways, and its top leans back.
  assert.ok(Math.hypot(...move) < 0.01 && Math.abs(move[0]) < 1e-12 && tilt < 0);
});

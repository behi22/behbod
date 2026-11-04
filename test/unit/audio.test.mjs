import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, hashSeed } from '../../web/src/audio/pure/rng.js';
import { midiToFreq, freqToMidi, noteToMidi, MODES, degree, inMode, CHORDS, voiceChord, makeKeyMap } from '../../web/src/audio/pure/notes.js';
import { RECORDS, generateRecord } from '../../web/src/audio/pure/records.js';
import { SONGS, parsePart, buildSong } from '../../web/src/audio/pure/songs.js';
import { TEXTURES, seamLoop, reverbIR } from '../../web/src/audio/pure/textures.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const KNOWN = new Set(['lkick', 'lsnare', 'lhat', 'rim', 'skick', 'gsnare', 'shat', 'sohat', 'tom', 'bak', 'tik', 'rhodes', 'keys', 'lbass', 'sbass', 'pad', 'arp', 'lead', 'santur', 'drone', 'piano']);
const DRUMS = new Set(['lkick', 'lsnare', 'lhat', 'rim', 'skick', 'gsnare', 'shat', 'sohat', 'tom', 'bak', 'tik']);
const beatOf = (rec, e) => e.t / rec.beatDur;
const onGrid = (x, step, tol) => Math.abs(x / step - Math.round(x / step)) * step < tol;

test('the same seed gives the same numbers, and a different seed does not', () => {
  const a = makeRng('record:x'), b = makeRng('record:x'), c = makeRng('record:y');
  const xs = Array.from({ length: 50 }, () => a.next());
  assert.deepEqual(xs, Array.from({ length: 50 }, () => b.next()));
  assert.notDeepEqual(xs, Array.from({ length: 50 }, () => c.next()));
  assert.ok(xs.every(x => x >= 0 && x < 1));
  assert.equal(hashSeed('abc'), hashSeed('abc'));
  const r = makeRng(7);
  for (let i = 0; i < 200; i++) { const n = r.int(2, 5); assert.ok(n >= 2 && n <= 5 && Number.isInteger(n)); }
});

test('note maths: A4 is 440 Hz, C4 is middle C, and names map to the right keys', () => {
  near(midiToFreq(69), 440);
  near(midiToFreq(60), 261.6255653, 1e-6);
  near(midiToFreq(21), 27.5);
  near(freqToMidi(880), 81);
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('A0'), 21);
  assert.equal(noteToMidi('C8'), 108);
  assert.equal(noteToMidi('F#5'), 78);
  assert.equal(noteToMidi('Bb3'), 58);
  assert.throws(() => noteToMidi('H2'));
});

test('Shur keeps its koron second a quarter tone flat', () => {
  assert.equal(MODES.shur[1], 1.5);
  near(midiToFreq(degree(62, MODES.shur, 1)) / midiToFreq(62), Math.pow(2, 1.5 / 12));
  assert.equal(degree(62, MODES.shur, 7), 74);
  assert.equal(degree(62, MODES.shur, -1), 60);
  assert.ok(inMode(63.5, 62, MODES.shur));
  assert.ok(!inMode(64, 62, MODES.shur));
});

test('chords are voiced close, inside one octave around the centre', () => {
  for (const [q, iv] of Object.entries(CHORDS)) {
    for (const root of [36, 48, 55, 61]) {
      const v = voiceChord(root, iv, 64);
      assert.ok(v.every(n => n >= 58 && n < 70), q + ' ' + v);
      assert.deepEqual(v.map(n => (n - root + 120) % 12).sort((a, b) => a - b), iv.map(n => n % 12).sort((a, b) => a - b));
    }
  }
});

test('keyboard: A to K plays C4 to C5, Z and X shift the octave, and a key releases the note it started', () => {
  const k = makeKeyMap();
  ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK'].forEach((c, i) => {
    assert.equal(k.keyToMidi(c), 60 + i, c);
    assert.equal(k.keyToMidi(c, 'keyup'), 60 + i, c);
  });
  assert.equal(k.keyToMidi({ code: 'KeyA', type: 'keydown' }), 60);
  assert.equal(k.keyToMidi({ code: 'KeyX', type: 'keydown' }), null);
  assert.equal(k.octave, 1);
  assert.equal(k.keyToMidi({ code: 'KeyA', type: 'keyup' }), 60);
  assert.equal(k.keyToMidi({ code: 'KeyA', type: 'keydown' }), 72);
  assert.equal(k.keyToMidi({ code: 'KeyA', type: 'keydown', repeat: true }), 72);
  k.keyToMidi({ code: 'KeyA', type: 'keyup' });
  k.keyToMidi({ code: 'KeyX', type: 'keydown', repeat: true });
  k.keyToMidi({ code: 'KeyX', type: 'keyup' });
  assert.equal(k.octave, 1);
  for (let i = 0; i < 10; i++) k.keyToMidi('KeyZ');
  assert.equal(k.octave, -3);
  assert.equal(k.keyToMidi('KeyA'), 24);
  assert.equal(k.keyToMidi('KeyQ'), null);
  assert.equal(k.keyToMidi({ code: 'KeyB', type: 'keyup' }), null);
});

test('four records, each a 60 to 120 second loop that comes out the same every time', () => {
  assert.equal(RECORDS.length, 4);
  for (const r of RECORDS) {
    const a = generateRecord(r.id);
    assert.deepEqual(a, generateRecord(r.id), r.id);
    assert.ok(a.duration >= 60 && a.duration <= 120, `${r.id} ${a.duration}`);
    assert.ok(a.events.length > 100, r.id);
    let last = 0;
    for (const e of a.events) {
      assert.ok(KNOWN.has(e.i), e.i);
      assert.ok(e.t >= last && e.t < a.duration, `${r.id} ${e.t}`);
      assert.ok(e.v > 0 && e.v <= 1 && e.d > 0, r.id);
      if (!DRUMS.has(e.i)) assert.ok(e.m >= 21 && e.m <= 108, `${r.id} ${e.i} ${e.m}`);
      last = e.t;
    }
  }
  assert.equal(generateRecord('nope'), null);
});

test('the four records use different instruments', () => {
  const kit = id => [...new Set(generateRecord(id).events.map(e => e.i))].sort().join();
  const kits = RECORDS.map(r => kit(r.id));
  assert.equal(new Set(kits).size, 4);
  assert.equal(kit('rain-piano'), 'piano');
});

test('Night Shift: the snare lands on 2 and 4 and the hats swing', () => {
  const r = generateRecord('night-shift');
  const snares = r.events.filter(e => e.i === 'lsnare' && e.v >= 0.8);
  assert.ok(snares.length >= 40);
  for (const s of snares) { const b = beatOf(r, s) % 4; assert.ok(Math.abs(b - 1) < 0.03 || Math.abs(b - 3) < 0.03, String(b)); }
  const off = r.events.filter(e => e.i === 'lhat').map(e => beatOf(r, e) % 1).filter(x => x > 0.3 && x < 0.7);
  assert.ok(off.length > 50 && off.every(x => x > 0.54));
});

test('Lions Gate: four on the floor with the gated snare on 2 and 4', () => {
  const r = generateRecord('lions-gate');
  const kicks = r.events.filter(e => e.i === 'skick');
  assert.ok(kicks.every(k => onGrid(beatOf(r, k), 1, 1e-6)));
  const bars = new Map();
  for (const k of kicks) { const bar = Math.floor(beatOf(r, k) / 4 + 1e-9); bars.set(bar, (bars.get(bar) || 0) + 1); }
  assert.ok([...bars.values()].filter(n => n === 4).length >= 30);
  const loud = r.events.filter(e => e.i === 'gsnare' && e.v >= 0.8);
  assert.ok(loud.every(s => [1, 3].includes(Math.round(beatOf(r, s) % 4))));
});

test('Dastgah: every santur note is in Shur on D, the koron is heard, and the drum keeps 6/8', () => {
  const r = generateRecord('dastgah');
  const notes = r.events.filter(e => e.i === 'santur');
  assert.ok(notes.every(e => inMode(e.m, 62, MODES.shur)), 'outside the mode');
  assert.ok(notes.filter(e => e.m % 1 === 0.5).length >= 5, 'no koron');
  assert.ok(notes.some(e => e.riz) && notes.some(e => !e.riz));
  for (const e of r.events.filter(x => x.i === 'tom')) assert.ok(onGrid(beatOf(r, e), 1 / 3, 1e-6));
  const drones = r.events.filter(e => e.i === 'drone');
  for (let i = 1; i < drones.length; i++) assert.ok(drones[i - 1].t + drones[i - 1].d > drones[i].t, 'drone gap');
  const lastDrone = drones[drones.length - 1];
  assert.ok(lastDrone.t + lastDrone.d > r.duration, 'drone gap at the loop point');
});

test('Rain Piano stays inside the keyboard and ends its loop on a held chord', () => {
  const r = generateRecord('rain-piano');
  assert.ok(r.events.every(e => e.i === 'piano' && e.m >= 36 && e.m <= 96));
  const lastBar = r.events.filter(e => e.t >= (r.bars - 1) * 4 * r.beatDur);
  assert.ok(lastBar.length >= 4 && lastBar.every(e => e.d > 2));
});

test('every bar of every song adds up, and all parts are the same length', () => {
  for (const s of SONGS) {
    const parts = Object.entries(s.parts).map(([name, str]) => [name, parsePart(str)]);
    for (const [name, p] of parts) {
      for (const m of p.marks) assert.ok(onGrid(m, s.beatsPerBar, 1e-9), `${s.id} ${name} bar line at ${m}`);
      assert.ok(onGrid(p.length, s.beatsPerBar, 1e-9), `${s.id} ${name} length ${p.length}`);
    }
    assert.equal(new Set(parts.map(([, p]) => p.length)).size, 1, s.id);
  }
});

test('the songs open with the right notes', () => {
  const lead = id => buildSong(id).notes.filter(n => n.part === 'lead').map(n => n.midi);
  assert.deepEqual(lead('fur-elise').slice(0, 9), ['E5', 'D#5', 'E5', 'D#5', 'E5', 'B4', 'D5', 'C5', 'A4'].map(noteToMidi));
  assert.deepEqual(lead('gymnopedie').slice(0, 9), ['F#5', 'A5', 'G5', 'F#5', 'C#5', 'B4', 'C#5', 'D5', 'A4'].map(noteToMidi));
  assert.deepEqual(lead('ode-to-joy').slice(0, 4), ['E5', 'E5', 'F5', 'G5'].map(noteToMidi));
  const g = buildSong('gymnopedie');
  assert.equal(g.notes[0].midi, noteToMidi('G2'));
  assert.ok(g.duration > 40 && g.duration < 70);
  assert.equal(buildSong('nope'), null);
});

test('a duet adds BH-22 an octave up and leaves the piano part alone', () => {
  for (const s of SONGS) {
    const solo = buildSong(s.id), duo = buildSong(s.id, { duet: true });
    assert.ok(solo.notes.every(n => n.who === 'piano'));
    const piano = duo.notes.filter(n => n.who === 'piano'), bh = duo.notes.filter(n => n.who === 'bh22');
    assert.deepEqual(piano, solo.notes);
    assert.ok(bh.length >= 8, s.id);
    for (const n of bh) {
      assert.ok(n.t >= s.duet.fromBar * s.beatsPerBar * solo.beatDur - 1e-9);
      assert.ok(solo.notes.some(p => p.part === 'lead' && p.midi + 12 === n.midi && Math.abs(p.t - n.t) < 1e-9));
    }
  }
});

test('loop textures stay in range, repeat exactly and join without a click', () => {
  for (const [name, fn] of Object.entries(TEXTURES)) {
    const a = fn(8000), b = fn(8000);
    assert.deepEqual(a, b, name);
    for (const ch of a) {
      let peak = 0, step = 0;
      for (let i = 0; i < ch.length; i++) { assert.ok(Number.isFinite(ch[i]), name); peak = Math.max(peak, Math.abs(ch[i])); if (i) step += Math.abs(ch[i] - ch[i - 1]); }
      assert.ok(peak > 0.01 && peak <= 1, `${name} peak ${peak}`);
      assert.ok(Math.abs(ch[0] - ch[ch.length - 1]) < Math.max(0.05, 8 * step / ch.length), `${name} seam`);
    }
  }
});

test('the seam fold makes the last sample flow into the first', () => {
  const src = Float32Array.from({ length: 110 }, (_, i) => i);
  const out = seamLoop(src, 100, 10);
  assert.equal(out.length, 100);
  assert.equal(out[0], 100);
  assert.equal(out[99], 99);
  assert.equal(out[50], 50);
});

test('the room reverb decays to silence', () => {
  const [l, r] = reverbIR(8000, 2);
  const energy = (a, from, to) => { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return s; };
  assert.ok(energy(l, 0, 4000) > 100 * energy(l, 12000, 16000));
  assert.notDeepEqual(l, r);
});

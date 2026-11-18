import test from 'node:test';
import assert from 'node:assert/strict';
import { gunSound, SOUND_NAMES, TAKES, SR, GUN_SOUNDS } from '../../web/src/audio/pure/gunsound.js';

const rms = (x, a, b) => { const i0 = Math.round(a * SR), i1 = Math.min(x.length, Math.round(b * SR)); let s = 0; for (let i = i0; i < i1; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };
const peak = chans => Math.max(...chans.map(c => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
const sounds = Object.fromEntries(SOUND_NAMES.map(n => [n, gunSound(n)]));

test('every sound is two clean channels: no gaps in the numbers, never over full scale, ending in silence', () => {
  for (const [name, chans] of Object.entries(sounds)) {
    assert.equal(chans.length, 2, name);
    assert.equal(chans[0].length, chans[1].length, name);
    for (const c of chans) for (const v of c) assert.ok(Number.isFinite(v), `${name} has a broken sample`);
    const p = peak(chans);
    assert.ok(p > 0.15 && p <= 0.951, `${name} peaks at ${p}`);
    for (const c of chans) {
      assert.ok(Math.abs(c[c.length - 1]) < 1e-9, `${name} ends with a click`);
      assert.ok(rms(c, c.length / SR - 0.01, c.length / SR) < 1e-3, `${name} does not die away`);
    }
  }
});

test('nothing but the shot starts with a jump (a click before the sound)', () => {
  for (const [name, [L]] of Object.entries(sounds)) if (!name.startsWith('shot')) assert.ok(Math.abs(L[0]) < 0.01 && Math.abs(L[1] - L[0]) < 0.1, `${name} starts at ${L[0]}, ${L[1]}`);
});

test('the shot: sharp at once, loudest early, the hall answering for over a second', () => {
  const [L, R] = sounds.shot;
  let firstHalf = -1;
  for (let i = 0; i < L.length; i++) if (Math.abs(L[i]) > 0.45) { firstHalf = i; break; }
  assert.ok(firstHalf >= 0 && firstHalf < SR * 0.002, `half its peak at ${firstHalf} samples`);
  const early = rms(L, 0, 0.05), mid = rms(L, 0.3, 0.6), late = rms(L, 1.0, 1.2);
  assert.ok(L.length / SR > 1.3, `only ${L.length / SR} s long`);
  assert.ok(mid < early / 8 && mid > early / 400, `the hall: ${early} then ${mid}`);
  assert.ok(late < mid && late > 0, `the tail fades: ${mid} then ${late}`);
  // The two sides are one sound at first and apart in the tail: the room is all round.
  assert.ok(rms(L.map((v, i) => v - R[i]), 0, 0.005) < 1e-6);
  assert.ok(rms(L.map((v, i) => v - R[i]), 0.4, 0.8) > mid * 0.3);
});

test('with the suppressor the shot is quieter and the crack all but gone', () => {
  const bare = sounds.shot, quiet = sounds.shotQuiet;
  assert.ok(peak(quiet) < 0.5 * peak(bare));
  assert.ok(rms(quiet[0], 0, 0.004) < rms(bare[0], 0, 0.004) / 5, 'the first milliseconds');
  assert.ok(quiet[0].length < bare[0].length);
});

test('takes: the same take is the same sound every time, the takes differ', () => {
  for (const name of Object.keys(TAKES)) {
    const a = gunSound(name, 'pistol', 0), b = gunSound(name, 'pistol', 0), c = gunSound(name, 'pistol', 1);
    assert.deepEqual(a[0], b[0], name);
    assert.ok(rms(a[0].map((v, i) => v - (c[0][i] || 0)), 0, 0.3) > 1e-3, `${name}: takes 0 and 1 alike`);
  }
  assert.equal(gunSound('shot', 'nothing'), null);
  assert.equal(gunSound('nothing'), null);
  assert.ok(GUN_SOUNDS.pistol);
});

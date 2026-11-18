import test from 'node:test';
import assert from 'node:assert/strict';
import { MOODS, moodOf, SHIFT, newShift, wantMood, stepShift, shifting } from '../../web/src/pure/moods.js';
import { STAGES } from '../../web/src/pure/stages.js';

const run = (s, secs, dt = 1 / 60) => { const swaps = [], ks = []; for (let t = 0; t < secs; t += dt) { const w = stepShift(s, dt); if (w) swaps.push(w); ks.push(s.k); } return { swaps, ks }; };

test('every stage has a mood of its own, and an unknown one falls back to the warm-up', () => {
  for (const st of STAGES) assert.ok(MOODS[st.id], st.id);
  assert.equal(new Set(STAGES.map(st => MOODS[st.id].set)).size, STAGES.length);
  assert.equal(moodOf('nope'), MOODS.warmup);
  for (const [id, m] of Object.entries(MOODS)) {
    for (const key of ['tint', 'haze', 'strip', 'accent', 'glow']) assert.ok(m[key].length === 3 && m[key].every(v => v >= 0 && v <= 1.1), `${id} ${key}`);
    assert.ok(m.bright > 0.7 && m.bright <= 1, `${id} keeps the hall bright enough to see the targets`);
    assert.ok(m.sign.length > 0);
  }
});

test('the warm-up is the hall exactly as it was built', () => {
  const w = MOODS.warmup;
  assert.deepEqual(w.tint, [1, 1, 1]);
  assert.equal(w.bright, 1);
  assert.deepEqual(w.haze, [0.012, 0.016, 0.024]);
  assert.equal(w.hazeK, 0.011);
  assert.deepEqual(w.strip, [0.82, 0.9, 1.0]);
  assert.deepEqual(w.accent, [0.1, 0.9, 0.8]);
  assert.equal(w.pulse, 0);
});

test('a change of mood dips the lights, swaps once in the dark, and comes back to full', () => {
  const s = newShift('warmup');
  assert.equal(shifting(s), false);
  wantMood(s, 'swarm');
  assert.equal(shifting(s), true);
  const { swaps, ks } = run(s, 2);
  assert.deepEqual(swaps, ['swarm']);
  assert.equal(s.shown, 'swarm');
  assert.equal(s.k, 1);
  assert.equal(shifting(s), false);
  assert.ok(Math.min(...ks) <= SHIFT.low + 1e-9 && Math.min(...ks) >= SHIFT.low * 0.45 - 1e-9);
  // The swap happens while the lights are at their lowest.
  const t = newShift('warmup'); wantMood(t, 'dark');
  let at = null;
  for (let i = 0; i < 200 && at === null; i++) if (stepShift(t, 1 / 120)) at = t.k;
  assert.ok(at !== null && at <= SHIFT.low + 1e-9, `swapped at ${at}`);
});

test('asking again before the swap goes to the newest mood; asking after it starts a new dip from where the light is', () => {
  const s = newShift('warmup');
  wantMood(s, 'swarm'); stepShift(s, 0.05); wantMood(s, 'long');
  assert.deepEqual(run(s, 2).swaps, ['long']);
  const u = newShift('warmup');
  wantMood(u, 'walkers');
  for (let i = 0; i < 25; i++) stepShift(u, 1 / 60);
  assert.equal(u.shown, 'walkers');
  const k = u.k;
  wantMood(u, 'dark');
  assert.equal(u.t, 0); assert.equal(u.from, k);
  stepShift(u, 1e-4);
  assert.ok(Math.abs(u.k - k) < 0.01, 'no jump in the light when a new change starts');
  assert.deepEqual(run(u, 2).swaps, ['dark']);
});

test('asking for the mood already wanted changes nothing; a long frame still swaps once', () => {
  const s = newShift('long');
  wantMood(s, 'long');
  assert.equal(shifting(s), false);
  assert.equal(stepShift(s, 0.5), null);
  wantMood(s, 'walkers');
  assert.equal(stepShift(s, 5), 'walkers');
  assert.equal(s.k, 1);
  assert.equal(stepShift(s, 5), null);
  assert.equal(stepShift(s, -1), null);
});

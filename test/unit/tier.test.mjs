import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, switchWork, tierStep } from '../../web/src/pure/tier.js';

// Regression: ultra and high share every effect, yet each switch between them rebuilt and recompiled the whole effects
// chain, a 75 to 165 ms freeze at 1440x900 on a 2x screen, the switch this automatic quality makes most.
test('a switch between ultra and high only changes the sharpness', () => {
  assert.deepEqual(switchWork('ultra', 'high'), { post: false, ratio: true });
  assert.deepEqual(switchWork('high', 'ultra'), { post: false, ratio: true });
});

test('a switch that adds or drops an effect rebuilds the effects chain', () => {
  for (const [a, b] of [['high', 'medium'], ['medium', 'high'], ['medium', 'low'], ['low', 'medium'], ['ultra', 'low'], ['low', 'ultra']]) {
    assert.equal(switchWork(a, b).post, true, `${a} to ${b}`);
  }
});

test('staying on a tier rebuilds nothing, and an unknown tier rebuilds everything', () => {
  for (const t of Object.keys(TIERS)) assert.deepEqual(switchWork(t, t), { post: false, ratio: false });
  assert.deepEqual(switchWork(null, 'high'), { post: true, ratio: true });
  assert.deepEqual(switchWork('high', 'nope'), { post: true, ratio: true });
});

const slow = Array(60).fill(30), fast = Array(60).fill(16.7);
// Runs stretches through the judge, one every 2.5 s from `start`, and returns the tier after each.
function run(tier, stretches, start, state = { top: tier }) {
  const seen = [];
  stretches.forEach((times, k) => { state = tierStep(tier, times, start + k * 2500, state); tier = state.tier; seen.push(tier); });
  return { seen, state };
}

// Regression: the six quiet seconds were counted from the page's first byte, so on a slow phone (the house opens about
// 11 s in) they were over before the first frame, and its first busy seconds dropped the quality.
test('the quiet seconds run from when the judge starts, not from page load', () => {
  const { seen } = run('medium', [slow, slow, slow, slow], 14000, { top: 'medium', from: 11500 });
  assert.deepEqual(seen, ['medium', 'medium', 'medium', 'low']);
});

test('a switch starts the quiet seconds again, so its own freeze and new shaders are not judged', () => {
  const { seen } = run('ultra', [slow, slow, slow, slow, slow, slow], 7000);
  assert.deepEqual(seen, ['ultra', 'high', 'high', 'high', 'high', 'medium']);
});

test('the quiet seconds forget a slow stretch from before them, and keep the good ones', () => {
  let state = tierStep('ultra', slow, 7000, { top: 'ultra' });
  state = tierStep('ultra', slow, 9500, { ...state, from: 8000 });
  assert.equal(state.tier, 'ultra');
  assert.equal(state.slowRuns, 0);
  state = tierStep('high', fast, 20000, { top: 'ultra', goodRuns: 1 });
  state = tierStep('high', fast, 22500, { ...state, from: 21000 });
  assert.equal(state.goodRuns, 2);
});

// His laptop at 1440x900 on a 2x screen (the b2 run): a stretch on ultra was slow 7 times in 15, on high 4 in 60.
function replay(seed, minutes) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, odds = { ultra: 7 / 15, high: 4 / 60, medium: 0.02, low: 0 };
  let tier = 'ultra', state = { top: 'ultra', from: 6300 }, switches = 0;
  for (let now = 8800; now < 6300 + minutes * 60000; now += 2500) {
    state = tierStep(tier, Array(100).fill(rnd() < odds[tier] ? 30 : 9), now, state);
    if (state.tier !== tier) switches++;
    tier = state.tier;
  }
  return switches;
}

// Regression: it tried ultra again after 10 s, 30 s, 90 s and then every 6 minutes for good, two switches and a
// stutter each time: 5 switches in 3 minutes on his laptop, 9 in 30. A rare unlucky run (two slow stretches in its
// first seconds on high) still costs one more try down and up.
test('on his laptop the quality settles: 3 switches in 30 minutes in at least 97 visits in 100, never more than 5', () => {
  const runs = Array.from({ length: 300 }, (_, k) => replay(k + 1, 30));
  assert.ok(runs.filter(n => n <= 3).length >= 0.97 * runs.length, `${runs.filter(n => n > 3).length} of 300 over 3`);
  assert.ok(Math.max(...runs) <= 5, `${Math.max(...runs)} switches`);
});

test('a tier that fails twice, at the start or after a try back up, is left for the rest of the visit', () => {
  const { seen, state } = run('ultra', [slow, slow, ...Array(8).fill(fast), slow, slow, ...Array(200).fill(fast)], 7000);
  assert.deepEqual(seen.slice(0, 12), ['ultra', 'high', 'high', 'high', 'high', 'high', 'high', 'ultra', 'ultra', 'ultra', 'ultra', 'high']);
  assert.ok(seen.slice(12).every(t => t === 'high'), 'stays on high');
  assert.equal(state.top, 'high');
});

test('a tier that holds rides out a short slow patch without a switch', () => {
  const { seen } = run('ultra', [...Array(40).fill(fast), slow, slow, slow, slow, ...Array(20).fill(fast)], 7000);
  assert.ok(seen.every(t => t === 'ultra'));
});

test('a capable machine with a long slow patch steps down but is not held lower: it keeps coming back', () => {
  const patch = [...Array(40).fill(fast), ...Array(5).fill(slow)];
  const { seen, state } = run('ultra', [...patch, ...patch, ...patch, ...Array(80).fill(fast)], 7000);
  assert.equal(seen.at(-1), 'ultra');
  assert.equal(seen.filter((t, k) => k > 0 && t !== seen[k - 1]).length, 6, 'down and back up after each patch');
  assert.equal(state.top, 'ultra');
});

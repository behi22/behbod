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

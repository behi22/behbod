import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, switchWork } from '../../web/src/pure/tier.js';

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

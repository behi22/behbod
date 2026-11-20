import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inSlices } from '../../web/src/pure/slices.js';

// A clock the work moves on by hand, and a log of what ran and where the frame was handed back.
function bench(costs) {
  let t = 0;
  const log = [];
  return { log, now: () => t, rest: async () => { log.push('rest'); }, work: async i => { t += costs[i]; log.push(i); } };
}

// Regression: building the range's shaders and pictures ran in single blocks of 100 to 670 ms on a slowed phone.
test('work is handed back to the frame once a slice of time is spent', async () => {
  const b = bench([3, 3, 3, 3, 3, 3, 3]);
  await inSlices([0, 1, 2, 3, 4, 5, 6], b.work, { rest: b.rest, budget: 8, now: b.now });
  assert.deepEqual(b.log, [0, 1, 2, 'rest', 3, 4, 5, 'rest', 6]);
});

test('one item longer than a slice gets a rest of its own after it, and the order never changes', async () => {
  const b = bench([20, 1, 1, 30]);
  await inSlices([0, 1, 2, 3], b.work, { rest: b.rest, budget: 8, now: b.now });
  assert.deepEqual(b.log, [0, 'rest', 1, 2, 3, 'rest']);
});

test('nothing to do is no rest at all', async () => {
  const b = bench([]);
  await inSlices([], b.work, { rest: b.rest, budget: 8, now: b.now });
  assert.deepEqual(b.log, []);
});

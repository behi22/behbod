import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inSlices, stepsInSlices, whenIdle } from '../../web/src/pure/slices.js';

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

// A land worker that never answered held the outside's rebuild for good; the page now works the land out itself, as
// steps spread over frames.
test('a job written as steps hands the frame back once a slice of time is spent, and returns what the job returns', async () => {
  let t = 0;
  const log = [];
  function* job() { for (let k = 0; k < 5; k++) { t += 3; log.push(k); yield; } return 'done'; }
  const got = await stepsInSlices(job(), { rest: async () => { log.push('rest'); }, budget: 8, now: () => t });
  assert.equal(got, 'done');
  assert.deepEqual(log, [0, 1, 2, 'rest', 3, 4]);
});

test('a rest that throws stops the job there', async () => {
  let t = 0, ran = 0;
  function* job() { for (;;) { t += 10; ran++; yield; } }
  await assert.rejects(stepsInSlices(job(), { rest: async () => { throw new Error('stop'); }, budget: 8, now: () => t }), /stop/);
  assert.equal(ran, 1);
});

// The range is built behind the scenes in the page's spare time; a browser without idle callbacks takes a short pause.
test('a breath for building nobody waits on is taken in idle time, at the latest after its wait', async () => {
  const asked = [];
  globalThis.requestIdleCallback = (f, o) => { asked.push(o.timeout); setTimeout(f, 0); return 1; };
  try {
    await whenIdle();
    await whenIdle(120);
    assert.deepEqual(asked, [300, 120]);
  } finally { delete globalThis.requestIdleCallback; }
  const t = Date.now();
  await whenIdle();
  assert.ok(Date.now() - t >= 25, 'without idle callbacks, a short pause');
});

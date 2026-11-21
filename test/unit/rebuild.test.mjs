import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRebuilder, STALE } from '../../web/src/pure/rebuild.js';

// A build in steps the test lets through one at a time; each step makes one piece. What is on screen, what was made
// and what was thrown away are all logged, so a leak or a second build shows.
function rig(start = 'low') {
  const log = { swaps: [], discarded: [], made: [], errors: [] }, gates = [];
  const step = () => new Promise(go => gates.push(go));
  const r = makeRebuilder({
    current: start,
    async build(q, { made, stale }) {
      for (let k = 0; k < 3; k++) {
        await step();
        if (stale()) throw STALE;
        const piece = `${q}#${k}`; made.push(piece); log.made.push(piece);
      }
      return q;
    },
    swap: (built, q) => log.swaps.push([built, q]),
    discard: made => log.discarded.push(...made),
    onError: e => log.errors.push(e),
  });
  const flush = async () => { for (let i = 0; i < 20; i++) { while (gates.length) gates.shift()(); await new Promise(res => setTimeout(res, 0)); } };
  const one = async () => { await new Promise(res => setTimeout(res, 0)); gates.shift()?.(); await new Promise(res => setTimeout(res, 0)); };
  return { r, log, flush, one };
}

// Regression: a change of tier tore the outside world down and built the new one in one go, a freeze of up to 1.3 s
// on a slowed phone. Now the old one stays on screen until the new one is whole.
test('the old one stays until the new one is complete, then it is swapped in once', async () => {
  const { r, log, flush, one } = rig();
  r.want('medium');
  await one(); await one();
  assert.equal(r.current, 'low', 'still the old one while building');
  assert.deepEqual(log.swaps, []);
  await flush();
  assert.deepEqual(log.swaps, [['medium', 'medium']]);
  assert.equal(r.current, 'medium');
  assert.deepEqual(log.discarded, []);
});

test('a second switch while one builds: the first stops at its next step, all it made is thrown away, the second is swapped in', async () => {
  const { r, log, flush, one } = rig();
  r.want('medium');
  await one(); await one();
  r.want('high');
  await flush();
  assert.deepEqual(log.swaps, [['high', 'high']]);
  const fromMedium = log.made.filter(p => p.startsWith('medium'));
  assert.ok(fromMedium.length > 0);
  assert.deepEqual(log.discarded, fromMedium, 'everything the stopped build made, nothing else');
  assert.equal(r.current, 'high');
});

test('switching back to what is on screen while a build runs stops the build and swaps nothing', async () => {
  const { r, log, flush, one } = rig();
  r.want('medium');
  await one();
  r.want('low');
  await flush();
  assert.deepEqual(log.swaps, []);
  assert.deepEqual(log.discarded, log.made);
  assert.equal(r.current, 'low');
});

test('asking again for what is being built does not start a second build', async () => {
  const { r, log, flush, one } = rig();
  r.want('medium'); await one(); r.want('medium'); r.want('medium');
  await flush();
  assert.equal(log.made.length, 3, 'one build of three pieces');
  assert.deepEqual(log.swaps, [['medium', 'medium']]);
});

test('builds never overlap: a quick back and forth builds one at a time and swaps only the last', async () => {
  const log = { swaps: [], discarded: [] };
  let running = 0, most = 0;
  const watched = makeRebuilder({
    current: 'low',
    async build(q, { made, stale }) {
      running++; most = Math.max(most, running);
      try { for (let k = 0; k < 3; k++) { await new Promise(res => setTimeout(res, 1)); if (stale()) throw STALE; made.push(q + k); } return q; } finally { running--; }
    },
    swap: (b, q) => log.swaps.push(q), discard: m => log.discarded.push(...m),
  });
  for (const q of ['medium', 'high', 'medium', 'high', 'medium']) watched.want(q);
  await new Promise(res => setTimeout(res, 100));
  assert.equal(most, 1, 'one build at a time');
  assert.deepEqual(log.swaps, ['medium']);
  assert.equal(watched.current, 'medium');
});

test('a build that fails throws away what it made, keeps the old one and can be asked again', async () => {
  const log = { swaps: [], discarded: [], errors: [] };
  let fail = true;
  const r = makeRebuilder({
    current: 'low',
    async build(q, { made }) { made.push('piece'); if (fail) throw new Error('no'); return q; },
    swap: (b, q) => log.swaps.push(q), discard: m => log.discarded.push(...m), onError: e => log.errors.push(e.message),
  });
  r.want('medium');
  await new Promise(res => setTimeout(res, 10));
  assert.deepEqual(log.swaps, []); assert.deepEqual(log.discarded, ['piece']); assert.deepEqual(log.errors, ['no']);
  assert.equal(r.current, 'low');
  fail = false;
  r.want('low'); r.want('medium');
  await new Promise(res => setTimeout(res, 10));
  assert.deepEqual(log.swaps, ['medium']);
});

test('stopping (the world going away) stops a build and throws away what it made', async () => {
  const { r, log, flush, one } = rig();
  r.want('medium');
  await one(); await one();
  await Promise.race([r.stop(), flush()]);
  await flush();
  assert.deepEqual(log.swaps, []);
  assert.deepEqual(log.discarded, log.made);
});

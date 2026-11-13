import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProgress } from '../../web/src/pure/progress.js';

const memory = (init = {}) => { const m = { ...init }; return { get: k => m[k] ?? null, set: (k, v) => { m[k] = v; }, m }; };

test('an achievement is earned once and remembered', () => {
  const s = memory();
  const p = makeProgress(s);
  assert.equal(p.earn('piano'), 'Played the piano');
  assert.equal(p.earn('piano'), null);
  assert.equal(makeProgress(s).has('piano'), true);
});

test('unknown achievements are ignored', () => {
  const p = makeProgress(memory());
  assert.equal(p.earn('hack'), null);
  assert.deepEqual(p.list(), []);
});

test('holo range scores unlock the keeper kit, then gold, then the red visor and the secret room', () => {
  const p = makeProgress(memory());
  assert.deepEqual(p.score('range', 10), []);
  assert.deepEqual(p.score('range', 22), ['kit']);
  assert.deepEqual(p.score('range', 15), []);
  assert.deepEqual(p.score('range', 60), ['gold', 'visor', 'vault']);
  assert.deepEqual(p.unlocked(), ['kit', 'gold', 'visor', 'vault']);
  assert.equal(p.best('range'), 60);
});

test('tampered or broken saved progress is cleaned, not trusted', () => {
  const s = memory({ 'loft.progress': JSON.stringify({ earned: ['piano', 'nope', 5], best: { range: 'lots', chess: 3.7, '<script>': 9 }, heads: [1, 'tv'] }) });
  const p = makeProgress(s);
  assert.deepEqual(p.list().map(a => a.id), ['piano']);
  assert.equal(p.best('range'), 0);
  assert.equal(p.best('chess'), 3);
  assert.deepEqual(p.unlocked(), []);
  assert.equal(makeProgress(memory({ 'loft.progress': '{not json' })).list().length, 0);
});

test('blocked storage never breaks the page', () => {
  const p = makeProgress({ get: () => { throw new Error('blocked'); }, set: () => { throw new Error('blocked'); } });
  assert.equal(p.earn('tea'), 'Had a glass of tea');
});

test('every head counts toward trying them all', () => {
  const p = makeProgress(memory());
  assert.equal(p.sawHead('hood'), 1);
  assert.equal(p.sawHead('hood'), 1);
  assert.equal(p.sawHead('tv'), 2);
});

test('range stars: a result is kept per stage and difficulty, only ever improves, and reports what it unlocked', () => {
  const s = memory(), p = makeProgress(s);
  assert.deepEqual(p.rangeBest(), {});
  assert.deepEqual(p.rangeResult('warmup', 'normal', 1, 900), { best: true, guns: ['Vesper'], unlocks: [] }, 'the first star brings the second gun');
  assert.deepEqual(p.rangeResult('warmup', 'normal', 0, 400), { best: false, guns: [], unlocks: [] });
  assert.deepEqual(p.rangeBest(), { warmup: { normal: 1 } }, 'a worse run takes nothing away');
  assert.equal(p.rangeScore('warmup', 'normal'), 900);
  assert.deepEqual(p.rangeResult('warmup', 'easy', 3, 700), { best: true, guns: [], unlocks: ['gold'] }, 'three stars on any stage is the gold colourway');
  assert.deepEqual(p.rangeResult('walkers', 'normal', 1, 1500), { best: true, guns: ['Keeper'], unlocks: ['kit'] }, 'a star on the walkers is the keeper kit; four stars the rifle');
  const again = makeProgress(s);
  assert.deepEqual(again.rangeBest(), { warmup: { normal: 1, easy: 3 }, walkers: { normal: 1 } }, 'and it is all there on the next visit');
  assert.deepEqual(again.unlocked(), ['kit', 'gold']);
});

test('range stars: the red visor and the secret room take three stars on every stage on Hard', () => {
  const p = makeProgress(memory());
  for (const stage of ['warmup', 'walkers', 'swarm', 'dark']) p.rangeResult(stage, 'hard', 3, 5000);
  assert.ok(!p.unlocked().includes('vault') && !p.unlocked().includes('visor'));
  assert.deepEqual(p.rangeResult('long', 'hard', 3, 5000).unlocks, ['visor', 'vault']);
});

test('range stars: unknown stages and odd numbers are refused, and tampered saves are cleaned', () => {
  const p = makeProgress(memory());
  assert.deepEqual(p.rangeResult('nowhere', 'normal', 3, 100), { best: false, guns: [], unlocks: [] });
  assert.deepEqual(p.rangeResult('warmup', 'insane', 3, 100), { best: false, guns: [], unlocks: [] });
  assert.deepEqual(p.rangeResult('__proto__', 'normal', 3, 100), { best: false, guns: [], unlocks: [] });
  p.rangeResult('warmup', 'normal', 99, Infinity);
  p.rangeResult('warmup', 'easy', 2.5, -4);
  assert.deepEqual(p.rangeBest(), { warmup: { normal: 3, easy: 0 } }, 'stars stop at three; a broken score is no score');
  assert.equal(p.rangeScore('warmup', 'normal'), 0);
  const bad = makeProgress(memory({ 'loft.progress': JSON.stringify({ range: { warmup: { normal: { stars: 7, score: 'lots' }, hard: 3, weird: { stars: 3 } }, walkers: 'yes', made_up: { normal: { stars: 3 } } } }) }));
  assert.deepEqual(bad.rangeBest(), { warmup: { normal: 3 } });
  assert.equal(bad.rangeScore('warmup', 'normal'), 0);
});

test('a score from the first range still counts for what it unlocked then', () => {
  const p = makeProgress(memory({ 'loft.progress': JSON.stringify({ best: { range: 36 } }) }));
  assert.deepEqual(p.unlocked(), ['kit', 'gold']);
});

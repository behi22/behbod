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

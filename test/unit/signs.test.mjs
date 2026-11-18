import { test } from 'node:test';
import assert from 'node:assert/strict';

// panels.js reads the page's address through room2.js as it loads.
globalThis.location ??= { search: '' };
const { makePanels } = await import('../../web/panels.js');

// A canvas that keeps the words drawn on it since it was last cleared.
function fakeSurface(w, h) {
  const words = [], state = {};
  const noop = () => fake;
  const fake = new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => '' : noop), apply: () => fake });
  const g = new Proxy(state, {
    get(s, k) {
      if (k === 'fillText') return t => words.push(String(t));
      if (k === 'fillRect') return (x, y, fw, fh) => { if (x <= 0 && y <= 0 && fw >= w && fh >= h) words.length = 0; };
      if (k === 'measureText') return t => ({ width: String(t).length * 10, actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(t).length * 10 });
      if (k in s) return s[k];
      return noop;
    },
    set(s, k, v) { s[k] = v; return true; },
  });
  return { c: { width: w, height: h }, g, t: {}, words };
}
const make = () => {
  const made = {};
  const panels = makePanels((w, h) => fakeSurface(w, h), { weather: () => 'clear', videos: () => [], projects: [] });
  for (const [k, v] of Object.entries(panels.S)) made[k] = v.words;
  return { panels, words: made };
};

test('the unlock stands say LOCKED until something is won', () => {
  const { words } = make();
  for (const k of ['unlock_kit', 'unlock_gold', 'unlock_visor']) assert.ok(words[k].includes('LOCKED'), k);
});

test('a stand shows what has been won, and only that, and keeps it through a full redraw', () => {
  const { panels, words } = make();
  panels.showUnlocks(['kit', 'vault']);
  assert.ok(!words.unlock_kit.includes('LOCKED'));
  assert.ok(words.unlock_kit.includes('UNLOCKED'));
  assert.ok(words.unlock_gold.includes('LOCKED'));
  assert.ok(words.unlock_visor.includes('LOCKED'));
  panels.redrawAll();
  assert.ok(words.unlock_kit.includes('UNLOCKED'));
  panels.showUnlocks(['kit', 'gold', 'visor', 'vault']);
  for (const k of ['unlock_kit', 'unlock_gold', 'unlock_visor']) assert.deepEqual(words[k].filter(t => /LOCKED/.test(t)), ['UNLOCKED'], k);
});

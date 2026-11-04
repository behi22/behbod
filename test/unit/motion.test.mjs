import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCO, CROUCH, blendWeights, strideRate } from '../../web/src/pure/blend.js';
import { tierStep, ease } from '../../web/src/pure/tier.js';

const sum = m => [...m.values()].reduce((a, b) => a + b, 0);

test('each clip plays alone at its own speed', () => {
  for (const [name, speed] of LOCO) {
    const w = blendWeights(LOCO, speed);
    assert.equal(w.get(name), 1, name);
    assert.equal(sum(w), 1, name);
  }
});

test('between two speeds the two neighbours share the blend', () => {
  const w = blendWeights(LOCO, 2.5);
  assert.ok(Math.abs(w.get('Walk_Loop') - 0.5) < 1e-9);
  assert.ok(Math.abs(w.get('Jog_Fwd_Loop') - 0.5) < 1e-9);
  assert.equal(w.get('Idle_Loop'), 0);
  assert.equal(w.get('Sprint_Loop'), 0);
});

test('weights always add up to one, from standing still to past a sprint', () => {
  for (let s = 0; s <= 7; s += 0.05) {
    assert.ok(Math.abs(sum(blendWeights(LOCO, s)) - 1) < 1e-9, `speed ${s}`);
    assert.ok(Math.abs(sum(blendWeights(CROUCH, Math.min(s, 1.2))) - 1) < 1e-9, `crouch ${s}`);
  }
});

test('faster than a sprint stays a full sprint', () => {
  assert.equal(blendWeights(LOCO, 9).get('Sprint_Loop'), 1);
});

test('strides get longer when running', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(strideRate(0), 0);
  near(strideRate(1.45), 1);
  near(strideRate(3.45), 1.5);
  near(strideRate(5.8), 2);
});

test('quality never drops during the first six seconds', () => {
  let r = { tier: 'high', slowRuns: 0 };
  for (const now of [3000, 4000, 5500]) r = tierStep(r.tier, 40, now, r.slowRuns);
  assert.deepEqual(r, { tier: 'high', slowRuns: 0 });
});

test('one slow stretch is not enough, two in a row drop one step', () => {
  let r = tierStep('high', 30, 7000, 0);
  assert.deepEqual(r, { tier: 'high', slowRuns: 1 });
  r = tierStep(r.tier, 30, 9500, r.slowRuns);
  assert.deepEqual(r, { tier: 'medium', slowRuns: 0 });
});

test('a fast stretch in between resets the count', () => {
  let r = tierStep('high', 30, 7000, 0);
  r = tierStep(r.tier, 12, 9500, r.slowRuns);
  r = tierStep(r.tier, 30, 12000, r.slowRuns);
  assert.deepEqual(r, { tier: 'high', slowRuns: 1 });
});

test('low is the floor', () => {
  let r = { tier: 'low', slowRuns: 5 };
  r = tierStep(r.tier, 60, 20000, r.slowRuns);
  assert.equal(r.tier, 'low');
});

test('the ease curve starts at 0, ends at 1, is centred and only climbs', () => {
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.equal(ease(0.5), 0.5);
  for (let t = 0; t < 1; t += 0.01) assert.ok(ease(t + 0.01) >= ease(t));
});

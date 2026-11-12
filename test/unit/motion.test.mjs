import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCO, CROUCH, blendWeights, strideRate } from '../../web/src/pure/blend.js';
import { tierStep, ease, p90, TIER_ORDER, qualityNote, QUALITY_NOTE, makeQualityNotice } from '../../web/src/pure/tier.js';

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

// Runs a series of stretches through the quality judge, one every 2.5 s from `start`, and returns the tier after each.
function run(tier, stretches, start = 7000, state = { top: tier }) {
  const seen = [];
  stretches.forEach((times, k) => { state = tierStep(tier, times, start + k * 2500, state); tier = state.tier; seen.push(tier); });
  return { seen, state };
}
const slow = Array(60).fill(30), fast = Array(60).fill(16.7);

test('quality never drops during the first six seconds', () => {
  let r = { tier: 'ultra', top: 'ultra' };
  for (const now of [3000, 4000, 5500]) r = tierStep(r.tier, Array(60).fill(40), now, r);
  assert.equal(r.tier, 'ultra');
  assert.equal(r.slowRuns, 0);
});

test('one slow stretch is not enough, two in a row drop one step', () => {
  assert.deepEqual(run('ultra', [slow, slow]).seen, ['ultra', 'high']);
});

test('the first step down only lowers the pixel count, the effects stay', () => {
  assert.equal(TIER_ORDER.indexOf('ultra') - TIER_ORDER.indexOf('high'), 1);
  assert.deepEqual(run('ultra', [slow, slow, slow, slow, slow, slow]).seen, ['ultra', 'high', 'high', 'medium', 'medium', 'low']);
});

test('a fast stretch in between resets the count', () => {
  assert.deepEqual(run('ultra', [slow, fast, slow]).seen, ['ultra', 'ultra', 'ultra']);
});

test('low is the floor', () => {
  assert.equal(tierStep('low', Array(60).fill(60), 20000, { slowRuns: 5, top: 'ultra' }).tier, 'low');
});

// Regression: one slow patch (a busy moment, another program) used to lower the quality for the rest of the visit.
test('after a slow patch, steady frames bring the quality back', () => {
  const { seen } = run('ultra', [slow, slow, fast, fast, fast, fast]);
  assert.deepEqual(seen, ['ultra', 'high', 'high', 'high', 'high', 'ultra']);
});

test('it never climbs above where it started', () => {
  const { seen } = run('medium', Array(20).fill(fast));
  assert.ok(seen.every(t => t === 'medium'));
});

test('each try back up waits three times longer, so an edge machine settles', () => {
  // Slow at ultra, fine at high: it tries ultra again after 4 good stretches, then 12, then 36.
  let tier = 'ultra', state = { top: 'ultra' }, now = 7000;
  const ups = [];
  for (let k = 0; k < 120; k++) {
    state = tierStep(tier, tier === 'ultra' ? slow : fast, now, state);
    if (state.tier === 'ultra' && tier === 'high') ups.push(k);
    tier = state.tier; now += 2500;
  }
  const gaps = ups.slice(1).map((u, i) => u - ups[i]);
  assert.ok(ups.length >= 3, `tried ${ups.length} times`);
  assert.ok(gaps.every((g, i) => i === 0 || g > gaps[i - 1] * 2), `gaps ${gaps}`);
});

test('the ease curve starts at 0, ends at 1, is centred and only climbs', () => {
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.equal(ease(0.5), 0.5);
  for (let t = 0; t < 1; t += 0.01) assert.ok(ease(t + 0.01) >= ease(t));
});

// Regression: at 2x pixel density the house averaged 17 ms a frame (under the old 22 ms average limit) while one frame
// in ten took 33 ms, so it stuttered and never stepped down.
test('a stutter every tenth frame steps down even when the average looks fine', () => {
  const stretch = [...Array(88).fill(16.7), ...Array(12).fill(33.3)];
  const avg = stretch.reduce((a, b) => a + b, 0) / stretch.length;
  assert.ok(avg < 22, 'the average alone would hide it');
  assert.deepEqual(run('ultra', [stretch, stretch]).seen, ['ultra', 'high']);
  assert.equal(tierStep('ultra', Array(100).fill(16.7), 7000, { slowRuns: 1, top: 'ultra' }).tier, 'ultra', 'a steady 60 fps stays');
  assert.equal(p90(stretch), 33.3);
});

test('the visitor is told once, in plain words, when the quality lowers itself, and where its control is', () => {
  assert.equal(qualityNote('ultra', 'high', false), QUALITY_NOTE);
  assert.equal(qualityNote('medium', 'low', null), QUALITY_NOTE);
  assert.match(QUALITY_NOTE, /Settings/);
  // Told before (this visit or an earlier one): nothing more.
  assert.equal(qualityNote('ultra', 'high', true), null);
  assert.equal(qualityNote('high', 'medium', '1'), null);
  // Stepping back up, staying put, or a name that is not a quality level says nothing.
  assert.equal(qualityNote('high', 'ultra', false), null);
  assert.equal(qualityNote('high', 'high', false), null);
  assert.equal(qualityNote('high', 'auto', false), null);
});

// A notice wired to a pretend page: what was shown, and whether the visitor is remembered as told.
function notice(stored = false) {
  const page = { shown: [], stored };
  return { page, n: makeQualityNotice({ seen: () => page.stored, remember: () => { page.stored = true; }, show: t => page.shown.push(t) }) };
}

test('a quality note due while the welcome screen is up waits until the page is open, and is not spent before', () => {
  const { page, n } = notice();
  n.stepped('ultra', 'high');
  assert.deepEqual(page.shown, [], 'nothing can be read yet');
  assert.equal(page.stored, false, 'so the visitor does not count as told');
  n.opened();
  assert.deepEqual(page.shown, [QUALITY_NOTE]);
  assert.equal(page.stored, true);
  n.stepped('high', 'medium'); n.opened();
  assert.equal(page.shown.length, 1, 'once only');
});

test('with the page open the note shows at the step down; never for a step up or a visitor told before', () => {
  const a = notice();
  a.n.opened();
  assert.deepEqual(a.page.shown, [], 'opening the page alone says nothing');
  a.n.stepped('medium', 'high');
  assert.deepEqual(a.page.shown, []);
  a.n.stepped('high', 'medium');
  assert.deepEqual(a.page.shown, [QUALITY_NOTE]);
  a.n.stepped('medium', 'low');
  assert.equal(a.page.shown.length, 1);
  const b = notice(true);
  b.n.stepped('ultra', 'high'); b.n.opened(); b.n.stepped('high', 'low');
  assert.deepEqual(b.page.shown, []);
});

test('a waiting note is dropped if the quality has climbed back before the page opens', () => {
  const { page, n } = notice();
  n.stepped('ultra', 'high'); n.stepped('high', 'medium');
  n.stepped('medium', 'high');
  n.opened();
  assert.deepEqual(page.shown, [QUALITY_NOTE], 'still lower than it started: the note stands');
  const b = notice();
  b.n.stepped('ultra', 'high'); b.n.stepped('high', 'ultra');
  b.n.opened();
  assert.deepEqual(b.page.shown, [], 'back where it started: nothing to say');
  assert.equal(b.page.stored, false, 'and the one note is not spent');
  b.n.stepped('ultra', 'high');
  assert.deepEqual(b.page.shown, [QUALITY_NOTE], 'a later step down still gets its note');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, switchWork, tierStep, refreshFrom, effectsOf } from '../../web/src/pure/tier.js';

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
  const { seen } = run('ultra', [slow, slow, slow, slow, fast, fast], 7000);
  assert.deepEqual(seen, ['ultra', 'high', 'high', 'high', 'high', 'high']);
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

// His laptop at 1440x900 on a 2x screen (the b2 run): a stretch on ultra was slow 7 times in 15, on high 4 in 60.
function replay(seed, minutes) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, odds = { ultra: 7 / 15, high: 4 / 60, medium: 0.02, low: 0 };
  let tier = 'ultra', state = { top: 'ultra', from: 6300 }, switches = 0;
  for (let now = 8800; now < 6300 + minutes * 60000; now += 2500) {
    state = tierStep(tier, Array(100).fill(rnd() < odds[tier] ? 30 : 9), now, state);
    if (state.tier !== tier) switches++;
    tier = state.tier;
  }
  return switches;
}

// Regression: it tried ultra again after 10 s, 30 s, 90 s and then every 6 minutes for good, two switches and a
// stutter each time: 5 switches in 3 minutes on his laptop, 9 in 30. A rare unlucky run (two slow stretches in its
// first seconds on high) still costs one more try down and up.
test('on his laptop the quality settles: 3 switches in 30 minutes in at least 97 visits in 100, never more than 5', () => {
  const runs = Array.from({ length: 300 }, (_, k) => replay(k + 1, 30));
  assert.ok(runs.filter(n => n <= 3).length >= 0.97 * runs.length, `${runs.filter(n => n > 3).length} of 300 over 3`);
  assert.ok(Math.max(...runs) <= 5, `${Math.max(...runs)} switches`);
});

test('a tier that fails twice, at the start or after a try back up, is left for the rest of the visit', () => {
  const { seen, state } = run('ultra', [slow, slow, ...Array(8).fill(fast), slow, slow, ...Array(200).fill(fast)], 7000);
  assert.deepEqual(seen.slice(0, 12), ['ultra', 'high', 'high', 'high', 'high', 'high', 'high', 'ultra', 'ultra', 'ultra', 'ultra', 'high']);
  assert.ok(seen.slice(12).every(t => t === 'high'), 'stays on high');
  assert.equal(state.top, 'high');
});

test('a tier that holds rides out a short slow patch without a switch', () => {
  const { seen } = run('ultra', [...Array(40).fill(fast), slow, slow, slow, slow, ...Array(20).fill(fast)], 7000);
  assert.ok(seen.every(t => t === 'ultra'));
});

test('a capable machine with a long slow patch steps down but is not held lower: it keeps coming back', () => {
  const patch = [...Array(40).fill(fast), ...Array(5).fill(slow)];
  const { seen, state } = run('ultra', [...patch, ...patch, ...patch, ...Array(80).fill(fast)], 7000);
  assert.equal(seen.at(-1), 'ultra');
  assert.equal(seen.filter((t, k) => k > 0 && t !== seen[k - 1]).length, 6, 'down and back up after each patch');
  assert.equal(state.top, 'ultra');
});

// Frames on every tier as the screen or the browser hands them out, whatever the quality.
const capped = ms => () => Array(60).fill(ms);
// Runs a machine whose frame intervals depend on the tier it is on, and returns the tiers seen and the state.
function machine(frames, stretches, tier = 'ultra') {
  let state = { top: tier }, now = 7000;
  const seen = [];
  for (let k = 0; k < stretches; k++) { state = tierStep(tier, frames(tier), now, state); tier = state.tier; seen.push(tier); now += 2500; }
  return { seen, state, switches: seen.filter((t, k) => t !== (k ? seen[k - 1] : 'ultra')).length };
}

// Regression: with frames held to 30 a second (a battery saver) or to a 50 Hz screen, an idle machine walked from ultra
// down to low within seconds and stayed there, though no tier was any faster.
test('frames held to 30 a second: the drops buy nothing, so it goes back to ultra and stays', () => {
  const { seen, state, switches } = machine(capped(33.3), 200);
  assert.equal(seen.at(-1), 'ultra');
  assert.equal(state.floor, 'ultra');
  assert.ok(seen.slice(40).every(t => t === 'ultra'));
  assert.equal(switches, 4, 'down to low, then back');
});

test('a 50 Hz screen: never a step down, the line follows the screen', () => {
  const { seen, switches } = machine(capped(20.4), 200);
  assert.ok(seen.every(t => t === 'ultra'));
  assert.equal(switches, 0);
});

test('a machine held to 30 fps on ultra by its graphics card and faster on high still steps down, and stays down', () => {
  const { seen, state } = machine(t => Array(60).fill(t === 'ultra' ? 33.3 : 16.7), 200);
  assert.ok(seen.slice(30).every(t => t === 'high'), seen.slice(0, 30).join(' '));
  assert.equal(state.floor, 'low');
});

test('on a 60 Hz screen, a graphics card too slow for one frame per refresh on ultra and high, but not on medium, gets to medium', () => {
  const { seen } = machine(t => Array(60).fill(t === 'ultra' || t === 'high' ? 33.3 : 16.7), 200);
  assert.ok(seen.slice(60).every(t => t === 'medium'), seen.slice(0, 60).join(' '));
});

test('a graphics card that only gets faster with no effects at all is followed down to low', () => {
  const { seen } = machine(t => Array(60).fill(t === 'low' ? 16.7 : 33.3), 200);
  assert.ok(seen.slice(40).every(t => t === 'low'), seen.slice(0, 40).join(' '));
});

// One stretch of frames from a screen refreshing every `r` ms, nine in ten taking `fast` refreshes and one in ten `slow`,
// each measured a little late, as a page measures them.
const stretch = (r, fast, slow) => [...Array(90).fill(r * fast + 0.4), ...Array(10).fill(r * slow + 0.4)];
// Whether the judge calls a stretch slow: on a shaky tier with one slow stretch already, a second steps it down.
const judged = (times, state = {}) => tierStep('ultra', times, 30000, { top: 'ultra', slowRuns: 1, record: { ultra: [10, 10] }, ...state }).tier !== 'ultra';

// Regression: the line was a fixed 20 ms. On a 50 Hz screen every frame is 20 ms, so an idle machine stepped down to
// low; on 144 Hz a frame of three refreshes (20.8 ms, 48 fps) counted as slow while 60 Hz forgave anything under 33 ms.
// Now the line is about 50 fps on every screen: 20 ms plus half the screen's refresh.
for (const [hz, ok, bad] of [[60, 1, 2], [120, 2, 3], [144, 3, 4], [165, 3, 4], [50, 1, 2], [30, 1, 2]]) {
  test(`on a ${hz} Hz screen, frames of ${ok} refresh(es) are fine and frames of ${bad} are slow`, () => {
    const r = 1000 / hz;
    assert.equal(judged(stretch(r, 1, ok), { refresh: r }), false);
    assert.equal(judged(stretch(r, 1, bad), { refresh: r }), true);
  });
}

test('the screen is also learned from the frames themselves: the quickest stretch seen sets the refresh', () => {
  // No estimate from loading: a 144 Hz screen shows itself in its quick frames and three-refresh frames are forgiven.
  const r = 1000 / 144;
  assert.equal(judged(stretch(r, 1, 3)), false);
  // A screen read as slower while loading than the frames now show is corrected by the frames.
  assert.equal(judged(stretch(r, 1, 3), { refresh: 1000 / 60 }), false);
});

test('a slow machine is not taken for a slow screen: frames held to 30 a second by the card still step down on a 60 Hz screen', () => {
  const steady = Array(100).fill(33.3);
  assert.equal(judged(steady, { refresh: 1000 / 60 }), true, 'the screen read while loading');
  assert.equal(judged(steady), true, 'no reading at all: a 60 Hz screen is assumed, never a slow one');
});

test('the refresh read while loading: the quick frames between the busy ones, or nothing if there were too few', () => {
  const busy = [...Array(80).fill(0).map((_, i) => 40 + (i % 7) * 30), ...Array(20).fill(8.33)];
  assert.ok(Math.abs(refreshFrom(busy) - 8.33) < 0.01);
  assert.ok(Math.abs(refreshFrom([...Array(60).fill(20), ...Array(20).fill(140)]) - 20) < 0.01, 'a 50 Hz screen');
  assert.equal(refreshFrom(Array(10).fill(16.7)), null);
  assert.equal(refreshFrom([]), null);
  assert.ok(Math.abs(refreshFrom([0, 0, 0.1, ...Array(40).fill(16.67)]) - 16.67) < 0.01, 'gaps too short to be frames are left out');
  assert.equal(refreshFrom(Array(50).fill(0.2)), null);
  assert.equal(refreshFrom(Array(50).fill(3.2)), 4, 'never quicker than a 240 Hz screen');
});

test('with the line at 50 fps, a battery cap that starts mid visit (the screen read at 120 Hz) still meets the backstop: no gain, back up, and no more steps down', () => {
  let tier = 'ultra', state = { top: 'ultra', refresh: 1000 / 120 }, now = 7000;
  const seen = [];
  for (let k = 0; k < 120; k++) { state = tierStep(tier, k < 20 ? Array(100).fill(8.33) : Array(100).fill(33.3), now, state); tier = state.tier; seen.push(tier); now += 2500; }
  assert.ok(seen.slice(60).every(t => t === 'ultra'), seen.join(' '));
  assert.equal(state.floor, 'ultra');
});

// On a 60 Hz screen frames come in whole refreshes: a stretch of 100 frames with `late` of them two refreshes long.
const at60 = late => [...Array(100 - late).fill(1000 / 60), ...Array(late).fill(2000 / 60)];
const switchesOf = seen => seen.filter((t, k) => k > 0 && t !== seen[k - 1]).length;
// Regression: a step down had to make frames 10% quicker on average, but on 60 Hz a tier that was slow with 11 late
// frames in 100 has an average only 11% over a smooth one, so a smooth tier below did not count. Ultra stuttering with
// 11 late frames in 100 walked down to low and back, then stayed on ultra, stuttering, for the rest of the visit.
test('on 60 Hz, a tier below that is no longer slow has bought something, though its average is about the same', () => {
  const { seen, state } = machine(t => at60(t === 'ultra' ? 11 : 0), 200);
  assert.ok(!seen.includes('medium') && !seen.includes('low'), seen.slice(0, 20).join(' '));
  assert.ok(seen.slice(60).every(t => t === 'high'), seen.slice(0, 60).join(' '));
  assert.notEqual(state.floor, 'ultra');
});

// Regression: ultra with 20 late frames in 100 and high with 8 (smooth by the line) went on to medium, since high's
// average was not 10% better, and the visit saw 7 switches instead of 3.
test('on 60 Hz, a step down stops at the first tier that is smooth', () => {
  const { seen } = machine(t => at60({ ultra: 20, high: 8, medium: 2, low: 0 }[t]), 200);
  assert.ok(!seen.includes('medium'), seen.slice(0, 40).join(' '));
  assert.ok(switchesOf(seen) <= 3, `${switchesOf(seen)} switches: ${seen.slice(0, 40).join(' ')}`);
  assert.ok(seen.slice(60).every(t => t === 'high'));
});

// Regression: a switch that adds or drops an effect built the new effects chain and compiled its shaders inside one
// frame: 150 to 310 ms on his laptop at 2x, 80 to 230 ms on a slowed phone. Now it is built in the background, one
// chain per set of effects, and ultra and high share theirs.
test('each tier names its set of effects; ultra and high share one, every other pair differs', () => {
  assert.equal(effectsOf('ultra'), effectsOf('high'));
  const sets = ['low', 'medium', 'high'].map(effectsOf);
  assert.equal(new Set(sets).size, 3);
  assert.equal(effectsOf('low'), 'none');
  assert.equal(effectsOf('nope'), null);
  for (const a of Object.keys(TIERS)) for (const b of Object.keys(TIERS)) assert.equal(effectsOf(a) !== effectsOf(b), switchWork(a, b).post, `${a} ${b}`);
});

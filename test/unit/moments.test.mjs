import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMoments, MOMENTS, GAP, MEAN, pickMoment, zoomiesBoost, lowPower } from '../../web/src/pure/moments.js';

// A small seeded random, so the long runs below are the same every time.
const seeded = (seed = 7) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const SPONT = Object.keys(MOMENTS).filter(id => MOMENTS[id].weight);

test('one showy moment at a time, then a calm gap before the next', () => {
  const m = makeMoments();
  assert.equal(m.start('zoomies', GAP - 1), false, 'the house is calm for a while after the page opens');
  assert.equal(m.start('zoomies', GAP), true);
  assert.equal(m.active, 'zoomies');
  assert.equal(m.start('vacuum', GAP + 5), false, 'nothing else while it runs');
  assert.equal(m.ready('dance', GAP + 5), false);
  m.end('vacuum', GAP + 6);
  assert.equal(m.active, 'zoomies', 'only the running one can end it');
  m.end('zoomies', 100);
  assert.equal(m.active, null);
  assert.equal(m.start('vacuum', 100 + GAP - 0.1), false, 'still the calm gap');
  assert.equal(m.start('vacuum', 100 + GAP), true);
});

test('each moment has its own cooldown, counted from when it started', () => {
  const m = makeMoments({ start: -1e9 });
  assert.ok(m.start('chatter', 0));
  m.end('chatter', 5);
  assert.equal(m.ready('chatter', 5 + GAP), false);
  assert.equal(m.ready('chatter', MOMENTS.chatter.cool - 0.01), false);
  assert.equal(m.ready('chatter', MOMENTS.chatter.cool), true);
  assert.equal(m.ready('keywalk', 5 + GAP), true, 'another one only waits for the gap');
});

test('quiet touches never take the slot and never wait for it, but keep their own cooldown', () => {
  const m = makeMoments();
  assert.ok(m.start('tilt', 1), 'not held by the calm after the page opens');
  assert.ok(m.start('zoomies', GAP));
  assert.ok(m.start('wag', GAP + 1), 'not held by a running moment');
  assert.equal(m.active, 'zoomies');
  assert.equal(m.start('tilt', 1 + MOMENTS.tilt.cool - 0.5), false);
  assert.ok(m.start('tilt', 1 + MOMENTS.tilt.cool));
});

test('a moment the visitor sets off is one roll at its chance; a miss costs nothing', () => {
  const m = makeMoments({ start: -1e9 });
  assert.equal(m.roll('howl', 0, MOMENTS.howl.chance + 0.01), false);
  assert.equal(m.active, null);
  assert.equal(m.roll('howl', 0, MOMENTS.howl.chance - 0.01), true);
  assert.equal(m.active, 'howl');
  assert.equal(m.roll('dance', 1, 0), false, 'still one at a time');
});

test('a forced moment starts whatever the rules say (the test hooks)', () => {
  const m = makeMoments();
  assert.ok(m.force('tail', 0));
  assert.equal(m.active, 'tail');
  assert.equal(m.force('nothing', 0), false);
});

test('the table: every moment belongs to one of the three, showy ones are rare, each is started one way', () => {
  for (const [id, d] of Object.entries(MOMENTS)) {
    assert.ok(['pishi', 'jessi', 'bh22'].includes(d.who), id);
    if (d.quiet) { assert.ok(d.cool >= 20 && !d.weight, id); continue; }
    assert.ok(d.cool >= 240, `${id} must be rare`);
    assert.ok(!(d.weight && d.chance), `${id}: started by the house or by the visitor, not both`);
    if (d.chance) assert.ok(d.chance > 0 && d.chance <= 0.6, id);
  }
  // At least one of Pishi's, Jessi's and BH-22's moments the house can start of its own.
  for (const who of ['pishi', 'jessi', 'bh22']) assert.ok(SPONT.some(id => MOMENTS[id].who === who), who);
});

test('left to itself the house starts about one moment every four minutes, never two at once', () => {
  const rand = seeded(11), m = makeMoments(), dt = 1 / 30, HOURS = 6, LAST = 12;
  const starts = [], byId = {};
  let running = null;
  for (let t = 0; t < HOURS * 3600; t += dt) {
    if (running && t >= running.end) { m.end(running.id, t); running = null; }
    if (m.due(t, dt, rand())) {
      const id = pickMoment(SPONT.filter(k => m.ready(k, t)), MOMENTS, rand());
      if (id && m.start(id, t)) {
        assert.equal(running, null, 'two at once');
        running = { id, end: t + LAST };
        starts.push(t);
        (byId[id] ||= []).push(t);
      }
    }
  }
  const per = starts.length / HOURS, expect = 3600 / (GAP + MEAN + LAST);
  assert.ok(per > expect * 0.75 && per < expect * 1.25, `${per.toFixed(1)} an hour, expected about ${expect.toFixed(1)}`);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= GAP + LAST - 1e-6, 'the calm gap');
  for (const [id, ts] of Object.entries(byId)) for (let i = 1; i < ts.length; i++) assert.ok(ts[i] - ts[i - 1] >= MOMENTS[id].cool - 1e-6, `${id} cooldown`);
  // A few minutes of walking about shows maybe one.
  const windows = [];
  for (let w = 0; w + 300 <= HOURS * 3600; w += 60) windows.push(starts.filter(t => t >= w && t < w + 300).length);
  const mean = windows.reduce((a, b) => a + b, 0) / windows.length;
  assert.ok(mean > 0.8 && mean < 1.8, `about one in five minutes, got ${mean.toFixed(2)}`);
  assert.ok(Math.max(...windows) <= 3, 'never a burst');
});

test('picking by weight, with a boost', () => {
  const rand = seeded(3), n = 30000, count = { zoomies: 0, keywalk: 0 };
  for (let i = 0; i < n; i++) count[pickMoment(['zoomies', 'keywalk'], MOMENTS, rand())]++;
  const share = count.zoomies / n, w = MOMENTS.zoomies.weight / (MOMENTS.zoomies.weight + MOMENTS.keywalk.weight);
  assert.ok(Math.abs(share - w) < 0.02, `${share} vs ${w}`);
  let late = 0;
  for (let i = 0; i < n; i++) if (pickMoment(['zoomies', 'keywalk'], MOMENTS, rand(), { zoomies: 4 }) === 'zoomies') late++;
  assert.ok(late / n > share + 0.2, 'zoomies more likely when boosted');
  assert.equal(pickMoment([], MOMENTS, 0.5), null);
  assert.equal(pickMoment(['keys', 'howl'], MOMENTS, 0.5), null, 'none of these has a weight');
  assert.equal(pickMoment(['keys', 'tail'], MOMENTS, 0.999999), 'tail');
});

test('zoomies late at night by Vancouver time, BH-22 low on power through the night', () => {
  for (const h of [22, 23.5, 0, 2.9]) assert.equal(zoomiesBoost(h), 4, String(h));
  for (const h of [3, 9, 12, 21.9]) assert.equal(zoomiesBoost(h), 1, String(h));
  for (const h of [23, 0.5, 5.9]) assert.equal(lowPower(h), true, String(h));
  for (const h of [6, 12, 22.9]) assert.equal(lowPower(h), false, String(h));
});

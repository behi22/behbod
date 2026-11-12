import test from 'node:test';
import assert from 'node:assert/strict';
import { spring, springStep, kick, critical, smoother, approach, track } from '../../web/src/pure/springs.js';

const settle = (s, target, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) springStep(s, target, dt); return s; };

test('a spring comes to rest on its target', () => {
  const s = settle(spring(120, critical(120)), 1, 2);
  assert.ok(Math.abs(s.x - 1) < 1e-4 && Math.abs(s.v) < 1e-3);
});

test('a critically damped spring does not swing past; a loose one does', () => {
  const tight = spring(200, critical(200)), loose = spring(200, 4);
  let topTight = 0, topLoose = 0;
  for (let i = 0; i < 240; i++) { topTight = Math.max(topTight, springStep(tight, 1, 1 / 120)); topLoose = Math.max(topLoose, springStep(loose, 1, 1 / 120)); }
  assert.ok(topTight <= 1.001, `tight peaked at ${topTight}`);
  assert.ok(topLoose > 1.2, `loose peaked at ${topLoose}`);
});

test('a kick moves it off and it finds its way back', () => {
  const s = spring(160, critical(160));
  kick(s, 3);
  springStep(s, 0, 0.05);
  assert.ok(s.x > 0.03, 'it moved');
  settle(s, 0, 1.5);
  assert.ok(Math.abs(s.x) < 1e-4);
});

test('one long frame gives the same answer as many short ones, and never blows up', () => {
  const a = spring(900, 20), b = spring(900, 20);
  springStep(a, 1, 0.25);
  for (let i = 0; i < 250; i++) springStep(b, 1, 0.001);
  assert.ok(Math.abs(a.x - b.x) < 0.05, `${a.x} against ${b.x}`);
  const wild = spring(4000, 10);
  for (let i = 0; i < 20; i++) springStep(wild, 1, 0.5);
  assert.ok(Number.isFinite(wild.x) && Math.abs(wild.x) < 5);
});

test('smoother eases from 0 to 1 and holds outside', () => {
  assert.equal(smoother(-1), 0); assert.equal(smoother(0), 0); assert.equal(smoother(0.5), 0.5); assert.equal(smoother(1), 1); assert.equal(smoother(3), 1);
  assert.ok(smoother(0.1) < 0.1 && smoother(0.9) > 0.9, 'slow at both ends');
});

test('approach closes the same share of the gap whatever the frame rate', () => {
  let a = 0, b = 0;
  for (let i = 0; i < 60; i++) a = approach(a, 1, 8, 1 / 60);
  for (let i = 0; i < 20; i++) b = approach(b, 1, 8, 1 / 20);
  assert.ok(Math.abs(a - b) < 1e-9);
  assert.ok(a > 0.99 && a < 1);
});

test('a track holds its ends and eases between keys, for numbers and for lists', () => {
  const keys = [[0, 0], [1, 10], [2, 4]];
  assert.equal(track(keys, -1), 0); assert.equal(track(keys, 0), 0); assert.equal(track(keys, 0.5), 5);
  assert.equal(track(keys, 1), 10); assert.equal(track(keys, 1.5), 7); assert.equal(track(keys, 9), 4);
  assert.deepEqual(track([[0, [0, 0, 0]], [2, [2, 4, -6]]], 1), [1, 2, -3]);
  assert.equal(track([], 1), 0);
  assert.equal(track([[1, 7]], 5), 7);
});

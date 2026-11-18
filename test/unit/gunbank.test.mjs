import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBank } from '../../web/src/audio/pure/gunbank.js';
import { soundsFor, gunSound, TAKES } from '../../web/src/audio/pure/gunsound.js';

// A worker that answers only when told, and a page whose between-frames jobs run only when told.
function rig({ worker = true, breaks = false } = {}) {
  const sent = [], later = [], built = [];
  const w = worker ? { postMessage: j => sent.push(j), terminate() { this.dead = true; } } : null;
  const bank = makeBank({
    spawn: () => { if (breaks) throw new Error('no workers here'); return w; },
    build: (gun, name, take) => { built.push(`${gun}:${name}:${take}`); return [new Float32Array(10), new Float32Array(10)]; },
    make: (L, R) => ({ L, R }),
    later: fn => later.push(fn),
    rand: () => 0,
  });
  const answer = () => { const j = sent[sent.length - 1]; w.onmessage({ data: { key: j.key, L: new Float32Array(100), R: new Float32Array(100) } }); };
  const runLater = () => { const fns = later.splice(0); for (const f of fns) f(); };
  return { bank, sent, later, built, w, answer, runLater };
}
const keys = (gun, opts) => soundsFor(gun, opts).map(([n, t]) => `${gun}:${n}:${t}`);

test('a gun asks for its sounds draw first, then the shot, and never the suppressed shot until a suppressor is on', () => {
  const list = soundsFor('pistol');
  assert.deepEqual(list.slice(0, 5), [['draw', 0], ['shot', 0], ['shot', 1], ['shot', 2], ['dry', 0]]);
  assert.ok(!list.some(([n]) => n === 'shotQuiet'));
  assert.equal(soundsFor('pistol', { quiet: true }).filter(([n]) => n === 'shotQuiet').length, TAKES.shotQuiet);
  assert.equal(new Set(list.map(x => x.join())).size, list.length);
  assert.deepEqual(soundsFor('nothing'), []);
  assert.equal(gunSound('magIn', 'nothing'), null);
});

test('with a worker: one sound at a time goes to it, in order, and nothing is made on the page', () => {
  const r = rig();
  r.bank.take('pistol');
  assert.equal(r.sent.length, 1);
  assert.equal(r.sent[0].key, 'pistol:draw:0');
  assert.deepEqual(r.sent[0], { key: 'pistol:draw:0', gun: 'pistol', name: 'draw', take: 0 });
  const want = keys('pistol');
  for (let i = 0; i < want.length; i++) { assert.equal(r.sent[i].key, want[i]); r.answer(); }
  assert.equal(r.sent.length, want.length);
  assert.equal(r.built.length, 0);
  assert.equal(r.later.length, 0);
  const s = r.bank.stats();
  assert.equal(s.sounds, want.length);
  assert.equal(s.bytes, want.length * 800);
  assert.equal(s.where, 'worker');
  assert.equal(s.queued, 0);
  assert.ok(r.bank.get('pistol', 'shot'));
  // Taking the same gun again asks for nothing more.
  r.bank.take('pistol');
  assert.equal(r.sent.length, want.length);
});

test('a sound wanted before it is made jumps the line and is handed over the moment it arrives', () => {
  const r = rig();
  r.bank.take('pistol');
  const got = [];
  r.bank.hurry('pistol', 'magIn', b => got.push(b));
  assert.equal(got.length, 0);
  r.answer();                                   // the draw, already in the worker
  assert.equal(r.sent[1].key, 'pistol:magIn:0');
  r.answer();
  assert.equal(got.length, 1);
  assert.equal(r.bank.get('pistol', 'magIn'), got[0]);
  // A sound asked for twice while it is being made is made once and handed to both.
  r.bank.hurry('pistol', 'dry', b => got.push(b)); r.bank.hurry('pistol', 'dry', b => got.push(b));
  assert.equal(r.sent.filter(j => j.key === 'pistol:dry:0').length, 0);
  r.answer();                                   // the shot that was next before the hurry
  assert.equal(r.sent.filter(j => j.key === 'pistol:dry:0').length, 1);
  r.answer();
  assert.equal(got.length, 3);
  // One already made is handed over at once.
  r.bank.hurry('pistol', 'dry', b => got.push(b));
  assert.equal(got.length, 4);
  // Nothing the gun does not make, nothing for a gun with no sounds.
  r.bank.hurry('pistol', 'nothing', () => assert.fail());
  r.bank.hurry('nothing', 'shot', () => assert.fail());
});

test('another gun taken lets the first one\'s sounds go, even one arriving late', () => {
  const r = rig();
  r.bank.take('pistol');
  for (let i = 0; i < 4; i++) r.answer();
  assert.equal(r.bank.stats().sounds, 4);
  const inFlight = r.sent.length;
  r.bank.take('other');
  assert.equal(r.bank.stats().sounds, 0);
  assert.equal(r.bank.stats().bytes, 0);
  assert.equal(r.bank.stats().queued, 1, 'only the job already in the worker, for a gun with no sounds of its own');
  r.answer();
  assert.equal(r.bank.stats().sounds, 0, 'the late arrival is not kept');
  assert.equal(r.sent.length, inFlight, 'and nothing more of the pistol is asked for');
  assert.equal(r.bank.get('pistol', 'draw'), null);
});

test('the suppressed shot joins only when asked for, and the rest stay', () => {
  const r = rig();
  r.bank.take('pistol');
  const n = keys('pistol').length;
  for (let i = 0; i < n; i++) r.answer();
  r.bank.want('pistol', 'shot');
  assert.equal(r.sent.length, n);
  r.bank.want('pistol', 'shotQuiet');
  assert.equal(r.bank.stats().sounds, n);
  for (let i = 0; i < TAKES.shotQuiet; i++) r.answer();
  assert.equal(r.bank.stats().sounds, n + TAKES.shotQuiet);
  assert.ok(r.sent.slice(n).every(j => j.name === 'shotQuiet'));
  // Taken again without one, the suppressed takes go.
  r.bank.take('pistol', { quiet: false });
  assert.equal(r.bank.stats().sounds, n);
});

test('with no worker the page makes one sound between frames, and a sound wanted now at once', () => {
  const r = rig({ breaks: true });
  r.bank.take('pistol');
  assert.equal(r.bank.stats().where, 'page');
  assert.equal(r.built.length, 0, 'nothing in the middle of a frame');
  r.runLater();
  assert.deepEqual(r.built, ['pistol:draw:0']);
  const got = [];
  r.bank.hurry('pistol', 'magOut', b => got.push(b));
  assert.equal(got.length, 1, 'no worker: no waiting, no missing sound');
  assert.ok(r.built.includes('pistol:magOut:0'));
  let rounds = 0;
  while (r.later.length && rounds++ < 100) r.runLater();
  assert.equal(r.bank.stats().sounds, keys('pistol').length);
  assert.equal(new Set(r.built).size, r.built.length, 'nothing made twice');
});

test('a worker that breaks hands its sound back to the page, and whoever waited still gets it', () => {
  const r = rig();
  r.bank.take('pistol');
  const got = [];
  r.bank.hurry('pistol', 'draw', b => got.push(b));
  r.w.onerror({ preventDefault() {} });
  assert.ok(r.w.dead);
  assert.equal(r.bank.stats().where, 'page');
  r.runLater();
  assert.equal(got.length, 1);
  assert.deepEqual(r.built, ['pistol:draw:0']);
  // From here a hurried sound is made at once.
  r.bank.hurry('pistol', 'magIn', b => got.push(b));
  assert.equal(got.length, 2);
});

test('the pistol\'s sounds as held come to under 4.5 MB (7.3 MB before the tails were cut and the suppressed shot left out)', () => {
  let bytes = 0;
  for (const [n, t] of soundsFor('pistol')) { const [L, R] = gunSound(n, 'pistol', t); bytes += (L.length + R.length) * 4; }
  assert.ok(bytes < 4.5e6, `${(bytes / 1e6).toFixed(2)} MB`);
});

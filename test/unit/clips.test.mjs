import test from 'node:test';
import assert from 'node:assert/strict';
import { between, sample, cues, pistolClips, CLIPS } from '../../web/src/pure/clips.js';
import { stats } from '../../web/src/pure/arsenal.js';
import { newWeapon, step } from '../../web/src/pure/weapon.js';
import { solveHolds } from '../../web/src/pure/handling.js';
import { SOUND_NAMES } from '../../web/src/audio/pure/gunsound.js';

const plain = stats('pistol', []), big = stats('pistol', ['mag']);
const holds = solveHolds('pistol');
const NAMES = { right: new Set(Object.keys(holds.right)), left: new Set([...Object.keys(holds.left), 'low']) };
const all = s => { const c = pistolClips(s); return Object.entries(c); };

test('a track of names: before, between (eased) and after its keys', () => {
  const k = [[0, 'a'], [1, 'b'], [2, 'b']];
  assert.deepEqual(between(k, -1), { a: 'a', b: 'a', k: 0 });
  assert.deepEqual(between(k, 0.5), { a: 'a', b: 'b', k: 0.5 });
  assert.ok(between(k, 0.25).k < 0.25, 'eased in');
  assert.deepEqual(between(k, 1.5), { a: 'b', b: 'b', k: 0 });
  assert.deepEqual(between(k, 9), { a: 'b', b: 'b', k: 0 });
  assert.equal(between([], 1), null);
});

test('cues fire once each, in order, however the time is cut up', () => {
  const clip = pistolClips(plain).reloadEmpty, want = clip.cues.map(c => c[1]);
  for (const dt of [1 / 30, 1 / 60, 1 / 144, 0.25]) {
    const got = [];
    let t = -1;
    for (let now = 0; now <= clip.T + dt; now += dt) { got.push(...cues(clip, t, Math.min(now, clip.T))); t = Math.min(now, clip.T); }
    assert.deepEqual(got, want, `at a step of ${dt}`);
  }
});

test('every clip: keys in time order, only poses the holds have, and it ends where the hold is', () => {
  for (const s of [plain, big]) for (const [name, c] of all(s)) {
    for (const tr of ['gun', 'right', 'left', 'mag', 'slide', 'cues']) {
      const keys = c[tr] || [];
      for (let i = 1; i < keys.length; i++) assert.ok(keys[i][0] >= keys[i - 1][0], `${name}.${tr} out of order at ${i}`);
    }
    for (const side of ['right', 'left']) for (const [, pose] of c[side] || []) assert.ok(NAMES[side].has(pose), `${name}: ${side} pose ${pose}`);
    const end = sample(c, c.T);
    assert.ok(end.gun.every(v => Math.abs(v) < 1e-9), `${name} leaves the gun moved: ${end.gun}`);
    assert.equal(end.right.b, 'grip', `${name}: the trigger hand ends on the grip`);
    assert.ok(end.right.k === 0 || end.right.k === 1);
    assert.equal(end.left.b, 'grip', `${name}: the free hand ends on the grip`);
    assert.equal(end.slide, null, `${name}: the slide is let go`);
  }
});

test('the reloads keep time with the weapon: magazine out, in and the slide at the weapon\'s own moments', () => {
  for (const s of [plain, big]) {
    const C = pistolClips(s);
    for (const [clip, empty] of [[C.reload, false], [C.reloadEmpty, true]]) {
      assert.equal(clip.T, empty ? s.reload.empty : s.reload.partial);
      const at = name => clip.cues.find(c => c[1] === name)?.[0];
      assert.equal(at('magOut'), s.reload.out); assert.equal(at('magIn'), s.reload.in);
      assert.equal(at('slideRelease'), empty ? s.reload.rack : undefined);
      // The fresh magazine is home the moment the weapon counts it in, and well out of the gun before.
      assert.deepEqual(sample(clip, s.reload.in).mag, [0, 0]);
      assert.ok(sample(clip, s.reload.in - 0.15).mag[0] > 0.04);
      // The free hand holds it on the way up.
      for (const t of [s.reload.out + 0.2, s.reload.in - 0.1, s.reload.in]) assert.equal(sample(clip, t).left.b, 'mag', `${empty} at ${t}`);
      // The trigger finger is off the trigger from the start; the thumb presses the release as the magazine goes.
      assert.equal(sample(clip, 0.2).right.b, 'straight');
      assert.equal(sample(clip, s.reload.out).right.a === 'release' || sample(clip, s.reload.out).right.b === 'release', true);
      if (empty) {
        const r = sample(clip, s.reload.rack - 0.01).right;
        assert.ok(r.a === 'stop' || r.b === 'stop', 'the thumb is on the slide stop as it lets the slide go');
      }
    }
  }
});

test('the reload clip and the weapon, run together: every weapon event lands on its cue', () => {
  const s = plain, C = pistolClips(s), w = newWeapon(s), dt = 1 / 120;
  for (let i = 0; i < 60; i++) step(w, s, dt, {});
  w.ammo = 0;
  const seen = [];
  let last = -1;
  step(w, s, dt, { reload: true });
  for (let i = 0; i < 400 && w.phase === 'reload'; i++) {
    const evs = step(w, s, dt, {});
    if (w.phase !== 'reload') break;
    const here = cues(C.reloadEmpty, last, w.t); last = w.t;
    for (const e of evs) if (['mag_out', 'mag_in', 'rack'].includes(e.type)) seen.push([e.type, here]);
  }
  assert.deepEqual(seen.map(([e, c]) => [e, c.includes({ mag_out: 'magOut', mag_in: 'magIn', rack: 'slideRelease' }[e])]), [['mag_out', true], ['mag_in', true], ['rack', true]]);
});

test('the look over: the gun turns well round, the slide is eased back in the middle, the cues are its own', () => {
  const c = pistolClips(plain).inspect;
  assert.ok(c.T > 2.5 && c.T < 4.5);
  const yaws = [];
  for (let t = 0; t <= c.T; t += 0.05) yaws.push(sample(c, t).gun[4]);
  assert.ok(Math.max(...yaws) > 0.9 && Math.min(...yaws) < -0.7, 'shows both sides');
  const mid = sample(c, (c.held[0] + c.held[1]) / 2);
  assert.ok(mid.slide > 0.25 && mid.slide < 0.5, `slide ${mid.slide}`);
  assert.equal(sample(c, c.held[1] + 0.01).slide, null);
  assert.ok(c.cues.some(x => x[1] === 'slidePull') && c.cues.some(x => x[1] === 'slideHome'));
});

test('the draw brings the free hand up to the gun', () => {
  const c = pistolClips(plain).draw;
  assert.equal(sample(c, 0).left.a, 'low');
  assert.equal(sample(c, c.T).left.b, 'grip');
  assert.ok(c.T >= plain.draw);
  assert.equal(CLIPS.pistol, pistolClips);
});

test('every sound a clip cues is a sound there is', () => {
  for (const [, clip] of all(plain)) for (const [, name] of clip.cues || []) assert.ok(SOUND_NAMES.includes(name), name);
  assert.ok(SOUND_NAMES.includes('dry'));
});

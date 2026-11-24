import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnTick, TURN, makeStance, STEP } from '../../web/src/pure/steps.js';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const DT = 1 / 60;

// Turns from standing toward `want` until done (or `secs` run out), the way walk() feeds it: the ground speed is what
// the gate has let through so far. Returns the frames.
function turnFrom(facing, want, secs = 2) {
  let spin = 0, hs = 0;
  const frames = [];
  for (let t = 0; t < secs; t += DT) {
    const r = turnTick(facing, spin, want, hs, DT);
    // At a walk the body follows its way of travel, which is the way asked (walk() does this part).
    if (!r.on) r.facing = facing + wrap(want - facing) * Math.min(1, 12 * DT);
    frames.push({ t, ...r });
    facing = r.facing; spin = r.spin;
    hs += (1.9 * r.gate - hs) * Math.min(1, 10 * DT);
  }
  return frames;
}

test('a half turn from standing takes about half a second, turning first and walking off at the end', () => {
  const f = turnFrom(0, Math.PI);
  const done = f.findIndex(x => Math.abs(wrap(Math.PI - x.facing)) < 0.05);
  assert.ok(done > 0);
  const secs = f[done].t;
  assert.ok(secs > 0.35 && secs < 0.75, `half turn in ${secs.toFixed(2)} s`);
  // No walking while still facing away; full walking once facing the way.
  assert.equal(f[0].gate, 0);
  assert.ok(f.filter(x => Math.abs(wrap(Math.PI - x.facing)) > TURN.open[0]).every(x => x.gate === 0));
  assert.ok(f.filter(x => Math.abs(wrap(Math.PI - x.facing)) < TURN.open[1]).every(x => x.gate === 1));
});

test('the turn never overshoots and its speed changes smoothly, never by a jump', () => {
  for (const want of [Math.PI * 0.99, -Math.PI * 0.99, 1.2, -0.4, 2.5]) {
    const f = turnFrom(0, want);
    for (const x of f) assert.ok(Math.abs(x.facing) <= Math.abs(want) + 1e-9, `overshot ${x.facing} past ${want}`);
    const on = f.filter(x => x.on);
    for (let i = 1; i < on.length; i++) assert.ok(Math.abs(on[i].spin - on[i - 1].spin) <= TURN.max * DT * TURN.ease + 1e-9);
    assert.ok(Math.max(...on.map(x => Math.abs(x.spin))) <= TURN.max + 1e-9);
  }
});

test('a small change of way walks off at once, turning as it goes', () => {
  const f = turnFrom(0, 0.3);
  assert.equal(f[0].gate, 1);
});

test('at a walk or faster, with no turn under way, the body follows its way of travel, as before', () => {
  const r = turnTick(0.3, 0, Math.PI, TURN.slow, DT);
  assert.deepEqual(r, { facing: 0.3, spin: 0, gate: 1, on: false });
});

test('a turn under way carries on into the walk and slows to a stop on the way asked, its speed never jumping', () => {
  const f = turnFrom(0, Math.PI * 0.99);
  assert.ok(f.some(x => x.on && x.gate === 1), 'it was still turning once the walk had opened fully');
  let last = 0, jump = 0, prev = 0;
  for (const x of f) { const rate = (x.facing - prev) / DT; jump = Math.max(jump, Math.abs(rate - last)); last = rate; prev = x.facing; }
  assert.ok(jump < TURN.max * DT * TURN.ease + 1e-9, `turning speed jumped ${jump.toFixed(2)} rad/s in a frame`);
  assert.ok(Math.abs(wrap(Math.PI * 0.99 - f[f.length - 1].facing)) < 1e-6);
});

test('with nothing asked the turn eases out rather than stopping dead, and comes to rest', () => {
  let facing = 0, spin = 4;
  const r1 = turnTick(facing, spin, null, 0, DT);
  assert.ok(r1.spin > 0 && r1.spin < 4 && r1.facing > 0);
  for (let i = 0; i < 60; i++) ({ facing, spin } = turnTick(facing, spin, null, 0, DT));
  assert.ok(Math.abs(spin) < 0.01);
  assert.ok(facing < 0.5, `coasted ${facing.toFixed(2)} rad`);
});

// The standing feet: rest under the body 0.1 m to each side.
const REST = [[0.1, 0, 0], [-0.1, 0, 0]];
const body = (facing, x = 0, z = 0, spin = 0, vx = 0, vz = 0) => ({ x, z, facing, vx, vz, spin });

test('standing still, the feet stay put: no steps', () => {
  const s = makeStance();
  let steps = 0;
  for (let i = 0; i < 120; i++) { const r = s.tick(DT, body(0), REST, 1); steps += r.feet.filter(f => f.stepping).length; }
  assert.equal(steps, 0);
});

test('turning on the spot the feet step round one at a time, never both off the floor, and end squared up', () => {
  const s = makeStance();
  s.tick(DT, body(0), REST, 1);
  let facing = 0, spin = 0, both = 0, landings = 0, maxTwist = 0;
  const frames = turnFrom(0, Math.PI);
  for (let i = 0; i < 120; i++) {
    const fr = frames[i] || { facing: frames[frames.length - 1].facing, spin: 0 };
    facing = fr.facing; spin = fr.spin;
    const r = s.tick(DT, body(facing, 0, 0, spin), REST, 1);
    if (r.feet[0].stepping && r.feet[1].stepping) both++;
    landings += r.landed.length;
    for (const f of r.feet) if (!f.stepping) maxTwist = Math.max(maxTwist, Math.abs(wrap(facing - f.yaw)));
  }
  assert.equal(both, 0);
  assert.ok(landings >= 3 && landings <= 7, `${landings} steps for a half turn`);
  assert.ok(maxTwist <= STEP.maxTwist + 1e-9, `a planted foot twisted ${maxTwist.toFixed(2)} rad`);
  // Squared up under the body at the end, facing the new way.
  const end = s.feet;
  for (let i = 0; i < 2; i++) {
    const want = { x: REST[i][0] * Math.cos(facing), z: -REST[i][0] * Math.sin(facing) };
    assert.ok(Math.hypot(end[i].x - want.x, end[i].z - want.z) < STEP.settleFar + 1e-9);
    assert.ok(Math.abs(wrap(end[i].yaw - facing)) < STEP.settleTwist + 1e-9);
  }
});

test('a step lifts the foot in an arc and puts it down where the body will be', () => {
  const s = makeStance();
  s.tick(DT, body(0), REST, 1);
  let peak = 0, seen = false;
  for (let i = 0; i < 40; i++) {
    const r = s.tick(DT, body(0.8, 0, 0, 0), REST, 1);
    for (const f of r.feet) if (f.stepping) { seen = true; peak = Math.max(peak, f.lift); }
  }
  assert.ok(seen);
  assert.ok(peak > 0.02 && peak <= STEP.lift + 1e-9, `lift ${peak}`);
});

test('a shuffle: the body moved a little to one side, a foot steps after it', () => {
  const s = makeStance();
  s.tick(DT, body(0), REST, 1);
  let stepped = false;
  for (let i = 0; i < 40; i++) stepped = stepped || s.tick(DT, body(0, 0.2, 0), REST, 1).feet.some(f => f.stepping);
  assert.ok(stepped);
});

test('walking, the feet are the animation\'s: they follow it exactly and never step on their own', () => {
  const s = makeStance();
  for (let i = 0; i < 30; i++) {
    const rest = [[0.1, Math.sin(i / 5) * 0.3, 0], [-0.1, -Math.sin(i / 5) * 0.3, 0]];
    const r = s.tick(DT, body(0, 0, i * 0.03), rest, 0);
    assert.ok(!r.feet[0].stepping && !r.feet[1].stepping);
    assert.ok(Math.abs(r.feet[0].z - (i * 0.03 + rest[0][1])) < 1e-12);
  }
});

test('put somewhere else (a far move in one frame), the feet are put under the body without a step', () => {
  const s = makeStance();
  s.tick(DT, body(0), REST, 1);
  const r = s.tick(DT, body(1.5, 3, 4), REST, 1);
  assert.ok(!r.feet[0].stepping && !r.feet[1].stepping);
  assert.ok(Math.abs(r.feet[0].x - (3 + 0.1 * Math.cos(1.5))) < 1e-12);
});

test('while the standing layer is still fading in, the feet hold where they were put and do not step', () => {
  const s = makeStance();
  s.tick(DT, body(0), REST, 0.5);
  for (let i = 0; i < 30; i++) assert.ok(!s.tick(DT, body(0.9), REST, 0.5).feet.some(f => f.stepping));
});

test('standing on, the idle\'s own sway never sets the feet shuffling once they are squared up', () => {
  const s = makeStance();
  s.tick(DT, body(0), REST, 1);
  let steps = 0;
  for (let i = 0; i < 600; i++) {
    const sway = Math.sin(i / 20) * 0.03;
    const r = s.tick(DT, body(0), [[0.1 + sway, sway, sway], [-0.1 + sway, -sway, -sway]], 1);
    steps += r.landed.length;
  }
  assert.ok(steps <= 2, `${steps} steps in ten seconds of standing`);
});

test('a stop with the feet a little off squares them up once, a moment after', () => {
  const s = makeStance();
  s.tick(DT, body(0), [[0.1, 0.06, 0], [-0.1, -0.06, 0]], 1);
  let first = -1, steps = 0;
  for (let i = 0; i < 120; i++) { const r = s.tick(DT, body(0), REST, 1); if (r.landed.length && first < 0) first = i; steps += r.landed.length; }
  assert.ok(first * DT > STEP.settleAfter, 'not before the body has stood still a moment');
  assert.ok(steps >= 1 && steps <= 2);
});

test('turning either way the feet take turns and swing round the body, so they never cross or touch', () => {
  // Feet side by side, and the idle's own staggered stance: one ahead, one behind.
  for (const rest of [REST, [[0.2, 0.08, 0.2], [-0.16, -0.3, -0.3]]]) for (const want of [Math.PI * 0.99, -Math.PI * 0.99]) {
    const s = makeStance();
    s.tick(DT, body(0), rest, 1);
    let closest = Infinity, last = -1, same = 0;
    const frames = turnFrom(0, want);
    for (let i = 0; i < 120; i++) {
      const fr = frames[i] || { facing: frames[frames.length - 1].facing, spin: 0 };
      const r = s.tick(DT, body(fr.facing, 0, 0, fr.spin), rest, 1);
      if (r.feet[0].stepping || r.feet[1].stepping) closest = Math.min(closest, Math.hypot(r.feet[0].x - r.feet[1].x, r.feet[0].z - r.feet[1].z));
      for (const k of r.landed) { if (k === last) same++; last = k; }
    }
    assert.ok(closest > 0.1, `feet came within ${(closest * 100).toFixed(1)} cm of each other`);
    assert.equal(same, 0, 'the same foot stepped twice running');
  }
});

test('nothing new is made per frame: the turn and the standing feet answer in the same objects every frame', () => {
  const out = {}, a = turnTick(0, 0, 1, 0, DT, TURN, out), b = turnTick(a.facing, a.spin, 1, 0, DT, TURN, out);
  assert.equal(a, out);
  assert.equal(b, out);
  assert.deepEqual({ ...turnTick(0, 0, 1, 0, DT) }, { ...turnTick(0, 0, 1, 0, DT, TURN, {}) });
  const s = makeStance(), first = s.tick(DT, body(0), REST, 1);
  let same = true;
  for (let i = 0; i < 90; i++) { const r = s.tick(DT, body(i * 0.04, 0, 0, 2.4), REST, 1); same = same && r === first && r.feet === first.feet && r.landed === first.landed; }
  assert.ok(same);
});

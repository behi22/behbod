import test from 'node:test';
import assert from 'node:assert/strict';
import { BOLT, BODY, launch, boltAt, reach, strikes } from '../../web/src/pure/bolts.js';
import { newRun, step, fired, hit, parry, quit, result, where, boltWhere, STAND } from '../../web/src/pure/rangegame.js';
import { STAGES, KINDS, DIFFICULTIES, script, place } from '../../web/src/pure/stages.js';

const DT = 1 / 30;
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
// A whole Hard run, so the bolt rules are judged the way a player meets them.
function playHard(stage, seed, { move = (run, eye) => eye, shoot = () => {} } = {}) {
  const run = newRun(stage, 'hard', seed), all = [];
  let eye = STAND, guard = 0;
  while (!run.over && guard++ < 1e5) {
    const ev = step(run, DT, eye);
    all.push(...ev.map(e => ({ ...e, t: run.t })));
    shoot(run, ev);
    eye = move(run, eye);
  }
  return { run, all };
}

test('a bolt flies straight at where the eye was when it left, at its own speed', () => {
  const from = { x: 2, d: 12, h: 2.4 }, eye = { x: -0.5, d: -0.55, h: 1.56 }, b = launch(from, eye);
  assert.ok(near(Math.hypot(b.vx, b.vd, b.vh), BOLT.speed));
  const due = reach(b, eye.d), p = boltAt(b, due);
  assert.ok(near(p.x, eye.x, 1e-9) && near(p.d, eye.d, 1e-9) && near(p.h, eye.h, 1e-9));
  assert.ok(near(due, Math.hypot(2.5, 12.55, 0.84) / BOLT.speed, 1e-9), 'slow: about two seconds from a drone a dozen metres out');
  assert.equal(reach(b, 20), 0, 'already past a depth it started beyond');
  assert.equal(reach({ ...b, vd: 0.5 }, -0.55), Infinity, 'never reaches the line flying away from it');
});

test('a bolt strikes the body it was aimed at; a step aside or a duck takes the body out of its way', () => {
  const eye = { ...STAND }, p = { x: 0, d: STAND.d, h: STAND.h };
  assert.equal(strikes(p, eye), true);
  const wide = BODY.half + BOLT.radius;
  assert.equal(strikes({ ...p, x: wide - 0.01 }, eye), true);
  assert.equal(strikes({ ...p, x: wide + 0.01 }, eye), false, 'stepping a third of a metre is enough');
  assert.equal(strikes(p, { ...eye, h: STAND.h - 0.52 }), false, 'ducked, it goes over the head');
  assert.equal(strikes({ ...p, h: 1.0 }, { ...eye, h: STAND.h - 0.52 }), true, 'one aimed low still finds a ducked player');
  assert.equal(strikes({ ...p, h: -0.5 }, eye), false, 'nothing under the floor');
});

test('only drones fire, only on Hard, each with a warning a second before', () => {
  for (const d of ['easy', 'normal']) for (const st of STAGES) {
    const run = newRun(st.id, d, 4);
    while (!run.over) assert.equal(step(run, DT).filter(e => e.type === 'charge').length, 0, `${st.id} ${d}`);
  }
  assert.equal(KINDS.walker.bolt, undefined); assert.equal(KINDS.plate.bolt, undefined);
  const { all } = playHard('dark', 3, { move: (run, eye) => dodge(run, eye) });
  const charges = all.filter(e => e.type === 'charge'), launches = all.filter(e => e.type === 'launch');
  assert.ok(charges.length >= 8, `${charges.length} warnings`);
  for (const c of charges) {
    const l = launches.find(x => x.bolt === c.bolt);
    if (!l) { assert.ok(all.some(x => x.type === 'fizzle' && x.bolt === c.bolt), 'a warning either ends in a shot or goes out'); continue; }
    assert.ok(Math.abs(l.t - c.t - 1) <= DT + 1e-9, 'the shot leaves a second after the warning');
    assert.equal(l.from, c.id);
  }
  const kinds = new Set(charges.map(c => script('dark', 'hard', 3).find(s => s.id === c.id).kind));
  assert.deepEqual([...kinds], ['drone']);
});

// A player who steps along the line, out of the way of anything already in the air.
function dodge(run, eye) {
  const flying = [...run.bolts.values()].filter(b => b.phase === 'fly');
  for (const dx of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4]) {
    const e = { ...STAND, x: Math.max(-5, Math.min(5, eye.x + dx)) };
    if (flying.every(b => !strikes(boltAt(b, reach(b, e.d)), e))) return e;
  }
  return eye;
}

test('standing still on Hard, the third bolt ends the run with no stars', () => {
  const { run, all } = playHard('swarm', 2);
  const strikes3 = all.filter(e => e.type === 'strike');
  assert.equal(strikes3.length, 3);
  assert.deepEqual(all.filter(e => e.type === 'shield').map(e => e.left), [2, 1, 0]);
  assert.ok(run.over && run.failed);
  const end = all.find(e => e.type === 'end').result;
  assert.equal(end.stars, 0); assert.equal(end.failed, true);
  assert.deepEqual(end.bolts, { launched: run.launched, dodged: 0, parried: 0, taken: 3 });
  assert.equal(run.bolts.size, 0, 'nothing left in the air');
});

// Held to the range's limits (2.6 m/s, no duck as on a phone, 0.3 s to react) so it fails if bolts become unfair.
function stepAside() {
  const me = { x: 0, v: 0, dir: 0 };
  const go = (p, dir) => { p.v += (dir * 2.6 - p.v) * Math.min(1, DT * 10); p.x = Math.max(-5.5, Math.min(5.5, p.x + p.v * DT)); };
  const clear = (run, dir, seen) => {
    const p = { ...me }, left = seen.slice();
    for (let t = run.t; left.length && t < run.t + 12;) {
      go(p, dir); t += DT;
      const e = { ...STAND, x: p.x };
      for (let j = left.length - 1; j >= 0; j--) { const b = left[j], due = reach(b, e.d); if (t - b.t0 >= due) { if (strikes(boltAt(b, due), e)) return false; left.splice(j, 1); } }
    }
    return true;
  };
  return run => {
    const seen = [...run.bolts.values()].filter(b => b.phase === 'fly' && run.t - b.t0 >= 0.3);
    if (!clear(run, me.dir, seen)) me.dir = [0, 1, -1].find(d => clear(run, d, seen)) ?? me.dir;
    else if (me.dir && clear(run, 0, seen)) me.dir = 0;
    go(me, me.dir);
    return { ...STAND, x: me.x };
  };
}

test('a player who steps aside at walking pace, a moment after each bolt leaves, is never struck', () => {
  for (const st of ['swarm', 'dark', 'long']) for (let seed = 1; seed <= 8; seed++) {
    const { run, all } = playHard(st, seed, { move: stepAside() });
    assert.equal(all.filter(e => e.type === 'strike').length, 0, `${st} seed ${seed}`);
    assert.ok(run.launched > 3);
  }
});

test('a player who keeps moving is never struck and keeps all three shields', () => {
  for (const st of ['swarm', 'dark', 'long']) {
    const { run, all } = playHard(st, 5, { move: dodge });
    assert.equal(all.filter(e => e.type === 'strike').length, 0, st);
    assert.equal(run.shields, 3);
    assert.ok(run.launched > 3, `${st}: ${run.launched} bolts`);
    assert.equal(run.dodged + all.filter(e => e.type === 'fizzle' && all.some(l => l.type === 'launch' && l.bolt === e.bolt)).length, run.launched, 'every bolt fired went by (or was in the air at the end)');
  }
});

test('a bolt can be shot down: it is gone, it counts as a hit, it scores nothing', () => {
  let shot = 0;
  const { run, all } = playHard('swarm', 2, {
    shoot: (run) => {
      for (const b of [...run.bolts.values()]) if (b.phase === 'fly' && run.t - b.t0 > 0.5) {
        fired(run); const before = run.score;
        assert.deepEqual(parry(run, b.id), [{ type: 'parry', bolt: b.id }]);
        assert.equal(run.score, before);
        shot++;
      }
    },
  });
  assert.ok(shot > 5);
  assert.equal(all.filter(e => e.type === 'strike').length, 0, 'none got through');
  assert.equal(run.parried, shot); assert.equal(run.hits, shot); assert.equal(run.shots, shot);
  assert.equal(result(run).accuracy, 1);
  const r2 = newRun('swarm', 'hard', 2);
  assert.deepEqual(parry(r2, 1), [], 'no such bolt');
  while (![...r2.bolts.values()].some(b => b.phase === 'charge')) step(r2, DT);
  const glowing = [...r2.bolts.values()][0];
  assert.deepEqual(parry(r2, glowing.id), [], 'one still gathering in the eye cannot be shot');
  quit(r2);
  assert.deepEqual(parry(r2, glowing.id), [], 'nor after the run');
});

test('a drone shot while it glows never fires; one that leaves takes its warning with it', () => {
  const run = newRun('swarm', 'hard', 2);
  let c = null;
  while (!c) c = step(run, DT).find(e => e.type === 'charge');
  const ev = hit(run, c.id, 'eye', 999);
  assert.deepEqual(ev.map(e => e.type), ['kill', 'fizzle']);
  assert.equal(ev[1].bolt, c.bolt);
  assert.equal(run.bolts.size, 0);
  const later = [];
  for (let i = 0; i < 60; i++) later.push(...step(run, DT));
  assert.ok(!later.some(e => e.type === 'launch' && e.from === c.id));
  // A drone that stays 2.5 s would leave before its first shot at 2.7, so it must never glow.
  const r = newRun('swarm', 'hard', 2);
  for (const s of r.queue) if (s.kind === 'drone') s.life = 2.5;
  let glows = 0;
  while (!r.over) glows += step(r, DT, STAND).filter(e => e.type === 'charge').length;
  assert.equal(glows, 0);
});

test('bolts in the air when a run ends go out with it', () => {
  const run = newRun('swarm', 'hard', 2);
  while (![...run.bolts.values()].some(b => b.phase === 'fly')) step(run, DT);
  const up = [...run.bolts.keys()];
  const ev = quit(run);
  for (const id of up) assert.ok(ev.some(e => e.type === 'fizzle' && e.bolt === id));
  assert.equal(run.bolts.size, 0);
  assert.equal(ev.at(-1).type, 'end');
});

test('where a bolt is does not depend on the frame rate', () => {
  const at = dt => {
    const run = newRun('swarm', 'hard', 2), seen = new Map();
    while (run.t < 12 && !run.over) { step(run, dt); for (const b of run.bolts.values()) if (b.phase === 'fly' && !seen.has(b.id)) seen.set(b.id, { x: b.x, d: b.d, h: b.h, t0: b.t0 }); }
    return seen;
  };
  const a = at(1 / 30), b = at(1 / 144);
  assert.ok(a.size > 0 && a.size === b.size);
  for (const [id, p] of a) { const q = b.get(id); assert.ok(near(p.x, q.x, 0.03) && near(p.d, q.d, 0.03) && near(p.h, q.h, 0.03), `bolt ${id}`); }
});

test('a hurt target says how much of its strength is left', () => {
  const run = newRun('walkers', 'normal', 2);
  let g = null;
  while (!g) { step(run, DT); g = [...run.live.values()].find(x => x.kind === 'walker'); }
  const [e] = hit(run, g.id, 'body', 33);
  assert.equal(e.type, 'hurt');
  assert.ok(near(e.left, 1 - 33 / KINDS.walker.hp));
  assert.equal(g.max, KINDS.walker.hp);
  const run2 = newRun('walkers', 'hard', 2);
  let h = null;
  while (!h) { step(run2, DT); h = [...run2.live.values()].find(x => x.kind === 'walker'); }
  assert.equal(h.max, Math.round(KINDS.walker.hp * DIFFICULTIES.hard.hp));
});

test('a bolt in flight is where its record says, and the drone it left from was where the run put it', () => {
  const run = newRun('swarm', 'hard', 2);
  let l = null;
  while (!l) l = step(run, DT).find(e => e.type === 'launch');
  const b = l.flight, g = run.live.get(l.from), from = place(g, b.t0 - g.born);
  assert.ok(near(b.x, from.x) && near(b.d, from.d) && near(b.h, from.h));
  step(run, DT);
  if (run.bolts.has(b.id)) { const p = boltWhere(run, b); assert.ok(p.d < b.d, 'it comes toward the line'); }
  assert.ok(where(run, g));
});

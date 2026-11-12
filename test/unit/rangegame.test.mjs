import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, STAGE, DIFFICULTIES, KINDS, HALL, MAX_STARS, script, place, par, starsFor, starScores, totalStars, openStages, legend, seeded, starsToOwnEverything } from '../../web/src/pure/stages.js';
import { newRun, step, fired, hit, struck, quit, result, where } from '../../web/src/pure/rangegame.js';
import { stats, damageAt } from '../../web/src/pure/arsenal.js';

const DT = 1 / 30;
// Plays a whole stage: `plan(target, age)` returns the zone to shoot the target in once it is `age` seconds old, or
// null to hold fire; `misses` is how many wasted shots go with each one that lands.
function play(stageId, difficulty, plan, { gun = 'pistol', misses = 0, seed = 3 } = {}) {
  const run = newRun(stageId, difficulty, seed), s = stats(gun);
  let guard = 0;
  while (!run.over && guard++ < 1e5) {
    step(run, DT);
    for (const g of [...run.live.values()]) {
      const zone = plan(g, run.t - g.born);
      if (!zone) continue;
      for (let i = 0; i < misses; i++) fired(run);
      fired(run);
      hit(run, g.id, zone, damageAt(s, where(run, g).d));
    }
  }
  return result(run);
}
const weakOf = g => KINDS[g.kind].weak || 'plate';

test('five stages, each with a script for every difficulty that fits inside its clock', () => {
  assert.deepEqual(STAGES.map(s => s.id), ['warmup', 'walkers', 'swarm', 'dark', 'long']);
  assert.equal(MAX_STARS, 15);
  for (const st of STAGES) for (const d of Object.keys(DIFFICULTIES)) {
    const sp = script(st.id, d, 5);
    assert.ok(sp.length >= 12, `${st.id} ${d} has ${sp.length} targets`);
    assert.ok(st.time >= 60 && st.time <= 90, 'about a minute and a half at most');
    for (const s of sp) {
      assert.ok(s.t >= 0 && s.t <= st.time - 2, `${st.id} target at ${s.t}`);
      assert.ok(Object.hasOwn(KINDS, s.kind) && s.hp > 0 && s.points > 0 && s.life > 0);
    }
    assert.deepEqual(sp.map(s => s.id), sp.map((_, i) => i + 1));
    assert.deepEqual(sp.map(s => s.t), sp.map(s => s.t).sort((a, b) => a - b));
  }
  assert.deepEqual(script('nope'), []);
  assert.deepEqual(script('warmup', 'nightmare'), []);
});

test('the same seed gives the same stage, another seed another', () => {
  assert.deepEqual(script('swarm', 'normal', 4), script('swarm', 'normal', 4));
  assert.notDeepEqual(script('swarm', 'normal', 4), script('swarm', 'normal', 5));
  const a = seeded(9), b = seeded(9);
  for (let i = 0; i < 20; i++) { const v = a(); assert.equal(v, b()); assert.ok(v >= 0 && v < 1); }
});

test('the warm-up is plates only; the walkers and drones come later; only the last stage uses the tunnel', () => {
  const kinds = id => new Set(script(id, 'normal', 2).map(s => s.kind));
  assert.deepEqual([...kinds('warmup')], ['plate']);
  assert.ok(kinds('walkers').has('walker') && !kinds('walkers').has('drone'));
  assert.ok(kinds('swarm').has('drone'));
  assert.ok(kinds('dark').has('walker') && kinds('dark').has('drone') && STAGE.dark.dark);
  for (const st of STAGES) {
    const deep = script(st.id, 'normal', 2).filter(s => s.d > HALL.far);
    assert.equal(deep.length > 0, st.id === 'long', st.id);
  }
});

test('every target stays inside the hall (or the tunnel) for its whole life, whatever the seed', () => {
  for (let seed = 1; seed <= 40; seed++) for (const st of STAGES) for (const d of ['easy', 'normal', 'hard']) for (const s of script(st.id, d, seed)) {
    for (let age = 0; age <= s.life; age += 0.25) {
      const q = place(s, age), half = s.kind === 'walker' ? HALL.half + 0.9 : q.d > HALL.far ? HALL.tunnelHalf : HALL.half;
      assert.ok(Math.abs(q.x) <= half + 1e-6, `${st.id} ${s.kind} ${s.id} at x ${q.x.toFixed(2)}`);
      assert.ok(q.d >= 5 && q.d <= HALL.tunnel[1] && q.h >= 0 && q.h <= 4, `${st.id} ${s.kind} at d ${q.d.toFixed(1)} h ${q.h.toFixed(2)}`);
    }
  }
});

test('a walker crosses from one side to the other; a sliding plate turns back at the walls', () => {
  const w = script('walkers', 'normal', 2).find(s => s.kind === 'walker');
  const a = place(w, 0), b = place(w, w.life);
  assert.ok(Math.sign(a.x) === -Math.sign(b.x) && Math.abs(Math.abs(b.x) - Math.abs(a.x)) < 0.05);
  assert.equal(a.heading, Math.sign(w.x1 - w.x));
  const p = { kind: 'plate', x: 4.8, d: 12, h: 1.4, slide: 1.5, life: 30 };
  let turned = false, last = place(p, 0).x;
  for (let age = 0.1; age < 20; age += 0.1) { const x = place(p, age).x; if (x < last) turned = true; last = x; assert.ok(Math.abs(x) <= HALL.half - 0.3 + 1e-9); }
  assert.ok(turned);
});

test('harder is faster, shorter-lived and tougher; easy is the other way', () => {
  const life = d => script('warmup', d, 2)[0].life, hp = d => script('walkers', d, 2).find(s => s.kind === 'walker').hp;
  assert.ok(life('easy') > life('normal') && life('normal') > life('hard'));
  assert.ok(hp('easy') < hp('normal') && hp('normal') < hp('hard'));
});

test('stars: none below the first mark, three for beating the plain total by a tenth', () => {
  assert.deepEqual(starScores(1000), [400, 750, 1100]);
  assert.equal(starsFor(399, 1000), 0); assert.equal(starsFor(400, 1000), 1);
  assert.equal(starsFor(750, 1000), 2); assert.equal(starsFor(1099, 1000), 2); assert.equal(starsFor(1100, 1000), 3);
  assert.equal(starsFor(500, 0), 0);
});

test('a run hands out its targets on time and ends when the clock runs out', () => {
  const run = newRun('warmup', 'normal', 2);
  assert.equal(run.live.size, 0);
  let spawned = 0, ended = null;
  for (let i = 0; i < 61 * 30 && !run.over; i++) for (const e of step(run, DT)) { if (e.type === 'spawn') spawned++; if (e.type === 'end') ended = e.result; }
  assert.equal(spawned, run.total);
  assert.ok(run.over && ended);
  assert.equal(ended.score, 0); assert.equal(ended.stars, 0); assert.equal(ended.kills, 0);
  assert.equal(ended.escaped, run.total, 'nobody shot anything, so every target got away, the ones still up at the end too');
  assert.equal(ended.cleared, false, 'targets that got away do not count as a cleared stage');
  assert.deepEqual(step(run, DT), [], 'nothing more happens after the end');
});

test('a kill scores, a streak of kills scores more, and an escape breaks the streak', () => {
  const run = newRun('warmup', 'normal', 2);
  const kills = [];
  let brokeAt = -1;
  while (!run.over) {
    const ev = step(run, DT);
    if (ev.some(e => e.type === 'escape') && brokeAt < 0) brokeAt = kills.length;
    for (const g of [...run.live.values()]) {
      // Lets the fourth target go, shoots the rest as soon as they are up.
      if (g.id === 4) continue;
      fired(run);
      kills.push(...hit(run, g.id, 'plate', 34));
    }
  }
  assert.equal(kills[0].points, 100);
  assert.ok(kills[1].points > kills[0].points && kills[2].points > kills[1].points, 'the streak pays');
  assert.equal(kills[2].streak, 3);
  assert.equal(kills[brokeAt].streak, 1, 'the escape reset it');
  assert.equal(kills[brokeAt].points, 100);
  assert.ok(Math.max(...kills.map(k => k.points)) <= 150, 'a streak tops out at half as much again');
});

test('weak spots hurt more and pay a bonus; unknown zones and dead targets do nothing', () => {
  const run = newRun('walkers', 'normal', 2);
  let walker = null;
  while (!walker) { step(run, DT); walker = [...run.live.values()].find(g => g.kind === 'walker'); }
  assert.deepEqual(hit(run, walker.id, 'wing', 50), []);
  for (const odd of ['constructor', '__proto__', 'toString']) assert.deepEqual(hit(run, walker.id, odd, 50), [], odd);
  assert.equal(run.live.get(walker.id).hp, 110, 'an odd zone name does no harm');
  assert.deepEqual(hit(run, 9999, 'core', 50), []);
  assert.deepEqual(hit(run, walker.id, 'core', 0), []);
  const hurt = hit(run, walker.id, 'limb', 34);
  assert.equal(hurt[0].type, 'hurt'); assert.equal(hurt[0].weak, false);
  assert.ok(Math.abs(walker.hp - (110 - 34 * 0.6)) < 1e-9);
  const kill = hit(run, walker.id, 'core', 34 * 2);
  assert.equal(kill[0].type, 'kill'); assert.equal(kill[0].weak, true);
  assert.equal(kill[0].points, 400, '300 and the weak-spot bonus');
  assert.deepEqual(hit(run, walker.id, 'core', 34), [], 'it is gone');
});

test('accuracy counts shots that hit something, once each', () => {
  const run = newRun('warmup', 'normal', 2);
  while (run.live.size < 1) step(run, DT);
  const [g] = run.live.values();
  fired(run); fired(run); fired(run); fired(run);
  hit(run, g.id, 'plate', 34);
  assert.equal(result(run).accuracy, 0.25);
  // One shot through two targets is still one shot that hit.
  while (run.live.size < 2) step(run, DT);
  const [a, b] = run.live.values();
  fired(run);
  hit(run, a.id, 'plate', 34); hit(run, b.id, 'plate', 34, false);
  assert.equal(run.hits, 2); assert.equal(run.shots, 5);
});

test('on Hard things shoot back: three hits end the run with no stars; Easy and Normal never shoot', () => {
  const bolts = d => { const run = newRun('swarm', d, 2); let n = 0; while (!run.over) n += step(run, DT).filter(e => e.type === 'bolt').length; return n; };
  assert.equal(bolts('easy'), 0); assert.equal(bolts('normal'), 0);
  assert.ok(bolts('hard') >= 10);
  const run = newRun('swarm', 'hard', 2);
  step(run, 5);
  assert.deepEqual(struck(run), [{ type: 'shield', left: 2 }]);
  struck(run);
  const last = struck(run);
  // The targets still up are cleared away between the last shield going and the end.
  assert.equal(last[0].type, 'shield'); assert.equal(last.at(-1).type, 'end');
  assert.ok(last.slice(1, -1).every(e => e.type === 'escape'));
  assert.ok(run.over && run.failed);
  assert.equal(last.at(-1).result.stars, 0); assert.equal(last.at(-1).result.failed, true);
  assert.deepEqual(struck(run), []);
});

test('leaving early ends the run with what it has; leaving a finished run changes nothing', () => {
  const run = newRun('warmup', 'normal', 2);
  while (run.live.size < 1 || run.t < 10) step(run, DT);
  const up = run.live.size, gone = run.escaped, appeared = run.total - run.queue.length;
  const ev = quit(run);
  assert.equal(ev.at(-1).type, 'end');
  assert.ok(run.over && !run.cleared);
  assert.ok(up > 0);
  assert.equal(ev.at(-1).result.escaped, gone + up, 'the targets still up when it ended got away too');
  assert.equal(ev.at(-1).result.kills + ev.at(-1).result.escaped, appeared);
  const done = newRun('warmup', 'normal', 2);
  while (!done.over) { step(done, DT); for (const g of [...done.live.values()]) { fired(done); hit(done, g.id, 'plate', 34); } }
  assert.equal(done.cleared, true);
  assert.deepEqual(quit(done), []);
  assert.equal(done.cleared, true);
});

test('a cleared stage: every kill counted, the seconds saved and a steady hand both pay', () => {
  const run = newRun('warmup', 'normal', 2);
  let points = 0, ended = null;
  while (!run.over) {
    for (const e of step(run, DT)) if (e.type === 'end') ended = e.result;
    for (const g of [...run.live.values()]) { fired(run); for (const e of hit(run, g.id, 'plate', 34)) points += e.points; }
  }
  assert.equal(ended.cleared, true); assert.equal(ended.failed, false);
  assert.equal(ended.kills, run.total); assert.equal(ended.escaped, 0); assert.equal(ended.accuracy, 1);
  const saved = Math.round((run.time - run.t) * 10), steady = Math.round(0.15 * run.par);
  assert.ok(saved > 0, 'it ended before the clock');
  assert.equal(ended.score, points + saved + steady);
  // The same kills with two wasted shots for each one that lands: a third of the steady-hand bonus.
  const loose = newRun('warmup', 'normal', 2);
  let end2 = null;
  while (!loose.over) {
    for (const e of step(loose, DT)) if (e.type === 'end') end2 = e.result;
    for (const g of [...loose.live.values()]) { fired(loose); fired(loose); fired(loose); hit(loose, g.id, 'plate', 34); }
  }
  assert.ok(Math.abs(end2.accuracy - 1 / 3) < 1e-9);
  assert.equal(ended.score - end2.score, steady - Math.round(0.15 * run.par / 3));
});

test('being hit breaks the streak', () => {
  const run = newRun('swarm', 'hard', 2);
  const kills = [];
  while (kills.length < 3 && !run.over) {
    step(run, DT);
    for (const g of [...run.live.values()]) {
      if (kills.length === 2 && !run.struckOnce) { struck(run); run.struckOnce = true; }
      fired(run);
      kills.push(...hit(run, g.id, g.kind === 'plate' ? 'plate' : 'body', 999).filter(e => e.type === 'kill'));
      if (kills.length >= 3) break;
    }
  }
  assert.equal(kills[1].streak, 2);
  assert.equal(kills[2].streak, 1, 'the hit reset it');
});

test('every stage on every difficulty: a sharp run earns three stars, half the targets earns one or two, doing nothing earns none', () => {
  for (const st of STAGES) for (const d of Object.keys(DIFFICULTIES)) {
    const sharp = play(st.id, d, (g, age) => (age >= 0.7 ? weakOf(g) : null), { gun: st.id === 'long' ? 'sniper' : 'rifle' });
    assert.equal(sharp.stars, 3, `${st.id} ${d} sharp: ${sharp.score}`);
    const half = play(st.id, d, (g, age) => (g.id % 2 && age >= 1.2 ? (g.kind === 'plate' ? 'plate' : 'body') : null), { gun: st.id === 'long' ? 'sniper' : 'rifle', misses: 1 });
    assert.ok(half.stars >= 1 && half.stars <= 2, `${st.id} ${d} half: ${half.stars} stars, ${half.score}`);
    assert.equal(play(st.id, d, () => null).stars, 0);
  }
});

test('the pistol alone can earn at least one star on the first two stages (the way to the second gun)', () => {
  for (const id of ['warmup', 'walkers']) {
    const r = play(id, 'normal', (g, age) => (age >= 1.0 ? (g.kind === 'plate' ? 'plate' : 'body') : null), { gun: 'pistol', misses: 1 });
    assert.ok(r.stars >= 1, `${id}: ${r.stars} stars with ${r.score}`);
  }
});

test('stars add up across stages by the best of any difficulty, and open the next stage', () => {
  assert.equal(totalStars({}), 0); assert.equal(totalStars(undefined), 0);
  assert.equal(totalStars({ warmup: { easy: 3, normal: 1 }, walkers: { hard: 2 }, junk: { normal: 3 } }), 5);
  assert.equal(totalStars({ warmup: { normal: 9 } }), 3, 'never more than three a stage');
  assert.deepEqual(openStages({}), ['warmup']);
  assert.deepEqual(openStages({ warmup: { easy: 1 } }), ['warmup', 'walkers']);
  assert.deepEqual(openStages({ warmup: { easy: 1 }, swarm: { normal: 3 } }), ['warmup', 'walkers'], 'no skipping ahead');
  assert.equal(legend({}), false);
  assert.equal(legend(Object.fromEntries(STAGES.map(s => [s.id, { hard: 3 }]))), true);
  assert.equal(legend(Object.fromEntries(STAGES.map(s => [s.id, { normal: 3, hard: 2 }]))), false);
  assert.ok(starsToOwnEverything <= MAX_STARS - 3, 'every gun can be owned without a perfect record');
});

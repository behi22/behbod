import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURT, LEVELS, newDuel, step, crossing } from '../../web/src/pure/paddle.js';

const seeded = (a = 7) => () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
// Plays a duel with `you(d)` choosing where my paddle goes each frame; returns the duel and every event.
function play(level, you, seconds = 120, dt = 1 / 60) {
  const d = newDuel(level), rng = seeded(11), all = [];
  for (let t = 0; t < seconds && !d.over; t += dt) all.push(...step(d, dt, you(d), rng));
  return { d, all };
}

test('a duel starts level, waits a moment, then serves toward me', () => {
  const d = newDuel('normal');
  assert.deepEqual(d.score, { you: 0, ai: 0 });
  assert.equal(step(d, 0.5).length, 0, 'not yet');
  const ev = step(d, 0.5, {}, seeded());
  assert.deepEqual(ev.map(e => e.type), ['serve']);
  assert.ok(d.ball.vy > 0, 'the first ball comes down to me');
  assert.ok(Math.abs(Math.hypot(d.ball.vx, d.ball.vy) - LEVELS.normal.ball) < 1e-6);
  assert.equal(newDuel('nope').level, 'normal');
});

test('standing still loses five nil; following the ball keeps a rally going', () => {
  const still = play('easy', () => ({}));
  assert.equal(still.d.over, true);
  assert.deepEqual(still.d.score, { you: 0, ai: 5 }) ;
  assert.equal(still.d.winner, 'ai');
  assert.equal(still.all.filter(e => e.type === 'point').length, 5);
  assert.equal(still.all.at(-1).type, 'win');
  const good = play('easy', d => ({ to: crossing(d.ball, COURT.h - COURT.edge - COURT.thick) }));
  assert.ok(good.d.best >= 6, `a rally of ${good.d.best}`);
  assert.ok(good.d.score.you > good.d.score.ai, 'a perfect return beats Easy');
});

test('a perfect player beats Easy and Normal; Hard holds out longer than Easy', () => {
  const perfect = d => ({ to: crossing(d.ball, COURT.h - COURT.edge - COURT.thick) + 30 });
  const hits = {};
  for (const level of ['easy', 'normal', 'hard']) { const r = play(level, perfect, 400); hits[level] = r.d.hits / Math.max(1, r.d.score.you + r.d.score.ai); if (level !== 'hard') assert.equal(r.d.winner, 'you', level); }
  assert.ok(hits.hard > hits.easy, `Hard's rallies run longer: ${hits.easy.toFixed(1)} against ${hits.hard.toFixed(1)}`);
});

test('the ball never leaves the side walls or passes through a paddle that is under it', () => {
  for (const level of Object.keys(LEVELS)) for (const dt of [1 / 144, 1 / 60, 1 / 20]) {
    const d = newDuel(level), rng = seeded(3);
    let hitsYou = 0;
    for (let t = 0; t < 60 && !d.over; t += dt) {
      // My paddle is always exactly under the ball: nothing may get past it.
      for (const e of step(d, dt, { to: d.ball.x }, rng)) if (e.type === 'hit' && e.by === 'you') hitsYou++;
      assert.ok(d.ball.x >= COURT.ball - 1e-6 && d.ball.x <= COURT.w - COURT.ball + 1e-6, 'inside the walls');
      assert.equal(d.score.ai, 0, `${level} at ${Math.round(1 / dt)} fps: the ball went through my paddle`);
      assert.ok(Math.hypot(d.ball.vx, d.ball.vy) <= LEVELS[level].top + 1e-6, 'never over its top speed');
    }
    assert.ok(hitsYou > 5);
  }
});

test('the keys move the paddle and the walls stop it; a finished duel stays finished', () => {
  const d = newDuel('normal');
  for (let i = 0; i < 300; i++) step(d, 1 / 60, { left: true }, seeded());
  assert.equal(d.you, COURT.paddle / 2);
  for (let i = 0; i < 20; i++) step(d, 1 / 60, { right: true }, seeded());
  assert.ok(d.you > COURT.paddle / 2 + 100);
  const over = play('hard', () => ({})).d;
  const before = JSON.stringify(over);
  assert.deepEqual(step(over, 1, { right: true }), []);
  assert.equal(JSON.stringify(over), before);
  assert.deepEqual(step(newDuel(), 0), []);
  assert.deepEqual(step(newDuel(), NaN), []);
});

test('where the ball will arrive is worked out off the walls', () => {
  assert.equal(crossing({ x: 100, y: 200, vx: 0, vy: 100 }, 400), 100);
  assert.equal(crossing({ x: 100, y: 200, vx: 100, vy: 100 }, 300), 200);
  const far = crossing({ x: COURT.w - 20, y: 0, vx: 300, vy: 100 }, 100);
  assert.ok(far > COURT.ball && far < COURT.w - COURT.ball, 'folded back inside');
  assert.equal(crossing({ x: 55, y: 200, vx: 50, vy: -100 }, 400), 55, 'a ball going the other way is where it is');
});

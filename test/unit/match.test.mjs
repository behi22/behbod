import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, stepMatch, restart, shoot, kick, LEN, WID, GOAL } from '../../web/src/pure/match.js';

const seeded = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const team = (m, t) => m.players.filter(p => p.team === t);

test('kickoff: five a side with a keeper each, the ball on the spot with the kicking side', () => {
  const m = newMatch({ kickoff: 1 });
  assert.equal(m.players.length, 10);
  for (const t of [0, 1]) {
    assert.equal(team(m, t).length, 5);
    assert.equal(team(m, t).filter(p => p.role === 'keeper').length, 1);
  }
  assert.equal(m.ball.owner.team, 1);
  assert.ok(Math.hypot(m.ball.x, m.ball.y) < 1e-9);
});

test('a long match has goals, and the ball and the players never leave the pitch or go wrong', () => {
  const m = newMatch(), rand = seeded(5);
  let goals = 0;
  for (let i = 0; i < 30 * 60 * 20; i++) {
    for (const e of stepMatch(m, 1 / 30, rand)) if (e.goal !== undefined) goals++;
    const b = m.ball;
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), 'the ball stays a number');
    assert.ok(Math.abs(b.y) <= WID + 0.5 && Math.abs(b.x) <= LEN + 1, `ball at ${b.x.toFixed(2)}, ${b.y.toFixed(2)}`);
    for (const p of m.players) assert.ok(Math.abs(p.x) <= LEN && Math.abs(p.y) <= WID);
  }
  assert.equal(goals, m.score[0] + m.score[1]);
  assert.ok(goals >= 3, `${goals} goals in twenty minutes`);
  assert.ok(goals < 80, `${goals} goals is not football`);
});

test('after a goal the play stops, then the side that conceded kicks off', () => {
  const m = newMatch(), rand = seeded(9);
  const striker = m.players.find(p => p.team === 0 && p.num === 22);
  Object.assign(m.ball, { owner: null, x: LEN - 0.2, y: 0, vx: 20, vy: 0, shot: 0, last: striker });
  for (const k of m.players.filter(p => p.role === 'keeper')) k.y = WID - 1;
  const ev = stepMatch(m, 1 / 30, rand);
  assert.ok(ev.some(e => e.goal === 0));
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(m.phase, 'goal');
  let steps = 0;
  while (m.phase === 'goal' && steps < 200) { stepMatch(m, 1 / 30, rand); steps++; }
  assert.ok(steps >= 70 && steps <= 80, `about two and a half seconds (${steps} steps)`);
  assert.equal(m.phase, 'play');
  assert.equal(m.ball.owner.team, 1);
});

test('a shot straight at the keeper is saved', () => {
  const m = newMatch(), rand = () => 0.5;
  const keeper = m.players.find(p => p.team === 1 && p.role === 'keeper'), striker = m.players.find(p => p.team === 0 && p.num === 22);
  m.ball.x = LEN - 6; m.ball.y = 0;
  kick(m, striker, LEN, keeper.y, 17, true);
  let saved = false;
  for (let i = 0; i < 30 && !saved; i++) saved = stepMatch(m, 1 / 60, rand).includes('bot-save');
  assert.ok(saved);
  assert.equal(m.ball.owner, keeper);
});

test('playing as the striker: you run where you steer and can shoot when you have the ball', () => {
  const m = newMatch(), rand = seeded(2);
  const you = m.players.find(p => p.team === 0 && p.num === 22);
  const x0 = you.x;
  stepMatch(m, 0.5, rand, { player: you, dx: 1, dy: 0 });
  assert.ok(you.x > x0 + 2);
  restart(m, 0);
  you.x = LEN - 6; you.y = 0; m.ball.owner = you;
  const ev = stepMatch(m, 1 / 30, rand, { player: you, dx: 0, dy: 0, shoot: true });
  assert.ok(ev.includes('shot'));
  assert.ok(m.ball.vx > 10, 'the ball heads for their goal');
});

test('playing as the keeper: you stay in your area, and a dive reaches shots a standing keeper cannot', () => {
  const run = dive => {
    const m = newMatch(), you = m.players.find(p => p.team === 0 && p.role === 'keeper');
    you.x = -LEN * 0.94; you.y = 0;
    const them = m.players.find(p => p.team === 1 && p.num === 9);
    m.ball.x = -LEN + 6; m.ball.y = 1.3;
    kick(m, them, -LEN, 1.3, 17, true);
    let out = [];
    for (let i = 0; i < 24; i++) out = out.concat(stepMatch(m, 1 / 60, () => 0.5, { player: you, dx: 0, dy: 0, dive: dive && i === 0 }));
    return out;
  };
  assert.ok(!run(false).includes('save'), 'standing still, the shot beats you');
  assert.ok(run(true).includes('save'), 'diving, you reach it');
  const m = newMatch(), you = m.players.find(p => p.team === 0 && p.role === 'keeper');
  for (let i = 0; i < 120; i++) stepMatch(m, 1 / 30, seeded(3), { player: you, dx: 1, dy: 1 });
  assert.ok(you.x <= -LEN * 0.82 + 1e-9 && Math.abs(you.y) <= GOAL + 1.5 + 1e-9);
});

test('a ball over the touchline goes back in with the other side', () => {
  const m = newMatch(), rand = seeded(4);
  const p = m.players.find(q => q.team === 0 && q.num === 10);
  Object.assign(m.ball, { owner: null, x: 3, y: WID - 0.1, vx: 0, vy: 8, shot: null, last: p });
  stepMatch(m, 1 / 30, rand);
  assert.equal(m.ball.owner.team, 1);
  assert.ok(Math.abs(m.ball.y) < WID);
});

test('a shot at the middle crosses the line inside the posts, and one aimed far wide is held near the goal', () => {
  const m = newMatch(), p = m.players.find(q => q.team === 0 && q.num === 22), rand = seeded(8);
  const crossing = aim => { m.ball.x = 10; m.ball.y = 0; shoot(m, p, aim, rand); assert.ok(m.ball.vx > 0); return m.ball.vy * (LEN - 10) / m.ball.vx; };
  for (let i = 0; i < 50; i++) assert.ok(Math.abs(crossing(0)) < GOAL, 'inside the posts');
  for (let i = 0; i < 50; i++) { const y = crossing(40); assert.ok(y > GOAL * 0.8 && y <= GOAL * 1.4 + 1e-9, `wide but near: ${y.toFixed(2)}`); }
});

test('nobody can tackle a keeper holding the ball, and the keeper throws it out to a teammate', () => {
  const m = newMatch(), k = m.players.find(p => p.team === 0 && p.role === 'keeper');
  const rival = m.players.find(p => p.team === 1 && p.num === 9);
  Object.assign(m.ball, { owner: k, vx: 0, vy: 0, shot: null });
  let thrown = null;
  for (let i = 0; i < 60 && !thrown; i++) {
    rival.x = k.x + 0.3; rival.y = k.y; rival.cool = 0;
    const ev = stepMatch(m, 1 / 30, () => 0);
    assert.ok(!ev.includes('tackle'), 'tackled in hand');
    if (ev.includes('pass')) { thrown = i / 30; break; }
    assert.equal(m.ball.owner, k, 'still in hand');
  }
  assert.ok(thrown !== null && thrown >= 0.8, `thrown out after ${thrown}s`);
});

test('as keeper, standing still does not win: the bots score past a keeper who never moves', () => {
  for (const seed of [1, 2, 3, 4]) {
    const m = newMatch({ kickoff: 1 }), rand = seeded(seed);
    m.aggro = [0.6, 1.5];
    const you = m.players.find(p => p.team === 0 && p.role === 'keeper');
    let saves = 0, conceded = 0;
    for (let t = 0; t < 90 * 60; t++) for (const e of stepMatch(m, 1 / 60, rand, { player: you, dx: 0, dy: 0 })) { if (e === 'save') saves++; if (e.goal === 1) conceded++; }
    assert.ok(!(saves >= 3 && conceded <= 1), `seed ${seed}: ${saves} saved, ${conceded} let in`);
  }
});

test('as keeper, holding the ball too long throws it out by itself', () => {
  const m = newMatch(), rand = seeded(2), you = m.players.find(p => p.team === 0 && p.role === 'keeper');
  for (const p of m.players.filter(q => q.team === 1)) { p.hx = p.x = LEN - 2; p.hy = p.y = 0; }
  Object.assign(m.ball, { owner: you, vx: 0, vy: 0, shot: null });
  let thrown = null;
  for (let i = 0; i < 180 && thrown === null; i++) if (stepMatch(m, 1 / 60, rand, { player: you, dx: 0, dy: 0 }).includes('pass')) thrown = i / 60;
  assert.ok(thrown !== null && thrown > 1.4 && thrown < 1.7, `thrown after ${thrown}s`);
});

test('a goal walked in counts for whoever carried it, not whoever kicked it last', () => {
  const m = newMatch(), rand = seeded(3);
  const you = m.players.find(p => p.team === 0 && p.num === 22), mate = m.players.find(p => p.team === 0 && p.num === 10);
  for (const k of m.players.filter(p => p.role === 'keeper')) k.y = WID - 1;
  for (const p of m.players.filter(p => p.team === 1 && p.role !== 'keeper')) { p.hx = p.x = -LEN + 2; p.hy = p.y = 0; }
  Object.assign(m.ball, { owner: you, last: mate });
  you.x = LEN - 1.2; you.y = 0;
  let goal = null;
  for (let i = 0; i < 120 && !goal; i++) for (const e of stepMatch(m, 1 / 60, rand, { player: you, dx: 1, dy: 0 })) if (e.goal !== undefined) goal = e;
  assert.ok(goal, 'scored');
  assert.equal(goal.by, you);
});

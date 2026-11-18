import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDeskGames } from '../../web/src/deskgames.js';
import { COURT } from '../../web/src/pure/paddle.js';
import { FIELD } from '../../web/src/pure/bughunt.js';

const memory = (start = {}) => { const m = { ...start }; return { m, get: k => (k in m ? m[k] : null), set: (k, v) => { m[k] = v; } }; };
// A 2D context that only remembers what was asked of it.
function fakeContext() {
  const calls = [];
  const grad = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      return (...a) => { calls.push([k, ...a]); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const sounds = () => { const heard = []; return { heard, sfx: { click: () => heard.push('click'), blip: () => heard.push('blip'), miss: () => heard.push('miss'), hit: () => heard.push('hit') } }; };

test('best scores come back from the browser, bad ones are ignored, and only a new best is saved', () => {
  const store = memory({ 'home.games': '{"orbit":40,"bughunt":"lots","paddle":-2}' });
  const G = makeDeskGames({ store });
  assert.equal(G.best('orbit'), 40);
  assert.equal(G.best('bughunt'), 0);
  assert.equal(G.best('paddle'), 0);
  assert.deepEqual(G.bests, { orbit: 40 });
  assert.deepEqual(makeDeskGames({ store: memory({ 'home.games': '{oops' }) }).bests, {});
  assert.deepEqual(makeDeskGames().bests, {}, 'no storage at all');
  // Storage that refuses both ways (a private window, blocked site data): the games still run and remember the
  // best for this visit.
  let tried = 0;
  const broken = { get: () => { tried++; throw new Error('blocked'); }, set: () => { tried++; throw new Error('blocked'); } };
  const B = makeDeskGames({ store: broken });
  B.start('bughunt');
  B.playing.st.score = 30;
  for (let i = 0; i < 60 * 50 && !B.playing.done; i++) B.tick(1 / 60);
  assert.equal(B.playing.record, true);
  assert.equal(B.best('bughunt'), 30);
  assert.equal(tried, 2, 'it did try to read and to save');
});

// Regression: Paddle Duel saved its best before the end of the game said whether it was one, so the end of a record
// duel said "Best: 9" instead of "A new best.".
test('winning a duel with your longest rally yet is told as a new best, once', () => {
  const store = memory(), events = [], G = makeDeskGames({ store, onEvent: (n, d) => events.push([n, d]) });
  G.start('paddle', 'hard');
  const st = G.playing.st;
  Object.assign(st, { wait: 0, ai: COURT.w - 60, rally: 9, best: 9, score: { you: 4, ai: 2 } });
  Object.assign(st.ball, { x: 30, y: 60, vx: 0, vy: -400 });
  for (let i = 0; i < 30 && !G.playing.done; i++) G.tick(1 / 60);
  assert.equal(G.playing.done, true);
  assert.equal(G.playing.note, 'You win');
  assert.equal(G.playing.record, true, 'told as a new best');
  assert.equal(G.best('paddle'), 9);
  assert.equal(JSON.parse(store.m['home.games']).paddle, 9);
  assert.deepEqual(events.map(e => e[0]), ['over', 'duel']);
  assert.equal(events[0][1].record, true);
  // The same again is not a new best.
  G.again();
  Object.assign(G.playing.st, { wait: 0, ai: COURT.w - 60, rally: 9, best: 9, score: { you: 4, ai: 0 } });
  Object.assign(G.playing.st.ball, { x: 30, y: 60, vx: 0, vy: -400 });
  for (let i = 0; i < 30 && !G.playing.done; i++) G.tick(1 / 60);
  assert.equal(G.playing.record, false);
  assert.equal(G.playing.level, 'hard', 'again keeps the level');
});

test('starting, stopping, pausing: only real games, a known level, and a finished game stays finished', () => {
  const G = makeDeskGames();
  assert.equal(G.start('nope'), false);
  assert.equal(G.start('__proto__'), false);
  assert.equal(G.playing, null);
  assert.equal(G.again(), false, 'nothing to play again');
  assert.equal(G.start('paddle', 'impossible'), true);
  assert.equal(G.playing.level, 'normal');
  assert.equal(G.pause(), true);
  assert.equal(G.playing.paused, true);
  assert.equal(G.pause(true), false, 'already paused');
  const t = G.playing.t;
  G.tick(0.5);
  assert.equal(G.playing.t, t, 'a paused game does not move');
  assert.equal(G.pause(false), true);
  G.tick(0.5);
  assert.ok(G.playing.t > t && G.playing.t <= t + 0.05 + 1e-9, 'a long frame counts as a short one');
  G.tick(NaN); G.tick(-1);
  G.start('orbit');
  for (let i = 0; i < 400 && !G.playing.done; i++) G.tick(1 / 30);
  assert.equal(G.playing.done, true, 'left alone, the ship falls');
  assert.equal(G.playing.note, 'Burned up');
  assert.equal(G.pause(true), false, 'a finished game is not paused');
  G.stop();
  assert.equal(G.playing, null);
});

test('keys: arrows steer, Space climbs, P pauses once per press, and nothing is taken with no game on', () => {
  const G = makeDeskGames();
  assert.equal(G.key('ArrowLeft', true), false, 'no game, no keys');
  G.start('paddle');
  const x0 = G.playing.st.you;
  assert.equal(G.key('ArrowLeft', true), true);
  for (let i = 0; i < 20; i++) G.tick(1 / 60);
  assert.ok(G.playing.st.you < x0 - 50, 'held left moves left');
  G.key('ArrowLeft', false);
  const x1 = G.playing.st.you;
  for (let i = 0; i < 10; i++) G.tick(1 / 60);
  assert.equal(G.playing.st.you, x1, 'let go, it stays');
  assert.equal(G.key('KeyP', true), true);
  assert.equal(G.playing.paused, true);
  assert.equal(G.key('KeyP', true, true), true, 'a held P is still the game\'s key');
  assert.equal(G.playing.paused, true, 'but its repeats do not flip it back');
  G.key('KeyP', false);
  G.key('KeyP', true);
  assert.equal(G.playing.paused, false);
  assert.equal(G.key('KeyQ', true), false);
  G.start('orbit');
  const r0 = G.playing.st.r;
  G.key('Space', true);
  for (let i = 0; i < 30; i++) G.tick(1 / 60);
  assert.ok(G.playing.st.r > r0, 'holding Space climbs');
  G.release();
  const r1 = G.playing.st.r, v1 = G.playing.st.vr;
  for (let i = 0; i < 60; i++) G.tick(1 / 60);
  assert.ok(G.playing.st.vr < v1, 'let go (the window lost focus), it sinks');
  assert.ok(G.playing.st.r < r1 + 40);
});

test('the pointer: the paddle follows it, a press holds the ship up, a click squashes the bug under it', () => {
  const { heard, sfx } = sounds(), G = makeDeskGames({ sfx });
  G.start('paddle');
  G.point(150, 300, 'move');
  for (let i = 0; i < 60; i++) G.tick(1 / 60);
  assert.ok(Math.abs(G.playing.st.you - 150) < 1, 'the paddle goes to the pointer');
  G.point(150, 300, 'leave');
  G.key('ArrowRight', true);
  for (let i = 0; i < 10; i++) G.tick(1 / 60);
  assert.ok(G.playing.st.you > 160, 'after the mouse leaves, the keys steer');
  G.point(NaN, 5, 'move'); G.point(5, Infinity, 'down');
  assert.ok(Number.isFinite(G.playing.st.you));
  G.start('orbit');
  G.point(10, 10, 'down');
  for (let i = 0; i < 20; i++) G.tick(1 / 60);
  assert.ok(G.playing.st.vr > 0, 'held down, it climbs');
  G.point(10, 10, 'up');
  G.start('bughunt');
  G.playing.st.bugs.push({ id: 99, kind: 'bug', x: 200, y: 150, vx: 0, vy: 0, born: 0, turn: 9 }, { id: 98, kind: 'friend', x: 500, y: 300, vx: 0, vy: 0, born: 0, turn: 9 });
  G.point(203, 152, 'down'); G.point(203, 152, 'up');
  assert.equal(G.playing.st.squashed, 1);
  assert.equal(G.playing.st.score, 10);
  G.pause(true);
  G.point(500, 300, 'down');
  assert.equal(G.playing.st.t, 0, 'no swatting while paused');
  G.pause(false);
  G.point(500, 300, 'down');
  assert.equal(G.playing.st.t, 5, 'the ladybird costs five seconds');
  assert.deepEqual(heard, ['hit', 'miss']);
  // Where a point on the drawn box lands in the game.
  const [gx, gy] = G.at(400, 205, 800, 410);
  assert.ok(Math.abs(gx - FIELD.w / 2) < 1e-6 && Math.abs(gy - FIELD.h / 2) < 1e-6);
  G.stop();
  assert.ok(G.at(1, 1, 2, 2).every(Number.isNaN));
});

test('each game makes its sounds and says when it is over, once', () => {
  const { heard, sfx } = sounds(), ends = [], G = makeDeskGames({ sfx, onEvent: n => ends.push(n) });
  G.start('bughunt');
  for (let i = 0; i < 60 * 50; i++) G.tick(1 / 60);
  assert.equal(G.playing.done, true);
  assert.equal(G.playing.note, "Time's up");
  assert.deepEqual(ends, ['over']);
  G.start('paddle', 'easy');
  for (let i = 0; i < 60 * 120 && !G.playing.done; i++) G.tick(1 / 60);
  assert.equal(G.playing.note, 'The computer wins', 'standing still loses');
  assert.equal(heard.filter(s => s === 'miss').length, 5, 'a low note for each point lost');
  assert.deepEqual(ends, ['over', 'over', 'duel']);
});

test('drawing: the game, a still for its card, the paused and finished covers; it only paints its own picture', () => {
  const G = makeDeskGames();
  const g = fakeContext();
  G.draw(g, 800, 410);
  assert.equal(g.calls.length, 0, 'nothing to draw with no game on');
  for (const id of ['paddle', 'orbit', 'bughunt']) {
    G.start(id);
    for (let i = 0; i < 30; i++) G.tick(1 / 60);
    assert.ok(!G.playing.done, id);
    const c = fakeContext();
    G.draw(c, 800, 410);
    assert.ok(c.calls.some(k => k[0] === 'fillRect'), id);
    assert.ok(!c.calls.some(k => k[0] === 'clearRect'), `${id}: what is around the picture is left alone`);
    assert.equal(c.calls.filter(k => k[0] === 'save').length, c.calls.filter(k => k[0] === 'restore').length, `${id}: every save is restored`);
    G.pause(true);
    const p = fakeContext();
    G.draw(p, 800, 410);
    assert.ok(p.calls.some(k => k[0] === 'fillText' && k[1] === 'Paused'), `${id}: paused`);
    const s = fakeContext();
    G.preview(s, id, 220, 200);
    assert.ok(s.calls.length > 5 && !s.calls.some(k => k[0] === 'clearRect'), `${id}: a still`);
  }
  G.start('orbit');
  for (let i = 0; i < 400 && !G.playing.done; i++) G.tick(1 / 30);
  const d = fakeContext();
  G.draw(d, 800, 410);
  assert.ok(d.calls.some(k => k[0] === 'fillText' && k[1] === 'Burned up') && d.calls.some(k => k[0] === 'fillText' && /^A new best\.|^Best: /.test(k[1])));
  const n = fakeContext();
  G.preview(n, 'nope', 10, 10);
  assert.equal(n.calls.length, 0);
});

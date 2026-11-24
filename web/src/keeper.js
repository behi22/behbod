// The keeper's corner: the keepy-up ball by the mini goal.
import { makeKeepyBall } from './keepyball.js';

export function makeKeeper(scene, meta, opts = {}) {
  const ball = makeKeepyBall(scene, meta, opts);
  return {
    ball,
    spots: ball ? [ball.spot] : [],
    // E on one of these spots; true when it was one of mine.
    act(id) { if (!ball || id !== ball.spot.id) return false; ball.kick(); return true; },
    // A click or tap in the room (`player` is where I stand); true when it landed on the ball.
    tap(ray, blockers, player) { return !!ball?.tap(ray, blockers, player); },
    tick(dt, player, vel) { ball?.tick(dt, player, vel); },
  };
}

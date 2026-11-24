// The keeper's corner and the desk shelf: the keepy-up ball by the mini goal, the three figures above the desk, and
// the house's save of the week for the TV, worked out in spare moments once the house has been up a while.
import { makeKeepyBall } from './keepyball.js';
import { makeFigures } from './figures.js';
import { weekSave } from './weeksave.js';

const SAVE_AFTER = 20;

export function makeKeeper(scene, meta, opts = {}) {
  const ball = makeKeepyBall(scene, meta, opts), figures = makeFigures(scene, { creatures: opts.creatures, coarse: opts.coarse });
  let up = 0;
  return {
    ball, figures, weekSave,
    spots: ball ? [ball.spot] : [],
    // E on one of these spots; true when it was one of mine.
    act(id) { if (!ball || id !== ball.spot.id) return false; ball.kick(); return true; },
    // A click or tap in the room (`player` is where I stand); true when it landed on the bobblehead or the ball.
    tap(ray, blockers, player) { return figures.hit(ray, blockers) || !!ball?.tap(ray, blockers, player); },
    tick(dt, player, vel) {
      ball?.tick(dt, player, vel);
      figures.tick(dt);
      if (up < SAVE_AFTER && (up += dt) >= SAVE_AFTER) weekSave.start();
    },
  };
}

import { ratioOf } from './tier.js';

// A change of quality that resizes the picture holds the frame it lands on while the browser resizes the canvas
// (tens of milliseconds at 1440x900 on a 2x screen), so an automatic one waits for a still view, where a held frame
// is hardly seen. The view is still once the camera has moved under 5 cm and turned under 1.5 degrees a second for
// 300 ms: a 60 ms frame held then shifts the picture by a pixel or two. It waits 3 s at most, since a machine that
// asked to step down is struggling until it does.
export const MOVE = 0.05, TURN = Math.PI / 120, SETTLE = 300, CAP = 3000;

// When the view last moved, after a frame of `dt` seconds in which the camera went `moved` metres and turned `turned`
// radians while its field of view went from `was` to `fov` degrees (`normal` is its usual one); `last` is when it moved
// before. A view narrower than normal (the telescope, a gun's zoom) shows a turn larger, so the turn limit comes down
// in proportion; a change of width moves the picture's edges by half of it, and counts as that much turning.
export function lastMoved(last, moved, turned, dt, now, { fov, was, normal }) {
  const narrow = Math.min(1, fov / normal), zoom = Math.abs(fov - was) * Math.PI / 360;
  return moved > MOVE * dt || turned + zoom > TURN * narrow * dt ? now : last;
}

// Whether the automatic change to tier `to`, asked for at `at`, still waits at `now`: only one that changes the pixel
// ratio drawn at (`ratio` now, on a screen of `dpr`) waits, until the view has been still for SETTLE ms (it last moved
// at `moved`) or for CAP ms at most.
export function waits({ to, at }, now, moved, ratio, dpr) {
  return ratioOf(to, dpr) !== ratio && now - at < CAP && now - moved < SETTLE;
}

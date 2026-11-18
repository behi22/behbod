import { track, smoother } from './springs.js';

// The hands' moves as clips: each a few tracks of keys over time, eased from one key to the next. The view reads
// a clip at a time and poses the gun and the hands from it; the weapon's own rules (src/pure/weapon.js) still say
// when the magazine is out and in, and a clip is built from the same numbers so the two never drift apart.
//   gun:   [x, y, z, pitch, yaw, roll], the gun moved from where it is held (metres and radians, the eye's axes,
//          turned about the grip)
//   right, left: the pose each hand is in, by name, eased from each to the next
//   mag:   [down the well, toward the pouch 0..1] for the fresh magazine (0, 0 is home)
//   slide: how far back a hand holds the slide (0 home, 1 right back), and `held` the times it is in a hand
//   cues:  sounds, by name, at their moments

// A track of names: the two poses either side of t and how far from the first to the second.
export function between(keys, t) {
  if (!keys?.length) return null;
  if (t <= keys[0][0]) return { a: keys[0][1], b: keys[0][1], k: 0 };
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i];
    if (t > t1) continue;
    const [t0, a] = keys[i - 1];
    return { a, b, k: a === b ? 0 : smoother((t - t0) / (t1 - t0 || 1)) };
  }
  const last = keys[keys.length - 1][1];
  return { a: last, b: last, k: 0 };
}

// Every value a clip gives at time t.
export function sample(clip, t) {
  const held = clip.held && t >= clip.held[0] && t < clip.held[1];
  return {
    gun: clip.gun ? track(clip.gun, t) : [0, 0, 0, 0, 0, 0],
    right: between(clip.right, t), left: between(clip.left, t),
    mag: clip.mag ? track(clip.mag, t) : [0, 0],
    slide: held && clip.slide ? track(clip.slide, t) : null,
  };
}

// The cues passed going from t0 to t1 (t0 excluded, t1 included), in order.
export function cues(clip, t0, t1) {
  return (clip.cues || []).filter(([t]) => t > t0 && t <= t1).map(([, name]) => name);
}

// ---------- the pistol ----------
// s: the gun's numbers as stats() gives them (src/pure/arsenal.js).
export function pistolClips(s) {
  const R = s.reload, out = R.out, inn = R.in, rack = R.rack;
  // The gun turned up and over so the magazine well faces the eye.
  const TURN = [-0.045, 0.085, 0.02, 0.5, 0.22, -0.62];
  const SHOW = [-0.035, 0.035, 0.0, 0.12, 0.38, -0.2];
  const reload = empty => {
    const end = empty ? R.empty : R.partial;
    const c = {
      T: end,
      gun: [[0, [0, 0, 0, 0, 0, 0]], [out * 0.85, TURN], [inn + 0.06, TURN]],
      right: [[0, 'grip'], [0.12, 'straight'], [out - 0.1, 'straight'], [out - 0.03, 'release'], [out + 0.07, 'straight']],
      left: [[0, 'grip'], [0.04, 'grip'], [Math.min(out, 0.3), 'low'], [out + 0.1, 'low'], [out + 0.18, 'mag'], [inn + 0.04, 'mag']],
      mag: [[out + 0.14, [0.3, 1]], [inn - 0.2, [0.13, 0]], [inn - 0.04, [0.035, 0]], [inn, [0, 0]]],
      cues: [[0.02, 'cloth'], [out - 0.04, 'magRelease'], [out, 'magOut'], [out + 0.5, 'magDrop'], [inn, 'magIn']],
    };
    if (!empty) {
      c.gun.push([inn + 0.42, [0, 0, 0, 0, 0, 0]]);
      c.left.push([inn + 0.3, 'grip']);
      c.right.push([end - 0.18, 'straight'], [end - 0.04, 'grip']);
    } else {
      // From empty the slide is locked back: the free hand goes back to the grip, the gun turns to show its left
      // side, and the shooting hand's thumb presses the slide stop down to let the slide fly home.
      c.gun.push([inn + 0.3, SHOW], [rack + 0.08, SHOW], [end - 0.02, [0, 0, 0, 0, 0, 0]]);
      c.left.push([inn + 0.3, 'grip']);
      c.right.push([rack - 0.16, 'straight'], [rack - 0.03, 'stop'], [rack + 0.06, 'stop'], [end - 0.12, 'straight'], [end - 0.02, 'grip']);
      c.cues.push([rack, 'slideRelease']);
    }
    return c;
  };
  // The look over: the free hand lets go, the gun turns to show its left side, then over to its right, then the free
  // hand eases the slide back for a look into the chamber, and it all comes home.
  const LEFT = [-0.08, 0.06, 0.0, 0.2, 1.15, 0.2], RIGHT = [-0.04, 0.06, 0.0, 0.15, -0.9, -0.3], ZERO = [0, 0, 0, 0, 0, 0];
  // For the look into the chamber: muzzle up a little, the top rolled toward the eye, the port showing.
  const PRESS = [-0.06, 0.06, 0.0, 0.35, 0.2, 0.9];
  const inspect = {
    T: 3.6,
    gun: [[0, ZERO], [0.6, LEFT], [1.25, LEFT.map((v, i) => v + [0, 0.004, 0, 0.03, 0.08, 0.05][i])], [1.85, RIGHT],
      [2.1, RIGHT], [2.38, PRESS], [3.05, PRESS.map((v, i) => v + [0, 0, 0, 0.04, 0.06, 0.05][i])], [3.6, ZERO]],
    right: [[0, 'grip'], [0.12, 'straight'], [3.4, 'straight'], [3.58, 'grip']],
    left: [[0, 'grip'], [0.05, 'grip'], [0.35, 'low'], [2.0, 'low'], [2.3, 'over'], [2.4, 'pinch'], [2.95, 'pinch'], [3.03, 'over'], [3.3, 'low'], [3.58, 'grip']],
    held: [2.42, 2.95], slide: [[2.42, 0], [2.6, 0.38], [2.85, 0.38], [2.95, 0.32]],
    cues: [[0.03, 'cloth'], [0.55, 'handle'], [1.5, 'cloth'], [2.38, 'grab'], [2.5, 'slidePull'], [2.96, 'slideHome'], [3.35, 'cloth']],
  };
  // Raised from below, the free hand joining it on the way up.
  const D = s.draw;
  const draw = { T: D + 0.2, left: [[0, 'low'], [D * 0.35, 'low'], [D + 0.12, 'grip']], right: [[0, 'straight'], [D * 0.7, 'straight'], [D + 0.15, 'grip']], cues: [[0, 'draw']] };
  return { reload: reload(false), reloadEmpty: reload(true), inspect, draw };
}

export const CLIPS = { pistol: pistolClips };

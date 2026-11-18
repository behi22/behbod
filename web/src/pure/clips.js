import { track, smoother } from './springs.js';

// Keyed tracks built from the weapon's own times: gun [x, y, z, pitch, yaw, roll] about the grip, hand poses, mag, slide, cues.

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

const GRIP = { a: 'grip', b: 'grip', k: 0 };
// Every value a clip gives at time t.
export function sample(clip, t) {
  const held = clip.held && t >= clip.held[0] && t < clip.held[1];
  return {
    gun: clip.gun ? track(clip.gun, t) : [0, 0, 0, 0, 0, 0],
    // A hand the clip leaves out stays on its grip.
    right: between(clip.right, t) || GRIP, left: between(clip.left, t) || GRIP,
    mag: clip.mag ? track(clip.mag, t) : [0, 0],
    slide: held && clip.slide ? track(clip.slide, t) : null,
    // A bolt worked by hand: how far its handle is lifted and how far it is drawn back, 0 to 1 each.
    bolt: clip.bolt ? track(clip.bolt, t) : [0, 0],
    // A feed cover, 0 shut to 1 open; whether the belt shows (null: as the ammunition says).
    cover: clip.cover ? track(clip.cover, t)[0] : 0,
    belt: clip.beltOff === undefined ? null : t < clip.beltOff || t >= clip.beltOn,
  };
}

// The cues passed going from t0 to t1 (t0 excluded, t1 included), in order.
export function cues(clip, t0, t1) {
  return (clip.cues || []).filter(([t]) => t > t0 && t <= t1).map(([, name]) => name);
}
// Cut short at t (its cues heard up to t), a clip still owes the sound of an action it opened shutting.
const SHUTS = [['boltOpen', 'boltClose'], ['coverOpen', 'coverClose']];
export function owed(clip, t) {
  const at = name => (clip.cues || []).find(c => c[1] === name)?.[0];
  return SHUTS.filter(([open, shut]) => at(open) <= t && t < at(shut)).map(([, shut]) => shut);
}

// ---------- the pistol (s: its numbers from stats() in src/pure/arsenal.js) ----------
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
      // From empty the thumb presses the slide stop to let the locked slide fly home, the gun turned to show it.
      c.gun.push([inn + 0.3, SHOW], [rack + 0.08, SHOW], [end - 0.02, [0, 0, 0, 0, 0, 0]]);
      c.left.push([inn + 0.3, 'grip']);
      c.right.push([rack - 0.16, 'straight'], [rack - 0.03, 'stop'], [rack + 0.06, 'stop'], [end - 0.12, 'straight'], [end - 0.02, 'grip']);
      c.cues.push([rack, 'slideRelease']);
    }
    return c;
  };
  // The look over: its left side, its right, then the free hand eases the slide back to show the chamber.
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

const Z = [0, 0, 0, 0, 0, 0];
const nudge = (a, d) => a.map((v, i) => v + d[i]);

// ---------- the Vesper and the Keeper: the free hand on the handguard; a dry gun is charged by hauling its handle ----------
// look: how the gun is turned for the reload (TURN), to show the handle (SHOW), for the look over (LEFT, RIGHT, PRESS).
const VESPER = { TURN: [-0.02, 0.04, 0.0, 0.2, 0.12, -0.5], SHOW: [-0.01, 0.03, 0.0, 0.08, 0.28, -0.12],
  LEFT: [-0.04, 0.05, 0.0, 0.15, 0.85, 0.15], RIGHT: [-0.02, 0.05, 0.0, 0.1, -0.65, -0.25], PRESS: [-0.03, 0.05, 0.0, 0.12, 0.38, 0.45] };
const KEEPER = { TURN: [-0.03, 0.05, 0.0, 0.16, 0.1, -0.45], SHOW: [0.0, 0.0, -0.13, 0.05, 0.35, 0.25],
  LEFT: [-0.05, 0.05, 0.0, 0.12, 0.75, 0.12], RIGHT: [-0.02, 0.05, 0.0, 0.08, -0.55, -0.22], PRESS: [-0.02, 0.02, -0.13, -0.05, 0.4, 0.3] };
export const smgClips = s => handleClips(s, VESPER);
export const rifleClips = s => handleClips(s, KEEPER);
function handleClips(s, { TURN, SHOW, LEFT, RIGHT, PRESS }) {
  const R = s.reload, out = R.out, inn = R.in, rack = R.rack;
  const reload = empty => {
    const end = empty ? R.empty : R.partial;
    const c = {
      T: end,
      gun: [[0, Z], [out * 0.9, TURN], [inn + 0.08, TURN]],
      right: [[0, 'grip'], [0.12, 'straight'], [out - 0.1, 'straight'], [out - 0.03, 'release'], [out + 0.07, 'straight']],
      left: [[0, 'grip'], [0.06, 'grip'], [Math.min(out, 0.32), 'low'], [out + 0.12, 'low'], [out + 0.22, 'mag'], [inn + 0.04, 'mag']],
      mag: [[out + 0.18, [0.3, 1]], [inn - 0.22, [0.12, 0]], [inn - 0.05, [0.03, 0]], [inn, [0, 0]]],
      cues: [[0.02, 'cloth'], [out - 0.04, 'magRelease'], [out, 'magOut'], [out + 0.45, 'magDrop'], [inn, 'magIn']],
    };
    if (!empty) {
      c.gun.push([inn + 0.4, Z]);
      c.left.push([inn + 0.38, 'grip']);
      c.right.push([end - 0.18, 'straight'], [end - 0.04, 'grip']);
    } else {
      const grab = inn + 0.24;
      c.gun.push([grab, SHOW], [rack + 0.08, SHOW], [end - 0.02, Z]);
      c.left.push([grab, 'charge'], [rack + 0.02, 'charge'], [end - 0.06, 'grip']);
      c.right.push([end - 0.18, 'straight'], [end - 0.04, 'grip']);
      c.held = [grab, rack]; c.slide = [[grab, 0], [grab + 0.06, 0], [rack - 0.1, 1], [rack, 1]];
      c.cues.push([grab + 0.04, 'grab'], [grab + 0.1, 'slidePull'], [rack, 'slideRelease']);
    }
    return c;
  };
  const inspect = {
    T: 3.4,
    gun: [[0, Z], [0.55, LEFT], [1.15, nudge(LEFT, [0, 0.004, 0, 0.03, 0.07, 0.04])], [1.75, RIGHT], [2.0, RIGHT], [2.28, PRESS], [2.95, nudge(PRESS, [0, 0, 0, 0.03, 0.05, 0.04])], [3.4, Z]],
    right: [[0, 'grip'], [0.12, 'straight'], [3.2, 'straight'], [3.38, 'grip']],
    left: [[0, 'grip'], [2.05, 'grip'], [2.3, 'charge'], [2.86, 'charge'], [3.2, 'grip']],
    held: [2.34, 2.86], slide: [[2.34, 0], [2.52, 0.4], [2.76, 0.4], [2.86, 0.36]],
    cues: [[0.03, 'cloth'], [0.5, 'handle'], [1.45, 'cloth'], [2.3, 'grab'], [2.42, 'slidePull'], [2.87, 'slideHome'], [3.15, 'cloth']],
  };
  const D = s.draw;
  const draw = { T: D + 0.25, left: [[0, 'low'], [D * 0.35, 'low'], [D + 0.18, 'grip']], right: [[0, 'straight'], [D * 0.7, 'straight'], [D + 0.15, 'grip']], cues: [[0, 'draw']] };
  return { reload: reload(false), reloadEmpty: reload(true), inspect, draw };
}

// ---------- the Longview: a bolt worked by the right hand after every shot, a short box magazine ----------
export function sniperClips(s) {
  const R = s.reload, out = R.out, inn = R.in, rack = R.rack, B = s.bolt;
  const TURN = [-0.03, 0.05, 0.0, 0.14, 0.1, -0.42], SHOW = [0.0, 0.0, -0.06, 0.03, 0.06, 0.22];
  // The bolt worked once: up, back (the case flies), forward, down; `at` is when it is home again.
  const work = (at, dur) => {
    const k = dur / 0.6;
    return {
      bolt: [[at - 0.6 * k, [0, 0]], [at - 0.48 * k, [1, 0]], [at - 0.3 * k, [1, 1]], [at - 0.12 * k, [1, 0]], [at, [0, 0]]],
      cues: [[at - 0.58 * k, 'boltOpen'], [at - 0.34 * k, 'eject'], [at - 0.16 * k, 'boltClose']],
    };
  };
  const reload = empty => {
    const end = empty ? R.empty : R.partial;
    const c = {
      T: end,
      gun: [[0, Z], [out * 0.9, TURN], [inn + 0.08, TURN]],
      right: [[0, 'grip'], [0.12, 'straight'], [out - 0.1, 'straight'], [out - 0.03, 'release'], [out + 0.07, 'straight']],
      left: [[0, 'grip'], [0.06, 'grip'], [Math.min(out, 0.4), 'low'], [out + 0.15, 'low'], [out + 0.3, 'mag'], [inn + 0.04, 'mag']],
      mag: [[out + 0.25, [0.3, 1]], [inn - 0.25, [0.1, 0]], [inn - 0.06, [0.025, 0]], [inn, [0, 0]]],
      cues: [[0.02, 'cloth'], [out - 0.04, 'magRelease'], [out, 'magOut'], [out + 0.45, 'magDrop'], [inn, 'magIn']],
    };
    c.left.push([inn + 0.4, 'grip']);
    if (!empty) {
      c.gun.push([inn + 0.45, Z]);
      c.right.push([end - 0.2, 'straight'], [end - 0.05, 'grip']);
    } else {
      const w = work(rack + 0.08, 0.62);
      c.gun.push([rack - 0.62, SHOW], [rack + 0.1, SHOW], [end - 0.03, Z]);
      c.right.push([rack - 0.7, 'straight'], [rack - 0.56, 'bolt'], [rack + 0.12, 'bolt'], [end - 0.08, 'grip']);
      c.bolt = w.bolt; c.cues.push(...w.cues);
    }
    return c;
  };
  // After every shot that leaves a round to feed: the hand off the grip, the bolt worked, the hand back.
  const w = work(B - 0.2, 0.6), CYC = [0.0, -0.008, 0.0, 0.03, 0.05, 0.16];
  const cycle = { T: B, gun: [[0, Z], [0.12, CYC], [B - 0.2, CYC], [B, Z]], right: [[0, 'grip'], [0.12, 'bolt'], [B - 0.18, 'bolt'], [B - 0.02, 'grip']], bolt: w.bolt, cues: w.cues };
  const LEFT = [-0.06, 0.05, -0.04, 0.1, 0.7, 0.12], RIGHT = [-0.02, 0.05, -0.04, 0.06, -0.5, -0.2], PRESS = [-0.02, 0.02, -0.08, 0.04, 0.12, 0.3];
  const inspect = {
    T: 3.4,
    gun: [[0, Z], [0.55, LEFT], [1.15, nudge(LEFT, [0, 0.004, 0, 0.03, 0.06, 0.04])], [1.75, RIGHT], [2.0, RIGHT], [2.28, PRESS], [3.0, PRESS], [3.4, Z]],
    right: [[0, 'grip'], [0.12, 'straight'], [2.1, 'straight'], [2.3, 'bolt'], [3.1, 'bolt'], [3.36, 'grip']],
    left: [[0, 'grip']],
    bolt: [[2.36, [0, 0]], [2.5, [1, 0]], [2.66, [1, 0.35]], [2.88, [1, 0.35]], [3.0, [1, 0]], [3.1, [0, 0]]],
    cues: [[0.03, 'cloth'], [0.5, 'handle'], [1.45, 'cloth'], [2.32, 'grab'], [2.4, 'boltOpen'], [2.92, 'boltClose'], [3.3, 'cloth']],
  };
  const D = s.draw;
  const draw = { T: D + 0.25, left: [[0, 'low'], [D * 0.35, 'low'], [D + 0.18, 'grip']], right: [[0, 'straight'], [D * 0.7, 'straight'], [D + 0.15, 'grip']], cues: [[0, 'draw']] };
  return { reload: reload(false), reloadEmpty: reload(true), cycle, inspect, draw };
}

// ---------- the Gatekeeper: the cover lifted, the box changed, the belt laid in the tray, the cover shut ----------
export function lmgClips(s) {
  const R = s.reload, out = R.out, inn = R.in, rack = R.rack, end = R.empty;
  // The cover is near the eye: the gun goes out and down a little while a hand works it.
  const TURN = [-0.02, 0.03, -0.02, 0.1, 0.18, -0.3], OPEN = [-0.02, -0.03, -0.1, 0.1, 0.1, 0.25];
  // The box goes home and the belt is laid in a set time before the rounds count, so a slower (bigger) box keeps them in step.
  const seat = inn - 0.6, laid = inn - 0.35;
  const reload = empty => {
    const c = {
      T: empty ? R.empty : R.partial,
      gun: [[0, Z], [0.3, OPEN], [0.75, OPEN], [out * 0.95, TURN], [inn - 0.45, TURN], [inn - 0.1, OPEN], [inn + 0.5, OPEN]],
      right: [[0, 'grip'], [0.12, 'straight'], [rack - 0.2, 'straight']],
      left: [[0, 'grip'], [0.25, 'cover'], [0.66, 'cover'], [0.82, 'mag'], [out + 0.02, 'mag'], [out + 0.25, 'low'], [out + 0.45, 'low'], [out + 0.6, 'mag'],
        [seat + 0.02, 'mag'], [seat + 0.18, 'belt'], [inn, 'belt'], [inn + 0.15, 'cover'], [inn + 0.48, 'cover']],
      mag: [[out + 0.55, [0.3, 1]], [seat - 0.3, [0.1, 0]], [seat - 0.08, [0.02, 0]], [seat, [0, 0]]],
      cover: [[0.3, [0]], [0.62, [1]], [inn + 0.2, [1]], [inn + 0.45, [0]]],
      beltOff: empty ? 0 : out, beltOn: laid,
      cues: [[0.02, 'cloth'], [0.32, 'coverOpen'], [out - 0.05, 'magRelease'], [out, 'magOut'], [out + 0.45, 'magDrop'], [seat, 'magIn'], [laid, 'beltIn'], [inn + 0.45, 'coverClose']],
    };
    if (!empty) {
      c.gun.push([inn + 0.85, Z]);
      c.left.push([inn + 0.85, 'grip']);
      c.right.push([c.T - 0.15, 'grip']);
    } else {
      const grab = rack - 0.3;
      c.gun.push([grab, OPEN], [rack + 0.1, OPEN], [end - 0.05, Z]);
      c.left.push([grab, 'charge'], [rack + 0.03, 'charge'], [end - 0.08, 'grip']);
      c.right.push([end - 0.15, 'grip']);
      c.held = [grab, rack]; c.slide = [[grab, 0], [grab + 0.05, 0], [rack - 0.08, 1], [rack, 1]];
      c.cues.push([grab + 0.08, 'slidePull'], [rack, 'slideRelease']);
    }
    return c;
  };
  const LEFT = [-0.05, 0.05, -0.04, 0.1, 0.7, 0.12], RIGHT = [-0.02, 0.05, -0.04, 0.06, -0.5, -0.2];
  const inspect = {
    T: 3.4,
    gun: [[0, Z], [0.55, LEFT], [1.15, nudge(LEFT, [0, 0.004, 0, 0.03, 0.06, 0.04])], [1.75, RIGHT], [2.0, RIGHT], [2.3, OPEN], [3.0, OPEN], [3.4, Z]],
    right: [[0, 'grip'], [0.12, 'straight'], [3.2, 'straight'], [3.38, 'grip']],
    left: [[0, 'grip'], [2.05, 'grip'], [2.3, 'cover'], [2.95, 'cover'], [3.25, 'grip']],
    cover: [[2.35, [0]], [2.55, [0.55]], [2.8, [0.55]], [2.95, [0]]],
    cues: [[0.03, 'cloth'], [0.5, 'handle'], [1.45, 'cloth'], [2.35, 'coverOpen'], [2.95, 'coverClose'], [3.15, 'cloth']],
  };
  const D = s.draw;
  const draw = { T: D + 0.25, left: [[0, 'low'], [D * 0.35, 'low'], [D + 0.18, 'grip']], right: [[0, 'straight'], [D * 0.7, 'straight'], [D + 0.15, 'grip']], cues: [[0, 'draw']] };
  return { reload: reload(false), reloadEmpty: reload(true), inspect, draw };
}

export const CLIPS = { pistol: pistolClips, smg: smgClips, rifle: rifleClips, sniper: sniperClips, lmg: lmgClips };

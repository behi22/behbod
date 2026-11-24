// The residents' moments, under Behbod's one rule for Pishi, Jessi and BH-22: the house stays normal. At most one showy
// moment at a time across all three, a calm gap after each (and after the page opens), and each moment rare, with its
// own cooldown. Quiet touches (a head tilt, a nap in the sun) never take the slot and never wait for it. Seconds.

// The calm after a showy moment ends before the next may start, and once it is over, how long on average until the
// house starts one of its own: about one every four minutes, fewer when nobody is near enough to see it.
export const GAP = 75, MEAN = 150;

// weight: started by the house now and then (picked by weight among those that can happen). chance: started by
// something the visitor does, one roll each time. Neither: the caller has its own roll (the keyboard trick).
export const MOMENTS = {
  keywalk: { who: 'pishi', cool: 900, weight: 2 },
  chatter: { who: 'pishi', cool: 300, weight: 3 },
  steal: { who: 'pishi', cool: 900, weight: 2 },
  stalk: { who: 'pishi', cool: 600, weight: 2 },
  zoomies: { who: 'pishi', cool: 1500, weight: 1 },
  knock: { who: 'pishi', cool: 900, weight: 2 },
  keys: { who: 'pishi', cool: 240 },
  toy: { who: 'jessi', cool: 600, chance: 0.5 },
  howl: { who: 'jessi', cool: 300, chance: 0.5 },
  beg: { who: 'jessi', cool: 300, chance: 0.6 },
  tail: { who: 'jessi', cool: 1800, weight: 0.5 },
  dance: { who: 'bh22', cool: 240, chance: 0.5 },
  vacuum: { who: 'bh22', cool: 900, weight: 2 },
  water: { who: 'bh22', cool: 900, weight: 2 },
  scope: { who: 'bh22', cool: 900, weight: 3 },
  sunnap: { who: 'pishi', cool: 600, quiet: true },
  tilt: { who: 'jessi', cool: 20, quiet: true },
  wag: { who: 'jessi', cool: 120, quiet: true },
};

export function makeMoments({ defs = MOMENTS, gap = GAP, mean = MEAN, start = 0 } = {}) {
  const last = {};
  let active = null, calmFrom = start;
  const rested = (id, t) => t - (last[id] ?? -Infinity) >= defs[id].cool;
  const m = {
    get active() { return active; },
    ready(id, t) {
      const d = defs[id];
      if (!d || !rested(id, t)) return false;
      return !!d.quiet || (!active && t - calmFrom >= gap);
    },
    start(id, t) {
      if (!m.ready(id, t)) return false;
      last[id] = t;
      if (!defs[id].quiet) active = id;
      return true;
    },
    end(id, t) { if (active === id) { active = null; calmFrom = t; } },
    // Started whatever the rules say (the test hooks); the caller ends the one running first.
    force(id, t) {
      if (!defs[id]) return false;
      last[id] = t;
      if (!defs[id].quiet) active = id;
      return true;
    },
    // Once a frame: whether the house starts a moment of its own now.
    due(t, dt, rand) { return !active && t - calmFrom >= gap && rand < 1 - Math.exp(-dt / mean); },
    // Something the visitor did: one roll at the moment's chance.
    roll(id, t, rand) { return m.ready(id, t) && rand < (defs[id].chance ?? 1) && m.start(id, t); },
  };
  return m;
}

// One of `ids` by weight; `boost` scales some (zoomies late at night). Null when none has any weight.
export function pickMoment(ids, defs, rand, boost = {}) {
  const w = ids.map(id => (defs[id]?.weight || 0) * (boost[id] ?? 1));
  const total = w.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  let r = rand * total;
  for (let i = 0; i < ids.length; i++) if ((r -= w[i]) < 0 && w[i] > 0) return ids[i];
  return ids[w.findLastIndex(x => x > 0)];
}

// Pishi's zoomies come four times as often late at night (Vancouver time); BH-22 runs low on power through the night.
export const zoomiesBoost = hour => (hour >= 22 || hour < 3 ? 4 : 1);
export const lowPower = hour => hour >= 23 || hour < 6;

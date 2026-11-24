// The save of the week for the TV's replay: the house's own, found by playing its match for the week in the page's
// spare moments, and the visitor's own best save as keeper this week, kept in this browser when it can be.
import { weekKey, makeSearch, pack, unpack, choose, KEY } from './pure/replay.js';

// At most 3 ms of the match at a time, checked every 15 steps (a step is a few microseconds). A busy page that never
// has a spare moment still gets a slice a second, so a slow phone gets there too.
const SLICE = 3, STEPS = 15;
const spare = typeof requestIdleCallback === 'function' ? f => requestIdleCallback(f, { timeout: 1000 }) : f => setTimeout(() => f(null), 100);

// `now` is today's date (the week follows it, so a Monday brings a new match), `storage` the visitor's storage (using
// it may throw), `idle` waits for a spare moment.
export function makeWeekSave({ now = () => new Date(), storage = () => localStorage, idle = spare, clock = () => performance.now() } = {}) {
  let week = null, search = null, mine = null, slowest = 0, busy = false, started = false;
  const waiting = [];

  function sameWeek() {
    const w = weekKey(now());
    if (w !== week) { week = w; search = makeSearch(w); mine = mine?.week === w ? mine : null; }
  }
  function settle() { if (search.done) for (const ok of waiting.splice(0)) ok(); }
  // One slice of the house's match, within `budget` ms; true once it is played out.
  function slice(budget) {
    const t0 = clock();
    while (!search.done && clock() - t0 < budget) search.run(STEPS);
    slowest = Math.max(slowest, clock() - t0);
    settle();
    return search.done;
  }
  function work(deadline) {
    busy = false;
    sameWeek();
    const left = deadline?.didTimeout ? SLICE : deadline?.timeRemaining?.() ?? SLICE;
    if (search.done || slice(Math.min(SLICE, Math.max(1, left)))) return;
    busy = true; idle(work);
  }
  function stored() {
    let text = null;
    try { text = storage().getItem(KEY); } catch (e) { /* storage blocked: only this visit's save */ }
    const kept = unpack(text, week);
    return kept && (!mine || kept.points >= mine.points) ? kept : mine;
  }

  return {
    // Plays the house's match in spare moments (once the house has settled), and this week's again after a Monday.
    start() { started = true; if (!busy) { busy = true; idle(work); } },
    // A slice now, inside a frame, for when the replay is open and waiting: at most `budget` ms.
    pump(budget = SLICE) { sameWeek(); return slice(budget); },
    // Resolves to the save of the week ({ who: 'house' | 'you', ... } or null), once the house's match is played out.
    get() {
      this.start();
      sameWeek();
      return new Promise(ok => { waiting.push(ok); settle(); }).then(() => choose(search.best, stored(), week));
    },
    // A save I made as keeper: kept if it is my best this week.
    offer(clip) {
      sameWeek();
      const own = { ...clip, week, who: 'you' }, best = stored();
      if (best && best.points >= own.points) return false;
      mine = own;
      try { storage().setItem(KEY, pack(own)); } catch (e) { /* kept for this visit only */ }
      return true;
    },
    get stats() { return { week, slowest: +slowest.toFixed(2), done: !!search?.done, clock: search ? +search.clock.toFixed(1) : 0, started }; },
  };
}

export const weekSave = makeWeekSave();

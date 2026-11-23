import { FIRST_READ, TIMEOUT, CHECK, combine, readCache, fresh, readDue, gameOn, forced } from './pure/matchday.js';

const KEY = 'loft.matchday';

// The room turns white and gold by itself on Real Madrid's game days. The fixtures are read live a few times a day, in a
// worker, and kept in the visitor's browser; when they cannot be read, the last good list stands, or the room simply
// stays as it is.
export function makeMatchday({ world, store, clock = () => new Date(), search = location.search }) {
  const force = forced(search);
  let kept = readCache(store.get(KEY)), on = false, reading = false, reads = 0;
  function apply() {
    const next = force ?? (!!kept && gameOn(kept.games, clock().getTime()));
    if (next !== on) { on = next; world.matchday(on); }
  }
  function read() {
    if (reading || document.hidden) return;
    reading = true; reads++;
    const now = Date.now();
    let worker = null, guard = 0;
    const done = lists => {
      if (!reading) return;
      reading = false;
      clearTimeout(guard);
      worker?.terminate();
      kept = lists ? { v: 1, at: now, tried: now, games: combine(lists[0], lists[1], now) } : { ...(kept || fresh()), tried: now };
      store.set(KEY, JSON.stringify(kept));
      apply();
    };
    try {
      worker = new Worker(new URL('./matchworker.js', import.meta.url), { type: 'module' });
    } catch (e) { done(null); return; }
    worker.onmessage = e => done(e.data);
    worker.onerror = () => done(null);
    // A worker that never answers counts as a failed try.
    guard = setTimeout(() => done(null), TIMEOUT + 4000);
    worker.postMessage(0);
  }
  function check() {
    apply();
    if (Date.now() >= readDue(kept, Date.now())) read();
  }
  return {
    // Called once the house is ready: the kept list counts at once, the first read waits a few seconds.
    start() {
      apply();
      if (force !== null) return;
      setTimeout(() => {
        check();
        setInterval(check, CHECK);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      }, FIRST_READ);
    },
    get on() { return on; },
    get reads() { return reads; },
    get kept() { return kept; },
  };
}

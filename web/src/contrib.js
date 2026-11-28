import { parseContrib, fromCache, toCache, cells, total, WEEKS } from './pure/contrib.js';

// profile-art republishes this file every hour from his public GitHub calendar, so the site needs no token.
export const CONTRIB_URL = 'https://behi22.github.io/profile-art/data/contrib.json';
const KEY = 'home.contrib', HOUR = 3600000, SETTLE = 6000, TIMEOUT = 15000;
const SHADES = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

// The kept copy at once, the live file once the house has settled, then hourly. `state`: waiting, saved, live or none.
export function makeContrib({ c, g, t }, { store, font, fetch = (...a) => globalThis.fetch(...a), now = () => Date.now() }) {
  let shown = fromCache(store.get(KEY)), state = shown ? 'saved' : 'waiting', busy = null, started = false, due = false;

  function draw() {
    g.fillStyle = '#0a0f15'; g.fillRect(0, 0, c.width, c.height);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#7f8aa0'; g.font = `14px ${font}`; g.fillText('contributions', 12, 22);
    const days = shown ? cells(shown) : Array.from({ length: WEEKS * 7 }, (_, i) => ({ col: Math.floor(i / 7), row: i % 7, level: 0 }));
    for (const k of days) { g.fillStyle = SHADES[k.level]; g.fillRect(12 + k.col * 5.6, 40 + k.row * 18, 4.6, 15); }
    if (shown) {
      g.textAlign = 'right'; g.fillStyle = SHADES[4]; g.fillText(total(shown.days).toLocaleString('en-US'), 308, 22);
      g.font = `11px ${font}`; g.fillStyle = '#4c566a'; g.fillText('last 12 months', 308, 182);
    } else {
      const say = state === 'none' ? "can't load the graph right now" : 'loading';
      g.font = `13px ${font}`; g.textAlign = 'center';
      g.fillStyle = 'rgba(10,15,21,.88)'; g.fillRect(24, 84, 272, 34);
      g.fillStyle = '#7f8aa0'; g.fillText(say, 160, 106);
    }
    g.textAlign = 'left';
    t.needsUpdate = true;
  }

  async function load() {
    let timer = 0;
    try {
      const stop = new AbortController();
      timer = setTimeout(() => stop.abort(), TIMEOUT);
      const res = await fetch(CONTRIB_URL, { signal: stop.signal, credentials: 'omit' });
      return res.ok ? parseContrib(await res.json()) : null;
    } catch { return null; } finally { clearTimeout(timer); }
  }
  // One read at a time; a failure keeps what is shown.
  function refresh() {
    busy ||= load().then(got => {
      busy = null;
      if (got) { shown = got; state = 'live'; store.set(KEY, toCache(got, now())); }
      else if (!shown) state = 'none';
      draw();
      return state;
    });
    return busy;
  }
  draw();
  return {
    refresh,
    // Called once the house is up: the first read waits for a quiet moment (and for `free`, so not while my story
    // plays: its draw would take the graphics card from the story), then one an hour while the page is seen.
    start(free = () => true) {
      if (started) return;
      started = true;
      const idle = fn => (globalThis.requestIdleCallback ? requestIdleCallback(fn, { timeout: 5000 }) : setTimeout(fn, 0));
      const first = () => (free() ? idle(refresh) : setTimeout(first, 1000));
      setTimeout(first, SETTLE);
      setInterval(() => { if (document.hidden) due = true; else refresh(); }, HOUR);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && due) { due = false; refresh(); } });
    },
    get state() { return state; },
    get total() { return shown ? total(shown.days) : null; },
  };
}

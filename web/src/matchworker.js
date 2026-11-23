import { SOURCES, TIMEOUT, parseSchedule } from './pure/matchday.js';

// ESPN's two lists are half a megabyte of JSON, so they are read and checked here, off the page's thread; the page gets
// the kick-offs back, or null when either list could not be read or was not right.
onmessage = async () => {
  const ctl = new AbortController(), stop = setTimeout(() => ctl.abort(), TIMEOUT);
  let lists = null;
  try {
    lists = await Promise.all(SOURCES.map(async u => {
      const r = await fetch(u, { signal: ctl.signal, credentials: 'omit' });
      return r.ok ? parseSchedule(await r.json()) : null;
    }));
  } catch (e) { /* down or too slow */ }
  clearTimeout(stop);
  ctl.abort();
  postMessage(lists?.[0] && lists[1] ? lists : null);
};

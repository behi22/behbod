import { soundsFor, TAKES } from './gunsound.js';

// The gun sounds a page keeps: built off the page's own thread when a worker can be had, one piece between frames when
// not, only for the gun in the hand (the suppressed shot only once a suppressor is on), and held once each.
// spawn() gives a Worker or throws; build(gun, name, take) makes one take here; make(L, R) turns it into what is played;
// later(fn) runs fn between frames; rand() picks a take.
export function makeBank({ spawn, build, make, later, rand = Math.random }) {
  const store = new Map(), waiting = new Map();
  let wanted = new Set(), queue = [], busy = null, worker, held = null, quiet = false;
  const keyOf = (gun, name, take) => `${gun}:${name}:${take}`;
  const job = key => { const [gun, name, take] = key.split(':'); return { key, gun, name, take: +take }; };

  function boot() {
    if (worker !== undefined) return worker;
    try { worker = spawn() || null; } catch { worker = null; }
    if (worker) {
      worker.onmessage = e => { const k = busy, d = e.data || {}; busy = null; if (d.key === k) done(k, d.L, d.R); pump(); };
      worker.onerror = e => { e?.preventDefault?.(); fail(); };
      worker.onmessageerror = () => fail();
    }
    return worker;
  }
  // A worker that will not start or breaks: what it held goes back in line and the page makes the rest itself.
  function fail() {
    try { worker?.terminate(); } catch { /* already gone */ }
    worker = null;
    if (busy) { queue.unshift(busy); busy = null; }
    pump();
  }
  function done(key, L, R) {
    const cbs = waiting.get(key) || [];
    waiting.delete(key);
    if (!wanted.has(key) || store.has(key) || !L) return;
    const buf = make(L, R);
    if (!buf) return;
    store.set(key, { buf, bytes: (L.length + R.length) * 4 });
    for (const cb of cbs) cb(buf);
  }
  function pump() {
    if (busy) return;
    queue = queue.filter(k => wanted.has(k) && !store.has(k));
    const k = queue.shift();
    if (!k) return;
    busy = k;
    if (boot()) { worker.postMessage(job(k)); return; }
    later(() => {
      busy = null;
      if (wanted.has(k) && !store.has(k)) { const j = job(k), out = build(j.gun, j.name, j.take); done(k, out?.[0], out?.[1]); }
      pump();
    });
  }

  const api = {
    // The gun now in the hand: its sounds are made, most wanted first, and any other gun's are let go.
    take(gun, { quiet: q = false } = {}) {
      if (gun === held && q === quiet) return;
      held = gun; quiet = q;
      const list = soundsFor(gun, { quiet: q }).map(([name, take]) => keyOf(gun, name, take));
      wanted = new Set(list);
      for (const k of [...store.keys()]) if (!wanted.has(k)) store.delete(k);
      for (const k of [...waiting.keys()]) if (!wanted.has(k)) waiting.delete(k);
      queue = list.filter(k => !store.has(k) && k !== busy);
      pump();
    },
    // A sound asked for: its gun taken if it was not (with the suppressed shot if that is what is asked).
    has(gun, name) { return soundsFor(gun, { quiet: true }).some(([n]) => n === name); },
    want(gun, name) { if (gun !== held || (name === 'shotQuiet' && !quiet)) api.take(gun, { quiet: name === 'shotQuiet' || (gun === held && quiet) }); },
    // A take of the sound that is ready, any one of them, or null.
    get(gun, name) {
      const n = TAKES[name] || 1, r = Math.floor(rand() * n);
      for (let i = 0; i < n; i++) { const s = store.get(keyOf(gun, name, (r + i) % n)); if (s) return s.buf; }
      return null;
    },
    // A sound wanted now and not made yet: made next, and handed to cb the moment it is (at once, made here, without a worker).
    hurry(gun, name, cb) {
      const n = TAKES[name] || 1, keys = Array.from({ length: n }, (_, t) => keyOf(gun, name, t)), ready = api.get(gun, name);
      if (ready) { cb(ready); return; }
      if (!keys.some(k => wanted.has(k))) return;
      if (!boot()) {
        const k = keys.find(x => wanted.has(x)), j = job(k), out = build(j.gun, j.name, j.take);
        done(k, out?.[0], out?.[1]);
        const s = store.get(k);
        if (s) cb(s.buf);
        return;
      }
      const k = keys.find(x => x === busy) || keys.find(x => wanted.has(x));
      (waiting.get(k) || waiting.set(k, []).get(k)).push(cb);
      if (k !== busy) { queue = [k, ...queue.filter(x => x !== k)]; pump(); }
    },
    stats() {
      let bytes = 0;
      for (const s of store.values()) bytes += s.bytes;
      return { gun: held, bytes, sounds: store.size, queued: queue.length + (busy ? 1 : 0), where: worker === undefined ? 'none yet' : worker ? 'worker' : 'page' };
    },
  };
  return api;
}

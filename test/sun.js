// The room white and gold on Real Madrid's game days, in a real Chrome.
//   LOFT_URL=http://127.0.0.1:8850 node test/sun.js [outdir] [only: matchday,live,source,none,down,slow,malformed,wrongteam,error,hidden,fresh,pick,phonematch,smooth]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/sun';
const ONLY = process.argv[3] || 'all';
fs.mkdirSync(OUT, { recursive: true });
// smooth times frames, so it runs only when named, under the lock's timing mode.
const want = part => (ONLY === 'all' && part !== 'smooth') || ONLY.split(',').includes(part);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const ESPN = /^https:\/\/site\.web\.api\.espn\.com\//;
const H = 3600e3, D = 24 * H;

function watch(p, errs, net) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url()) && !ESPN.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!OUTSIDE.test(r.url()) && !ESPN.test(r.url()) && !/run\.mp3|\.mp4/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('request', r => { if (ESPN.test(r.url())) net.push(r.url()); });
  p.on('console', m => {
    const at = m.location()?.url || '';
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(at)) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// seed: what the browser kept from an earlier visit; espn: answers to ESPN's two lists (or a way to fail them).
async function open(b, opts, query = '', { seed = null, espn = null, hidden = false, q = opts.isMobile ? 'medium' : 'high' } = {}) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], net = [];
  watch(p, errs, net);
  if (seed) await ctx.addInitScript(s => { try { localStorage.setItem('loft.matchday', s); } catch (e) { /* none */ } }, JSON.stringify(seed));
  if (hidden) await ctx.addInitScript(() => { window.__hide = true; Object.defineProperty(document, 'hidden', { get: () => window.__hide }); Object.defineProperty(document, 'visibilityState', { get: () => (window.__hide ? 'hidden' : 'visible') }); });
  if (espn) await ctx.route(ESPN, espn);
  await p.goto(`${BASE}/?auto&q=${q}${query}`);
  await p.waitForFunction(() => window.__loft && window.__matchday && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  return { ctx, p, errs, net };
}
async function standAt(p, x, y, z, yaw) {
  await p.evaluate(([v, yw]) => { __loft.pos.set(v[0], v[1] + 0.05, v[2]); __loft.yaw = yw; }, [[x, z, -y], yaw]);
  await p.waitForTimeout(900);
}
const sceneNow = p => p.evaluate(() => ({ name: __loft.world.sceneName, on: __matchday.on, reads: __matchday.reads, rgb: __loft.world.lights.find(([, l]) => l.role === 'rgb')?.[0].color.toArray(), kept: __matchday.kept, lights: __lights.on }));
const gold = c => !!c && Math.abs(c[0] - 1) < 0.01 && Math.abs(c[1] - 0.72) < 0.01 && Math.abs(c[2] - 0.18) < 0.01;
const noise = errs => errs.filter(e => !/Failed to load resource|net::ERR/.test(e));

// ESPN's two lists as it sends them, trimmed: one match at each of these times (ms).
const match = (id, at) => ({ id, date: new Date(at).toISOString().replace(/:\d\d\.\d{3}Z$/, 'Z'), timeValid: true,
  competitions: [{ id, timeValid: true, competitors: [{ id: '86', homeAway: 'home' }, { id: '85', homeAway: 'away' }], status: { type: { name: 'STATUS_SCHEDULED' } } }] });
const list = (times, from = 900) => JSON.stringify({ status: 'success', team: { id: '86', abbreviation: 'RMA' }, events: times.map((t, i) => match(String(from + i), t)) });
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
const answer = (ahead, played) => route => route.fulfill({ status: 200, headers: CORS, body: route.request().url().includes('fixture=true') ? list(ahead, 900) : list(played, 800) });
const gameToday = () => answer([Date.now() + 3 * D], [Date.now() - H]);
// Played yesterday by Vancouver's calendar (30 hours ago is never today), and kept: the list keeps two days back.
const noGame = () => answer([Date.now() + 3 * D], [Date.now() - 30 * H]);
const keptToday = (ago = 7 * H) => ({ v: 1, at: Date.now() - ago, tried: Date.now() - ago, games: [['1', Date.now() - H]] });

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- the room on game days ----------
    for (const [part, query, on] of [['matchday', '&matchday', true], ['matchday', '&matchday=off', false]]) {
      if (!want(part)) continue;
      const { ctx, p, errs, net } = await open(b, DESK, query, { espn: gameToday() });
      await p.waitForTimeout(6500);
      const s = await sceneNow(p);
      check(`${query} ${on ? 'turns the room white and gold' : 'keeps the room as it is'}, and reads nothing`, s.on === on && (on ? s.name === 'matchday' && gold(s.rgb) : s.name !== 'matchday') && s.reads === 0 && net.length === 0, JSON.stringify({ ...s, kept: undefined, net: net.length }));
      if (on) {
        await standAt(p, 17.5, 3.4, 0.45, Math.PI + 0.35);
        await p.screenshot({ path: path.join(OUT, 'matchday-studio.png') });
        await p.evaluate(() => __lights.set(false));
        await p.waitForTimeout(1500);
        const t = await sceneNow(p);
        check('the light switch keeps the last word: off stays off on a game day', !t.lights && t.name === 'matchday', JSON.stringify({ lights: t.lights, name: t.name }));
        await p.screenshot({ path: path.join(OUT, 'matchday-studio-lamps-off.png') });
      }
      check(`${query}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('live')) {
      const { ctx, p, errs, net } = await open(b, DESK, '', { espn: gameToday() });
      const early = await sceneNow(p);
      check('nothing is read while the house opens', early.reads === 0 && net.length === 0 && !early.on);
      await p.waitForFunction(() => __matchday.reads === 1 && __matchday.on, null, { timeout: 15000 }).catch(() => {});
      const mid = await sceneNow(p);
      await p.waitForTimeout(2500);
      const s = await sceneNow(p);
      check('a few seconds later both lists are read, and a match today turns the room white and gold', s.on && s.name === 'matchday' && gold(s.rgb) && s.reads === 1 && net.length === 2, JSON.stringify({ ...s, kept: undefined, net }));
      check('as a fade over a couple of seconds, not a jump', mid.on && !gold(mid.rgb), JSON.stringify(mid.rgb));
      check('the list is kept in the browser with when it was read', s.kept?.at > Date.now() - 60e3 && s.kept.tried === s.kept.at && s.kept.games.length === 2, JSON.stringify(s.kept));
      const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('loft.matchday')));
      check('and stored for the next visit', JSON.stringify(stored) === JSON.stringify(s.kept));
      await p.waitForTimeout(3000);
      check('and not read again soon after', (await sceneNow(p)).reads === 1 && net.length === 2);
      check('live: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('source')) {
      // The real thing, nothing stood in: ESPN's lists read from this page, across origins, in the worker.
      const { ctx, p, errs, net } = await open(b, DESK, '');
      await p.waitForFunction(() => __matchday.reads === 1 && __matchday.kept?.tried > 0, null, { timeout: 30000 }).catch(() => {});
      const s = await sceneNow(p);
      const soon = s.kept?.games.filter(([, at]) => at > Date.now()).length || 0;
      check('the live source answers this page and is understood: matches to come are kept (needs ESPN up)', s.kept?.at > 0 && s.kept.at === s.kept.tried && soon > 0 && net.length === 2, JSON.stringify({ at: s.kept?.at, games: s.kept?.games.length, soon, on: s.on, net: net.length }));
      check('source: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('none')) {
      const { ctx, p, errs } = await open(b, DESK, '', { espn: noGame() });
      await p.waitForFunction(() => __matchday.reads === 1, null, { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(300);
      const s = await sceneNow(p);
      check('no match today: the room stays as it is', !s.on && s.name !== 'matchday' && s.reads === 1 && s.kept.games.length === 2, JSON.stringify({ ...s, kept: undefined }));
      check('none: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    const failing = {
      down: route => route.abort('failed'),
      slow: async route => { await new Promise(r => setTimeout(r, 15000)); await route.fulfill({ status: 200, headers: CORS, body: list([Date.now()]) }).catch(() => {}); },
      malformed: route => route.fulfill({ status: 200, headers: CORS, body: '<html>Service Unavailable</html>' }),
      wrongteam: route => route.fulfill({ status: 200, headers: CORS, body: list([Date.now()]).replace('"id":"86","abbreviation"', '"id":"83","abbreviation"') }),
      error: route => route.fulfill({ status: 500, headers: CORS, body: '{}' }),
    };
    for (const [part, espn] of Object.entries(failing)) {
      if (!want(part)) continue;
      for (const seeded of [false, true]) {
        const seed = seeded ? keptToday() : null;
        const { ctx, p, errs } = await open(b, DESK, '', { espn, seed });
        await p.waitForFunction(() => __matchday.reads === 1 && __matchday.kept?.tried > Date.now() - 60e3, null, { timeout: 30000 }).catch(() => {});
        await p.waitForTimeout(300);
        const s = await sceneNow(p);
        const why = { down: 'down', slow: 'too slow', malformed: 'answering nonsense', wrongteam: 'answering for another team', error: 'answering 500' }[part];
        if (seeded) check(`the source ${why}: the last good list is kept, and today is still a game day`, s.on && s.name === 'matchday' && s.kept.at === seed.at && s.kept.games.length === 1 && s.kept.tried > seed.tried, JSON.stringify({ ...s, kept: { ...s.kept, games: s.kept?.games.length } }));
        else check(`the source ${why}, nothing kept: the room simply stays as it is`, !s.on && s.name !== 'matchday' && s.kept.at === 0 && s.kept.games.length === 0, JSON.stringify({ ...s, kept: { ...s.kept, games: s.kept?.games.length } }));
        check(`${part}${seeded ? ' (kept)' : ''}: nothing on screen, no error but the browser's own network line`, noise(errs).length === 0 && !(await p.evaluate(() => document.getElementById('toast').textContent)).match(/madrid|match|espn/i), noise(errs).slice(0, 3).join(' | '));
        await ctx.close();
      }
    }
    if (want('hidden')) {
      const { ctx, p, net } = await open(b, DESK, '', { espn: gameToday(), hidden: true });
      await p.waitForTimeout(7500);
      check('in a hidden tab nothing is read', (await sceneNow(p)).reads === 0 && net.length === 0);
      await p.evaluate(() => { window.__hide = false; document.dispatchEvent(new Event('visibilitychange')); });
      await p.waitForFunction(() => __matchday.reads === 1 && __matchday.on, null, { timeout: 15000 }).catch(() => {});
      const s = await sceneNow(p);
      check('and it is read when the tab comes back', s.reads === 1 && s.on && net.length === 2, JSON.stringify({ reads: s.reads, on: s.on, net: net.length }));
      await ctx.close();
    }
    if (want('fresh')) {
      const { ctx, p, errs, net } = await open(b, DESK, '', { espn: noGame(), seed: keptToday(H) });
      const first = await sceneNow(p);
      check('a list kept from an hour ago counts at once', first.on && first.name === 'matchday');
      await p.waitForTimeout(7000);
      check('and is not read again for hours', (await sceneNow(p)).reads === 0 && net.length === 0);
      check('fresh: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('pick')) {
      const { ctx, p, errs } = await open(b, DESK, '', { espn: gameToday() });
      await p.waitForFunction(() => __matchday.on, null, { timeout: 15000 }).catch(() => {});
      await p.evaluate(() => __loft.world.scene('chill'));
      await p.evaluate(() => { __loft.world.matchday(true); __loft.world.matchday(false); __loft.world.matchday(true); });
      await p.waitForTimeout(2500);
      const s = await sceneNow(p);
      check('a scene picked by hand wins for the rest of the visit, at once and for good', s.name === 'chill' && !gold(s.rgb) && Math.abs(s.rgb[0] - 0.55) < 0.01 && Math.abs(s.rgb[2] - 1) < 0.01, JSON.stringify({ name: s.name, rgb: s.rgb }));
      check('pick: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    if (want('phonematch')) {
      const { ctx, p, errs } = await open(b, PHONE, '', { espn: gameToday() });
      await p.waitForFunction(() => __matchday.reads === 1 && __matchday.on, null, { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const s = await sceneNow(p);
      check('phone: a match today turns the room white and gold', s.on && s.name === 'matchday' && gold(s.rgb), JSON.stringify({ on: s.on, name: s.name }));
      await standAt(p, 17.5, 3.4, 0.45, Math.PI + 0.35);
      await p.screenshot({ path: path.join(OUT, 'matchday-phone.png') });
      check('phonematch: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- no long frame when the room turns: desktop judged, a phone slowed 4x printed ----------
    for (const [tag, opts, slow] of [['desktop', DESK, 1], ['phone slowed 4x', PHONE, 4]]) {
      if (!want('smooth')) break;
      for (const [what, query, espn] of [['a game day read and the room turned', '&weather=rain', gameToday()]]) {
        const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], net = [];
        watch(p, errs, net);
        await ctx.addInitScript(() => { window.__f = []; let l = performance.now(); const f = n => { window.__f.push([n, n - l]); l = n; requestAnimationFrame(f); }; requestAnimationFrame(f); });
        if (espn) await ctx.route(ESPN, espn);
        await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}${query}`);
        if (slow > 1) await (await ctx.newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate: slow });
        await p.waitForFunction(() => window.__loft && window.__matchday && __loft.renderer.info.render.calls > 0, null, { timeout: 180000 });
        const ready = await p.evaluate(() => performance.now());
        await p.waitForFunction(() => __matchday.on, null, { timeout: 60000 }).catch(() => {});
        await p.waitForTimeout(1500);
        const r = await p.evaluate(at => ({ f: window.__f.filter(([n]) => n > at + 300).map(([, d]) => d), on: __matchday.on }), ready);
        const s = r.f.slice().sort((x, y) => x - y), worst = s.at(-1), p50 = s[Math.floor(s.length / 2)];
        const line = `${s.length} frames, median ${p50?.toFixed(1)} ms, worst ${worst?.toFixed(1)} ms`;
        if (slow > 1) console.log(`${tag}, ${what}: ${line} (printed, not judged)`);
        else check(`${tag}, ${what}: no long frame`, r.on && worst < 50, line);
        check(`${tag}, ${what}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

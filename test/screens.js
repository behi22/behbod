// The desk's little screens, its terminal and the light scenes, in real browsers.
//   LOFT_URL=http://127.0.0.1:8821 node test/screens.js [outdir] [only: history,movie,contrib,net,cam,cost]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/screens';
const ONLY = process.argv[3] || 'all';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const GRAPH = /^https:\/\/behi22\.github\.io\/profile-art\/data\/contrib\.json/;
const CHROME = { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] };

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url()) && !GRAPH.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    // The graph's own failures (made on purpose here) show in the console as the browser's network lines.
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '') && !GRAPH.test(m.location()?.url || '') && !/contrib\.json/.test(m.text())) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]|GL_INVALID/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// A page of the house. `graph`: what the contribution file's address answers (a body, 'fail', or null for the real one).
async function open(b, opts, { q = opts.isMobile ? 'medium' : 'high', graph = 'fail', init = null, ctx = null } = {}) {
  ctx ||= await b.newContext(opts);
  if (init) await ctx.addInitScript(init);
  const asked = [];
  if (graph !== null) await ctx.route(GRAPH, r => { asked.push(performance.now()); return graph === 'fail' ? r.abort('failed') : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof graph === 'string' ? graph : JSON.stringify(graph) }); });
  const p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${q}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  return { ctx, p, errs, asked };
}
const b2t = (x, y, z) => ({ x, y: z, z: -y });

// The contribution file, shaped like the published one: the last 365 days to today and two daily series.
function graphFile() {
  const end = new Date(), start = new Date(end.getTime() - 364 * 86400000), iso = d => d.toISOString().slice(0, 10);
  const days = f => Array.from({ length: 365 }, (_, i) => f(i));
  return { start: iso(start), end: iso(end), personal: days(i => (i % 5 === 0 ? 3 : i % 11 === 0 ? 9 : 0)), other: days(i => (i % 7 === 0 ? 2 : 0)) };
}
const sum = a => a.reduce((t, v) => t + v, 0);
// How many of the graph screen's pixels are each of GitHub's greens, and how many the empty square.
const shades = p => p.evaluate(() => {
  const c = __loft.screens.textures.contrib.image, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const want = { empty: [0x16, 0x1b, 0x22], l1: [0x0e, 0x44, 0x29], l2: [0x00, 0x6d, 0x32], l3: [0x26, 0xa6, 0x41], l4: [0x39, 0xd3, 0x53] }, n = {};
  for (const k in want) n[k] = 0;
  for (let i = 0; i < d.length; i += 4) for (const [k, [r, g, b]] of Object.entries(want)) if (Math.abs(d[i] - r) < 3 && Math.abs(d[i + 1] - g) < 3 && Math.abs(d[i + 2] - b) < 3) n[k]++;
  n.green = n.l1 + n.l2 + n.l3 + n.l4;
  return n;
});

(async () => {
  const L = await import('../web/src/pure/lamps.js');
  const b = await launch(pw.chromium, CHROME);
  try {
    // ---------- Up and Down through earlier commands, at a keyboard and in the phone's command box ----------
    if (want('history')) {
      const { ctx, p, errs } = await open(b, DESK);
      await p.evaluate(() => __loft.useDesk());
      await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 });
      await p.waitForTimeout(500);
      const line = () => p.evaluate(() => ({ input: __loft.screens.desktop.term.input, shown: document.querySelector('.dt-term .in')?.textContent, mode: __loft.mode }));
      const key = async k => { await p.keyboard.press(k); await p.waitForTimeout(80); return (await line()).input; };
      check('nothing entered yet: Up and Down leave the line empty', (await key('ArrowUp')) === '' && (await key('ArrowDown')) === '');
      for (const c of ['whoami', 'ls', 'ls', 'scene focus']) { await p.keyboard.type(c); await p.keyboard.press('Enter'); await p.waitForTimeout(150); }
      await p.keyboard.type('hel');
      const walk = [];
      for (const k of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']) walk.push(await key(k));
      check('Up walks back newest first, once per command even when one was typed twice, and stops at the oldest; Down comes back to the line being typed',
        walk.join('|') === 'scene focus|ls|whoami|whoami|ls|scene focus|hel|hel', walk.join(' | '));
      const shown = await line();
      check('the line shows on the screen as it is typed, and the seat is kept', shown.shown === '$ hel' && shown.mode === 'desk', JSON.stringify(shown));
      await key('ArrowUp'); await key('ArrowUp');
      await p.keyboard.press('Enter'); await p.waitForTimeout(200);
      const ran = await p.evaluate(() => __loft.screens.desktop.term.lines.slice(-2));
      check('a recalled command runs again with Enter', ran[0] === '$ ls', JSON.stringify(ran));
      check('history: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();

      const ph = await open(b, UPRIGHT);
      await ph.p.evaluate(() => __loft.useDesk());
      await ph.p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 });
      await ph.p.waitForTimeout(500);
      await ph.p.fill('#cmd', 'whoami'); await ph.p.press('#cmd', 'Enter'); await ph.p.waitForTimeout(150);
      await ph.p.fill('#cmd', 'contact'); await ph.p.press('#cmd', 'Enter'); await ph.p.waitForTimeout(150);
      await ph.p.fill('#cmd', 'he');
      const box = [];
      for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown']) { await ph.p.press('#cmd', k); box.push(await ph.p.inputValue('#cmd')); }
      check('phone: the command box walks the same way, and gives back what was being typed', box.join('|') === 'contact|whoami|contact|he', box.join(' | '));
      check('history (phone): no error', ph.errs.length === 0, ph.errs.slice(0, 3).join(' | '));
      await ph.ctx.close();
    }

    // ---------- the Movie light scene: with the switch, and with every other scene before and after it ----------
    if (want('movie')) {
      const { ctx, p, errs } = await open(b, DESK);
      // The studio's purple strips: the biggest merged mesh in the chill scene's purple, found at the start.
      await p.evaluate(() => {
        let found = null;
        __loft.scene.traverse(o => { if (o.isMesh && /^merged_/.test(o.name) && o.material.color && Math.abs(o.material.color.r - 0.55 * 3.2) < 1e-6 && Math.abs(o.material.color.b - 3.2) < 1e-6 && (!found || o.geometry.attributes.position.count > found.geometry.attributes.position.count)) found = o; });
        window.__strip = found.material;
        window.__main = __loft.scene.getObjectByName('screen_main').material;
      });
      const state = () => p.evaluate(() => ({ scene: __loft.world.sceneName, movie: __lights.movie, on: __lights.on, room: __lights.uniforms.room.value.toArray(), bulb: __lights.uniforms.bulb.value.x,
        strip: __strip.color.toArray().map(v => +v.toFixed(4)), main: __main.color.toArray(), mainLamp: __main.userData.lamp, day: __loft.out3d?.light.dayK ?? 0 }));
      const settleTo = async (fn, t = 6000) => { await p.waitForFunction(fn, null, { timeout: t }).catch(() => {}); await p.waitForTimeout(150); return state(); };
      const run = async c => { await p.evaluate(c => __loft.screens.run(c, () => {}), c); };
      const scenes = await p.evaluate(() => __loft.world.scenes);
      check('Movie is one of the light scenes', scenes.includes('movie') && scenes.join() === 'chill,focus,matchday,movie,off,party,visualizer', scenes.join(' '));
      const before = await state();
      await run('scene movie');
      const movie = await settleTo(() => __lights.movie === 1);
      const said = await p.evaluate(() => __loft.screens.desktop.term.lines.slice(-1)[0]);
      const r = movie.room, want = L.roomLight(movie.day, 1, 1), dark = L.roomLight(movie.day, 0);
      check('the terminal\'s scene movie: the lamps come down low and warm', said === 'lights: movie' && movie.scene === 'movie' && movie.movie === 1 && r.every((v, i) => Math.abs(v - want[i]) < 0.01 && v < 0.8) && r[0] / r[2] > dark[0] / dark[2] && movie.bulb < 0.6, JSON.stringify({ said, r, bulb: movie.bulb, day: movie.day }));
      check('the LEDs go dim, and the screens keep their glow', movie.strip.join() === [0.16 * 3.2, 0.05 * 3.2, 0.3 * 3.2].map(v => +v.toFixed(4)).join() && movie.main.join() === before.main.join() && movie.mainLamp === 'glow', JSON.stringify({ strip: movie.strip, main: movie.main }));
      await p.evaluate(() => { __loft.pos.set(19.2, 0.05, -1.6); __loft.yaw = -Math.PI / 2; }); await p.waitForTimeout(800);
      await p.screenshot({ path: path.join(OUT, 'movie-desk.png') });
      // The switch is still in charge.
      await p.evaluate(() => __lights.set(false));
      const off = await settleTo(() => __lights.k === 0);
      await run('scene chill');
      const offChill = await settleTo(() => __lights.movie === 0);
      check('with the switch off, Movie or not, the lamps are off alike', off.room.every((v, i) => Math.abs(v - offChill.room[i]) < 1e-9) && off.room.every((v, i) => v < r[i]), JSON.stringify({ off: off.room, offChill: offChill.room }));
      await run('scene movie'); await settleTo(() => __lights.movie === 1);
      await p.evaluate(() => __lights.set(true));
      const back = await settleTo(() => __lights.k === 1);
      check('switched back on in Movie: back to Movie\'s low warm lamps, not full', back.room.every((v, i) => Math.abs(v - r[i]) < 0.02), JSON.stringify({ back: back.room, movie: r }));
      // Every other scene, before and after Movie: each lands exactly as it was, the lamps exactly full.
      const exact = {};
      for (const s of scenes.filter(s => s !== 'movie' && s !== 'party')) { await run('scene ' + s); exact[s] = (await settleTo(() => __lights.movie === 0)).strip.join(); }
      const wrong = [];
      for (const s of scenes.filter(s => s !== 'movie')) {
        await run('scene ' + s); const a = await settleTo(() => __lights.movie === 0);
        await run('scene movie'); const m = await settleTo(() => __lights.movie === 1);
        await run('scene ' + s); const z = await settleTo(() => __lights.movie === 0);
        const full = x => x.room.every(v => v === 1) && x.bulb === 1;
        if (!full(a) || !full(z) || (s !== 'party' && (a.strip.join() !== exact[s] || z.strip.join() !== exact[s])) || m.room.some((v, i) => Math.abs(v - r[i]) > 0.02)) wrong.push(`${s}: ${JSON.stringify({ a: a.room, z: z.room, m: m.room })}`);
      }
      check('every scene before and after Movie: its own strips, the lamps exactly full; Movie the same each time', !wrong.length, wrong.join(' | '));
      // The Settings window's lights row has it too.
      await p.evaluate(() => __loft.useDesk());
      await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 });
      await p.click('.dt-icon[aria-label="Open Settings"]'); await p.waitForTimeout(300);
      await p.click('.dt-win[data-app="settings"] .dt-pill:text-is("movie")');
      const viaSettings = await settleTo(() => __lights.movie === 1);
      await p.waitForTimeout(1200);
      const lit = await p.evaluate(() => [...document.querySelectorAll('.dt-win[data-app="settings"] .dt-pill.on')].map(x => x.textContent));
      check('the Settings lights row has Movie, and it works there too', viaSettings.scene === 'movie' && viaSettings.movie === 1 && lit.includes('movie'), JSON.stringify({ scene: viaSettings.scene, lit }));
      await p.screenshot({ path: path.join(OUT, 'movie-settings.png') });
      check('movie: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();

      const ph = await open(b, UPRIGHT);
      await ph.p.evaluate(() => __loft.screens.run('scene movie', () => {}));
      await ph.p.waitForFunction(() => __lights.movie === 1, null, { timeout: 6000 }).catch(() => {});
      await ph.p.screenshot({ path: path.join(OUT, 'movie-phone.png') });
      await ph.p.evaluate(() => __lights.set(false)); await ph.p.waitForTimeout(800);
      await ph.p.screenshot({ path: path.join(OUT, 'movie-phone-off.png') });
      check('phone: Movie works there too', await ph.p.evaluate(() => __lights.movie === 1), '');
      check('movie (phone): no error', ph.errs.length === 0, ph.errs.slice(0, 3).join(' | '));
      await ph.ctx.close();
    }

    // ---------- his live contribution graph: good, failed and bad answers, kept between visits, never read at startup ----------
    if (want('contrib')) {
      const file = graphFile(), total = sum(file.personal) + sum(file.other);
      // A fresh visitor, the file answering well: nothing is read while the house starts; once it has settled, one read.
      {
        const { ctx, p, errs, asked } = await open(b, DESK, { graph: file });
        const early = asked.length, first = await p.evaluate(() => __loft.screens.contrib.state);
        await p.waitForFunction(() => __loft.screens.contrib.state === 'live', null, { timeout: 20000 }).catch(() => {});
        const s = await p.evaluate(() => ({ state: __loft.screens.contrib.state, total: __loft.screens.contrib.total, kept: localStorage.getItem('home.contrib') }));
        const n = await shades(p), kept = JSON.parse(s.kept || '{}');
        check('nothing is read while the house starts; once it settles, one read', early === 0 && first === 'waiting' && asked.length === 1, `${early} early, ${asked.length} in all, first ${first}`);
        check('the live graph: both series added up, drawn in GitHub\'s greens, the total on top', s.state === 'live' && s.total === total && n.green > 2000 && n.l4 > 0 && n.empty > 0, JSON.stringify({ ...s, kept: undefined, n }));
        check('the copy kept in the browser holds only the added-up days', Object.keys(kept).sort().join() === 'at,days,start' && kept.days.length === 365 && sum(kept.days) === total);
        await p.evaluate(() => { __loft.pos.set(19.4, 0.05, -1.0); __loft.yaw = -Math.PI / 2; }); await p.waitForTimeout(900);
        await p.screenshot({ path: path.join(OUT, 'graph-desk.png') });
        check('contrib (good): no error', errs.length === 0, errs.slice(0, 3).join(' | '));
        await p.close();
        // The same visitor again with the file out of reach: the kept copy shows straight away and stays.
        const again = await open(b, DESK, { graph: 'fail', ctx });
        const a0 = await again.p.evaluate(() => __loft.screens.contrib.state), a1 = await again.p.evaluate(() => __loft.screens.contrib.refresh());
        const an = await shades(again.p);
        check('back again with the file out of reach: the kept copy, at once and after the failed read', a0 === 'saved' && a1 === 'saved' && an.green > 2000 && (await again.p.evaluate(() => __loft.screens.contrib.total)) === total, `${a0} ${a1} green ${an.green}`);
        // A bad file does not replace it either.
        await ctx.unroute(GRAPH);
        await ctx.route(GRAPH, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"start":"2025-11-21","personal":[1,2,3],"other":[1]}' }));
        const a2 = await again.p.evaluate(() => __loft.screens.contrib.refresh());
        check('a file of the wrong shape changes nothing', a2 === 'saved' && (await again.p.evaluate(() => __loft.screens.contrib.total)) === total, a2);
        check('contrib (kept): no error', again.errs.length === 0, again.errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
      // A fresh visitor and nothing loads: failed, broken text, wrong shape, a server error. Never made-up squares.
      for (const [what, graph] of [['out of reach', 'fail'], ['broken text', '{"start": "2025-11-21", "personal": [1, 2'], ['the wrong shape', { start: 'today', personal: [1, 2, 3] }], ['a server error', 500]]) {
        const ctx = await b.newContext(DESK);
        if (graph === 500) await ctx.route(GRAPH, r => r.fulfill({ status: 500, body: 'oops' }));
        const { p, errs } = await open(b, DESK, { graph: graph === 500 ? null : graph, ctx });
        const st = await p.evaluate(() => __loft.screens.contrib.refresh());
        const n = await shades(p), said = await p.evaluate(() => localStorage.getItem('home.contrib'));
        check(`nothing ever loaded, ${what}: a plain empty graph that says it could not load`, st === 'none' && n.green === 0 && n.empty > 2000 && said === null, JSON.stringify({ st, n, said }));
        if (what === 'out of reach') { await p.evaluate(() => { __loft.pos.set(19.4, 0.05, -1.0); __loft.yaw = -Math.PI / 2; }); await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, 'graph-empty.png') }); }
        check(`contrib (${what}): no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
      // Phones, lamps off.
      const ph = await open(b, UPRIGHT, { graph: file });
      check('phone: the live graph', (await ph.p.evaluate(() => __loft.screens.contrib.refresh())) === 'live');
      check('contrib (phone): no error', ph.errs.length === 0, ph.errs.slice(0, 3).join(' | '));
      await ph.ctx.close();
    }

    // ---------- the real file, from the page, in Chrome, Firefox and WebKit: its CORS header and the page's CSP allow it ----------
    if (want('net')) {
      for (const [name, type, opts] of [['chrome', pw.chromium, CHROME], ['firefox', pw.firefox, {}], ['webkit', pw.webkit, {}]]) {
        const bb = name === 'chrome' ? b : await launch(type, opts);
        const { ctx, p, errs } = await open(bb, DESK, { q: 'low', graph: null });
        const r = await p.evaluate(async () => {
          const res = await fetch('https://behi22.github.io/profile-art/data/contrib.json', { credentials: 'omit' });
          const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '';
          return { ok: res.ok, type: res.type, csp, state: await __loft.screens.contrib.refresh(), total: __loft.screens.contrib.total };
        }).catch(e => ({ error: e.message }));
        // A readable 'cors' answer means its Access-Control-Allow-Origin let this page in (the header itself is hidden from scripts).
        check(`${name}: the real file reads from the page (a ${r.type} answer; the CSP limits frames only) and draws live`, r.ok && r.type === 'cors' && /frame-src/.test(r.csp) && !/connect-src|default-src/.test(r.csp) && r.state === 'live' && r.total > 0, JSON.stringify({ ...r, csp: r.csp?.slice(0, 40) }));
        check(`${name}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
        await ctx.close();
        if (bb !== b) await bb.close();
      }
    }
    // ---------- the Pishi cam: where she really is and what she is doing, drawn small, a few times a second, only in sight ----------
    if (want('cam')) {
      const { ctx, p, errs } = await open(b, DESK);
      const cam = () => p.evaluate(() => ({ live: __pishiCam.live, cam: __pishiCam.cam, shots: __pishiCam.shots, caption: __pishiCam.caption, map: __loft.scene.getObjectByName('screen_pishi').material.map === __pishiCam.target.texture }));
      // By the desk, facing the little screens.
      const atDesk = async () => { await p.evaluate(() => { __loft.pos.set(19.5, 0.05, -1.3); __loft.yaw = -Math.PI / 2; }); await p.waitForTimeout(1500); };
      await atDesk();
      const a = await cam(); await p.waitForTimeout(2000); const z = await cam();
      check('by the desk the cam is live on the little screen, about six pictures a second', a.live && z.map && z.shots - a.shots >= 9 && z.shots - a.shots <= 14, JSON.stringify({ a, z }));
      await p.evaluate(() => { __loft.yaw = Math.PI / 2; }); await p.waitForTimeout(1200);
      const t0 = await cam(); await p.waitForTimeout(1500); const t1 = await cam();
      await p.evaluate(() => { __loft.pos.set(7, 0.05, -10.2); }); await p.waitForTimeout(1500);
      const f0 = await cam(); await p.waitForTimeout(1500); const f1 = await cam();
      check('turned away, or across the house, it draws nothing', t1.shots === t0.shots && f1.shots === f0.shots, JSON.stringify({ t0: t0.shots, t1: t1.shots, f0: f0.shots, f1: f1.shots }));
      await atDesk();
      // Pishi put at each place she goes: the camera that sees her, her in the middle of its picture with nothing in between,
      // the picture lit, and the right words. Her last place is the keyboard, with me sitting at the desk, as when she walks on it.
      // Graphics programs built inside the cam's own draws are counted (the house builds others of its own as it loads).
      await p.evaluate(() => {
        const R = __loft.renderer, render = R.render;
        window.__camBuilt = 0;
        R.render = function (s, c) { if (c !== __pishiCam.eye) return render.call(this, s, c); const n = R.info.programs.length, r = render.call(this, s, c); __camBuilt += R.info.programs.length - n; return r; };
      });
      const places = [['window sill', 'window', [5.4, 14.7, 0.53], 'watching outside'], ['cat tree', 'treesit', [0.88, 14.2, 1.225], 'hiding up high'], ['perch by the fire', 'perch', [0.7, 10.6, 3.08], 'asleep'],
        ['lounge', 'sit', [7, 10.2, -0.45], 'sitting'], ['lounge', 'sit', [3.0, 13.0, 0], 'sitting'], ['tea bar', 'sit', [11.5, 11.0, 0], 'sitting'],
        ['tea bar', 'sit', [10.6, 11.6, 0], 'sitting'], ['hall', 'sit', [6.6, 6.4, 0], 'sitting'], ['tea bar', 'sit', [14.0, 10.5, 0], 'sitting'],
        ['desk', 'keys', 'keyboard', 'walking on the keyboard']];
      for (const [where, state, at, doing] of places) {
        if (at === 'keyboard') { await p.evaluate(() => __loft.useDesk()); await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 }); await p.waitForTimeout(800); }
        const r = await p.evaluate(async ([state, at]) => {
          const THREE = await import('three');
          const c = __loft.creatures.pishi;
          if (at === 'keyboard') {
            const box = new THREE.Box3();
            for (const o of __loft.world.deskThings) if (/^kb_/.test(o.name)) box.expandByObject(o);
            at = [(box.min.x + box.max.x) / 2, -(box.min.z + 0.1), box.max.y + 0.005];
          }
          c.route = []; c.hop = null; c.then = null; c.pending = null; c.epoch++; c.moving = false; c.groomUntil = 0;
          c.pos.set(at[0], at[2], -at[1]); c.state = state; c.timer = 999; c.keyAt = 999; c.onFloor = false;
          await new Promise(r => setTimeout(r, 900));
          c.groomUntil = 0;
          await new Promise(r => setTimeout(r, 400));
          const eye = __pishiCam.eye, her = c.pos.clone().setY(c.pos.y + 0.16), v = her.clone().project(eye);
          const ray = new THREE.Raycaster(eye.position, her.clone().sub(eye.position).normalize(), 0.05, eye.position.distanceTo(her) + 0.3);
          ray.camera = eye;
          // The mirrors and this screen are not drawn in the cam's picture, so they hide nothing.
          const hit = ray.intersectObjects(__loft.scene.children, true).find(h => h.object.visible && !h.object.isReflector && h.object.name !== 'screen_pishi' && !h.object.isSprite && !h.object.isPoints && !h.object.isLine && !(h.object.material?.transparent && h.object.material.opacity < 0.5));
          let mine = false;
          for (let o = hit?.object; o; o = o.parent) if (o === c.root) mine = true;
          const R = __loft.renderer, rt = __pishiCam.target, buf = new Uint16Array(rt.width * rt.height * 4);
          R.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
          const h2f = h => { const e = (h >> 10) & 31, f = h & 1023; return e === 0 ? 2 ** -14 * f / 1024 : e === 31 ? 0 : 2 ** (e - 15) * (1 + f / 1024); };
          let lum = 0;
          for (let i = 0; i < buf.length; i += 4) lum += 0.2126 * h2f(buf[i]) + 0.7152 * h2f(buf[i + 1]) + 0.0722 * h2f(buf[i + 2]);
          return { at: at.map(n => +n.toFixed(2)), cam: __pishiCam.cam, live: __pishiCam.live, x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: v.z, mine, hit: hit?.object.name, lum: +(lum / (buf.length / 4)).toFixed(3), caption: __pishiCam.caption };
        }, [state, at]);
        check(`Pishi at ${r.at.join(',')}: CAM 0${r.cam} has her in the middle with nothing in between, the picture lit, and says "${where} · ${doing}"`,
          r.live && Math.abs(r.x) < 0.35 && Math.abs(r.y) < 0.45 && r.z < 1 && r.mine && r.lum > 0.01 && r.caption === `${where} · ${doing}`, JSON.stringify(r));
      }
      await p.evaluate(() => __loft.leaveDesk()); await p.waitForTimeout(1500);
      await atDesk();
      const built = await p.evaluate(() => __camBuilt);
      check('its pictures build no graphics programs of their own (no stall when it first looks somewhere new)', built === 0, String(built));
      // While it draws: the mirrors are not drawn again inside it, and the veiled head never shows in it.
      const hook = await p.evaluate(async () => {
        const L = __loft, R = L.renderer, me = L.me, render = R.render, seen = { calls: 0, refl: 0, me: 0 };
        if (!me.mosaicUnlocked) me.unlockMosaic();
        for (let i = 0; i < 8 && L.head !== 'mosaic'; i++) L.nextHead();
        R.render = function (s, c) { if (c === __pishiCam.eye) { seen.calls++; if (s.children.some(o => o.isReflector && o.visible)) seen.refl++; if (me.root.visible) seen.me++; } return render.call(this, s, c); };
        const c = L.creatures.pishi;
        c.pos.set(L.pos.x + 0.6, L.pos.y, L.pos.z + 0.3); c.state = 'sit';
        await new Promise(r => setTimeout(r, 1500));
        R.render = render;
        return { ...seen, head: L.head, after: me.root.visible };
      });
      check('inside its picture the mirrors are not drawn again and the veiled head is hidden; both are back after', hook.calls > 3 && hook.refl === 0 && hook.me === 0 && hook.head === 'mosaic' && hook.after, JSON.stringify(hook));
      await p.screenshot({ path: path.join(OUT, 'cam-desk.png') });
      check('cam: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
      // The lowest quality draws without effects: the same words, no picture, nothing drawn again.
      const low = await open(b, DESK, { q: 'low' });
      await low.p.evaluate(() => { __loft.pos.set(19.5, 0.05, -1.3); __loft.yaw = -Math.PI / 2; }); await low.p.waitForTimeout(2000);
      const lr = await low.p.evaluate(() => {
        const c = __loft.screens.textures.pishi.image, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        return { live: __pishiCam.live, shots: __pishiCam.shots, canvas: __loft.scene.getObjectByName('screen_pishi').material.map === __loft.screens.textures.pishi, opaque: d[3 + 4 * (c.width * 100 + 160)] === 255, caption: __pishiCam.caption, cam: __pishiCam.cam };
      });
      check('lowest quality: the screen shows where she is and what she is doing in words, and nothing is drawn again', !lr.live && lr.shots === 0 && lr.canvas && lr.opaque && /·/.test(lr.caption) && lr.cam > 0, JSON.stringify(lr));
      check('cam (low): no error', low.errs.length === 0, low.errs.slice(0, 3).join(' | '));
      await low.ctx.close();
      // A phone: fewer pictures a second.
      const ph = await open(b, UPRIGHT);
      await ph.p.evaluate(() => { __loft.pos.set(19.5, 0.05, -1.3); __loft.yaw = -Math.PI / 2; }); await ph.p.waitForTimeout(2500);
      const p0 = await ph.p.evaluate(() => __pishiCam.shots); await ph.p.waitForTimeout(2000); const p1 = await ph.p.evaluate(() => ({ shots: __pishiCam.shots, live: __pishiCam.live }));
      check('phone: live, about four pictures a second', p1.live && p1.shots - p0 >= 5 && p1.shots - p0 <= 10, JSON.stringify({ p0, p1 }));
      await ph.p.screenshot({ path: path.join(OUT, 'cam-phone.png') });
      check('cam (phone): no error', ph.errs.length === 0, ph.errs.slice(0, 3).join(' | '));
      await ph.ctx.close();
    }

    // ---------- what the cam costs: frame times by the desk with it and without, taken in turns (under the timing lock) ----------
    if (want('cost')) {
      const { ctx, p, errs } = await open(b, DESK);
      // Measured once the house is done with its own start-up work (the graph's first read, the range built behind the scenes).
      await p.evaluate(() => { __loft.pos.set(19.5, 0.05, -1.3); __loft.yaw = -Math.PI / 2; }); await p.waitForTimeout(25000);
      const run = on => p.evaluate(on => new Promise(done => {
        __pishiCam.enabled = on;
        const ts = [], s0 = __pishiCam.shots;
        let last = 0;
        const rec = t => { if (last) ts.push(t - last); last = t; if (ts.length < 600) requestAnimationFrame(rec); else done({ ts, shots: __pishiCam.shots - s0 }); };
        setTimeout(() => requestAnimationFrame(rec), 500);
      }), on);
      const all = { on: [], off: [] }, shots = [];
      for (let i = 0; i < 4; i++) for (const on of i % 2 ? [false, true] : [true, false]) { const r = await run(on); all[on ? 'on' : 'off'].push(...r.ts); if (on) shots.push(r.shots); }
      await p.evaluate(() => { __pishiCam.enabled = true; });
      const stat = a => { const s = [...a].sort((x, y) => x - y), q = f => +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(2); return { n: s.length, med: q(0.5), p95: q(0.95), p99: q(0.99), max: +s.at(-1).toFixed(1), long: s.filter(x => x > 25).length }; };
      const on = stat(all.on), off = stat(all.off);
      console.log(`  cost: with the cam ${JSON.stringify(on)}; without ${JSON.stringify(off)}; pictures per run ${shots.join(' ')}`);
      check('the cam adds no stutter: the same frame times with it and without, and no more long frames', on.med <= off.med + 0.5 && on.p99 <= off.p99 + 2 && on.long <= off.long + 2 && shots.every(n => n > 20), JSON.stringify({ on, off }));
      check('cost: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

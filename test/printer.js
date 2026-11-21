// The 3D printer in a real Chrome: its screen, its prints, its sound, typing to it, at a computer and on phones.
//   LOFT_URL=http://127.0.0.1:8815 node test/printer.js [outdir] [only: screen,hum,keep,terminal,words,phone,side,click,smooth,fail,keys,fallback]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/printer';
const ONLY = process.argv[3] || 'all';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const SPOT = [20.72, 3.58, 0.45], DESK_AT = [19.6, 1.2, 0.45], FAR = [6.0, 9.0, 0.45];

// Everything that reaches the speakers also goes to an analyser, so a muted test page can still be listened to.
function tap() {
  const conn = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (to, ...rest) {
    if (typeof AudioDestinationNode !== 'undefined' && to instanceof AudioDestinationNode && !to.context.__ear) {
      to.context.__ear = to.context.createAnalyser(); to.context.__ear.fftSize = 4096; window.__ear = to.context.__ear;
    }
    if (typeof AudioDestinationNode !== 'undefined' && to instanceof AudioDestinationNode) conn.call(this, to.context.__ear);
    return conn.call(this, to, ...rest);
  };
}
function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!OUTSIDE.test(r.url()) && !/run\.mp3|\.mp4/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// The printer's worker fails the next print it is sent while window.__failNext is set, then works as before.
function failOnce() {
  const Real = window.Worker;
  if (!Real) return;
  window.Worker = class extends Real {
    postMessage(m, ...rest) {
      if (!(window.__failNext && m && m.print)) return super.postMessage(m, ...rest);
      window.__failNext = false;
      setTimeout(() => this.onmessage?.({ data: { id: m.id, error: 'a failure forced by the test' } }), 50);
    }
  };
}
async function open(b, opts, { auto = true, save, ear = false, init = null, route = null } = {}) {
  const ctx = await b.newContext(opts);
  if (ear) await ctx.addInitScript(tap);
  if (init) await ctx.addInitScript(init);
  if (route) await ctx.route(...route);
  if (save !== undefined) await ctx.addInitScript(s => { try { if (s === null) localStorage.removeItem('home.print'); else localStorage.setItem('home.print', s); } catch { /* none */ } }, save);
  const p = await ctx.newPage(), errs = [], asked = [];
  watch(p, errs);
  p.on('request', r => { const m = r.url().match(/\/src\/(.+\.js)(\?|$)/); if (m) asked.push(m[1]); });
  await p.goto(`${BASE}/?${auto ? 'auto&' : ''}q=${opts.isMobile ? 'medium' : 'high'}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0 && (document.getElementById('enter').classList.contains('ready')), null, { timeout: 120000 });
  if (!auto) { await p.click('#enter'); }
  await p.waitForTimeout(800);
  return { ctx, p, errs, asked };
}
async function standAt(p, at, yaw) {
  await p.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); if (yw !== undefined) __loft.yaw = yw; }, [b2t(...at), yaw]);
  await p.waitForTimeout(500);
}
const facePrinter = p => p.evaluate(() => { const P = __loft.meta.points.printer; __loft.yaw = Math.atan2(-(P[0] - __loft.pos.x), -(-P[1] - __loft.pos.z)); });
const state = p => p.evaluate(() => { const r = __loft.printer; return { print: r.print, k: r.progress, heating: r.heating, mine: r.mine, sounding: r.sounding, built: r.built, failed: r.failed, mode: __loft.mode }; });
const untilBuilt = p => p.waitForFunction(() => __loft.printer.built, null, { timeout: 40000 }).catch(() => {});
const untilDone = p => p.waitForFunction(() => __loft.printer.progress === 1 && __loft.printer.built, null, { timeout: 60000 }).catch(() => {});
// The print's middle on the screen, and what of the page is on top of it there.
const printOnScreen = p => p.evaluate(() => {
  const L = __loft, b = L.printer.built, c = L.printer.group.getWorldPosition(L.camera.position.clone());
  c.y += b ? b.height / 2 : 0.07;
  c.project(L.camera);
  const x = (c.x + 1) / 2 * innerWidth, y = (1 - c.y) / 2 * innerHeight, top = document.elementFromPoint(x, y);
  return { x: Math.round(x), y: Math.round(y), z: +c.z.toFixed(3), top: top ? top.tagName : null };
});
// The house's sound level over about a second, in dB.
const level = p => p.evaluate(async () => {
  const an = window.__ear, buf = new Float32Array(an.fftSize);
  let s = 0, n = 0;
  for (let k = 0; k < 12; k++) { an.getFloatTimeDomainData(buf); for (const v of buf) s += v * v; n += buf.length; await new Promise(r => setTimeout(r, 90)); }
  return +(10 * Math.log10(s / n + 1e-12)).toFixed(1);
});
// The gaps between frames while run() runs: how many, the median and the worst, in ms.
async function frameGaps(p, run) {
  await p.evaluate(() => { const gaps = window.__gaps = []; let last = performance.now(); const f = t => { if (window.__gaps !== gaps) return; gaps.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await run();
  return p.evaluate(() => { const a = __gaps.slice(2); window.__gaps = null; a.sort((x, y) => x - y); return { n: a.length, median: +a[a.length >> 1].toFixed(1), worst: +a[a.length - 1].toFixed(1) }; });
}
const termLines = p => p.evaluate(() => __loft.screens.desktop.term.lines.slice());
const sit = async p => { await p.evaluate(() => __loft.useDesk()); await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 }); await p.waitForTimeout(700); };
const type = async (p, text) => { await p.keyboard.type(text); await p.keyboard.press('Enter'); await p.waitForTimeout(150); };
const lineAfter = (lines, cmd) => lines[lines.lastIndexOf('$ ' + cmd) + 1] || '';

(async () => {
  const P = await import('../web/src/pure/printer.js');
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  try {
    // ---------- E opens the screen; a model, a colour and a size picked, then Print ----------
    if (want('screen')) {
      const { ctx, p, errs, asked } = await open(b, DESK, { save: null });
      // Only the printer and the words it answers to load with the page; its shapes load in the worker, and the page's own builder never unless needed.
      const LATER = /^(printpage|printwork|printscreen)\.js$|^pure\/(printbuild|mesher|keychain|models|sdf)\.js$/;
      check('the printer\'s shapes, its builder and its screen are not fetched with the page', asked.length > 20 && !asked.some(f => LATER.test(f)), asked.filter(f => /print|pure\/(mesher|keychain|models|sdf|catalog|letters)/.test(f)).join(' '));
      const pics = [];
      p.on('response', r => { if (/assets\/printer\//.test(r.url())) pics.push(`${r.status()} ${r.url().split('/').pop()}`); });
      check('nothing of the printer is built or fetched at the start', !(await p.evaluate(() => __loft.printer.built)) && pics.length === 0, JSON.stringify(pics));
      await standAt(p, SPOT); await facePrinter(p);
      const near = await p.evaluate(() => [__loft.near, document.getElementById('prompt').textContent]);
      check('at the printer, E is offered', near[0] === 'printer' && /Print something/.test(near[1]), near.join(' | '));
      await untilBuilt(p);
      const idle = await state(p);
      check('with nothing printed yet, the default rocket is part way through and silent', !idle.mine && idle.print.model === 'rocket' && idle.k > 0 && idle.k < 1 && !idle.sounding && idle.built?.tris > 1000, JSON.stringify({ k: idle.k, s: idle.sounding, b: idle.built }));
      const ready = asked.includes('printscreen.js');
      await p.keyboard.press('KeyE');
      await p.waitForSelector('.pn-printer .ps-grid', { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(1500);
      check('the screen\'s code is already here when it opens, fetched on the way to the printer', ready, asked.filter(f => /print/.test(f)).join(' '));
      const scr = await p.evaluate(() => ({
        mode: __loft.mode, tiles: document.querySelectorAll('.ps-tile').length, swatches: document.querySelectorAll('.ps-sw').length, prompt: document.getElementById('prompt').classList.contains('on'),
        cam: __loft.camera.position.distanceTo(__loft.printer.group.position), me: __loft.headVisible, focus: document.activeElement?.closest('.ps-type') ? 'type' : document.activeElement?.tagName,
      }));
      check('E opens the touch screen: every model, a keychain, every colour, the camera at the printer', scr.mode === 'printer' && scr.tiles === P.SHOWN.length + 1 && scr.swatches === P.SWATCHES.length && !scr.prompt && scr.cam < 1.2 && scr.focus === 'type', JSON.stringify(scr));
      // Counted before the test loads the sheet itself to measure it: the test server marks every file no-store, so the
      // browser may fetch the test's own copy again, and that one is not the page's.
      const fetched = pics.slice();
      const sheet = await p.evaluate(async () => { const i = new Image(); i.src = 'assets/printer/models.webp'; await i.decode(); return [i.naturalWidth, i.naturalHeight]; });
      check('the model pictures arrive when the screen opens, one sheet', fetched.length === 1 && /^200 models\.webp/.test(fetched[0]) && sheet[0] === 6 * 128, `${fetched.join()} ${sheet}`);
      const seen = await printOnScreen(p);
      check('the print is in view beside the screen, nothing over it', seen.z < 1 && seen.x > 0 && seen.x < 1280 * 0.68 && seen.y > 0 && seen.y < 800 && seen.top === 'CANVAS', JSON.stringify(seen));
      await p.screenshot({ path: path.join(OUT, 'screen-open.png') });
      await p.click('.ps-tile >> text=little Pishi');
      await p.click('.ps-sw[aria-label="purple"]');
      await p.$eval('.ps-size input', el => { el.value = '130'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      const label = await p.textContent('.ps-print');
      check('the Print button says what it will print', label === 'Print a purple little Pishi', label);
      await p.click('.ps-print');
      await p.waitForTimeout(200);
      const warm = await state(p);
      check('Print starts it: the bed clears and the nozzle warms up', warm.mine && warm.heating && warm.k === 0 && warm.print.model === 'pishi' && warm.print.colour === 'purple' && Math.abs(warm.print.size - 1.3) < 1e-9, JSON.stringify({ ...warm, built: !!warm.built }));
      const headRest = await p.evaluate(() => __loft.world.printParts.head.position.toArray());
      await p.waitForFunction(() => __loft.printer.progress > 0.4, null, { timeout: 30000 }).catch(() => {});
      const mid = await p.evaluate(() => ({ k: __loft.printer.progress, head: __loft.world.printParts.head.position.toArray(), cut: __loft.printer.mesh.material.clippingPlanes[0].constant - __loft.printer.group.position.y, h: __loft.printer.built.height, status: document.querySelector('.ps-status').textContent }));
      const moved = Math.hypot(...mid.head.map((v, i) => v - headRest[i]));
      check('it prints a layer at a time, the head moving, the screen counting', mid.k > 0.4 && mid.k < 0.9 && mid.cut > 0.25 * mid.h && mid.cut < 0.95 * mid.h && moved > 0.02 && /Printing a purple little Pishi: \d+%/.test(mid.status), JSON.stringify({ ...mid, moved }));
      await p.screenshot({ path: path.join(OUT, 'screen-mid.png') });
      await untilDone(p);
      await p.waitForTimeout(400);
      const done = await p.evaluate(() => ({ k: __loft.printer.progress, cut: __loft.printer.mesh.material.clippingPlanes[0].constant - __loft.printer.group.position.y, status: document.querySelector('.ps-status').textContent, saved: JSON.parse(localStorage.getItem('home.print') || 'null') }));
      check('then it is done, whole, and kept', done.k === 1 && done.cut > 1 && /^Done: a purple little Pishi/.test(done.status) && done.saved?.model === 'pishi' && done.saved?.colour === 'purple', JSON.stringify(done));
      await p.screenshot({ path: path.join(OUT, 'screen-done.png') });
      // Typing at the screen works as at the terminal.
      await p.click('.ps-type input');
      await p.keyboard.type('taller red twist'); await p.keyboard.press('Enter');
      await p.waitForTimeout(200);
      const typed = await p.evaluate(() => ({ print: __loft.printer.print, said: document.querySelector('.pn-said').textContent, swatch: document.querySelector('.ps-sw[aria-pressed="true"]')?.ariaLabel }));
      check('typing to the screen adjusts the print', typed.print.model === 'pishi' && typed.print.colour === 'red' && typed.print.height > 1.2 && typed.print.twist > 0 && /^Reprinting the little Pishi, taller, twist in red\.$/.test(typed.said) && typed.swatch === 'red', JSON.stringify(typed));
      await untilDone(p);
      // A model picked on the screen comes out as its picture and as typed, with its own number of teeth or points.
      const picked = [];
      for (const id of ['gear', 'star', 'crown']) {
        await p.click(`.ps-tile >> text=${P.nameOf({ model: id })}`); await p.click('.ps-print');
        picked.push([id, (await state(p)).print.sides, P.parsePrint(id).p.sides]);
      }
      check('a gear, a star and a crown picked on the screen have their own teeth and points', picked.every(([, s, typedSides]) => s === typedSides), JSON.stringify(picked));
      await untilDone(p);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(1200);
      const back = await p.evaluate(() => ({ mode: __loft.mode, panel: !!document.querySelector('.pn'), me: __loft.headVisible, prompt: document.getElementById('prompt').classList.contains('on') }));
      check('Esc closes it and I am back on my feet at the printer', back.mode === 'walk' && !back.panel && back.me && back.prompt, JSON.stringify(back));
      check('the page\'s own builder is never fetched while the worker builds', !asked.includes('printpage.js'), asked.filter(f => /print/.test(f)).join(' '));
      check('the screen: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the hum: only while a print runs ----------
    if (want('hum')) {
      const { ctx, p, errs } = await open(b, DESK, { auto: false, ear: true, save: null });
      await standAt(p, DESK_AT); await facePrinter(p);
      await p.waitForTimeout(2500);
      const idle = await level(p), idleState = await state(p);
      // Whatever the printer might be playing is stopped, to hear the room without it.
      await p.evaluate(() => __loft.audio.sfx.printer(false));
      await p.waitForTimeout(1500);
      const room = await level(p);
      check('at the desk with nothing printing, the printer makes no sound', !idleState.sounding && Math.abs(idle - room) < 1.0, `idle ${idle} dB, room without the printer ${room} dB`);
      await p.evaluate(() => __loft.printer.ask('rocket'));
      await p.waitForFunction(() => __loft.printer.progress > 0.2, null, { timeout: 30000 }).catch(() => {});
      const busy = await level(p), busyState = await state(p);
      check('while it prints, it is heard at the desk, but not over the room', busyState.sounding && busy > room + 0.5 && busy < room + 6, `printing ${busy} dB against the room ${room} dB`);
      await standAt(p, SPOT); await facePrinter(p);
      const close = await level(p);
      check('beside it, it is louder than at the desk', close > busy, `beside it ${close} dB, at the desk ${busy} dB`);
      await untilDone(p);
      await p.waitForTimeout(1800);
      const after = await level(p), afterState = await state(p);
      check('when the print is done, the sound stops', !afterState.sounding && Math.abs(after - room) < 1.0, `after ${after} dB, room ${room} dB`);
      check('the hum: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- walking away keeps the print; with none, a default mid-build ----------
    if (want('keep')) {
      const saved = JSON.stringify({ ...P.DEFAULT, model: 'skull', colour: 'green', size: 1 });
      const { ctx, p, errs } = await open(b, DESK, { save: saved });
      await standAt(p, FAR);
      const far = await state(p);
      check('far away, nothing is built yet', !far.built, JSON.stringify(far.built));
      await standAt(p, SPOT); await untilBuilt(p); await p.waitForTimeout(300);
      const near = await state(p);
      check('my last print is there when I come back, finished and silent', near.mine && near.print.model === 'skull' && near.print.colour === 'green' && near.k === 1 && !near.sounding && near.built?.tris > 1000, JSON.stringify(near));
      await facePrinter(p); await p.waitForTimeout(800);
      await p.screenshot({ path: path.join(OUT, 'keep-skull.png') });
      await p.evaluate(() => __loft.printer.ask('car'));
      await p.waitForFunction(() => __loft.printer.progress > 0.3, null, { timeout: 30000 }).catch(() => {});
      await standAt(p, FAR);
      await untilDone(p);
      const away = await state(p);
      check('a print started and walked away from still finishes, and is kept', away.k === 1 && away.print.model === 'car' && !away.sounding, JSON.stringify(away));
      await ctx.close();
      const fresh = await open(b, DESK, { save: '{"edge":"star","sides":5,"depth":0.5,"height":0.35,"colour":"teal","name":"star"}' });
      await standAt(fresh.p, SPOT); await untilBuilt(fresh.p);
      const old = await state(fresh.p);
      check('a print saved before the models comes back as its model', old.print.model === 'star' && old.print.colour === 'teal' && old.k === 1, JSON.stringify(old.print));
      await fresh.ctx.close();
      check('keep: no error', errs.length === 0 && fresh.errs.length === 0, [...errs, ...fresh.errs].slice(0, 3).join(' | '));
    }
    // ---------- typing at the desk's terminal ----------
    if (want('terminal')) {
      const { ctx, p, errs } = await open(b, DESK, { save: null });
      await sit(p);
      await type(p, 'print rocket taller red');
      let lines = await termLines(p), s = await state(p);
      check('print rocket taller red', lineAfter(lines, 'print rocket taller red') === 'printing a red rocket.' && s.print.model === 'rocket' && s.print.colour === 'red' && Math.abs(s.print.height - 1.25) < 1e-9 && s.mine, `${lineAfter(lines, 'print rocket taller red')} ${JSON.stringify(s.print)}`);
      await type(p, 'print more fins');
      lines = await termLines(p); s = await state(p);
      check('then more fins', lineAfter(lines, 'print more fins') === 'reprinting the rocket with 5 fins.' && s.print.sides === 5, lineAfter(lines, 'print more fins'));
      await type(p, 'print "hello world"');
      lines = await termLines(p); s = await state(p);
      const found = await p.evaluate(() => window.__hello?.found || []);
      check('print "hello world" goes to the printer, as a keychain', lineAfter(lines, 'print "hello world"') === `printing ${P.describe(s.print)}.`.toLowerCase() && s.print.model === 'word' && s.print.text === 'hello world' && !found.includes('terminal'), `${lineAfter(lines, 'print "hello world"')} ${JSON.stringify(found)}`);
      await type(p, 'print');
      lines = await termLines(p);
      const help = lines.slice(lines.lastIndexOf('$ print') + 1);
      check('print on its own says what it makes, in lines that fit', help.length === 3 && /^print <model>/.test(help[0]) && help.every(l => l.length <= 66), help.join(' / '));
      await type(p, 'print ""');
      lines = await termLines(p);
      check('an empty print asks again, calmly', lineAfter(lines, 'print ""').startsWith('print <model>'), lineAfter(lines, 'print ""'));
      await untilDone(p);
      check('the terminal: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- any word on a keychain: long, numbers, marks, other scripts ----------
    if (want('words')) {
      const { ctx, p, errs } = await open(b, DESK, { save: null });
      await standAt(p, SPOT); await facePrinter(p);
      // With the screen open, so the pictures show the keychains from the screen's camera.
      await p.evaluate(() => __loft.act('printer'));
      for (const [typed, text] of [['Behbod', 'Behbod'], ['سلام دنیا', 'سلام دنیا'], ['2026', '2026'], ['<3', '<3'], ['a really really long name for a keychain here', 'really really long name'], ['Ünïcödé 東京', 'Ünïcödé 東京']]) {
        const said = await p.evaluate(t => __loft.printer.ask(t), typed);
        await untilDone(p);
        const s = await state(p);
        check(`"${typed}" prints on a keychain`, s.print.model === 'word' && s.print.text === text && s.built?.tris > 500 && !s.failed && s.built.radius <= 0.121 && s.built.height <= 0.201, `${said} ${JSON.stringify(s.built)}`);
        if (typed === 'Behbod' || typed === 'سلام دنیا') { await p.waitForTimeout(400); await p.screenshot({ path: path.join(OUT, `words-${typed === 'Behbod' ? 'latin' : 'persian'}.png`) }); }
      }
      const adj = await p.evaluate(() => { __loft.printer.ask('sam'); return __loft.printer.ask('taller wider twist spikier blue'); });
      await untilDone(p);
      const s = await state(p);
      check('the keychain takes the same adjustments', /^Reprinting the keychain, taller, wider, twist, spikier in blue\.$/.test(adj) && s.print.text === 'sam' && s.print.depth > 0 && s.print.twist > 0 && s.built?.tris > 500, `${adj} ${JSON.stringify(s.print)}`);
      for (const t of ['', '   ', '"   "']) check(`"${t}" prints nothing and breaks nothing`, (await p.evaluate(x => __loft.printer.ask(x), t)) === null);
      // The screen opened on that keychain: its typing line adjusts it, as its hint says, and new words make a new one.
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      await p.evaluate(() => __loft.act('printer')); await p.waitForTimeout(800);
      await p.fill('.ps-type input', 'bigger'); await p.press('.ps-type input', 'Enter'); await p.waitForTimeout(200);
      const grown = await state(p);
      await p.fill('.ps-type input', 'Bob'); await p.press('.ps-type input', 'Enter'); await p.waitForTimeout(200);
      const bob = await state(p);
      check('at the screen, bigger grows the keychain on the bed and a new word makes a new one', grown.print.model === 'word' && grown.print.text === 'sam' && grown.print.size > 1.1 && bob.print.text === 'Bob', `${JSON.stringify(grown.print)} then ${bob.print.text}`);
      await untilDone(p);
      check('the words: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- phones: tap the printer, the screen beside the print ----------
    for (const [part, opts] of [['phone', UPRIGHT], ['side', SIDEWAYS]]) {
      if (!want(part)) continue;
      const { ctx, p, errs } = await open(b, opts, { save: null });
      await standAt(p, [19.9, 2.9, 0.45]); await facePrinter(p);
      await p.waitForTimeout(900);
      const at = await printOnScreen(p);
      await p.touchscreen.tap(at.x, at.y);
      await p.waitForFunction(() => __loft.mode === 'printer', null, { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(1500);
      const opened = await p.evaluate(() => ({ mode: __loft.mode, panel: !!document.querySelector('.pn-printer') }));
      check(`${part}: a tap on the printer walks me there and opens its screen`, opened.mode === 'printer' && opened.panel, `${JSON.stringify(at)} ${JSON.stringify(opened)}`);
      await p.tap('.ps-tile >> text=chess knight');
      await p.tap('.ps-sw[aria-label="gold"]');
      const btn = await p.$eval('.ps-print', el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, text: el.textContent }; });
      check(`${part}: the Print button is on the screen without scrolling`, btn.top > 0 && btn.bottom <= opts.viewport.height && btn.text === 'Print a gold chess knight', JSON.stringify(btn));
      await p.tap('.ps-print');
      await p.waitForFunction(() => __loft.printer.progress > 0.5, null, { timeout: 40000 }).catch(() => {});
      await p.waitForTimeout(600);
      const seen = await printOnScreen(p), box = await p.$eval('.pn-printer .pn-box', el => el.getBoundingClientRect().toJSON());
      const clear = part === 'phone' ? seen.y < box.top - 10 : seen.x < box.left - 10;
      check(`${part}: the print shows beside the screen, not under it`, clear && seen.top === 'CANVAS' && seen.z < 1, `${JSON.stringify(seen)} screen ${Math.round(box.left)},${Math.round(box.top)}`);
      await p.screenshot({ path: path.join(OUT, `${part}-mid.png`) });
      await untilDone(p); await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(OUT, `${part}-done.png`) });
      await p.tap('.pn-printer h2 button');
      await p.waitForTimeout(800);
      check(`${part}: Close puts me back on my feet`, (await p.evaluate(() => __loft.mode)) === 'walk');
      check(`${part}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- a click on the printer from across the room ----------
    if (want('click')) {
      const { ctx, p, errs } = await open(b, DESK, { save: null });
      await standAt(p, [18.6, 4.4, 0.45]); await facePrinter(p);
      await p.waitForTimeout(900);
      const at = await printOnScreen(p);
      await p.mouse.click(at.x, at.y);
      await p.waitForFunction(() => __loft.mode === 'printer', null, { timeout: 20000 }).catch(() => {});
      const m = await p.evaluate(() => __loft.mode);
      check('a click on the printer walks me there and opens its screen', m === 'printer', `${JSON.stringify(at)} ${m}`);
      check('the click: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- a print that fails: the bar stops, the screen says so plainly, and Print works again ----------
    if (want('fail')) {
      const { ctx, p, errs } = await open(b, DESK, { save: null, init: failOnce });
      await standAt(p, SPOT); await facePrinter(p); await untilBuilt(p);
      await p.keyboard.press('KeyE');
      await p.waitForSelector('.pn-printer .ps-grid .ps-tile >> text=rubber duck', { timeout: 5000 }).catch(() => {});
      await p.evaluate(() => { window.__failNext = true; });
      await p.click('.ps-tile >> text=rubber duck'); await p.click('.ps-print');
      const seen = () => p.evaluate(() => {
        const bar = document.querySelector('.ps-bar'), r = __loft.printer;
        return { failed: r.failed, heating: r.heating, k: r.progress, sounding: r.sounding, warm: bar.classList.contains('ps-warm'), moving: getComputedStyle(bar.firstChild).animationName, width: bar.firstChild.style.width, status: document.querySelector('.ps-what').textContent, said: document.querySelector('.pn-said').textContent };
      });
      await p.waitForTimeout(800);
      const first = await seen();
      // Longer than the nozzle's warm-up, so a bar that only waited for it would have moved on by now.
      await p.waitForTimeout(2500);
      const later = await seen();
      const stopped = s => s.failed && !s.heating && s.k === 0 && !s.sounding && !s.warm && s.moving === 'none' && s.width === '0%' && /could not be printed/.test(s.status) && s.said === '';
      check('a print that fails: the bar stops, nothing hums, and the screen says it could not print', stopped(first) && stopped(later), JSON.stringify({ first, later }));
      await p.click('.ps-print');
      await untilDone(p); await p.waitForTimeout(400);
      const again = await seen();
      check('then Print works again', !again.failed && again.k === 1 && /^Done: a yellow rubber duck/.test(again.status) && (await state(p)).built?.tris > 1000, JSON.stringify(again));
      check('the failure: no error but the forced one', errs.filter(e => !/forced by the test/.test(e)).length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the keyboard alone: Tab stays in the screen, Esc puts focus back ----------
    if (want('keys')) {
      const { ctx, p, errs } = await open(b, DESK, { save: null });
      await standAt(p, SPOT); await facePrinter(p);
      for (let i = 0; i < 12 && (await p.evaluate(() => document.activeElement?.id)) !== 'snd'; i++) await p.keyboard.press('Tab');
      const before = await p.evaluate(() => document.activeElement?.id);
      await p.keyboard.press('KeyE');
      await p.waitForSelector('.pn-printer .ps-grid', { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(1500);
      const where = () => p.evaluate(() => { const a = document.activeElement; return { inside: !!a?.closest('.pn-printer'), what: a ? a.tagName + (a.textContent ? ':' + a.textContent.slice(0, 18) : '') + (a.ariaLabel ? ':' + a.ariaLabel : '') : null }; });
      const walk = async key => { const seen = []; for (let i = 0; i < 60; i++) { await p.keyboard.press(key); seen.push(await where()); } return seen; };
      const fwd = await walk('Tab'), back = await walk('Shift+Tab');
      const out = [...fwd, ...back].filter(s => !s.inside);
      const kinds = new Set(fwd.map(s => s.what));
      check('Tab and Shift+Tab go round the screen\'s own controls and never leave it', before === 'snd' && out.length === 0 && kinds.size > 40, `started on ${before}; left it ${out.length} times ${JSON.stringify(out.slice(0, 3))}; ${kinds.size} controls visited`);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(800);
      const shut = await p.evaluate(() => ({ mode: __loft.mode, panel: !!document.querySelector('.pn'), focus: document.activeElement?.id }));
      check('Esc closes it and focus goes back to where it was', shut.mode === 'walk' && !shut.panel && shut.focus === 'snd', JSON.stringify(shut));
      check('the keys: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- no worker, or one that will not start: the page builds it, a few milliseconds a frame ----------
    if (want('fallback')) {
      const { buildPrint } = await import('../web/src/pure/printbuild.js'), { finish } = await import('../web/src/pure/mesher.js');
      // The same print built here, as a worker would on a phone, to hold the page's build to.
      const knight = finish(buildPrint(P.cleanPrint({ model: 'knight' }), { points: 150000 }));
      const ways = [
        ['without workers', { init: () => { delete window.Worker; } }],
        ['with a worker that will not start', { route: ['**/printwork.js', r => r.fulfill({ status: 404, body: '' })] }],
      ];
      for (const [way, how] of ways) {
        const { ctx, p, errs } = await open(b, UPRIGHT, { save: null, ...how });
        await standAt(p, SPOT); await facePrinter(p);
        await p.waitForFunction(() => __loft.printer.built, null, { timeout: 90000 }).catch(() => {});
        // Timed as the worker's builds are: the screen open, the house timed still that way first.
        await p.evaluate(() => __loft.act('printer')); await p.waitForTimeout(2500);
        const cdp = await ctx.newCDPSession(p);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        const base = await frameGaps(p, () => p.waitForTimeout(5000));
        const model = await frameGaps(p, async () => { await p.evaluate(() => __loft.printer.ask('chess knight')); await p.waitForFunction(() => __loft.printer.built, null, { timeout: 120000, polling: 100 }).catch(() => {}); await p.waitForTimeout(300); });
        const madeModel = await state(p);
        const word = await frameGaps(p, async () => { await p.evaluate(() => __loft.printer.ask('a long keychain to build here')); await p.waitForFunction(() => __loft.printer.built, null, { timeout: 120000, polling: 100 }).catch(() => {}); await p.waitForTimeout(300); });
        const madeWord = await state(p);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        console.log(`  ${way}, frame gaps with the processor 4x slower (ms):`, JSON.stringify({ base, model, word }));
        check(`${way}: the page builds the model, the same one a worker makes`, !madeModel.failed && madeModel.built?.tris === knight.index.length / 3 && madeModel.built.layers === knight.layers && Math.abs(madeModel.built.height - knight.height) < 1e-6, JSON.stringify(madeModel.built));
        check(`${way}: and a keychain`, !madeWord.failed && madeWord.print.model === 'word' && madeWord.built?.tris > 500, JSON.stringify(madeWord.built));
        check(`${way}: a 4x slower phone keeps its frames coming while the page builds`, model.worst < base.worst + 25 && word.worst < base.worst + 25 && model.n > 30 && word.n > 30, `model worst ${model.worst} ms, keychain worst ${word.worst} ms, idle worst ${base.worst} ms`);
        check(`${way}: no error`, errs.filter(e => !/printwork\.js/.test(e)).length === 0, errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
    }
    // ---------- smooth on a slow phone: no long frames when the screen opens or a model is built ----------
    if (want('smooth')) {
      const { ctx, p, errs } = await open(b, UPRIGHT, { save: null });
      await standAt(p, SPOT); await untilBuilt(p);
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const gaps = async run => {
        await p.evaluate(() => { const gaps = window.__gaps = []; let last = performance.now(); const f = t => { if (window.__gaps !== gaps) return; gaps.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
        await run();
        const g = await p.evaluate(() => { const a = __gaps.slice(2); window.__gaps = null; a.sort((x, y) => x - y); return { n: a.length, median: +a[a.length >> 1].toFixed(1), worst: +a[a.length - 1].toFixed(1) }; });
        return g;
      };
      const base = await gaps(() => p.waitForTimeout(2500));
      const opening = await gaps(async () => { await p.evaluate(() => __loft.act('printer')); await p.waitForTimeout(2500); });
      const building = await gaps(async () => { await p.tap('.ps-tile >> text=chess knight'); await p.tap('.ps-print'); await p.waitForFunction(() => __loft.printer.built, null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(500); });
      const keyring = await gaps(async () => { await p.evaluate(() => __loft.printer.ask('a long keychain to build here')); await p.waitForFunction(() => __loft.printer.built, null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(500); });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      console.log('frame gaps with the processor 4x slower, phone size (ms):', JSON.stringify({ base, opening, building, keyring }));
      // A plain turn of the camera costs the house about 110 ms on such a phone, so opening (which moves it) is held to that.
      check('4x slower phone: opening the screen costs no more than turning the camera', opening.worst < 140, `worst ${opening.worst} ms, idle worst ${base.worst} ms`);
      check('4x slower phone: building a model or a keychain keeps frames coming', building.worst < base.worst + 25 && keyring.worst < base.worst + 25, `model worst ${building.worst} ms, keychain worst ${keyring.worst} ms, idle worst ${base.worst} ms`);
      check('smooth: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

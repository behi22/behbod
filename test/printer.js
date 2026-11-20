// The 3D printer in a real Chrome: its screen, its prints, its sound, typing to it, at a computer and on phones.
//   LOFT_URL=http://127.0.0.1:8815 node test/printer.js [outdir] [only: hum,keep,terminal,words]
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
async function open(b, opts, { auto = true, save, ear = false } = {}) {
  const ctx = await b.newContext(opts);
  if (ear) await ctx.addInitScript(tap);
  if (save !== undefined) await ctx.addInitScript(s => { try { if (s === null) localStorage.removeItem('home.print'); else localStorage.setItem('home.print', s); } catch { /* none */ } }, save);
  const p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?${auto ? 'auto&' : ''}q=${opts.isMobile ? 'medium' : 'high'}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0 && (document.getElementById('enter').classList.contains('ready')), null, { timeout: 120000 });
  if (!auto) { await p.click('#enter'); }
  await p.waitForTimeout(800);
  return { ctx, p, errs };
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
// The house's sound level over about a second, in dB.
const level = p => p.evaluate(async () => {
  const an = window.__ear, buf = new Float32Array(an.fftSize);
  let s = 0, n = 0;
  for (let k = 0; k < 12; k++) { an.getFloatTimeDomainData(buf); for (const v of buf) s += v * v; n += buf.length; await new Promise(r => setTimeout(r, 90)); }
  return +(10 * Math.log10(s / n + 1e-12)).toFixed(1);
});
const termLines = p => p.evaluate(() => __loft.screens.desktop.term.lines.slice());
const sit = async p => { await p.evaluate(() => __loft.useDesk()); await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 }); await p.waitForTimeout(700); };
const type = async (p, text) => { await p.keyboard.type(text); await p.keyboard.press('Enter'); await p.waitForTimeout(150); };
const lineAfter = (lines, cmd) => lines[lines.lastIndexOf('$ ' + cmd) + 1] || '';

(async () => {
  const P = await import('../web/src/pure/printer.js');
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  try {
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
      check('the words: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

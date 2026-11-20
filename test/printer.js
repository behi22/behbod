// The 3D printer in a real Chrome: its screen, its prints, its sound, typing to it, at a computer and on phones.
//   LOFT_URL=http://127.0.0.1:8815 node test/printer.js [outdir] [only: hum]
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
const SPOT = [20.72, 3.58, 0.45], DESK_AT = [19.6, 1.2, 0.45], FAR = [10.5, 6.0, 0.45];

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
const untilDone = p => p.waitForFunction(() => __loft.printer.progress === 1, null, { timeout: 60000 }).catch(() => {});
// The print's middle on the screen, and what of the page is on top of it there.
// The house's sound level over about a second, in dB.
const level = p => p.evaluate(async () => {
  const an = window.__ear, buf = new Float32Array(an.fftSize);
  let s = 0, n = 0;
  for (let k = 0; k < 12; k++) { an.getFloatTimeDomainData(buf); for (const v of buf) s += v * v; n += buf.length; await new Promise(r => setTimeout(r, 90)); }
  return +(10 * Math.log10(s / n + 1e-12)).toFixed(1);
});
const type = async (p, text) => { await p.keyboard.type(text); await p.keyboard.press('Enter'); await p.waitForTimeout(150); };

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
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

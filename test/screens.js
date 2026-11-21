// The desk's little screens, its terminal and the light scenes, in real browsers.
//   LOFT_URL=http://127.0.0.1:8821 node test/screens.js [outdir] [only: history]
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

(async () => {
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

  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

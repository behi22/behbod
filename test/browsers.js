// The loft in Chrome, Firefox and WebKit, desktop and phone, light and dark system themes: it loads, draws, walks,
// uses the desk and logs no errors. Then live reload: touching a file under web/ reloads an open page.
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const URL = (process.env.LOFT_URL || 'http://127.0.0.1:8810') + '/?auto&q=low';
const VIEWS = [['desktop', { viewport: { width: 1280, height: 800 } }], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]];

async function run(name, launch) {
  const b = await launch();
  const rows = [];
  for (const [view, opts] of VIEWS) for (const scheme of ['dark', 'light']) {
    if (name === 'firefox' && opts.isMobile) delete opts.isMobile;
    const ctx = await b.newContext({ ...opts, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    // Messages from inside YouTube's own player (the live video frame) are not the page's errors.
    p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 160)); });
    await p.goto(URL);
    await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 90000 });
    const start = await p.evaluate(() => ({ x: __loft.pos.x, z: __loft.pos.z }));
    let moved = 0;
    if (!opts.hasTouch) {
      await p.evaluate(() => { __loft.yaw = Math.PI / 2; });
      await p.keyboard.down('KeyW'); await p.waitForTimeout(900); await p.keyboard.up('KeyW');
      moved = await p.evaluate(s => Math.hypot(__loft.pos.x - s.x, __loft.pos.z - s.z), start);
    } else {
      await p.tap('[data-go="lounge"]'); await p.waitForTimeout(1500);
      moved = await p.evaluate(s => Math.hypot(__loft.pos.x - s.x, __loft.pos.z - s.z), start);
    }
    await p.evaluate(() => __loft.useDesk());
    await p.waitForTimeout(2200);
    const atDesk = await p.evaluate(() => __loft.mode);
    await p.evaluate(() => __loft.leaveDesk());
    await p.waitForTimeout(1800);
    const back = await p.evaluate(() => __loft.mode);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const quiet = await p.evaluate(() => window.__quiet === true);
    const ok = moved > 0.5 && atDesk === 'desk' && back === 'walk' && over <= 0 && quiet && !errs.length;
    rows.push(`${name} ${view} ${scheme}: moved ${moved.toFixed(2)} desk ${atDesk} back ${back} sideways ${over > 0} muted ${quiet} errors ${errs.length ? errs.join(' | ') : 0} ${ok ? 'PASS' : 'FAIL'}`);
    await ctx.close();
  }
  await b.close();
  return rows;
}

(async () => {
  const all = [
    ...await run('chrome', () => launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] })),
    ...await run('firefox', () => launch(pw.firefox)),
    ...await run('webkit', () => launch(pw.webkit)),
  ];
  console.log(all.join('\n'));

  const b = await launch(pw.chromium, { channel: 'chrome' });
  const p = await b.newPage();
  await p.goto(URL);
  await p.waitForFunction(() => !!window.__loft, null, { timeout: 90000 });
  await p.evaluate(() => { window.__marker = 1; });
  const f = path.join(__dirname, '..', 'web', 'sound.js');
  const reloaded = p.waitForEvent('load', { timeout: 10000 }).then(() => true, () => false);
  fs.utimesSync(f, new Date(), new Date());
  fs.writeFileSync(f, fs.readFileSync(f));
  const live = await reloaded && await p.evaluate(() => window.__marker === undefined);
  console.log('live reload', live ? 'PASS' : 'FAIL');
  await b.close();
  process.exit(all.every(r => r.endsWith('PASS')) && live ? 0 : 1);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });

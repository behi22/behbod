// The automatic quality in a real browser: shaders ready before anything is first seen, on every tier, and switches
// between tiers that do not freeze a frame.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
const TOUR = [[2.55, 1.2, 0, 0.15], [7.0, 10.2, -0.45, -2.0], [10.6, 11.6, 0, -2.0], [16.0, 8.9, 0, 0.6], [15.6, 4.4, 0.45, -2.2],
  [14.6, 9.4, 0, 0.1], [11.6, 16.2, 0, Math.PI], [11.7, 13.4, 0, 0], [9.5, 2.0, 3.0, 2.0], [2.2, 3.6, 0, 2.6]];
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

async function open(b, q, view = { viewport: { width: 1366, height: 768 } }) {
  const p = await b.newPage(view);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { if (window.top !== window) return; window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask' }); });
  await p.goto(`${BASE}/?q=${q}`);
  await p.waitForFunction(() => window.__loft, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  return { p, errs };
}

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    for (const q of ['ultra', 'low']) {
      const { p, errs } = await open(b, q);
      const before = await p.evaluate(() => __loft.renderer.info.programs.length);
      for (const [x, y, z, yaw] of TOUR) {
        await p.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); __loft.yaw = yw; }, [b2t(x, y, z), yaw]);
        await p.waitForTimeout(1200);
      }
      const built = await p.evaluate(() => __loft.renderer.info.programs.length) - before;
      // The screening wall's screen changes its own material when its video starts: that one is built when it plays.
      check(`${q}: shaders built on a walk round the house, after the page opened`, built <= 1, `${built}`);
      check(`${q}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // At 1440x900 on a 2x screen, as on his laptop: ultra and high differ only in sharpness, high and medium in effects
    // (whose chain is built in the background and swapped in, so the switch lands a moment later).
    for (const [from, steps] of [['ultra', ['high', 'ultra', 'high', 'ultra']], ['high', ['medium', 'high', 'medium', 'high']]]) {
      const { p, errs } = await open(b, from, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      const worst = [];
      for (const to of steps) {
        const t = await p.evaluate(next => { const t = performance.now(); __loft.autoTierTo(next); return t; }, to);
        await p.waitForTimeout(3500);
        worst.push(await p.evaluate(t => Math.max(0, ...__lt.filter(([s, d]) => s + d > t && s < t + 3000).map(l => l[1])), t));
      }
      check(`${from} and ${steps[0]}: a switch between them holds no frame for long (longest task in the 3 s after each, ms)`, worst.every(w => w < 50), worst.map(w => w.toFixed(0)).join(' '));
      check(`${from} and ${steps[0]}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

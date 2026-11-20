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
    // A change of mind while a background build is still asking for its shaders: the build stops and throws away what
    // it made. Regression: it did so while three was still waiting on those shaders, and three's wait then threw on the
    // thrown-away materials (page errors, and graphics errors for each). The outside is built as on a slow phone: each
    // piece's shaders take a slice of their own to ask for and stay unready for a moment.
    for (const [part, to, slowly] of [['the effects', 'medium', false], ['the outside', 'low', true]]) {
      const { p, errs } = await open(b, 'ultra');
      const warns = [];
      p.on('console', m => { if (m.type() === 'warning' && /GL_INVALID|WebGL/.test(m.text())) warns.push(m.text()); });
      const caught = await p.evaluate(([to, part, slowly]) => new Promise(done => {
        const r = __loft.renderer, out = __loft.out3d.camera, ask = r.compileAsync.bind(r);
        let armed = true;
        r.compileAsync = function (obj, cam, into) {
          const job = ask(obj, cam, into);
          if (slowly && cam === out) { const t = performance.now(); while (performance.now() < t + 9); }
          if (armed && (part === 'the outside') === (cam === out)) {
            const waiting = [];
            obj.traverse(o => { for (const m of [].concat(o.material || [])) { const pr = r.properties.get(m).currentProgram; if (pr && !pr.isReady()) waiting.push(pr); } });
            if (waiting.length) {
              armed = false;
              if (slowly) for (const pr of waiting) { const until = performance.now() + 400, ready = pr.isReady; pr.isReady = () => performance.now() > until && ready.call(pr); }
              queueMicrotask(() => __loft.autoTierTo('ultra'));
            }
          }
          return job;
        };
        __loft.autoTierTo(to);
        setTimeout(() => { r.compileAsync = ask; done(!armed); }, 5000);
      }), [to, part, slowly]);
      await p.waitForTimeout(1000);
      const now = await p.evaluate(() => ({ tier: __loft.tier, outside: __loft.out3d.quality }));
      check(`${part}: a switch back while its new shaders are still being built is caught mid-way`, caught);
      check(`${part}: the build stops cleanly, no error`, errs.length === 0 && warns.length === 0, [...errs, ...warns].slice(0, 2).join(' | '));
      check(`${part}: and what was on screen stays`, now.tier === 'ultra' && now.outside === 'high', JSON.stringify(now));
      await p.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

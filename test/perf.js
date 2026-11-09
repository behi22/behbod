// Frame-time check: a fixed 30 second tour of the house, every frame timed in the page. Run it plain, and with
// --slow to stand in for a low-end laptop (the CPU slowed 4x through DevTools, low quality). Prints the median and
// worst frames, how many frames missed 30 and 20 fps, and where the main thread spent its time.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const slow = process.argv.includes('--slow'), hidpi = process.argv.includes('--hidpi');
const URL = (process.env.LOFT_URL || 'http://127.0.0.1:8810') + '/?auto' + (slow ? '&q=low' : '');
const b2t = (x, y, z) => ({ x, y: z, z: -y });
// Where the tour stands and which way it looks (Blender x, y, floor height, camera yaw).
const TOUR = [[2.55, 1.2, 0, 0.15], [7.0, 10.2, -0.45, -2.0], [10.6, 11.6, 0, -2.0], [16.0, 8.9, 0, 0.6], [15.6, 4.4, 0.45, -2.2],
  [14.6, 9.4, 0, 0.1], [11.6, 16.2, 0, Math.PI], [11.7, 13.4, 0, 0], [9.5, 2.0, 3.0, 2.0], [2.2, 3.6, 0, 2.6]];

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(hidpi ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } : { viewport: { width: 1366, height: 768 } });
  const cdp = await p.context().newCDPSession(p);
  await p.goto(URL);
  await p.waitForFunction(() => window.__loft, null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  if (slow) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await p.evaluate(() => {
    window.__ft = [];
    let last = performance.now();
    const loop = now => { window.__ft.push(now - last); last = now; if (window.__ft.length < 100000) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  for (let i = 0; Date.now() - t0 < 30000; i++) {
    const [x, y, z, yaw] = TOUR[i % TOUR.length];
    await p.evaluate(([q, yw]) => { __loft.pos.set(q.x, q.y + 0.05, q.z); __loft.yaw = yw; }, [b2t(x, y, z), yaw]);
    // Walk a little each stop, as a visitor would.
    await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.keyboard.up('KeyW');
    await p.waitForTimeout(1600);
  }
  const { profile } = await cdp.send('Profiler.stop');
  if (slow) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const ft = (await p.evaluate(() => window.__ft)).slice(5).sort((a, b) => a - b);
  const info = await p.evaluate(() => ({ tier: __loft.tier, calls: __loft.renderer.info.render.calls, tris: __loft.renderer.info.render.triangles }));
  const q = k => ft[Math.min(ft.length - 1, Math.floor(ft.length * k))].toFixed(1);
  const sum = ft.reduce((a, v) => a + v, 0);
  console.log(`${slow ? 'SLOW (cpu 4x, q=low)' : hidpi ? 'HIDPI (1440x900 at 2x)' : 'NORMAL'} tier ${info.tier}: ${ft.length} frames, avg ${(1000 * ft.length / sum).toFixed(0)} fps | median ${q(0.5)} ms, p95 ${q(0.95)}, p99 ${q(0.99)}, worst ${ft.at(-1).toFixed(1)} | over 33 ms: ${ft.filter(v => v > 33.4).length}, over 50 ms: ${ft.filter(v => v > 50).length} | last frame ${info.calls} calls ${(info.tris / 1000).toFixed(0)}k tris`);
  // Self time per function from the sampling profile, top 14 of our own code and the engine.
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas, samples = profile.samples;
  for (let i = 0; i < samples.length; i++) {
    const n = byId.get(samples[i]), f = n.callFrame;
    const key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000);
  }
  const total = [...self.values()].reduce((a, v) => a + v, 0);
  [...self.entries()].filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14)
    .forEach(([k, v]) => console.log(`  ${(100 * v / total).toFixed(1).padStart(5)}%  ${k.slice(0, 110)}`));
  const gc = [...self.entries()].find(([k]) => k.startsWith('(garbage collector)'));
  console.log(`  garbage collection ${gc ? (100 * gc[1] / total).toFixed(1) : 0}% | idle ${(100 * ([...self.entries()].find(([k]) => k.startsWith('(idle)'))?.[1] || 0) / total).toFixed(0)}%`);
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });

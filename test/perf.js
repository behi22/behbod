// Frame-time check: a fixed 30 second tour of the house, every frame timed in the page. Run it plain, and with
// --slow to stand in for a low-end laptop (the CPU slowed 4x through DevTools, low quality). Prints the median and
// worst frames, how many frames missed 30 and 20 fps, and where the main thread spent its time.
// --tiers watches the automatic quality: each switch, time and frames per tier, long tasks and what ran in them. With
// --phone (390x844 at 3x, touch), --cpu N (slowed from the first byte), --secs N, --hz N (frames N a second, a 30 Hz cap).
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const argv = process.argv.slice(2), num = (f, d) => { const v = +argv[argv.indexOf(f) + 1]; return argv.includes(f) && v > 0 ? v : d; };
const slow = argv.includes('--slow'), hidpi = argv.includes('--hidpi'), tiers = argv.includes('--tiers'), phone = argv.includes('--phone');
const cpu = slow ? 4 : num('--cpu', 1), secs = num('--secs', 30), hz = num('--hz', 0);
const ORIGIN = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const URL = ORIGIN + '/?auto' + (slow ? '&q=low' : '');
const b2t = (x, y, z) => ({ x, y: z, z: -y });
// Where the tour stands and which way it looks (Blender x, y, floor height, camera yaw).
const TOUR = [[2.55, 1.2, 0, 0.15], [7.0, 10.2, -0.45, -2.0], [10.6, 11.6, 0, -2.0], [16.0, 8.9, 0, 0.6], [15.6, 4.4, 0.45, -2.2],
  [14.6, 9.4, 0, 0.1], [11.6, 16.2, 0, Math.PI], [11.7, 13.4, 0, 0], [9.5, 2.0, 3.0, 2.0], [2.2, 3.6, 0, 2.6]];
const VIEW = phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  : hidpi ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } : { viewport: { width: 1366, height: 768 } };
const extra = [phone && 'phone 390x844 at 3x', tiers && !phone && hidpi && '1440x900 at 2x', !slow && cpu > 1 && `cpu ${cpu}x`,
  hz && `frames at ${hz} Hz`, secs !== 30 && `${secs} s`].filter(Boolean).join(', ');
const LABEL = (slow ? 'SLOW (cpu 4x, q=low)' : tiers ? 'TIERS' : hidpi && !phone ? 'HIDPI (1440x900 at 2x)' : 'NORMAL') + (extra ? ` [${extra}]` : '');

// A slower screen or a frame cap, with the machine otherwise idle.
function fixedRate(hz) {
  if (window.top !== window) return;
  const period = 1000 / hz, waiting = new Map();
  let id = 0, timer = 0;
  const later = () => { const t = performance.now(); timer = setTimeout(fire, Math.ceil((t + 0.1) / period) * period - t); };
  function fire() {
    timer = 0;
    const due = [...waiting.values()], t = performance.now();
    waiting.clear();
    for (const cb of due) try { cb(t); } catch (e) { setTimeout(() => { throw e; }); }
    if (waiting.size && !timer) later();
  }
  window.requestAnimationFrame = cb => { waiting.set(++id, cb); if (!timer) later(); return id; };
  window.cancelAnimationFrame = i => { waiting.delete(i); };
}
function watchLongTasks() {
  if (window.top !== window) return;
  window.__lt = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
}
// Timed as the page's own judge times them.
function recordTiers() {
  const t0 = performance.now();
  window.__tf = []; window.__tt = [[t0, __loft.tier]]; window.__tm = [[t0, __loft.mode]];
  let last = t0;
  const loop = () => {
    const t = performance.now();
    __tf.push([t, t - last]); last = t;
    if (__loft.tier !== __tt.at(-1)[1]) __tt.push([t, __loft.tier]);
    if (__loft.mode !== __tm.at(-1)[1]) __tm.push([t, __loft.mode]);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(VIEW);
  const cdp = await p.context().newCDPSession(p);
  if (hz) await p.addInitScript(fixedRate, hz);
  if (tiers) await p.addInitScript(watchLongTasks);
  if (!slow && cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await p.goto(URL);
  await p.waitForFunction(() => window.__loft, null, { timeout: tiers ? 600000 : 120000 });
  let mark = 0;
  if (tiers) {
    await p.evaluate(recordTiers);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await cdp.send('Profiler.start');
    // Lines the profile's clock up with the page's.
    mark = await p.evaluate(() => { const t = performance.now(); (function perfClockMark() { while (performance.now() < t + 30); })(); return t; });
  }
  await p.waitForTimeout(3000);
  if (slow) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  if (!tiers) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  }
  await p.evaluate(() => {
    window.__ft = [];
    let last = performance.now();
    const loop = now => { window.__ft.push(now - last); last = now; if (window.__ft.length < 100000) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  if (!tiers) await cdp.send('Profiler.start');
  const t0 = Date.now();
  for (let i = 0; Date.now() - t0 < secs * 1000; i++) {
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
  console.log(`${LABEL} tier ${info.tier}: ${ft.length} frames, avg ${(1000 * ft.length / sum).toFixed(0)} fps | median ${q(0.5)} ms, p95 ${q(0.95)}, p99 ${q(0.99)}, worst ${ft.at(-1).toFixed(1)} | over 33 ms: ${ft.filter(v => v > 33.4).length}, over 50 ms: ${ft.filter(v => v > 50).length} | last frame ${info.calls} calls ${(info.tris / 1000).toFixed(0)}k tris`);
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
  if (tiers) await tierReport(p, b, profile, mark);
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });

const ms = v => v.toFixed(1);
const where = f => `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber + 1}`;
function spread(xs) {
  if (!xs.length) return 'no frames';
  const s = [...xs].sort((a, b) => a - b), q = k => s[Math.min(s.length - 1, Math.floor(s.length * k))], sum = s.reduce((a, v) => a + v, 0);
  return `${s.length} frames, ${(1000 * s.length / sum).toFixed(0)} fps | median ${ms(q(0.5))} ms, p90 ${ms(q(0.9))}, p99 ${ms(q(0.99))}, worst ${ms(s.at(-1))} | over 33 ms: ${s.filter(v => v > 33.4).length}, over 50 ms: ${s.filter(v => v > 50).length}`;
}

// Per stretch of page time: the innermost function of ours on the stack, and the top of the stack.
function sampler(profile, mark) {
  const byId = new Map(profile.nodes.map(n => [n.id, n])), up = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) up.set(c, n);
  const chain = id => { const out = []; for (let n = byId.get(id); n; n = up.get(n.id)) out.push(n.callFrame); return out; };
  const at = []; let t = profile.startTime;
  for (const d of profile.timeDeltas) at.push((t += d) / 1000);
  const first = profile.samples.findIndex(id => chain(id).some(f => f.functionName === 'perfClockMark'));
  const shift = first < 0 ? NaN : at[first] - mark;
  const top = m => { const e = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; return e ? `${e[0]} ${Math.round(100 * e[1] / [...m.values()].reduce((a, v) => a + v, 0))}%` : 'no samples'; };
  return {
    lined: !Number.isNaN(shift),
    during(from, to) {
      const ours = new Map(), leaf = new Map();
      let lo = 0, hi = at.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (at[mid] - shift < from) lo = mid + 1; else hi = mid; }
      for (let i = lo; i < at.length && at[i] - shift <= to; i++) {
        const c = chain(profile.samples[i]), own = c.find(f => f.url.startsWith(ORIGIN));
        const a = own ? where(own) : '(none of ours)', z = c[0].url ? where(c[0]) : c[0].functionName;
        ours.set(a, (ours.get(a) || 0) + 1); leaf.set(z, (leaf.get(z) || 0) + 1);
      }
      return { ours: top(ours), leaf: top(leaf), main: [...ours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'no samples' };
    },
  };
}

async function tierReport(p, b, profile, mark) {
  const { p90 } = await import('../web/src/pure/tier.js');
  const browser = await (await b.newBrowserCDPSession()).send('Browser.getVersion');
  const env = await p.evaluate(() => {
    const gl = __loft.renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), dpr: devicePixelRatio, coarse: matchMedia('(pointer: coarse)').matches,
      cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory };
  });
  const { frames, tl, modes, long } = await p.evaluate(() => ({ frames: __tf, tl: __tt, modes: __tm, long: __lt }));
  const end = frames.at(-1)[0], s = v => (v / 1000).toFixed(1) + ' s';
  const before = (log, t) => { let k = log[0][1]; for (const [at, v] of log) if (at < t) k = v; else break; return k; };
  console.log(`browser ${browser.product}${/Headless/.test(browser.userAgent) ? ' headless' : ' in a window'}, graphics ${env.gpu}, pixel ratio ${env.dpr}, coarse pointer ${env.coarse}, ${env.cores} cores, memory ${env.memory ?? '?'} GB`);
  console.log(`house opened at ${s(tl[0][0])} page time (the rule ignores the first 6 s of page time); start tier ${tl[0][1]}`);
  console.log(`switches: ${tl.length - 1}`);
  for (let i = 1; i < tl.length; i++) {
    const [t, name] = tl[i], next = frames.filter(([at]) => at > t && at <= t + 2500).map(f => f[1]);
    console.log(`  ${s(t).padStart(8)}  ${tl[i - 1][1]} -> ${name} (${before(modes, t + 1)})  worst frame in the next 2.5 s ${next.length ? ms(Math.max(...next)) : '-'} ms, their p90 ${next.length ? ms(p90(next)) : '-'} ms`);
  }
  for (const name of ['ultra', 'high', 'medium', 'low']) {
    const segs = tl.map(([t, k], i) => [t, i + 1 < tl.length ? tl[i + 1][0] : end, k]).filter(x => x[2] === name);
    if (!segs.length) continue;
    const mine = frames.filter(([t]) => before(tl, t) === name);
    let judged = 0, slowOnes = 0;
    for (const [from, to] of segs) for (let w = from; w < to; w += 2500) {
      const xs = mine.filter(([t]) => t > w && t <= Math.min(to, w + 2500)).map(f => f[1]);
      if (xs.length >= 10) { judged++; if (p90(xs) > 20) slowOnes++; }
    }
    console.log(`  ${name}: ${s(segs.reduce((a, [f, t]) => a + t - f, 0))} in ${segs.length} stretch(es) | ${spread(mine.map(f => f[1]))} | 2.5 s windows over 20 ms at p90: ${slowOnes} of ${judged}`);
  }
  if (modes.length > 1) console.log(`modes: ${modes.map(([t, m]) => `${m} at ${s(t)}`).join(', ')}`);
  const run = long.filter(([t]) => t >= tl[0][0]), lost = long.length - run.length;
  const prof = sampler(profile, mark);
  console.log(`long tasks over 50 ms while open: ${run.length}, ${Math.round(run.reduce((a, l) => a + l[1], 0))} ms in all (and ${lost} while loading)${prof.lined ? '' : ' | the profile clock could not be lined up, so no attribution'}`);
  const bare = frames.filter(([t, d]) => d > 50 && !run.some(([a, l]) => a < t && a + l > t - d)).length;
  console.log(`frames over 50 ms: ${frames.filter(f => f[1] > 50).length}, of them with no long task in them (waiting on the graphics card or the compositor): ${bare}`);
  if (!prof.lined) return;
  const tasks = run.map(([t, d]) => ({ t, d, tier: before(tl, t + d), mode: before(modes, t + d), ...prof.during(t, t + d) }));
  const groups = new Map();
  for (const k of tasks) { const g = groups.get(k.main) || { n: 0, total: 0, worst: 0 }; g.n++; g.total += k.d; g.worst = Math.max(g.worst, k.d); groups.set(k.main, g); }
  console.log('long tasks by the function of ours running in them (count, total, worst):');
  [...groups.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 14)
    .forEach(([k, g]) => console.log(`  ${String(g.n).padStart(4)}  ${String(Math.round(g.total)).padStart(6)} ms  worst ${String(Math.round(g.worst)).padStart(4)} ms  ${k.slice(0, 100)}`));
  console.log('the 20 longest:');
  [...tasks].sort((a, b) => b.d - a.d).slice(0, 20)
    .forEach(k => console.log(`  ${s(k.t).padStart(8)}  ${String(Math.round(k.d)).padStart(4)} ms on ${k.tier} (${k.mode}) | ours: ${k.ours.slice(0, 80)} | top: ${k.leaf.slice(0, 70)}`));
}

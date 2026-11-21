// The desk and BH-22, in a real Chrome, part by part:
//   fish     the fish in the tank turn round about themselves and stay in the water (failed before these changes)
//   LOFT_URL=http://127.0.0.1:8820 node test/desk.js [outdir] [only: parts, comma-separated]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/desk';
const ONLY = process.argv[3] || 'fish';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const b2t = (x, y, z) => ({ x, y: z, z: -y });

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]|GL_INVALID|WebGL/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
async function open(b, opts, query = '') {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}${query}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  return { ctx, p, errs };
}
// Me at a spot (Blender axes), the camera turned to `yaw`.
const standAt = async (p, at, yaw) => { await p.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); if (yw !== undefined) __loft.yaw = yw; }, [b2t(...at), yaw]); await p.waitForTimeout(600); };

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- the fish: they turn round in the water, about themselves ----------
    if (want('fish')) {
      const { ctx, p, errs } = await open(b, DESK);
      const r = await p.evaluate(() => {
        const L = __loft, fish = [], water = L.scene.getObjectByName('aqua_water');
        L.scene.traverse(o => { if (/^fish\d$/.test(o.name)) fish.push(o); });
        water.geometry.computeBoundingBox();
        const Box3 = water.geometry.boundingBox.constructor, tank = new Box3().setFromObject(water);
        let out = 0, jump = 0, worst = '', last = null;
        // Two whole swims, frame by frame at 30 a second, the clock moved by hand.
        for (let k = 0; k < 950; k++) {
          const t = 5000 + k / 30;
          L.world.tick(0, t, false, L.camera.position, L.pos, []);
          const now = fish.map(f => { f.updateMatrixWorld(true); const b = new Box3().setFromObject(f); return { b, yaw: f.rotation.y }; });
          now.forEach(({ b }, i) => {
            if (b.min.x < tank.min.x || b.max.x > tank.max.x || b.min.z < tank.min.z || b.max.z > tank.max.z) { out++; worst ||= `${fish[i].name} at ${t.toFixed(2)}: x ${b.min.x.toFixed(2)} to ${b.max.x.toFixed(2)}, z ${b.min.z.toFixed(2)} to ${b.max.z.toFixed(2)}`; }
            if (last) jump = Math.max(jump, Math.abs(now[i].yaw - last[i].yaw));
          });
          last = now;
        }
        return { n: fish.length, out, jump, worst, tank: [tank.min.x, tank.max.x, tank.min.z, tank.max.z].map(v => +v.toFixed(2)) };
      });
      check('five fish', r.n === 5, String(r.n));
      check('through two whole swims every fish stays in the water', r.out === 0, `${r.out} frames out; first ${r.worst}; water ${r.tank}`);
      check('and turns round a little at a time, never at a stroke', r.jump < 0.2, `largest turn in a frame ${r.jump.toFixed(3)}`);
      await standAt(p, [3.6, 3.3, 0], 0);
      await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(OUT, 'fish.png') });
      check('fish: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

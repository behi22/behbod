// Every seat in the house: sit down, and check the hips land on the seat's spot and the feet rest where the style puts
// them (on the floor for most; the stool's footrest, the egg chair's and the window seat's cushions for the rest).
// Then stand back up. A screenshot of each seat goes to the out folder.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.LOFT_URL || 'http://127.0.0.1:8810') + '/?auto&q=medium';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
// Where the feet should be, above the floor the seat stands on (metres), for styles whose feet are not on the floor.
const FEET_UP = { stool: 0.30, egg: 0.87, nook: 0.53 };

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForFunction(() => window.__loft, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const seats = await p.evaluate(() => __loft.meta.interact.filter(i => i.seat).map(i => ({ id: i.id, kind: i.kind, at: i.at, seat: i.seat, face: i.face })));
  let fails = 0;
  for (const s of seats) {
    await p.evaluate(q => { __loft.pos.set(q.x, q.y + 0.05, q.z); }, b2t(...s.at));
    await p.waitForTimeout(500);
    await p.evaluate(id => __loft.act(id), s.id);
    await p.waitForTimeout(2200);
    const r = await p.evaluate(([seat, at]) => {
      const L = __loft, w = n => L.me.bones[n].getWorldPosition(new L.me.root.position.constructor());
      const hip = w('pelvis'), fl = w('foot_l'), fr = w('foot_r');
      const target = { x: seat[0], y: seat[2], z: -seat[1] };
      return { mode: L.mode, hipOff: Math.hypot(hip.x - target.x, hip.y - target.y, hip.z - target.z), feet: Math.min(fl.y, fr.y) - at[2] };
    }, [s.seat, s.at]);
    await p.screenshot({ path: `${OUT}/seat-${s.id}.png` });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1400);
    const after = await p.evaluate(() => __loft.mode);
    // The ankle joint sits about 7 cm above the sole.
    const feetWant = (FEET_UP[s.kind] || 0) + 0.07, feetOff = Math.abs(r.feet - feetWant);
    const ok = r.mode === 'sit' && r.hipOff < 0.04 && feetOff < 0.06 && after === 'walk';
    if (!ok) fails++;
    console.log(`${s.id.padEnd(15)} ${String(s.kind).padEnd(8)} hips off ${(r.hipOff * 100).toFixed(1)} cm, ankles ${(r.feet * 100).toFixed(0)} cm up (want ${(feetWant * 100).toFixed(0)}) | then ${after} ${ok ? 'PASS' : 'FAIL'}`);
  }
  console.log(`seats: ${seats.length - fails} of ${seats.length} pass | errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });

// The desk and BH-22, in a real Chrome, part by part:
//   fish     the fish in the tank turn round about themselves and stay in the water (failed before these changes)
//   moods    BH-22's eyes by mood: hearts, happy arcs, x x
//   glow     its eyes keep their full glow after a pet (failed before these changes)
//   LOFT_URL=http://127.0.0.1:8820 node test/desk.js [outdir] [only: parts, comma-separated]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/desk';
const ONLY = process.argv[3] || 'fish,moods,glow';
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
// BH-22 put somewhere (Blender axes) and held there for a while, its rounds paused.
const r2At = (p, at, timer = 60) => p.evaluate(([v, tm]) => { const r = __loft.creatures.bh22; Object.assign(r, { state: 'pause', timer: tm, route: [], then: null, pending: null }); r.epoch++; r.pos.set(v.x, v.y, v.z); }, [b2t(...at), timer]);
const eyes = p => p.evaluate(() => { const r = __loft.creatures.bh22; return { mood: __loft.creatures.mood, round: r.round.every(e => e.visible), shapes: r.eye.children.filter(c => !r.round.includes(c) && c.visible).length, colour: r.eyeMat.color.toArray().map(v => +v.toFixed(3)), lit: r.eyeLit.toArray().map(v => +v.toFixed(3)) }; });

(async () => {
  const W = require('../web/assets/world.json');
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
    // ---------- BH-22's eyes ----------
    if (want('moods')) {
      const { ctx, p, errs } = await open(b, DESK);
      const s = W.points.spawn;
      await standAt(p, s, Math.PI);
      await r2At(p, [s[0] + 0.55, s[1] + 0.05, s[2]]);
      const plain = await eyes(p);
      check('its eyes start round, in their own glow', plain.round && plain.shapes === 0 && !plain.mood, JSON.stringify(plain));
      // A close camera on its face.
      const face = async name => {
        await p.evaluate(() => {
          const L = __loft, r = L.creatures.bh22, c = L.camera, f = r.dome.localToWorld(new c.position.constructor(0, 0.075, 0.3));
          if (!c.__free) { c.__free = true; c.position.lerp = function () { return this; }; c.lookAt = function () {}; }
          c.position.copy(f); Object.getPrototypeOf(c).lookAt.call(c, r.dome.localToWorld(new c.position.constructor(0, 0.075, 0)));
        });
        await p.waitForTimeout(250);
        await p.screenshot({ path: path.join(OUT, `eyes-${name}.png`) });
      };
      await face('round');
      for (const [mood, shape] of [['love', 'hearts'], ['happy', 'arcs'], ['dizzy', 'x']]) {
        await p.evaluate(m => __loft.creatures.feel(m), mood);
        await p.waitForTimeout(120);
        const e = await eyes(p);
        await face(shape);
        const glow = mood === 'happy' ? JSON.stringify(e.colour) === JSON.stringify(e.lit) : JSON.stringify(e.colour) !== JSON.stringify(e.lit);
        check(`${mood}: ${shape} in place of the round eyes${mood === 'happy' ? ', in their own glow' : ', in a colour of its own'}`, e.mood === mood && !e.round && e.shapes === 1 && glow, JSON.stringify(e));
      }
      await p.waitForTimeout(3200);
      const after = await eyes(p);
      check('a moment later the round eyes are back, in their full glow', after.round && after.shapes === 0 && JSON.stringify(after.colour) === JSON.stringify(after.lit) && after.lit[1] > 2, JSON.stringify(after));
      // Petted: hearts, and the glow comes back whole after (a pet used to leave the eyes dimmer).
      await p.reload();
      await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
      await p.waitForTimeout(800);
      await standAt(p, s, Math.PI);
      await r2At(p, [s[0] + 0.55, s[1] + 0.05, s[2]]);
      await p.evaluate(() => { const r = __loft.creatures; r.act('bh22', { player: __loft.pos, mode: 'walk', facing: 0 }); r.act('bh22', { player: __loft.pos, mode: 'walk', facing: 0 }); });
      await p.waitForTimeout(150);
      const pet = await eyes(p);
      check('petted: hearts', pet.mood === 'love' && pet.shapes === 1, JSON.stringify(pet));
      await p.waitForTimeout(3500);
      const petAfter = await eyes(p);
      check('after a pet the eyes are back in their full glow', petAfter.round && JSON.stringify(petAfter.colour) === JSON.stringify(petAfter.lit), JSON.stringify(petAfter));
      // Walked into: x x and an oof.
      await r2At(p, [s[0] + 0.9, s[1], s[2]]);
      await standAt(p, [s[0] + 0.3, s[1], s[2]], -Math.PI / 2);
      await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w');
      const bump = await eyes(p);
      check('walked into, it reels: x x', bump.mood === 'dizzy', JSON.stringify(bump));
      check('moods: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- BH-22's eyes keep their glow after a pet (they came back dimmer, read back through a plain colour) ----------
    if (want('glow')) {
      const { ctx, p, errs } = await open(b, DESK);
      const s = W.points.spawn;
      await standAt(p, s, Math.PI);
      await r2At(p, [s[0] + 0.55, s[1] + 0.05, s[2]]);
      const lit = await p.evaluate(() => __loft.creatures.bh22.eyeMat.color.toArray());
      await p.evaluate(() => { const c = __loft.creatures, me = { player: __loft.pos, mode: 'walk', facing: 0 }; c.act('bh22', me); c.act('bh22', me); });
      await p.waitForTimeout(4000);
      const after = await p.evaluate(() => [__loft.creatures.bh22.state, __loft.creatures.bh22.eyeMat.color.toArray()]);
      check('after a pet its eyes glow as brightly as before', after[0] !== 'petted' && after[1].every((v, i) => Math.abs(v - lit[i]) < 1e-6), `${JSON.stringify(lit)} before, ${JSON.stringify(after)} after`);
      check('glow: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

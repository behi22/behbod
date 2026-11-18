// The knight's case and his saber, in a real browser on a computer and on a phone: the old stand-in is gone and the
// knight stands in its place, the saber comes out of the case and lights, a bolt aimed at the blade is blocked and one
// aimed wide gets through, the drone keeps firing on its own, and Esc or the button puts it all back. No page errors,
// no console errors, no failed requests. Pictures go to the out folder.
//   node test/saber.js [outdir]    (LOFT_URL defaults to http://127.0.0.1:8815)
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output/saber';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8815';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!/youtube|googlevideo|ytimg/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200)); });
}
async function open(b, opts) {
  const p = await b.newPage(opts), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'ultra'}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0 && window.__saber, null, { timeout: 120000 });
  await p.waitForTimeout(1200);
  return { p, errs };
}
// Stand on the spot in front of the case.
const toStand = p => p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...(require('../web/assets/world.json').interact.find(i => i.id === 'vader').at)));

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- a computer ----------
    const { p, errs } = await open(b, { viewport: { width: 1280, height: 800 } });
    const built = await p.evaluate(() => {
      const k = __saber.knight, THREE = __loft.camera.constructor;
      // Nothing of the old stand-in left inside the case: every triangle there now belongs to the knight, his base,
      // the case's own glass and steel, or his drone.
      const box = { min: k.root.position.clone(), max: k.root.position.clone() };
      box.min.x -= 0.32; box.min.z -= 0.32; box.min.y += 0.01; box.max.x += 0.32; box.max.z += 0.32; box.max.y += 0.7;
      let stray = 0;
      const mine = o => { for (let q = o; q; q = q.parent) if (q.name === 'knight' || q.name === 'saber_drone') return true; return false; };
      const v = k.root.position.clone();
      __loft.scene.traverse(o => {
        if (!o.isMesh || !o.visible || mine(o) || o.isSkinnedMesh) return;
        const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
        o.updateWorldMatrix(true, false);
        for (let i = 0; i < n; i += 3) {
          let inside = 0;
          for (let j = 0; j < 3; j++) {
            v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(o.matrixWorld);
            if (v.x > box.min.x && v.x < box.max.x && v.y > box.min.y && v.y < box.max.y && v.z > box.min.z && v.z < box.max.z) inside++;
          }
          if (inside === 3) stray++;
        }
      });
      return { removed: k.removed, stray, out: k.out, figure: !!__loft.scene.getObjectByName('knight_lacquer') };
    });
    check('the stand-in is cut out of the room and the knight stands in the case', built.removed > 100 && built.stray === 0 && built.figure && !built.out, JSON.stringify(built));

    // The sound on (the test browser sends it all into a silent node), so every sound below really runs.
    await p.click('#snd');
    await toStand(p);
    await p.waitForTimeout(500);
    const offer = await p.evaluate(() => [__loft.near, document.getElementById('prompt').textContent, document.getElementById('prompt').classList.contains('on'), __loft.audio.saber.humming.join()]);
    check('at the case it offers the saber, and the saber in the case hums', offer[0] === 'vader' && /Take the saber/.test(offer[1]) && offer[2] && offer[3] === 'case', JSON.stringify(offer));

    await p.keyboard.press('KeyE');
    await p.waitForTimeout(1300);
    const held = await p.evaluate(() => ({ mode: __loft.mode, active: __saber.active, out: __saber.knight.out, hud: !!document.querySelector('.sb-hud'), lit: __saber.lit, head: __loft.headVisible }));
    check('E takes the saber: first person, the case opens, the saber is in the hand, unlit', held.mode === 'saber' && held.active && held.out && held.hud && !held.lit && !held.head, JSON.stringify(held));

    await p.keyboard.press('Space');
    await p.waitForTimeout(400);
    const lit = await p.evaluate(() => ({ lit: __saber.lit, k: __saber.blade.k, button: document.querySelector('.sb-bar button')?.textContent, humming: __loft.audio.saber.humming.join() }));
    check('Space lights it and it hums in the hand', lit.lit && lit.k > 0.99 && lit.button === 'Switch off' && lit.humming === 'hand', JSON.stringify(lit));

    const a0 = await p.evaluate(() => __saber.blade.b);
    await p.mouse.move(200, 600);
    await p.waitForTimeout(300);
    await p.mouse.move(1100, 200, { steps: 4 });
    await p.screenshot({ path: `${OUT}/desk-swing.png` });
    await p.waitForTimeout(300);
    const a1 = await p.evaluate(() => __saber.blade.b);
    check('the blade follows the mouse', a1[0] > a0[0] + 0.1 && a1[1] > a0[1], `${a0.map(v => v.toFixed(2))} -> ${a1.map(v => v.toFixed(2))}`);
    await p.screenshot({ path: `${OUT}/desk-lit.png` });

    // A bolt straight at the blade is blocked; one wide of it gets through (the drone holds its own fire meanwhile).
    await p.evaluate(() => __saber.hold(true));
    await p.waitForTimeout(1500);
    const before = await p.evaluate(() => ({ ...__saber.training }));
    await p.evaluate(() => __saber.test('hit'));
    await p.waitForTimeout(1600);
    const afterHit = await p.evaluate(() => ({ blocked: __saber.training.blocked, streak: __saber.training.streak, best: __saber.best }));
    check('a bolt at the blade is blocked', afterHit.blocked === before.blocked + 1 && afterHit.streak >= 1, JSON.stringify(afterHit));
    await p.evaluate(() => __saber.test('wide'));
    await p.waitForTimeout(1800);
    const afterWide = await p.evaluate(() => ({ stung: __saber.training.stung, streak: __saber.training.streak }));
    check('a bolt wide of the blade gets through', afterWide.stung === before.stung + 1 && afterWide.streak === 0, JSON.stringify(afterWide));

    // Left alone, the drone warns and fires by itself.
    await p.evaluate(() => __saber.hold(false));
    const shots0 = await p.evaluate(() => __saber.training.shots);
    await p.waitForTimeout(6000);
    const shots1 = await p.evaluate(() => __saber.training.shots);
    check('the drone keeps firing on its own', shots1 >= shots0 + 2, `${shots0} -> ${shots1}`);
    await p.screenshot({ path: `${OUT}/desk-training.png` });

    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const left = await p.evaluate(() => ({ mode: __loft.mode, hud: !!document.querySelector('.sb-hud, .sb-bar'), head: __loft.headVisible, humming: __loft.audio.saber.humming }));
    await p.waitForTimeout(1800);
    const back = await p.evaluate(() => ({ out: __saber.knight.out, drone: __saber.drone.distanceTo(__saber.knight.root.position) }));
    check('Esc puts it back: walking again, the saber and the drone back in the case', left.mode === 'walk' && !left.hud && left.head && !back.out && back.drone < 0.4, JSON.stringify({ ...left, ...back }));
    // Twice in a row, to be sure it can be taken again.
    await p.keyboard.press('KeyE');
    await p.waitForTimeout(900);
    const again = await p.evaluate(() => __loft.mode);
    await p.keyboard.press('KeyE');
    await p.waitForTimeout(300);
    check('it can be taken again and E also puts it back', again === 'saber' && (await p.evaluate(() => __loft.mode)) === 'walk');
    check('computer: no page errors, console errors or failed requests', !errs.length, errs.slice(0, 5).join(' | '));
    await p.close();

    // ---------- a phone ----------
    const ph = await open(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const q = ph.p;
    await toStand(q);
    await q.waitForTimeout(500);
    await q.tap('#use');
    await q.waitForTimeout(1300);
    check('phone: Use takes the saber', (await q.evaluate(() => __loft.mode)) === 'saber');
    await q.tap('.sb-bar button.hot');
    await q.waitForTimeout(400);
    check('phone: the button lights it', await q.evaluate(() => __saber.lit));
    const t0 = await q.evaluate(() => __saber.blade.b);
    await q.evaluate(() => {
      const c = document.getElementById('view'), ev = (type, x, y) => new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1, bubbles: true });
      c.dispatchEvent(ev('pointerdown', 80, 700)); window.dispatchEvent(ev('pointermove', 200, 500)); window.dispatchEvent(ev('pointermove', 330, 300));
    });
    await q.waitForTimeout(400);
    const t1 = await q.evaluate(() => __saber.blade.b);
    check('phone: a finger drag moves the blade', t1[0] > t0[0] + 0.03 && t1[1] > t0[1], `${t0.map(v => v.toFixed(2))} -> ${t1.map(v => v.toFixed(2))}`);
    const fit = await q.evaluate(() => {
      const r = el => el.getBoundingClientRect(), inView = e => { const b = r(e); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; };
      const parts = [...document.querySelectorAll('.sb-hud, .sb-bar button, .sb-bar .hint')];
      return { all: parts.every(inView), wide: document.documentElement.scrollWidth <= innerWidth, n: parts.length };
    });
    check('phone: every control is on screen and nothing scrolls sideways', fit.all && fit.wide && fit.n === 4, JSON.stringify(fit));
    await q.evaluate(() => __saber.test('hit'));
    await q.waitForTimeout(1600);
    check('phone: a bolt at the blade is blocked', (await q.evaluate(() => __saber.training.blocked)) >= 1);
    await q.screenshot({ path: `${OUT}/phone-lit.png` });
    await q.tap('.sb-bar button:not(.hot)');
    await q.waitForTimeout(400);
    check('phone: Put it back returns to walking', (await q.evaluate(() => __loft.mode)) === 'walk');
    check('phone: no page errors, console errors or failed requests', !ph.errs.length, ph.errs.slice(0, 5).join(' | '));
    await q.close();
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'all PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

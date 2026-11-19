// Team colours for the football games in a real Chrome, and the dust motes gone.
//   LOFT_URL=http://127.0.0.1:8815 node test/studio.js [outdir] [only: kits,phone,stored,motes]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/studio';
const ONLY = process.argv[3] || 'all';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const b2t = (x, y, z) => ({ x, y: z, z: -y });

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
async function open(b, opts, { ctx = null, query = '', init = null } = {}) {
  ctx ||= await b.newContext(opts);
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}${query}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  return { ctx, p, errs };
}
const standAt = async (p, at, yaw) => { await p.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); if (yw !== undefined) __loft.yaw = yw; }, [b2t(...at), yaw]); await p.waitForTimeout(500); };
// Which swatch each kit row shows as picked, and what its line says.
const rows = p => p.evaluate(() => [...document.querySelectorAll('.g-kit')].map(r => ({ name: r.querySelector('.g-kit-name').textContent, on: [...r.querySelectorAll('[aria-pressed="true"]')].map(s => s.dataset.kit) })));
// How many pixels of a canvas (or of the room's TV, 'tv') sit within a few steps of a colour.
const near = (p, sel, hex) => p.evaluate(([s, h]) => {
  const c = s === 'tv' ? __loft.screens.textures.tv.image : document.querySelector(s);
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, n = parseInt(h.slice(1), 16), R = n >> 16, G = (n >> 8) & 255, B = n & 255;
  let k = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - R) < 7 && Math.abs(d[i + 1] - G) < 7 && Math.abs(d[i + 2] - B) < 7) k++;
  return k;
}, [sel, hex]);

(async () => {
  const K = await import('../web/src/games/pure/kits.js');
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    // ---------- the kits, at a computer: mouse and keyboard ----------
    if (want('kits')) {
      const { ctx, p, errs } = await open(b, DESK);
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      let r = await rows(p);
      check('the TV menu shows the kit row on both match cards, the first kit picked', r.length === 2 && r.every(x => x.on.join() === 'home' && x.name === 'Your kit: White and purple'), JSON.stringify(r));
      const cards = await p.evaluate(() => [...document.querySelectorAll('.g-card')].map(c => [c.querySelector('h2').textContent, !!c.querySelector('.g-kit'), c.querySelectorAll('.g-kit-sw').length]));
      check('only the two match cards carry it, six kits each', JSON.stringify(cards) === JSON.stringify([['Join as striker', true, 6], ['Join as keeper', true, 6], ['Watch my videos', false, 0], ['Watch my film', false, 0]]), JSON.stringify(cards));
      const focus0 = await p.evaluate(() => document.activeElement.textContent);
      check('the menu still opens with Play in focus', focus0 === 'Play', focus0);
      await p.screenshot({ path: path.join(OUT, 'tv-menu.png') });
      // The mouse.
      await p.click('.g-card:has-text("Join as keeper") [data-kit="sky"]');
      r = await rows(p);
      check('a click picks it, and both rows show it', r.every(x => x.on.join() === 'sky' && x.name === 'Your kit: Sky blue'), JSON.stringify(r));
      check('the pick is remembered in this browser', (await p.evaluate(() => localStorage.getItem('loft.kit'))) === 'sky');
      // The keyboard: from the first Play, back one to the last swatch of that card, and Space or Enter picks it.
      await p.evaluate(() => document.querySelector('.g-card .g-main').focus());
      await p.keyboard.press('Shift+Tab');
      const onRed = await p.evaluate(() => document.activeElement.dataset.kit);
      await p.keyboard.press('Space');
      await p.waitForTimeout(100);
      r = await rows(p);
      check('Shift+Tab reaches the swatches and Space picks one', onRed === 'red' && r.every(x => x.on.join() === 'red'), `${onRed} ${JSON.stringify(r)}`);
      await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Enter');
      await p.waitForTimeout(100);
      r = await rows(p);
      check('Enter picks too', r.every(x => x.on.join() === 'sky'), JSON.stringify(r));
      check('the menu is still open and the room did not move', await p.evaluate(() => !!document.querySelector('.g-menu') && __loft.mode === 'walk'));
      // The match, in the kit.
      await p.click('.g-card:has-text("Join as striker") .g-main');
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1500);
      const sky = await near(p, '.g-stage canvas', '#7cc4ff');
      await p.screenshot({ path: path.join(OUT, 'match-sky.png') });
      check('the match is played in the picked kit', sky > 200, `${sky} sky blue pixels`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      // Striker 22 from the arcade, in another kit; the console goes straight in, in the last pick.
      await p.evaluate(() => __loft.act('arcade'));
      await p.waitForSelector('.g-kit');
      r = await rows(p);
      const arcade = await p.evaluate(() => [...document.querySelectorAll('.g-card')].map(c => [c.querySelector('h2').textContent, c.querySelectorAll('.g-kit-sw').length]));
      check('the arcade shows the kit row on Striker 22 only, with the pick', r.length === 1 && r[0].on.join() === 'sky' && JSON.stringify(arcade) === JSON.stringify([['Skills Shooter', 0], ['Striker 22', 6]]), JSON.stringify([r, arcade]));
      await p.click('.g-card:has-text("Striker 22") [data-kit="red"]');
      await p.click('.g-card:has-text("Striker 22") .g-main');
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1200);
      const red = await near(p, '.g-stage canvas', '#d7263d');
      await p.screenshot({ path: path.join(OUT, 'striker-red.png') });
      check('Striker 22 is played in the picked kit', red > 300, `${red} red pixels`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      await p.evaluate(() => __loft.act('console'));
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1200);
      const red2 = await near(p, '.g-stage canvas', '#d7263d');
      check('the console\'s Striker 22 wears the last pick', red2 > 300, `${red2} red pixels`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      // Black: the bots change into their light kit.
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      await p.click('.g-card:has-text("Join as striker") [data-kit="black"]');
      await p.click('.g-card:has-text("Join as striker") .g-main');
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1500);
      const light = await near(p, '.g-stage canvas', K.BOTS.light.shirt), dark = await near(p, '.g-stage canvas', K.BOTS.dark.shirt);
      await p.screenshot({ path: path.join(OUT, 'match-black.png') });
      check('against a black kit the bots play in their light kit', light > 1000 && dark < light / 20, `${light} light, ${dark} dark`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      // The room's own TV shows the match in the pick.
      await p.evaluate(async () => (await import('/src/games/kit.js')).setKit('sky'));
      await standAt(p, [4.2, 10.6, 0], Math.PI / 2);
      await p.waitForTimeout(2500);
      const tv = await near(p, 'tv', '#7cc4ff');
      check('the TV in the room shows BEHI FC in the pick', tv > 20, `${tv} sky blue pixels on the TV`);
      check('kits: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- a phone: taps ----------
    if (want('phone')) {
      const { ctx, p, errs } = await open(b, UPRIGHT);
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      await p.waitForTimeout(500);
      const size = await p.evaluate(() => { const r = document.querySelector('.g-kit-sw').getBoundingClientRect(); return [r.width, r.height]; });
      check('on a phone the swatches are big enough for a thumb', size[0] >= 38 && size[1] >= 38, size.join('x'));
      const sw = p.locator('.g-card:has-text("Join as striker") [data-kit="teal"]');
      await sw.scrollIntoViewIfNeeded();
      await sw.tap();
      const r = await rows(p);
      check('a tap picks a kit', r.every(x => x.on.join() === 'teal'), JSON.stringify(r));
      const fit = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, cards: [...document.querySelectorAll('.g-card')].every(c => { const q = c.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth; }) }));
      check('the menu fits the phone across', fit.over <= 0 && fit.cards, JSON.stringify(fit));
      await p.screenshot({ path: path.join(OUT, 'phone-tv-menu.png') });
      const play = p.locator('.g-card:has-text("Join as striker") .g-main');
      await play.scrollIntoViewIfNeeded();
      await play.tap();
      await p.waitForSelector('.g-stage canvas');
      await p.waitForTimeout(1500);
      const teal = await near(p, '.g-stage canvas', '#2fc9ac');
      check('the match on a phone is in the picked kit', teal > 50, `${teal} teal pixels`);
      await p.screenshot({ path: path.join(OUT, 'phone-match-teal.png') });
      check('phone: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the pick kept, and a browser that keeps nothing ----------
    if (want('stored')) {
      const ctx = await b.newContext(DESK);
      let { p, errs } = await open(b, DESK, { ctx });
      await p.evaluate(() => __loft.act('arcade'));
      await p.waitForSelector('.g-kit');
      await p.click('[data-kit="purple"]');
      await p.reload();
      await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      const r = await rows(p);
      check('after a reload the pick is still there', r.every(x => x.on.join() === 'purple'), JSON.stringify(r));
      check('stored: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
      // Storage that throws (blocked site data): the games open, the first kit shows, a pick holds for the visit.
      // (Only the house's own page: YouTube's frame on the wall has its own storage and its own errors.)
      const blocked = () => { if (window.top !== window) return; const no = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = no; Storage.prototype.setItem = no; };
      ({ p, errs } = await open(b, DESK, { init: blocked }));
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-kit');
      const r0 = await rows(p);
      await p.click('.g-card:has-text("Join as striker") [data-kit="black"]');
      const r1 = await rows(p);
      check('with storage blocked the first kit shows and a pick still works', r0.every(x => x.on.join() === 'home') && r1.every(x => x.on.join() === 'black'), JSON.stringify([r0, r1]));
      check('blocked storage: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.context().close();
    }
    // ---------- the dust motes are gone; the light switch still works ----------
    if (want('motes')) {
      const { ctx, p, errs } = await open(b, DESK);
      const pts = await p.evaluate(() => { const out = []; __loft.scene.traverse(o => { if (o.isPoints) out.push(o.geometry.attributes.position.count); }); return out; });
      check('no dust motes in the air', !pts.includes(420), JSON.stringify(pts));
      await p.evaluate(() => __lights.set(false)); await p.waitForTimeout(900);
      const off = await p.evaluate(() => ({ k: __lights.k, room: __lights.uniforms.room.value.toArray() }));
      await p.evaluate(() => __lights.set(true)); await p.waitForTimeout(900);
      const on = await p.evaluate(() => ({ k: __lights.k, room: __lights.uniforms.room.value.toArray() }));
      check('the light switch still turns the room down and back exactly', off.k === 0 && off.room.every(v => v < 1) && on.k === 1 && on.room.every(v => v === 1), JSON.stringify({ off, on }));
      check('motes: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

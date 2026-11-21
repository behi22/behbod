// The lounge's half of R4 in a real Chrome: the khatam on the backgammon boards and the Shahnameh on the mezzanine
// opening the reader, at a desk and on phones.
//   LOFT_URL=http://127.0.0.1:8823 node test/lounge.js [outdir] [parts]
// Parts: khatam, game, reader, phone.
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/lounge';
const ONLY = process.argv[3] || 'khatam,game,reader,phone';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;
const BOOK = { spot: [5.0, 2.05, 3.0], at: [5.02, 2.7, 3.48] };

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[loft\]|GL_INVALID|WebGL/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
async function open(b, opts, query = '') {
  const p = await b.newPage(opts), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}${query}`);
  await p.waitForFunction(() => { if (window.__loft && __loft.renderer.info.render.calls > 0) { window.__up ||= performance.now(); return true; } return false; }, null, { timeout: 120000 });
  await p.evaluate(() => { const g = document.getElementById('gate'); if (g) g.style.display = 'none'; });
  await p.waitForTimeout(600);
  return { p, errs };
}
async function standAt(p, at, facing) {
  await p.evaluate(([v, f]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); if (f) __loft.yaw = Math.atan2(-(f.x - v.x), -(f.z - v.z)); }, [b2t(...at), facing ? b2t(...facing) : null]);
  await p.waitForTimeout(500);
}
const prompt = p => p.evaluate(() => (document.getElementById('prompt').classList.contains('on') ? document.getElementById('prompt').lastChild.nodeValue : ''));
const panel = p => p.evaluate(() => {
  const r = document.querySelector('.pn');
  if (!r) return null;
  const box = r.querySelector('.pn-box').getBoundingClientRect();
  return { title: r.querySelector('h2')?.firstChild?.nodeValue, box: [box.left, box.top, box.right, box.bottom], w: innerWidth, h: innerHeight, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
});
// Where a point (Blender axes) lands on the screen.
const onScreen = (p, at) => p.evaluate(v => {
  const c = __loft.camera, q = c.position.clone().set(v.x, v.y, v.z).project(c);
  return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, z: q.z };
}, b2t(...at));
// A still from any eye with the character hidden, at w by h.
const shot = async (p, name, eye, at, w = 960, h = 600, fov = 50) => {
  const url = await p.evaluate(async ([e, a, w, h, fov]) => {
    const L = __loft, c = L.camera.clone(), r = L.renderer, THREE = await import('three');
    c.position.set(e.x, e.y, e.z); c.lookAt(a.x, a.y, a.z); c.fov = fov; c.aspect = w / h; c.near = 0.02; c.updateProjectionMatrix();
    const pr = r.getPixelRatio(), size = r.getSize(new THREE.Vector2());
    r.setPixelRatio(1); r.setSize(w, h, false);
    const vis = L.me.root.visible; L.me.root.visible = false;
    r.render(L.scene, c);
    const out = r.domElement.toDataURL('image/png');
    L.me.root.visible = vis; r.setPixelRatio(pr); r.setSize(size.x, size.y, false);
    return out;
  }, [b2t(...eye), b2t(...at), w, h, fov]);
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
};
// How many pixels of a canvas (or a part of it) are near each of the khatam's materials.
const MATS = { bone: [236, 226, 200], brass: [201, 162, 78], green: [47, 106, 76] };
const materials = (p, sel, rect) => p.evaluate(([sel, rect, mats]) => {
  const c = typeof sel === 'string' ? document.querySelector(sel) : __loft.screens.textures[sel.texture].image;
  if (!c) return null;
  const [x, y, w, h] = rect || [0, 0, c.width, c.height];
  const d = c.getContext('2d').getImageData(x, y, w, h).data, n = {};
  for (const k of Object.keys(mats)) n[k] = 0;
  for (let i = 0; i < d.length; i += 4) for (const [k, m] of Object.entries(mats)) if (Math.abs(d[i] - m[0]) + Math.abs(d[i + 1] - m[1]) + Math.abs(d[i + 2] - m[2]) < 40) n[k]++;
  return { ...n, all: w * h, size: [c.width, c.height] };
}, [sel, rect, MATS]);

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    if (want('khatam')) {
      const { p, errs } = await open(b, DESK);
      const fetched = () => p.evaluate(() => performance.getEntriesByType('resource').find(e => /\/src\/khatam\.js/.test(e.name))?.startTime ?? null);
      check('the khatam board is not drawn while the house loads', (await fetched()) === null);
      // Painted a step at a time, it goes on the table in one go when whole: wait for green in its frame.
      await p.waitForFunction(() => { const d = __loft.screens.textures.backgammon.image.getContext('2d').getImageData(0, 0, 920, 26).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 47) + Math.abs(d[i + 1] - 106) + Math.abs(d[i + 2] - 76) < 40) n++; return n > 200; }, null, { timeout: 30000, polling: 100 });
      const up = await p.evaluate(() => window.__up), at = await fetched();
      check('the khatam is fetched a few seconds after the house is up, not with it', at - up > 2500, `${Math.round(at - up)} ms after`);
      const band = await materials(p, { texture: 'backgammon' }, [0, 0, 920, 26]), bar = await materials(p, { texture: 'backgammon' }, [444, 26, 32, 588]);
      const field = await materials(p, { texture: 'backgammon' }, [60, 300, 300, 40]);
      check('the balcony board is drawn at 2 px to the mm', band?.size.join('x') === '920x640', band?.size.join('x'));
      check('its frame is khatam: bone, brass and green pieces in the band', band.bone > band.all * 0.06 && band.brass > band.all * 0.03 && band.green > band.all * 0.02, JSON.stringify(band));
      check('so is the bar down its middle', bar.bone > bar.all * 0.06 && bar.brass > bar.all * 0.03 && bar.green > bar.all * 0.02, JSON.stringify(bar));
      check('the fields between the points stay plain walnut', field.bone === 0 && field.green === 0, JSON.stringify(field));
      await standAt(p, [15.7, 16.05, 0], [15, 16.6]);
      await p.waitForTimeout(1200);
      await p.screenshot({ path: path.join(OUT, 'board-stand.png') });
      await shot(p, 'board-close', [15.0, 16.12, 1.25], [15.0, 16.6, 0.8]);
      await shot(p, 'board-corner', [15.12, 16.44, 0.97], [15.2, 16.72, 0.8], 960, 600, 40);
      check('khatam: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }

    if (want('game')) {
      const { p, errs } = await open(b, DESK);
      await standAt(p, [15, 15.65, 0]);
      await p.keyboard.press('KeyE');
      await p.waitForSelector('.g-bg-board canvas', { timeout: 20000 });
      await p.waitForTimeout(700);
      const m = await materials(p, '.g-bg-board canvas');
      check('the game board is inlaid with khatam (bone, brass and green pieces)', m && m.green > 300 && m.brass > 300, JSON.stringify(m));
      await p.screenshot({ path: path.join(OUT, 'game-desk.png') });
      check('game: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }

    if (want('reader')) {
      const { p, errs } = await open(b, DESK);
      await standAt(p, BOOK.spot, BOOK.at);
      check('at the side table: E offers the Shahnameh', (await prompt(p)) === 'Read the Shahnameh', await prompt(p));
      await p.evaluate(() => __loft.screens.desktop.readerGo('read:labours'));
      const before = await p.evaluate(() => __loft.pos.toArray());
      await p.keyboard.press('KeyE'); await p.waitForTimeout(500);
      const r = await p.evaluate(() => {
        const box = document.querySelector('.pn');
        return box && { title: box.querySelector('h2').firstChild.nodeValue, tabs: [...box.querySelectorAll('.lp-tabs button')].map(b => b.textContent), on: box.querySelector('.lp-tabs button.on')?.textContent, story: box.querySelector('.lp-text h3 span')?.textContent, fa: box.querySelector('.lp-fa')?.textContent, paras: box.querySelectorAll('.lp-text p').length, pic: box.querySelector('canvas.lp-pic')?.getAttribute('aria-label') };
      });
      check('E opens the reader at the story the computer last showed', r?.title === 'SHAHNAMEH' && r.tabs.join() === 'Zal,Seven Labours,Siavash,Sohrab' && r.on === 'Seven Labours' && r.story === 'The Seven Labours of Rostam' && r.paras === 4 && /Rakhsh/.test(r.pic), JSON.stringify(r));
      const lit = () => p.evaluate(() => { const c = document.querySelector('.pn canvas.lp-pic'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 150) n++; return n; });
      check('its picture is painted', (await lit()) > 2000, `${await lit()}`);
      await p.screenshot({ path: path.join(OUT, 'reader-desk.png') });
      await p.click('.pn .lp-tabs button:text-is("Siavash")'); await p.waitForTimeout(400);
      const s = await p.evaluate(() => [document.querySelector('.pn .lp-text h3 span')?.textContent, __loft.screens.desktop.reader.story, document.querySelector('.pn .lp-tabs button.on')?.getAttribute('aria-pressed')]);
      check('a tab turns to that story, on the computer too', s[0] === 'Siavash and the Fire' && s[1] === 'siavash' && s[2] === 'true', s.join(' | '));
      check('and its picture is painted', (await lit()) > 2000);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      const after = await p.evaluate(() => [__loft.pos.toArray(), __loft.mode, !!document.querySelector('.pn')]);
      check('Esc closes it and I am still at the table', !after[2] && after[1] === 'walk' && after[0].every((v, i) => Math.abs(v - before[i]) < 0.02), JSON.stringify(after));
      // From across the mezzanine, a click on the book walks there and opens it.
      await standAt(p, [3.2, 2.6, 3.0], BOOK.at);
      await p.waitForTimeout(1200);
      const at = await onScreen(p, BOOK.at);
      await p.mouse.click(at.x, at.y);
      await p.waitForFunction(() => document.querySelector('.pn h2')?.firstChild?.nodeValue === 'SHAHNAMEH', null, { timeout: 15000 }).catch(() => {});
      check('a click on the book walks me over and opens the reader', (await panel(p))?.title === 'SHAHNAMEH', JSON.stringify(at));
      await p.click('.pn .pn-box h2 button'); await p.waitForTimeout(300);
      check('Close closes it', !(await panel(p)));
      await shot(p, 'book-close', [5.45, 2.2, 3.95], [5.02, 2.7, 3.45], 960, 600, 45);
      check('reader: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }

    if (want('phone')) {
      for (const [name, opts] of [['upright', UPRIGHT], ['sideways', SIDEWAYS]]) {
        const { p, errs } = await open(b, opts);
        const use = async () => { const r = await p.evaluate(() => { const e = document.getElementById('use').getBoundingClientRect(); return [e.x + e.width / 2, e.y + e.height / 2]; }); await p.touchscreen.tap(...r); await p.waitForTimeout(500); };
        for (const [spot, title] of [[BOOK.spot, 'SHAHNAMEH']]) {
          await standAt(p, spot);
          await use();
          await p.waitForTimeout(900);
          const pn = await panel(p);
          check(`${name}: Use opens ${title}, inside the screen, nothing sideways`, pn?.title === title && pn.box[0] >= 0 && pn.box[2] <= pn.w + 0.5 && pn.box[3] <= pn.h + 0.5 && !pn.sideways, JSON.stringify(pn));
          await p.screenshot({ path: path.join(OUT, `phone-${name}-${title.toLowerCase().replace(' ', '-')}.png`) });
          const close = await p.evaluate(() => { const e = document.querySelector('.pn h2 button').getBoundingClientRect(); return [e.x + e.width / 2, e.y + e.height / 2, e.height]; });
          await p.touchscreen.tap(close[0], close[1]); await p.waitForTimeout(300);
          check(`${name}: Close is big enough to tap and closes ${title}`, !(await panel(p)) && close[2] >= 24, `${close[2]} px tall`);
        }
        check(`${name}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
        await p.close();
      }
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

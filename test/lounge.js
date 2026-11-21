// The khatam on the backgammon boards in a real Chrome: the one on the balcony table and the one you play on.
//   LOFT_URL=http://127.0.0.1:8823 node test/lounge.js [outdir] [parts]
// Parts: khatam, game.
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/lounge';
const ONLY = process.argv[3] || 'khatam,game';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo/;

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
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

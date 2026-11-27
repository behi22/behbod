// The lounge's half of R4 in a real Chrome: the khatam on the backgammon boards, the game shelf and its covers, the
// Shahnameh on the mezzanine opening the reader, and the project frames up the stairs, at a desk and on phones.
//   LOFT_URL=http://127.0.0.1:8823 node test/lounge.js [outdir] [parts]
// Parts: covers, khatam, game, shelf, reader, frames, phone, and inlay and smooth (they time the page: run them alone,
// under `timing`).
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/lounge';
const ONLY = process.argv[3] || 'covers,khatam,game,shelf,reader,frames,phone';
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
const SHELF = { spot: [1.08, 12.5, 0], at: [0.6, 12.47, 1.18] };

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
// The prompt once it says `want`, or whatever it says after 3 s: a body landing on a busy machine can take a while.
const promptIs = async (p, want) => { await p.waitForFunction(w => document.getElementById('prompt').classList.contains('on') && document.getElementById('prompt').lastChild.nodeValue === w, want, { timeout: 3000 }).catch(() => {}); return prompt(p); };
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
    if (want('covers')) {
      // The covers on their own, as the games panel paints them: each scene's pieces inside the frame.
      const p = await b.newPage(DESK), errs = [];
      watch(p, errs);
      await p.goto(`${BASE}/dev/lounge.html`);
      const banner = await p.evaluate(async () => {
        const { paintCover } = await import('/src/covers.js'), { GAMES } = await import('/src/pure/shelf.js');
        const i = GAMES.findIndex(g => g.id === 'ac'), game = GAMES[i], c = document.createElement('canvas');
        c.width = 320; c.height = 396;
        const g = c.getContext('2d');
        paintCover(g, game, i + 1, 320, 396);
        const a = [1, 3, 5].map(k => parseInt(game.accent.slice(k, k + 2), 16)), count = (y0, y1) => {
          const d = g.getImageData(0, y0, 320, y1 - y0).data;
          let n = 0;
          for (let k = 0; k < d.length; k += 4) if (Math.abs(d[k] - a[0]) + Math.abs(d[k + 1] - a[1]) + Math.abs(d[k + 2] - a[2]) < 40) n++;
          return n;
        };
        return { inside: count(20, 100), edge: count(0, 8) };
      });
      check('the red banner on the bell tower flies inside the cover, not cut off at its top', banner.inside > 200 && banner.edge === 0, JSON.stringify(banner));
      // Their cost on a slow phone was mostly the grain, a thousand and more dots one at a time.
      const calls = await p.evaluate(async () => {
        const { paintCover, paintSpine } = await import('/src/covers.js'), { GAMES } = await import('/src/pure/shelf.js');
        const P = CanvasRenderingContext2D.prototype, names = ['fillRect', 'fill', 'stroke', 'strokeRect', 'fillText'], was = names.map(k => P[k]);
        let n = 0;
        names.forEach((k, i) => { P[k] = function (...a) { n++; return was[i].apply(this, a); }; });
        const per = [];
        try {
          for (const game of GAMES) { const c = document.createElement('canvas'); c.width = 320; c.height = 396; n = 0; paintCover(c.getContext('2d'), game, 1, 320, 396); per.push(n); }
          const c = document.createElement('canvas'); c.width = 48; c.height = 768; n = 0; paintSpine(c.getContext('2d'), GAMES[0], 1, 48, 768); per.push(n);
        } finally { names.forEach((k, i) => { P[k] = was[i]; }); }
        return per;
      });
      check('each cover and spine takes a few hundred drawing calls, its grain one fill', Math.max(...calls) < 1200, calls.join(' '));
      // Drawn on the processor, as the shelf and the panel draw them: nothing may wait on the graphics card to read a picture back.
      const traced = path.join(OUT, 'covers-trace.json');
      await b.startTracing(p, { path: traced, categories: ['gpu', 'devtools.timeline', 'disabled-by-default-devtools.timeline'] });
      await p.evaluate(async () => {
        const { paintCover } = await import('/src/covers.js'), { GAMES } = await import('/src/pure/shelf.js');
        GAMES.forEach((game, i) => { const c = document.createElement('canvas'); c.width = 320; c.height = 396; paintCover(c.getContext('2d', { willReadFrequently: true }), game, i + 1, 320, 396); });
      });
      await b.stopTracing();
      const events = JSON.parse(fs.readFileSync(traced, 'utf8')).traceEvents;
      fs.unlinkSync(traced);
      const readbacks = events.filter(e => e.name === 'RasterImplementation::ReadbackImagePixels' && e.ph !== 'E').length;
      check('painting the twenty covers reads nothing back from the graphics card', readbacks === 0, `${readbacks} readbacks`);
      check('covers: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }

    if (want('khatam')) {
      const { p, errs } = await open(b, DESK);
      const fetched = () => p.evaluate(() => performance.getEntriesByType('resource').find(e => /\/src\/khatam\.js/.test(e.name))?.startTime ?? null);
      check('the khatam board is not drawn while the house loads', (await fetched()) === null);
      await p.evaluate(() => { window.__boardCanvas = __loft.screens.textures.backgammon.image; });
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
      // Painted into the table's own canvas, so whatever sends that canvas to the graphics card sends the khatam.
      check('the khatam is painted into the table\'s own canvas', await p.evaluate(() => __loft.screens.textures.backgammon.image === window.__boardCanvas));
      const onCard = await p.evaluate(async () => {
        const THREE = await import('three'), r = __loft.renderer, t = __loft.screens.textures.backgammon;
        const target = new THREE.WebGLRenderTarget(920, 640), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), scene = new THREE.Scene();
        target.texture.colorSpace = THREE.SRGBColorSpace;
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
        scene.add(quad);
        const was = r.getRenderTarget();
        r.setRenderTarget(target); r.render(scene, cam); r.setRenderTarget(was);
        const d = new Uint8Array(920 * 640 * 4);
        r.readRenderTargetPixels(target, 0, 0, 920, 640, d);
        target.dispose(); quad.geometry.dispose(); quad.material.dispose();
        let green = 0;
        for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 47) + Math.abs(d[i + 1] - 106) + Math.abs(d[i + 2] - 76) < 40) green++;
        return green;
      });
      check('and the graphics card holds it: green pieces in the table\'s picture', onCard > 1500, `${onCard} green`);
      await standAt(p, [15.7, 16.05, 0], [15, 16.6]);
      await p.waitForTimeout(1200);
      await p.screenshot({ path: path.join(OUT, 'board-stand.png') });
      await shot(p, 'board-close', [15.0, 16.12, 1.25], [15.0, 16.6, 0.8]);
      await shot(p, 'board-corner', [15.12, 16.44, 0.97], [15.2, 16.72, 0.8], 960, 600, 40);
      check('khatam: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }

    if (want('inlay')) {
      // The balcony board is inlaid a few steps at a time: in quiet moments on his laptop at ultra, where the graphics
      // card is busiest, and on a phone 4x slower, and on timers on that phone with no requestIdleCallback and in
      // WebKit at phone size, as in Safari. Each slice that paints it is timed in the page, and in Chrome a trace times
      // the page's other tasks from the first slice until 300 ms after the board is on the table, leaving out the
      // house's frames and its own quiet-moment work. The WebKit
      // leg runs Safari's engine at all (errors, slices): earlier versions pass it too. WebKit at ultra is left out:
      // under Playwright it draws the house at about 12 frames a second and its slices wait on those frames, main's
      // too. Failed before: the strips were filled from tiles on the graphics card and the last step waited for them,
      // 35 to 66 ms at ultra; then a worker fetched the tiles and its shutting down held the page 12 to 22 ms; then,
      // with no requestIdleCallback, a slice came only once a second and the board took 13 s against main's 10.
      const timeInlay = () => {
        window.__inlay = [];
        // The slices that paint (not the one that loads the module), whether they come as idle callbacks or as timers.
        const wrap = cb => (typeof cb !== 'function' || !/steps\.next\(\)\.done/.test(String(cb)) ? cb : function (...a) {
          const t = performance.now();
          console.timeStamp?.('inlay step');
          try { return cb.apply(this, a); } finally { window.__inlay.push({ at: t, ms: +(performance.now() - t).toFixed(1), paint: !/import\(/.test(String(cb)) }); }
        });
        const ric = window.requestIdleCallback, st = window.setTimeout;
        if (ric) window.requestIdleCallback = (cb, o) => ric.call(window, wrap(cb), o);
        window.setTimeout = (cb, ...a) => st.call(window, wrap(cb), ...a);
      };
      // The longest task on the page's main thread while the board is inlaid, other than its own slices (timed in the
      // page), the house's frames and its other idle callbacks, with what ran in it.
      const longest = trace => {
        const ev = JSON.parse(trace.toString()).traceEvents, marks = ev.filter(e => e.name === 'TimeStamp' && e.args?.data?.message === 'inlay step');
        if (!marks.length) return null;
        const own = e => e.pid === marks[0].pid && e.tid === marks[0].tid && e.ph === 'X', inside = (t, e) => e.ts >= t.ts && e.ts <= t.ts + t.dur;
        const tasks = ev.filter(e => own(e) && /RunTask$/.test(e.name)), slices = tasks.filter(t => marks.some(m => inside(t, m)));
        if (!slices.length) return null;
        const from = marks[0].ts, to = Math.max(...slices.map(t => t.ts + t.dur)) + 300e3;
        const near = e => e.ts + (e.dur || 0) >= from && e.ts <= to;
        const calls = ev.filter(e => own(e) && near(e) && /^(FireAnimationFrame|FireIdleCallback|TimerFire|EventDispatch|FunctionCall|v8\.evaluateModule)$/.test(e.name));
        const worst = tasks.filter(near).filter(t => !slices.includes(t) && !calls.some(e => /^Fire/.test(e.name) && inside(t, e))).sort((a, b) => b.dur - a.dur)[0];
        return worst ? { ms: +(worst.dur / 1000).toFixed(1), what: calls.find(e => inside(worst, e))?.name || 'no script' } : { ms: 0, what: 'none' };
      };
      const ULTRA = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, noIdle = () => { delete window.requestIdleCallback; window.requestIdleCallback = undefined; };
      let wk = null;
      // Main paints the board on timers in 9.7 s from its first one; the bound for that path is a little over it. With no
      // idle callbacks the house's own background work runs on timers too, so the trace is read only where they exist.
      for (const [name, webkit, opts, q, cpu, limit, bound, init] of [['his laptop at ultra', false, ULTRA, 'ultra', 1, 10, 0, null],
        ['a phone 4x slower', false, UPRIGHT, 'medium', 4, 16.7, 0, null], ['a phone 4x slower with no requestIdleCallback', false, UPRIGHT, 'medium', 4, 0, 11, noIdle],
        ['WebKit at phone size', true, UPRIGHT, 'medium', 1, 0, 11, null]]) {
        const p = await (webkit ? (wk ||= await launch(pw.webkit)) : b).newPage(opts), errs = [];
        watch(p, errs);
        await p.addInitScript(timeInlay);
        if (init) await p.addInitScript(init);
        if (cpu > 1) await (await p.context().newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
        await p.goto(`${BASE}/?auto&matchday=off&q=${q}`);
        await p.waitForFunction(() => window.__loft && __loft.renderer.info.render.calls > 0, null, { timeout: 300000 });
        if (limit) await b.startTracing(p, { categories: ['toplevel', 'devtools.timeline'] });
        const inlaid = await p.waitForFunction(() => { const d = __loft.screens.textures.backgammon.image.getContext('2d').getImageData(0, 0, 920, 26).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 47) + Math.abs(d[i + 1] - 106) + Math.abs(d[i + 2] - 76) < 40) n++; return n > 200; }, null, { timeout: 90000, polling: 200 }).then(() => true, () => false);
        await p.waitForTimeout(400);
        const task = limit ? longest(await b.stopTracing()) : null, slices = await p.evaluate(() => window.__inlay.slice());
        const paints = slices.filter(s => s.paint).length, most = Math.max(...slices.map(s => s.ms));
        const took = slices.length ? +((slices.at(-1).at + slices.at(-1).ms - slices[0].at) / 1000).toFixed(1) : 0;
        check(`${name}: the board is inlaid in a few slices, each under a 60 Hz frame (16.7 ms)`, inlaid && paints >= 2 && most < 16.7, `${paints} slices that paint, the longest ${most} ms; on the table ${took} s after the first`);
        if (bound) check(`${name}: and on the table within ${bound} s of the first slice`, inlaid && took < bound, `${took} s`);
        if (limit) check(`${name}: no other task it causes holds the page over ${limit} ms`, !!task && task.ms < limit, task ? `the longest task ${task.ms} ms (${task.what})` : 'no slices in the trace');
        check(`inlay, ${name}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
        await p.close();
      }
      await wk?.close();
    }

    if (want('shelf')) {
      const { p, errs } = await open(b, DESK);
      check('the shelf is not built while the house loads', !(await p.evaluate(() => !!__loft.scene.getObjectByName('game_shelf'))));
      // Out on the balcony facing the sea while it is built, so nothing draws the shelf yet.
      await standAt(p, [15.0, 17.5, 0], [15.0, 25, 0]);
      await p.waitForFunction(() => { if (__loft.scene.getObjectByName('game_shelf')) { window.__shelfAt ||= performance.now(); return true; } return false; }, null, { timeout: 30000, polling: 50 });
      const sent = await p.evaluate(() => { const t = __loft.scene.getObjectByName('game_shelf').material.map; return __loft.renderer.properties.get(t).__version === t.version; });
      check('its picture goes to the graphics card as it is built, not in the frame that first shows it', sent);
      const when = await p.evaluate(() => window.__shelfAt - window.__up);
      check('it is built a few seconds after the house is up, a few spines at a time', when > 2500, `${Math.round(when)} ms after`);
      {
        const mesh = await p.evaluate(() => {
          const m = __loft.scene.getObjectByName('game_shelf'), bb = m.geometry.boundingBox;
          return { verts: m.geometry.attributes.position.count, min: bb.min.toArray(), max: bb.max.toArray(), lamp: m.material.customProgramCacheKey?.() === 'lamp' };
        });
        check('the shelf is one mesh: twenty cases and two bookends', mesh.verts === (20 + 2) * 36, `${mesh.verts} vertices`);
        // The old cases: x 0.515 to 0.685, height 1.07 to 1.28, north 12.363 to 12.517.
        check('the row stands over the old blank cases, covering them', mesh.min[0] <= 0.515 && mesh.max[0] >= 0.687 && mesh.max[1] >= 1.282 && -mesh.max[2] <= 12.363 && -mesh.min[2] >= 12.517, JSON.stringify(mesh));
        check('it dims with the lamps like the rest of the room', mesh.lamp);
        const spines = await p.evaluate(() => {
          const c = __loft.scene.getObjectByName('game_shelf').material.map.image, g = c.getContext('2d'), out = [];
          for (let i = 0; i < 20; i++) { const d = g.getImageData(i * 48, 0, 48, 768).data, seen = new Set(); for (let k = 0; k < d.length; k += 4) seen.add((d[k] >> 4) << 8 | (d[k + 1] >> 4) << 4 | (d[k + 2] >> 4)); out.push(seen.size); }
          return out;
        });
        check('every spine is painted (title, sign and number on its colour)', spines.every(n => n > 30), spines.join(' '));
        const ready = () => p.evaluate(async () => { const [c, s] = await Promise.all([import('./src/covers.js'), import('./src/pure/shelf.js')]); return s.GAMES.filter(g => c.coverReady(g)).length; });
        check('far from the shelf, no cover is drawn yet', (await ready()) === 0, `${await ready()} drawn`);
        await standAt(p, SHELF.spot);
        // Only in quiet moments, so on a busy machine as slowly as one cover each 1.5 s.
        await p.waitForFunction(async () => { const [c, s] = await Promise.all([import('./src/covers.js'), import('./src/pure/shelf.js')]); return s.GAMES.every(g => c.coverReady(g)); }, null, { timeout: 35000, polling: 250 }).catch(() => {});
        check('walking up to it draws all twenty covers ahead, in quiet moments', (await ready()) === 20, `${await ready()} drawn`);
        { const said = await promptIs(p, 'Look at my games'); check('by the shelf: E offers the games', said === 'Look at my games', said); }
        const before = await p.evaluate(() => __loft.pos.toArray());
        await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
        const pn = await panel(p);
        check('E opens my games', pn?.title === 'MY GAMES', JSON.stringify(pn));
        await p.waitForTimeout(1200);
        const covers = await p.evaluate(() => [...document.querySelectorAll('.pn .lp-cover')].map(card => { const c = card.querySelector('canvas'); if (!c) return { label: card.getAttribute('aria-label'), lit: 0, w: 0 }; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 90) lit++; return { label: card.getAttribute('aria-label'), lit, w: c.width, shown: card.getBoundingClientRect().width }; }));
        check('twenty covers, each painted and named for a screen reader', covers.length === 20 && covers.every(c => c.lit > 100 && c.w === 160 && c.shown > 100 && / /.test(c.label)), covers.map(c => c.lit).join(' '));
        await p.screenshot({ path: path.join(OUT, 'games-panel.png') });
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
        const after = await p.evaluate(() => [__loft.pos.toArray(), __loft.mode, !!document.querySelector('.pn')]);
        check('Esc closes it and I am still where I stood', !after[2] && after[1] === 'walk' && after[0].every((v, i) => Math.abs(v - before[i]) < 0.02), JSON.stringify(after));
        check('the prompt comes back', (await promptIs(p, 'Look at my games')) === 'Look at my games');
        // Reopening costs nothing: the covers are kept.
        await p.keyboard.press('KeyE'); await p.waitForTimeout(150);
        const kept = await p.evaluate(() => [...document.querySelectorAll('.pn .lp-cover')].filter(c => c.querySelector('canvas')).length);
        check('opened again, the covers are already painted', kept === 20, `${kept} of 20`);
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        // A click on the cases from across the room walks over and opens them.
        await standAt(p, [3.2, 12.2, 0], SHELF.at);
        await p.waitForTimeout(1200);
        const at = await onScreen(p, [0.69, 12.47, 1.18]);
        await p.mouse.click(at.x, at.y);
        await p.waitForFunction(() => document.querySelector('.pn h2')?.firstChild?.nodeValue === 'MY GAMES', null, { timeout: 15000 }).catch(() => {});
        check('a click on the cases walks me over and opens them', (await panel(p))?.title === 'MY GAMES', JSON.stringify(at));
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        await shot(p, 'shelf-close', [1.25, 12.47, 1.3], [0.6, 12.47, 1.18], 960, 600, 45);
        await shot(p, 'shelf-angle', [1.3, 12.95, 1.45], [0.6, 12.45, 1.17], 960, 600, 45);
        await shot(p, 'shelf-room', [4.0, 12.3, 1.55], [0.6, 12.6, 1.1], 960, 600, 55);
        await p.evaluate(() => __lights.set(false)); await p.waitForTimeout(2500);
        const dim = await p.evaluate(() => __lights.uniforms.room.value.x);
        check('with the lamps off the room light falls, and the shelf with it', dim < 0.8, dim.toFixed(2));
        await shot(p, 'shelf-close-dark', [1.25, 12.47, 1.3], [0.6, 12.47, 1.18], 960, 600, 45);
        await p.evaluate(() => __lights.set(true));
      }
      check('shelf: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
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
      { const said = await promptIs(p, 'Read the Shahnameh'); check('at the side table: E offers the Shahnameh', said === 'Read the Shahnameh', said); }
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

    if (want('frames')) {
      const { p, errs } = await open(b, DESK);
      const names = await p.evaluate(() => __loft.meta.projects);
      const allowed = await p.evaluate(async () => { const m = await import('./src/pure/desktop.js'); return { sites: Object.values(m.PROJECTS).map(x => x.site).filter(Boolean), gh: m.GITHUB }; });
      for (let i = 0; i < names.length; i++) {
        const s = await p.evaluate(i => __loft.meta.screens[`proj${i}`].center, i);
        await standAt(p, [0.75, s[1], s[2] - 1.5], [0.03, s[1], s[2]]);
        const label = await promptIs(p, `See ${names[i]}`);
        // On a stair the body settles onto its step first.
        await p.waitForTimeout(800);
        const before = await p.evaluate(() => __loft.pos.toArray());
        await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
        const r = await p.evaluate(() => {
          const box = document.querySelector('.pn');
          return box && { title: box.querySelector('h2').firstChild.nodeValue, rows: [...box.querySelectorAll('.lp-projects li')].map(li => li.querySelector('b').textContent), on: [...box.querySelectorAll('.lp-projects li.lp-on b')].map(x => x.textContent), links: [...box.querySelectorAll('.lp-projects a')].map(a => ({ href: a.href, target: a.target, rel: a.rel })), focus: document.activeElement?.closest?.('li.lp-on') ? 'on' : document.activeElement?.tagName };
        });
        const safe = r && r.links.every(l => l.target === '_blank' && l.rel === 'noopener noreferrer' && (allowed.sites.includes(l.href) || allowed.sites.map(x => x + '/').includes(l.href) || names.some(n => l.href === `${allowed.gh}/${n}`)));
        check(`frame ${i + 1}: E opens the projects at ${names[i]}`, label === `See ${names[i]}` && r?.title === 'PROJECTS' && r.rows.join() === names.join() && r.on.join() === names[i] && r.focus === 'on', `${label} | ${JSON.stringify({ on: r?.on, focus: r?.focus })}`);
        check(`frame ${i + 1}: every link is a real page of his, opening in a new tab with no way back to this one`, safe && r.links.length >= names.length, r?.links.map(l => l.href).join(' '));
        if (i === 2) await p.screenshot({ path: path.join(OUT, 'projects-desk.png') });
        await p.keyboard.press('Escape'); await p.waitForTimeout(250);
        const after = await p.evaluate(() => [__loft.pos.toArray(), !!document.querySelector('.pn')]);
        check(`frame ${i + 1}: Esc closes it where I stood`, !after[1] && after[0].every((v, k) => Math.abs(v - before[k]) < 0.02), JSON.stringify([before, after[0]]));
      }
      const foot = await p.evaluate(() => __loft.meta.interact.find(i => i.id === 'projects').at);
      await standAt(p, foot);
      { const said = await promptIs(p, 'See my projects'); check('the foot of the stairs still offers my projects', said === 'See my projects', said); }
      await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
      const all = await p.evaluate(() => [document.querySelector('.pn h2')?.firstChild?.nodeValue, document.querySelectorAll('.pn .lp-projects li').length, document.querySelectorAll('.pn li.lp-on').length]);
      check('and opens all five, none marked', all[0] === 'PROJECTS' && all[1] === 5 && all[2] === 0, all.join(' | '));
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      // From the foot of the stairs, a click on the third frame walks up to it and opens it.
      await standAt(p, [2.2, 9.2, 0], [0.03, 6.42, 3]);
      await p.waitForTimeout(1200);
      const s2 = await p.evaluate(() => __loft.meta.screens.proj2.center);
      const at = await onScreen(p, s2);
      await p.mouse.click(at.x, at.y);
      await p.waitForFunction(() => document.querySelector('.pn li.lp-on'), null, { timeout: 20000 }).catch(() => {});
      const on = await p.evaluate(() => document.querySelector('.pn li.lp-on b')?.textContent);
      check('a click on a frame walks me up to it and opens its project', on === names[2], `${on} ${JSON.stringify(at)}`);
      await p.keyboard.press('Escape');
      check('frames: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }

    if (want('phone')) {
      for (const [name, opts] of [['upright', UPRIGHT], ['sideways', SIDEWAYS]]) {
        const { p, errs } = await open(b, opts);
        const use = async () => { const r = await p.evaluate(() => { const e = document.getElementById('use').getBoundingClientRect(); return [e.x + e.width / 2, e.y + e.height / 2]; }); await p.touchscreen.tap(...r); await p.waitForTimeout(500); };
        for (const [spot, title] of [[BOOK.spot, 'SHAHNAMEH'], [[0.75, 6.42, 1.5], 'PROJECTS'], [SHELF.spot, 'MY GAMES']]) {
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

    if (want('smooth')) {
      // Frame times while the shelf and the board are built behind the scenes, and while each thing opens. A computer
      // fetches the range 12 s after you come in and builds it behind the scenes, with long frames of its own, so the
      // openings are timed once it is built, after the house's own story book has opened twice (a visit's first panel
      // costs extra wherever it is). With a slowed processor (SMOOTH_CPU=4) the house alone has long frames, so the
      // numbers are printed beside the book's for reading, not judged.
      const { p, errs } = await open(b, DESK);
      const cpu = Number(process.env.SMOOTH_CPU || 1), slow = cpu > 1 ? ` (processor ${cpu}x slower)` : '';
      if (cpu > 1) await (await p.context().newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await p.evaluate(() => { window.__frames = []; let last = performance.now(); const f = t => { window.__frames.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await p.waitForFunction(() => { const d = __loft.screens.textures.backgammon.image.getContext('2d').getImageData(0, 0, 920, 26).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 47) + Math.abs(d[i + 1] - 106) + Math.abs(d[i + 2] - 76) < 40) n++; return n > 200 && !!__loft.scene.getObjectByName('game_shelf'); }, null, { timeout: 60000, polling: 250 });
      await p.waitForTimeout(1500);
      const build = await p.evaluate(() => { const f = window.__frames.slice(5); window.__frames = []; return [Math.max(...f), f.filter(x => x > 33).length, f.length]; });
      const said = `worst ${build[0].toFixed(1)} ms, ${build[1]} of ${build[2]} over 33 ms`;
      if (cpu > 1) console.log(`building the shelf and the board behind the scenes${slow}: ${said}`);
      else check('building the shelf and the board behind the scenes: no frame over 50 ms', build[0] < 50, said);
      // The khatam's own cost in the game: its four strips at the board's sizes, drawn on a scratch canvas.
      const strips = await p.evaluate(async () => {
        const K = await import('./src/khatam.js'), c = document.createElement('canvas');
        c.width = 900; c.height = 660;
        const g = c.getContext('2d'), t0 = performance.now();
        for (const x of [0, 400, 820]) K.bar(g, x, 0, 18, 660);
        K.bar(g, 380, 20, 26, 620);
        return performance.now() - t0;
      });
      if (cpu > 1) console.log(`the game board's khatam strips${slow}: ${strips.toFixed(1)} ms`);
      else check('the four khatam strips of the game board cost under 8 ms to draw', strips < 8, `${strips.toFixed(1)} ms`);
      await p.evaluate(() => __loft.range.load());
      await p.waitForFunction(() => __loft.range.ready, null, { timeout: 90000 });
      await p.waitForTimeout(3000);
      const opening = async act => { await p.evaluate(() => { window.__frames = []; }); await act(); await p.waitForTimeout(1500); const w = await p.evaluate(() => Math.max(...window.__frames)); await p.keyboard.press('Escape'); await p.waitForTimeout(400); return w; };
      await opening(() => p.evaluate(() => __loft.act('book')));
      const book = await opening(() => p.evaluate(() => __loft.act('book')));
      if (cpu > 1) console.log(`the story book opening${slow}: ${book.toFixed(1)} ms`);
      for (const [spot, key] of [[SHELF.spot, 'games'], [BOOK.spot, 'reader'], [[0.75, 6.42, 1.5], 'projects'], [[15, 15.65, 0], 'the backgammon game']]) {
        await standAt(p, spot); await p.waitForTimeout(2500);
        const worst = await opening(() => p.keyboard.press('KeyE'));
        // The game itself costs about 100 ms to open on main too, so only its khatam strips are judged, above.
        if (cpu > 1 || key === 'the backgammon game') console.log(`opening ${key}${slow}: worst frame ${worst.toFixed(1)} ms`);
        else check(`opening ${key}: no frame over 50 ms`, worst < 50, `${worst.toFixed(1)} ms`);
      }
      check(`smooth${slow}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

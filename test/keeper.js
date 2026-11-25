// The keeper's corner and the desk shelf in a real Chrome, at a computer and on phones: the keepy-up ball by keyboard,
// click and tap, the ball staying in its corner, the three figures in place of the baked pegs, lamps on and off, and the
// save of the week on the TV menu (the house's, the visitor's own when better, an old week's ignored, storage blocked).
//   LOFT_URL=http://127.0.0.1:8852 node test/keeper.js [outdir] [parts]
// Parts: shelf, shelfphone, ball, tap, phone, bounds, lamps, nostore, replay, replayown, replayphone, keepersave, and
// cost (it times frames: run it alone, under `timing`; SMOOTH_CPU=4 slows the processor; against a version without the
// corner it prints the house's own frames).
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/keeper';
const ONLY = process.argv[3] || 'shelf,shelfphone,ball,tap,phone,bounds,lamps,nostore,replay,replayown,replayphone,keepersave';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY.split(',').includes(part);
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo|profile-art/;

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!OUTSIDE.test(r.url()) && !/run\.mp3|\.mp4/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
async function open(b, opts, { init = null, keeper = true } = {}) {
  const ctx = await b.newContext(opts);
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage(), errs = [];
  watch(p, errs);
  // The room as it is on any day: on a Real Madrid game day it turns white and gold a few seconds in, under the pictures.
  await p.goto(`${BASE}/?auto&matchday=off&q=${opts.isMobile ? 'medium' : 'high'}`);
  await p.waitForFunction(k => window.__loft && (!k || window.__keeper) && window.__loft.renderer.info.render.calls > 0, keeper, { timeout: 120000 });
  return { ctx, p, errs };
}
const toast = p => p.evaluate(() => document.getElementById('toast').textContent);
// Where a point (three's axes) is on the screen, and what of the page is on top there.
const onScreen = (p, v) => p.evaluate(v => {
  const c = __loft.camera.position.clone().set(v.x, v.y, v.z).project(__loft.camera);
  const x = (c.x + 1) / 2 * innerWidth, y = (1 - c.y) / 2 * innerHeight, top = document.elementFromPoint(x, y);
  return { x, y, z: c.z, top: top ? top.tagName : null };
}, v);
// A fixed camera's picture (eye and target in the room's axes) at 320 x 200, without the character: its pixels.
const picture = (p, eye, at) => p.evaluate(async ([e, a]) => {
  const L = __loft, c = L.camera.clone(), r = L.renderer, THREE = await import('three');
  c.position.set(e.x, e.y, e.z); c.lookAt(a.x, a.y, a.z); c.fov = 40; c.near = 0.02; c.aspect = 1.6; c.updateProjectionMatrix();
  const pr = r.getPixelRatio(), size = r.getSize(new THREE.Vector2());
  r.setPixelRatio(1); r.setSize(320, 200, false);
  const vis = L.me.root.visible; L.me.root.visible = false;
  r.render(L.scene, c);
  const url = r.domElement.toDataURL('image/png');
  L.me.root.visible = vis; r.setPixelRatio(pr); r.setSize(size.x, size.y, false);
  const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = url; });
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  return { url, px: Array.from(g.getImageData(0, 0, 320, 200).data) };
}, [b2t(...eye), b2t(...at)]);
// How much a picture changed inside and outside a box of pixels [x0, y0, x1, y1].
function changed(A, B, box) {
  let inN = 0, inC = 0, outN = 0, outC = 0;
  for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
    const i = (y * 320 + x) * 4, d = (Math.abs(A.px[i] - B.px[i]) + Math.abs(A.px[i + 1] - B.px[i + 1]) + Math.abs(A.px[i + 2] - B.px[i + 2])) / 3 > 30;
    if (x >= box[0] && x < box[2] && y >= box[1] && y < box[3]) { inN++; inC += d; } else { outN++; outC += d; }
  }
  return { inside: inC / inN, outside: outC / outN };
}
const mean = (A, box) => { let s = 0, n = 0; for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) { const i = (y * 320 + x) * 4; s += 0.2126 * A.px[i] + 0.7152 * A.px[i + 1] + 0.0722 * A.px[i + 2]; n++; } return s / n; };
const save = (A, name) => fs.writeFileSync(path.join(OUT, name), Buffer.from(A.url.split(',')[1], 'base64'));
// The shelf straight on from a step in front of it.
const SHELF_EYE = [[21.25, 1.7, 3.1], [21.88, 1.7, 3.04]];
// Where in that shelf picture the three figures stand (pixels), found by projecting their spots.
const SHELF_BOX = [40, 60, 280, 175];
// The floor of the studio, a little back from the desk, from where a visitor looks up at the shelf.
const STUDIO_FLOOR = [19.2, 1.7, 0.45];

// ---------- the keepy-up ball ----------
const ball = p => p.evaluate(() => { const k = __keeper.ball, b = k.ball; return { p: b.p.slice(), v: b.v.slice(), rest: b.rest, count: b.count, best: b.best, last: b.last, still: k.still, label: k.spot.label }; });
// Stand `dx`, `dz` (three's axes) from the ball, the camera turned to look at it.
async function standBy(p, dx, dz) {
  await p.evaluate(([dx, dz]) => {
    const b = __keeper.ball.ball.p;
    __loft.pos.set(b[0] + dx, 0.05, b[2] + dz);
    __loft.yaw = Math.atan2(dx, dz);
  }, [dx, dz]);
  await p.waitForTimeout(900);
}
// Waits in the page for the ball to be on its way down and lower than `h` off the floor.
const dropTo = (p, h = 0.5) => p.evaluate(h => new Promise(res => { const f = () => { const b = __keeper.ball.ball; if (b.v[1] < 0 && b.p[1] - 0.1 < h) res(); else requestAnimationFrame(f); }; f(); }), h);
// The ball held where it is on its way down while the test presses, clicks or taps (a person sees it coming and acts
// ahead of it; the test only reacts, a few ms late), then let go.
const holdAt = (p, h) => p.evaluate(h => new Promise(res => { const k = __keeper.ball; k.go ||= k.tick; const f = () => { const b = k.ball; if (b.v[1] < 0 && b.p[1] - 0.1 < h) { k.tick = () => {}; res(); } else requestAnimationFrame(f); }; f(); }), h);
const letGo = p => p.evaluate(() => { const k = __keeper.ball; k.tick = k.go; });
// The ball held on its way up once the moment after a touch has passed (a press inside it is only waited out), so the
// next press is an early one, made while it still rises.
const holdUp = p => p.evaluate(() => new Promise(res => { const k = __keeper.ball; k.go ||= k.tick; let n = 0; const f = () => { const b = k.ball; if (b.count > 0 && b.v[1] > 0 && b.cool <= 0) { k.tick = () => {}; res(); } else if (++n > 180) res(); else requestAnimationFrame(f); }; f(); }));
// A click on the ball from the page itself, in the frame it is on its way down and lower than `h`: the ray from the
// camera through the ball's middle, into the house's own click handling for the corner. I keep within a step of it, as
// anyone keeping it up does (each click sends it on away from me; from past a click's reach it walks me over instead).
const tapAtLow = (p, h) => p.evaluate(async h => {
  const THREE = await import('three'), k = __keeper, cam = __loft.camera;
  let n = 0;
  return new Promise(res => { const f = () => { const b = k.ball.ball; if (b.v[1] < 0 && b.p[1] - 0.1 < h) { const P = __loft.pos, dx = P.x - b.p[0], dz = P.z - b.p[2], d = Math.hypot(dx, dz); if (d > 1.2) P.set(b.p[0] + dx / d * 1.2, P.y, b.p[2] + dz / d * 1.2); res(k.tap(new THREE.Raycaster(cam.position.clone(), new THREE.Vector3(...b.p).sub(cam.position).normalize()), null, P)); } else if (++n > 300) res(false); else requestAnimationFrame(f); }; f(); });
}, h);
const waitRest = p => p.waitForFunction(() => __keeper.ball.ball.rest && __keeper.ball.still, null, { timeout: 20000, polling: 100 });
const ballOnScreen = async p => onScreen(p, await p.evaluate(() => { const b = __keeper.ball.ball.p; return { x: b[0], y: b[1], z: b[2] }; }));
// The corner's ball from a little way off.
const CORNER_EYE = [[9.4, 3.9, 0.55], [10.25, 3.62, 0.1]];

(async () => {
  const F = await import('../web/src/pure/figures.js'), K = await import('../web/src/pure/keepy.js');
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'assets', 'world.json')));
  const corner = K.cornerOf(meta);
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    if (want('shelf')) {
      const { ctx, p, errs } = await open(b, DESK);
      const early = await p.evaluate(() => __keeper.figures.built);
      check('the figures are not built while the house opens', early === false);
      const before = await picture(p, ...SHELF_EYE);
      const built = await p.waitForFunction(() => __keeper.figures.built, null, { timeout: 30000 }).then(() => true, () => false);
      check('a few seconds on, the figures are built in spare moments', built, errs.slice(0, 3).join(' | '));
      if (!built) throw new Error('the figures were never built');
      await p.waitForTimeout(500);
      const pegs = await p.evaluate(async () => {
        const F = await import('./src/pure/figures.js');
        const g = __loft.scene.getObjectByName('studio_baked').geometry, idx = g.index.array;
        const inside = F.trianglesInside(idx, g.attributes.position.array, F.PEG_BOXES);
        return { inside: inside.length, live: inside.filter(t => !(idx[t] === idx[t + 1] && idx[t] === idx[t + 2])).length, folded: __keeper.figures.folded, ranges: g.index.updateRanges.length };
      });
      check('the three baked peg figures are folded away, every one of their triangles', pegs.folded === 516 && pegs.inside === 516 && pegs.live === 0, JSON.stringify(pegs));
      // Hidden figures show the shelf as the pegs left it: the pegs' place changes, nothing else does.
      const hide = v => p.evaluate(v => { for (const n of ['shelf_figures', 'bobble_head']) __loft.scene.getObjectByName(n).visible = v; }, v);
      await hide(false);
      const empty = await picture(p, ...SHELF_EYE);
      await hide(true);
      const after = await picture(p, ...SHELF_EYE);
      save(before, 'shelf-before.png'); save(empty, 'shelf-empty.png'); save(after, 'shelf-after.png');
      const gone = changed(before, empty, SHELF_BOX), shown = changed(empty, after, SHELF_BOX);
      check('on screen the pegs are gone and the rest of the shelf is as it was', gone.inside > 0.02 && gone.outside < 0.003, JSON.stringify(gone));
      check('and the figures stand where they stood', shown.inside > 0.04 && shown.outside < 0.003, JSON.stringify(shown));
      const fit = await p.evaluate(() => {
        const g = __loft.scene.getObjectByName('shelf_figures').geometry, a = g.attributes.position.array;
        const parts = [0, 1, 2].map(() => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 }));
        for (let i = 0; i < a.length; i += 3) {
          const k = a[i + 2] > -1.625 ? 0 : a[i + 2] > -1.775 ? 1 : 2, q = parts[k];
          q.x0 = Math.min(q.x0, a[i]); q.x1 = Math.max(q.x1, a[i]); q.y0 = Math.min(q.y0, a[i + 1]); q.y1 = Math.max(q.y1, a[i + 1]); q.z0 = Math.min(q.z0, a[i + 2]); q.z1 = Math.max(q.z1, a[i + 2]); q.n++;
        }
        const h = __loft.scene.getObjectByName('bobble_head'), head = { x0: Infinity, x1: -Infinity, y1: -Infinity };
        h.updateMatrixWorld(true);
        h.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); head.x0 = Math.min(head.x0, bb.min.x); head.x1 = Math.max(head.x1, bb.max.x); head.y1 = Math.max(head.y1, bb.max.y); } });
        return { parts, head, tris: (a.length / 9) | 0 };
      });
      const [pishi, behi, jessi] = fit.parts;
      const onShelf = q => q.x0 >= 21.785 && q.x1 <= 21.955 && q.y0 >= 2.9645;
      check('each figure stands on the shelf, clear of its front edge and the wall behind', fit.parts.every(onShelf) && fit.head.x0 >= 21.785 && fit.head.x1 <= 21.955, JSON.stringify(fit.parts.map(q => [q.x0, q.x1, q.y0].map(v => +v.toFixed(3)))));
      check('a tiny Pishi and a tiny Jessi about 10 cm tall either side, the bobblehead about 18 cm in the middle', pishi.y1 - 2.965 > 0.07 && pishi.y1 - 2.965 < 0.14 && jessi.y1 - 2.965 > 0.07 && jessi.y1 - 2.965 < 0.14 && fit.head.y1 - 2.965 > 0.15 && fit.head.y1 - 2.965 < 0.21 && behi.n > 0,
        `pishi ${(pishi.y1 - 2.965).toFixed(3)}, jessi ${(jessi.y1 - 2.965).toFixed(3)}, bobblehead ${(fit.head.y1 - 2.965).toFixed(3)} m`);
      const mats = await p.evaluate(() => {
        const body = __loft.scene.getObjectByName('shelf_figures'), head = __loft.scene.getObjectByName('bobble_head'), meshes = [];
        head.traverse(o => { if (o.isMesh) meshes.push(o); });
        return { body: body.material.customProgramCacheKey?.() === 'lamp', head: meshes[0].material === body.material, eyes: meshes[1].material.userData.lamp === 'glow' && meshes[1].material.color.g > 1.3 };
      });
      check('the figures dim with the lamps, the bobblehead\'s eyes keep their glow', mats.body && mats.head && mats.eyes, JSON.stringify(mats));
      // From the studio floor, a click on the bobblehead sets its head nodding, and I stay where I am.
      await p.evaluate(([v]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); __loft.yaw = -Math.PI / 2; }, [b2t(...STUDIO_FLOOR)]);
      await p.waitForTimeout(1200);
      const head = await onScreen(p, b2t(F.PEG_X, -F.PEG_Z[1], F.SHELF_TOP + 0.14));
      // Seen in the room, each of their materials is one the house already draws with, or draws with a shader another
      // material already uses, so no shader is built for them.
      const shared = await p.evaluate(() => {
        const r = __loft.renderer, mine = new Set(), mats = [], others = new Set();
        for (const n of ['shelf_figures', 'bobble_head']) __loft.scene.getObjectByName(n).traverse(o => { if (o.isMesh) { mine.add(o); mats.push(o.material); } });
        __loft.scene.traverse(o => { if (o.isMesh && !mine.has(o)) for (const m of [].concat(o.material)) others.add(m); });
        return mats.map(m => others.has(m) || r.properties.get(m).currentProgram?.usedTimes > 1);
      });
      check('the figures cost no new shader and a few draws', shared.length === 3 && shared.every(Boolean) && fit.tris < 40000, `${JSON.stringify(shared)}; ${fit.tris} triangles`);
      await p.screenshot({ path: path.join(OUT, 'shelf-from-floor.png') });
      check('from the studio floor the bobblehead is on screen', head.z < 1 && head.x > 0 && head.x < 1280 && head.y > 0 && head.y < 800 && head.top === 'CANVAS', JSON.stringify(head));
      await p.mouse.click(head.x, head.y);
      await p.waitForTimeout(250);
      const bob = await p.evaluate(() => ({ on: __keeper.figures.bobbing, tilt: __keeper.figures.tilt, route: __loft.route }));
      check('a click on it bobs its head, without walking me off', bob.on && Math.abs(bob.tilt[0]) + Math.abs(bob.tilt[1]) > 0.02 && bob.route === 0, JSON.stringify(bob));
      await p.waitForFunction(() => !__keeper.figures.bobbing, null, { timeout: 10000 }).catch(() => {});
      const still = await p.evaluate(() => ({ on: __keeper.figures.bobbing, tilt: __keeper.figures.tilt }));
      check('and it settles back still within a few seconds', !still.on && still.tilt.every(v => v === 0), JSON.stringify(still));
      // With the lamps off the figures dim with the room.
      await p.evaluate(() => window.__lights.set(false));
      await p.waitForFunction(() => window.__lights.k === 0, null, { timeout: 10000 });
      const dark = await picture(p, ...SHELF_EYE);
      save(dark, 'shelf-lamps-off.png');
      await p.evaluate(() => window.__lights.set(true));
      const dim = mean(dark, SHELF_BOX) / mean(after, SHELF_BOX);
      check('with the lamps off the figures go dim with the room', dim < 0.75 && dim > 0.05, dim.toFixed(3));
      check('the shelf: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('shelfphone')) {
      // On a phone, from the studio floor: the figures in place, and a tap on the bobblehead bobs it.
      const { ctx, p, errs } = await open(b, UPRIGHT);
      await p.waitForFunction(() => __keeper.figures.built, null, { timeout: 30000 });
      await p.evaluate(([v]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); __loft.yaw = -Math.PI / 2; }, [b2t(...STUDIO_FLOOR)]);
      await p.waitForTimeout(1500);
      const head = await onScreen(p, b2t(F.PEG_X, -F.PEG_Z[1], F.SHELF_TOP + 0.14));
      await p.screenshot({ path: path.join(OUT, 'phone-shelf.png') });
      check('phone: from the studio floor the bobblehead is on screen', head.z < 1 && head.x > 0 && head.x < 390 && head.y > 0 && head.y < 844 && head.top === 'CANVAS', JSON.stringify(head));
      await p.touchscreen.tap(head.x, head.y);
      await p.waitForTimeout(200);
      check('phone: a tap on the bobblehead bobs it, without walking me off', await p.evaluate(() => __keeper.figures.bobbing && __loft.route === 0));
      check('phone shelf: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('ball')) {
      const { ctx, p, errs } = await open(b, DESK);
      await p.waitForTimeout(1500);
      const s0 = await ball(p);
      check('the ball lies still on its spot in the keeper\'s corner', s0.rest && s0.still && Math.abs(s0.p[0] - corner.home[0]) < 1e-6 && Math.abs(s0.p[2] - corner.home[2]) < 1e-6 && Math.abs(s0.p[1] - K.R) < 1e-6, JSON.stringify(s0.p));
      await standBy(p, -0.8, 0.1);
      const near = await p.evaluate(() => [__loft.near, document.getElementById('prompt').textContent, document.getElementById('prompt').classList.contains('on')]);
      check('beside it, E is offered', near[0] === 'keepy' && near[1].includes('Keep the ball up') && near[2], near.join(' | '));
      await p.keyboard.press('KeyE');
      await holdUp(p);
      let s = await ball(p);
      check('E knocks it up', s.count === 1 && s.v[1] > 0 && !s.rest && s.label === 'Keep it up: 1', JSON.stringify({ count: s.count, vy: s.v[1], label: s.label }));
      await p.keyboard.press('KeyE');
      s = await ball(p);
      check('pressing again while it is still rising does nothing, and says to wait', s.count === 1 && s.v[1] > 0 && s.label === 'Wait for it to drop', `${s.label}, rising ${s.v[1].toFixed(2)}`);
      await letGo(p);
      await waitRest(p);
      check('a run of one is not made much of', (await ball(p)).best === 1 && !(await toast(p)).includes('in a row'));
      // Keep it up by keyboard: E each time it comes down into reach.
      await standBy(p, -0.8, 0.1);
      await p.keyboard.press('KeyE');
      for (let n = 2; n <= 6; n++) { await holdAt(p, 0.5); await p.keyboard.press('KeyE'); await letGo(p); await p.waitForTimeout(60); }
      s = await ball(p);
      const prompt = await p.evaluate(() => document.getElementById('prompt').textContent);
      check('E in time, again and again, keeps it up, counted', s.count === 6 && prompt.includes('Keep it up: 6'), `${s.count} touches; prompt ${prompt}`);
      await p.screenshot({ path: path.join(OUT, 'ball-juggling.png') });
      await waitRest(p);
      s = await ball(p);
      const said = await toast(p), kept = await p.evaluate(() => localStorage.getItem('loft.keepy'));
      check('when it lands the run ends, is told, and kept as my best', s.count === 0 && s.last === 6 && s.best === 6 && said === '6 in a row. Your best yet.' && kept === '6', `${said} | stored ${kept}`);
      const inside = q => q.p[0] >= corner.bounds.min[0] + K.R - 1e-6 && q.p[0] <= corner.bounds.max[0] - K.R + 1e-6 && q.p[2] >= corner.bounds.min[1] + K.R - 1e-6 && q.p[2] <= corner.bounds.max[1] - K.R + 1e-6;
      check('it comes to rest in the corner, on the floor', s.rest && s.still && inside(s) && Math.abs(s.p[1] - K.R) < 1e-6, JSON.stringify(s.p.map(v => +v.toFixed(3))));
      // Resting, it does no work: its tick returns at once, frame after frame.
      const idle = await p.evaluate(() => new Promise(res => {
        const k = __keeper, tick = k.tick; let most = 0, n = 0;
        k.tick = function (...a) { const t = performance.now(); tick.apply(this, a); most = Math.max(most, performance.now() - t); n++; };
        const at = __keeper.ball.ball.p.slice();
        setTimeout(() => { k.tick = tick; res({ most, n, moved: __keeper.ball.ball.p.some((v, i) => v !== at[i]) }); }, 1500);
      }));
      check('lying still it costs nothing: its share of a frame stays near zero', idle.n > 30 && idle.most < 0.3 && !idle.moved, JSON.stringify(idle));
      // I am solid to it: standing where it lies pushes it aside.
      await p.evaluate(() => { const b = __keeper.ball.ball.p; __loft.pos.set(b[0] + 0.1, 0.05, b[2]); });
      await p.waitForTimeout(1500);
      s = await ball(p);
      const me = await p.evaluate(() => [__loft.pos.x, __loft.pos.z]);
      check('walking into it pushes it away, still inside the corner', Math.hypot(s.p[0] - me[0], s.p[2] - me[1]) >= 0.37 && inside(s), `${Math.hypot(s.p[0] - me[0], s.p[2] - me[1]).toFixed(3)} m apart`);
      // The best is there on the next visit.
      await p.reload();
      await p.waitForFunction(() => window.__loft && window.__keeper && __loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
      const again = await ball(p);
      check('my best is remembered on the next visit, and the ball is back on its spot', again.best === 6 && Math.abs(again.p[0] - corner.home[0]) < 1e-6, `best ${again.best}`);
      check('the ball: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('tap')) {
      const { ctx, p, errs } = await open(b, DESK);
      await p.waitForTimeout(1500);
      await standBy(p, -1.4, 0.4);
      let at = await ballOnScreen(p);
      check('a step away, the ball is on screen with nothing of the page over it', at.z < 1 && at.x > 0 && at.x < 1280 && at.y > 0 && at.y < 800 && at.top === 'CANVAS', JSON.stringify(at));
      await p.screenshot({ path: path.join(OUT, 'tap-before.png') });
      await p.mouse.click(at.x, at.y);
      await p.waitForTimeout(150);
      let s = await ball(p);
      const route = await p.evaluate(() => __loft.route);
      check('a click on the ball knocks it up, and I stay put', s.count === 1 && s.v[1] > 0 && route === 0, `count ${s.count}, route ${route}`);
      for (let n = 2; n <= 4; n++) await tapAtLow(p, 0.55);
      s = await ball(p);
      check('clicked each time it comes down, it stays up', s.count === 4, `${s.count} touches`);
      await waitRest(p);
      // Clicked on one side, it goes off the other way: the same ball clicked on its right and on its left.
      await standBy(p, -1.2, 0.3);
      const side = await p.evaluate(async () => {
        const THREE = await import('three'), k = __keeper.ball, b = k.ball, at = b.p.slice(), cam = __loft.camera.position.clone(), c = new THREE.Vector3(...at);
        const right = new THREE.Vector3().subVectors(c, cam).cross(new THREE.Vector3(0, 1, 0)).normalize(), out = [];
        for (const s of [1, -1]) {
          Object.assign(b, { p: at.slice(), v: [0, 0, 0], rest: true, floor: true, cool: 0, lock: 0, count: 0 });
          k.tap(new THREE.Raycaster(cam, c.clone().addScaledVector(right, 0.08 * s).sub(cam).normalize()), null, __loft.pos);
          out.push(b.v[0] * right.x + b.v[2] * right.z);
        }
        return out;
      });
      check('clicked on its right it goes more to the left than clicked on its left', side[0] < side[1] - 0.2, JSON.stringify(side.map(v => +v.toFixed(2))));
      await waitRest(p);
      // From across the room a click walks me over to it instead.
      await standBy(p, -4.5, 0.6);
      at = await ballOnScreen(p);
      const before = await ball(p);
      await p.mouse.click(at.x, at.y);
      await p.waitForTimeout(400);
      const walk = await p.evaluate(() => __loft.route);
      s = await ball(p);
      check('from across the room a click walks me to the ball, without touching it', walk > 0 && s.count === 0 && s.rest && s.p.every((v, i) => v === before.p[i]), `route ${walk}`);
      await p.waitForFunction(() => __loft.route === 0, null, { timeout: 15000 }).catch(() => {});
      const there = await p.evaluate(() => { const b = __keeper.ball.ball.p; return [Math.hypot(__loft.pos.x - b[0], __loft.pos.z - b[2]), __loft.near]; });
      check('and I end up beside it, E offered', there[0] < 1.1 && there[1] === 'keepy', JSON.stringify(there));
      check('clicks: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('phone')) {
      const { ctx, p, errs } = await open(b, UPRIGHT);
      await p.waitForTimeout(1500);
      await standBy(p, -0.85, 0.2);
      const use = await p.evaluate(() => { const r = document.getElementById('use').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await p.touchscreen.tap(use.x, use.y);
      await p.waitForTimeout(120);
      let s = await ball(p);
      check('phone: the Use button knocks it up', s.count === 1, `${s.count}`);
      for (let n = 2; n <= 3; n++) { await holdAt(p, 0.55); const at = await ballOnScreen(p); await p.touchscreen.tap(at.x, at.y); await letGo(p); await p.waitForTimeout(60); }
      s = await ball(p);
      check('phone: tapping the ball as it comes down keeps it up', s.count === 3, `${s.count} touches`);
      await p.screenshot({ path: path.join(OUT, 'phone-juggling.png') });
      await waitRest(p);
      const prompt = await p.evaluate(() => { const r = document.getElementById('prompt').getBoundingClientRect(), u = document.getElementById('use').getBoundingClientRect(); return { overlap: !(r.bottom <= u.top || r.top >= u.bottom || r.right <= u.left || r.left >= u.right), inside: r.left >= 0 && r.right <= innerWidth }; });
      check('phone: the prompt fits the screen and clears the buttons', !prompt.overlap && prompt.inside, JSON.stringify(prompt));
      check('phone: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('bounds')) {
      // Eight seconds of being knocked about every frame, flung hard, pushed into walls by me: it never leaves.
      const { ctx, p, errs } = await open(b, DESK);
      await p.waitForTimeout(1500);
      await standBy(p, -0.9, 0);
      const r = await p.evaluate(([B, R, goal]) => new Promise(res => {
        const k = __keeper.ball, b = k.ball, out = [];
        let frames = 0, last = performance.now();
        const f = now => {
          frames++;
          if (Math.random() < 0.15) k.kick();
          if (Math.random() < 0.04) b.v = [(Math.random() - 0.5) * 25, Math.random() * 12, (Math.random() - 0.5) * 25], b.rest = false, b.floor = false;
          if (Math.random() < 0.05) __loft.pos.set(b.p[0] + (Math.random() - 0.5) * 0.4, 0.05, b.p[2] + (Math.random() - 0.5) * 0.4);
          const e = 1e-6, cx = Math.max(goal.min[0], Math.min(goal.max[0], b.p[0])), cz = Math.max(goal.min[1], Math.min(goal.max[1], b.p[2])), cy = Math.min(goal.top, b.p[1]);
          if (b.p[0] < B.min[0] + R - e || b.p[0] > B.max[0] - R + e || b.p[2] < B.min[1] + R - e || b.p[2] > B.max[1] - R + e || b.p[1] < R - e || b.p[1] > B.top - R + e || Math.hypot(b.p[0] - cx, b.p[1] - cy, b.p[2] - cz) < R - 1e-4) out.push(b.p.map(v => +v.toFixed(3)));
          if (now - last < 8000) requestAnimationFrame(f); else res({ frames, out: out.slice(0, 5), n: out.length });
        };
        requestAnimationFrame(f);
      }), [corner.bounds, K.R, corner.solids[0]]);
      check('knocked about for eight seconds, it never leaves the corner or goes into the goal', r.frames > 200 && r.n === 0, `${r.frames} frames, outside ${r.n} times ${JSON.stringify(r.out)}`);
      await waitRest(p);
      check('and it settles again afterwards', (await ball(p)).still);
      check('bounds: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('lamps')) {
      const { ctx, p, errs } = await open(b, DESK);
      await p.waitForTimeout(1500);
      const ballBox = [130, 80, 200, 150], on = await picture(p, ...CORNER_EYE);
      await p.evaluate(() => window.__lights.set(false));
      await p.waitForFunction(() => window.__lights.k === 0, null, { timeout: 10000 });
      const off = await picture(p, ...CORNER_EYE);
      save(on, 'lamps-on-ball.png'); save(off, 'lamps-off-ball.png');
      const k = mean(off, ballBox) / mean(on, ballBox);
      check('with the lamps off the ball goes dim with the room', k < 0.75 && k > 0.05, k.toFixed(3));
      // Juggling in the dark works the same.
      await standBy(p, -0.8, 0.1);
      await p.keyboard.press('KeyE'); await p.waitForTimeout(100);
      check('lamps off: E still knocks it up', (await ball(p)).count === 1);
      await p.evaluate(() => window.__lights.set(true));
      check('lamps: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('nostore')) {
      // Storage blocked (a private window, a strict browser): the corner works and nothing breaks.
      const init = () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); };
      const { ctx, p, errs } = await open(b, DESK, { init });
      await p.waitForTimeout(1500);
      await standBy(p, -0.8, 0.1);
      await p.keyboard.press('KeyE');
      for (let n = 2; n <= 3; n++) { await holdAt(p, 0.5); await p.keyboard.press('KeyE'); await letGo(p); await p.waitForTimeout(60); }
      await waitRest(p);
      const s = await ball(p), said = await toast(p);
      check('storage blocked: juggling, the count and the best still work for the visit', s.last === 3 && s.best === 3 && said === '3 in a row. Your best yet.', said);
      check('storage blocked: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    // ---------- the save of the week ----------
    // The house's save for this week, worked out in the page from the same pure code, its points made `points`, kept as
    // the visitor's own for week `week` (default this one). Returns the house's own points.
    const keepOwn = (p, points, week = null) => p.evaluate(async ([points, week]) => {
      const R = await import('./src/pure/replay.js'), s = R.makeSearch(R.weekKey());
      while (!s.run(500));
      localStorage.setItem(R.KEY, R.pack({ ...s.best, points, week: week || R.weekKey() }));
      return s.best.points;
    }, [points, week]);
    const openReplay = async p => {
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-menu');
      await p.locator('.g-card', { hasText: 'Save of the week' }).locator('button').click();
      await p.waitForFunction(() => document.querySelector('.g-title')?.textContent === 'SAVE OF THE WEEK', null, { timeout: 10000 });
    };
    const replayLine = p => p.evaluate(() => document.querySelector('.g-rp-hud')?.textContent || '');
    const playing = (p, timeout = 30000) => p.waitForFunction(() => (document.querySelector('.g-rp-hud')?.textContent || '').length > 30, null, { timeout });
    const ended = p => p.waitForSelector('.g-card-wrap button.g-main', { timeout: 30000 });
    // The pitch's green on the canvas: the replay is drawing.
    const drawing = p => p.evaluate(() => {
      const c = document.querySelector('.g-stage canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 16) if (Math.abs(d[i] - 43) < 14 && Math.abs(d[i + 1] - 122) < 18 && Math.abs(d[i + 2] - 57) < 16) n++;
      return n;
    });
    const HOUSE = "BEHI FC's best save this week", MINE = 'Your save is the best this week';

    if (want('replay')) {
      const { ctx, p, errs } = await open(b, DESK);
      const early = await p.evaluate(() => __keeper.weekSave.stats);
      check("the house's match for the week does not start while the house opens", !early.started && !early.done, JSON.stringify(early));
      await p.waitForFunction(() => __keeper.weekSave.stats.done, null, { timeout: 90000, polling: 500 });
      const st = await p.evaluate(() => __keeper.weekSave.stats);
      check('later it is played out in spare moments, never more than a few ms at a time', st.done && st.slowest < 6 && st.clock > 0 && /^\d{4}-W\d{2}$/.test(st.week), JSON.stringify(st));
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-menu');
      const cards = await p.evaluate(() => [...document.querySelectorAll('.g-card h2')].map(e => e.textContent));
      check('the TV menu offers the save of the week, after the two ways to join the match', JSON.stringify(cards) === JSON.stringify(['Join as striker', 'Join as keeper', 'Save of the week', 'Watch my videos', 'Watch my film']), JSON.stringify(cards));
      await p.screenshot({ path: path.join(OUT, 'replay-menu.png') });
      await p.locator('.g-card', { hasText: 'Save of the week' }).locator('button').click();
      await p.waitForFunction(() => document.querySelector('.g-title')?.textContent === 'SAVE OF THE WEEK', null, { timeout: 10000 });
      await playing(p);
      await p.waitForTimeout(1200);
      const line = await replayLine(p), green = await drawing(p);
      check("picked, it plays BEHI FC's best save this week on the broadcast pitch", line.startsWith(HOUSE) && green > 200, `${line} | ${green}`);
      await p.screenshot({ path: path.join(OUT, 'replay-playing.png') });
      const t0 = Date.now();
      await ended(p);
      const took = (Date.now() - t0) / 1000;
      check('slowed down round the save, it ends on a card to watch it again', took > 1.5 && took < 8, `${took.toFixed(1)} s more`);
      await p.screenshot({ path: path.join(OUT, 'replay-end.png') });
      await p.keyboard.press('Space');
      await p.waitForTimeout(300);
      check('Space watches it again', await p.evaluate(() => !document.querySelector('.g-card-wrap')));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(300);
      check('Esc closes it, back in the room', await p.evaluate(() => !document.querySelector('.g-overlay') && __loft.mode === 'walk'));
      check('the replay: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('replayown')) {
      const { ctx, p, errs } = await open(b, DESK);
      // A save of my own this week, better than the house's: it takes the spot, marked as mine.
      const house = await keepOwn(p, 99);
      await openReplay(p);
      await playing(p);
      check('my own better save this week takes the spot, marked as mine', (await replayLine(p)).startsWith(MINE), await replayLine(p));
      await p.waitForTimeout(1000);
      await p.screenshot({ path: path.join(OUT, 'replay-own.png') });
      await p.keyboard.press('Escape');
      // Not better than the house's: the house's stays.
      await keepOwn(p, Math.max(0, house - 0.5));
      await openReplay(p);
      await playing(p);
      check("my save that is not better leaves the house's", (await replayLine(p)).startsWith(HOUSE), await replayLine(p));
      await p.keyboard.press('Escape');
      // Last week's save, however good, is not this week's.
      await keepOwn(p, 99, '2020-W01');
      await openReplay(p);
      await playing(p);
      check("an older week's save is ignored", (await replayLine(p)).startsWith(HOUSE), await replayLine(p));
      await p.keyboard.press('Escape');
      // A broken entry in storage is ignored too, and nothing breaks.
      await p.evaluate(() => localStorage.setItem('loft.save', '{"v":1,"frames":[[1,2]]'));
      await openReplay(p);
      await playing(p);
      check('a broken entry in storage is ignored', (await replayLine(p)).startsWith(HOUSE), await replayLine(p));
      await p.keyboard.press('Escape');
      // Saves made as keeper, filmed by the same recorder the match uses, offered in turn: only a better one is kept.
      const r = await p.evaluate(async () => {
        const R = await import('./src/pure/replay.js'), M = await import('./src/pure/match.js');
        let s = 2;
        const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        const m = M.newMatch({ kickoff: 1 }), rec = R.makeRecorder(), you = m.players.find(q => q.team === 0 && q.role === 'keeper'), clips = [];
        m.aggro = [0.6, 1.5];
        for (let t = 0; t < 90; t += 1 / 60) {
          const b = m.ball, dy = Math.sign(Math.max(-M.GOAL, Math.min(M.GOAL, b.y)) - you.y);
          const ev = M.stepMatch(m, 1 / 60, rand, { player: you, dx: 0, dy: Math.abs(b.y - you.y) > 0.2 ? dy : 0, dive: b.shot === 1 && Math.hypot(b.x - you.x, b.y - you.y) < 2.5 });
          const c = rec.step(m, ev, 1 / 60, () => t);
          if (c) clips.push(c);
        }
        localStorage.removeItem(R.KEY);
        const best = clips.reduce((a, c) => (!a || c.points > a.points ? c : a), null);
        const kept = clips.map(c => __keeper.weekSave.offer(c));
        const chosen = await __keeper.weekSave.get(), stored = R.unpack(localStorage.getItem(R.KEY), R.weekKey());
        const h = R.makeSearch(R.weekKey());
        while (!h.run(500));
        return { n: clips.length, kept: kept.filter(Boolean).length, best: best?.points, stored: stored?.points, who: chosen?.who, house: h.best.points };
      });
      check('saves made as keeper are kept only when better, the best of them stored for this week', r.n >= 2 && r.stored === r.best && r.kept >= 1 && r.kept <= r.n, JSON.stringify(r));
      check("and the save of the week is mine only if it beats the house's", r.who === (r.best > r.house ? 'you' : 'house'), JSON.stringify(r));
      check('my save: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
      // Storage blocked: the house's save plays, and a save of mine counts for this visit.
      const init = () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); };
      const q = await open(b, DESK, { init });
      await openReplay(q.p);
      await playing(q.p, 60000);
      check("storage blocked: the house's save plays", (await replayLine(q.p)).startsWith(HOUSE), await replayLine(q.p));
      await q.p.keyboard.press('Escape');
      const mine = await q.p.evaluate(async () => {
        const R = await import('./src/pure/replay.js'), s = R.makeSearch(R.weekKey());
        while (!s.run(500));
        const ok = __keeper.weekSave.offer({ ...s.best, points: 99 });
        return { ok, who: (await __keeper.weekSave.get())?.who };
      });
      check('storage blocked: a better save of mine still takes the spot for this visit', mine.ok && mine.who === 'you', JSON.stringify(mine));
      check('storage blocked: no error', q.errs.length === 0, q.errs.slice(0, 3).join(' | '));
      await q.ctx.close();
    }

    if (want('replayphone')) {
      const { ctx, p, errs } = await open(b, UPRIGHT);
      await openReplay(p);
      await playing(p, 90000);
      await p.waitForTimeout(1000);
      const fit = await p.evaluate(() => { const c = document.querySelector('.g-stage canvas').getBoundingClientRect(); return { over: document.documentElement.scrollWidth - innerWidth, w: c.width, h: c.height }; });
      check('phone: the replay fits the screen and draws', fit.over <= 0 && fit.w > 300 && fit.h > 200 && (await drawing(p)) > 100, JSON.stringify(fit));
      await p.screenshot({ path: path.join(OUT, 'phone-replay.png') });
      await ended(p);
      await p.screenshot({ path: path.join(OUT, 'phone-replay-end.png') });
      await p.locator('.g-card-wrap button.g-main').tap();
      await p.waitForTimeout(300);
      check('phone: a tap watches it again', await p.evaluate(() => !document.querySelector('.g-card-wrap')));
      check('phone replay: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('keepersave')) {
      // Joining the match as keeper with the recorder running: it plays as before and nothing breaks.
      const { ctx, p, errs } = await open(b, DESK);
      await p.evaluate(() => __loft.act('tv'));
      await p.waitForSelector('.g-menu');
      await p.locator('.g-card', { hasText: 'Join as keeper' }).locator('.g-main').click();
      await p.waitForSelector('.g-stage canvas');
      for (let i = 0; i < 40; i++) {
        const k = i % 2 ? 'ArrowUp' : 'ArrowDown';
        await p.keyboard.down(k); await p.waitForTimeout(120); await p.keyboard.up(k);
        if (i % 5 === 0) await p.keyboard.press('Space');
      }
      const tally = await p.evaluate(() => document.querySelector('.g-mt-tally')?.textContent || '');
      check('joining as keeper still plays, with its tally running', /saved, \d+ let in/.test(tally), tally);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(300);
      check('keeper with the recorder: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    if (want('cost')) {
      // Frame times and this corner's own share of each frame (its tick timed from inside, and the figures' slowest
      // piece of building in spare moments): the figures built, the first touch and a juggle, the first bob, then lying
      // still, then the replay opened (a slice a frame of the week's match while it waits, if it is not played out yet)
      // and played. Against a version without it, the house's own frames.
      const cpu = Number(process.env.SMOOTH_CPU || 1), slow = cpu > 1 ? ` (processor ${cpu}x slower)` : '';
      for (const [dev, opts] of [['desktop', DESK], ['phone', UPRIGHT]]) {
        if (dev === 'phone' && cpu === 1) continue;
        const { ctx, p, errs } = await open(b, opts, { keeper: false });
        const has = await p.evaluate(() => !!window.__keeper);
        if (cpu > 1) await (await p.context().newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
        await p.evaluate(() => {
          window.__frames = []; let last = performance.now();
          const f = t => { window.__frames.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
          window.__own = 0;
          const k = window.__keeper;
          if (k) { const tick = k.tick; k.tick = function (...a) { const t = performance.now(); tick.apply(this, a); window.__own = Math.max(window.__own, performance.now() - t); }; }
        });
        const take = () => p.evaluate(() => { const f = window.__frames.slice(2).sort((a, b) => a - b), own = window.__own; window.__frames = []; window.__own = 0; return { worst: +(f.at(-1) || 0).toFixed(1), p95: +(f[Math.floor(f.length * 0.95)] || 0).toFixed(1), n: f.length, own: +own.toFixed(2) }; });
        const rows = {};
        if (has) await p.waitForFunction(() => __keeper.figures.built, null, { timeout: 60000 }); else await p.waitForTimeout(5000);
        await p.waitForTimeout(1000);
        rows.build = await take();
        if (has) { rows.build.steps = await p.evaluate(() => __keeper.figures.times); rows.build.own = Math.max(rows.build.own, ...rows.build.steps); }
        await p.waitForTimeout(3000);
        rows.idle = await take();
        if (has) {
          await standBy(p, -0.8, 0.1);
          await take();
          await p.evaluate(() => __keeper.act('keepy'));
          await p.waitForTimeout(1500);
          rows.firstTouch = await take();
          for (let n = 0; n < 4; n++) { await dropTo(p, 0.5); await p.evaluate(() => __keeper.act('keepy')); }
          await waitRest(p);
          rows.juggle = await take();
          await p.evaluate(async () => { const THREE = await import('three'); const c = new THREE.Vector3(21.2, 3.08, -1.7), r = new THREE.Raycaster(c, new THREE.Vector3(1, -0.05, 0).normalize()); __keeper.figures.hit(r, null); });
          await p.waitForTimeout(1500);
          rows.firstBob = await take();
          await p.waitForTimeout(5000);
          await take();
          await p.waitForTimeout(3000);
          rows.still = await take();
          await p.waitForFunction(() => __keeper.weekSave.stats.started, null, { timeout: 60000, polling: 500 });
          await p.waitForTimeout(2000);
          await take();
          await openReplay(p);
          await playing(p, 120000);
          rows.search = { ...(await take()), slice: await p.evaluate(() => __keeper.weekSave.stats.slowest) };
          await p.waitForTimeout(6000);
          rows.replay = await take();
          await p.keyboard.press('Escape');
        }
        console.log(`${dev}${slow}, ${has ? 'with the corner' : 'without it'} (ms): ${JSON.stringify(rows)}`);
        if (has) {
          const bar = cpu > 1 ? 16.7 : 4;
          for (const k of ['build', 'firstTouch', 'juggle', 'firstBob']) check(`${dev}${slow}: ${k}, its own share of any frame under ${bar} ms`, rows[k].own < bar, `${rows[k].own} ms`);
          check(`${dev}${slow}: lying still, its share stays near zero`, rows.still.own < 0.3 * cpu, `${rows.still.own} ms`);
          check(`${dev}${slow}: the house's match for the week never takes more than ${cpu > 1 ? bar : 6} ms at a time`, rows.search.slice < (cpu > 1 ? bar : 6), `${rows.search.slice} ms`);
        }
        check(`${dev}${slow}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

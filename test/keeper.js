// The keeper's corner in a real Chrome, at a computer and on phones: the keepy-up ball by keyboard, click and tap, its
// count and best, the ball staying in its corner, lamps on and off, storage blocked.
//   LOFT_URL=http://127.0.0.1:8852 node test/keeper.js [outdir] [parts]
// Parts: ball, tap, phone, bounds, lamps, nostore.
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/keeper';
const ONLY = process.argv[3] || 'ball,tap,phone,bounds,lamps,nostore';
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
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}`);
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
const holdAt = (p, h) => p.evaluate(h => new Promise(res => { const k = __keeper.ball; k.go ||= k.tick; const f = () => { const b = k.ball; if (b.v[1] < 0 && b.p[1] - 0.1 < h) { k.tick = () => {}; res(); } else requestAnimationFrame(f); }; f(); }), h);
const letGo = p => p.evaluate(() => { const k = __keeper.ball; k.tick = k.go; });
const waitRest = p => p.waitForFunction(() => __keeper.ball.ball.rest && __keeper.ball.still, null, { timeout: 20000, polling: 100 });
const ballOnScreen = async p => onScreen(p, await p.evaluate(() => { const b = __keeper.ball.ball.p; return { x: b[0], y: b[1], z: b[2] }; }));
// The corner's ball from a little way off.
const CORNER_EYE = [[9.4, 3.9, 0.55], [10.25, 3.62, 0.1]];

(async () => {
  const K = await import('../web/src/pure/keepy.js');
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'assets', 'world.json')));
  const corner = K.cornerOf(meta);
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    if (want('ball')) {
      const { ctx, p, errs } = await open(b, DESK);
      await p.waitForTimeout(1500);
      const s0 = await ball(p);
      check('the ball lies still on its spot in the keeper\'s corner', s0.rest && s0.still && Math.abs(s0.p[0] - corner.home[0]) < 1e-6 && Math.abs(s0.p[2] - corner.home[2]) < 1e-6 && Math.abs(s0.p[1] - K.R) < 1e-6, JSON.stringify(s0.p));
      await standBy(p, -0.8, 0.1);
      const near = await p.evaluate(() => [__loft.near, document.getElementById('prompt').textContent, document.getElementById('prompt').classList.contains('on')]);
      check('beside it, E is offered', near[0] === 'keepy' && near[1].includes('Keep the ball up') && near[2], near.join(' | '));
      await p.keyboard.press('KeyE');
      await p.waitForTimeout(120);
      let s = await ball(p);
      check('E knocks it up', s.count === 1 && s.v[1] > 0 && !s.rest && s.label === 'Keep it up: 1', JSON.stringify({ count: s.count, vy: s.v[1], label: s.label }));
      await p.waitForTimeout(200);
      await p.keyboard.press('KeyE');
      await p.waitForTimeout(60);
      s = await ball(p);
      check('pressing again while it is still rising does nothing, and says to wait', s.count === 1 && s.v[1] > 0 && s.label === 'Wait for it to drop', `${s.label}, rising ${s.v[1].toFixed(2)}`);
      await waitRest(p);
      check('a run of one is not made much of', (await ball(p)).best === 1 && !(await toast(p)).includes('in a row'));
      // Keep it up by keyboard: E each time it comes down into reach.
      await standBy(p, -0.8, 0.1);
      await p.keyboard.press('KeyE');
      for (let n = 2; n <= 6; n++) { await dropTo(p, 0.5); await p.keyboard.press('KeyE'); await p.waitForTimeout(60); }
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
      // Held where it is for the click (a person aims ahead of a falling ball; the test reads it, then clicks), then let go.
      for (let n = 2; n <= 4; n++) { await holdAt(p, 0.55); at = await ballOnScreen(p); await p.mouse.click(at.x, at.y); await letGo(p); await p.waitForTimeout(60); }
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
      for (let n = 2; n <= 3; n++) { await dropTo(p, 0.55); const at = await ballOnScreen(p); await p.touchscreen.tap(at.x, at.y); await p.waitForTimeout(60); }
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
      for (let n = 2; n <= 3; n++) { await dropTo(p, 0.5); await p.keyboard.press('KeyE'); await p.waitForTimeout(60); }
      await waitRest(p);
      const s = await ball(p), said = await toast(p);
      check('storage blocked: juggling, the count and the best still work for the visit', s.last === 3 && s.best === 3 && said === '3 in a row. Your best yet.', said);
      check('storage blocked: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

// The desk and BH-22, in a real Chrome, part by part:
//   fish     the fish in the tank turn round about themselves and stay in the water (failed before these changes)
//   moods    BH-22's eyes by mood: hearts, happy arcs, x x
//   glow     its eyes keep their full glow after a pet (failed before these changes)
//   deploy   the DEPLOY button on the desk: E, the terminal's lines, one at a time, confetti and a dance
//   phone    a tap on DEPLOY walks over and presses it
//   button   the button presses down into its base (failed before these changes)
//   fan      BH-22 switches the desk fan on while the PC is busy, and it spins down after
//   holo     its rare hologram
//   jar      the pets' treat jar
//   smooth   the first of each new thing costs no long frame (it measures frames: run it alone, under the timing lock)
//   view     seated, the whole main monitor fills most of the view with its bottom and the keyboard below, at each shape;
//            the glides in and out are smooth (the body no longer jumps mid glide in: failed before these changes)
//   webcam   a small webcam on the main monitor's top bezel: in view from the seat, its body dims with the lamps, its
//            light glows on its own while I sit there
//   keyboard the desk keyboard at a real keyboard's size (keys 19 mm apart, 30 cm across)
//   typing   seated, my hands load only now, rise onto the keys, type each key pressed with the right finger, then
//            rest (left hand on the mouse) and go when I stand
//   pishi    Pishi jumping onto the keyboard while I type, sitting on it and jumping off: my hands keep out of her
//   LOFT_URL=http://127.0.0.1:8820 node test/desk.js [outdir] [only: parts, comma-separated]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/desk';
const ONLY = process.argv[3] || 'fish,moods,glow,deploy,phone,button,fan,holo,jar,view,webcam,keyboard,typing,pishi';
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
// The camera's turn that has me facing from a toward b (Blender axes): forward is (-sin yaw, -cos yaw) in three's x, z.
const yawTo = (a, b) => Math.atan2(-(b[0] - a[0]), b[1] - a[1]);
// Me at a spot (Blender axes), the camera turned to `yaw`.
const standAt = async (p, at, yaw) => { await p.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); if (yw !== undefined) __loft.yaw = yw; }, [b2t(...at), yaw]); await p.waitForTimeout(600); };
// BH-22 put somewhere (Blender axes) and held there for a while, its rounds paused.
const r2At = (p, at, timer = 60) => p.evaluate(([v, tm]) => { const r = __loft.creatures.bh22; Object.assign(r, { state: 'pause', timer: tm, route: [], then: null, pending: null }); r.epoch++; r.pos.set(v.x, v.y, v.z); }, [b2t(...at), timer]);
// Where a point in the room is on the screen.
const onScreen = (p, v) => p.evaluate(q => { const s = new __loft.camera.position.constructor(q.x, q.y, q.z).project(__loft.camera); return { x: (s.x + 1) / 2 * innerWidth, y: (1 - s.y) / 2 * innerHeight, front: s.z < 1 }; }, v);
const button = p => p.evaluate(() => { const b = __loft.scene.getObjectByName('deploy_btn'); b.updateMatrixWorld(true); b.geometry.computeBoundingBox(); const box = new b.geometry.boundingBox.constructor().setFromObject(b); return { lo: box.min.y, hi: box.max.y }; });
const eyes = p => p.evaluate(() => { const r = __loft.creatures.bh22; return { mood: __loft.creatures.mood, round: r.round.every(e => e.visible), shapes: r.eye.children.filter(c => !r.round.includes(c) && c.visible).length, colour: r.eyeMat.color.toArray().map(v => +v.toFixed(3)), lit: r.eyeLit.toArray().map(v => +v.toFixed(3)) }; });

(async () => {
  const W = require('../web/assets/world.json');
  const { FAN_SPOT, COOL } = await import('../web/src/pure/desk.js');
  const { HOLO_TEXT, HOLO_TIME } = await import('../web/src/pure/bh22.js');
  const { JAR } = await import('../web/src/pure/jar.js');
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
      // A click on it from across the room walks me right up to it to say hello: no oof on the way in (stopping beside it
      // read as walking into it). It stands on a point of the walk grid, as it does once it has rolled anywhere.
      await p.waitForTimeout(4500);
      const { makeNav } = await import('../web/src/pure/nav.js');
      const node = makeNav(W, { off: n => n === 'slider_slide' }).path([12.1, 9.4, 0], [12.1, 9.4, 0])[0];
      await r2At(p, node);
      await p.evaluate(() => { __loft.creatures.bh22.chaseCool = 999; });
      await standAt(p, [12.1, 6.4, 0], yawTo([12.1, 6.4], node));
      await p.waitForTimeout(900);
      const at = await onScreen(p, b2t(node[0], node[1], node[2] + 0.2));
      await p.evaluate(() => { window.__moods = new Set(); const look = () => { window.__moods.add(__loft.creatures.mood); if (window.__moods) window.__mf = requestAnimationFrame(look); }; look(); });
      await p.mouse.click(at.x, at.y);
      await p.waitForFunction(() => ['talk', 'petted', 'play'].includes(__loft.creatures.bh22.state), null, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(600);
      const went = await p.evaluate(() => { cancelAnimationFrame(__mf); const r = __loft.creatures.bh22; return { moods: [...__moods], state: r.state, d: +Math.hypot(__loft.pos.x - r.pos.x, __loft.pos.z - r.pos.z).toFixed(2) }; });
      check('a click on it walks me up to it and it greets me, with no oof on the way in', !went.moods.includes('dizzy') && ['talk', 'petted', 'play'].includes(went.state) && went.d < 1.1, `${JSON.stringify(at)} ${JSON.stringify(went)}`);
      check('moods: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- BH-22's eyes keep their glow after a pet (they came back dimmer, read back through a plain colour) ----------
    if (want('glow')) {
      const { ctx, p, errs } = await open(b, DESK);
      // At noon: from 23:00 to 6:00 a docked BH-22 dims its eyes on purpose, which is not what this check is about.
      await p.evaluate(() => { __loft.creatures.hour = 12; });
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
    // ---------- DEPLOY at a computer: E, the lines, once at a time, the button pressing down ----------
    if (want('deploy')) {
      const { ctx, p, errs } = await open(b, DESK);
      await p.evaluate(() => { const s = __loft.audio.sfx, f = s.deploy; window.__deploys = 0; s.deploy = (...a) => { __deploys++; return f(...a); }; });
      const before = await p.evaluate(() => ({ confetti: !!__loft.scene.getObjectByName('deploy_confetti'), earned: __loft.progress.list().some(a => a.id === 'deploy') }));
      check('nothing of the confetti is made before the first deploy', !before.confetti && !before.earned, JSON.stringify(before));
      await r2At(p, [19.9, 2.6, 0.45]);
      const spot = await p.evaluate(() => __desk.spot.at);
      await standAt(p, spot, yawTo(spot, W.points.deploy));
      const near = await p.evaluate(() => [__loft.near, document.getElementById('prompt').lastChild.nodeValue, document.getElementById('prompt').classList.contains('on')]);
      check('beside the desk the prompt offers DEPLOY', near[0] === 'deploy' && near[1] === 'Press DEPLOY' && near[2], JSON.stringify(near));
      // BH-22's speech bubble has been seen once (its shader is the house's, built the first time anything says a word).
      await p.evaluate(() => __loft.creatures.bh22.bub.say('beep', performance.now() / 1000));
      await p.waitForTimeout(600);
      const rest = await button(p), programs = await p.evaluate(() => __loft.renderer.info.programs.length);
      await p.keyboard.press('e');
      await p.waitForTimeout(150);
      const down = await button(p);
      const top = W.colliders.find(c => c.name === 'desk').max[2];
      check('the button goes down into its base, and stays on the desk', down.hi < rest.hi - 0.008 && down.lo > top - 0.02, `rest ${rest.lo.toFixed(3)} to ${rest.hi.toFixed(3)}, pressed ${down.lo.toFixed(3)} to ${down.hi.toFixed(3)}, desk top ${top}`);
      const now = await p.evaluate(() => ({ deploying: __loft.world.deploying, sweep: __loft.world.leds.deploy, confetti: __loft.scene.getObjectByName('deploy_confetti')?.visible, sounds: __deploys, r2: __loft.creatures.bh22.state, mood: __loft.creatures.mood }));
      await p.screenshot({ path: path.join(OUT, 'deploy-press.png') });
      check('E deploys: the green sweep, the fanfare, confetti out of the button', now.deploying && now.sweep && now.confetti && now.sounds === 1, JSON.stringify(now));
      check('BH-22 dances, happy', now.r2 === 'play' && now.mood === 'happy', `${now.r2} ${now.mood}`);
      await p.waitForTimeout(700);
      check('the achievement is earned', await p.evaluate(() => __loft.progress.list().some(a => a.id === 'deploy')));
      // Again, mid-deploy: nothing stacks.
      const leds0 = await p.evaluate(() => __loft.world.leds.deploy);
      await p.keyboard.press('e'); await p.waitForTimeout(100);
      await p.evaluate(() => __desk.press());
      const again = await p.evaluate(() => ({ sounds: __deploys, deploying: __loft.world.deploying }));
      check('pressed again while it runs: no second deploy, no second fanfare', leds0 && again.sounds === 1 && again.deploying, JSON.stringify(again));
      const back = await (async () => { await p.waitForTimeout(3000); return button(p); })();
      const after = await p.evaluate(() => ({ deploying: __loft.world.deploying, confetti: __loft.scene.getObjectByName('deploy_confetti').visible, programs: __loft.renderer.info.programs.length }));
      check('then the button is back as it was and the confetti gone', Math.abs(back.hi - rest.hi) < 1e-6 && Math.abs(back.lo - rest.lo) < 1e-6 && !after.deploying && !after.confetti, JSON.stringify({ back, after }));
      check('and no shader was built for it', after.programs === programs, `${programs} before, ${after.programs} after`);
      // The terminal: typed, and the button while the terminal is open.
      await p.evaluate(() => __loft.screens.run('deploy', () => {}));
      let lines = await p.evaluate(() => __loft.screens.desktop.term.lines.slice(-3));
      check('typed: the same lines as ever', lines.join('|') === '$ deploy|deploying...|build passed. shipped.', lines.join('|'));
      await p.evaluate(() => __loft.screens.run('deploy', () => {}));
      lines = await p.evaluate(() => __loft.screens.desktop.term.lines.slice(-2));
      check('typed again while it runs: it says so', lines.join('|') === '$ deploy|a deploy is already running.', lines.join('|'));
      await p.waitForTimeout(3200);
      // The button, with the terminal open on the desk's screen: its lines go there too.
      await p.evaluate(() => __desk.press());
      lines = await p.evaluate(() => __loft.screens.desktop.term.lines.slice(-3));
      check('the button, with the terminal open: its lines in the terminal', (await p.evaluate(() => __deploys)) === 3 && lines.join('|') === '$ deploy|deploying...|build passed. shipped.', lines.join('|'));
      // With the terminal shut, no lines.
      await p.waitForTimeout(3200);
      const n0 = await p.evaluate(() => { const st = __loft.screens.desktop.st; st.wins = st.wins.filter(w => w.app !== 'terminal'); st.focus = st.wins.at(-1)?.app || null; return __loft.screens.desktop.term.lines.length; });
      await p.evaluate(() => __desk.press());
      const n1 = await p.evaluate(() => __loft.screens.desktop.term.lines.length);
      check('with the terminal shut, the button still deploys and writes nothing', n1 === n0 && (await p.evaluate(() => __deploys)) === 4, `${n0} -> ${n1}`);
      // From where I stand to press it, the confetti shows round me: up over my head and out to the sides (it rose only
      // to about my head, and my own back hid most of it from the camera behind me).
      await p.waitForTimeout(3200);
      await standAt(p, spot, yawTo(spot, W.points.deploy));
      await p.waitForTimeout(800);
      await p.keyboard.press('e');
      const seen = await p.evaluate(async () => {
        const THREE = await import('three');
        const L = __loft, C = L.camera, mesh = L.scene.getObjectByName('deploy_confetti'), m = new THREE.Matrix4(), q = new THREE.Vector3(), s = new THREE.Vector3(), r = new THREE.Quaternion();
        const shots = [], t0 = performance.now();
        for (const at of [400, 700, 1000, 1300]) {
          while (performance.now() - t0 < at) await new Promise(f => requestAnimationFrame(f));
          const pts = [];
          for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); m.decompose(q, r, s); if (s.x > 0.01) pts.push(q.clone()); }
          shots.push({ pts, cam: C.position.clone(), vp: C.projectionMatrix.clone().multiply(C.matrixWorldInverse) });
        }
        const ray = new THREE.Raycaster();
        return shots.map(({ pts, cam, vp }) => {
          let n = 0;
          for (const pt of pts) {
            const ndc = pt.clone().applyMatrix4(vp);
            if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z > 1) continue;
            ray.set(cam, pt.clone().sub(cam).normalize()); ray.far = pt.distanceTo(cam);
            if (!ray.intersectObject(L.me.root, true).some(h => h.object.isMesh)) n++;
          }
          return +(n / mesh.count).toFixed(2);
        });
      });
      const share = seen.reduce((a, v) => a + v, 0) / seen.length;
      check('from where I stand to press it, most of the confetti shows round me', share > 0.5, `share in sight at 0.4, 0.7, 1.0, 1.3 s: ${seen.join(', ')}`);
      check('deploy: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- phones: a tap on the button walks over and presses it ----------
    if (want('phone')) {
      const { ctx, p, errs } = await open(b, UPRIGHT);
      await p.evaluate(() => { const s = __loft.audio.sfx, f = s.deploy; window.__deploys = 0; s.deploy = (...a) => { __deploys++; return f(...a); }; });
      await standAt(p, [19.4, 2.4, 0.45], yawTo([19.4, 2.4], W.points.deploy));
      await p.waitForTimeout(800);
      const at = await onScreen(p, b2t(...W.points.deploy));
      await p.screenshot({ path: path.join(OUT, 'phone-before.png') });
      await p.touchscreen.tap(at.x, at.y);
      await p.waitForFunction(() => window.__deploys > 0, null, { timeout: 10000 }).catch(() => {});
      const got = await p.evaluate(() => ({ deploys: __deploys, near: __loft.near, deploying: __loft.world.deploying }));
      await p.screenshot({ path: path.join(OUT, 'phone-deploy.png') });
      check('phone: a tap on DEPLOY walks me there and presses it', got.deploys === 1 && got.deploying, `${JSON.stringify(at)} ${JSON.stringify(got)}`);
      check('phone: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the button presses down into its base (it used to drop into the desk, scaled from the room's origin) ----------
    if (want('button')) {
      const { ctx, p, errs } = await open(b, DESK);
      const top = W.colliders.find(c => c.name === 'desk').max[2], rest = await button(p);
      await p.evaluate(() => __loft.world.deploy(performance.now() / 1000));
      await p.waitForTimeout(150);
      const down = await button(p);
      check('a deploy presses the button down into its base, on the desk', down.hi < rest.hi - 0.008 && down.hi > top && down.lo > top - 0.02, `rest ${rest.lo.toFixed(3)} to ${rest.hi.toFixed(3)}, pressed ${down.lo.toFixed(3)} to ${down.hi.toFixed(3)}, desk top ${top}`);
      check('button: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the fan: BH-22 switches it on while the PC is busy; it spins down after ----------
    if (want('fan')) {
      const { ctx, p, errs } = await open(b, DESK);
      const idle = await p.evaluate(() => ({ speed: __loft.world.fanSpeed, at: __loft.world.fanAt?.toArray(), fan: __desk.fan }));
      check('the fan stands still while the PC is quiet', idle.speed === 0 && !idle.fan.on && !idle.fan.busy, JSON.stringify(idle));
      const fanAt = idle.at;
      check('its blades sit in the cage on the desk', fanAt && Math.abs(fanAt[0] - 21.8) < 1e-6 && Math.abs(fanAt[1] - 1.37) < 1e-6 && Math.abs(fanAt[2] + 2.3) < 1e-6, JSON.stringify(fanAt));
      await r2At(p, [19.0, 3.4, 0.45], 1);
      await standAt(p, [19.3, 3.8, 0.45], yawTo([19.3, 3.8], FAN_SPOT));
      await p.evaluate(() => __loft.screens.desktop.games.start('orbit'));
      const busy = await p.evaluate(() => __desk.fan.busy);
      check('a game playing on the PC makes it busy', busy);
      await p.waitForFunction(() => __loft.creatures.bh22.state === 'fanOn', null, { timeout: 30000 }).catch(() => {});
      const r2 = await p.evaluate(spot => { const r = __loft.creatures.bh22; return { state: r.state, d: Math.hypot(r.pos.x - spot.x, r.pos.z - spot.z) }; }, b2t(...FAN_SPOT));
      await p.waitForTimeout(700);
      await p.screenshot({ path: path.join(OUT, 'fan-switch.png') });
      check('BH-22 rolls over to the fan', r2.state === 'fanOn' && r2.d < 0.1, JSON.stringify(r2));
      await p.waitForTimeout(1500);
      const on = await p.evaluate(() => ({ speed: __loft.world.fanSpeed, fan: __desk.fan, toast: document.getElementById('toast').textContent }));
      check('and switches it on: the blades spin up', on.fan.on && on.speed > 0.9, JSON.stringify(on));
      await p.evaluate(() => __loft.screens.desktop.games.stop());
      await p.waitForTimeout((COOL - 3) * 1000);
      check('it keeps running a while after the game stops', await p.evaluate(() => __desk.fan.on && __loft.world.fanSpeed === 1));
      await p.waitForTimeout(4500);
      const coast = await p.evaluate(() => ({ on: __desk.fan.on, speed: __loft.world.fanSpeed }));
      check('then it is switched off and coasts down', !coast.on && coast.speed < 1, JSON.stringify(coast));
      await p.waitForFunction(() => __loft.world.fanSpeed === 0, null, { timeout: 12000 }).catch(() => {});
      check('to a stop', await p.evaluate(() => __loft.world.fanSpeed === 0));
      // By hand: off while busy stays off, and BH-22 is not sent for.
      await p.evaluate(() => __loft.screens.run('fan', () => {}));
      const hand = await p.evaluate(() => ({ line: __loft.screens.desktop.term.lines.at(-1), on: __desk.fan.on }));
      check('typed `fan`: on, by hand', hand.line === 'fan on.' && hand.on, JSON.stringify(hand));
      await p.evaluate(() => __loft.screens.desktop.games.start('orbit'));
      await p.waitForTimeout(300);
      await p.evaluate(() => __loft.screens.run('fan', () => {}));
      await p.waitForTimeout(1500);
      const off = await p.evaluate(() => ({ line: __loft.screens.desktop.term.lines.at(-1), on: __desk.fan.on, r2: __loft.creatures.bh22.state }));
      check('typed again while busy: off, and BH-22 leaves it off', off.line === 'fan off.' && !off.on && off.r2 !== 'fan' && off.r2 !== 'fanOn', JSON.stringify(off));
      // Switched off by hand while BH-22 is on its way: it gets there and leaves the fan off.
      await p.evaluate(() => __loft.screens.desktop.games.stop());
      await p.waitForTimeout(400);
      await r2At(p, [19.0, 3.6, 0.45], 0.1);
      await p.evaluate(() => __loft.screens.desktop.games.start('orbit'));
      await p.waitForFunction(() => __loft.creatures.bh22.state === 'fan', null, { timeout: 10000 }).catch(() => {});
      const going = await p.evaluate(() => __loft.creatures.bh22.state);
      await p.evaluate(() => { __loft.screens.run('fan', () => {}); __loft.screens.run('fan', () => {}); });
      await p.waitForFunction(() => __loft.creatures.bh22.state === 'fanOn', null, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(1500);
      const left = await p.evaluate(() => ({ on: __desk.fan.on, speed: __loft.world.fanSpeed, line: __loft.screens.desktop.term.lines.at(-1) }));
      check('switched off by hand while BH-22 was on its way: it gets there and leaves the fan off', going === 'fan' && !left.on && left.speed === 0 && left.line === 'fan off.', `${going} ${JSON.stringify(left)}`);
      await p.evaluate(() => __loft.screens.desktop.games.stop());
      check('fan: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the hologram ----------
    if (want('holo')) {
      const { ctx, p, errs } = await open(b, DESK);
      const s = W.points.spawn;
      await standAt(p, s, Math.PI);
      await r2At(p, [s[0] + 0.6, s[1] + 0.1, s[2]]);
      await p.evaluate(() => { Math.random = () => 0; });
      await p.evaluate(() => __loft.creatures.act('bh22', { player: __loft.pos, mode: 'walk', facing: 0 }));
      const first = await p.evaluate(() => ({ holo: __loft.creatures.holo, toast: document.getElementById('toast').textContent }));
      check('never on the first chat, however lucky', !first.holo && /^BH-22: /.test(first.toast), JSON.stringify(first));
      // After that first chat its picture is drawn in spare time, so the first message costs no long frame on a slow phone.
      await p.waitForTimeout(3000);
      const ahead = await p.evaluate(() => { const h = __loft.creatures.bh22.root.getObjectByName('bh22_hologram'); return h ? { visible: h.visible, w: h.material.map.image.width } : null; });
      check('after the first chat the message is drawn ahead, unseen', ahead && !ahead.visible && ahead.w === 512, JSON.stringify(ahead));
      await ctx.close();
      const o = await open(b, DESK, '&holo');
      // Said hi before, so the first-chat achievement's note does not cover the message's.
      await o.p.evaluate(() => __loft.progress.earn('bh22'));
      await standAt(o.p, s, Math.PI);
      await r2At(o.p, [s[0] + 0.6, s[1] + 0.1, s[2]]);
      await o.p.evaluate(() => __loft.creatures.act('bh22', { player: __loft.pos, mode: 'walk', facing: 0 }));
      await o.p.waitForTimeout(900);
      const h = await o.p.evaluate(() => ({ holo: __loft.creatures.holo, toast: document.getElementById('toast').textContent, mood: __loft.creatures.mood }));
      await o.p.screenshot({ path: path.join(OUT, 'holo.png') });
      check('?holo: the hologram plays over its head, the message in the note too', h.holo && h.toast === `BH-22 plays a message: ${HOLO_TEXT.lines.join(' ')}` && h.mood === 'love', JSON.stringify(h));
      // While it plays, BH-22 is not offered for E: the prompt sat on top of the message, and a pet talked over it.
      const during = await o.p.evaluate(() => { __loft.creatures.act('bh22', { player: __loft.pos, mode: 'walk', facing: 0 }); return { near: __loft.near, state: __loft.creatures.bh22.state, holo: __loft.creatures.holo }; });
      check('while it plays BH-22 is not offered for E, and E does nothing', during.near !== 'bh22' && during.state === 'talk' && during.holo, JSON.stringify(during));
      await o.p.waitForTimeout(HOLO_TIME * 1000);
      check('and ends after a few seconds', !(await o.p.evaluate(() => __loft.creatures.holo)));
      await r2At(o.p, [s[0] + 0.6, s[1] + 0.1, s[2]]);
      await o.p.waitForTimeout(300);
      check('then it is offered again', (await o.p.evaluate(() => __loft.near)) === 'bh22');
      await o.p.evaluate(() => { Math.random = () => 0; for (let i = 0; i < 6; i++) __loft.creatures.act('bh22', { player: __loft.pos, mode: 'walk', facing: 0 }); });
      check('once a visit at most', !(await o.p.evaluate(() => __loft.creatures.holo)));
      check('holo: no error', errs.length === 0 && o.errs.length === 0, [...errs, ...o.errs].slice(0, 3).join(' | '));
      await o.ctx.close();
    }
    // ---------- the treat jar ----------
    if (want('jar')) {
      const { ctx, p, errs } = await open(b, DESK);
      check('the jar is in the house', await p.evaluate(() => !!__loft.scene.getObjectByName('treat_jar')));
      // Pishi on her window sill, Jessi napping: both come.
      await p.evaluate(() => { const c = __loft.creatures; c.pishi.timer = 999; c.jessi.timer = 999; });
      const st0 = await p.evaluate(() => [__loft.creatures.pishi.state, __loft.creatures.jessi.state]);
      await standAt(p, JAR.stand, yawTo(JAR.stand, JAR.at));
      const near = await p.evaluate(() => [__loft.near, document.getElementById('prompt').lastChild.nodeValue]);
      check('at the jar the prompt offers it', near[0] === 'treats' && near[1] === 'Shake the treat jar', JSON.stringify(near));
      await p.keyboard.press('e');
      await p.waitForTimeout(200);
      const said = await p.evaluate(() => document.getElementById('toast').textContent);
      check('E shakes it, and both come running', said === 'You shake the treat jar. Pishi and Jessi come running.', `${st0} / ${said}`);
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(OUT, 'jar-shake.png') });
      await p.keyboard.press('e'); await p.waitForTimeout(100);
      check('shaken again at once: they are already coming', (await p.evaluate(() => document.getElementById('toast').textContent)) === 'One moment, they are on their way.');
      // Where each one is when its treat begins.
      await p.evaluate(() => { window.__ate = {}; window.__ateT = setInterval(() => { for (const n of ['pishi', 'jessi']) { const a = __loft.creatures[n]; if (a.state === 'treat' && !__ate[n]) __ate[n] = [a.pos.x, a.pos.z]; } }, 50); });
      await p.waitForFunction(() => __ate.jessi, null, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(OUT, 'jar-jessi.png') });
      await p.waitForFunction(() => __ate.pishi && __ate.jessi, null, { timeout: 40000 }).catch(() => {});
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(OUT, 'jar-pishi.png') });
      const eat = await p.evaluate(sp => { const d = (a, q) => (a ? Math.hypot(a[0] - q.x, a[1] - q.z) : 99); return { dp: d(__ate.pishi, sp.pishi), dj: d(__ate.jessi, sp.jessi) }; }, { pishi: b2t(...JAR.spots.pishi), jessi: b2t(...JAR.spots.jessi) });
      check('each eats a treat at its own place by the jar', eat.dp < 0.35 && eat.dj < 0.35, JSON.stringify(eat));
      await p.waitForTimeout(4500);
      check('then they carry on', await p.evaluate(() => !['treat', 'totreat'].includes(__loft.creatures.pishi.state) && !['treat', 'totreat'].includes(__loft.creatures.jessi.state)));
      // From far off, both by the front door (well over seven seconds' walk). Shaken again while both are still on their
      // way, it says so (it once went by a six-second clock, and said nobody was free).
      await p.evaluate(([a1, a2]) => {
        const c = __loft.creatures, put = (a, at, state) => { Object.assign(a, { state, timer: 999, onFloor: true, route: [], hop: null, then: null, pending: null, repath: 99 }); a.epoch++; a.pos.set(at[0], at[2], -at[1]); };
        put(c.pishi, a1, 'sit'); put(c.jessi, a2, 'follow');
      }, [[2.6, 2.4, 0], [4.0, 2.4, 0]]);
      await p.waitForTimeout(300);
      const far = await p.evaluate(() => __jar.shake());
      await p.waitForTimeout(7500);
      const again = await p.evaluate(() => [__jar.shake(), __loft.creatures.pishi.state, __loft.creatures.jessi.state]);
      check('from far off both come, and shaken again while they are still on their way it says so', far === 'You shake the treat jar. Pishi and Jessi come running.' && again[1] === 'totreat' && again[2] === 'totreat' && again[0] === 'One moment, they are on their way.', `${far} / ${JSON.stringify(again)}`);
      // Her treat cut short (E, and she runs for the ball): her biscuit goes with it (it was left on the floor for good).
      await p.waitForFunction(() => __loft.creatures.jessi.state === 'treat', null, { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(300);
      const cut = await p.evaluate(() => {
        const c = __loft.creatures, j = c.jessi, V = j.pos.constructor;
        let biscuit = null;
        __loft.scene.traverse(o => { if (o.isMesh && o.parent === __loft.scene && o.visible && Math.abs(Math.hypot(o.position.x - j.pos.x, o.position.z - j.pos.z) - 0.2) < 0.02 && Math.abs(o.position.y - j.pos.y - 0.008) < 0.01) biscuit = o; });
        window.__biscuit = biscuit;
        const player = j.pos.clone().add(new V(0, 0, 0.6));
        for (const facing of [0, -Math.PI / 2, Math.PI / 2, Math.PI]) { if (j.state !== 'treat') break; c.act('jessi', { player, mode: 'walk', facing }); }
        return { found: !!biscuit, state: j.state };
      });
      await p.waitForTimeout(1000);
      const left = await p.evaluate(() => window.__biscuit?.visible);
      check('her treat cut short, the biscuit goes too', cut.found && cut.state !== 'treat' && left === false, `${JSON.stringify(cut)} biscuit shown after: ${left}`);
      check('jar: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- smooth: the first of each new thing costs no long frame (run alone, under the timing lock) ----------
    if (want('smooth')) {
      const { ctx, p, errs } = await open(b, DESK, '&holo');
      await p.waitForTimeout(6000);
      const s = W.points.spawn;
      await standAt(p, s, Math.PI);
      await r2At(p, [s[0] + 0.6, s[1] + 0.1, s[2]]);
      await p.waitForTimeout(1500);
      // The longest frame in the second before, and in the two seconds after, something first happens.
      const frames = what => p.evaluate(async w => {
        const gaps = [], stamp = () => new Promise(r => requestAnimationFrame(r));
        let last = await stamp();
        const take = async ms => { const end = performance.now() + ms, out = []; while (performance.now() < end) { const t = await stamp(); out.push(t - last); last = t; } return out; };
        const before = await take(1000);
        ({ deploy: () => __desk.press(), hearts: () => __loft.creatures.feel('love'), arcs: () => __loft.creatures.feel('happy'), x: () => __loft.creatures.feel('dizzy'),
          holo: () => __loft.creatures.act('bh22', { player: __loft.pos, mode: 'walk', facing: 0 }), jar: () => __jar.shake() })[w]();
        const after = await take(2000);
        return { before: Math.max(...before), after: Math.max(...after), slow: after.filter(g => g > 50).length };
      }, what);
      for (const what of ['deploy', 'hearts', 'arcs', 'x', 'holo', 'jar']) {
        const f = await frames(what);
        check(`the first ${what} draws with no long frame`, f.slow === 0 && f.after < Math.max(50, f.before * 1.5), `longest ${f.after.toFixed(1)} ms after, ${f.before.toFixed(1)} ms before`);
        await p.waitForTimeout(what === 'holo' ? HOLO_TIME * 1000 : 500);
      }
      check('smooth: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- seated: the whole main monitor, bezel and all, fills most of the view; its bottom and the keyboard show ----------
    if (want('view')) {
      const { seatView } = await import('../web/src/pure/seatview.js');
      const SIDEWAYS = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
      // The frame round the screen as the camera sees it (0 to 1 across and down the view), measured here on its own,
      // where the keyboard's back edge is, and how the desktop is laid on the screen.
      const seen = p => p.evaluate(() => {
        const L = __loft, s = L.meta.screens.main, V = L.camera.position.constructor, c = new V(s.center[0], s.center[2], -s.center[1]);
        const half = s.w / 2 * 1.025, at = v => { const q = v.clone().project(L.camera); return [(q.x + 1) / 2, (1 - q.y) / 2]; }, pts = [];
        for (let i = 0; i <= 8; i++) for (const y of [-1, 1]) pts.push(at(new V(c.x, c.y + y * (s.h / 2 + 0.014), c.z - half + 2 * half * i / 8)));
        const kb = L.world.deskThings.find(o => o.name === 'kb_glow');
        kb.geometry.computeBoundingBox();
        const box = kb.geometry.boundingBox.clone().applyMatrix4(kb.matrixWorld), key = at(new V(box.max.x, box.max.y + 0.03, (box.min.z + box.max.z) / 2));
        const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), dt = document.querySelector('.dt.on');
        // The desktop laid on the screen against the screen's own top and bottom edges, in the middle, in page pixels:
        // above the top edge or below the bottom one it would hide the frame there.
        let layer = null;
        if (dt && !dt.classList.contains('narrow')) {
          const M = new DOMMatrix(dt.style.transform), w = parseFloat(dt.style.width), h = parseFloat(dt.style.height);
          const on = (x, y) => { const q = M.transformPoint(new DOMPoint(x, y, 0, 1)); return q.y / q.w; };
          const edge = y => at(new V(c.x, c.y + y * s.h / 2, c.z))[1] * innerHeight;
          layer = { top: on(w / 2, 0) - edge(1), bottom: on(w / 2, h) - edge(-1) };
        }
        return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), key, fov: L.camera.fov, cam: L.camera.position.toArray(), dt: dt ? (dt.classList.contains('narrow') ? 'narrow' : 'on the screen') : 'none', layer };
      });
      // The camera's path through a glide, one sample each frame the glide moves it (it sets the lens every frame).
      const track = (p, ms, how) => p.evaluate(async ([w, h]) => {
        const cam = __loft.camera, out = [];
        cam.updateProjectionMatrix = function () { out.push([this.fov, ...this.position.toArray()]); return Object.getPrototypeOf(this).updateProjectionMatrix.call(this); };
        __loft[h]();
        await new Promise(r => setTimeout(r, w));
        delete cam.updateProjectionMatrix;
        return out;
      }, [ms, how]);
      // A glide has no jump in it. The lens widens or narrows in step with the glide's progress, so the camera's move
      // against the lens's change in a frame is its speed along the glide, whatever the frame took: no frame's may be
      // much above the frames either side of it (against at least a fifth of the fastest).
      const jumpy = pts => {
        const v = [];
        for (let i = 1; i < pts.length; i++) {
          const df = Math.abs(pts[i][0] - pts[i - 1][0]);
          if (df > 1e-3) v.push(Math.hypot(pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2], pts[i][3] - pts[i - 1][3]) / df);
        }
        const top = Math.max(...v);
        return Math.max(...v.map((x, i) => x / Math.max(v[i - 1] ?? 0, v[i + 1] ?? 0, top / 5)));
      };
      const shapes = [['16:9', { viewport: { width: 1600, height: 900 } }, 'wide'], ['16:10', { viewport: { width: 1440, height: 900 } }, 'wide'], ['a phone on its side', SIDEWAYS, 'side'], ['an upright phone', UPRIGHT, 'up']];
      for (const [name, opts, kind] of shapes) {
        const { ctx, p, errs } = await open(b, opts);
        await standAt(p, W.points.desk_use, Math.PI / 2);
        const glideIn = await track(p, 2600, 'useDesk');
        await p.waitForTimeout(700);
        const r = await seen(p), v = seatView(W.screens.main, opts.viewport.width / opts.viewport.height);
        const c = b2t(...W.screens.main.center), want = [c.x - v.back, c.y + v.up, c.z - v.range];
        check(`${name}: the glide in ends at the seat's eye, in one smooth move`, Math.hypot(...r.cam.map((x, i) => x - want[i])) < 0.002 && Math.abs(r.fov - v.fov) < 0.01 && jumpy(glideIn) < 1.25, `eye ${r.cam.map(x => x.toFixed(3))}, fov ${r.fov.toFixed(1)}, fastest frame ${jumpy(glideIn).toFixed(2)} times its neighbours`);
        const w = r.x1 - r.x0, h = r.y1 - r.y0, d = `${(w * 100).toFixed(1)}% wide, ${(h * 100).toFixed(1)}% tall, top ${(r.y0 * 100).toFixed(1)}%, bottom ${(r.y1 * 100).toFixed(1)}%, keyboard ${(r.key[1] * 100).toFixed(1)}% down, desktop ${r.dt}`;
        if (kind === 'wide') check(`${name}: the monitor fills 80 to 85% of the width, its top and bottom in view, the keyboard below, the desktop on its screen`, w > 0.8 && w < 0.85 && r.x0 > 0 && r.x1 < 1 && r.y0 > 0.03 && r.y1 < 0.8 && r.key[1] > r.y1 && r.key[1] < 0.98 && r.dt === 'on the screen', d);
        if (kind === 'wide') check(`${name}: the desktop stays inside the screen's top and bottom edges, so the frame shows evenly all round`, r.layer && r.layer.top > -1 && r.layer.top < 2 && r.layer.bottom < 1 && r.layer.bottom > -2, `the desktop's top ${r.layer?.top.toFixed(1)} px below the screen's top edge, its bottom ${r.layer?.bottom.toFixed(1)} px below the bottom edge, in the middle`);
        if (kind === 'side') check(`${name}: the whole monitor in view, as tall as leaves the keyboard showing below`, w > 0.6 && w < 0.85 && r.x0 > 0 && r.x1 < 1 && r.y0 > 0.03 && r.y1 < 0.8 && r.key[1] > r.y1 && r.key[1] < 0.98 && r.dt === 'narrow', d);
        if (kind === 'up') {
          check(`${name}: the monitor's whole height in view, the keyboard below, dragged across its width`, r.y0 > 0.03 && r.y1 < 0.65 && r.key[1] > r.y1 && r.key[1] < 0.98 && v.range > 0 && r.dt === 'narrow', d);
          // Turned on its side while I sit: fitted again to the new shape.
          await p.setViewportSize(SIDEWAYS.viewport);
          await p.waitForTimeout(500);
          const t = await seen(p), vs = seatView(W.screens.main, SIDEWAYS.viewport.width / SIDEWAYS.viewport.height);
          check('the phone turned on its side while seated: the view fits the new shape at once', Math.abs(t.fov - vs.fov) < 0.01 && t.x0 > 0 && t.x1 < 1 && t.y1 < 0.8 && t.key[1] < 0.98, `${((t.x1 - t.x0) * 100).toFixed(1)}% wide, bottom ${(t.y1 * 100).toFixed(1)}%, keyboard ${(t.key[1] * 100).toFixed(1)}%`);
        }
        await p.screenshot({ path: path.join(OUT, `view-${kind}-${opts.viewport.width}.png`) });
        const glideOut = await track(p, 2000, 'leaveDesk');
        check(`${name}: and the glide out is one smooth move too`, jumpy(glideOut) < 1.25, `fastest frame ${jumpy(glideOut).toFixed(2)} times its neighbours`);
        check(`${name}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
    }
    // ---------- the webcam on the main monitor ----------
    if (want('webcam')) {
      const { ctx, p, errs } = await open(b, { viewport: { width: 1440, height: 900 } });
      const cam = () => p.evaluate(() => {
        const L = __loft, g = L.scene.getObjectByName('webcam'), s = L.meta.screens.main, V = L.camera.position.constructor;
        if (!g) return null;
        const body = g.getObjectByName('webcam_body'), led = g.getObjectByName('webcam_led');
        g.updateMatrixWorld(true);
        body.geometry.computeBoundingBox();
        const box = body.geometry.boundingBox.clone().applyMatrix4(body.matrixWorld);
        const top = s.center[2] + s.h / 2 + 0.014, right = g.position.z - -s.center[1];
        const onFace = Math.abs(g.position.x - s.center[0]) < 1e-4;
        // The upper monitor's screen leans back over it: points along its bottom edge and a little up its face.
        const scr = L.scene.getObjectByName('screen_top'), sp = scr.geometry.attributes.position, corners = [];
        for (let i = 0; i < sp.count; i++) corners.push(new V().fromBufferAttribute(sp, i).applyMatrix4(scr.matrixWorld));
        corners.sort((a, b) => a.y - b.y);
        const [b0, b1, t0] = corners, upper = [];
        for (let i = 0; i <= 20; i++) for (const up of [0, 0.01, 0.02]) upper.push(b0.clone().lerp(b1, i / 20).add(t0.clone().sub(b0).setLength(up)));
        // The light bar (blender/zones/studio.py), in three's axes.
        const bar = { min: [s.center[0] - 0.0475, s.center[2] + s.h / 2 + 0.014, -s.center[1] - 0.23], max: [s.center[0] + 0.046, s.center[2] + s.h / 2 + 0.031, -s.center[1] + 0.23] };
        const clear = (b, o) => b.max.x < o.min[0] || b.min.x > o.max[0] || b.max.y < o.min[1] || b.min.y > o.max[1] || b.max.z < o.min[2] || b.min.z > o.max[2];
        const lens = new V(0, 0, 1).applyQuaternion(g.quaternion);
        const m = body.material;
        return { seat: Math.abs(g.position.y - top), onFace, right, size: box.getSize(new V()).toArray().map(v => +v.toFixed(3)), barClear: clear(box, bar),
          upperClear: upper.every(q => !box.containsPoint(q)), lens: lens.toArray().map(v => +v.toFixed(3)),
          dims: m.customProgramCacheKey?.() === 'lamp', glowTag: led.material.userData.lamp, led: led.material.color.toArray().map(v => +v.toFixed(2)) };
      });
      const r = await cam();
      check('a webcam sits on the main monitor: on its top bezel, right of the light bar and its clamp', !!r && r.seat < 5e-4 && r.onFace && r.right > 0.32 && r.right < 0.4 && r.barClear && r.upperClear, JSON.stringify(r));
      check('it is a small one, its lens looking out at me', !!r && r.size[0] < 0.085 && r.size[1] < 0.09 && r.size[2] < 0.11 && r.lens[0] < -0.95, r && `${r.size} m, lens ${r.lens}`);
      check('its body dims with the lamps; its light is tagged to keep its own glow, off while I stand', !!r && r.dims && r.glowTag === 'glow' && Math.max(...r.led) < 0.1, r && `${r.dims} ${r.glowTag} ${r.led}`);
      await standAt(p, W.points.desk_use, Math.PI / 2);
      await p.evaluate(() => __loft.useDesk());
      await p.waitForTimeout(3200);
      // Seated, it is in view, nothing in front of it, and its light is on, whether the lamps are on or off.
      const seen = await p.evaluate(() => {
        const L = __loft, g = L.scene.getObjectByName('webcam'), V = L.camera.position.constructor;
        const lens = g.localToWorld(new V(0, 0.0245, 0.0136)), q = lens.clone().project(L.camera);
        return { x: (q.x + 1) / 2, y: (1 - q.y) / 2, lens: lens.toArray() };
      });
      const hit = await p.evaluate(async ([lx, ly, lz]) => {
        const THREE = await import('three'), L = __loft, from = L.camera.position.clone(), to = new THREE.Vector3(lx, ly, lz);
        const rc = new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, from.distanceTo(to) + 0.02);
        rc.camera = L.camera;
        const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
        const first = rc.intersectObjects(L.scene.children, true).find(h => shown(h.object));
        return first ? first.object.name : 'nothing';
      }, seen.lens);
      check('seated, the webcam is in view with nothing in front of it', seen.x > 0.05 && seen.x < 0.95 && seen.y > 0 && seen.y < 0.2 && /^webcam/.test(hit), `at ${seen.x.toFixed(3)}, ${seen.y.toFixed(3)} of the view; first hit ${hit}`);
      const ledOn = await p.evaluate(() => __loft.scene.getObjectByName('webcam_led').material.color.r);
      await p.evaluate(() => __lights.set(false));
      await p.waitForTimeout(4000);
      const dark = await p.evaluate(() => ({ room: __lights.uniforms.room.value.toArray(), led: __loft.scene.getObjectByName('webcam_led').material.color.r, k: __lights.k }));
      check('seated, its light is on, and stays lit with the lamps off while the room dims', ledOn > 1.3 && dark.led === ledOn && dark.k < 0.05 && Math.max(...dark.room) < 0.6, `light ${ledOn}, lamps off: room ${dark.room.map(v => v.toFixed(2))}, light ${dark.led}`);
      await p.screenshot({ path: path.join(OUT, 'webcam-seated-dark.png') });
      await p.evaluate(() => __lights.set(true));
      await p.evaluate(() => __loft.leaveDesk());
      await p.waitForTimeout(2500);
      check('standing up turns its light off', (await p.evaluate(() => __loft.scene.getObjectByName('webcam_led').material.color.r)) < 0.1);
      check('webcam: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- the keyboard at a real keyboard's size ----------
    if (want('keyboard')) {
      const { ctx, p, errs } = await open(b, DESK);
      const g = await p.evaluate(() => { const o = __loft.world.deskThings.find(m => m.name === 'kb_glow'); o.geometry.computeBoundingBox(); const s = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).getSize(new __loft.camera.position.constructor()); return [s.x, s.z]; });
      check('the keyboard is a 65% board at a real one\'s size: 32.5 cm across, 11.7 cm deep (its glow underneath)', Math.abs(g[1] - 0.327) < 0.003 && Math.abs(g[0] - 0.117) < 0.003, g.map(v => v.toFixed(3)).join(' x '));
      const lit = await p.evaluate(() => { const m = __loft.scene.getObjectByName('kb_legends'), pl = m?.getObjectByName('kb_plate'); return m && { quads: m.geometry.index.count / 6, glow: m.material.userData.lamp, map: !!m.material.map, plate: pl?.material.userData.lamp, shown: m.visible && pl.visible }; });
      check('its 66 legends (all but the bare space bar and the pomegranate on Escape) lit from inside, the light under its keys too, both kept lit with the lamps off', !!lit && lit.quads === 66 && lit.glow === 'glow' && lit.map && lit.plate === 'glow' && lit.shown, JSON.stringify(lit));
      check('keyboard: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- my hands at the desk ----------
    if (want('typing')) {
      const { ctx, p, errs } = await open(b, { viewport: { width: 1440, height: 900 } });
      const asked = [];
      p.on('request', r => { if (/assets\/hand\/|realhand|realposes/.test(r.url())) asked.push(r.url()); });
      await p.waitForTimeout(1500);
      check('nothing of the hands is fetched before I sit', asked.length === 0, asked.slice(0, 2).join(' '));
      await standAt(p, W.points.desk_use, Math.PI / 2);
      await p.evaluate(() => __loft.useDesk());
      await p.waitForFunction(() => window.__deskHands.loaded && __deskHands.group.visible, null, { timeout: 30000 });
      await p.waitForTimeout(2000);
      const fetched = asked.filter(u => /hand\.glb/.test(u)).length;
      check('seated, the hands load once and rise onto the desk; the skin picture is not fetched', fetched === 1 && !asked.some(u => /skin\.webp/.test(u)), `${fetched} hand file, ${asked.length} requests`);
      // Each key goes down whole: no triangle of the studio has its corners on different keys, or some on a key and
      // some not, and the pomegranate standing on Escape is all Escape's (it tore when Escape went down).
      const whole = await p.evaluate(async () => {
        const { DESK, KEY } = await import('/src/pure/typing.js'), base = __loft.scene.getObjectByName('kb_legends').position, v = base.clone();
        let mesh = null;
        __loft.scene.traverse(m => { if (m.isMesh && m.name === 'studio_baked') mesh = m; });
        const g = mesh.geometry, k = g.attributes.aKey.array, I = g.index, at = i => (I ? I.getX(i) : i), out = { torn: 0, pom: 0, onEscape: 0 };
        for (let i = 0; i < (I ? I.count : k.length); i += 3) if (k[at(i)] !== k[at(i + 1)] || k[at(i)] !== k[at(i + 2)]) out.torn++;
        mesh.updateMatrixWorld(true);
        for (let i = 0; i < k.length; i++) {
          v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(mesh.matrixWorld).sub(base);
          if (v.y > DESK.key.top + 0.001 && Math.abs(v.x - KEY.Escape.x) < 0.012 && Math.abs(v.z - KEY.Escape.z) < 0.012) { out.pom++; if (k[i] === KEY.Escape.index) out.onEscape++; }
        }
        return out;
      });
      check('each key goes down whole, the pomegranate on Escape with it', whole.torn === 0 && whole.pom > 100 && whole.onEscape === whole.pom, JSON.stringify(whole));
      // A key typed: the finger that touch-types it strokes it and the key goes down under it, its legend with it; at
      // the bottom the finger's tip (the lowest of the skin round its last bone, as drawn) is on the key's cap.
      const strokeOf = (code, key) => p.evaluate(async ([code, key]) => {
        const { KEY, fingerFor, spotOn } = await import('/src/pure/typing.js'), k = KEY[code], f = fingerFor(k), [sx, sz] = spotOn(k, f.side, f.digit);
        const out = { most: 0, at: -1, typing: 0, want: k.index, tip: null }, step = () => new Promise(r => requestAnimationFrame(r));
        const V = __loft.camera.position.constructor, base = __loft.scene.getObjectByName('kb_legends').position;
        window.dispatchEvent(new KeyboardEvent('keydown', { code, key }));
        const t0 = performance.now();
        while (performance.now() - t0 < 1000) {
          await step();
          const P = __deskHands.press;
          for (let i = 0; i < P.length; i++) if (P[i] > out.most) {
            out.most = P[i]; out.at = i;
            const bone = __deskHands.group.getObjectByName(`${f.side}_${f.digit}3`), mesh = __deskHands.group.getObjectByName(`${f.side}_realhand`), end = bone.getWorldPosition(new V()), v = new V();
            let low = null;
            mesh.updateMatrixWorld(true);
            for (let n = 0; n < mesh.geometry.attributes.position.count; n++) { mesh.getVertexPosition(n, v).applyMatrix4(mesh.matrixWorld); if (v.distanceTo(end) < 0.03 && (!low || v.y < low.y)) low = v.clone(); }
            const tip = low.sub(base);
            out.tip = [tip.x - sx, tip.y - 0.039 + P[i], tip.z - sz].map(v => +v.toFixed(4));
            out.cap = [k.d / 2, k.w / 2, Math.abs(tip.x - k.x) < k.d / 2, Math.abs(tip.z - k.z) < k.w / 2];
          }
          out.typing = Math.max(out.typing, __deskHands.typing);
        }
        return out;
      }, [code, key]);
      for (const [code, key] of [['KeyJ', 'j'], ['KeyP', 'p'], ['KeyQ', 'q'], ['Digit1', '1'], ['Backspace', 'Backspace']]) {
        const st = await strokeOf(code, key);
        await p.waitForTimeout(150);
        check(`${code} typed: its key goes all the way down under the finger that touch-types it, the fingertip on it, then up`, st.at === st.want && st.most > 0.003 && st.typing > 0.5 && st.cap[2] && st.cap[3] && Math.hypot(st.tip[0], st.tip[2]) < 0.009 && st.tip[1] > -0.0015 && st.tip[1] < 0.003 && (await p.evaluate(() => Math.max(...__deskHands.press))) === 0, JSON.stringify(st));
      }
      // Backquote typed (this board's Escape): my little finger lands on the pomegranate standing on the key and
      // presses it down, never into it (it pressed the cap's top, inside the pomegranate).
      const pom = await p.evaluate(async () => {
        const { KEY } = await import('/src/pure/typing.js'), k = KEY.Escape, base = __loft.scene.getObjectByName('kb_legends').position, v = base.clone();
        let mesh = null;
        __loft.scene.traverse(m => { if (m.isMesh && m.name === 'studio_baked') mesh = m; });
        const g = mesh.geometry, P = g.attributes.position, lo = [1, 1, 1], hi = [-1, -1, -1];
        mesh.updateMatrixWorld(true);
        // The pomegranate's corners: over Escape's cap, and not the cap's own (a box, its corners on its edges).
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld).sub(base);
          if (Math.abs(v.x - k.x) > 0.01 || Math.abs(v.z - k.z) > 0.01 || v.y < 0.03 || v.y > 0.06) continue;
          if (Math.abs(Math.abs(v.x - k.x) - k.d / 2) < 1e-4 && Math.abs(Math.abs(v.z - k.z) - k.w / 2) < 1e-4) continue;
          v.toArray().forEach((x, j) => { lo[j] = Math.min(lo[j], x); hi[j] = Math.max(hi[j], x); });
        }
        const c = lo.map((x, j) => (x + hi[j]) / 2), r = lo.map((x, j) => (hi[j] - x) / 2), out = { inside: 0, gap: 1, most: 0, r: r.map(x => +x.toFixed(4)) };
        const hand = __deskHands.group.getObjectByName('left_realhand'), n = hand.geometry.attributes.position.count;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: String.fromCharCode(96) }));
        const t0 = performance.now();
        while (performance.now() - t0 < 1000) {
          await new Promise(done => requestAnimationFrame(done));
          const d = __deskHands.press[k.index];
          hand.updateMatrixWorld(true);
          let gap = 1;
          for (let i = 0; i < n; i++) {
            hand.getVertexPosition(i, v).applyMatrix4(hand.matrixWorld).sub(base);
            const e = [(v.x - c[0]) / r[0], (v.y - c[1] + d) / r[1], (v.z - c[2]) / r[2]], q = Math.hypot(...e), far = Math.hypot(v.x - c[0], v.y - c[1] + d, v.z - c[2]);
            if (q < 0.97) out.inside++;
            gap = Math.min(gap, far * (1 - 1 / q));
          }
          if (d >= out.most) { out.most = d; out.gap = +gap.toFixed(4); }
        }
        return out;
      });
      check('the backquote key (Escape here) typed: my little finger presses the pomegranate on it from its top, never going into it', pom.inside === 0 && pom.most > 0.003 && pom.gap > -0.0005 && pom.gap < 0.003, JSON.stringify(pom));
      // Seen from my eyes, the keys being typed nearest me are not hidden behind my sleeves.
      const hid = await p.evaluate(async () => {
        const { KEY } = await import('/src/pure/typing.js'), T = __loft.camera.position.constructor, base = __loft.scene.getObjectByName('kb_legends').position;
        const ray = new (await import('three')).Raycaster(), sleeves = [];
        __deskHands.group.traverse(o => { if (o.isMesh && o.parent?.name === 'sleeve') sleeves.push(o); });
        const out = {};
        for (const id of ['KeyV', 'KeyB', 'KeyN', 'KeyM', 'KeyC', 'Space']) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: id, key: id === 'Space' ? ' ' : id.slice(3).toLowerCase() }));
          for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
          const k = KEY[id], at = new T(k.x, 0.039, k.z).add(base), eye = __loft.camera.getWorldPosition(new T());
          ray.set(eye, at.clone().sub(eye).normalize()); ray.far = eye.distanceTo(at) - 0.004;
          out[id] = ray.intersectObjects(sleeves, false).length;
        }
        return out;
      });
      check('seated, the keys typed nearest me are not behind my sleeves', Object.values(hid).every(n => n === 0), JSON.stringify(hid));
      await p.keyboard.type('the quick brown fox', { delay: 70 });
      const busy = await p.evaluate(() => __deskHands.typing);
      await p.waitForTimeout(3500);
      const idle = await p.evaluate(() => __deskHands.typing);
      check('typing keeps both hands on the keys; a pause sends the right hand back to the mouse', busy > 0.99 && idle === 0, `${busy} then ${idle}`);
      // Typed while the hands are still on their way to the keys, "lol" is three strokes of my right ring finger, one
      // after another: never two of its keys down at once (L and O went down together, O with no finger on it).
      const lol = await p.evaluate(async () => {
        const { KEYS, fingerFor } = await import('/src/pure/typing.js'), out = { together: 0, downs: [] }, was = new Float32Array(KEYS.length);
        for (const ch of 'lol') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Key' + ch.toUpperCase(), key: ch }));
        const t0 = performance.now();
        while (performance.now() - t0 < 2500) {
          await new Promise(done => requestAnimationFrame(done));
          const P = __deskHands.press, fingers = {};
          KEYS.forEach((k, i) => {
            if (P[i] > 0) { const f = fingerFor(k); fingers[f.side + f.digit] = (fingers[f.side + f.digit] || 0) + 1; if (!was[i]) out.downs.push(k.id); }
            was[i] = P[i];
          });
          if (Object.values(fingers).some(n => n > 1)) out.together++;
        }
        return out;
      });
      check('keys typed while my hands come onto the keyboard are pressed one at a time by their finger', lol.together === 0 && lol.downs.join() === 'KeyL,KeyO,KeyL', JSON.stringify(lol));
      await p.evaluate(() => __loft.leaveDesk());
      await p.waitForTimeout(2500);
      check('standing up, the hands go', !(await p.evaluate(() => __deskHands.group.visible)));
      check('typing: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
      // On a phone whose keyboard names no key (Android's "Unidentified"), the command box's text changing is what
      // moves the fingers: one stroke for each character typed, also after the page has set the line itself (Enter
      // clearing it, Up bringing back the last command, the fill chip), which queued a Backspace for every character
      // that had been there.
      const ph = await open(b, UPRIGHT);
      await standAt(ph.p, W.points.desk_use, Math.PI / 2);
      await ph.p.evaluate(() => __loft.useDesk());
      await ph.p.waitForFunction(() => window.__deskHands.loaded && __deskHands.group.visible, null, { timeout: 30000 });
      await ph.p.waitForTimeout(1500);
      const phone = await ph.p.evaluate(async () => {
        const box = document.getElementById('cmd'), step = () => new Promise(r => requestAnimationFrame(r)), out = { most: 0, strokes: 0, after: {} };
        const settle = async () => { for (let i = 0; i < 150 && __deskHands.strokes; i++) await step(); await new Promise(r => setTimeout(r, 200)); };
        // As a browser sends it: the key with no name, the text about to change, the change, then that it changed.
        const type = async ch => {
          await settle();
          box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', bubbles: true }));
          box.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: ch, inputType: 'insertText' }));
          box.value += ch;
          box.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
          const queued = __deskHands.strokes;
          for (let i = 0; i < 60 && (__deskHands.strokes || i < 3); i++) { await step(); out.most = Math.max(out.most, ...__deskHands.press); }
          return queued;
        };
        const press = async key => { await settle(); box.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true })); };
        box.focus();
        for (const ch of 'help') out.strokes = Math.max(out.strokes, await type(ch));
        await press('Enter');
        out.after.enter = await type('l');
        await press('ArrowUp');
        out.after.history = await type('s');
        await press('Enter');
        await type('h'); await type('e');
        // The fill chip over the box (on a branch with the terminal's autofill).
        const chip = document.querySelector('.fill-chip.on');
        if (chip) { chip.click(); out.after.chip = await type('x'); }
        return out;
      });
      check('phone: typing that names no key moves one finger for each character typed, also after Enter, the history and the fill chip set the line', phone.strokes === 1 && phone.most > 0.003 && phone.after.enter === 1 && phone.after.history === 1 && Object.values(phone.after).every(n => n === 1), JSON.stringify(phone));
      check('phone typing: no error', ph.errs.length === 0, ph.errs.slice(0, 3).join(' | '));
      await ph.ctx.close();
    }
    // ---------- Pishi on the keyboard while I type ----------
    if (want('pishi')) {
      const { ctx, p, errs } = await open(b, { viewport: { width: 1440, height: 900 } }, '&matchday=off');
      await standAt(p, W.points.desk_use, Math.PI / 2);
      await p.evaluate(() => __loft.useDesk());
      await p.waitForFunction(() => window.__deskHands.loaded && __deskHands.group.visible, null, { timeout: 30000 });
      await p.waitForTimeout(2000);
      // How many corners of my hands and sleeves, as drawn, are inside her: each corner near her is inside when the
      // nearest point of her surface faces away from it.
      await p.evaluate(async () => {
        const THREE = await import('three'), c = __loft.creatures.pishi, q = new THREE.Vector3(), n = new THREE.Vector3(), v = new THREE.Vector3();
        const drawn = o => { for (let up = o; up; up = up.parent) if (!up.visible) return false; return true; };
        window.__inPishi = () => {
          const tris = [], her = new THREE.Box3(), out = { left: 0, right: 0 };
          c.root.updateMatrixWorld(true);
          c.root.traverse(o => {
            if (!o.isMesh || !drawn(o)) return;
            const P = o.geometry.attributes.position, I = o.geometry.index, at = i => new THREE.Vector3().fromBufferAttribute(P, I ? I.getX(i) : i).applyMatrix4(o.matrixWorld);
            for (let i = 0; i < (I ? I.count : P.count); i += 3) { const t = new THREE.Triangle(at(i), at(i + 1), at(i + 2)); tris.push(t); her.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c); }
          });
          __deskHands.group.updateMatrixWorld(true);
          __deskHands.group.traverse(m => {
            if (!m.isMesh || !drawn(m)) return;
            let side = null;
            for (let up = m; up && !side; up = up.parent) side = /^(left|right)_/.exec(up.name)?.[1];
            for (let i = 0; i < m.geometry.attributes.position.count; i += 2) {
              m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
              if (!her.containsPoint(v)) continue;
              let d = Infinity, near = null;
              for (const t of tris) { const e = t.closestPointToPoint(v, n).distanceToSquared(v); if (e < d) { d = e; near = t; q.copy(n); } }
              if (v.clone().sub(q).dot(near.getNormal(n)) < 0) out[side]++;
            }
          });
          return out;
        };
      });
      // Typing all the while, as Pishi jumps onto the keyboard the way her moment has her do it, from the floor by
      // the chair, sits there, and jumps off when I type shoo.
      const watch = (ms, letters) => p.evaluate(async ([ms, letters]) => {
        const out = { left: 0, right: 0, typing: 0, shown: false, frames: 0 }, t0 = performance.now();
        let i = 0;
        while (performance.now() - t0 < ms) {
          if (letters) { const ch = letters[i++ % letters.length]; window.dispatchEvent(new KeyboardEvent('keydown', { code: ch === ' ' ? 'Space' : 'Key' + ch.toUpperCase(), key: ch })); }
          for (let f = 0; f < 3; f++) await new Promise(done => requestAnimationFrame(done));
          const r = __inPishi();
          out.left = Math.max(out.left, r.left); out.right = Math.max(out.right, r.right); out.typing = Math.max(out.typing, __deskHands.typing); out.frames++;
          out.shown ||= __deskHands.group.visible;
        }
        out.state = __loft.creatures.pishi.state;
        return out;
      }, [ms, letters]);
      const jump = p.evaluate(async () => {
        const THREE = await import('three'), c = __loft.creatures.pishi, box = new THREE.Box3(), ch = __loft.chair;
        for (const o of __loft.world.deskThings) if (/^kb_/.test(o.name)) box.expandByObject(o);
        const kb = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.005, box.min.z + 0.1), from = new THREE.Vector3(ch.x - 0.3, ch.y, ch.z + 0.8);
        await new Promise(done => setTimeout(done, 600));
        Object.assign(c, { route: [], pending: null, then: null, moving: false, state: 'todesk', onFloor: false });
        c.epoch++; c.pos.copy(from);
        c.hop = { a: from.clone(), b: kb, k: 0, dur: 0.55, h: 0.35, walk: false, then: () => Object.assign(c, { state: 'keys', timer: 60, keyAt: 60 }) };
      });
      const on = await watch(3000, 'asdfjkl;ghtyvbnm ');
      await jump;
      const sitting = await watch(2500, 'the quick brown fox ');
      // A fresh line first: the letters typed till now went into the terminal too.
      await p.keyboard.press('Enter');
      await p.keyboard.type('shoo', { delay: 80 });
      await p.keyboard.press('Enter');
      const off = await watch(1500, '');
      await p.waitForTimeout(500);
      const back = await watch(1200, 'jk');
      const most = Math.max(on.left, on.right, sitting.left, sitting.right, off.left, off.right);
      check('Pishi jumping onto the keyboard while I type, sitting on it and jumping off: no part of my hands is ever inside her', most === 0 && on.frames > 10 && sitting.state === 'keys', JSON.stringify({ on, sitting, off }));
      check('while she has the keyboard my hands are down in my lap, and what I type still reaches the terminal: shoo moves her', !sitting.shown && off.state !== 'keys', `hands ${sitting.shown ? 'shown' : 'down'}, then she is ${off.state}`);
      check('once she has gone my hands come back up and type again', back.shown && back.typing > 0.9, `typing ${back.typing.toFixed(2)}`);
      check('pishi: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

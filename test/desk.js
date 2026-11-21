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
//   LOFT_URL=http://127.0.0.1:8820 node test/desk.js [outdir] [only: parts, comma-separated]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/desk';
const ONLY = process.argv[3] || 'fish,moods,glow,deploy,phone,button,fan,holo,jar';
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
      await o.p.waitForTimeout(HOLO_TIME * 1000);
      check('and ends after a few seconds', !(await o.p.evaluate(() => __loft.creatures.holo)));
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
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

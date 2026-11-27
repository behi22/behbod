// Pishi, Jessi and BH-22's moments, in a real Chrome, each started by its test hook (or by what sets it off), with the
// one-at-a-time rule over all three and the cat tree fix:
//   tree     Pishi climbs her cat tree to the perch over the fire, stretches after her nap and walks back out (failed
//            before: the tree's foot was in a pocket the walk grid cannot enter)
//   one      one showy moment at a time; then a calm gap
//   pishi    stretch and yawn, sun nap, the piano keys (real notes), chattering, the stolen seat, stalking the mouse
//            droid, zoomies (BH-22 startled), the pen knocked off (BH-22 puts it back)
//   edges    the pen errand after the knock ended holds the slot; she leaves a seat I sat in on her way
//   jessi    the toy at my feet, howling with the piano, the spin and a nap on her back, the head tilt as I type,
//            begging at the tea bar, the hard wag, chasing her tail
//   bh22     dancing, vacuuming, watering, the telescope, low power at night
//   set      what sets them off: the piano, standing still, the tea bar
//   phone    a few of them on a phone
//   LOFT_URL=http://127.0.0.1:8866 node test/residents.js [outdir] [only: parts, comma-separated]
const fs = require('fs'), path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const OUT = process.argv[2] || 'test-output/residents';
const ONLY = process.argv[3] || 'tree,one,pishi,edges,jessi,bh22,set,phone';
fs.mkdirSync(OUT, { recursive: true });
const want = part => ONLY === 'all' || ONLY.split(',').includes(part);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };
const DESK = { viewport: { width: 1280, height: 800 } };
const UPRIGHT = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const OUTSIDE = /youtube|google|gstatic|ytimg|ggpht|doubleclick|open-meteo|espn/;
const W = require('../web/assets/world.json');
const b2t = (x, y, z) => ({ x, y: z, z: -y });

function watch(p, errs) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !OUTSIDE.test(r.url())) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !OUTSIDE.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]|GL_INVALID|WebGL/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
async function open(b, opts) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  watch(p, errs);
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'medium' : 'high'}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  // Helpers in the page: put a resident somewhere (Blender axes) in a state, out of whatever it was doing; me too; and
  // a record of where they walk, to check against the furniture.
  await p.evaluate(() => {
    const L = __loft, C = L.creatures;
    window.__put = (who, at, state, extra = {}) => {
      const a = C[who];
      Object.assign(a, { route: [], hop: null, then: null, pending: null, moving: false, state, timer: 999, onFloor: true }, extra);
      a.epoch++;
      a.pos.set(at[0], at[2], -at[1]);
    };
    window.__me = (at, yaw) => { L.pos.set(at[0], at[2] + 0.05, -at[1]); if (yaw !== undefined) L.yaw = yaw; };
    window.__walks = [];
    window.__log = setInterval(() => {
      for (const who of ['pishi', 'jessi', 'bh22']) { const a = C[who]; if (!a.hop && (who === 'bh22' ? a.state !== 'dock' : a.onFloor)) __walks.push([who, a.state, a.pos.x, -a.pos.z, a.pos.y]); }
    }, 100);
    // The others out of the way: Jessi asleep in her bed, BH-22 in its dock, so nothing else starts.
    window.__calm = () => {
      __put('jessi', L.meta.points.jessi_bed, 'nap', { onFloor: false });
      __put('bh22', L.meta.points.bh22_dock, 'dock', { chaseCool: 999 });
      __put('pishi', [3.0, 13.0, 0], 'sit');
    };
    // The scheduler's calm gap, and these moments' own cooldowns, as if they last ran a long while ago.
    window.__openGap = (...ids) => { const t = performance.now() / 1000; for (const id of ['tail', ...ids]) { C.moments.force(id, t - 9999); C.moments.end(id, t - 200); } };
  });
  return { ctx, p, errs };
}
const until = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
// Nobody walking inside a piece of furniture or a wall: every sample on the floor, its body clear of every box.
function clipped(walks) {
  const bad = [];
  for (const [who, state, x, y, z] of walks) {
    for (const c of W.colliders) {
      if (c.max[2] < z + 0.08 || c.min[2] > z + 0.25) continue;
      if (x > c.min[0] + 0.03 && x < c.max[0] - 0.03 && y > c.min[1] + 0.03 && y < c.max[1] - 0.03) { bad.push(`${who} ${state} in ${c.name} at ${x.toFixed(2)},${y.toFixed(2)}`); break; }
    }
  }
  return bad;
}
const walksOf = async p => { const w = await p.evaluate(() => __walks.splice(0)); return w; };

(async () => {
  const { GAP } = await import('../web/src/pure/moments.js');
  const { TREE, PEN, HOWL, TEA, SUN_SPOTS, PLANTS } = await import('../web/src/pure/residents.js');
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    const { ctx, p, errs } = await open(b, DESK);
    // A picture of one of them from where I stand, dx, dy away (Blender axes) on a floor at z, looking a little to one side.
    const shot = (name, who, dx, dy, z) => p.evaluate(([w, dx, dy, z]) => { const a = __loft.creatures[w].pos; __me([a.x + dx, -a.z + dy, z], Math.atan2(dx, -dy) + 0.3); }, [who, dx, dy, z]).then(() => p.waitForTimeout(500)).then(() => p.screenshot({ path: path.join(OUT, name + '.png') }));
    const C = (f, a) => p.evaluate(f, a);

    // ---------- the cat tree ----------
    if (want('tree')) {
      await C(() => { __calm(); __me([6, 9, 0]); });
      // Sent off to climb (the second of her three ways in pishiNext) from by the fire, she reaches the perch.
      await C(() => { const r = Math.random; Math.random = () => 0.62; __put('pishi', [2.0, 12.0, 0], 'sit', { timer: 0 }); setTimeout(() => { Math.random = r; }, 300); });
      const up = await until(p, () => __loft.creatures.pishi.state === 'perch', null, 20000);
      const at = await C(() => { const c = __loft.creatures.pishi; return [c.pos.x, -c.pos.z, c.pos.y].map(v => +v.toFixed(2)); });
      check('tree: Pishi climbs the cat tree to the perch over the fire', up && at[2] > 2.9, `state ${await C(() => __loft.creatures.pishi.state)} at ${at}`);
      // Waking: a stretch and a yawn up there, then down the tree and out of the pocket on her own.
      await C(() => { __loft.creatures.pishi.timer = 0; });
      const stretched = await until(p, () => __loft.creatures.pishi.state === 'stretch', null, 3000);
      const out = await until(p, ([x, y]) => { const c = __loft.creatures.pishi; return c.onFloor && !c.hop && Math.hypot(c.pos.x - x, -c.pos.z - y) < 0.25; }, TREE.reach, 25000);
      check('tree: after her nap she stretches, climbs down and walks back out past the console shelf', stretched && out, `stretch ${stretched}, out ${out}`);
      const bad = clipped(await walksOf(p));
      check('tree: no furniture walked through', bad.length === 0, bad.slice(0, 3).join(' | '));
    }

    // ---------- one at a time ----------
    if (want('one')) {
      await C(() => { __calm(); __me([5, 10, 0]); __openGap(); });
      await C(() => { __put('bh22', [5.6, 10.6, 0], 'pause', { timer: 60 }); __put('pishi', [5.0, 11.0, 0], 'sit'); });
      const r = await C(() => { const c = __loft.creatures; const a = c.force('zoomies'); return { a, active: c.moments.active, vac: c.request('vacuum'), tail: c.request('tail'), moment: c.moment }; });
      check('one: with zoomies running, nothing else showy can start', r.a && r.active === 'zoomies' && !r.vac && !r.tail && r.moment === 'zoomies', JSON.stringify(r));
      const startled = await until(p, () => __loft.creatures.bh22.state === 'startle', null, 4000);
      check('one: BH-22 is startled by her zoomies (part of the same moment)', startled && await C(() => __loft.creatures.moments.active === 'zoomies'));
      const ended = await until(p, () => __loft.creatures.moment === null, null, 25000);
      const after = await C(() => ({ active: __loft.creatures.moments.active, vac: __loft.creatures.moments.ready('vacuum', performance.now() / 1000), state: __loft.creatures.pishi.state }));
      check('one: the zoomies end, and the calm gap holds the next one back', ended && after.active === null && !after.vac, JSON.stringify(after));
      const bad = clipped(await walksOf(p));
      check('one: no furniture walked through during the zoomies', bad.length === 0, bad.slice(0, 3).join(' | '));
    }

    // ---------- Pishi ----------
    if (want('pishi')) {
      await C(() => { __calm(); __me([6, 9, 0]); });
      // The stretch and yawn, and the nap in the sun.
      await C(() => { __put('pishi', [6.0, 12.0, 0], 'sit'); __loft.creatures.force('stretch'); });
      const st = await C(() => __loft.creatures.pishi.state);
      await p.waitForTimeout(1500);
      const pose = await C(() => { const q = __loft.creatures.pishi.pose; return { bow: +q.bow.toFixed(2), up: +q.up.toFixed(2) }; });
      await shot('pishi-stretch', 'pishi', 1.6, -1.6, -0.45);
      check('pishi: a stretch, front paws out, then a yawn', st === 'stretch' && (pose.bow > 0.3 || pose.up > 0.3), JSON.stringify(pose));
      await until(p, () => __loft.creatures.pishi.state !== 'stretch', null, 4000);
      await C(() => { __put('pishi', [6.8, 14.2, 0], 'sit'); __loft.creatures.force('sunnap'); });
      const sun = await until(p, () => __loft.creatures.pishi.state === 'sunnap', null, 15000);
      const sunAt = await C(() => [__loft.creatures.pishi.pos.x, -__loft.creatures.pishi.pos.z]);
      check('pishi: a nap on the floor in the sun by the glass', sun && SUN_SPOTS.some(s => Math.hypot(s[0] - sunAt[0], s[1] - sunAt[1]) < 0.4), String(sunAt));
      await C(() => { __loft.creatures.pishi.timer = 0; });
      check('pishi: she stretches when she wakes from it', await until(p, () => __loft.creatures.pishi.state === 'stretch', null, 3000));

      // The piano keys: real notes, softly, under her paws.
      await C(() => { __calm(); window.__notes = []; const P = __loft.audio.piano, on = P.noteOn; P.noteOn = (m, v) => { __notes.push([m, v]); return on(m, v); }; __put('pishi', [16.0, 9.0, 0], 'sit'); __me([16, 7.5, 0]); __loft.creatures.force('keywalk'); });
      const onKeys = await until(p, () => __loft.creatures.pishi.state === 'keywalk' && __loft.creatures.pishi.pos.y > 1.0, null, 15000);
      await p.waitForTimeout(700);
      await shot('pishi-keys', 'pishi', 0.4, -2.2, 0.3);
      const walked = await until(p, () => __loft.creatures.moment === null, null, 15000);
      const notes = await C(() => __notes.splice(0));
      const where = await C(() => { const c = __loft.creatures.pishi; return { y: +c.pos.y.toFixed(2), floor: c.onFloor }; });
      check('pishi: up on the bench, across the keys, and down again', onKeys && walked && where.floor && where.y < 0.4, JSON.stringify(where));
      check('pishi: each step on the keys plays a real piano note, softly', notes.length >= 8 && notes.every(([m, v]) => m >= 21 && m <= 108 && v <= 0.3), `${notes.length} notes`);

      // Chattering at the window.
      await C(() => { __calm(); __put('pishi', __loft.meta.points.cat_window, 'window', { onFloor: false, timer: 30 }); __me([5.4, 11.8, 0]); __loft.creatures.force('chatter'); });
      const ch = await C(() => ({ s: __loft.creatures.pishi.state }));
      await p.waitForTimeout(800);
      const tw = await C(() => __loft.creatures.pishi.tail.rotation.y);
      const back = await until(p, () => __loft.creatures.pishi.state === 'window', null, 7000);
      check('pishi: she chatters at the window, tail twitching, then goes back to watching', ch.s === 'chatter' && back, `tail ${tw.toFixed(2)}`);

      // The stolen seat: the desk chair, and off it when I sit down.
      await C(() => { __calm(); __put('pishi', [19.4, 3.0, 0.45], 'sit'); __me([16.5, 4.5, 0.45]); const r = Math.random; Math.random = () => 0; __loft.creatures.force('steal'); Math.random = r; });
      const onSeat = await until(p, () => __loft.creatures.pishi.state === 'seat', null, 15000);
      const seatAt = await C(() => [__loft.creatures.pishi.pos.x, -__loft.creatures.pishi.pos.z, __loft.creatures.pishi.pos.y]);
      await shot('pishi-seat', 'pishi', -1.6, 1.4, 0.45);
      check('pishi: she takes the desk chair for a nap', onSeat && Math.hypot(seatAt[0] - 20.47, seatAt[1] - 1.2) < 0.15 && seatAt[2] > 0.95, String(seatAt.map(v => v.toFixed(2))));
      await C(() => __loft.useDesk());
      const off = await until(p, () => !['seat', 'down'].includes(__loft.creatures.pishi.state) && __loft.creatures.pishi.onFloor, null, 6000);
      check('pishi: she hops off when I come to sit', off, await C(() => __loft.creatures.pishi.state));
      await C(() => __loft.leaveDesk());
      await p.waitForTimeout(1500);

      // Stalking the mouse droid.
      await C(() => { __calm(); __put('pishi', [7.0, 6.0, 0], 'sit'); __put('mouse', [9.0, 6.0, 0], 'wait', { timer: 30, flee: 0 }); __me([8, 3.2, 0]); __loft.creatures.force('stalk'); });
      const crouch = await until(p, () => __loft.creatures.pishi.stalk?.k === 'crouch', null, 12000);
      await p.waitForTimeout(900);
      await shot('pishi-stalk', 'pishi', 0.6, -2.2, 0);
      const pounced = await until(p, () => __loft.creatures.pishi.state === 'sit', null, 6000);
      check('pishi: she creeps up on the mouse droid, crouches, wiggles and pounces', crouch && pounced);

      // The pen off the desk, and BH-22 putting it back.
      await C(() => { __calm(); __put('pishi', [19.6, 3.2, 0.45], 'sit'); __put('bh22', [18.6, 3.6, 0.45], 'pause', { timer: 120 }); __me([19.3, 1.6, 0.45], Math.PI / 2); __loft.creatures.force('knock'); });
      const upDesk = await until(p, () => __loft.creatures.pishi.state === 'knock', null, 12000);
      await p.waitForTimeout(2000);
      await shot('pishi-knock', 'pishi', -1.9, 0.4, 0.45);
      const fell = await until(p, () => ['floor', 'carry'].includes(__loft.creatures.pen), null, 6000);
      const going = await until(p, () => __loft.creatures.bh22.state === 'pen', null, 3000);
      check('pishi: up by the keyboard she paws the pen off the desk; it lands on the floor', upDesk && fell, await C(() => __loft.creatures.pen));
      const still = await C(() => __loft.creatures.moments.active);
      const home = await until(p, () => __loft.creatures.pen === 'home', null, 25000);
      const pen = await C(() => { const o = __loft.scene.getObjectByName('desk_pen'); return [o.position.x, -o.position.z, o.position.y]; });
      check('bh22: BH-22 rolls over, picks the pen up and puts it back on the desk', going && home && Math.hypot(pen[0] - PEN.home[0], pen[1] - PEN.home[1]) < 0.01, `${pen.map(v => v.toFixed(2))}, the knock's moment while it works: ${still}`);
      check('pishi: the knock and the pen are one moment', still === 'knock' && await until(p, () => __loft.creatures.moment === null, null, 5000));
      const bad = clipped(await walksOf(p));
      check('pishi: no furniture walked through', bad.length === 0, bad.slice(0, 3).join(' | '));
    }

    // ---------- edge cases ----------
    if (want('edges')) {
      // BH-22 busy until the knock is over: when it comes for the pen afterwards, the errand still holds the one slot
      // (failed before: it ran outside the rule, so another moment could start over it).
      await C(() => { __calm(); __openGap('knock'); __put('pishi', [19.6, 3.2, 0.45], 'sit'); __put('bh22', [18.6, 3.6, 0.45], 'talk'); __me([19.3, 1.6, 0.45], Math.PI / 2); __loft.creatures.force('knock'); });
      const over = await until(p, () => __loft.creatures.moment === null && __loft.creatures.pen === 'floor', null, 15000);
      await C(() => __put('bh22', [18.6, 3.6, 0.45], 'pause', { timer: 120 }));
      const going = await until(p, () => __loft.creatures.bh22.state === 'pen', null, 3000);
      const held = await C(() => ({ moment: __loft.creatures.moment, active: __loft.creatures.moments.active }));
      const home = await until(p, () => __loft.creatures.pen === 'home', null, 25000);
      const freed = await until(p, () => __loft.creatures.moment === null, null, 5000);
      check('edges: BH-22 fetching the pen after the knock ended holds the slot, then frees it', over && going && held.moment === 'knock' && held.active === 'knock' && home && freed, JSON.stringify({ over, going, held, home, freed }));
      // Sitting down at the desk while she is on her way to steal the chair: she leaves it be (failed before: she hopped
      // up into me, then straight off).
      await C(() => { __calm(); __openGap('steal'); __put('pishi', [19.4, 3.0, 0.45], 'sit'); __me([16.5, 4.5, 0.45]); const r = Math.random; Math.random = () => 0; __loft.creatures.force('steal'); Math.random = r; __loft.useDesk(); window.__seen = new Set(); window.__seenOn = true; const look = () => { __seen.add(__loft.creatures.pishi.state); if (__seenOn) requestAnimationFrame(look); }; look(); });
      const left = await until(p, () => __loft.creatures.pishi.state !== 'toseat', null, 12000);
      await p.waitForTimeout(800);
      // Every frame, since on the chair she is there for one frame only before hopping down again.
      const seen = await C(() => { __seenOn = false; return [...__seen]; });
      check('edges: she never hops onto the chair I am sitting in', left && !seen.includes('seat') && !seen.includes('down'), seen.join(','));
      await C(() => __loft.leaveDesk());
      await p.waitForTimeout(1500);
    }

    // ---------- Jessi ----------
    if (want('jessi')) {
      await C(() => { __calm(); __me([8, 12, 0]); });
      // The toy at my feet.
      await C(() => { __put('jessi', [11.0, 12.0, 0], 'sniff', { timer: 60 }); __loft.creatures.force('toy'); });
      const dropped = await until(p, () => __loft.creatures.jessi.state === 'happy', null, 25000);
      const toy = await C(() => { const o = __loft.scene.getObjectByName('jessi_toy'), L = __loft; return { d: +Math.hypot(o.position.x - L.pos.x, o.position.z - L.pos.z).toFixed(2), y: +(o.position.y - L.pos.y).toFixed(2) }; });
      await shot('jessi-toy', 'jessi', 1.8, -1.2, 0);
      check('jessi: she brings her rope toy and drops it at my feet', dropped && toy.d < 1.3 && Math.abs(toy.y) < 0.2, JSON.stringify(toy));
      // Howling along with the piano.
      await C(() => { __put('jessi', [15.0, 9.2, 0], 'sniff', { timer: 60 }); __me([15, 6, 0]); __loft.creatures.force('howl'); });
      const howled = await until(p, () => __loft.creatures.jessi.howls >= 1, null, 12000);
      const hAt = await C(() => [__loft.creatures.jessi.pos.x, -__loft.creatures.jessi.pos.z]);
      const hEnd = await until(p, () => __loft.creatures.jessi.state === 'happy', null, 8000);
      check('jessi: she trots over to the piano and howls', howled && hEnd && Math.hypot(hAt[0] - HOWL[0], hAt[1] - HOWL[1]) < 0.4, String(hAt));
      // Round and round, then down; and once asleep on her back.
      await C(() => { __put('jessi', [12.6, 12.4, 0], 'sniff', { timer: 60 }); __me([12, 10.8, 0]); __loft.creatures.force('nap'); });
      const spin = await until(p, () => __loft.creatures.jessi.state === 'nap' && __loft.creatures.jessi.spinT > 0, null, 12000);
      const f0 = await C(() => __loft.creatures.jessi.facing);
      await p.waitForTimeout(500);
      const f1 = await C(() => __loft.creatures.jessi.facing);
      check('jessi: she turns round and round before lying down', spin && Math.abs(f1 - f0) > 2, `${(f1 - f0).toFixed(2)} rad in half a second`);
      await C(() => { __loft.creatures.jessi.back = true; });
      await p.waitForTimeout(2200);
      const back = await C(() => { const j = __loft.creatures.jessi; return { k: +j.pose.back.toFixed(2), z: +j.body.rotation.z.toFixed(2), sleep: +j.sleepK.toFixed(2) }; });
      await shot('jessi-back', 'jessi', 0.4, -2.0, 0);
      check('jessi: now and then she sleeps on her back', back.k > 0.9 && back.z > 2.5, JSON.stringify(back));
      // The head tilt as I type.
      await C(() => { __put('jessi', [19.0, 2.4, 0.45], 'sniff', { timer: 60 }); __me([19.6, 1.2, 0.45]); __loft.useDesk(); });
      await p.waitForTimeout(2500);
      await p.keyboard.type('ls', { delay: 80 });
      const tilt = await until(p, () => __loft.creatures.jessi.want.lean === 1, null, 1500);
      check('jessi: she tilts her head when I type in the terminal', tilt);
      await C(() => __loft.leaveDesk());
      await p.waitForTimeout(1500);
      // Begging at the tea bar.
      await C(at => { __put('jessi', [12.0, 11.0, 0], 'sniff', { timer: 60 }); __me(at); __loft.creatures.force('beg'); }, TEA.at);
      const begs = await until(p, () => __loft.creatures.jessi.atMe && __loft.creatures.jessi.pose.beg > 0.5, null, 10000);
      check('jessi: she comes and sits up begging beside me at the tea bar', begs);
      // The hard wag, and the tail chase.
      await C(() => { __put('jessi', [12.0, 11.0, 0], 'sniff', { timer: 60 }); __loft.creatures.force('wag'); });
      const wag = await C(() => ({ w: __loft.creatures.jessi.wag, s: __loft.creatures.jessi.state }));
      await p.waitForTimeout(200);
      check('jessi: back after a while away, she runs up wagging hard', (await C(() => __loft.creatures.jessi.wag)) === 2 && wag.s === 'follow', JSON.stringify(wag));
      await C(() => { __put('jessi', [12.0, 11.0, 0], 'sniff', { timer: 60 }); __loft.creatures.force('tail'); });
      const t0 = await C(() => __loft.creatures.jessi.facing);
      await p.waitForTimeout(1000);
      const t1 = await C(() => __loft.creatures.jessi.facing);
      const tailEnd = await until(p, () => __loft.creatures.jessi.state === 'happy', null, 6000);
      check('jessi: she chases her tail, round and round, then stops', t1 - t0 > 5 && tailEnd, `${(t1 - t0).toFixed(1)} rad in a second`);
      const bad = clipped(await walksOf(p));
      check('jessi: no furniture walked through', bad.length === 0, bad.slice(0, 3).join(' | '));
    }

    // ---------- BH-22 ----------
    if (want('bh22')) {
      await C(() => { __calm(); __me([8, 6, 0]); });
      await C(() => { __put('bh22', [8.0, 8.0, 0], 'pause', { timer: 60 }); __loft.creatures.force('dance'); });
      const y0 = await C(() => __loft.creatures.bh22.pos.y);
      await p.waitForTimeout(1200);
      const mid = await C(() => ({ s: __loft.creatures.bh22.state, rz: __loft.creatures.bh22.dome.rotation.z }));
      const danced = await until(p, () => __loft.creatures.bh22.state === 'pause', null, 7000);
      const y1 = await C(() => __loft.creatures.bh22.pos.y);
      check('bh22: it dances, then stands back down where it was', mid.s === 'dance' && danced && Math.abs(y1 - y0) < 0.005, `${y0.toFixed(3)} ${y1.toFixed(3)}`);
      await C(() => { __put('bh22', [8.0, 6.0, 0], 'pause', { timer: 60 }); __loft.creatures.force('vacuum'); });
      const vac = await C(() => ({ s: __loft.creatures.bh22.state }));
      await p.waitForTimeout(1500);
      const brush = await C(() => { const b = __loft.creatures.bh22.body.children.find(o => o.isMesh && o.position.z > 0.06 && o.position.y < 0.02); return !!b?.visible; });
      await shot('bh22-vacuum', 'bh22', 0.8, -2.0, 0);
      const vacEnd = await until(p, () => __loft.creatures.bh22.state === 'pause', null, 20000);
      check('bh22: it vacuums a zig-zag over the floor, its brush out, and is done', vac.s === 'vacuum' && brush && vacEnd);
      await C(() => { __put('bh22', [14.8, 12.0, 0], 'pause', { timer: 60 }); __me([14.6, 11.4, 0], -0.4); __loft.creatures.force('water'); });
      const pouring = await until(p, () => __loft.creatures.bh22.waterT > 1, null, 15000);
      await shot('bh22-water', 'bh22', -1.6, -1.2, 0);
      const waterEnd = await until(p, () => __loft.creatures.bh22.state === 'pause', null, 6000);
      const plant = await C(() => __loft.creatures.bh22.plant?.pot);
      check('bh22: it waters the nearest plant from beside the pot', pouring && waterEnd && plant && plant[0] === PLANTS[3].pot[0], String(plant));
      await C(() => { __put('bh22', [8.0, 13.5, 0], 'pause', { timer: 60 }); __me([8.5, 13.0, 0]); __loft.creatures.force('scope'); });
      const atScope = await until(p, () => __loft.creatures.bh22.atScope, null, 20000);
      await p.waitForTimeout(800);
      const look = await C(() => +__loft.creatures.bh22.dome.rotation.x.toFixed(2));
      check('bh22: out on the balcony at the telescope, looking up', atScope && look < -0.2, String(look));
      await C(() => { __loft.creatures.hour = 23.5; __put('bh22', __loft.meta.points.bh22_dock, 'dock'); });
      await p.waitForTimeout(600);
      const night = await C(() => { const r = __loft.creatures.bh22; return { k: r.eyeMat.color.r / r.eyeLit.r, eye: r.eye.scale.y }; });
      await C(() => { __loft.creatures.hour = 12; });
      await p.waitForTimeout(300);
      const day = await C(() => { const r = __loft.creatures.bh22; return { k: r.eyeMat.color.r / r.eyeLit.r }; });
      await C(() => { __loft.creatures.hour = null; });
      check('bh22: docked at night it runs low on power, eyes dimmed, and wakes bright', night.k < 0.4 && night.eye < 0.5 && Math.abs(day.k - 1) < 0.01, JSON.stringify({ night, day }));
      const bad = clipped(await walksOf(p));
      check('bh22: no furniture rolled through', bad.length === 0, bad.slice(0, 3).join(' | '));
    }

    // ---------- what sets them off ----------
    if (want('set')) {
      // The piano starts: Jessi howls along (or BH-22 dances).
      await C(() => { __calm(); __put('jessi', [15.0, 9.2, 0], 'sniff', { timer: 60 }); __me([15, 6, 0]); __openGap('howl', 'dance'); window.__r = Math.random; Math.random = () => 0.01; const P = __loft.audio.piano; window.__pd = Object.getOwnPropertyDescriptor(P, 'playing'); Object.defineProperty(P, 'playing', { get: () => true, configurable: true }); });
      const piano = await until(p, () => __loft.creatures.moment === 'howl', null, 2000);
      await C(() => { Math.random = __r; Object.defineProperty(__loft.audio.piano, 'playing', __pd); __put('jessi', [15.0, 9.2, 0], 'sniff', { timer: 60 }); });
      check('set: the piano playing sets Jessi howling along', piano);
      // At the tea bar a moment and a half: she begs.
      await C(() => { __me([8, 8, 0]); __openGap('beg'); });
      await p.waitForTimeout(300);
      await C(at => { Math.random = () => 0.01; __put('jessi', [12.0, 11.0, 0], 'sniff', { timer: 60 }); __me(at); }, TEA.at);
      const begs = await until(p, () => __loft.creatures.moment === 'beg', null, 4000);
      await C(() => { Math.random = __r; });
      check('set: standing at the tea bar brings Jessi over to beg', begs);
      // Standing still twenty seconds: the toy.
      await C(() => { __put('jessi', [11.0, 12.0, 0], 'sniff', { timer: 60 }); __me([8, 12, 0]); __openGap('toy'); Math.random = () => 0.01; });
      const brought = await until(p, () => __loft.creatures.moment === 'toy', null, 26000);
      await C(() => { Math.random = __r; });
      check('set: standing still a while, Jessi goes for her toy', brought);
      await C(() => __calm());
    }

    check('desktop: no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();

    // ---------- a phone ----------
    if (want('phone')) {
      const { ctx: c2, p: q, errs: e2 } = await open(b, UPRIGHT);
      await q.evaluate(() => { __calm(); __me([6, 9, 0]); __put('pishi', [6.5, 14.0, 0], 'sit'); __loft.creatures.force('zoomies'); });
      const z = await until(q, () => __loft.creatures.moment === null, null, 25000);
      await q.evaluate(() => { __put('bh22', [8.0, 8.0, 0], 'pause', { timer: 60 }); __loft.creatures.force('dance'); });
      const d = await until(q, () => __loft.creatures.bh22.state === 'pause', null, 9000);
      await q.evaluate(() => { __put('jessi', [8.0, 11.0, 0], 'sniff', { timer: 60 }); __loft.creatures.force('tail'); });
      const t = await until(q, () => __loft.creatures.jessi.state === 'happy', null, 7000);
      await q.screenshot({ path: path.join(OUT, 'phone.png') });
      const bad = clipped(await walksOf(q));
      check('phone: zoomies, a dance and a tail chase all run and end', z && d && t);
      check('phone: no furniture walked through, no page errors', bad.length === 0 && e2.length === 0, [...bad.slice(0, 2), ...e2.slice(0, 2)].join(' | '));
      await c2.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();

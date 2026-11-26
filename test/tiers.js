// The automatic quality in a real browser: shaders ready before anything is first seen, on every tier, and switches
// between tiers that do not freeze a frame.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
const TOUR = [[2.55, 1.2, 0, 0.15], [7.0, 10.2, -0.45, -2.0], [10.6, 11.6, 0, -2.0], [16.0, 8.9, 0, 0.6], [15.6, 4.4, 0.45, -2.2],
  [14.6, 9.4, 0, 0.1], [11.6, 16.2, 0, Math.PI], [11.7, 13.4, 0, 0], [9.5, 2.0, 3.0, 2.0], [2.2, 3.6, 0, 2.6]];
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ': ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

async function open(b, q, view = { viewport: { width: 1366, height: 768 } }) {
  const p = await b.newPage(view);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { if (window.top !== window) return; window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask' }); });
  await p.goto(`${BASE}/?q=${q}`);
  await p.waitForFunction(() => window.__loft, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  return { p, errs };
}
// Waits until the page has had no long task for 5 s (40 s at most), and says how long that took, in s.
const quiet = async p => {
  const t = Date.now();
  await p.waitForFunction(() => performance.now() - Math.max(0, ...__lt.map(([s, d]) => s + d)) > 5000, null, { timeout: 40000, polling: 100 }).catch(() => {});
  return +((Date.now() - t) / 1000).toFixed(1);
};

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    for (const q of ['ultra', 'low']) {
      const { p, errs } = await open(b, q);
      const before = await p.evaluate(() => __loft.renderer.info.programs.length);
      let hole = false;
      for (const [x, y, z, yaw] of TOUR) {
        await p.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); __loft.yaw = yw; }, [b2t(x, y, z), yaw]);
        await p.waitForTimeout(1200);
        hole = (await p.evaluate(() => __loft.scene.getObjectByName('screen_video0')?.material.opacity === 0)) || hole;
      }
      const built = await p.evaluate(() => __loft.renderer.info.programs.length) - before;
      check(`${q}: the walk passes the screening wall while its video plays through the see-through hole`, hole);
      check(`${q}: shaders built on a walk round the house, after the page opened`, built === 0, `${built}`);
      check(`${q}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // At 1440x900 on a 2x screen, as on his laptop: ultra and high differ only in sharpness, high and medium in effects
    // (whose chain is built in the background and swapped in, so the switch lands a moment later).
    for (const [from, steps] of [['ultra', ['high', 'ultra', 'high', 'ultra']], ['high', ['medium', 'high', 'medium', 'high']]]) {
      const { p, errs } = await open(b, from, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      // The house's start-up work has long tasks of its own, with no switch at all: the khatam board's drawing about 3.5 s
      // in (50 to 60 ms), after 3 s with none, inside the first switch's window. The switches start after 5 s with none.
      const settled = await quiet(p);
      const worst = [];
      for (const to of steps) {
        const t = await p.evaluate(next => { const t = performance.now(); __loft.autoTierTo(next); return t; }, to);
        await p.waitForTimeout(3500);
        worst.push(await p.evaluate(t => Math.max(0, ...__lt.filter(([s, d]) => s + d > t && s < t + 3000).map(l => l[1])), t));
      }
      check(`${from} and ${steps[0]}: a switch between them holds no frame for long (longest task in the 3 s after each, ms)`, worst.every(w => w < 50), `${worst.map(w => w.toFixed(0)).join(' ')}, the first once the page was quiet ${settled} s on`);
      check(`${from} and ${steps[0]}: no error`, errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // A change of mind while a background build is still asking for its shaders: the build stops and throws away what
    // it made. Regression: it did so while three was still waiting on those shaders, and three's wait then threw on the
    // thrown-away materials (page errors, and graphics errors for each). The outside is built as on a slow phone: each
    // piece's shaders take a slice of their own to ask for and stay unready for a moment.
    for (const [part, to, slowly] of [['the effects', 'medium', false], ['the outside', 'low', true]]) {
      const { p, errs } = await open(b, 'ultra');
      const warns = [];
      p.on('console', m => { if (m.type() === 'warning' && /GL_INVALID|WebGL/.test(m.text())) warns.push(m.text()); });
      const caught = await p.evaluate(([to, part, slowly]) => new Promise(done => {
        const r = __loft.renderer, out = __loft.out3d.camera, ask = r.compileAsync.bind(r);
        let armed = true;
        r.compileAsync = function (obj, cam, into) {
          const job = ask(obj, cam, into);
          if (slowly && cam === out) { const t = performance.now(); while (performance.now() < t + 9); }
          if (armed && (part === 'the outside') === (cam === out)) {
            const waiting = [];
            // As on a slow phone, every shader of the piece is held unready: an earlier page may have left them built.
            obj.traverse(o => { for (const m of [].concat(o.material || [])) { const pr = r.properties.get(m).currentProgram; if (pr && (slowly || !pr.isReady())) waiting.push(pr); } });
            if (waiting.length) {
              armed = false;
              if (slowly) for (const pr of waiting) { const until = performance.now() + 400, ready = pr.isReady; pr.isReady = () => performance.now() > until && ready.call(pr); }
              queueMicrotask(() => __loft.autoTierTo('ultra'));
            }
          }
          return job;
        };
        __loft.autoTierTo(to);
        setTimeout(() => { r.compileAsync = ask; done(!armed); }, 5000);
      }), [to, part, slowly]);
      await p.waitForTimeout(1000);
      const now = await p.evaluate(() => ({ tier: __loft.tier, outside: __loft.out3d.quality }));
      check(`${part}: a switch back while its new shaders are still being built is caught mid-way`, caught);
      check(`${part}: the build stops cleanly, no error`, errs.length === 0 && warns.length === 0, [...errs, ...warns].slice(0, 2).join(' | '));
      check(`${part}: and what was on screen stays`, now.tier === 'ultra' && now.outside === 'high', JSON.stringify(now));
      await p.close();
    }
    // At 1440x900 on a 2x screen a switch between ultra and high resizes the picture, and the browser holds the frame
    // it lands on, so the automatic quality's switch waits for a still view. The view is turned at 34 degrees a second
    // and a busy loop slows every frame until the judge asks for a switch; then the frames run free. Each part reports
    // when the switch landed, the camera's turning as it did and the longest frame just after. Before this, a switch
    // landed the frame the judge asked for it, mid-turn.
    {
      const { p, errs } = await open(b, 'auto', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      // stop: ms after the ask the turning stops (never, if null); pick: a quality chosen in Settings 500 ms after it.
      const watch = ({ busy, stop = null, pick = null }) => p.evaluate(([busy, stop, pick]) => new Promise(done => {
        const L = __loft, from = L.tier, t0 = performance.now(), dir = L.camera.getWorldDirection(L.camera.position.clone()), prev = dir.clone();
        let yaw = 0, last = t0, turning = true, turn = 0, asked = null, stopped = null, landed = null, picked = null;
        const frame = () => {
          const now = performance.now(), dt = Math.max(now - last, 1) / 1000;
          last = now;
          L.camera.getWorldDirection(dir);
          turn = dir.angleTo(prev) / dt * 180 / Math.PI;
          prev.copy(dir);
          if (turning) L.yaw = yaw += 0.6 * dt;
          if (asked === null && (L.tierHeld || L.tier !== from)) asked = now;
          if (busy && asked === null) { const until = performance.now() + 35; while (performance.now() < until); }
          if (asked !== null && stop !== null && turning && now - asked >= stop) { turning = false; stopped = now; }
          if (asked !== null && pick && !picked && now - asked >= 500) { L.setQuality?.(pick); picked = { tier: L.tier, held: L.tierHeld ?? null }; }
          if (landed) landed.after.push(dt * 1000);
          else if (L.tier !== from && !picked) landed = { at: now, turning, turn, after: [] };
          const end = asked === null ? now - t0 > 45000 : pick ? now - asked > 4500 : landed ? landed.after.length >= 4 : now - asked > 6000;
          if (!end) return requestAnimationFrame(frame);
          done({ from, to: L.tier, held: L.tierHeld ?? null, asked: asked && asked - t0, stopped: stopped && stopped - (asked ?? 0), picked,
            landed: landed && { after: landed.at - asked, stopped: stopped === null ? null : landed.at - stopped, turning: landed.turning, turn: +landed.turn.toFixed(1), frame: +Math.max(...landed.after).toFixed(1) } });
        };
        requestAnimationFrame(frame);
      }), [busy, stop, pick]);
      const say = r => JSON.stringify(r);
      const down = await watch({ busy: true, stop: 1500 });
      check('an automatic switch from ultra down to high asked for while the camera turns is not made until it stops',
        down.from === 'ultra' && down.landed && !down.landed.turning && down.landed.stopped >= 0, say(down));
      check('and is made once the view is still, within a second of the turning stopping', down.landed?.stopped != null && down.landed.stopped < 1000 && down.landed.turn < 1.5, say(down));
      const up = await watch({ busy: false });
      check('an automatic switch back up to ultra while the camera never stops turning waits 3 s at most',
        up.from === 'high' && up.to === 'ultra' && up.landed?.after >= 2950 && up.landed.after < 3300, say(up));
      const pick = await watch({ busy: true, pick: 'medium' });
      check('a quality picked in Settings while a switch waits is made at once, and the waiting switch is dropped',
        pick.from === 'ultra' && pick.landed === null && pick.picked?.tier === 'medium' && pick.picked.held === null && pick.to === 'medium' && pick.held === null, say(pick));
      check('the switch waiting for a still view: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // Through the telescope zoomed in to a degree or two, a slow pan (half a degree a second, still in the house's
    // 55 degrees) sweeps the picture, so a switch asked for then waits too. Before, it landed the frame it was asked.
    {
      const { p, errs } = await open(b, 'auto', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      await p.evaluate(() => { const L = __loft, it = L.meta.interact.find(i => i.id === 'telescope'); L.pos.set(it.at[0], 0.05, -it.at[1]); });
      await p.waitForTimeout(500);
      await p.evaluate(() => { __loft.act('telescope'); for (let i = 0; i < 12; i++) __loft.scope.zoom(-1); });
      await p.waitForTimeout(1500);
      const r = await p.evaluate(() => new Promise(done => {
        const L = __loft, from = L.tier, t0 = performance.now(), dir = L.camera.getWorldDirection(L.camera.position.clone()), prev = dir.clone();
        let last = t0, swung = 0, way = 1, turned = 0, asked = null, landed = null, fov = null;
        const frame = () => {
          const now = performance.now(), dt = Math.max(now - last, 1) / 1000, d = 0.5 * Math.PI / 180 * dt;
          last = now;
          L.camera.getWorldDirection(dir);
          if (asked !== null) turned += dir.angleTo(prev);
          prev.copy(dir);
          // Back and forth across two degrees, never stopping.
          if ((swung += d) > Math.PI / 90) { swung = 0; way = -way; }
          L.scope.nudge(way * d * 16 / L.scope.fov, 0);
          if (asked === null && (L.tierHeld || L.tier !== from)) { asked = now; fov = L.camera.fov; }
          if (asked === null) { const until = performance.now() + 35; while (performance.now() < until); }
          // How the view moved while the switch waited: its mean turn and how far its width drifted (degrees).
          if (!landed && asked !== null && L.tier !== from) landed = { after: now - asked, pan: +(turned * 180 / Math.PI / ((now - asked) / 1000)).toFixed(2), zoom: +Math.abs(L.camera.fov - fov).toFixed(4) };
          if (asked === null ? now - t0 < 45000 : !landed && now - asked < 4000) return requestAnimationFrame(frame);
          done({ mode: L.mode, from, to: L.tier, fov: fov && +fov.toFixed(2), landed });
        };
        requestAnimationFrame(frame);
      }));
      check('in the telescope zoomed in, a switch asked for during a slow pan waits for the cap', r.mode === 'scope' && r.from === 'ultra' && r.fov < 5 && r.landed?.after >= 2950 && r.landed.after < 3300 && r.landed.pan > 0.3 && r.landed.pan < 1.5 && r.landed.zoom < 0.01, JSON.stringify(r));
      check('the telescope: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // The graphics context lost while the house loads, as a phone switched away from may lose it, and given back.
    // Regression: the shaders' first use while loading read their compile logs, which a lost context does not have,
    // and three threw, so the house never opened.
    {
      const p = await b.newPage({ viewport: { width: 1366, height: 768 } }), errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.addInitScript(() => {
        if (window.top !== window) return;
        new MutationObserver((_, ob) => {
          const note = document.getElementById('note');
          if (note?.textContent !== 'Getting the room ready') return;
          ob.disconnect();
          const lose = document.getElementById('view').getContext('webgl2').getExtension('WEBGL_lose_context');
          lose.loseContext();
          setTimeout(() => lose.restoreContext(), 1500);
        }).observe(document, { childList: true, subtree: true, characterData: true });
      });
      await p.goto(`${BASE}/?auto&q=ultra`);
      const opened = await p.waitForFunction(() => window.__loft, null, { timeout: 60000 }).then(() => true, () => false);
      const drawn = opened && await p.waitForFunction(() => !__loft.renderer.getContext().isContextLost() && __loft.renderer.info.render.calls > 0, null, { timeout: 30000 }).then(() => true, () => false);
      check('the graphics context lost while the house loads, then given back: the house still opens and draws', opened && drawn, JSON.stringify({ opened, drawn }));
      check('a context lost while loading: no page error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // A land worker that never answers. Regression: the outside's rebuild waited on it for good, and every later change
    // of tier waited behind it. Now the page works the land out itself, a slice at a time, and the land is the same.
    {
      const { p, errs } = await open(b, 'ultra');
      await p.evaluate(() => {
        window.__workers = { made: 0, ended: 0 };
        // Only the land's workers are counted: others made meanwhile (the game-day read) have their own time limits.
        window.Worker = class {
          constructor(url) { this.land = /terrainworker/.test(String(url)); if (this.land) __workers.made++; }
          postMessage() {}
          terminate() { if (this.land) __workers.ended++; }
        };
      });
      const reach = (to, quality) => p.evaluate(([to, quality]) => new Promise(done => {
        const t = performance.now();
        __loft.autoTierTo(to);
        const look = () => (__loft.out3d.quality === quality ? done(performance.now() - t) : performance.now() - t > 20000 ? done(null) : setTimeout(look, 50));
        look();
      }), [to, quality]);
      const took = await reach('low', 'low');
      check('a land worker that never answers: the outside still changes', took !== null, took === null ? 'not in 20 s' : `${(took / 1000).toFixed(1)} s`);
      const same = await p.evaluate(async () => {
        const { terrainData } = await import('/src/pure/terrain.js');
        const d = terrainData('low'), g = __loft.out3d.parts.terrain.geometry;
        const eq = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
        return eq(g.attributes.position.array, d.pos) && eq(g.attributes.normal.array, d.normal) && eq(g.index.array, d.index);
      });
      check('and its land is the same to the last bit', same);
      await p.evaluate(() => __loft.autoTierTo('ultra'));
      await p.waitForTimeout(300);
      const back = await reach('medium', 'medium');
      check('a change of mind while a worker hangs: the build waiting on it stops, and the last tier asked for arrives', back !== null, back === null ? 'not in 20 s' : `${(back / 1000).toFixed(1)} s`);
      const w = await p.evaluate(() => window.__workers);
      check('every worker that hung was let go', w.made > 0 && w.ended === w.made, JSON.stringify(w));
      check('a hanging worker: no error', errs.length === 0, errs.slice(0, 3).join(' | '));
      await p.close();
    }
  } finally {
    await b.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

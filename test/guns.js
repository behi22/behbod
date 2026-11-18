// The long guns in the hand, desktop and phone, pictures to outdir: LOFT_URL=http://127.0.0.1:8814 node test/guns.js [outdir] [gun ...]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output/guns';
require('fs').mkdirSync(OUT, { recursive: true });
const ONLY = process.argv.slice(3);
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

function watch(p, errs, files) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { const m = /assets\/range\/(\w+)\.glb/.exec(r.url()); if (m) files.push(m[1]); if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!/youtube|googlevideo|ytimg/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => { if ((m.type() === 'error' || (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text()))) && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200)); });
}
function hear() {
  window.__heard = { cues: [], shots: [] };
}
async function open(b, opts) {
  const p = await b.newPage(opts), errs = [], files = [];
  watch(p, errs, files);
  await p.addInitScript(hear);
  await p.goto(`${BASE}/?auto&allguns&q=${opts.isMobile ? 'medium' : 'ultra'}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById('snd').click());
  await p.evaluate(() => __loft.range.load());
  await p.evaluate(() => {
    const sfx = __loft.audio.sfx, cue = sfx.gunCue, shot = sfx.gunShot;
    sfx.gunCue = (n, id) => { __heard.cues.push(`${id}:${n}`); return cue(n, id); };
    sfx.gunShot = (l, id) => { __heard.shots.push(id); return shot(l, id); };
  });
  return { p, errs, files };
}
async function toLine(p) {
  await p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
  await p.waitForTimeout(1500);
  const at = await p.evaluate(() => __loft.meta.interact.find(i => i.id === 'range').at);
  await p.evaluate(v => { __loft.pos.set(v.x, v.y + 0.05, v.z); }, b2t(...at));
  await p.waitForTimeout(400);
  await p.evaluate(() => __loft.act('range'));
  await p.waitForTimeout(1200);
}
const heard = p => p.evaluate(() => ({ cues: __heard.cues.slice(), shots: __heard.shots.slice() }));
const since = (a, b, id) => b.cues.slice(a.cues.length).filter(c => c.startsWith(id + ':')).map(c => c.slice(id.length + 1));
// One-frame presses and a clock run by hand in 1/60 s frames, so an automatic is never held past its last round.
const tap = (p, name) => p.evaluate(async n => { __loft.range.press(n, true); __loft.range.advance(1 / 60); await new Promise(r => requestAnimationFrame(r)); __loft.range.press(n, false); }, name);
const run = (p, sec) => p.evaluate(async n => { for (let i = 0; i < n; i++) { __loft.range.advance(1 / 60); await new Promise(r => requestAnimationFrame(r)); } }, Math.round(sec * 60));

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    const { p, errs, files } = await open(b, { viewport: { width: 1280, height: 800 } });
    const all = await p.evaluate(async () => Object.keys((await import('/src/pure/rigs.js')).RIGS));
    const ids = all.filter(id => id !== 'pistol' && (!ONLY.length || ONLY.includes(id)));
    check('only the pistol is fetched with the range', JSON.stringify(files) === '["p22"]', JSON.stringify(files));
    await toLine(p);
    const row = await p.evaluate(() => [...document.querySelectorAll('.rg-guns button')].map(x => x.textContent));
    check('the stage card offers every gun built so far (with ?allguns)', row.length === all.length && row[0] === 'P-22', JSON.stringify(row));

    for (const id of ids) {
      const name = await p.evaluate(async g => (await import('/src/pure/arsenal.js')).GUN[g].name, id);
      const before = files.length;
      await p.evaluate(n => [...document.querySelectorAll('.rg-guns button')].find(x => x.textContent === n).click(), name);
      await p.waitForFunction(g => __loft.range.held === g, id, { timeout: 20000 });
      await p.waitForTimeout(300);
      const took = await p.evaluate(() => ({ on: document.querySelector('.rg-guns button.on')?.textContent, gun: __loft.range.gun.id }));
      check(`${id}: picked from the card, fetched once, in the hands`, took.on === name && took.gun === id && files.slice(before).length === 1, JSON.stringify({ ...took, fetched: files.slice(before) }));
      await p.click('.rg-card .rg-acts button.go');
      await p.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 8000 });
      await p.evaluate(() => { __loft.range.film(true); });
      await run(p, 0.8);
      await p.screenshot({ path: `${OUT}/${id}-1-hip.png` });

      const fit = await p.evaluate(async g => {
        const { GUN_HOLDS } = await import('/src/pure/handling.js');
        const { HAND } = await import('/src/pure/hands.js');
        const gun = __loft.range.gun, V = () => __loft.camera.position.clone().set(0, 0, 0);
        gun.scene.updateMatrixWorld(true);
        const tipBone = gun.hands.right.bones.find(o => o.name === 'right_index3'), H = GUN_HOLDS[g];
        const tip = gun.model.worldToLocal(tipBone.localToWorld(V().set(HAND.fingers.index.len[2], 0, 0)));
        return { trigger: tip.distanceTo(V().set(...H.trigger.pad)), mounts: Object.keys(gun.mounts).sort(), hands: ['right', 'left'].every(s => gun.hands[s].root.visible) };
      }, id);
      check(`${id}: the trigger finger is on the trigger, both hands on, the four mounts in the file`, fit.trigger < 0.006 && fit.hands && JSON.stringify(fit.mounts) === '["mag","muzzle","optic","rail"]', JSON.stringify(fit));

      // A shot, heard as this gun's.
      let h0 = await heard(p);
      const s0 = await p.evaluate(() => __loft.range.debug.run.shots);
      await tap(p, 'fire');
      await run(p, 0.3);
      let h1 = await heard(p);
      check(`${id}: a shot, heard as its own`, (await p.evaluate(() => __loft.range.debug.run.shots)) === s0 + 1 && h1.shots.at(-1) === id, JSON.stringify(h1.shots.slice(h0.shots.length)));
      // A bolt worked by hand: after the shot the hand draws it back (the case flies) and closes it.
      const turn = await p.evaluate(() => __loft.range.gun.spec.action === 'turn');
      if (turn) {
        await run(p, 1);
        await p.evaluate(() => { __loft.range.debug.weapon.ammo = 4; });
        const c0 = await p.evaluate(() => __loft.range.debug.fx?.casings ?? null);
        h0 = await heard(p);
        await tap(p, 'fire');
        await run(p, 0.42);
        await p.screenshot({ path: `${OUT}/${id}-1b-cycle.png` });
        const drawn = await p.evaluate(() => { const g = __loft.range.gun; return { x: g.part.bolt.position.x, phase: __loft.range.debug.weapon.phase, casings: __loft.range.debug.fx?.casings ?? null }; });
        await run(p, 0.8);
        h1 = await heard(p);
        const shut = await p.evaluate(() => ({ x: __loft.range.gun.part.bolt.position.x, phase: __loft.range.debug.weapon.phase }));
        check(`${id}: after a shot the bolt is worked by hand: drawn back, a case thrown, closed, heard`, drawn.phase === 'bolt' && drawn.x < shut.x - 0.06 && shut.phase === 'ready' && since(h0, h1, id).join() === 'boltOpen,boltClose' && (c0 === null || drawn.casings > c0), `${JSON.stringify({ c0, drawn, shut })} ${JSON.stringify(since(h0, h1, id))}`);
      }
      // Aimed down its sights.
      await p.evaluate(() => __loft.range.press('aim', true)); await run(p, 0.6);
      await p.screenshot({ path: `${OUT}/${id}-2-aim.png` });
      await p.evaluate(() => __loft.range.press('aim', false)); await run(p, 0.5);

      // A reload with rounds left.
      const st = await p.evaluate(() => ({ mag: __loft.range.debug.stats.mag, chamber: __loft.range.debug.stats.chamber, R: __loft.range.debug.stats.reload }));
      await p.evaluate(() => { __loft.range.debug.weapon.ammo = 2; });
      h0 = await heard(p);
      await tap(p, 'reload');
      await run(p, st.R.out + 0.35);
      await p.screenshot({ path: `${OUT}/${id}-3-reload.png` });
      const lid = await p.evaluate(() => { const c = __loft.range.gun.part.cover; return c ? { open: c.quaternion.angleTo(new c.quaternion.constructor()), belt: __loft.range.gun.part.belt.visible } : null; });
      await run(p, st.R.partial);
      h1 = await heard(p);
      const r1 = await p.evaluate(() => ({ ammo: __loft.range.debug.weapon.ammo, phase: __loft.range.debug.weapon.phase }));
      const said = since(h0, h1, id);
      check(`${id}: a reload: release, out, drop, in, and full (with one in the chamber where it has one)`, ['magRelease', 'magOut', 'magDrop', 'magIn'].every((c, i, a) => said.indexOf(c) >= 0 && (i === 0 || said.indexOf(c) > said.indexOf(a[i - 1]))) && r1.ammo === st.mag + st.chamber && r1.phase === 'ready' && (!lid || (lid.open > 0.9 && !lid.belt)), `${JSON.stringify(said)} ${JSON.stringify({ ...r1, lid })}`);
      if (lid) check(`${id}: the cover is lifted while the box is changed, the belt laid back and the cover shut by the end`, (await p.evaluate(() => __loft.range.gun.part.cover.quaternion.angleTo(new __loft.range.gun.part.cover.quaternion.constructor()))) < 1e-3 && (await p.evaluate(() => __loft.range.gun.part.belt.visible)) && said.includes('coverOpen') && said.includes('beltIn') && said.at(-1) === 'coverClose', JSON.stringify(said));

      // From empty: a bolt worked by hand is worked once more; a closed bolt held open, hauled back by the free hand and let go.
      if (turn) {
        await p.evaluate(() => { __loft.range.debug.weapon.ammo = 1; });
        await tap(p, 'fire');
        await run(p, 0.4);
        h0 = await heard(p);
        await tap(p, 'reload');
        await run(p, st.R.rack - 0.25);
        await p.screenshot({ path: `${OUT}/${id}-4-charge.png` });
        await run(p, st.R.empty - st.R.rack + 0.65);
        h1 = await heard(p);
        const saidE = since(h0, h1, id), endT = await p.evaluate(() => ({ ammo: __loft.range.debug.weapon.ammo, phase: __loft.range.debug.weapon.phase }));
        check(`${id}: a reload from empty ends with the bolt worked, heard`, saidE.at(-1) === 'boltClose' && saidE.includes('boltOpen') && saidE.includes('magIn') && endT.ammo === st.mag && endT.phase === 'ready', `${JSON.stringify(saidE)} ${JSON.stringify(endT)}`);
      } else {
        await p.evaluate(() => { __loft.range.debug.weapon.ammo = 1; });
        await tap(p, 'fire');
        await run(p, 0.4);
        const open0 = await p.evaluate(() => { const g = __loft.range.gun; return g.part.bolt ? g.part.bolt.position.x : null; });
        h0 = await heard(p);
        await tap(p, 'reload');
        await run(p, st.R.rack - 0.12);
        await p.screenshot({ path: `${OUT}/${id}-4-charge.png` });
        const mid = await p.evaluate(() => { const g = __loft.range.gun; return { bolt: g.part.bolt?.position.x, handle: g.part.handle?.position.x }; });
        await run(p, st.R.empty - st.R.rack + 0.4);
        h1 = await heard(p);
        const end = await p.evaluate(() => { const g = __loft.range.gun; return { bolt: g.part.bolt?.position.x, handle: g.part.handle?.position.x, ammo: __loft.range.debug.weapon.ammo }; });
        const saidE = since(h0, h1, id);
        check(`${id}: empty, the bolt stays open; the reload hauls the handle back and lets it fly home, heard`, (open0 === null || open0 < end.bolt - 0.03) && mid.handle < end.handle - 0.04 && saidE.at(-1) === 'slideRelease' && saidE.includes('slidePull') && end.ammo === st.mag, `${JSON.stringify(saidE)} ${JSON.stringify({ open0, mid, end })}`);
      }
      // The look over, on F.
      h0 = await heard(p);
      await p.keyboard.press('KeyF');
      await run(p, 0.7);
      await p.screenshot({ path: `${OUT}/${id}-5-inspect.png` });
      await run(p, 1.9);
      await p.screenshot({ path: `${OUT}/${id}-6-press.png` });
      const looking = await p.evaluate(() => __loft.range.gun.inspecting);
      await run(p, 1.2);
      h1 = await heard(p);
      const lmg = await p.evaluate(() => !!__loft.range.gun.part.cover);
      const [opens, shuts] = turn ? ['boltOpen', 'boltClose'] : lmg ? ['coverOpen', 'coverClose'] : ['slidePull', 'slideHome'];
      check(`${id}: F looks it over, opens the action a little and gives it back`, looking && !(await p.evaluate(() => __loft.range.gun.inspecting)) && since(h0, h1, id).includes(opens) && since(h0, h1, id).includes(shuts), JSON.stringify(since(h0, h1, id)));
      // Cut short by the aim while the action is open, it is heard shutting, once.
      h0 = await heard(p);
      await p.keyboard.press('KeyF');
      await run(p, 2.6);
      await p.evaluate(() => __loft.range.press('aim', true)); await run(p, 0.5);
      await p.evaluate(() => __loft.range.press('aim', false)); await run(p, 0.4);
      h1 = await heard(p);
      const cutSaid = since(h0, h1, id);
      check(`${id}: a look over cut short with the action open is heard shutting it`, cutSaid.includes(opens) && cutSaid.at(-1) === shuts && cutSaid.filter(c => c === shuts).length === 1, JSON.stringify(cutSaid));
      const bank = await p.evaluate(() => __loft.audio.sfx.gunSoundStats());
      check(`${id}: only its own sounds are kept`, bank.gun === id && bank.bytes > 1e6 && bank.bytes < 6e6, JSON.stringify(bank));
      await p.evaluate(() => { __loft.range.film(false); __loft.range.escape(); });
      await p.waitForTimeout(300);
      await p.evaluate(() => [...document.querySelectorAll('.rg-card .rg-acts button')].find(x => x.textContent === 'Stages').click());
      await p.waitForTimeout(300);
    }
    // Low-end: the processor slowed four times, a long burst from the gun that fires fastest, its sounds already made.
    const fast = ids.includes('smg') ? 'smg' : ids[0];
    if (fast) {
      const name = await p.evaluate(async g => (await import('/src/pure/arsenal.js')).GUN[g].name, fast);
      await p.evaluate(n => [...document.querySelectorAll('.rg-guns button')].find(x => x.textContent === n).click(), name);
      await p.waitForFunction(g => __loft.range.held === g, fast, { timeout: 20000 });
      await p.click('.rg-card .rg-acts button.go');
      await p.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 8000 });
      await p.waitForTimeout(400);
      const cdp = await p.context().newCDPSession(p);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const slow = await p.evaluate(() => new Promise(r => {
        __loft.range.press('fire', true);
        const t = []; let last = performance.now();
        const f = now => { t.push(now - last); last = now; if (t.length < 160) requestAnimationFrame(f); else { __loft.range.press('fire', false); r(t.slice(2)); } };
        requestAnimationFrame(f);
      }));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      slow.sort((a, c) => a - c);
      const avg = slow.reduce((a, c) => a + c, 0) / slow.length;
      check(`slowed four times, a long burst from the ${name} keeps the frame rate`, avg < 34, `average ${avg.toFixed(1)} ms, 95th ${slow[Math.floor(slow.length * 0.95)].toFixed(0)} ms, worst ${slow.at(-1).toFixed(0)} ms`);
    }
    check('desktop: no errors or warnings', errs.length === 0, JSON.stringify(errs.slice(0, 5)));
    await p.close();

    // ---------- phone: picked by a tap, fired and reloaded with the thumb pads ----------
    const ph = await open(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const q = ph.p, pick = ids.includes('rifle') ? 'rifle' : ids[0];
    if (pick) {
      await toLine(q);
      const name = await q.evaluate(async g => (await import('/src/pure/arsenal.js')).GUN[g].name, pick);
      const bt = q.locator('.rg-guns button', { hasText: new RegExp(`^${name}$`) });
      await bt.tap();
      await q.waitForFunction(g => __loft.range.held === g, pick, { timeout: 20000 });
      const fits = await q.evaluate(() => {
        const card = document.querySelector('.rg-card'), c = card.getBoundingClientRect(), edge = c.right - parseFloat(getComputedStyle(card).paddingRight) + 0.5;
        const row = card.scrollWidth <= card.clientWidth && [...document.querySelectorAll('.rg-guns button')].every(x => x.getBoundingClientRect().right <= edge);
        return { inside: c.left >= 0 && c.right <= innerWidth && c.bottom <= innerHeight + 1, wide: document.documentElement.scrollWidth <= innerWidth, row };
      });
      await q.tap('.rg-card .rg-acts button.go');
      await q.waitForFunction(() => __loft.range.state === 'play', null, { timeout: 8000 });
      await q.waitForTimeout(700);
      const fire = await q.locator('.rg-fire').boundingBox().catch(() => null);
      const s0 = await q.evaluate(() => __loft.range.debug.run.shots);
      if (fire) { await q.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2); await q.mouse.down(); await q.waitForTimeout(60); await q.mouse.up(); await q.waitForTimeout(300); }
      const shot = (await q.evaluate(() => __loft.range.debug.run.shots)) > s0;
      await q.evaluate(() => { __loft.range.debug.weapon.ammo = 3; });
      const lb = await q.locator('.rg-load').boundingBox();
      await q.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2); await q.mouse.down(); await q.waitForTimeout(100); await q.mouse.up();
      const R = await q.evaluate(() => __loft.range.debug.stats.reload.partial);
      await q.waitForTimeout(R * 1000 + 600);
      const st = await q.evaluate(() => ({ ammo: __loft.range.debug.weapon.ammo, mag: __loft.range.debug.stats.mag, chamber: __loft.range.debug.stats.chamber }));
      await q.screenshot({ path: `${OUT}/phone-${pick}.png` });
      check(`phone: the ${name} picked with a tap (the card fits), fired and reloaded with the pads`, fits.inside && fits.wide && fits.row && (shot || !fire) && st.ammo === st.mag + st.chamber, JSON.stringify({ fits, shot, fire: !!fire, ...st }));
    }
    check('phone: no errors or warnings', ph.errs.length === 0, JSON.stringify(ph.errs.slice(0, 5)));
  } finally { await b.close(); }
  console.log(fails ? `${fails} FAILED` : 'all PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

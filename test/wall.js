// The gun wall in the loadout room, computer and phone: LOFT_URL=http://127.0.0.1:8815 node test/wall.js [outdir]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output/wall';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const b2t = (x, y, z) => ({ x, y: z, z: -y });
const WORLD = require('../web/assets/world.json');
const MOUNTS = WORLD.range.mounts;
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${name}${detail ? ' ' + detail : ''} ${ok ? 'PASS' : 'FAIL'}`); };

function watch(p, errs, files) {
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { const m = /assets\/range\/(\w+)\.glb/.exec(r.url()); if (m) files.push(m[1]); if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });
  p.on('requestfailed', r => { if (!/youtube|googlevideo|ytimg/.test(r.url()) && !/run\.mp3/.test(r.url())) errs.push(`failed ${r.url().slice(0, 140)}`); });
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 200));
    if (m.type() === 'warning' && /\[(loft|range)\]/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
}
// Opens the house (with a save from before, if given), makes the range ready and opens the bookcase.
async function open(b, opts, save) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], files = [];
  watch(p, errs, files);
  if (save) await p.addInitScript(s => { try { localStorage.setItem('loft.progress', s); } catch (e) { /* the check below fails instead */ } }, JSON.stringify(save));
  await p.goto(`${BASE}/?auto&q=${opts.isMobile ? 'auto' : 'ultra'}`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.evaluate(() => __loft.range.load());
  await p.waitForFunction(() => __loft.range.ready, null, { timeout: 60000 });
  await p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
  await p.waitForTimeout(1200);
  return { ctx, p, errs, files };
}
// Each mount: what is on it, what its spot says.
const mounts = p => p.evaluate(() => __loft.range.wall.mounts.map(m => ({ id: m.id, gun: !!m.model?.visible, outline: m.outline ? (m.outline.visible ? (m.outline.material.opacity > 0.8 ? 'locked' : 'owned') : 'off') : 'none', label: m.spot.label })));
const stand = (p, x, y, yaw) => p.evaluate(([v, yw]) => { __loft.pos.set(v.x, v.y + 0.05, v.z); if (yw !== null) __loft.yaw = yw; }, [b2t(x, y, 0), yaw ?? null]);
const toast = p => p.evaluate(() => document.getElementById('toast')?.textContent || '');
// Stars for the first `n` stages, three each where they go, without a run (the wall is told, as a finished run tells it).
const give = (p, stars) => p.evaluate(s => { for (const [st, n] of Object.entries(s)) __loft.progress.rangeResult(st, 'normal', n, 100); __loft.range.wall.sync(); }, stars);
// Where a point of the wall (Blender axes) is on the screen, in CSS pixels.
const onScreen = (p, at) => p.evaluate(async a => {
  const THREE = await import('three');
  const v = new THREE.Vector3(a[0], a[2], -a[1]).project(__loft.camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, front: v.z < 1 };
}, at);
const frame = async (p, name) => { await p.screenshot({ path: `${OUT}/${name}.png` }); };

async function desktop(b) {
  const { ctx, p, errs, files } = await open(b, { viewport: { width: 1280, height: 800 } });
  await stand(p, 7.4, -3.2, Math.PI / 2);
  await p.waitForTimeout(1500);
  let m = await mounts(p);
  check('a new visitor: the P-22 hangs on its mount, the other four wait as dark outlines', m[0].gun && m[0].outline === 'none' && m.slice(1).every(x => !x.gun && x.outline === 'locked'), JSON.stringify(m.map(x => [x.id, x.gun, x.outline])));
  check('and no gun but the pistol is fetched, even standing at the wall', JSON.stringify(files) === '["p22"]', JSON.stringify(files));
  check('each spot says what it is: the pistol in the hands, the stars each other gun needs', JSON.stringify(m.map(x => x.label)) === JSON.stringify(['The P-22, in your hands', 'The Vesper: 1 star', 'The Keeper: 4 stars', 'The Longview: 7 stars', 'The Gatekeeper: 10 stars']), JSON.stringify(m.map(x => x.label)));
  await frame(p, 'desktop-new');
  // Each mount's spot is the nearest thing to press E at when standing in front of it.
  const near = [];
  for (const at of MOUNTS) { await stand(p, 5.95, at[1]); await p.waitForTimeout(350); near.push(await p.evaluate(() => __loft.near)); }
  check('standing at each mount, its spot is the one E answers', JSON.stringify(near) === JSON.stringify(['wall_pistol', 'wall_smg', 'wall_rifle', 'wall_sniper', 'wall_lmg']), JSON.stringify(near));
  const lockedSaid = await p.evaluate(() => { __loft.act('wall_rifle'); return { toast: document.getElementById('toast')?.textContent, held: __loft.range.held }; });
  check('E at a locked gun says the stars it needs and takes nothing', /Keeper .*unlocks at 4 stars\. 4 stars to go/.test(lockedSaid.toast) && lockedSaid.held === 'pistol', JSON.stringify(lockedSaid));
  const general = await p.evaluate(() => { __loft.act('loadout'); return document.getElementById('toast')?.textContent; });
  check('E at the wall as a whole counts what is yours', general === 'The gun wall: 1 of the 5 guns are yours so far. Stars at the line earn the rest.', general);

  // A finished run tells the wall: stars given behind its back show only once a run ends.
  await p.evaluate(() => { __loft.progress.rangeResult('warmup', 'normal', 3, 100); __loft.progress.rangeResult('walkers', 'normal', 1, 100); });
  const stale = (await mounts(p))[1].outline;
  const at = WORLD.interact.find(i => i.id === 'range').at;
  await stand(p, at[0], at[1]); await p.waitForTimeout(400);
  await p.evaluate(() => __loft.act('range'));
  await p.waitForFunction(() => __loft.range.state === 'menu', null, { timeout: 8000 });
  const row0 = await p.evaluate(() => [...document.querySelectorAll('.rg-guns button')].map(x => x.textContent));
  await p.evaluate(() => { __loft.range.start('warmup', 'easy', 7); __loft.range.film(true); });
  for (let i = 0; i < 80 && await p.evaluate(() => __loft.range.state !== 'over'); i++) await p.evaluate(async () => { __loft.range.advance(1); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
  await p.evaluate(() => __loft.range.film(false));
  const after = await mounts(p);
  check('the stage card offers the guns the wall shows (4 stars: P-22, Vesper, Keeper)', JSON.stringify(row0) === '["P-22","Vesper","Keeper"]', JSON.stringify(row0));
  check('when the run ends the wall shows the guns the stars earned', stale === 'locked' && after[1].outline === 'owned' && after[2].outline === 'owned' && after[3].outline === 'locked' && after[4].outline === 'locked', JSON.stringify({ stale, after: after.map(x => x.outline) }));
  check('nothing fetched at the line just because the wall changed', JSON.stringify(files) === '["p22"]', JSON.stringify(files));
  await p.evaluate(() => __loft.range.exit()); await p.waitForTimeout(600);

  // Back near the wall, the two guns earned are fetched one at a time and hung, their outlines gone.
  await stand(p, 7.4, -3.2, Math.PI / 2);
  const hung = await p.waitForFunction(() => { const m = __loft.range.wall.mounts; return m[1].model?.visible && m[2].model?.visible; }, null, { timeout: 30000 }).then(() => true, () => false);
  await p.waitForTimeout(800);
  m = await mounts(p);
  check('near the wall the Vesper and the Keeper are fetched and hung; the Longview and the Gatekeeper stay outlines', hung && m[1].gun && m[2].gun && m[1].outline === 'off' && m[2].outline === 'off' && m[3].outline === 'locked' && m[4].outline === 'locked', JSON.stringify(m.map(x => [x.id, x.gun, x.outline])));
  check('only those two files', JSON.stringify(files) === '["p22","vesper","keeper"]', JSON.stringify(files));
  await frame(p, 'desktop-four-stars');

  // E at a gun takes it; the wall and the stage card follow.
  await stand(p, 5.95, MOUNTS[1][1]); await p.waitForTimeout(350);
  await p.keyboard.press('KeyE');
  const took = await p.waitForFunction(() => __loft.range.held === 'smg', null, { timeout: 15000 }).then(() => true, () => false);
  await p.waitForTimeout(300);
  m = await mounts(p);
  const said = await toast(p);
  check('E at the Vesper takes it: in the hands, and the wall says so', took && /You take the Vesper/.test(said) && m[1].label === 'The Vesper, in your hands' && m[0].label === 'Take the P-22', JSON.stringify({ took, said, labels: m.map(x => x.label) }));
  check('taking it fetched nothing more (it was already on the wall)', files.length === 3, JSON.stringify(files));
  await stand(p, at[0], at[1]); await p.waitForTimeout(400);
  await p.evaluate(() => __loft.act('range'));
  await p.waitForFunction(() => __loft.range.state === 'menu', null, { timeout: 8000 });
  const card = await p.evaluate(() => ({ on: document.querySelector('.rg-guns button.on')?.textContent, gun: __loft.range.gun.id, hud: __loft.range.debug.stats.name }));
  check('at the line the Vesper is in the hands and picked on the card', card.on === 'Vesper' && card.gun === 'smg' && card.hud === 'Vesper', JSON.stringify(card));
  await p.evaluate(() => [...document.querySelectorAll('.rg-guns button')].find(x => x.textContent === 'Keeper').click());
  await p.waitForFunction(() => __loft.range.held === 'rifle', null, { timeout: 15000 });
  await p.evaluate(() => __loft.range.exit()); await p.waitForTimeout(600);
  m = await mounts(p);
  check('a gun picked on the card is the one the wall marks as in the hands', m[2].label === 'The Keeper, in your hands' && m[1].label === 'Take the Vesper', JSON.stringify(m.map(x => x.label)));

  // A click on a gun on the wall walks over to it and takes it.
  await stand(p, 7.6, -1.4, Math.PI / 2 + 0.35); await p.waitForTimeout(1200);
  const pt = await onScreen(p, [5.4, MOUNTS[1][1], 1.3]);
  await p.mouse.click(pt.x, pt.y);
  const walked = await p.waitForFunction(() => __loft.range.held === 'smg', null, { timeout: 20000 }).then(() => true, () => false);
  const there = await p.evaluate(() => ({ near: __loft.near, x: __loft.pos.x, z: __loft.pos.z }));
  check('a click on the Vesper walks me to it and takes it', pt.front && walked && there.near === 'wall_smg', JSON.stringify({ pt, there }));
  // The middle gun, from straight out in the room, where the loadout room's own spot is nearer when the walk ends.
  await stand(p, 7.6, MOUNTS[2][1], Math.PI / 2); await p.waitForTimeout(1200);
  const mid = await onScreen(p, [5.4, MOUNTS[2][1], 1.3]);
  await p.mouse.click(mid.x, mid.y);
  const tookMid = await p.waitForFunction(() => __loft.range.held === 'rifle', null, { timeout: 20000 }).then(() => true, () => false);
  check('a click on the Keeper from straight out in the room walks me to it and takes it', mid.front && tookMid, JSON.stringify({ mid, at: await p.evaluate(() => [__loft.pos.x, __loft.pos.z, __loft.near]) }));

  // Every gun earned: all five hang, each where the rules put it, nothing touching.
  await give(p, { swarm: 3, dark: 3, long: 3, walkers: 3 });
  await stand(p, 7.4, -3.2, Math.PI / 2);
  const all = await p.waitForFunction(() => __loft.range.wall.mounts.every(m => m.model?.visible), null, { timeout: 40000 }).then(() => true, () => false);
  await p.waitForTimeout(1000);
  m = await mounts(p);
  const placed = !all ? [] : await p.evaluate(async () => {
    const THREE = await import('three');
    return __loft.range.wall.mounts.map(m => {
      const box = new THREE.Box3(), one = new THREE.Box3();
      m.model.updateMatrixWorld(true);
      m.model.traverseVisible(o => { if (!o.isMesh) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(one.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); });
      return { id: m.id, y: [-box.max.z, -box.min.z].map(v => +v.toFixed(3)), z: [box.min.y, box.max.y].map(v => +v.toFixed(3)), x: [box.min.x, box.max.x].map(v => +v.toFixed(3)) }; });
  });
  const apart = placed.every((g, i) => i === 0 || placed[i - 1].y[0] - g.y[1] > 0.2), inPanel = placed.every(g => g.y[0] > -5.6 && g.y[1] < -1.2 && g.z[0] > 0.87 && g.z[1] < 2.35 && g.x[0] > 5.2);
  check('every gun earned hangs on the wall, inside the panel, on or above the shelf, none touching', all && m.every(x => x.gun && x.outline !== 'locked') && apart && inPanel, JSON.stringify(placed));
  await frame(p, 'desktop-all');
  await stand(p, 6.6, -2.0, Math.PI / 2 + 0.5); await p.waitForTimeout(1200);
  await frame(p, 'desktop-close');
  const draws = await p.evaluate(() => __loft.renderer.info.render.calls);
  console.log('draw calls with the wall in view:', draws);
  check('nothing went wrong on the computer (console and network)', errs.length === 0, errs.slice(0, 6).join(' | '));
  await ctx.close();
}

// A phone, by touch; with a save from the first range, whose unlocks carry over and give no guns.
async function phone(b) {
  const { ctx, p, errs, files } = await open(b, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, { best: { range: 36 }, earned: ['range'] });
  const old = await p.evaluate(() => ({ unlocked: __loft.progress.unlocked(), owned: __loft.range.owned, best: __loft.progress.best('range') }));
  check('phone: a save from the first range keeps the keeper kit and gold, and owns only the pistol', JSON.stringify(old) === JSON.stringify({ unlocked: ['kit', 'gold'], owned: ['pistol'], best: 36 }), JSON.stringify(old));
  await give(p, { warmup: 3, walkers: 3, swarm: 1 });
  await stand(p, 8.4, -4.3, Math.PI / 2);
  const hung = await p.waitForFunction(() => { const m = __loft.range.wall.mounts; return m[1].model?.visible && m[2].model?.visible && m[3].model?.visible; }, null, { timeout: 40000 }).then(() => true, () => false);
  await p.waitForTimeout(1200);
  check('phone: 7 stars, three guns fetched and hung near the wall', hung && JSON.stringify(files) === '["p22","vesper","keeper","longview"]', JSON.stringify(files));
  await frame(p, 'phone-seven-stars');
  // A tap on the Longview, above my head, walks over and takes it.
  const pt = await onScreen(p, [5.4, MOUNTS[3][1], 1.95]);
  await p.touchscreen.tap(pt.x, pt.y);
  const took = await p.waitForFunction(() => __loft.range.held === 'sniper', null, { timeout: 25000 }).then(() => true, () => false);
  check('phone: a tap on the Longview walks me to it and takes it', pt.front && took, JSON.stringify(pt));
  // The Use button is E on a phone.
  await stand(p, 5.95, MOUNTS[1][1]); await p.waitForTimeout(400);
  await p.tap('#use');
  const used = await p.waitForFunction(() => __loft.range.held === 'smg', null, { timeout: 15000 }).then(() => true, () => false);
  check('phone: Use at the Vesper takes it', used && (await toast(p)).includes('Vesper'));
  check('nothing went wrong on the phone', errs.length === 0, errs.slice(0, 6).join(' | '));
  await ctx.close();
}

// A gun whose file never comes: E at it claims nothing and takes nothing.
async function failing(b) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/assets/range/vesper.glb', r => r.fulfill({ status: 404, body: '' }));
  await p.addInitScript(() => { try { localStorage.setItem('loft.progress', JSON.stringify({ range: { warmup: { normal: { stars: 1, score: 100 } } } })); } catch (e) { /* the check below fails instead */ } });
  await p.goto(`${BASE}/?auto&q=ultra`);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.evaluate(() => __loft.range.load());
  await p.waitForFunction(() => __loft.range.ready, null, { timeout: 60000 });
  await p.evaluate(() => { if (!__loft.world.doors.secret.open) __loft.act('secret'); });
  await stand(p, 5.95, MOUNTS[1][1]); await p.waitForTimeout(400);
  const said = await p.evaluate(() => { __loft.act('wall_smg'); return document.getElementById('toast')?.textContent; });
  await p.waitForTimeout(2500);
  const after = await p.evaluate(() => ({ held: __loft.range.held, label: __loft.range.wall.mounts[1].spot.label, toast: document.getElementById('toast')?.textContent }));
  check('a gun whose file fails: E says it is fetching, never that it is taken, and the pistol stays in the hands', !/You take/.test(said) && !/You take/.test(after.toast) && after.held === 'pistol' && after.label === 'Take the Vesper' && !errs.length, JSON.stringify({ said, after, errs }));
  await ctx.close();
}

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    await desktop(b);
    await phone(b);
    await failing(b);
  } finally { await b.close(); }
  console.log(fails ? `${fails} FAILED` : 'all pass');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

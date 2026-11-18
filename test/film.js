// The film: offered at the door, replayed from the TV and the computer. In Chrome on a desktop and a phone it plays the
// right cut, fits the screen, keeps the house quiet while it plays and lets you in (or back) when it closes.
// Firefox and WebKit under Playwright may lack the video's codec, so there it must either play or say it cannot.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const VIEWS = [['desktop', { viewport: { width: 1280, height: 800 } }, 'wide'], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'tall']];

const rows = [];
const check = (name, ok, detail = '') => rows.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' (' + detail + ')' : ''}`);

async function page(b, opts) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text()) && !/youtube/.test(m.location()?.url || '')) errs.push(m.text().slice(0, 160)); });
  return { ctx, p, errs };
}
// How the open film sits on the screen, and how far it has played.
const state = p => p.evaluate(() => {
  const box = document.querySelector('.video.film'), v = box?.querySelector('video');
  if (!box) return null;
  const r = v.getBoundingClientRect(), c = box.querySelector('button').getBoundingClientRect();
  return { src: v.currentSrc || v.src, t: v.currentTime, muted: v.muted, note: box.querySelector('.film-note')?.textContent || '',
    fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 && c.bottom <= innerHeight + 0.5,
    ratio: r.width / r.height, label: box.querySelector('button').textContent, gain: __loft?.houseGain ?? null };
});
const playing = p => p.waitForFunction(() => { const v = document.querySelector('.video.film video'); return v && v.currentTime > 1.5; }, null, { timeout: 30000 }).then(() => true, () => false);

async function chrome() {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  for (const [view, opts, cut] of VIEWS) {
    const { ctx, p, errs } = await page(b, opts);
    const tag = `chrome ${view}`;
    // At the door: both buttons wait for the house, then the film plays its cut with the house silent.
    await p.goto(BASE + '/?q=low');
    await p.waitForFunction(() => document.querySelector('#film.ready') && document.querySelector('#enter.ready'), null, { timeout: 90000 });
    const btn = await p.evaluate(() => { const r = document.querySelector('#film').getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0 && document.documentElement.scrollWidth <= innerWidth; });
    check(`${tag}: the film button sits on the screen at the door`, btn);
    await p.click('#film');
    const played = await playing(p);
    let s = await state(p);
    check(`${tag}: plays the ${cut} cut at the door`, played && s && s.src.endsWith(`home-film-${cut}.mp4`), s && `${s.src.split('/').pop()} at ${s.t.toFixed(1)} s`);
    check(`${tag}: fits the screen, the right shape`, s && s.fits && Math.abs(s.ratio - (cut === 'wide' ? 16 / 9 : 9 / 16)) < 0.02, s && `ratio ${s.ratio.toFixed(3)}`);
    check(`${tag}: the house is silent while it plays`, s && s.gain === 0, s && `gain ${s.gain}`);
    check(`${tag}: its button says Skip at the door`, s && s.label === 'Skip');
    // The room stops drawing while the film plays.
    const f0 = await p.evaluate(() => __loft.renderer.info.render.frame);
    await p.waitForTimeout(1000);
    const f1 = await p.evaluate(() => __loft.renderer.info.render.frame);
    check(`${tag}: the room stops drawing behind the film`, f1 === f0, `${f1 - f0} frames in a second`);
    // Space pauses and plays it; it never skips.
    if (!opts.hasTouch) {
      await p.keyboard.press(' ');
      await p.waitForTimeout(300);
      const paused = await p.evaluate(() => ({ open: !!document.querySelector('.video.film'), paused: document.querySelector('.video.film video')?.paused }));
      await p.keyboard.press(' ');
      await p.waitForTimeout(300);
      const resumed = await p.evaluate(() => document.querySelector('.video.film video')?.paused === false);
      check(`${tag}: Space pauses and plays, never skips`, paused.open && paused.paused === true && resumed, JSON.stringify(paused));
    }
    // Skip: the film closes and you are in, with the house's sound coming back.
    if (opts.hasTouch) await p.tap('.video.film button'); else await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    const inside = await p.evaluate(() => ({ film: !!document.querySelector('.video.film'), gate: document.querySelector('#gate').classList.contains('gone'), gain: __loft.houseGain, mode: __loft.mode }));
    check(`${tag}: skipping lets you in, sound back on`, !inside.film && inside.gate && inside.gain > 0.8 && inside.mode === 'walk', JSON.stringify(inside));
    const f2 = await p.evaluate(() => __loft.renderer.info.render.frame);
    await p.waitForTimeout(500);
    const drawing = await p.evaluate(f => __loft.renderer.info.render.frame > f, f2);
    check(`${tag}: the room draws again once it closes`, drawing);
    // The TV's menu has the film; it plays, and closing it leaves you where you were.
    await p.evaluate(() => __loft.act('tv'));
    await p.waitForSelector('text=Watch my film', { timeout: 10000 });
    await p.locator('.g-card', { hasText: 'Watch my film' }).locator('button').click();
    const tvPlayed = await playing(p);
    s = await state(p);
    check(`${tag}: plays from the TV, house silent`, tvPlayed && s && s.gain === 0 && s.label === 'Close', s && `gain ${s.gain}`);
    await p.click('.video.film button');
    await p.waitForTimeout(1200);
    const after = await p.evaluate(() => ({ film: !!document.querySelector('.video.film'), gain: __loft.houseGain, mode: __loft.mode, games: !!document.querySelector('.g-overlay') }));
    check(`${tag}: closing it from the TV leaves the room as it was`, !after.film && !after.games && after.gain > 0.8 && after.mode === 'walk', JSON.stringify(after));
    // With the house's sound off, the film starts muted.
    await p.click('#snd');
    await p.evaluate(() => { __loft.playFilm(); });
    await p.waitForSelector('.video.film');
    s = await state(p);
    check(`${tag}: with the sound off it starts muted`, s && s.muted === true);
    await p.evaluate(() => document.querySelector('.video.film button').click());
    await p.click('#snd');
    // The computer: typing film at the desk plays it, and Esc closes it without leaving the desk.
    if (!opts.hasTouch) {
      await p.evaluate(() => __loft.useDesk());
      await p.waitForTimeout(2200);
      await p.keyboard.type('film'); await p.keyboard.press('Enter');
      const deskPlayed = await playing(p);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(800);
      const d = await p.evaluate(() => ({ film: !!document.querySelector('.video.film'), mode: __loft.mode }));
      check(`${tag}: the film command plays it, Esc closes it and keeps the desk`, deskPlayed && !d.film && d.mode === 'desk', JSON.stringify(d));
    }
    check(`${tag}: no page errors`, !errs.length, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
}

async function other(name, type) {
  const b = await launch(type);
  const { ctx, p, errs } = await page(b, { viewport: { width: 1280, height: 800 } });
  await p.goto(BASE + '/?q=low');
  await p.waitForFunction(() => document.querySelector('#film.ready'), null, { timeout: 120000 });
  await p.click('#film');
  const played = await playing(p);
  const s = await state(p);
  check(`${name}: the film plays or says it cannot`, played || (s && s.note), played ? 'played' : s ? `note "${s.note}"` : 'no player');
  if (s) { await p.click('.video.film button'); await p.waitForTimeout(1000); }
  const gone = await p.evaluate(() => !document.querySelector('.video.film') && document.querySelector('#gate').classList.contains('gone'));
  check(`${name}: closing it lets you in`, gone);
  check(`${name}: no page errors`, !errs.length, errs.join(' | '));
  await ctx.close();
  await b.close();
}

(async () => {
  await chrome();
  await other('firefox', pw.firefox);
  await other('webkit', pw.webkit);
  console.log(rows.join('\n'));
  process.exit(rows.every(r => r.startsWith('PASS')) ? 0 : 1);
})().catch(e => { console.log(rows.join('\n')); console.error('FAILED', e.message); process.exit(1); });

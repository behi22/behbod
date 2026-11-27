// My story: offered at the door on any key, replayed from the TV and the computer. In Chrome on a desktop and a phone
// it plays the right cut filling the window with no player, keeps the house quiet, skips on a held Space or finger,
// keeps the loading line off the picture, ends at the door on the drawing (in, or watch again) and lets you in.
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
// How the open story sits on the screen: the picture drawn inside the video's box, the picture without its own black
// bars (the wide cut is 1920 by 804 inside 1920 by 1080), and where the loading line, BH-22 and the skip ring are.
const state = p => p.evaluate(() => {
  const box = document.querySelector('.video.film'), v = box?.querySelector('video');
  if (!box) return null;
  const r = v.getBoundingClientRect(), k = Math.min(r.width / (v.videoWidth || 1), r.height / (v.videoHeight || 1));
  const w = v.videoWidth * k, h = v.videoHeight * k, top = r.top + (r.height - h) / 2, bar = v.videoWidth > v.videoHeight ? h * 138 / 1080 : 0;
  const pic = { top: top + bar, bottom: top + h - bar }, skip = box.querySelector('.i-skip'), load = document.getElementById('loading');
  const rect = el => (el && !el.closest('[hidden]') && el.getClientRects().length ? el.getBoundingClientRect() : null);
  const off = el => { const q = rect(el); return !q || q.top >= pic.bottom - 1 || q.bottom <= pic.top + 1; };
  return { src: v.currentSrc || v.src, t: v.currentTime, muted: v.muted, controls: v.controls, note: box.querySelector('.film-note')?.textContent || '',
    fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, fill: Math.max(w / innerWidth, h / innerHeight),
    ratio: w / h, label: skip?.textContent || '', gain: window.__loft?.houseGain ?? null, scene: document.querySelector('.i-end') ? 'end' : 'film',
    clear: off(skip) && off(load.querySelector('.i-gauge')) && off(load.querySelector('.i-bh')) && off(load.querySelector('.say')), over: load.classList.contains('over'), loadShown: getComputedStyle(load).display !== 'none' };
});
const playing = p => p.waitForFunction(() => { const v = document.querySelector('.video.film video'); return v && v.currentTime > 1.5; }, null, { timeout: 30000 }).then(() => true, () => false);
const isOpen = p => p.evaluate(() => !!document.querySelector('.video.film'));
// A held finger (or mouse) on the story for 1.3 s, as a phone skips it.
const holdFinger = async p => {
  await p.evaluate(() => document.querySelector('.video.film').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await p.waitForTimeout(1300);
  await p.evaluate(() => dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
};
const inside = p => p.evaluate(() => ({ film: !!document.querySelector('.video.film'), gate: document.querySelector('#gate').classList.contains('gone'), gain: __loft.houseGain, mode: __loft.mode }));

async function chrome() {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  for (const [view, opts, cut] of VIEWS) {
    const { ctx, p, errs } = await page(b, opts);
    const tag = `chrome ${view}`;
    await p.goto(BASE + '/?q=low');
    // The door: the house drawn as it loads, the press, the loading line.
    const door = await p.evaluate(() => ({ press: document.querySelector('#film')?.textContent, paths: document.querySelectorAll('#gate .i-house path').length,
      gauge: !!document.querySelector('#loading .i-gauge .i-bh svg'), wide: document.documentElement.scrollWidth <= innerWidth }));
    check(`${tag}: the door draws the house, offers the story and shows the loading line`, door.press === (opts.hasTouch ? 'TAP TO START' : 'PRESS ANY KEY') && door.paths === 14 && door.gauge && door.wide, JSON.stringify(door));
    await p.waitForFunction(() => document.querySelector('#film.ready') && document.querySelector('#enter.ready') && document.querySelector('#enter').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
    if (opts.hasTouch) await p.tap('#film'); else await p.keyboard.press('k');
    const played = await playing(p);
    let s = await state(p);
    check(`${tag}: ${opts.hasTouch ? 'a tap' : 'any key'} plays the ${cut} cut at the door`, played && s && s.src.endsWith(`home-film-${cut}.mp4`), s && `${s.src.split('/').pop()} at ${s.t.toFixed(1)} s`);
    check(`${tag}: it fills the window, its shape kept, with no player`, s && s.fits && s.fill > 0.97 && Math.abs(s.ratio - (cut === 'wide' ? 16 / 9 : 9 / 16)) < 0.02 && !s.controls, s && `fill ${s.fill.toFixed(3)}, ratio ${s.ratio.toFixed(3)}`);
    check(`${tag}: the house is silent while it plays`, s && s.gain === 0, s && `gain ${s.gain}`);
    check(`${tag}: it says how to skip it`, s && s.label === (opts.hasTouch ? 'Hold to skip' : 'Hold SPACE to skip'), s && s.label);
    check(`${tag}: the loading line, BH-22 and the skip ring stay off the picture`, s && s.over && s.clear, JSON.stringify(s && { over: s.over, clear: s.clear }));
    // The room stops drawing while it plays.
    const f0 = await p.evaluate(() => __loft.renderer.info.render.frame);
    await p.waitForTimeout(1000);
    const f1 = await p.evaluate(() => __loft.renderer.info.render.frame);
    check(`${tag}: the room stops drawing behind the story`, f1 === f0, `${f1 - f0} frames in a second`);
    // A short press never skips; a held one does, and you are in with the house's sound back.
    if (opts.hasTouch) {
      await p.tap('.video.film');
      await p.waitForTimeout(400);
      check(`${tag}: a tap does not skip it`, await isOpen(p));
      await holdFinger(p);
    } else {
      await p.keyboard.press(' ');
      await p.waitForTimeout(400);
      check(`${tag}: a quick Space does not skip it`, await isOpen(p));
      await p.keyboard.down(' '); await p.waitForTimeout(1300); await p.keyboard.up(' ');
    }
    await p.waitForTimeout(1500);
    const inn = await inside(p);
    check(`${tag}: holding skips it and lets you in, sound back on`, !inn.film && inn.gate && inn.gain > 0.8 && inn.mode === 'walk', JSON.stringify(inn));
    // Regression: the faded door's buttons stayed clickable (and reachable by Tab) in the middle of the screen all visit.
    const doorAfter = await p.evaluate(() => [...document.querySelectorAll('#gate button')].map(b => {
      const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { id: b.id, hit: !!hit && !!hit.closest('#gate'), shown: getComputedStyle(b).visibility !== 'hidden' };
    }));
    const loadGone = await p.evaluate(() => getComputedStyle(document.getElementById('loading')).display === 'none');
    check(`${tag}: once inside, the door's buttons can no longer be pressed or reached, and the loading line is gone`, doorAfter.length === 2 && doorAfter.every(d => !d.hit && !d.shown) && loadGone, JSON.stringify(doorAfter));
    const f2 = await p.evaluate(() => __loft.renderer.info.render.frame);
    await p.waitForTimeout(500);
    check(`${tag}: the room draws again once it closes`, await p.evaluate(f => __loft.renderer.info.render.frame > f, f2));
    // The TV's menu has the story; it plays, and skipping it leaves you where you were.
    await p.evaluate(() => __loft.act('tv'));
    await p.locator('.g-card', { hasText: 'Watch my story' }).waitFor({ timeout: 10000 });
    await p.locator('.g-card', { hasText: 'Watch my story' }).locator('button').click();
    const tvPlayed = await playing(p);
    s = await state(p);
    check(`${tag}: plays from the TV, house silent, no loading line`, tvPlayed && s && s.gain === 0 && !s.loadShown, s && `gain ${s.gain}`);
    await holdFinger(p);
    await p.waitForTimeout(1200);
    const after = await p.evaluate(() => ({ film: !!document.querySelector('.video.film'), gain: __loft.houseGain, mode: __loft.mode, games: !!document.querySelector('.g-overlay') }));
    check(`${tag}: skipping it from the TV leaves the room as it was`, !after.film && !after.games && after.gain > 0.8 && after.mode === 'walk', JSON.stringify(after));
    // With the house's sound off, it starts muted.
    await p.click('#snd');
    await p.evaluate(() => { __loft.playFilm(); });
    await p.waitForSelector('.video.film');
    s = await state(p);
    check(`${tag}: with the sound off it starts muted`, s && s.muted === true);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    check(`${tag}: Esc closes it at once`, !(await isOpen(p)));
    await p.click('#snd');
    // The computer: story (and the old film) plays it, Esc closes it and keeps the desk; help lists story, not film.
    if (!opts.hasTouch) {
      await p.evaluate(() => __loft.useDesk());
      await p.waitForTimeout(2200);
      const runs = {};
      for (const word of ['story', 'film']) {
        await p.keyboard.type(word); await p.keyboard.press('Enter');
        runs[word] = await playing(p);
        await p.keyboard.press('Escape');
        await p.waitForTimeout(800);
      }
      const d = await p.evaluate(() => ({ film: !!document.querySelector('.video.film'), mode: __loft.mode }));
      await p.keyboard.type('help'); await p.keyboard.press('Enter');
      await p.waitForTimeout(300);
      const help = await p.evaluate(() => { const l = __loft.screens.desktop.term.lines; return l.slice(l.lastIndexOf('$ help') + 1).join(' '); });
      check(`${tag}: story and film play it, Esc closes it and keeps the desk`, runs.story && runs.film && !d.film && d.mode === 'desk', JSON.stringify({ runs, d }));
      check(`${tag}: help lists story and not film`, /\bstory\b/.test(help) && !/\bfilm\b/.test(help), help.slice(-200));
    }
    check(`${tag}: no page errors`, !errs.length, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
}

// The story's end at the door, and the story started before the house is ready.
async function ending() {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const { ctx, p, errs } = await page(b, { viewport: { width: 1280, height: 800 } });
  await p.goto(BASE + '/?q=low');
  await p.waitForSelector('#film');
  // Any key plays it at once, the house still loading behind it.
  await p.keyboard.press('k');
  const early = await playing(p);
  const notYet = await p.evaluate(() => document.querySelector('#enter').getAttribute('aria-disabled') === 'true' && !window.__loft);
  check('ending: any key plays the story before the house is ready', early && notYet, JSON.stringify({ early, notYet }));
  // Skipped before the house is ready: back to the door (no ending), and in by itself once home is ready.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  const back = await p.evaluate(() => ({ film: !!document.querySelector('.video.film'), end: !!document.querySelector('.i-end'), going: document.getElementById('gate').classList.contains('going'),
    prompt: getComputedStyle(document.querySelector('.i-prompt')).visibility }));
  const by = await p.waitForFunction(() => window.__loft && document.getElementById('gate').classList.contains('gone'), null, { timeout: 90000 }).then(() => true, () => false);
  await p.waitForTimeout(1500);
  const afterSkip = await inside(p);
  check('ending: skipped before home is ready, back to the door with no ending, then in by itself, sound on', !back.film && !back.end && back.going && back.prompt === 'hidden' && by && afterSkip.gain > 0.8 && afterSkip.mode === 'walk', JSON.stringify({ back, afterSkip }));
  // Watched to its end (on a fresh visit, home ready): the ending, Watch again plays it from the start.
  await p.goto(BASE + '/?q=low');
  await p.waitForFunction(() => document.querySelector('#enter.ready') && document.querySelector('#enter').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  await p.mouse.click(640, 120);
  const clicked = await playing(p);
  check('ending: a click anywhere on the door plays the story', clicked);
  await p.evaluate(() => { const v = document.querySelector('.video.film video'); v.currentTime = v.duration - 0.4; });
  await p.waitForSelector('.i-end', { timeout: 5000 });
  await p.waitForTimeout(4200);
  await p.click('.i-end [data-go="again"]');
  const again = await playing(p);
  const gone = await p.evaluate(() => !document.querySelector('.i-end'));
  check('ending: Watch again plays it from the start', again && gone);
  await p.evaluate(() => { const v = document.querySelector('.video.film video'); v.currentTime = v.duration - 0.4; });
  await p.waitForSelector('.i-end', { timeout: 5000 });
  // The buttons rise in from 3.7 s, over 0.7 s.
  await p.waitForTimeout(5200);
  const end = await p.evaluate(() => {
    const e = document.querySelector('.i-end'), shown = el => el && getComputedStyle(el).opacity > 0.9;
    return { title: e.querySelector('h2')?.textContent, name: e.querySelector('.i-name p')?.textContent, buttons: [...e.querySelectorAll('button')].map(x => x.textContent.trim()),
      words: shown(e.querySelector('.i-name')), row: shown(e.querySelector('.i-row')), door: shown(e.querySelector('.i-door')), bh: e.querySelector('.i-endbh').classList.contains('there'),
      loading: getComputedStyle(document.getElementById('loading')).display === 'none', skip: getComputedStyle(document.querySelector('.i-skip')).display === 'none', house: e.querySelectorAll('.i-house path').length };
  });
  check('ending: the drawing, BH-22 at the door, the door lit, Welcome Home, Enter and Watch again; the loading line gone',
    end.title === 'Welcome Home' && end.name === 'BEHBOD BABAI' && end.buttons.join('|') === 'Enter ENTER|Watch again R' && end.words && end.row && end.door && end.bh && end.loading && end.skip && end.house === 14, JSON.stringify(end));
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
  const inn = await inside(p);
  check('ending: Enter goes in, sound back on', !inn.film && inn.gate && inn.gain > 0.8 && inn.mode === 'walk', JSON.stringify(inn));
  check('ending: no page errors', !errs.length, errs.join(' | '));
  await ctx.close();
  await b.close();
}

async function other(name, type) {
  const b = await launch(type);
  const { ctx, p, errs } = await page(b, { viewport: { width: 1280, height: 800 } });
  await p.goto(BASE + '/?q=low');
  await p.waitForFunction(() => document.querySelector('#enter.ready') && document.querySelector('#enter').getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  await p.click('#film');
  const played = await playing(p);
  const s = await state(p);
  check(`${name}: the story plays or says it cannot`, played || (s && s.note), played ? 'played' : s ? `note "${s.note}"` : 'no player');
  if (await isOpen(p)) { await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
  if (await p.evaluate(() => !!document.querySelector('.i-end [data-go="in"]'))) await p.click('.i-end [data-go="in"]');
  await p.waitForTimeout(1000);
  const gone = await p.evaluate(() => !document.querySelector('.video.film') && document.querySelector('#gate').classList.contains('gone'));
  check(`${name}: closing it lets you in`, gone);
  check(`${name}: no page errors`, !errs.length, errs.join(' | '));
  await ctx.close();
  await b.close();
}

(async () => {
  await chrome();
  await ending();
  await other('firefox', pw.firefox);
  await other('webkit', pw.webkit);
  console.log(rows.join('\n'));
  process.exit(rows.every(r => r.startsWith('PASS')) ? 0 : 1);
})().catch(e => { console.log(rows.join('\n')); console.error('FAILED', e.message); process.exit(1); });

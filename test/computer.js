// The computer's browser and Games app in a real Chrome, at a desk and on a phone.
// The browser: a hostile page is put in place of an approved site and tries every way out of its frame (pop-ups,
// steering the house, forms, downloads, dialogs, leaving the list, plain http, the house's own address, cookies,
// camera, microphone, location, fullscreen, the clipboard), and each must be blocked. Where a lock is what stops a
// try, a control frame without that lock (and granted the features) runs the same try and must get through, so a
// check that could never have failed counts for nothing. Then the real sites, on the real network.
// The games: the launcher, each game played with the mouse, the keys and a finger, pause, the end, best scores.
//   LOFT_URL=http://127.0.0.1:8814 node test/computer.js [outdir]
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { launch } = require('./quiet');
const OUT = process.argv[2] || 'test-output';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.LOFT_URL || 'http://127.0.0.1:8810';
const URL = BASE + '/?auto&q=low';
const results = [], errs = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(name + ':', detail, ok ? 'PASS' : 'FAIL'); };
const wait = ms => new Promise(r => setTimeout(r, ms));

// The hostile page. It runs its tries as it loads and keeps the answers on window.__probe; the clicks are made by
// the test (as a person would, with a real click) on the links and buttons it carries.
const HOSTILE = who => `<!doctype html><meta charset="utf-8"><title>probe ${who}</title><body style="font:16px sans-serif">
<p>probe ${who}</p>
<form id="f" method="post" action="/post-${who}"><input name="a" value="1"><button id="send">send</button></form>
<p><a id="blank" href="https://en.wikipedia.org/blank-${who}" target="_blank">new window</a></p>
<p><a id="top" href="https://example.com/top-${who}" target="_top">take over the house</a></p>
<p><a id="dl" href="/file-${who}.bin" download="x.bin">download</a></p>
<script>
window.__probe = (async () => {
  const r = {};
  const t = async (name, fn) => { try { r[name] = await fn(); } catch (e) { r[name] = 'blocked ' + ((e && e.name) || e); } };
  await t('popup', () => (window.open('https://en.wikipedia.org/pop-${who}') ? 'opened' : 'null'));
  await t('parent', () => typeof parent.document.body);
  await t('topRead', () => top.location.href);
  await t('alert', () => { alert('${who}'); return 'returned'; });
  await t('cookieSeen', () => document.cookie || '(none)');
  await t('features', () => ['autoplay', 'picture-in-picture', 'camera', 'microphone', 'geolocation', 'fullscreen', 'payment', 'usb', 'display-capture', 'clipboard-read'].filter(f => document.featurePolicy && document.featurePolicy.allowsFeature(f)).join(',') || 'none');
  await t('mic', () => navigator.mediaDevices.getUserMedia({ audio: true }).then(() => 'granted'));
  await t('geo', () => new Promise(res => navigator.geolocation.getCurrentPosition(() => res('granted'), e => res('denied ' + e.code), { timeout: 2000 })));
  await t('fullscreen', () => document.documentElement.requestFullscreen().then(() => 'granted'));
  await t('clipboard', () => navigator.clipboard.readText().then(() => 'granted'));
  return r;
})();
</script></body>`;

(async () => {
  const b = await launch(pw.chromium, { channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  // Messages from inside a shown site are that site's, not the house's. While the escapes are tried, the browser's
  // own notes that it blocked them are expected; Wikipedia's report-only rule about being framed is Wikipedia's.
  let trying = false;
  const expected = t => /violates the following report-only Content Security Policy directive: "frame-ancestors/.test(t)
    || (trying && /^Unsafe attempt to initiate navigation|^Framing '.*' violates the following Content Security Policy directive: "frame-src/.test(t));
  const watch = (p, tag) => {
    p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    p.on('console', m => { const at = m.location()?.url || ''; if (m.type() === 'error' && !/favicon/.test(m.text()) && !expected(m.text()) && (!at || at.startsWith(BASE))) errs.push(`${tag}: ${m.text().slice(0, 160)} @ ${at.slice(0, 80)}`); });
  };
  // The welcome gate, faded out, still holds its Enter button at the middle of the screen (requested from the lead).
  // It is reported, then put out of the way so the checks below test the computer.
  const gate = async (p, tag) => {
    const hit = await p.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return e ? (e.id || e.className || e.tagName) : null; });
    console.log(`  ${tag}: at the middle of the screen: ${hit}${hit === 'enter' ? ' (KNOWN: the Enter button of the faded gate, requested from the lead)' : ''}`);
    await p.evaluate(() => { document.getElementById('gate').style.display = 'none'; });
  };

  // ---------- the desk, 1280 by 800 ----------
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  watch(p, 'desk');
  const seen = [], opened = [], downloads = [], dialogs = [];
  ctx.on('page', q => opened.push(q));
  const popups = { some: f => opened.some(q => f(q.url())) };
  p.on('download', d => downloads.push(d.url()));
  p.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await ctx.addCookies([{ name: 'house_probe', value: '1', domain: 'en.wikipedia.org', path: '/', secure: true, sameSite: 'None' }]);
  await ctx.route(/^https:\/\/en\.wikipedia\.org\//, r => {
    const q = r.request(), u = new globalThis.URL(q.url());
    seen.push({ url: q.url(), method: q.method(), cookie: q.headers().cookie || '' });
    const who = u.pathname.endsWith('Control') ? 'control' : 'ours';
    if (/^\/wiki\/(Vancouver|Control)$/.test(u.pathname)) return r.fulfill({ contentType: 'text/html', body: HOSTILE(who) });
    if (u.pathname.startsWith('/file-')) return r.fulfill({ contentType: 'application/octet-stream', headers: { 'content-disposition': 'attachment; filename=x.bin' }, body: 'x' });
    return r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>reached</title>reached' });
  });
  for (const other of [/^https?:\/\/example\.com\//, /^http:\/\/en\.wikipedia\.org\//, /^https:\/\/behi22\.github\.io\//])
    await ctx.route(other, r => { seen.push({ url: r.request().url(), method: r.request().method(), cookie: '' }); r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>reached</title>reached' }); });
  const reached = re => seen.filter(s => re.test(s.url));

  await p.goto(URL);
  await p.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await p.waitForTimeout(1000);
  await p.evaluate(() => __loft.useDesk());
  await p.waitForFunction(() => document.querySelector('.dt.on'), null, { timeout: 15000 });
  await p.waitForTimeout(600);
  await gate(p, 'desk');
  const dockNames = await p.evaluate(() => [...document.querySelectorAll('.dt-icon')].map(b => b.title));
  check('the dock has the browser and the games', dockNames.includes('Browser') && dockNames.includes('Games') && dockNames.length === 9, dockNames.join(' '));

  // Where a point inside the desktop (desktop pixels from its top left) is on the screen, through its transform.
  const onScreen = (x, y) => p.evaluate(([x, y]) => { const r = document.querySelector('.dt'), m = new DOMMatrix(getComputedStyle(r).transform), q = m.transformPoint(new DOMPoint(x, y)); return [q.x / q.w, q.y / q.w]; }, [x, y]);

  // ---------- the browser ----------
  await p.click('.dt-icon[aria-label="Open Browser"]');
  await p.waitForSelector('.dt-frame iframe', { timeout: 5000 });
  const attrs = await p.evaluate(() => { const f = document.querySelector('.dt-frame iframe'); return { sandbox: f.getAttribute('sandbox'), allow: f.getAttribute('allow'), cred: f.hasAttribute('credentialless'), credOn: f.credentialless === true, ref: f.getAttribute('referrerpolicy'), src: f.src }; });
  check('the frame is locked down', attrs.sandbox === 'allow-scripts allow-same-origin' && /camera 'none'/.test(attrs.allow) && /microphone 'none'/.test(attrs.allow) && attrs.cred && attrs.ref === 'no-referrer' && attrs.src === 'https://en.wikipedia.org/wiki/Vancouver',
    `sandbox "${attrs.sandbox}", credentialless ${attrs.cred} (supported here: ${attrs.credOn}), referrer ${attrs.ref}`);
  // The browser's frame, found by its element (never by its address, which the tries below change).
  const ourFrame = async () => { for (let i = 0; i < 50; i++) { const h = await p.$('.dt-frame iframe'), f = h && await h.contentFrame(); if (f) return f; await wait(100); } return null; };
  const probeOf = async f => { await f.waitForFunction(() => window.__probe, null, { timeout: 10000 }); return f.evaluate(() => window.__probe); };
  let ours = await ourFrame();
  trying = true;
  const probe = await probeOf(ours);
  // The control: the same page in a frame with none of the locks, and handed the features the browser's frame is
  // refused (the house's own rule still applies to it).
  await p.evaluate(() => { const f = document.createElement('iframe'); f.id = 'control'; f.allow = 'camera; microphone; geolocation; fullscreen; payment; usb; display-capture; clipboard-read; autoplay'; f.src = 'https://en.wikipedia.org/wiki/Control'; f.style.cssText = 'position:fixed;left:0;bottom:0;width:300px;height:200px;z-index:99'; document.body.append(f); });
  const control = await (await p.waitForSelector('#control')).contentFrame();
  const cprobe = await probeOf(control);
  await p.waitForTimeout(400);
  console.log('  ours   ', JSON.stringify(probe));
  console.log('  control', JSON.stringify(cprobe));

  check('no pop-up opens from the page', probe.popup === 'null' && !popups.some(u => /pop-ours/.test(u)), `ours ${probe.popup}; control ${cprobe.popup} (${popups.some(u => /pop-control/.test(u)) ? 'it did open' : 'NOT seen: the check is blind'})`);
  // This one holds for any other site's page (the control too); it would not for the house's own, which is refused.
  check('the page cannot reach into the house (it is another site)', /blocked/.test(probe.parent) && /blocked/.test(probe.topRead), `${probe.parent}, ${probe.topRead}`);
  check('no dialogs', !dialogs.includes('ours') && dialogs.includes('control'), `dialogs seen: ${JSON.stringify(dialogs)}`);
  // Cookies, reading only: interception muddles what is sent and stored, so that is checked on the real network below.
  check('the page cannot read the visitor\'s cookies', probe.cookieSeen === '(none)' && cprobe.cookieSeen === 'house_probe=1', `ours reads ${probe.cookieSeen}, the control reads ${cprobe.cookieSeen}`);
  const feats = probe.features === 'none' ? [] : probe.features.split(',');
  const cfeats = cprobe.features.split(',');
  check('camera, microphone, location and the rest are refused', !feats.length && ['camera', 'microphone', 'geolocation', 'fullscreen', 'clipboard-read', 'picture-in-picture'].every(f => cfeats.includes(f)) && /blocked|denied/.test(probe.mic) && /denied|blocked/.test(probe.geo) && /blocked/.test(probe.fullscreen) && /blocked/.test(probe.clipboard),
    `ours granted: ${probe.features}; the control granted: ${cprobe.features}; ours asked: mic ${probe.mic}, geo ${probe.geo}, fullscreen ${probe.fullscreen}, clipboard ${probe.clipboard}`);

  // Clicks, made as a person makes them. Each try that can change the page gets a fresh one.
  const fresh = async () => {
    const old = await p.$('.dt-frame iframe');
    await p.click('.dt-win[data-app="browser"] .dt-pill:text-is("Wikipedia")');
    await p.waitForFunction(o => { const f = document.querySelector('.dt-frame iframe'); return f && f !== o; }, old, { timeout: 10000 });
    ours = await ourFrame(); await probeOf(ours);
  };
  const tryClick = async (frame, sel) => { try { await frame.click(sel, { timeout: 3000 }); return 'clicked'; } catch (e) { return 'click failed: ' + e.message.split('\n')[0]; } };
  const c1 = await tryClick(ours, '#blank'), c1c = await tryClick(control, '#blank'); await p.waitForTimeout(800);
  check('a link that opens a new window does nothing', c1 === 'clicked' && !popups.some(u => /blank-ours/.test(u)) && popups.some(u => /blank-control/.test(u)), `${c1}; control ${c1c}, ${popups.some(u => /blank-control/.test(u)) ? 'opened one' : 'did not (blind)'}`);
  const pageUrl = p.url();
  const c2 = await tryClick(ours, '#top'); await p.waitForTimeout(800);
  check('a link cannot take over the house', c2 === 'clicked' && p.url() === pageUrl && !reached(/top-ours/).length, `${c2}; house still at ${p.url().replace(BASE, '')}`);
  await fresh();
  const c3 = await tryClick(ours, '#dl'), c3c = await tryClick(control, '#dl'); await p.waitForTimeout(800);
  check('no downloads', c3 === 'clicked' && !downloads.some(u => /file-ours/.test(u)) && downloads.some(u => /file-control/.test(u)), `${c3}; control ${c3c}, ${downloads.some(u => /file-control/.test(u)) ? 'downloaded' : 'did not (blind)'}`);
  await fresh();
  const c4 = await tryClick(ours, '#send'), c4c = await tryClick(control, '#send'); await p.waitForTimeout(800);
  check('no forms', c4 === 'clicked' && !reached(/post-ours/).length && reached(/post-control/).length === 1, `${c4}; control ${c4c}, ${reached(/post-control/).length ? 'posted' : 'did not (blind)'}`);
  await p.evaluate(() => document.getElementById('control')?.remove());
  // Leaving the list from inside the page: another address, plain http, the house itself, a data page.
  const leave = async (to, re) => {
    await fresh();
    await ours.evaluate(u => { setTimeout(() => { location.href = u; }, 0); }, to).catch(() => {});
    await p.waitForTimeout(1000);
    const f = await ourFrame();
    return { reached: re ? reached(re).length : 0, url: f ? f.url() : '(none)' };
  };
  const l1 = await leave('https://example.com/away', /example\.com\/away/);
  const l2 = await leave('http://en.wikipedia.org/plain', /^http:\/\/en\.wikipedia\.org\/plain/);
  const l3 = await leave(BASE + '/', null);
  const l4 = await leave('data:text/html,<b>hi</b>', null);
  const l5 = await leave('https://behi22.github.io/meet-bex/', /behi22\.github\.io\/meet-bex/);
  check('the page cannot leave the list', !l1.reached && !l2.reached && [l1, l2, l3, l4].every(l => !/^(https?:\/\/(example|en\.wikipedia\.org\/plain)|data:)/.test(l.url) && !l.url.startsWith(BASE)),
    `other site ${l1.url}, plain http ${l2.url}, the house ${l3.url}, data ${l4.url.slice(0, 30)}`);
  check('while a listed site still opens from inside it (the check can see a page arrive)', l5.reached === 1 && l5.url === 'https://behi22.github.io/meet-bex/', l5.url);
  for (const q of ctx.pages()) if (q !== p) await q.close();
  await p.bringToFront();
  trying = false;

  // The note and the way out for a page that will not show here.
  await fresh();
  const foot = await p.evaluate(() => [...document.querySelectorAll('.dt-win[data-app="browser"] .dt-t')].map(e => e.textContent));
  const [tab] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), p.click('.dt-win[data-app="browser"] .dt-pill:text-is("Open in a new tab")')]);
  if (tab) await tab.waitForURL(/^https:/, { timeout: 10000 }).catch(() => {});
  check('a note, and a button that opens the site in a tab of its own', foot.includes('page blank or blocked?') && tab && tab.url() === 'https://en.wikipedia.org/wiki/Vancouver', `${foot.join(' | ')} -> ${tab ? tab.url() : 'no tab'}`);
  if (tab) await tab.close();
  await p.bringToFront();

  // Clicking into the page brings the browser to the front; clicking the desktop gives the keyboard back.
  // The terminal in front covers the browser's left side; its right side still shows.
  await p.click('.dt-icon[aria-label="Open Terminal"]'); await p.waitForTimeout(250);
  const fb = await p.locator('.dt-frame').boundingBox();
  await p.mouse.click(fb.x + fb.width * 0.88, fb.y + fb.height / 2); await p.waitForTimeout(400);
  const front = await p.evaluate(() => [__loft.screens.desktop.st.focus, document.activeElement?.tagName]);
  await p.click('.dt-win[data-app="browser"] .dt-title span'); await p.waitForTimeout(150);
  await p.keyboard.type('whoami'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const typed = await p.evaluate(() => __loft.screens.desktop.term.lines.includes('$ whoami'));
  check('a click in the page fronts the browser; a click on the desktop takes the keyboard back', front[0] === 'browser' && front[1] === 'IFRAME' && typed, `${front.join(' ')}, typed into the terminal ${typed}`);

  // Switching sites changes the page; closing the window lets it go.
  const state = () => p.evaluate(() => JSON.stringify({ focus: __loft.screens.desktop.st.focus, site: __loft.screens.desktop.browser.site }));
  await p.click('.dt-icon[aria-label="Open Browser"]'); await p.waitForTimeout(200);
  await p.click('.dt-win[data-app="browser"] .dt-pill:text-is("Profile art")');
  await p.waitForFunction(() => document.querySelector('.dt-frame iframe')?.src === 'https://behi22.github.io/profile-art/', null, { timeout: 5000 }).catch(() => {});
  const switched = await p.evaluate(() => [document.querySelector('.dt-frame iframe')?.src, document.querySelectorAll('.dt-frame iframe').length, document.querySelector('.dt-win[data-app="browser"] .dt-pill.on')?.textContent]);
  check('the site buttons switch the page', switched[0] === 'https://behi22.github.io/profile-art/' && switched[1] === 1 && switched[2] === 'Profile art', switched.join(' | ') + ' ' + await state());
  // While a window is dragged the page cannot take the pointer (a drag let go over it must still end on the desktop).
  await p.click('.dt-icon[aria-label="Open Terminal"]');
  await p.waitForSelector('.dt-win.focus[data-app="terminal"]'); await p.waitForTimeout(100);
  const tt = await p.locator('.dt-win.focus[data-app="terminal"] .dt-title span').boundingBox();
  await p.mouse.move(tt.x + tt.width + 40, tt.y + tt.height / 2); await p.mouse.down();
  await p.mouse.move(tt.x + tt.width + 120, tt.y + tt.height / 2 + 30, { steps: 4 });
  const during = await p.evaluate(() => getComputedStyle(document.querySelector('.dt-frame')).pointerEvents);
  await p.mouse.up();
  const afterDrag = await p.evaluate(() => getComputedStyle(document.querySelector('.dt-frame')).pointerEvents);
  await p.click('.dt-icon[aria-label="Open Calculator"]');
  const redrawn = await p.waitForSelector('.dt-win.focus[data-app="calc"]', { timeout: 3000 }).then(() => true, () => false);
  check('a window dragged over the page: the page lets the pointer through, and the desktop keeps drawing', during === 'none' && afterDrag === 'auto' && redrawn, `during ${during}, after ${afterDrag}, redrawn ${redrawn}`);
  await p.click('.dt-icon[aria-label="Open Browser"]');
  await p.click('.dt-win[data-app="browser"] .dt-dot[aria-label="Close Browser"]');
  await p.waitForFunction(() => !document.querySelector('iframe[sandbox]'), null, { timeout: 5000 }).catch(() => {});
  const closed = await p.evaluate(() => document.querySelectorAll('iframe[sandbox]').length);
  check('closing the browser lets the page go', closed === 0, `${closed} frames left ${await state()}`);
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });

  // The real sites, as they are today (needs the internet). The visitor's cookie for Wikipedia is still in this
  // browser: the request that really goes out for the page must not carry it.
  await ctx.clearCookies();
  await ctx.addCookies([{ name: 'house_probe', value: '1', domain: 'en.wikipedia.org', path: '/', secure: true, sameSite: 'None' }]);
  const sent = [];
  p.on('request', q => { if (q.resourceType() === 'document' && q.frame() !== p.mainFrame()) q.allHeaders().then(h => sent.push([q.url(), h.cookie || ''])).catch(() => {}); });
  const fps = async () => { const f0 = await p.evaluate(() => __loft.renderer.info.render.frame); await p.waitForTimeout(1500); return Math.round(((await p.evaluate(() => __loft.renderer.info.render.frame)) - f0) / 1.5); };
  const bare = await fps();
  await p.click('.dt-icon[aria-label="Open Browser"]');
  await p.waitForSelector('.dt-win[data-app="browser"]');
  const real = [];
  for (const [label, url] of [['Wikipedia', 'https://en.wikipedia.org/wiki/Vancouver'], ['Meet Bex', 'https://behi22.github.io/meet-bex/'], ['Profile art', 'https://behi22.github.io/profile-art/'], ['Voice microsite', 'https://aic-voice-microsite.vercel.app/']]) {
    const old = await p.$('.dt-frame iframe');
    await p.click(`.dt-win[data-app="browser"] .dt-pill:text-is("${label}")`);
    await p.waitForFunction(([o, u]) => { const f = document.querySelector('.dt-frame iframe'); return f && f !== o && f.src === u; }, [old, url], { timeout: 5000 }).catch(() => {});
    let title = null;
    for (let i = 0; i < 40 && title === null; i++) {
      await p.waitForTimeout(250);
      const f = await ourFrame();
      if (f && f.url().startsWith(url)) title = await f.evaluate(() => (document.readyState !== 'loading' && document.title) || null).catch(() => null);
    }
    await p.waitForTimeout(1000);
    real.push(`${label}: ${title === null ? 'not reached' : JSON.stringify(title.slice(0, 40))} at ${await fps()} fps`);
    if (label === 'Wikipedia') await p.screenshot({ path: `${OUT}/c-browser.png` });
  }
  console.log(`  real sites (the house alone: ${bare} fps):`, real.join(' | '));
  check('the real sites show inside the house', real.every(r => !/not reached/.test(r)), real.filter(r => /not reached/.test(r)).join(', ') || 'all four');
  const wiki = sent.find(([u]) => u === 'https://en.wikipedia.org/wiki/Vancouver');
  // What the visitor's own browser sends when they then visit Wikipedia themselves: any cookie the shown page left
  // behind would go with it. Once after the four sites, once after a plain frame of Wikipedia (which must leave some).
  const visit = async () => {
    const q = await ctx.newPage(), heard = [];
    q.on('request', r => { if (r.isNavigationRequest()) r.allHeaders().then(h => heard.push(h.cookie || '')).catch(() => {}); });
    await q.goto('https://en.wikipedia.org/wiki/Special:BlankPage', { waitUntil: 'commit', timeout: 15000 }).catch(() => {});
    await q.waitForTimeout(500); await q.close(); await p.bringToFront();
    return (heard[0] || '').split(/;\s*/).map(c => c.split('=')[0]).filter(Boolean).sort().join(' ');
  };
  const after = await visit();
  // That visit leaves Wikipedia's own cookies; cleared, so what follows is the plain frame's alone.
  await ctx.clearCookies();
  await ctx.addCookies([{ name: 'house_probe', value: '1', domain: 'en.wikipedia.org', path: '/', secure: true, sameSite: 'None' }]);
  await p.evaluate(() => { const f = document.createElement('iframe'); f.id = 'control'; f.src = 'https://en.wikipedia.org/wiki/Canada'; f.style.cssText = 'position:fixed;left:0;bottom:0;width:300px;height:200px;z-index:99'; document.body.append(f); });
  await p.waitForTimeout(4000);
  const ctlSent = sent.find(([u]) => u === 'https://en.wikipedia.org/wiki/Canada');
  await p.evaluate(() => document.getElementById('control')?.remove());
  const afterControl = await visit();
  check('the real request for the page carries none of the visitor\'s cookies', wiki && !wiki[1] && ctlSent && /house_probe/.test(ctlSent[1]), `ours ${wiki ? JSON.stringify(wiki[1]) : 'no request seen'}, the control ${ctlSent ? JSON.stringify(ctlSent[1]) : 'no request seen'}`);
  check('the shown sites leave no cookies with the visitor', after === 'house_probe' && afterControl !== 'house_probe', `the visitor's next visit sends: ${after}; after a plain frame it would send: ${afterControl}`);
  const settled = await fps();
  check('the house is drawing at full speed again before the games', settled > 20, `${settled} fps`);

  // ---------- the games ----------
  await p.click('.dt-icon[aria-label="Open Games"]');
  await p.waitForSelector('.dt-win[data-app="games"] .dt-card', { timeout: 5000 }).catch(() => {});
  const launcher = await p.evaluate(() => {
    const w = document.querySelector('.dt-win[data-app="games"]');
    const pics = [...w.querySelectorAll('canvas.dt-pic')].map(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; return lit; });
    return { cards: w.querySelectorAll('.dt-card').length, buttons: [...w.querySelectorAll('.dt-pill')].map(b => b.textContent), pics };
  });
  check('the games launcher: three cards, their pictures and buttons', launcher.cards === 3 && launcher.pics.length === 3 && launcher.pics.every(n => n > 50) && launcher.buttons.join() === 'Easy,Normal,Hard,Play,Play', `${launcher.buttons.join(' ')}, lit pixels ${launcher.pics.join(' ')}`);
  await p.screenshot({ path: `${OUT}/c-launcher.png` });

  // Where a point of the game is on the screen.
  const gameToScreen = async (gx, gy) => {
    const at = await p.evaluate(([gx, gy]) => {
      const c = document.querySelector('canvas.dt-game'), w = c.closest('.dt-win'), id = __loft.screens.desktop.games.playing.id;
      const [gw, gh] = { paddle: [720, 420], orbit: [420, 420], bughunt: [720, 420] }[id], bw = c.offsetWidth, bh = c.offsetHeight, k = Math.min(bw / gw, bh / gh);
      return [w.offsetLeft + c.offsetLeft + (bw - gw * k) / 2 + gx * k, w.offsetTop - w.scrollTop + c.offsetTop + (bh - gh * k) / 2 + gy * k];
    }, [gx, gy]);
    return onScreen(...at);
  };
  const G = fn => p.evaluate(fn);
  await p.click('.dt-win[data-app="games"] .dt-pill:text-is("Normal")'); await p.waitForSelector('canvas.dt-game'); await p.waitForTimeout(1400);
  const duel = await G(() => { const g = __loft.screens.desktop.games.playing; return [g.id, g.level, g.st.wait, Math.hypot(g.st.ball.vx, g.st.ball.vy)]; });
  const [mx, my] = await gameToScreen(150, 300);
  await p.mouse.move(mx, my, { steps: 4 }); await p.waitForTimeout(700);
  const follow = await G(() => __loft.screens.desktop.games.playing.st.you);
  check('Paddle Duel starts and the paddle follows the mouse exactly', duel[0] === 'paddle' && duel[1] === 'normal' && duel[2] === 0 && duel[3] > 0 && Math.abs(follow - 150) < 3, `level ${duel[1]}, paddle at ${follow.toFixed(1)} for a mouse at 150`);
  await p.screenshot({ path: `${OUT}/c-paddle.png` });
  const [ox, oy] = await onScreen(10, 300);
  await p.mouse.move(ox, oy); // off the game, onto the desktop
  await G(() => { __loft.screens.desktop.games.playing.st.you = 360; });
  await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(400); await p.keyboard.up('ArrowLeft');
  await p.keyboard.type('ad w', { delay: 30 });
  const keyed = await G(() => [__loft.screens.desktop.games.playing.st.you, JSON.stringify(__loft.screens.desktop.term.input), __loft.mode]);
  await p.keyboard.press('KeyP'); await p.waitForTimeout(150);
  const paused = await G(() => [__loft.screens.desktop.games.playing.paused, document.querySelector('.dt-win[data-app="games"] .dt-pill.on')?.textContent]);
  await p.keyboard.press('KeyP'); await p.waitForTimeout(150);
  const unpaused = await G(() => __loft.screens.desktop.games.playing.paused);
  check('the keys steer and pause, and none of them types into the terminal', keyed[0] < 300 && keyed[1] === '""' && keyed[2] === 'desk' && paused[0] === true && paused[1] === 'Go on' && unpaused === false, `paddle ${keyed[0].toFixed(0)} after left, terminal ${keyed[1]}, paused ${paused.join(' ')}, then ${unpaused}`);
  // The end of a duel: the computer one point from winning, and my paddle far from the ball.
  await G(() => { const st = __loft.screens.desktop.games.playing.st; Object.assign(st, { wait: 0, you: 650, score: { you: 1, ai: 4 } }); Object.assign(st.ball, { x: 60, y: 300, vx: 0, vy: 500 }); });
  await p.mouse.move(ox, oy);
  await p.waitForFunction(() => __loft.screens.desktop.games.playing.done, null, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(300);
  const over = await G(() => [__loft.screens.desktop.games.playing.note, [...document.querySelectorAll('.dt-win[data-app="games"] .dt-pill')].map(b => b.textContent).join(' ')]);
  await p.click('.dt-win[data-app="games"] .dt-pill:text-is("Again")'); await p.waitForFunction(() => !__loft.screens.desktop.games.playing.done, null, { timeout: 5000 }).catch(() => {});
  const again = await G(() => [__loft.screens.desktop.games.playing.done, __loft.screens.desktop.games.playing.st.score.ai, __loft.screens.desktop.games.playing.level]);
  check('a duel ends, says who won, and starts again at the same level', over[0] === 'The computer wins' && /Again/.test(over[1]) && again[0] === false && again[1] === 0 && again[2] === 'normal', `${over.join(' | ')} -> ${again.join(' ')}`);

  // Bug Hunt: a click lands on the bug under it.
  await p.click('.dt-win[data-app="games"] .dt-pill:text-is("← Games")'); await p.waitForTimeout(200);
  await p.waitForSelector('.dt-card');
  await p.click('.dt-win[data-app="games"] .dt-pill:text-is("Play") >> nth=1'); await p.waitForSelector('canvas.dt-game'); await p.waitForTimeout(1600);
  const bug = await G(() => { const st = __loft.screens.desktop.games.playing.st; const b = st.bugs.find(b => b.kind !== 'friend' && b.x > 60 && b.x < 660 && b.y > 60 && b.y < 360) || (st.bugs.push({ id: 999, kind: 'bug', x: 300, y: 200, vx: 0, vy: 0, born: st.t, turn: 99 }), st.bugs.at(-1)); b.vx = b.vy = 0; b.turn = 99; return [__loft.screens.desktop.games.playing.id, b.x, b.y, st.squashed]; });
  const [bx, by] = await gameToScreen(bug[1], bug[2]);
  await p.mouse.click(bx, by); await p.waitForTimeout(150);
  const squashed = await G(() => __loft.screens.desktop.games.playing.st.squashed);
  check('Bug Hunt: a click squashes the bug under it', bug[0] === 'bughunt' && squashed === bug[3] + 1, `${bug[0]}, squashed ${bug[3]} -> ${squashed}`);
  await p.screenshot({ path: `${OUT}/c-bughunt.png` });
  // Its clock run down: the end says so, the score is a new best, and the launcher shows it.
  await G(() => { __loft.screens.desktop.games.playing.st.t = 44.95; });
  await p.waitForFunction(() => __loft.screens.desktop.games.playing.done, null, { timeout: 3000 }).catch(() => {});
  const huntEnd = await G(() => { const g = __loft.screens.desktop.games; return [g.playing.note, g.playing.record, g.playing.st.score, localStorage.getItem('home.games')]; });
  await p.click('.dt-win[data-app="games"] .dt-pill:text-is("← Games")'); await p.waitForTimeout(200);
  await p.waitForSelector('.dt-card');
  const shownBest = await G(() => [...document.querySelectorAll('.dt-win[data-app="games"] .dt-t')].map(e => e.textContent).filter(s => /^best score|^no best/.test(s)));
  check('the end of a hunt: a new best, kept in the browser and shown on its card', huntEnd[0] === "Time's up" && huntEnd[1] === true && JSON.parse(huntEnd[3] || '{}').bughunt === huntEnd[2] && shownBest.includes(`best score ${huntEnd[2]}`),
    `${huntEnd.slice(0, 3).join(' ')} | stored ${huntEnd[3]} | cards: ${shownBest.join(', ')}`);

  // Orbit: holding the mouse climbs; the game waits while another window is in front; standing up pauses it.
  await p.click('.dt-win[data-app="games"] .dt-pill:text-is("Play") >> nth=0'); await p.waitForSelector('canvas.dt-game'); await p.waitForTimeout(300);
  const [cx, cy] = await gameToScreen(210, 210);
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.waitForTimeout(500);
  const climb = await G(() => [__loft.screens.desktop.games.playing.id, __loft.screens.desktop.games.playing.st.vr]);
  await p.mouse.up(); await p.waitForTimeout(150);
  await p.click('.dt-icon[aria-label="Open Notes"]'); await p.waitForFunction(() => __loft.screens.desktop.games.playing.paused, null, { timeout: 3000 }).catch(() => {});
  const waits = await G(() => __loft.screens.desktop.games.playing.paused);
  check('Orbit: holding the mouse climbs, and the game waits behind another window', climb[0] === 'orbit' && climb[1] > 0 && waits === true, `climbing at ${climb[1].toFixed(0)}, paused behind the notes ${waits}`);
  await p.click('.dt-icon[aria-label="Open Games"]'); await p.waitForSelector('.dt-win.focus[data-app="games"] canvas.dt-game');
  await p.click('.dt-win[data-app="games"] .dt-pill:text-is("Go on")'); await p.waitForFunction(() => !__loft.screens.desktop.games.playing.paused, null, { timeout: 3000 }).catch(() => {});
  await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
  const stood = await G(() => [__loft.mode, __loft.screens.desktop.games.playing?.paused, document.querySelectorAll('.dt canvas, .dt iframe').length]);
  check('standing up pauses the game and clears the desktop', stood[0] === 'walk' && stood[1] === true && stood[2] === 0, stood.join(' '));
  // The monitor in the room paints the same window, so it shows the game waiting.
  const painted = await G(() => __loft.screens.desktop.st.wins.at(-1)?.app);
  check('the monitor is left on the paused game', painted === 'games', painted);
  await ctx.close();

  // ---------- a phone, upright, by touch ----------
  const pctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pp = await pctx.newPage();
  watch(pp, 'phone');
  await pp.goto(URL);
  await pp.waitForFunction(() => window.__loft && window.__loft.renderer.info.render.calls > 0, null, { timeout: 120000 });
  await pp.evaluate(() => __loft.useDesk());
  await pp.waitForFunction(() => document.querySelector('.dt.on.narrow'), null, { timeout: 15000 });
  await pp.waitForTimeout(500);
  await gate(pp, 'phone');
  const cdp = await pctx.newCDPSession(pp);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const ponScreen = (x, y) => pp.evaluate(([x, y]) => { const r = document.querySelector('.dt'), m = new DOMMatrix(getComputedStyle(r).transform), q = m.transformPoint(new DOMPoint(x, y)); return [q.x / q.w, q.y / q.w]; }, [x, y]);
  const pgame = async (gx, gy) => {
    const at = await pp.evaluate(([gx, gy]) => {
      const c = document.querySelector('canvas.dt-game'), w = c.closest('.dt-win'), id = __loft.screens.desktop.games.playing.id;
      const [gw, gh] = { paddle: [720, 420], orbit: [420, 420], bughunt: [720, 420] }[id], bw = c.offsetWidth, bh = c.offsetHeight, k = Math.min(bw / gw, bh / gh);
      return [w.offsetLeft + c.offsetLeft + (bw - gw * k) / 2 + gx * k, w.offsetTop - w.scrollTop + c.offsetTop + (bh - gh * k) / 2 + gy * k];
    }, [gx, gy]);
    return ponScreen(...at);
  };
  await pp.tap('.dt-icon[aria-label="Open Games"]'); await pp.waitForTimeout(400);
  const pl = await pp.evaluate(() => { const w = document.querySelector('.dt-win[data-app="games"]'), r = w.getBoundingClientRect(); return [w.querySelectorAll('.dt-card').length, Math.round(r.left), Math.round(r.right), innerWidth, [...w.querySelectorAll('.dt-pill')].every(b => { const q = b.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth; })]; });
  await pp.screenshot({ path: `${OUT}/c-phone-launcher.png` });
  check('phone: the launcher fits the screen', pl[0] === 3 && pl[1] >= 0 && pl[2] <= pl[3] && pl[4], pl.join(' '));
  await pp.tap('.dt-win[data-app="games"] .dt-pill:text-is("Play") >> nth=0'); await pp.waitForTimeout(300);
  const [tx, ty] = await pgame(210, 210);
  await touch('touchStart', tx, ty); await pp.waitForTimeout(500);
  const pclimb = await pp.evaluate(() => [__loft.screens.desktop.games.playing.id, __loft.screens.desktop.games.playing.st.vr]);
  // Two fingers down, then one lifts: the other still holds the ship up.
  await touch('touchEnd');
  await pp.evaluate(() => Object.assign(__loft.screens.desktop.games.playing.st, { r: 100, vr: 0 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty, id: 0 }, { x: tx + 30, y: ty + 30, id: 1 }] });
  await pp.waitForTimeout(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty, id: 0 }] });
  await pp.waitForTimeout(400);
  const held = await pp.evaluate(() => __loft.screens.desktop.games.playing.st.vr);
  // The finger left slides off the game, up onto the desktop's top bar, and lifts there.
  const barBox = await pp.locator('.dt-bar').boundingBox();
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty + (barBox.y + barBox.height / 2 - ty) * i / 6, id: 0 }] }); await pp.waitForTimeout(16); }
  await touch('touchEnd'); await pp.waitForTimeout(700);
  const fell = await pp.evaluate(() => __loft.screens.desktop.games.playing.st.vr);
  check('phone: Orbit climbs while a finger is down; lifting one of two does not let go, the last one off lets go wherever it lifts', pclimb[0] === 'orbit' && pclimb[1] > 0 && held > 0 && fell < 0, `${pclimb[1].toFixed(0)}, with one of two fingers lifted ${held.toFixed(0)}, the last lifted off the game ${fell.toFixed(0)}`);
  await pp.tap('.dt-win[data-app="games"] .dt-pill:text-is("← Games")'); await pp.waitForTimeout(250);
  await pp.tap('.dt-win[data-app="games"] .dt-pill:text-is("Easy")'); await pp.waitForTimeout(300);
  const [ax, ay] = await pgame(560, 380), [zx, zy] = await pgame(600, 380);
  await touch('touchStart', ax, ay); await touch('touchMove', (ax + zx) / 2, ay); await touch('touchMove', zx, zy); await pp.waitForTimeout(500);
  const pfollow = await pp.evaluate(() => __loft.screens.desktop.games.playing.st.you);
  await touch('touchEnd'); await pp.waitForTimeout(100);
  const scrolled = await pp.evaluate(() => document.querySelector('.dt-win[data-app="games"]').scrollTop);
  check('phone: the paddle follows a finger, and the window does not scroll under it', Math.abs(pfollow - 600) < 3 && scrolled === 0, `paddle at ${pfollow.toFixed(1)} for a finger at 600, scrolled ${scrolled}`);
  await pp.screenshot({ path: `${OUT}/c-phone-paddle.png` });
  await pp.tap('.dt-win[data-app="games"] .dt-pill:text-is("← Games")'); await pp.waitForTimeout(250);
  await pp.tap('.dt-win[data-app="games"] .dt-pill:text-is("Play") >> nth=1'); await pp.waitForTimeout(1200);
  const pbug = await pp.evaluate(() => { const st = __loft.screens.desktop.games.playing.st; st.bugs.push({ id: 999, kind: 'quick', x: 360, y: 210, vx: 0, vy: 0, born: st.t, turn: 99 }); return st.squashed; });
  const [qx, qy] = await pgame(360, 210);
  await touch('touchStart', qx, qy); await touch('touchEnd'); await pp.waitForTimeout(150);
  const pbug2 = await pp.evaluate(() => __loft.screens.desktop.games.playing.st.squashed);
  check('phone: a tap squashes a bug', pbug2 === pbug + 1, `${pbug} -> ${pbug2}`);
  await pp.tap('.dt-icon[aria-label="Open Browser"]'); await pp.waitForTimeout(1500);
  const pb = await pp.evaluate(() => { const f = document.querySelector('.dt-frame'), w = document.querySelector('.dt-win[data-app="browser"]'), r = f?.getBoundingClientRect(), wr = w?.getBoundingClientRect(), tab = [...document.querySelectorAll('.dt-win[data-app="browser"] .dt-pill')].find(b => b.textContent === 'Open in a new tab')?.getBoundingClientRect(); return r && wr && tab ? [r.left >= wr.left - 1 && r.right <= wr.right + 1 && r.top >= wr.top && r.bottom <= wr.bottom + 1, tab.left >= 0 && tab.right <= innerWidth && tab.bottom <= innerHeight, Math.round(r.width), Math.round(r.height), document.querySelector('.dt-frame iframe')?.offsetWidth] : null; });
  await pp.waitForTimeout(1500);
  await pp.screenshot({ path: `${OUT}/c-phone-browser.png` });
  check('phone: the page sits inside the browser window, its button on the screen', pb && pb[0] && pb[1], pb ? `page ${pb[2]} by ${pb[3]} on screen, laid out ${pb[4]} wide` : 'not shown');
  // A finger drawn up the page scrolls it, as in any browser.
  const pf = await (await pp.$('.dt-frame iframe'))?.contentFrame();
  const fr = await pp.locator('.dt-frame').boundingBox();
  let scrolledBy = null;
  if (pf && fr) {
    const y0 = await pf.evaluate(() => scrollY).catch(() => null), sx = fr.x + fr.width / 2;
    await touch('touchStart', sx, fr.y + fr.height * 0.8);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', sx, fr.y + fr.height * (0.8 - i * 0.07)); await pp.waitForTimeout(16); }
    await touch('touchEnd'); await pp.waitForTimeout(600);
    const y1 = await pf.evaluate(() => scrollY).catch(() => null);
    scrolledBy = y0 === null || y1 === null ? null : y1 - y0;
  }
  check('phone: a finger scrolls the page', scrolledBy > 20, `scrolled by ${scrolledBy}`);
  await pctx.close();

  console.log('errors', errs.length ? errs.join(' | ') : 'none');
  results.push(!errs.length);
  await b.close();
  const failed = results.filter(r => !r).length;
  console.log(failed ? `${failed} FAILED` : `all ${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); console.log('errors', errs.join(' | ') || 'none'); process.exit(1); });

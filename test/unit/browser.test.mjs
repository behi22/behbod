import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITES, SITE_ORIGINS, VIDEO_ORIGIN, CSP, SANDBOX, REFUSED, ALLOW, allowed, siteById, newBrowser, go, browserLayout } from '../../web/src/pure/browser.js';

test('every site on the list is https, plain, and passes its own check', () => {
  assert.ok(SITES.length >= 4);
  for (const s of SITES) {
    assert.equal(allowed(s.url), new URL(s.url).href, s.id);
    assert.ok(s.url.startsWith('https://'));
    assert.ok(/^[a-z0-9-]+$/.test(s.id) && s.title.length > 2);
  }
  assert.equal(new Set(SITES.map(s => s.id)).size, SITES.length);
});

test('addresses off the list are refused, however they are dressed up', () => {
  const no = [
    'http://en.wikipedia.org/wiki/Vancouver',                 // not https
    'https://example.com/', 'https://evil.example/https://en.wikipedia.org/',
    'https://en.wikipedia.org.evil.example/wiki/X',           // the list's name as a prefix of another
    'https://evil-en.wikipedia.org/', 'https://xen.wikipedia.org/', 'https://wikipedia.org/', 'https://de.wikipedia.org/wiki/X',
    'https://en.wikipedia.org@evil.example/',                 // the list's name as a user name
    'https://user:pass@en.wikipedia.org/', 'https://user@en.wikipedia.org/',
    'https://en.wikipedia.org:8443/', 'https://behi22.github.io:444/meet-bex/',
    'https://behi22.github.io.evil.example/', 'https://other.github.io/meet-bex/', 'https://github.io/',
    'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'blob:https://en.wikipedia.org/abc', 'file:///C:/Windows/win.ini', 'about:blank', 'about:srcdoc',
    'ftp://en.wikipedia.org/', 'ws://en.wikipedia.org/', 'wss://en.wikipedia.org/', 'view-source:https://en.wikipedia.org/',
    '//en.wikipedia.org/wiki/X', '/wiki/X', 'en.wikipedia.org/wiki/X', '', ' ', 'https://', 'https:// en.wikipedia.org/',
    'https://en.wikipedia.org\\@evil.example/', 'https://en.wikipedia.org/wiki/A B', 'https://en.wikipedia.org/\nx',
    'https://www.youtube-nocookie.com/embed/abc',             // the videos' player is not a site to browse
    'https://xn--en-wikipedia-org.example/',
  ];
  for (const url of no) assert.equal(allowed(url), null, JSON.stringify(url));
  for (const odd of [null, undefined, 5, {}, [], ['https://en.wikipedia.org/'], 'https://en.wikipedia.org/' + 'a'.repeat(2100)]) assert.equal(allowed(odd), null, String(odd).slice(0, 30));
});

test('addresses on the list are let through as the browser will load them', () => {
  assert.equal(allowed('https://en.wikipedia.org/wiki/Canada?x=1#History'), 'https://en.wikipedia.org/wiki/Canada?x=1#History');
  assert.equal(allowed('HTTPS://EN.WIKIPEDIA.ORG/wiki/Canada'), 'https://en.wikipedia.org/wiki/Canada');
  assert.equal(allowed('https://en.wikipedia.org:443/wiki/Canada'), 'https://en.wikipedia.org/wiki/Canada', 'the usual port is no port');
  assert.equal(allowed('https://behi22.github.io/anything/else.html'), 'https://behi22.github.io/anything/else.html');
});

test('the house never shows itself inside its own frame', () => {
  assert.equal(allowed('https://behi22.github.io/behbod/', 'https://behi22.github.io'), null);
  assert.equal(allowed('https://en.wikipedia.org/wiki/X', 'https://behbod.dev'), 'https://en.wikipedia.org/wiki/X');
});

test('the frame is granted two things and refused the rest', () => {
  assert.deepEqual(SANDBOX.split(' ').sort(), ['allow-same-origin', 'allow-scripts']);
  for (const never of ['allow-popups', 'allow-top-navigation', 'allow-forms', 'allow-downloads', 'allow-modals', 'allow-pointer-lock', 'allow-popups-to-escape-sandbox', 'allow-top-navigation-by-user-activation', 'allow-storage-access-by-user-activation'])
    assert.ok(!SANDBOX.includes(never), never);
  for (const f of ['camera', 'microphone', 'geolocation', 'display-capture', 'payment', 'usb', 'fullscreen', 'clipboard-read', 'autoplay']) {
    assert.ok(REFUSED.includes(f), f);
    assert.ok(ALLOW.includes(`${f} 'none'`), f);
  }
  assert.ok(!/'self'|\*|https:/.test(ALLOW), 'nothing is handed out');
});

test('the page\'s security rule names exactly the browser\'s origins and the video player', () => {
  assert.equal(CSP, `frame-src ${[...SITE_ORIGINS, VIDEO_ORIGIN].join(' ')}`);
  for (const o of [...SITE_ORIGINS, VIDEO_ORIGIN]) assert.ok(/^https:\/\/[a-z0-9.-]+$/.test(o), o);
  assert.ok(!/\*|'self'|'unsafe|http:|data:|blob:/.test(CSP), 'no wildcards and no loose schemes');
  // The rule in index.html is this one, word for word: the two cannot drift apart.
  const html = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');
  const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
  assert.ok(meta, 'index.html carries the rule');
  assert.equal(meta[1], CSP);
  assert.ok(html.indexOf(meta[0]) < html.indexOf('<script'), 'and it comes before any script runs');
});

test('choosing a site: only the list, by id', () => {
  const b = newBrowser();
  assert.equal(b.site, SITES[0].id);
  assert.equal(go(b, 'profile-art'), true);
  assert.equal(b.site, 'profile-art');
  for (const odd of ['nope', '__proto__', 'constructor', '', null, 'https://evil.example/']) assert.equal(go(b, odd), false, String(odd));
  assert.equal(b.site, 'profile-art');
  assert.equal(siteById('wikipedia').title, 'Wikipedia');
  assert.deepEqual(SITES.filter(s => s.voice).map(s => s.id), ['meet-bex', 'voice-microsite'], 'the sites you talk to are marked');
  assert.equal(siteById('toString'), null);
});

test('the window: its sites over the page, the note and the new-tab button under it, nothing overlapping', async () => {
  const { textWidth } = await import('../../web/src/pure/desktop.js');
  // The size the browser opens at on the monitor, then phone sizes.
  const [x, y, w, h] = [150, 42, 1236, 528];
  for (const win of [{ x, y, w, h }, { x: 0, y: 34, w: 540, h: 260 }, { x: 0, y: 34, w: 540, h: 820 }, { x: 0, y: 34, w: 1484, h: 256 }]) {
    for (const cur of SITES.map(s => s.id)) {
      const L = browserLayout(win, cur), at = `${win.w}x${win.h} ${cur}`;
      const sites = L.pills.filter(p => p.act.startsWith('site:')), tab = L.pills.find(p => p.act === 'newtab');
      assert.deepEqual(sites.map(p => p.act.slice(5)), SITES.map(s => s.id), at);
      assert.deepEqual(sites.filter(p => p.on).map(p => p.act), ['site:' + cur], `${at}: the site that is up is marked`);
      assert.ok(tab && tab.label === 'Open in a new tab', `${at}: the way out is always there`);
      const note = siteById(cur).voice ? 'to talk to it, use a new tab' : 'page blank or blocked?';
      assert.ok(L.texts.some(t => t.s === note), `${at}: and so is the note (${note})`);
      const P = L.page;
      assert.ok(P.x >= win.x && P.x + P.w <= win.x + win.w && P.y >= win.y + 34 && P.w > 100 && P.h >= 40, `${at}: the page fits`);
      for (const p of sites) assert.ok(p.y + p.h <= P.y, `${at}: ${p.label} sits over the page`);
      assert.ok(tab.y >= P.y + P.h && tab.y + tab.h <= win.y + win.h, `${at}: the button sits under the page, in the window`);
      for (const p of L.pills) assert.ok(p.x >= win.x && p.x + p.w <= win.x + win.w, `${at}: ${p.label} inside`);
      const boxes = [...L.pills.map(p => [p.x, p.y, p.w, p.h, p.label]), ...L.texts.map(t => [t.x, t.y - t.px * 0.8, textWidth(t.s, t.px), t.px, t.s])];
      if (L.lock) boxes.push([L.lock.x, L.lock.y, L.lock.size, L.lock.size, 'lock']);
      for (const [bx, , bw, , n] of boxes) assert.ok(bx >= win.x && bx + bw <= win.x + win.w, `${at}: ${n} inside`);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [ax, ay, aw, ah, an] = boxes[i], [bx, by, bw, bh, bn] = boxes[j];
        assert.ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${at}: "${an}" overlaps "${bn}"`);
      }
    }
  }
  // The address is shown where there is room for it; an unknown site marks no button and shows the first one's.
  assert.ok(browserLayout({ x, y, w, h }, 'profile-art').texts.some(t => t.s === 'behi22.github.io/profile-art'));
  const odd = browserLayout({ x, y, w, h }, 'nope');
  assert.equal(odd.pills.filter(p => p.on).length, 0);
  assert.ok(odd.texts.some(t => t.s === 'en.wikipedia.org/wiki/Vancouver'));
});

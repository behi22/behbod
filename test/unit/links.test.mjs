import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINKS, opening, blocked } from '../../web/src/pure/links.js';
import { PROJECTS, GITHUB } from '../../web/src/pure/desktop.js';

// The hosts his links may use, and the paths allowed on each.
const OWN = {
  'github.com': p => p.split('/')[1] === 'behi22',
  'behi22.github.io': () => true,
  'aic-voice-microsite.vercel.app': () => true,
  'www.loom.com': p => p.startsWith('/share/'),
};
// The work GitHub in any spelling, and the work's names.
const WORK = /behbod[-_.]?babai|alebex|alexic|bexai/i;

test('the link commands go to his own accounts and projects only, over https, never the work GitHub', () => {
  assert.deepEqual(Object.keys(LINKS), ['github', 'meet-bex', 'profile-art', 'aic-voice-microsite', 'visitor-classifier']);
  for (const [name, { title, url }] of Object.entries(LINKS)) {
    const u = new URL(url);
    assert.equal(u.protocol, 'https:', name);
    assert.ok(OWN[u.hostname]?.(u.pathname), `${name}: ${url}`);
    assert.equal(u.username + u.password + u.port + u.search + u.hash, '', `${name}: ${url}`);
    assert.doesNotMatch(decodeURIComponent(u.href), WORK, `${name}: ${url}`);
    assert.ok(title && !/[\u2014\u2013]/.test(title) && !WORK.test(title), name);
  }
  assert.equal(LINKS.github.url, GITHUB);
  for (const id of ['meet-bex', 'profile-art', 'aic-voice-microsite', 'visitor-classifier']) assert.equal(LINKS[id].url, PROJECTS[id].site, id);
});

test('the lines a link command prints are short and plain', () => {
  assert.equal(opening('GitHub'), 'Opening GitHub in a new tab.');
  for (const { title } of Object.values(LINKS)) {
    for (const l of [opening(title), blocked(title)]) {
      assert.ok(l.length <= 66, l);
      assert.doesNotMatch(l, /[\u2014\u2013]|\p{Extended_Pictographic}/u, l);
    }
  }
});

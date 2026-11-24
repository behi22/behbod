import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINKS, opening, blocked } from '../../web/src/pure/links.js';
import { PROJECTS, GITHUB } from '../../web/src/pure/desktop.js';

test('the link commands go to his own accounts and projects only, over https, never the work GitHub', () => {
  const allowed = /^https:\/\/(github\.com\/behi22|www\.linkedin\.com\/in\/behbod-babai\/|behi22\.github\.io\/|aic-voice-microsite\.vercel\.app|www\.loom\.com\/share\/)/;
  assert.deepEqual(Object.keys(LINKS), ['github', 'linkedin', 'meet-bex', 'profile-art', 'aic-voice-microsite', 'visitor-classifier']);
  for (const [name, { title, url }] of Object.entries(LINKS)) {
    assert.match(url, allowed, name);
    assert.doesNotMatch(url, /github\.com\/behbod-babai/i, name);
    assert.ok(title && !/[—–]/.test(title), name);
  }
  assert.equal(LINKS.github.url, GITHUB);
  for (const id of ['meet-bex', 'profile-art', 'aic-voice-microsite', 'visitor-classifier']) assert.equal(LINKS[id].url, PROJECTS[id].site, id);
});

test('the lines a link command prints are short and plain', () => {
  assert.equal(opening('GitHub'), 'Opening GitHub in a new tab.');
  for (const { title } of Object.values(LINKS)) {
    for (const l of [opening(title), blocked(title)]) {
      assert.ok(l.length <= 66, l);
      assert.doesNotMatch(l, /[—–]|\p{Extended_Pictographic}/u, l);
    }
  }
});

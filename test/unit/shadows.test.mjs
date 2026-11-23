import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// A name a file imports and then declares again inside a function hides the import there: world.js once declared its
// own `fade` beside leds.js's, and the first frame a record was heard threw, which stopped the frame loop for good.
const WEB = fileURLToPath(new URL('../../web/', import.meta.url));
const files = d => readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []));

function imported(src) {
  const names = new Set();
  for (const [, clause] of src.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/gm)) {
    for (const [, n] of clause.matchAll(/\*\s+as\s+([\w$]+)/g)) names.add(n);
    for (const part of clause.match(/\{([\s\S]*)\}/)?.[1].split(',') || []) { const n = part.split(/\s+as\s+/).pop().trim(); if (n) names.add(n); }
    const first = clause.replace(/\{[\s\S]*\}|\*\s+as\s+[\w$]+/g, '').split(',')[0].trim();
    if (/^[\w$]+$/.test(first)) names.add(first);
  }
  return names;
}
// Each imported name declared again, with its line.
function declaredAgain(src) {
  const hits = [];
  for (const n of imported(src)) {
    const name = n.replace(/\$/g, '\\$');
    const again = new RegExp(`\\b(?:let|const|var|function|class)\\s+${name}\\b|,\\s*${name}\\s*=(?![=>])`, 'g');
    for (const m of src.matchAll(again)) hits.push(`${src.slice(0, m.index).split('\n').length} ${n}`);
  }
  return hits;
}

test('the check finds a name declared again, alone or in a list, and leaves a call, a comparison or an arrow alone', () => {
  const head = "import { settle, fade as f2, fade } from './leds.js';\nimport * as THREE from 'three';\nimport D, { e } from './y.js';\n";
  assert.deepEqual([...imported(head)], ['settle', 'f2', 'fade', 'THREE', 'e', 'D']);
  assert.deepEqual(declaredAgain(`${head}function w() {\n  let a = 1, fade = 1;\n  const settle = 2;\n}`), ['6 settle', '5 fade']);
  assert.deepEqual(declaredAgain(`${head}let k = fade(1, 2), x = settle;\nif (k, fade == 1) e(D, fade => fade);\nconst THREEx = 1;`), []);
});

test('no file declares again a name it imports', () => {
  const all = files(WEB);
  assert.ok(all.length > 150, `${all.length} files`);
  const hits = all.flatMap(f => declaredAgain(readFileSync(f, 'utf8')).map(h => `${f.slice(WEB.length)}:${h}`));
  assert.deepEqual(hits, []);
});

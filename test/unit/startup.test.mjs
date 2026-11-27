import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../../web');
// Every module the page loads before anything is asked of it: web/main.js and what it imports, statically, all the way down.
function startup() {
  const seen = new Set(), todo = [resolve(WEB, 'main.js')];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/^\s*(?:import|export)\s[^'"`]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|^\s*import\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) todo.push(resolve(dirname(f), m[1] || m[2]));
  }
  return [...seen].map(f => f.slice(WEB.length + 1).replace(/\\/g, '/'));
}

test('nothing of the realistic hands is loaded with the house: they come when I first sit at the desk or the range is fetched', () => {
  const graph = startup();
  assert.ok(graph.includes('src/deskhands.js') && graph.includes('src/range/gun.js'), 'the walk reaches the desk hands and the range');
  for (const f of ['src/realhand.js', 'src/pure/realhand.js', 'src/pure/handrig.js', 'src/pure/realholds.js', 'src/pure/realposes.js']) assert.ok(!graph.includes(f), `${f} is loaded at startup`);
});

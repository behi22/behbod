import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// three draws a see-through, two-sided material in two passes, back faces then front, and marks it changed before
// each, so the shader program is looked up again twice a frame for every pane (22 to 149 lookups a frame, the top cost
// in every profile of the house). Each of these (flat tints, and the PC's perforated steel) looks the same either way
// round: one pass.
const SOURCES = ['../../web/src/world.js', '../../web/src/knight.js'];
test('every see-through, two-sided tint is drawn in one pass', () => {
  let found = 0;
  for (const file of SOURCES) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const [call] of src.matchAll(/new THREE\.MeshBasicMaterial\(\{[^}]*\}\)/g)) {
      if (!/transparent: true/.test(call) || !/THREE\.DoubleSide/.test(call) || /blending:/.test(call)) continue;
      found++;
      assert.match(call, /forceSinglePass: true/, `${file}: ${call}`);
    }
  }
  assert.equal(found, 3, 'the house glass, the PC\'s perforated steel and the knight case tint');
});

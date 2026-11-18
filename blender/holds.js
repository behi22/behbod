// Solves how the hands hold each gun (web/src/pure/handling.js) and writes the poses into web/src/range/holds.js, so
// the page only reads them: solving takes most of a second, too long to do on a phone while the range loads.
// Run it after changing the hand (web/src/pure/hands.js) or a gun's hold; test/unit/handling.test.mjs says when it is due.
//   node blender/holds.js
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', 'web/src/range/holds.js');
(async () => {
  const { solveHolds, bake, GUN_HOLDS } = await import('../web/src/pure/handling.js');
  const all = Object.fromEntries(Object.keys(GUN_HOLDS).map(id => [id, bake(solveHolds(id))]));
  fs.writeFileSync(OUT, `// Made by blender/holds.js from web/src/pure/handling.js: do not edit by hand.\nexport const HOLDS = ${JSON.stringify(all)};\n`);
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });

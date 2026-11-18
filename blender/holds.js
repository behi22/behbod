// Solves the holds ahead of time into web/src/range/holds.js, too slow for a phone; test/unit/handling.test.mjs says when.
//   node blender/holds.js
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', 'web/src/range/holds.js');
(async () => {
  const { solveHolds, bake, GUN_HOLDS } = await import('../web/src/pure/handling.js');
  const all = Object.fromEntries(Object.keys(GUN_HOLDS).map(id => [id, bake(solveHolds(id))]));
  fs.writeFileSync(OUT, `// Made by blender/holds.js from web/src/pure/handling.js: do not edit by hand.\nexport const HOLDS = ${JSON.stringify(all)};\n`);
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });

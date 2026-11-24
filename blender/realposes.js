// Solves the realistic hand's poses ahead of time into web/src/pure/realposes.js (a few seconds a gun, too slow for a
// page): each range gun's hold, and at the desk typing, pressing keys, on the mouse and resting.
//   node blender/realposes.js
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', 'web/src/pure/realposes.js');
(async () => {
  const G = await import('../web/src/pure/realholds.js');
  const r = x => Math.round(x * 1e6) / 1e6, pose = p => ({ at: p.at.map(r), q: p.q.map(r), cup: r(p.cup || 0), digits: Object.fromEntries(Object.entries(p.digits).map(([d, a]) => [d, a.map(r)])) });
  const guns = {};
  const only = process.argv[2] ? process.argv[2].split(',').filter(Boolean) : null;
  const old = only && fs.existsSync(OUT) ? await import(require('url').pathToFileURL(OUT).href + '?' + Date.now()) : null;
  for (const id of ['pistol', 'smg', 'rifle', 'sniper', 'lmg']) {
    if (only && !only.includes(id)) { guns[id] = old.GUNS[id]; continue; }
    const g = G.solveGrip(id); guns[id] = { right: pose(g.right), left: pose(g.left) }; console.log('solved', id); }
  const desk = {
    home: { left: pose(G.typing('left')), right: pose(G.typing('right')) },
    // Mid word: the left middle finger down on E, the right first finger halfway down on J, its ring lifting off L.
    press: { left: pose(G.typing('left', { keys: { middle: [3, 11] }, press: { middle: 0.003 } })), right: pose(G.typing('right', { press: { index: 0.0015, ring: -0.008 } })) },
    // Reaching: the left first finger over to G, the right little finger up for P.
    reach: { left: pose(G.typing('left', { keys: { index: 9 }, press: { index: -0.004 } })), right: pose(G.typing('right', { keys: { pinky: [3, 4] }, press: { pinky: 0.002 } })) },
    mouse: { left: pose(G.onMouse('left')) },
    rest: { right: pose(G.resting('right')), left: pose(G.resting('left', [-0.02, 0, -0.36])) },
  };
  fs.writeFileSync(OUT, `// Made by blender/realposes.js from web/src/pure/realholds.js: do not edit by hand.\nexport const GUNS = ${JSON.stringify(guns)};\nexport const DESK_POSES = ${JSON.stringify(desk)};\n`);
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });

// Solves the realistic hand's poses ahead of time into web/src/pure/realposes.js (several seconds a gun, too slow for a
// page): every hold each range gun's clips ask of the hands, and at the desk typing, pressing keys, on the mouse and
// resting.   node blender/realposes.js [gun,gun]   (only those guns solved again, the rest kept)
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
    const h = G.solveHolds(id);
    guns[id] = Object.fromEntries(['right', 'left'].map(side => [side, Object.fromEntries(Object.entries(h[side]).map(([name, p]) => [name, pose(p)]))]));
    console.log('solved', id);
  }
  const r3 = a => a.map(r);
  const desk = {
    home: { left: pose(G.typing('left')), right: pose(G.typing('right')) },
    // Mid word: the left middle finger down on E, the right first finger halfway down on J.
    press: { left: pose(G.typing('left', { keys: { middle: 'KeyE' }, press: { middle: 0.0035 } })), right: pose(G.typing('right', { press: { index: 0.0018 } })) },
    // Reaching: the left first finger over to G, the right little finger up to P.
    reach: { left: pose(G.typing('left', { keys: { index: 'KeyG' } })), right: pose(G.typing('right', { keys: { pinky: 'KeyP' } })) },
    // Between words the right hand is on the mouse and the left rests beside the keys.
    mouse: { right: pose(G.onMouse('right')) },
    rest: { left: pose(G.resting('left', G.REST_LEFT)) },
  };
  // Every key each finger types: the wrist's shift that lands it there, and the digit's angles resting on it, pressed
  // to the bottom of its travel, and lifted over it.
  const T = await import('../web/src/pure/typing.js'), keys = {};
  for (const side of ['left', 'right']) {
    keys[side] = {};
    for (const d of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
      keys[side][d] = {};
      for (const k of T.reachable(side, d)) {
        const K = G.onKey(side, d, k, desk.home[side].digits[d]);
        keys[side][d][k.id] = { shift: r3(K.shift), top: r3(K.top), press: r3(K.press), lift: r3(K.lift) };
      }
    }
    console.log('keys', side);
  }
  fs.writeFileSync(OUT, `// Made by blender/realposes.js from web/src/pure/realholds.js: do not edit by hand.\nexport const GUNS = ${JSON.stringify(guns)};\nexport const DESK_POSES = ${JSON.stringify(desk)};\nexport const KEYS = ${JSON.stringify(keys)};\n`);
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });

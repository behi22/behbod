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
    press: { left: pose(G.typing('left', { keys: { middle: [3, 11] }, press: { middle: 0.0035 } })), right: pose(G.typing('right', { press: { index: 0.0018 } })) },
    // Reaching: the left first finger over to G, the right little finger up to P.
    reach: { left: pose(G.typing('left', { keys: { index: [2, 9] } })), right: pose(G.typing('right', { keys: { pinky: [3, 4] } })) },
    mouse: { left: pose(G.onMouse('left')) },
    rest: { right: pose(G.resting('right', [-0.06, 0, 0.21])), left: pose(G.resting('left', [-0.06, 0, -0.21])) },
  };
  // Every key each finger types: the wrist's shift to get there, and the digit's angles resting on it, pressed to the
  // bottom of its travel, and lifted over it.
  const T = await import('../web/src/pure/typing.js'), H = await import('../web/src/pure/realhand.js'), keys = {};
  for (const side of ['left', 'right']) {
    keys[side] = {};
    for (const d of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
      keys[side][d] = {};
      const home = desk.home[side].digits[d];
      for (const k of T.reachable(side, d)) {
        // Resting on it found afresh; pressing and lifting are that same finger bending further or opening a little,
        // by as much as brings its tip down by the key's travel or up by 7 mm.
        const top = G.keyAngles(side, d, k, { from: home }), sh = G.wristShift(side, d, k), b = G.typingHand(side);
        // The digit's lowest point: its tip, where it meets the key.
        const pad = a => H.deepest(side, { ...b, at: b.at.map((v, i) => v + sh[i]), digits: { ...desk.home[side].digits, [d]: a } }, q => q[1], [d]);
        // Two ways to move the tip: bending at the knuckle, or (for a finger already curled under its knuckle) opening the
        // middle and end joints. Whichever reaches the drop does it.
        const DIRS = d === 'thumb' ? [[0, 0.3, 1, 0.8, 0], [0, 1, 0.2, 0.1, 0]] : [[0, 1, 0.15, 0.05], [0, 0.25, -1, -0.6]];
        const by = drop => {
          for (const dir of DIRS) for (const sgn of [1, -1]) {
            const bend = t => top.map((v, i) => v + sgn * t * dir[i]), got = t => (pad(top) - pad(bend(t))) * Math.sign(drop);
            let lo = 0, hi = null;
            for (let t = 0.05; t <= 0.9 + 1e-9 && hi === null; t += 0.05) { if (got(t) >= Math.abs(drop)) hi = t; else lo = t; }
            if (hi === null) continue;
            for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (got(m) < Math.abs(drop)) lo = m; else hi = m; }
            return bend(hi);
          }
          return top;
        };
        keys[side][d][k.join()] = { shift: r3(sh), top: r3(top), press: r3(by(T.TRAVEL)), lift: r3(by(-0.007)) };
      }
    }
    console.log('keys', side);
  }
  fs.writeFileSync(OUT, `// Made by blender/realposes.js from web/src/pure/realholds.js: do not edit by hand.\nexport const GUNS = ${JSON.stringify(guns)};\nexport const DESK_POSES = ${JSON.stringify(desk)};\nexport const KEYS = ${JSON.stringify(keys)};\n`);
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes');
})().catch(e => { console.error(e); process.exit(1); });

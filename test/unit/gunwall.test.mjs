import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { wall, ownedGuns, prompt, said, summary, hang, footprint, outline, SHELF, PANEL, HIDDEN } from '../../web/src/pure/gunwall.js';
import { GUNS, gunsFor } from '../../web/src/pure/arsenal.js';
import { STAGES, totalStars } from '../../web/src/pure/stages.js';
import { RIGS } from '../../web/src/pure/rigs.js';
import { SILHOUETTES } from '../../web/src/range/silhouettes.js';

const WORLD = JSON.parse(readFileSync(new URL('../../web/assets/world.json', import.meta.url)));
const glbJson = file => { const b = readFileSync(new URL(`../../web/${file}`, import.meta.url)); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); };
// Stars spread over the stages the way a visitor earns them: up to three a stage, on any difficulty.
const withStars = n => Object.fromEntries(STAGES.map((st, i) => [st.id, { normal: Math.max(0, Math.min(3, n - i * 3)) }]).filter(([, b]) => b.normal));

test('the wall shows a gun once its stars are earned: SMG at 1, rifle at 4, sniper at 7, machine gun at 10', () => {
  const at = n => wall(withStars(n)).filter(m => m.owned).map(m => m.id);
  assert.deepEqual(at(0), ['pistol']);
  assert.deepEqual(at(1), ['pistol', 'smg']);
  assert.deepEqual(at(3), ['pistol', 'smg']);
  assert.deepEqual(at(4), ['pistol', 'smg', 'rifle']);
  assert.deepEqual(at(7), ['pistol', 'smg', 'rifle', 'sniper']);
  assert.deepEqual(at(10), ['pistol', 'smg', 'rifle', 'sniper', 'lmg']);
  const two = wall(withStars(2));
  assert.deepEqual(two.map(m => [m.id, m.mount, m.more]), [['pistol', 0, 0], ['smg', 1, 0], ['rifle', 2, 2], ['sniper', 3, 5], ['lmg', 4, 8]], 'each gun on its own mount, with the stars still to earn');
});

test('the stage card offers exactly what the wall shows, for every count of stars', () => {
  for (let n = 0; n <= STAGES.length * 3; n++) {
    const best = withStars(n);
    assert.equal(totalStars(best), n);
    assert.deepEqual(ownedGuns(best), gunsFor(n), `${n} stars`);
  }
  assert.deepEqual(ownedGuns({}, true), GUNS.map(g => g.id), 'every gun with ?allguns');
  assert.deepEqual(ownedGuns(null), ['pistol'], 'the pistol with nothing saved');
});

test('the gun in the hands is marked, and only if it is owned', () => {
  assert.deepEqual(wall({}, { held: 'pistol' }).filter(m => m.held).map(m => m.id), ['pistol']);
  assert.deepEqual(wall(withStars(4), { held: 'rifle' }).filter(m => m.held).map(m => m.id), ['rifle']);
  assert.deepEqual(wall({}, { held: 'lmg' }).filter(m => m.held), [], 'a gun not earned is never shown as held');
});

test('what the wall says: the stars a locked gun needs, take for an owned one, and the gun in the hands', () => {
  const [pistol, smg, rifle] = wall(withStars(1), { held: 'pistol' });
  assert.equal(prompt(pistol), 'The P-22, in your hands');
  assert.equal(said(pistol), 'The P-22 is in your hands. Step up to the line.');
  assert.equal(prompt(smg), 'Take the Vesper');
  assert.equal(said(smg), 'You take the Vesper. Step up to the line.');
  assert.equal(prompt(rifle), 'The Keeper: 4 stars');
  assert.equal(said(rifle), 'The Keeper (rifle) unlocks at 4 stars. 3 stars to go.');
  const smgLocked = wall({})[1];
  assert.equal(prompt(smgLocked), 'The Vesper: 1 star');
  assert.equal(said(smgLocked), 'The Vesper (SMG) unlocks at 1 star. 1 star to go.');
  assert.equal(said(wall({})[4]), 'The Gatekeeper (machine gun) unlocks at 10 stars. 10 stars to go.');
  assert.equal(summary(wall(withStars(4))), 'The gun wall: 3 of the 5 guns are yours so far. Stars at the line earn the rest.');
  assert.equal(summary(wall({}, { all: true })), 'The gun wall: all 5 guns are yours. Walk up to one to take it.');
});

test('every gun hangs inside the panel, the long guns on the shelf, none touching another', () => {
  const mounts = WORLD.range.mounts;
  assert.equal(mounts.length, GUNS.length, 'a mount for every gun');
  const boxes = Object.fromEntries(GUNS.map(g => [g.id, outline(glbJson(RIGS[g.id].file))]));
  const spots = GUNS.map((g, i) => { const h = hang(g.id, boxes[g.id], mounts[i]); return { id: g.id, h, f: footprint(h, boxes[g.id]) }; });
  for (const { id, h, f: [y0, y1, z0, z1] } of spots) {
    assert.ok(y0 >= PANEL.y[0] + 0.05 && y1 <= PANEL.y[1] - 0.05, `${id} within the panel's length: ${y0.toFixed(2)} to ${y1.toFixed(2)}`);
    assert.ok(z0 >= SHELF - 1e-9 && z1 <= PANEL.z[1] - 0.1, `${id} above the shelf and below the panel's top: ${z0.toFixed(2)} to ${z1.toFixed(2)}`);
    if (h.upright) assert.ok(Math.abs(z0 - SHELF) < 1e-9, `${id} stands on the shelf`);
  }
  for (let i = 1; i < spots.length; i++) {
    const a = spots[i - 1].f, b = spots[i].f, gap = a[0] - b[1];
    assert.ok(gap >= 0.25, `${spots[i - 1].id} and ${spots[i].id} at least 25 cm apart (${gap.toFixed(2)})`);
  }
  const p = hang('pistol', boxes.pistol, mounts[0]);
  assert.deepEqual(p, { at: [mounts[0][0], mounts[0][1] + 0.08, mounts[0][2] + 0.05], upright: false, scale: 1.25 }, 'the pistol hangs where it always has');
});

test('the outlines picture is up to date with the gun files (if not: node blender/silhouettes.js)', () => {
  assert.ok(existsSync(new URL(`../../web/${SILHOUETTES.file}`, import.meta.url)), 'the picture is there');
  assert.deepEqual(Object.keys(SILHOUETTES.guns).sort(), GUNS.filter(g => g.stars > 0).map(g => g.id).sort(), 'an outline for every gun that has to be earned');
  for (const [id, s] of Object.entries(SILHOUETTES.guns)) {
    assert.deepEqual(s.box, outline(glbJson(RIGS[id].file)), `${id}'s outline`);
    const [x0, y0, x1, y1] = s.covers, [u0, v0, u1, v1] = s.uv;
    assert.ok(x0 <= s.box[0] && y0 <= s.box[1] && x1 >= s.box[2] && y1 >= s.box[3] && x1 - s.box[2] < 0.003 && y1 - s.box[3] < 0.003, `${id}'s picture covers it, to a pixel`);
    assert.ok(u0 >= 0 && v0 >= 0 && u1 <= 1 && v1 <= 1 && u1 > u0 && v1 > v0, `${id}'s place in the picture`);
    assert.ok(Math.abs((x1 - x0) / (y1 - y0) - (u1 - u0) / (v1 - v0) * SILHOUETTES.size[0] / SILHOUETTES.size[1]) < 0.02, `${id} is not stretched`);
  }
});

test('the wall shows every working part of a gun (the charging handles too); only the spent case, the extended magazine round and what is fitted are left off', () => {
  for (const [id, r] of Object.entries(RIGS)) for (const [k, n] of Object.entries(r.parts)) assert.equal(HIDDEN.test(`${r.prefix}_${n}`), k === 'casing', `${id} ${n}`);
  for (const n of ['P22_att_light', 'P22_round_ext', 'VSP_mount_rail', 'KPR_casing']) assert.ok(HIDDEN.test(n), n);
});

test('an outline: shown parts only, carried through the nodes, quantized positions read back', () => {
  const acc = (min, max, extra = {}) => ({ min, max, ...extra });
  const json = {
    scene: 0, scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'G_body', mesh: 0, translation: [1, 0, 0], children: [1, 2] },
      { name: 'G_att_light', mesh: 0, translation: [50, 50, 0] },
      { name: 'G_mag', mesh: 1, scale: [2, 2, 2], rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }, { primitives: [{ attributes: { POSITION: 1 } }] }],
    accessors: [acc([-0.5, -0.1, -0.02], [0.5, 0.1, 0.02]), acc([0, 0, -10], [32767, 100, 10], { normalized: true, componentType: 5122 })],
  };
  const [x0, y0, x1, y1] = outline(json);
  assert.deepEqual([x0, y0, x1, y1], [0.5, -0.1, 1.5, 2], 'the light left out; the magazine turned a quarter, doubled, and read back from its packed numbers');
  delete json.nodes[0].children;
  assert.deepEqual(outline(json), [0.5, -0.1, 1.5, 0.1]);
});

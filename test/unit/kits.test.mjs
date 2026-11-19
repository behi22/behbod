import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KITS, BOTS, PITCHES, kitById, deltaE, lab, teams, matchKits, strikerKits } from '../../web/src/games/pure/kits.js';

// The kits as the two games drew them before there was a choice.
const OLD_MATCH = [
  { name: 'BEHI FC', short: 'BEHI', shirt: '#f3f4f8', trim: '#7d4fe0', shorts: '#e3e4ec', keeper: '#7d4fe0', keeperTrim: '#f3f4f8', ink: '#2b2140' },
  { name: 'BOTS', short: 'BOTS', shirt: '#1f2533', trim: '#ff8a3d', shorts: '#161b26', keeper: '#ff8a3d', keeperTrim: '#1b1f29', ink: '#ffd7bd' },
];
const OLD_STRIKER = {
  you: { shirt: '#f3f4f8', shade: '#c9cbd6', trim: '#7d4fe0', shorts: '#f3f4f8', socks: '#f3f4f8', band: '#7d4fe0', gloves: '#7d4fe0', name: 'BEHI', num: '22' },
  them: { shirt: '#1f2533', shade: '#141923', trim: '#ff8a3d', shorts: '#1f2533', socks: '#ff8a3d', band: '#1f2533', gloves: '#ff8a3d', name: 'BOT', num: '9' },
  themKeeper: { shirt: '#ff8a3d', shade: '#d96c25', trim: '#1b1f29', shorts: '#1b1f29', socks: '#ff8a3d', band: '#1b1f29', gloves: '#f3f4f8', name: 'BOT', num: '1' },
};
const HEX = /^#[0-9a-f]{6}$/;

test('the first kit is exactly the one both games always had, so nothing changes until a visitor picks', () => {
  assert.equal(KITS[0].id, 'home');
  const m = matchKits('home');
  for (const i of [0, 1]) for (const [k, v] of Object.entries(OLD_MATCH[i])) assert.equal(m[i][k], v, `match side ${i} ${k}`);
  // The score bug's colour bars were each side's trim.
  assert.equal(m[0].badge, OLD_MATCH[0].trim);
  assert.equal(m[1].badge, OLD_MATCH[1].trim);
  assert.deepEqual(strikerKits('home'), OLD_STRIKER);
});

test('an unknown or missing pick is the first kit', () => {
  for (const id of [null, undefined, '', 'gold', '__proto__', 'constructor']) assert.equal(kitById(id).id, 'home', String(id));
  assert.deepEqual(matchKits('nope'), matchKits('home'));
  assert.deepEqual(strikerKits(undefined), OLD_STRIKER);
});

test('every kit has a name, its own id and real colours', () => {
  assert.equal(new Set(KITS.map(k => k.id)).size, KITS.length);
  assert.ok(KITS.length >= 5);
  for (const k of [...KITS, ...Object.values(BOTS)]) {
    for (const [field, v] of Object.entries(k)) if (!['id', 'name'].includes(field)) assert.match(v, HEX, `${k.id || 'bots'} ${field}`);
  }
  for (const k of KITS) assert.ok(k.name.length > 2 && !/[—–]/.test(k.name), k.name);
});

test('colour distance: the same colour is 0 apart, black and white about 100', () => {
  assert.equal(deltaE('#123456', '#123456'), 0);
  assert.ok(Math.abs(deltaE('#000000', '#ffffff') - 100) < 0.5);
  assert.ok(Math.abs(lab('#ffffff')[0] - 100) < 0.01);
  assert.ok(deltaE('#ff0000', '#ff1000') < 6);
});

test('whatever you pick, the two sides and their keepers are told apart at a glance', () => {
  for (const k of KITS) {
    const { you, bots } = teams(k.id);
    const pairs = { 'your shirt and theirs': [you.shirt, bots.shirt], 'your shirt and their keeper': [you.shirt, bots.keeper],
      'your keeper and their shirt': [you.keeper, bots.shirt], 'the two keepers': [you.keeper, bots.keeper], 'your shirt and your keeper': [you.shirt, you.keeper],
      'their shirt and their keeper': [bots.shirt, bots.keeper] };
    for (const [what, [a, b]] of Object.entries(pairs)) assert.ok(deltaE(a, b) >= 35, `${k.id}: ${what} ${deltaE(a, b).toFixed(1)}`);
  }
});

test('the bots change into their light kit only when yours is dark', () => {
  assert.equal(teams('home').bots, BOTS.dark);
  assert.equal(teams('black').bots, BOTS.light);
  for (const k of KITS) if (k.id !== 'black') assert.equal(teams(k.id).bots, BOTS.dark, k.id);
});

test('no kit is harder to see on the grass than the bots\' own kit always was', () => {
  const floor = Math.min(...PITCHES.map(p => deltaE(BOTS.dark.shirt, p)));
  for (const k of [...KITS, ...Object.values(BOTS)]) {
    for (const p of PITCHES) for (const c of [k.shirt, k.keeper]) assert.ok(deltaE(c, p) >= floor - 1e-9, `${k.id || 'bots'} ${c} on ${p}: ${deltaE(c, p).toFixed(1)} < ${floor.toFixed(1)}`);
  }
});

test('Striker 22 dresses you in your kit with your keeper\'s gloves, and the bots to match', () => {
  for (const k of KITS) {
    const s = strikerKits(k.id), { bots } = teams(k.id);
    assert.equal(s.you.shirt, k.shirt);
    assert.equal(s.you.gloves, k.keeper);
    assert.equal(s.you.num, '22');
    assert.equal(s.them.shirt, bots.shirt);
    assert.equal(s.themKeeper.shirt, bots.keeper);
  }
});

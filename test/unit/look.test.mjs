import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLook, hoodUp, wornColours, DEFAULT_LOOK } from '../../web/src/pure/look.js';

test('nothing saved gives his picked defaults: relaxed hoodie, tapered cargos, navy, black and white', () => {
  assert.deepEqual(sanitizeLook(null), DEFAULT_LOOK);
  assert.deepEqual(sanitizeLook('junk'), DEFAULT_LOOK);
});

test('a saved look keeps what is valid and drops the rest', () => {
  const look = sanitizeLook({ head: 'tv', hood: true, fit: { hoodie: 'short', pants: 'nope' }, acc: ['watch', 'watch', 'cape'], colours: { hoodie: '#ABCDEF', pants: 'red', shoes: '#123' }, extra: 1 });
  assert.equal(look.head, 'tv');
  assert.equal(look.hood, true);
  assert.deepEqual(look.fit, { hoodie: 'short', pants: 'tapered' });
  assert.deepEqual(look.acc, ['watch']);
  assert.deepEqual(look.colours, { hoodie: '#abcdef', pants: '#141518', shoes: '#eceae4' });
  assert.equal('extra' in look, false);
});

test('the real you and the earned looks need unlocking', () => {
  assert.equal(sanitizeLook({ head: 'mosaic' }).head, 'hood');
  assert.equal(sanitizeLook({ head: 'mosaic' }, { mosaic: true }).head, 'mosaic');
  assert.equal(sanitizeLook({ outfit: 'gold', visor: 'red' }).outfit, null);
  assert.equal(sanitizeLook({ outfit: 'gold', visor: 'red' }).visor, 'teal');
  const earned = sanitizeLook({ outfit: 'gold', visor: 'red' }, { unlocked: ['gold', 'visor'] });
  assert.equal(earned.outfit, 'gold');
  assert.equal(earned.visor, 'red');
});

test('the hood follows each head until you choose, then your choice wins', () => {
  assert.equal(hoodUp(sanitizeLook({ head: 'hood' })), true);
  assert.equal(hoodUp(sanitizeLook({ head: 'tv' })), false);
  assert.equal(hoodUp(sanitizeLook({ head: 'tv', hood: true })), true);
  assert.equal(hoodUp(sanitizeLook({ head: 'hood', hood: false })), false);
});

test('an earned colourway is what you wear', () => {
  assert.deepEqual(wornColours(sanitizeLook({})), { hoodie: '#1f2a44', pants: '#141518', shoes: '#eceae4', rib: '#1f2a44' });
  assert.equal(wornColours(sanitizeLook({ outfit: 'kit' }, { unlocked: ['kit'] })).hoodie, '#111114');
});

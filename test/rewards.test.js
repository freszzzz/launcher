const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/shared/rewards');

const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('każdy przedmiot w puli ma znaną rzadkość i koszt', () => {
  for (const item of R.POOL) {
    assert.ok(R.RARITIES.includes(item.rarity), item.id);
    assert.ok(R.COST[item.rarity] > 0, item.id);
    assert.ok(R.SHARDS[item.rarity] > 0, item.id);
  }
});

test('identyfikatory kosmetyków są unikalne', () => {
  assert.equal(new Set(R.POOL.map((i) => i.id)).size, R.POOL.length);
});

test('zestaw startowy to tylko zwykłe kosmetyki spoza eventów', () => {
  assert.ok(R.STARTER.length > 0);
  for (const id of R.STARTER) {
    assert.equal(R.BY_ID[id].rarity, 'common');
    assert.equal(R.BY_ID[id].event, null);
  }
});

test('zwykła skrzynka nie losuje kosmetyków eventowych', () => {
  for (let i = 0; i < 5000; i++) assert.equal(R.pickItem(Math.random).event, null);
});

test('skrzynka eventowa losuje wyłącznie kosmetyki eventu', () => {
  for (let i = 0; i < 2000; i++) assert.equal(R.pickItem(Math.random, null, 'halloween').event, 'halloween');
});

test('bonus serii gwarantuje co najmniej epicki', () => {
  for (let i = 0; i < 2000; i++) assert.ok(['epic', 'legendary'].includes(R.pickItem(Math.random, 'epic').rarity));
});

test('rozkład rzadkości idzie za wagami', () => {
  assert.equal(R.pickItem(seq(0, 0)).rarity, 'common');
  assert.equal(R.pickItem(seq(0.999, 0)).rarity, 'legendary');
});

test('event działa tylko w swoim zakresie dat, razem z ostatnim dniem', () => {
  assert.equal(R.activeEvent(new Date(2026, 9, 23)), null);
  assert.equal(R.activeEvent(new Date(2026, 9, 24))?.id, 'halloween');
  assert.equal(R.activeEvent(new Date(2026, 10, 3, 23, 59))?.id, 'halloween');
  assert.equal(R.activeEvent(new Date(2026, 10, 4)), null);
});

test('kosmetyki eventowe można kupić tylko w trakcie eventu', () => {
  const item = R.eventItems('halloween')[0];
  assert.equal(R.buyable(item, new Date(2026, 9, 28)), true);
  assert.equal(R.buyable(item, new Date(2026, 11, 1)), false);
});

test('dayKey używa daty lokalnej z zerami wiodącymi', () => {
  assert.equal(R.dayKey(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});

/*
 * Fresh Client – zasady nagród: pula codziennej skrzynki, szanse, odłamki, ceny i eventy.
 * Wspólne dla procesu głównego (losowanie) i interfejsu (opis szans, sklep, kłódki).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cosmetics'));
  else root.FreshRewards = factory(root.FreshCosmetics);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const RARITIES = ['common', 'rare', 'epic', 'legendary'];
  // szansa (%) na rzadkość w skrzynce
  const WEIGHTS = { common: 50, rare: 30, epic: 15, legendary: 5 };
  // duplikat zamienia się w odłamki
  const SHARDS = { common: 10, rare: 20, epic: 45, legendary: 100 };
  // cena w sklepie odłamków
  const COST = { common: 60, rare: 120, epic: 260, legendary: 600 };
  // co 7. dzień serii z rzędu – co najmniej epicki
  const STREAK_BONUS = 7;

  /**
   * Eventy: osobna codzienna skrzynka z limitowanymi kosmetykami (pole `event` w katalogu).
   * Daty lokalne, `end` włącznie. Po evencie kosmetyki zostają u tych, którzy je zdobyli.
   */
  const EVENTS = [
    {
      id: 'halloween',
      name: 'Halloween',
      crate: 'Dyniowa skrzynka',
      start: '2026-10-24',
      end: '2026-11-03',
      weights: { rare: 60, epic: 30, legendary: 10 }
    }
  ];

  /** Wszystkie kosmetyki, które można zdobyć: { id, name, rarity, slot, event? }. */
  const POOL = [
    ...Object.entries(C.CAPES).map(([id, def]) => ({ id, name: def.name, rarity: def.rarity || 'rare', slot: 'cape', event: def.event || null })),
    ...C.CATALOG.map((i) => ({ id: i.id, name: i.name, rarity: i.rarity, slot: i.slot, event: i.event || null }))
  ];
  const BY_ID = Object.fromEntries(POOL.map((i) => [i.id, i]));

  /** Na start: wszystkie zwykłe kosmetyki (bez eventowych). */
  const STARTER = POOL.filter((i) => i.rarity === 'common' && !i.event).map((i) => i.id);

  /** Data lokalna jako 'RRRR-MM-DD'. */
  function dayKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** Trwający event (albo null). */
  function activeEvent(d = new Date()) {
    const k = dayKey(d);
    return EVENTS.find((e) => k >= e.start && k <= e.end) || null;
  }

  /** Koniec eventu: północ po dniu `end`. */
  function eventEndsAt(ev) {
    const [y, m, d] = ev.end.split('-').map(Number);
    return new Date(y, m - 1, d + 1, 0, 0, 0).getTime();
  }

  const eventItems = (id) => POOL.filter((i) => i.event === id);

  /** Czy przedmiot można teraz kupić w sklepie odłamków (eventowe tylko w trakcie eventu). */
  const buyable = (item, d = new Date()) => !item.event || activeEvent(d)?.id === item.event;

  function pickRarity(rand, weights, minRarity) {
    const allowed = RARITIES.slice(RARITIES.indexOf(minRarity || 'common')).filter((r) => weights[r]);
    const total = allowed.reduce((s, r) => s + weights[r], 0);
    let x = rand() * total;
    for (const r of allowed) {
      x -= weights[r];
      if (x < 0) return r;
    }
    return allowed[allowed.length - 1];
  }

  /** Losuje kosmetyk ze zwykłej puli albo z puli eventu (eventId). */
  function pickItem(rand, minRarity, eventId = null) {
    const pool = eventId ? eventItems(eventId) : POOL.filter((i) => !i.event);
    const weights = eventId ? EVENTS.find((e) => e.id === eventId).weights : WEIGHTS;
    const r = pickRarity(rand, weights, minRarity);
    const list = pool.filter((i) => i.rarity === r);
    return list[Math.floor(rand() * list.length)];
  }

  return { RARITIES, WEIGHTS, SHARDS, COST, STREAK_BONUS, EVENTS, POOL, BY_ID, STARTER, dayKey, activeEvent, eventEndsAt, eventItems, buyable, pickItem };
});

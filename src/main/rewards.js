// Codzienna skrzynka: kolekcja kosmetyków, seria dni, odłamki za duplikaty i sklep odłamków.
// Stan w <userData>/rewards.json; lista posiadanych trafia też do <gra>/fresh/owned.json dla moda.
const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const R = require('../shared/rewards');
const { freshDir } = require('./store');

const REEL = 60; // kart na taśmie
const WIN_AT = 52; // pozycja wygranej

const rand = () => crypto.randomInt(0, 1_000_000_000) / 1_000_000_000;

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return R.dayKey(d);
}

class Rewards {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'rewards.json');
    this.data = null;
  }

  load(settings) {
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      // pierwszy start: zwykłe kosmetyki + wszystko, co gracz już ma na sobie
      const worn = Object.entries(settings.cosmetic || {})
        .filter(([k, v]) => k !== 'elytra' && typeof v === 'string' && R.BY_ID[v])
        .map(([, v]) => v);
      this.data = { owned: [...new Set([...R.STARTER, ...worn])], shards: 0, lastOpen: null, streak: 0, opened: 0, history: [] };
      this.save(settings);
    }
    this.data.owned = this.data.owned.filter((id) => R.BY_ID[id]);
    return this;
  }

  save(settings) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    if (settings) this.writeOwned(settings);
  }

  writeOwned(settings) {
    try {
      const dir = freshDir(settings);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'owned.json'), JSON.stringify({ owned: this.data.owned }, null, 2));
    } catch { /* folder gry niedostępny – zapiszemy przy następnej okazji */ }
  }

  /** Skrzynka dostępna, jeśli dziś jeszcze nie otwierana. */
  available() {
    return this.data.lastOpen !== R.dayKey() || process.env.FRESH_DEV_CRATE === '1';
  }

  /** Seria, jaka będzie po dzisiejszym otwarciu. */
  nextStreak() {
    const d = this.data;
    if (d.lastOpen === R.dayKey()) return d.streak;
    return d.lastOpen === yesterday() ? d.streak + 1 : 1;
  }

  /** Stan skrzynki eventowej (albo null, gdy żaden event nie trwa). */
  eventState() {
    const ev = R.activeEvent();
    if (!ev) return null;
    const e = (this.data.events ||= {})[ev.id] || {};
    return {
      id: ev.id,
      name: ev.name,
      crate: ev.crate,
      weights: ev.weights,
      endsAt: R.eventEndsAt(ev),
      opened: e.opened || 0,
      available: e.lastOpen !== R.dayKey() || process.env.FRESH_DEV_CRATE === '1',
      items: R.eventItems(ev.id).map((i) => i.id)
    };
  }

  state() {
    const d = this.data;
    const today = R.dayKey();
    // seria przepada, jeśli wczoraj nie otwarto skrzynki
    const streak = d.lastOpen === today || d.lastOpen === yesterday() ? d.streak : 0;
    return {
      owned: d.owned,
      shards: d.shards,
      streak,
      nextStreak: this.nextStreak(),
      opened: d.opened,
      available: this.available(),
      history: d.history.slice(0, 12),
      total: R.POOL.filter((i) => !i.event || d.owned.includes(i.id) || R.activeEvent()?.id === i.event).length,
      event: this.eventState()
    };
  }

  open(settings, kind = 'daily') {
    if (kind === 'event') return this.openEvent(settings);
    if (!this.available()) throw new Error('Dzisiejsza skrzynka jest już otwarta – wróć jutro!');
    const d = this.data;
    const streak = this.nextStreak();
    const bonus = streak > 0 && streak % R.STREAK_BONUS === 0;
    const winner = R.pickItem(rand, bonus ? 'epic' : 'common');

    // taśma jak w CS:GO: losowe karty z tymi samymi szansami, wygrana na stałej pozycji
    const reel = Array.from({ length: REEL }, () => R.pickItem(rand).id);
    reel[WIN_AT] = winner.id;

    const duplicate = d.owned.includes(winner.id);
    const shards = duplicate ? R.SHARDS[winner.rarity] : 0;
    if (!duplicate) d.owned.push(winner.id);
    d.shards += shards;
    d.streak = streak;
    d.lastOpen = R.dayKey();
    d.opened += 1;
    d.history.unshift({ id: winner.id, at: Date.now(), duplicate, shards });
    d.history = d.history.slice(0, 50);
    this.save(settings);
    return { winner: winner.id, index: WIN_AT, reel, duplicate, shards, bonus, state: this.state() };
  }

  /** Skrzynka eventowa: raz dziennie, tylko limitowane kosmetyki eventu, bez wpływu na serię. */
  openEvent(settings) {
    const ev = this.eventState();
    if (!ev) throw new Error('Event już się zakończył.');
    if (!ev.available) throw new Error(`${ev.crate} na dziś otwarta – wróć jutro!`);
    const d = this.data;
    const winner = R.pickItem(rand, null, ev.id);
    const reel = Array.from({ length: REEL }, () => R.pickItem(rand, null, ev.id).id);
    reel[WIN_AT] = winner.id;
    const duplicate = d.owned.includes(winner.id);
    const shards = duplicate ? R.SHARDS[winner.rarity] : 0;
    if (!duplicate) d.owned.push(winner.id);
    d.shards += shards;
    const e = (d.events ||= {})[ev.id] || (d.events[ev.id] = {});
    e.lastOpen = R.dayKey();
    e.opened = (e.opened || 0) + 1;
    d.opened += 1;
    d.history.unshift({ id: winner.id, at: Date.now(), duplicate, shards, event: ev.id });
    d.history = d.history.slice(0, 50);
    this.save(settings);
    return { winner: winner.id, index: WIN_AT, reel, duplicate, shards, bonus: false, event: ev.id, state: this.state() };
  }

  buy(settings, id) {
    const item = R.BY_ID[id];
    if (!item) throw new Error('Nie ma takiego kosmetyku.');
    if (!R.buyable(item)) throw new Error('Ten kosmetyk był dostępny tylko w czasie eventu.');
    const d = this.data;
    if (d.owned.includes(id)) throw new Error('Masz już ten kosmetyk.');
    const cost = R.COST[item.rarity];
    if (d.shards < cost) throw new Error(`Brakuje ${cost - d.shards} odłamków.`);
    d.shards -= cost;
    d.owned.push(id);
    d.history.unshift({ id, at: Date.now(), bought: true, shards: -cost });
    this.save(settings);
    return this.state();
  }

  owns(id) {
    return !id || id.startsWith('mojang:') || this.data.owned.includes(id) || !R.BY_ID[id];
  }
}

module.exports = { Rewards };

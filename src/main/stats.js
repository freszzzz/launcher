// Statystyki gry: czas na profil / dzień / serwer, sesje. Zliczane co kilka sekund, gdy gra działa.
// Stan w <userData>/stats.json.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { dayKey } = require('../shared/rewards');

const EMPTY = { launches: 0, sessions: [], days: {}, profiles: {}, servers: {}, modes: { menu: 0, single: 0, multi: 0, realms: 0 } };

class Stats {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'stats.json');
    this.live = null; // { profile, start, last, mode, server }
    try {
      this.data = { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch {
      this.data = structuredClone(EMPTY);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data));
  }

  start(profile) {
    this.data.launches += 1;
    const now = Date.now();
    this.live = { profile: { id: profile.id, name: profile.name, loader: profile.loader, version: profile.version }, start: now, last: now, mode: 'menu', server: '' };
    this.save();
  }

  /** Dolicza czas od ostatniego wywołania do bieżącego trybu (menu / świat / serwer). */
  tick(status) {
    const l = this.live;
    if (!l) return;
    const now = Date.now();
    const dt = Math.min(now - l.last, 60_000); // uśpiony komputer nie nabija godzin
    l.last = now;
    const d = this.data;
    const day = dayKey();
    d.days[day] = (d.days[day] || 0) + dt;
    const p = (d.profiles[l.profile.id] ||= { name: l.profile.name, loader: l.profile.loader, version: l.profile.version, ms: 0 });
    Object.assign(p, { name: l.profile.name, loader: l.profile.loader, version: l.profile.version });
    p.ms += dt;
    d.modes[l.mode] = (d.modes[l.mode] || 0) + dt;
    if (l.mode === 'multi' && l.server) d.servers[l.server] = (d.servers[l.server] || 0) + dt;
    if (status) {
      l.mode = status.state || l.mode;
      l.server = (status.server || '').toLowerCase();
    }
  }

  stop() {
    if (!this.live) return;
    this.tick();
    const l = this.live;
    this.data.sessions.push({ p: l.profile.id, start: l.start, end: Date.now() });
    this.data.sessions = this.data.sessions.slice(-500);
    this.live = null;
    this.save();
  }

  summary(profiles = []) {
    const d = this.data;
    const total = Object.values(d.days).reduce((a, b) => a + b, 0);
    const lengths = d.sessions.map((s) => s.end - s.start);
    const last = [];
    for (let i = 13; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = dayKey(dt);
      last.push({ day: key, ms: d.days[key] || 0 });
    }
    // dni grania z rzędu (dziś albo wczoraj musi być dniem z grą)
    let streak = 0;
    const cur = new Date();
    if (!d.days[dayKey(cur)]) cur.setDate(cur.getDate() - 1);
    while (d.days[dayKey(cur)]) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    const names = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
    return {
      total,
      launches: d.launches,
      sessions: lengths.length,
      longest: lengths.length ? Math.max(...lengths) : 0,
      average: lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0,
      streak,
      daysPlayed: Object.values(d.days).filter((ms) => ms > 0).length,
      last14: last,
      profiles: Object.entries(d.profiles)
        .map(([id, p]) => ({ id, name: names[id] || p.name, loader: p.loader, version: p.version, ms: p.ms, exists: !!names[id] }))
        .sort((a, b) => b.ms - a.ms),
      servers: Object.entries(d.servers).map(([host, ms]) => ({ host, ms })).sort((a, b) => b.ms - a.ms).slice(0, 6),
      modes: d.modes,
      firstDay: Object.keys(d.days).sort()[0] || null
    };
  }
}

module.exports = { Stats };

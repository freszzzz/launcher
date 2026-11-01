// Trwałe ustawienia (JSON) + zaszyfrowany magazyn konta (safeStorage / DPAPI na Windows).
const { app, safeStorage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

function defaultGameDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || app.getPath('appData'), '.minecraft');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'minecraft');
  }
  return path.join(os.homedir(), '.minecraft');
}

const newId = () => Math.random().toString(36).slice(2, 10);

const DEFAULTS = {
  gameDir: defaultGameDir(),
  memoryMax: 4096,
  memoryMin: 1024,
  width: 1280,
  height: 720,
  fullscreen: false,
  autoJava: true,
  javaPath: '',
  jvmArgs: '',
  closeOnLaunch: true,
  particles: true,
  showSnapshots: false,
  autoInstallMod: true,
  // Profile = osobne foldery gry (mody, światy) dzielące biblioteki i zasoby.
  profiles: [],
  selectedProfile: null,
  cosmetic: { cape: 'dusk', head: null, face: null, back: null, aura: null, pet: null, elytra: false },
  // Adres serwera Fresh (ikonki przy nicku + kosmetyki widoczne dla innych). Puste = tylko lokalnie.
  serverUrl: '',
  // Puste = tryb "live" (publiczny client id). Wpisz własny Azure Client ID dla dystrybucji.
  msClientId: '',
  // Discord Rich Presence: Application ID z discord.com/developers (assety: logo, vanilla, fabric, forge).
  discordRpc: true,
  discordClientId: '',
  discordShowServer: true,
  // wersja marki – migracje jednorazowe po zmianie nazwy na Fresh Client
  brandVersion: 0
};

const DEFAULT_PROFILE = {
  name: 'Fresh 1.21.10',
  loader: 'fabric',
  version: '1.21.10',
  loaderVersion: null,
  icon: 'fresh'
};

class Settings {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.data = structuredClone(DEFAULTS);
    try {
      Object.assign(this.data, JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch { /* pierwszy start */ }
    this.migrate();
  }

  /** Starsze ustawienia z jedną wybraną wersją zamienia na profil. */
  migrate() {
    const d = this.data;
    d.cosmetic = { ...DEFAULTS.cosmetic, ...d.cosmetic };
    if (!d.profiles.length) {
      const old = d.selected;
      d.profiles.push(
        old?.version
          ? { ...DEFAULT_PROFILE, id: newId(), name: `${old.loader === 'vanilla' ? 'Vanilla' : old.loader} ${old.version}`, loader: old.loader, version: old.version, loaderVersion: old.loaderVersion, lastPlayed: null }
          : { ...DEFAULT_PROFILE, id: newId(), lastPlayed: null }
      );
    }
    delete d.selected;
    if (!d.profiles.some((p) => p.id === d.selectedProfile)) d.selectedProfile = d.profiles[0].id;
  }

  profile(id = this.data.selectedProfile) {
    return this.data.profiles.find((p) => p.id === id) || null;
  }

  saveProfile(profile) {
    const list = this.data.profiles;
    const i = list.findIndex((p) => p.id === profile.id);
    const clean = {
      id: profile.id || newId(),
      name: String(profile.name || 'Profil').slice(0, 28),
      loader: ['vanilla', 'fabric', 'forge'].includes(profile.loader) ? profile.loader : 'vanilla',
      version: profile.version || null,
      loaderVersion: profile.loaderVersion || null,
      icon: profile.icon || 'violet',
      createdAt: profile.createdAt || (i >= 0 ? list[i].createdAt : null) || Date.now(),
      lastPlayed: profile.lastPlayed || (i >= 0 ? list[i].lastPlayed : null)
    };
    if (i >= 0) list[i] = clean;
    else list.push(clean);
    this.save();
    return clean;
  }

  deleteProfile(id) {
    if (this.data.profiles.length <= 1) throw new Error('Musi zostać co najmniej jeden profil.');
    this.data.profiles = this.data.profiles.filter((p) => p.id !== id);
    if (this.data.selectedProfile === id) this.data.selectedProfile = this.data.profiles[0].id;
    this.save();
  }

  update(patch = {}) {
    for (const [key, value] of Object.entries(patch)) {
      if (key in DEFAULTS) this.data[key] = value;
    }
    this.save();
    return this.data;
  }

  reset(key) {
    if (key in DEFAULTS) this.data[key] = structuredClone(DEFAULTS[key]);
    this.save();
    return this.data;
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }
}

// Pierwszy bajt pliku: 'E' = zaszyfrowane safeStorage, 'P' = plain (gdy szyfrowanie niedostępne).
const accountStore = {
  get file() {
    return path.join(app.getPath('userData'), 'account.dat');
  },

  load() {
    try {
      const raw = fs.readFileSync(this.file);
      const flag = String.fromCharCode(raw[0]);
      const body = raw.subarray(1);
      const json = flag === 'E' ? safeStorage.decryptString(body) : body.toString('utf8');
      return JSON.parse(json);
    } catch {
      return null;
    }
  },

  save(account) {
    const json = JSON.stringify(account);
    const encrypted = safeStorage.isEncryptionAvailable();
    const body = encrypted ? safeStorage.encryptString(json) : Buffer.from(json, 'utf8');
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, Buffer.concat([Buffer.from(encrypted ? 'E' : 'P'), body]));
  },

  clear() {
    fs.rmSync(this.file, { force: true });
  }
};

/** Folder współdzielony z modem: <gra>/fresh (cosmetics.json, modules.json, config.json). */
const freshDir = (settings) => path.join(settings.gameDir, 'fresh');
const profileDir = (settings, id) => path.join(settings.gameDir, 'profiles', id);

/** Folder danych współdzielonych z modem nosił wcześniej inną nazwę – kosmetyki i skróty mają zostać. */
function migrateGameData(settings) {
  const previous = path.join(settings.gameDir, 'duskpix');
  const current = freshDir(settings);
  if (!fs.existsSync(previous) || fs.existsSync(current)) return;
  try {
    fs.renameSync(previous, current);
  } catch (err) {
    console.warn('Nie można przenieść folderu danych moda:', err.message);
  }
}

module.exports = { Settings, accountStore, defaultGameDir, freshDir, profileDir, migrateGameData };

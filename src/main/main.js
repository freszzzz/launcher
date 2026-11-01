// Proces główny Electron: okno, IPC, sesja konta, uruchamianie gry.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Settings, accountStore, defaultGameDir, profileDir, freshDir, migrateGameData } = require('./store');
const fresh = require('./fresh');
const mods = require('./mods');
const { DiscordPresence, buildActivity } = require('./discord');
const { Rewards } = require('./rewards');
const { Stats } = require('./stats');
const auth = require('./auth');
const versions = require('./versions');
const java = require('./java');
const { GameManager } = require('./game');
const { fetchDataUrl } = require('./http');

/** Przenosi konto i ustawienia z folderu poprzedniej nazwy aplikacji (przed startem Chromium). */
function migrateUserData() {
  const current = app.getPath('userData');
  if (path.resolve(current) !== path.resolve(app.getPath('appData'), app.getName())) return; // np. --user-data-dir
  const previous = path.join(app.getPath('appData'), 'DUSKPIX Launcher');
  if (fs.existsSync(path.join(current, 'settings.json')) || !fs.existsSync(path.join(previous, 'settings.json'))) return;
  try {
    fs.rmSync(current, { recursive: true, force: true });
    fs.renameSync(previous, current);
  } catch {
    app.setPath('userData', previous); // folder zajęty – działamy na starym do następnego startu
  }
}

migrateUserData();
app.setAppUserModelId('pl.fresh.client');

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let settings;
let account = null;
let rewards;
let stats;
const game = new GameManager();
const discord = new DiscordPresence();
const presence = { panel: 'home', launcherSince: Date.now(), gameSince: null, profile: null, status: null };

const send = (channel, data) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
};
const publicAccount = (a) => (a ? { uuid: a.uuid, name: a.name } : null);

function createWindow() {
  const icon = path.join(__dirname, '../../build/icon.png');
  win = new BrowserWindow({
    width: 1120,
    height: 700,
    minWidth: 980,
    minHeight: 620,
    frame: false,
    show: false,
    backgroundColor: '#0b0810',
    icon: fs.existsSync(icon) ? icon : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.once('ready-to-show', () => win.show());
  if (process.argv.includes('--dev')) win.webContents.openDevTools({ mode: 'detach' });

  // Linki zewnętrzne -> przeglądarka systemowa; żadnej nawigacji w oknie launchera.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

/** Rejestruje handler IPC zwracający { ok, data } | { ok:false, error }. */
function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      console.error(`[ipc:${channel}]`, err);
      return { ok: false, error: err.message || String(err) };
    }
  });
}

async function validAccount() {
  if (!account) throw new Error('Najpierw zaloguj się kontem Microsoft.');
  try {
    account = await auth.ensureValid(account, settings.data);
    accountStore.save(account);
    return account;
  } catch (err) {
    if (err.code === 'expired') {
      account = null;
      accountStore.clear();
    }
    throw err;
  }
}

function registerIpc() {
  // okno
  handle('win:minimize', () => win.minimize());
  handle('win:close', () => win.close());

  // ustawienia
  handle('settings:get', () => ({
    ...settings.data,
    totalMemMb: Math.floor(os.totalmem() / 1048576),
    defaultGameDir: defaultGameDir(),
    modVersion: fresh.MOD_MC_VERSION
  }));
  handle('settings:set', (patch) => {
    const data = settings.update(patch);
    if ('serverUrl' in patch || 'gameDir' in patch) fresh.writeShared(data);
    if ('gameDir' in patch) rewards.writeOwned(data);
    if (['discordRpc', 'discordClientId', 'discordShowServer'].some((k) => k in patch)) syncDiscord();
    return data;
  });
  handle('settings:reset', (key) => settings.reset(key));
  handle('settings:pickDir', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Wybierz folder gry (.minecraft)',
      defaultPath: settings.data.gameDir,
      properties: ['openDirectory', 'createDirectory']
    });
    if (res.canceled || !res.filePaths[0]) return settings.data;
    return settings.update({ gameDir: res.filePaths[0] });
  });
  handle('settings:pickJava', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Wskaż plik javaw / java',
      properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'Java', extensions: ['exe'] }] : []
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return java.probe(res.filePaths[0]);
  });
  handle('settings:openDir', async () => {
    await fs.promises.mkdir(settings.data.gameDir, { recursive: true });
    return shell.openPath(settings.data.gameDir);
  });

  // konto
  handle('auth:current', () => publicAccount(account));
  handle('auth:login', async () => {
    account = await auth.login(win, settings.data);
    accountStore.save(account);
    return publicAccount(account);
  });
  handle('auth:logout', () => {
    account = null;
    accountStore.clear();
    return null;
  });

  // profil / kosmetyki
  handle('profile:textures', async () => {
    const a = await validAccount();
    const profile = await auth.getProfile(a.mcToken);
    if (profile.name !== a.name) {
      a.name = profile.name;
      accountStore.save(a);
    }
    const skin = (profile.skins || []).find((s) => s.state === 'ACTIVE') || (profile.skins || [])[0];
    const capes = await Promise.all(
      (profile.capes || []).map(async (c) => ({
        id: c.id,
        alias: c.alias,
        active: c.state === 'ACTIVE',
        dataUrl: await fetchDataUrl(c.url).catch(() => null)
      }))
    );
    return {
      name: profile.name,
      skin: skin ? await fetchDataUrl(skin.url).catch(() => null) : null,
      slim: skin?.variant === 'SLIM',
      capes
    };
  });
  handle('profile:setCape', async (capeId) => {
    const a = await validAccount();
    await auth.setActiveCape(a.mcToken, capeId);
    return true;
  });

  // profile
  handle('profiles:save', (profile) => settings.saveProfile(profile));
  handle('profiles:delete', (id) => {
    settings.deleteProfile(id);
    return settings.data;
  });
  handle('profiles:select', (id) => settings.update({ selectedProfile: id }));
  handle('profiles:openDir', async (id) => {
    const dir = profileDir(settings.data, id);
    await fs.promises.mkdir(dir, { recursive: true });
    return shell.openPath(dir);
  });

  // kosmetyki / mod Fresh
  handle('cosmetics:save', async (cosmetic) => {
    const locked = Object.entries(cosmetic).find(([k, v]) => k !== 'elytra' && typeof v === 'string' && !rewards.owns(v));
    if (locked) throw new Error('Ten kosmetyk jest jeszcze zablokowany – zdobądź go w codziennej skrzynce.');
    settings.update({ cosmetic: { ...settings.data.cosmetic, ...cosmetic } });
    fresh.writeShared(settings.data);
    if (!account || !settings.data.serverUrl) return { synced: false };
    try {
      await fresh.pushCosmetics(settings.data, await validAccount());
      return { synced: true };
    } catch (err) {
      return { synced: false, error: err.message };
    }
  });
  handle('modules:get', () => fresh.readModules(settings.data));
  handle('modules:set', (id, on) => fresh.writeModule(settings.data, id, on));
  handle('modules:setKey', (id, field, code) => fresh.writeModuleKey(settings.data, id, field, code));
  handle('server:stats', () => fresh.stats(settings.data));

  // znajomi
  const avatars = new Map();
  handle('friends:list', async () => fresh.friends(settings.data, await validAccount()));
  handle('friends:add', async (name) => fresh.friendRequest(settings.data, await validAccount(), name));
  handle('friends:action', async (action, uuid) => fresh.friendAction(settings.data, await validAccount(), action, uuid));
  handle('friends:avatar', async (uuid) => {
    if (!avatars.has(uuid)) {
      avatars.set(uuid, await fetchDataUrl(`https://mc-heads.net/avatar/${encodeURIComponent(uuid)}/32`).catch(() => null));
    }
    return avatars.get(uuid);
  });

  // mody w profilach (Modrinth + własne pliki)
  const modProfile = (id) => {
    const p = settings.profile(id);
    if (!p) throw new Error('Nie ma takiego profilu.');
    return p;
  };
  handle('mods:search', (profileId, opts) => mods.search(modProfile(profileId), opts));
  handle('mods:list', (profileId) => mods.list(settings.data, modProfile(profileId)));
  handle('mods:install', (profileId, projectId) =>
    mods.install(settings.data, modProfile(profileId), projectId, (p) => send('mods:progress', { projectId, ...p }))
  );
  handle('mods:toggle', (profileId, file, on) => mods.toggle(settings.data, modProfile(profileId), file, on));
  handle('mods:remove', (profileId, file) => mods.remove(settings.data, modProfile(profileId), file, (p) => shell.trashItem(p)));
  handle('mods:add', (profileId, files) => mods.addFiles(settings.data, modProfile(profileId), files));
  handle('mods:pick', async (profileId) => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Wybierz pliki modów (.jar)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Mody Minecraft', extensions: ['jar'] }]
    });
    if (res.canceled || !res.filePaths.length) return null;
    return mods.addFiles(settings.data, modProfile(profileId), res.filePaths);
  });
  handle('mods:openDir', async (profileId) => {
    const dir = mods.modsDir(settings.data, modProfile(profileId));
    await fs.promises.mkdir(dir, { recursive: true });
    return shell.openPath(dir);
  });

  // nagrody / statystyki
  handle('rewards:state', () => rewards.state());
  handle('rewards:open', (kind) => rewards.open(settings.data, kind));
  handle('rewards:buy', (id) => rewards.buy(settings.data, id));
  handle('stats:summary', () => ({ ...stats.summary(settings.data.profiles), crates: rewards.state() }));

  // Discord
  handle('discord:status', () => discord.status());
  handle('discord:panel', (panel) => {
    presence.panel = String(panel || 'home');
    updatePresence();
    return true;
  });

  // wersje / java
  handle('versions:list', (loader, snapshots) =>
    versions.list(loader, { snapshots, root: settings.data.gameDir })
  );
  handle('versions:loaderVersions', (loader, gameVersion) => versions.loaderVersions(loader, gameVersion));
  handle('java:detect', () => java.detectAll(settings.data.gameDir));

  // gra
  handle('game:launch', async (profileId) => {
    const a = await validAccount();
    const profile = settings.profile(profileId || settings.data.selectedProfile);
    if (!profile) throw new Error('Nie znaleziono profilu.');
    settings.update({ selectedProfile: profile.id });
    settings.saveProfile({ ...profile, lastPlayed: Date.now() });
    if (settings.data.serverUrl) fresh.pushCosmetics(settings.data, a).catch(() => {});
    presence.profile = profile;
    await game.launch({ account: a, settings: settings.data, profile });
    return true;
  });
  handle('game:kill', () => game.kill());
}

game.on('progress', (p) => send('game:progress', p));
game.on('log', (line) => send('game:log', line));
// Discord Rich Presence
function syncDiscord() {
  discord.configure({ enabled: settings.data.discordRpc, clientId: settings.data.discordClientId });
  updatePresence();
}

function updatePresence() {
  if (!discord.enabled) return;
  const inGame = game.running;
  discord.setActivity(
    buildActivity({
      state: inGame ? 'game' : 'launcher',
      panel: presence.panel,
      profile: presence.profile || settings.profile(),
      status: presence.status,
      startedAt: inGame ? presence.gameSince : presence.launcherSince,
      showServer: settings.data.discordShowServer
    })
  );
}

/** Mod zapisuje <gra>/fresh/status.json (menu / świat / serwer) – czytamy go, gdy gra działa. */
let statusTimer = null;
function pollGameStatus() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(freshDir(settings.data), 'status.json'), 'utf8'));
    if (JSON.stringify(s) !== JSON.stringify(presence.status)) {
      presence.status = s;
      updatePresence();
    }
  } catch { /* gra jeszcze nie zapisała statusu */ }
  stats.tick(presence.status);
}

game.on('state', (s) => {
  if (s.state === 'running') {
    presence.gameSince = Date.now();
    presence.status = null;
    try {
      fs.rmSync(path.join(freshDir(settings.data), 'status.json'), { force: true });
    } catch { /* brak pliku */ }
    clearInterval(statusTimer);
    statusTimer = setInterval(pollGameStatus, 5000);
    stats.start(presence.profile || settings.profile());
  } else if (s.state === 'closed') {
    clearInterval(statusTimer);
    stats.stop();
    presence.gameSince = null;
    presence.status = null;
    presence.launcherSince = Date.now();
  }
  setTimeout(updatePresence, 50);
});

discord.onStatus = (s) => send('discord:status', s);

game.on('state', (s) => {
  send('game:state', s);
  if (!win || win.isDestroyed()) return;
  if (s.state === 'running' && settings.data.closeOnLaunch) win.hide();
  if (s.state === 'closed') {
    if (!win.isVisible()) win.show();
    // kosmetyki mogły zostać zmienione w grze (menu RSHIFT)
    const fromGame = fresh.readCosmetics(settings.data);
    if (fromGame && JSON.stringify(fromGame) !== JSON.stringify(settings.data.cosmetic)) {
      settings.update({ cosmetic: { ...settings.data.cosmetic, ...fromGame } });
      send('cosmetics:changed', settings.data.cosmetic);
    }
  }
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

/** Status dla znajomych: "w launcherze" albo "w grze" (co minutę, gdy ustawiony serwer). */
async function heartbeat() {
  if (!account || !settings.data.serverUrl) return;
  try {
    const profile = settings.profile();
    const detail = profile ? `${profile.loader === 'vanilla' ? 'Vanilla' : profile.loader === 'fabric' ? 'Fabric' : 'Forge'} ${profile.version || ''}`.trim() : '';
    await fresh.presence(settings.data, await validAccount(), game.running ? 'game' : 'launcher', detail);
  } catch { /* serwer niedostępny – spróbujemy za minutę */ }
}

app.whenReady().then(() => {
  settings = new Settings();
  account = accountStore.load();
  migrateGameData(settings.data);
  rewards = new Rewards().load(settings.data);
  rewards.writeOwned(settings.data);
  stats = new Stats();
  if (settings.data.brandVersion < 3) {
    try {
      fresh.migrateAccent(settings.data);
    } catch { /* brak pliku modułów – nic do zmiany */ }
    settings.update({ brandVersion: 3 });
  }
  registerIpc();
  createWindow();
  syncDiscord();
  setTimeout(heartbeat, 3000);
  setInterval(heartbeat, 60_000);
  game.on('state', () => setTimeout(heartbeat, 500));
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  discord.disconnect();
  stats?.stop();
});

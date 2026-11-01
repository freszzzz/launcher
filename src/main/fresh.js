// Integracja z modem Fresh i serwerem Fresh.
//  - pliki współdzielone z modem: <gra>/fresh/{cosmetics,modules,config}.json
//  - instalacja moda + Fabric API do profilu Fabric 1.21.10
//  - logowanie na serwer Fresh przez sesję Mojang i wysyłanie kosmetyków
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getJson, postJson, request, download, HttpError } = require('./http');
const { freshDir } = require('./store');

const MOD_MC_VERSION = '1.21.10';
const PREVIOUS_MOD_JAR = 'duskpix-mod.jar'; // nazwa pliku moda sprzed zmiany marki

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

// pliki współdzielone

function writeShared(settings) {
  const dir = freshDir(settings);
  writeJson(path.join(dir, 'cosmetics.json'), settings.cosmetic);
  writeJson(path.join(dir, 'config.json'), { serverUrl: settings.serverUrl || '' });
}

/** Kosmetyki zmienione w grze (menu RSHIFT) – launcher je wczytuje po zamknięciu gry. */
function readCosmetics(settings) {
  return readJson(path.join(freshDir(settings), 'cosmetics.json'), null);
}

function readModules(settings) {
  return readJson(path.join(freshDir(settings), 'modules.json'), {});
}

function writeModule(settings, id, on) {
  const file = path.join(freshDir(settings), 'modules.json');
  const data = readJson(file, {});
  data[id] = { ...(data[id] || {}), on };
  writeJson(file, data);
  return data;
}

/**
 * Zapisuje skrót: field = 'toggle' -> modules[id].key (włącz/wyłącz),
 * inaczej modules[id].settings[field] (np. zoom.key, interface.menuKey). code = kod GLFW, -1 = brak.
 */
function writeModuleKey(settings, id, field, code) {
  const file = path.join(freshDir(settings), 'modules.json');
  const data = readJson(file, {});
  const entry = data[id] || {};
  if (field === 'toggle') entry.key = code;
  else entry.settings = { ...(entry.settings || {}), [field]: code };
  data[id] = entry;
  writeJson(file, data);
  return data;
}

/** Jednorazowo przy zmianie marki: stary fioletowy akcent menu w grze -> miętowy Fresh. */
function migrateAccent(settings) {
  const file = path.join(freshDir(settings), 'modules.json');
  const data = readJson(file, null);
  const s = data?.interface?.settings;
  if (!s || String(s.accent).toUpperCase() !== '#FF8B5CF6') return false;
  s.accent = '#FF14B8A6';
  writeJson(file, data);
  return true;
}

// instalacja moda

const modSupported = (profile) => profile.loader === 'fabric' && profile.version === MOD_MC_VERSION;

function bundledModPath() {
  // w trybie dev: <projekt>/resources/mod, po spakowaniu: wewnątrz app.asar
  return path.join(app.getAppPath(), 'resources', 'mod', 'fresh-client.jar');
}

async function installMod(gameDir, onProgress) {
  const mods = path.join(gameDir, 'mods');
  fs.mkdirSync(mods, { recursive: true });

  const src = bundledModPath();
  if (!fs.existsSync(src)) throw new Error('Brak pliku moda (resources/mod/fresh-client.jar) – zbuduj mod.');
  fs.writeFileSync(path.join(mods, 'fresh-client.jar'), fs.readFileSync(src));
  fs.rmSync(path.join(mods, PREVIOUS_MOD_JAR), { force: true }); // inaczej gra załadowałaby dwie wersje moda

  // Fabric API jest wymagane przez mod – pobieramy z Modrinth, jeśli go nie ma.
  if (!fs.readdirSync(mods).some((f) => /^fabric-api.*\.jar$/i.test(f))) {
    const q = `game_versions=${encodeURIComponent(JSON.stringify([MOD_MC_VERSION]))}&loaders=${encodeURIComponent('["fabric"]')}`;
    const versions = await getJson(`https://api.modrinth.com/v2/project/fabric-api/version?${q}`);
    const file = versions[0]?.files?.find((f) => f.primary) || versions[0]?.files?.[0];
    if (!file) throw new Error(`Nie znaleziono Fabric API dla ${MOD_MC_VERSION}.`);
    await download(file.url, path.join(mods, file.filename), onProgress);
  }
}

function removeMod(gameDir) {
  for (const jar of ['fresh-client.jar', PREVIOUS_MOD_JAR]) fs.rmSync(path.join(gameDir, 'mods', jar), { force: true });
}

// serwer Fresh

const base = (settings) => (settings.serverUrl || '').trim().replace(/\/+$/, '');
let token = null;

async function login(settings, account) {
  const url = base(settings);
  if (!url) return null;
  const { serverId } = await postJson(`${url}/api/auth/start`, {});
  // Ten sam mechanizm co przy wejściu na serwer Minecraft: join -> hasJoined.
  await request('https://sessionserver.mojang.com/session/minecraft/join', {
    method: 'POST',
    body: JSON.stringify({ accessToken: account.mcToken, selectedProfile: account.uuid, serverId }),
    headers: { 'Content-Type': 'application/json' }
  });
  const res = await postJson(`${url}/api/auth/finish`, { name: account.name, serverId });
  token = res.token;
  return token;
}

async function pushCosmetics(settings, account) {
  const url = base(settings);
  if (!url || !account) return false;
  if (!token) await login(settings, account);
  try {
    await request(`${url}/api/me`, {
      method: 'PUT',
      body: JSON.stringify({ cosmetics: settings.cosmetic }),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    if (!(err instanceof HttpError && err.status === 401)) throw err;
    token = null;
    await login(settings, account);
    return pushCosmetics(settings, account);
  }
  return true;
}

/** Zapytanie z tokenem serwera Fresh (loguje się ponownie po 401). */
async function authed(settings, account, method, route, body) {
  const url = base(settings);
  if (!url) throw new Error('Ustaw adres serwera Fresh w Ustawieniach.');
  if (!account) throw new Error('Zaloguj się kontem Microsoft.');
  if (!token) await login(settings, account);
  const call = () =>
    request(`${url}${route}`, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
  try {
    return await call();
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      token = null;
      await login(settings, account);
      return call();
    }
    if (err instanceof HttpError && err.body?.error) throw new Error(err.body.error);
    throw err;
  }
}

const friends = (settings, account) => authed(settings, account, 'GET', '/api/friends');
const friendRequest = (settings, account, name) => authed(settings, account, 'POST', '/api/friends/request', { name });
const friendAction = (settings, account, action, uuid) => {
  if (!['accept', 'decline', 'remove'].includes(action)) throw new Error('Nieznana akcja.');
  return authed(settings, account, 'POST', `/api/friends/${action}`, { uuid });
};
const presence = (settings, account, status, detail) => authed(settings, account, 'POST', '/api/presence', { status, detail });

async function stats(settings) {
  const url = base(settings);
  if (!url) return { configured: false };
  try {
    return { configured: true, ...(await getJson(`${url}/api/stats`)) };
  } catch (err) {
    return { configured: true, error: err.message };
  }
}

module.exports = {
  MOD_MC_VERSION,
  writeShared,
  readCosmetics,
  readModules,
  writeModule,
  writeModuleKey,
  migrateAccent,
  modSupported,
  installMod,
  removeMod,
  pushCosmetics,
  friends,
  friendRequest,
  friendAction,
  presence,
  stats
};

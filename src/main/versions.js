// Lista wersji (Mojang / Fabric / Forge) + instalacja profili loaderów.
const fs = require('fs');
const path = require('path');
const { getJson, download } = require('./http');

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC_META = 'https://meta.fabricmc.net/v2';
const FORGE_PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge';

const cache = new Map();
async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await loader();
  cache.set(key, { value, at: Date.now() });
  return value;
}

const getManifest = () => cached('manifest', 10 * 60e3, () => getJson(MANIFEST_URL));

async function getVersionMeta(id) {
  const manifest = await getManifest();
  const entry = manifest.versions.find((v) => v.id === id);
  if (!entry) throw new Error(`Nie znaleziono wersji ${id} w manifeście Mojang.`);
  return cached(`meta:${id}`, 60 * 60e3, () => getJson(entry.url));
}

/** Wymagana główna wersja Javy dla danego JSON-a wersji. */
function requiredJava(meta) {
  return meta.javaVersion?.majorVersion || 8;
}

// "1.20.1" -> [1, 20, 1] do porównań
const parse = (v) => v.split('.').map((n) => parseInt(n, 10) || 0);
function gte(a, b) {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return true;
}

function versionDirs(root) {
  try {
    return fs.readdirSync(path.join(root, 'versions'));
  } catch {
    return [];
  }
}

async function list(loader, { snapshots = false, root } = {}) {
  const manifest = await getManifest();
  const dirs = versionDirs(root);
  const releaseTime = new Map(manifest.versions.map((v) => [v.id, v]));
  const allowType = (t) => t === 'release' || (snapshots && t !== 'release');

  if (loader === 'fabric') {
    const games = await cached('fabric:games', 30 * 60e3, () => getJson(`${FABRIC_META}/versions/game`));
    return games
      .filter((g) => releaseTime.has(g.version) && allowType(releaseTime.get(g.version).type))
      .map((g) => {
        const v = releaseTime.get(g.version);
        return {
          id: v.id,
          type: v.type,
          releaseTime: v.releaseTime,
          installed: dirs.some((d) => d.startsWith('fabric-loader-') && d.endsWith(`-${v.id}`))
        };
      });
  }

  if (loader === 'forge') {
    const { promos } = await cached('forge:promos', 30 * 60e3, () => getJson(FORGE_PROMOS));
    const games = [...new Set(Object.keys(promos).map((k) => k.replace(/-(latest|recommended)$/, '')))];
    return games
      .filter((id) => releaseTime.has(id) && gte(id, '1.12.2'))
      .map((id) => releaseTime.get(id))
      .sort((a, b) => b.releaseTime.localeCompare(a.releaseTime))
      .map((v) => ({
        id: v.id,
        type: v.type,
        releaseTime: v.releaseTime,
        installed: dirs.some((d) => d.toLowerCase().includes('forge') && d.includes(v.id))
      }));
  }

  return manifest.versions
    .filter((v) => allowType(v.type))
    .map((v) => ({
      id: v.id,
      type: v.type,
      releaseTime: v.releaseTime,
      installed: dirs.includes(v.id)
    }));
}

async function loaderVersions(loader, game) {
  if (loader === 'fabric') {
    const loaders = await cached('fabric:loaders', 30 * 60e3, () => getJson(`${FABRIC_META}/versions/loader`));
    return loaders.slice(0, 25).map((l) => ({ id: l.version, label: l.version, stable: l.stable }));
  }
  if (loader === 'forge') {
    const { promos } = await cached('forge:promos', 30 * 60e3, () => getJson(FORGE_PROMOS));
    const out = [];
    const rec = promos[`${game}-recommended`];
    const latest = promos[`${game}-latest`];
    if (rec) out.push({ id: rec, label: `${rec} (zalecana)`, stable: true });
    if (latest && latest !== rec) out.push({ id: latest, label: `${latest} (najnowsza)`, stable: false });
    return out;
  }
  return [];
}

/** Zapisuje profil Fabric w versions/<id>/<id>.json i zwraca jego id (dla MCLC version.custom). */
async function installFabric(root, game, loaderVersion) {
  let loader = loaderVersion;
  if (!loader) {
    const loaders = await loaderVersions('fabric', game);
    loader = (loaders.find((l) => l.stable) || loaders[0]).id;
  }
  const profile = await getJson(
    `${FABRIC_META}/versions/loader/${encodeURIComponent(game)}/${encodeURIComponent(loader)}/profile/json`
  );
  const dir = path.join(root, 'versions', profile.id);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, `${profile.id}.json`), JSON.stringify(profile, null, 2));
  return profile.id;
}

/** Pobiera instalator Forge (MCLC sam go rozpakuje / użyje ForgeWrapper). */
async function downloadForgeInstaller(root, game, forgeVersion, onProgress) {
  let ver = forgeVersion;
  if (!ver) {
    const options = await loaderVersions('forge', game);
    if (!options.length) throw new Error(`Brak Forge dla wersji ${game}.`);
    ver = options[0].id;
  }
  const full = `${game}-${ver}`;
  const dest = path.join(root, 'fresh', 'forge', `forge-${full}-installer.jar`);
  if (!fs.existsSync(dest)) {
    await download(`${FORGE_MAVEN}/${full}/forge-${full}-installer.jar`, dest, onProgress);
  }
  // Nowsze instalatory Forge wymagają istnienia launcher_profiles.json.
  const profiles = path.join(root, 'launcher_profiles.json');
  if (!fs.existsSync(profiles)) {
    await fs.promises.writeFile(profiles, JSON.stringify({ profiles: {} }, null, 2));
  }
  return dest;
}

module.exports = {
  list,
  loaderVersions,
  getVersionMeta,
  requiredJava,
  installFabric,
  downloadForgeInstaller
};

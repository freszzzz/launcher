// Mody użytkownika w profilach: wyszukiwarka Modrinth, instalacja z zależnościami, własne pliki .jar.
// Każdy profil ma własny folder <gra>/profiles/<id>/mods. Mod Fresh i Fabric API instaluje launcher sam.
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { getJson, download } = require('./http');
const { profileDir } = require('./store');

const API = 'https://api.modrinth.com/v2';
const INDEX = '.fresh-mods.json';
const MANAGED = /^(mod\.jar|fabric-api.*\.jar)(\.disabled)?$/i;
const SORTS = ['relevance', 'downloads', 'follows', 'newest', 'updated'];

const modsDir = (settings, profile) => path.join(profileDir(settings, profile.id), 'mods');
const q = (v) => encodeURIComponent(JSON.stringify(v));

function readIndex(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, INDEX), 'utf8'));
  } catch {
    return {};
  }
}

function writeIndex(dir, index) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, INDEX), JSON.stringify(index, null, 2));
}

function requireModded(profile) {
  if (!profile) throw new Error('Nie ma takiego profilu.');
  if (profile.loader === 'vanilla') throw new Error('Profil Vanilla nie obsługuje modów – wybierz profil Fabric albo Forge.');
  if (!profile.version) throw new Error('Najpierw wybierz wersję gry w profilu.');
}

// Modrinth

async function search(profile, { query = '', sort = 'relevance', offset = 0, category = '' } = {}) {
  requireModded(profile);
  const facets = [['project_type:mod'], [`categories:${profile.loader}`], [`versions:${profile.version}`]];
  if (category) facets.push([`categories:${category}`]);
  const index = SORTS.includes(sort) ? sort : 'relevance';
  const url = `${API}/search?query=${encodeURIComponent(query)}&limit=24&offset=${Number(offset) || 0}&index=${index}&facets=${q(facets)}`;
  const res = await getJson(url);
  return {
    total: res.total_hits,
    offset: res.offset,
    hits: res.hits.map((h) => ({
      id: h.project_id,
      slug: h.slug,
      title: h.title,
      description: h.description,
      author: h.author,
      icon: h.icon_url || null,
      downloads: h.downloads,
      follows: h.follows,
      categories: (h.display_categories || h.categories || []).filter((c) => !['fabric', 'forge', 'quilt', 'neoforge'].includes(c)),
      color: h.color ?? null
    }))
  };
}

/** Najnowsza wersja projektu pasująca do profilu (preferuje wydania stabilne). */
async function bestVersion(profile, projectId) {
  const list = await getJson(`${API}/project/${encodeURIComponent(projectId)}/version?loaders=${q([profile.loader])}&game_versions=${q([profile.version])}`);
  if (!list.length) return null;
  return list.find((v) => v.version_type === 'release') || list[0];
}

/** Zbiór identyfikatorów (projectId, slug, modid) już zainstalowanych w folderze. */
function installedKeys(dir) {
  const keys = new Set();
  for (const m of listDir(dir)) {
    if (m.projectId) keys.add(m.projectId);
    if (m.slug) keys.add(m.slug);
    if (m.modId) keys.add(m.modId);
  }
  return keys;
}

/**
 * Instaluje projekt z Modrinth do profilu razem z wymaganymi zależnościami.
 * Starszy plik tego samego projektu jest zastępowany (aktualizacja).
 */
async function install(settings, profile, projectId, onProgress = () => {}) {
  requireModded(profile);
  const dir = modsDir(settings, profile);
  fs.mkdirSync(dir, { recursive: true });
  const done = [];
  const seen = new Set();

  async function one(id, depth) {
    if (seen.has(id) || depth > 6) return;
    seen.add(id);
    const project = await getJson(`${API}/project/${encodeURIComponent(id)}`);
    const keys = installedKeys(dir);
    // zależność już jest (np. Fabric API dograne przez launcher)
    if (depth > 0 && (keys.has(project.id) || keys.has(project.slug))) return;

    const version = await bestVersion(profile, project.id);
    if (!version) {
      if (depth === 0) throw new Error(`„${project.title}” nie ma wersji dla ${profile.loader} ${profile.version}.`);
      throw new Error(`Brak wymaganej zależności „${project.title}” dla ${profile.version}.`);
    }
    const file = version.files.find((f) => f.primary) || version.files[0];
    if (!file || !/\.jar$/i.test(file.filename)) throw new Error(`„${project.title}” nie ma pliku .jar.`);

    const index = readIndex(dir);
    for (const [name, meta] of Object.entries(index)) {
      if (meta.projectId === project.id && name !== file.filename) {
        fs.rmSync(path.join(dir, name), { force: true });
        fs.rmSync(path.join(dir, `${name}.disabled`), { force: true });
        delete index[name];
      }
    }
    onProgress({ title: project.title, received: 0, total: file.size });
    await download(file.url, path.join(dir, file.filename), (received, total) => onProgress({ title: project.title, received, total }));
    index[file.filename] = {
      projectId: project.id,
      slug: project.slug,
      versionId: version.id,
      title: project.title,
      version: version.version_number,
      icon: project.icon_url || null,
      description: project.description,
      installedAt: Date.now()
    };
    writeIndex(dir, index);
    done.push(project.title);

    for (const dep of version.dependencies || []) {
      if (dep.dependency_type !== 'required') continue;
      let depId = dep.project_id;
      if (!depId && dep.version_id) depId = (await getJson(`${API}/version/${dep.version_id}`)).project_id;
      if (depId) await one(depId, depth + 1);
    }
  }

  await one(projectId, 0);
  return { installed: done, mods: list(settings, profile) };
}

// pliki lokalne

/** Odczytuje nazwę/wersję/ikonę z fabric.mod.json lub META-INF/mods.toml wewnątrz .jar. */
function readJarMeta(file) {
  try {
    const zip = new AdmZip(file);
    const fabric = zip.getEntry('fabric.mod.json') || zip.getEntry('quilt.mod.json');
    if (fabric) {
      const j = JSON.parse(fabric.getData().toString('utf8').replace(/^﻿/, ''));
      const iconPath = typeof j.icon === 'string' ? j.icon : j.icon && Object.values(j.icon).pop();
      let icon = null;
      const entry = iconPath && zip.getEntry(iconPath.replace(/^\//, ''));
      if (entry && entry.header.size < 400000) icon = `data:image/png;base64,${entry.getData().toString('base64')}`;
      return { modId: j.id, title: j.name || j.id, version: j.version, description: j.description || '', icon, authors: (j.authors || []).map((a) => (typeof a === 'string' ? a : a.name)) };
    }
    const toml = zip.getEntry('META-INF/mods.toml') || zip.getEntry('META-INF/neoforge.mods.toml');
    if (toml) {
      const t = toml.getData().toString('utf8');
      const pick = (k) => (t.match(new RegExp(`^\\s*${k}\\s*=\\s*"([^"]*)"`, 'm')) || [])[1];
      return { modId: pick('modId'), title: pick('displayName') || pick('modId'), version: pick('version'), description: (pick('description') || '').trim() };
    }
  } catch { /* uszkodzony plik – pokażemy samą nazwę */ }
  return {};
}

const metaCache = new Map();

function listDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const index = readIndex(dir);
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!/\.jar(\.disabled)?$/i.test(name)) continue;
    const full = path.join(dir, name);
    const base = name.replace(/\.disabled$/i, '');
    const stat = fs.statSync(full);
    const key = `${full}:${stat.size}:${stat.mtimeMs}`;
    if (!metaCache.has(key)) metaCache.set(key, readJarMeta(full));
    const jar = metaCache.get(key);
    const idx = index[base] || {};
    out.push({
      file: base,
      enabled: !/\.disabled$/i.test(name),
      size: stat.size,
      managed: MANAGED.test(name),
      source: idx.projectId ? 'modrinth' : 'local',
      projectId: idx.projectId || null,
      slug: idx.slug || null,
      modId: jar.modId || null,
      title: idx.title || jar.title || base.replace(/\.jar$/i, ''),
      version: idx.version || jar.version || '',
      description: idx.description || jar.description || '',
      icon: idx.icon || jar.icon || null,
      installedAt: idx.installedAt || stat.mtimeMs
    });
  }
  return out.sort((a, b) => Number(a.managed) - Number(b.managed) || a.title.localeCompare(b.title, 'pl'));
}

function list(settings, profile) {
  if (!profile || profile.loader === 'vanilla') return [];
  return listDir(modsDir(settings, profile));
}

/** Bezpieczna nazwa pliku z folderu modów (bez wychodzenia poza folder). */
function resolveFile(dir, file) {
  const name = path.basename(String(file));
  if (!/\.jar$/i.test(name)) throw new Error('Nieprawidłowy plik moda.');
  return path.join(dir, name);
}

function toggle(settings, profile, file, enabled) {
  const dir = modsDir(settings, profile);
  const on = resolveFile(dir, file);
  const off = `${on}.disabled`;
  if (enabled && fs.existsSync(off)) fs.renameSync(off, on);
  if (!enabled && fs.existsSync(on)) fs.renameSync(on, off);
  return list(settings, profile);
}

/** Przenosi plik moda do Kosza (nie usuwa trwale). */
async function remove(settings, profile, file, trashItem) {
  const dir = modsDir(settings, profile);
  const target = resolveFile(dir, file);
  for (const p of [target, `${target}.disabled`]) if (fs.existsSync(p)) await trashItem(p);
  const index = readIndex(dir);
  delete index[path.basename(target)];
  writeIndex(dir, index);
  return list(settings, profile);
}

/** Kopiuje własne pliki .jar (z okna wyboru albo przeciągnięte) do profilu. */
function addFiles(settings, profile, files) {
  requireModded(profile);
  const dir = modsDir(settings, profile);
  fs.mkdirSync(dir, { recursive: true });
  const added = [];
  const skipped = [];
  for (const src of files || []) {
    const name = path.basename(String(src));
    try {
      if (!/\.jar$/i.test(name)) throw new Error('to nie jest .jar');
      const fd = fs.openSync(src, 'r');
      const head = Buffer.alloc(2);
      fs.readSync(fd, head, 0, 2, 0);
      fs.closeSync(fd);
      if (head.toString('latin1') !== 'PK') throw new Error('plik nie jest archiwum .jar');
      fs.copyFileSync(src, path.join(dir, name));
      added.push(name);
    } catch (err) {
      skipped.push(`${name} (${err.message})`);
    }
  }
  return { added, skipped, mods: list(settings, profile) };
}

module.exports = { search, install, list, toggle, remove, addFiles, modsDir };

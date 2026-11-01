// Wykrywanie zainstalowanych środowisk Java i automatyczna instalacja Eclipse Temurin (Adoptium).
const { app } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const extractZip = require('extract-zip');
const tar = require('tar');
const { download } = require('./http');

const IS_WIN = process.platform === 'win32';
const JAVA_BIN = IS_WIN ? 'javaw.exe' : 'java';
const runtimeRoot = () => path.join(app.getPath('userData'), 'runtime');

function parseMajor(version) {
  const legacy = version.match(/^1\.(\d+)/);
  return legacy ? Number(legacy[1]) : parseInt(version, 10);
}

/** Uruchamia `java -version` i zwraca { path, version, major } albo null. */
function probe(exe) {
  // javaw nie ma konsoli – do sprawdzenia wersji używamy java.exe z tego samego katalogu.
  const probeExe = IS_WIN ? exe.replace(/javaw\.exe$/i, 'java.exe') : exe;
  const target = fs.existsSync(probeExe) ? probeExe : exe;
  return new Promise((resolve) => {
    execFile(target, ['-version'], { timeout: 8000, windowsHide: true }, (_err, stdout, stderr) => {
      const match = `${stderr}${stdout}`.match(/version "([^"]+)"/);
      resolve(match ? { path: exe, version: match[1], major: parseMajor(match[1]) } : null);
    });
  });
}

/** Szuka bin/java(w) w katalogu do zadanej głębokości. */
function findJavaIn(dir, depth = 4) {
  const found = [];
  const walk = (d, level) => {
    const direct = path.join(d, 'bin', JAVA_BIN);
    if (fs.existsSync(direct)) {
      found.push(direct);
      return;
    }
    if (level <= 0) return;
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) if (e.isDirectory()) walk(path.join(d, e.name), level - 1);
  };
  walk(dir, depth);
  return found;
}

function whichAll() {
  return new Promise((resolve) => {
    execFile(IS_WIN ? 'where' : 'which', IS_WIN ? ['java'] : ['-a', 'java'], { windowsHide: true }, (err, out) => {
      if (err) return resolve([]);
      resolve(
        out
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((p) => (IS_WIN ? p.replace(/java\.exe$/i, 'javaw.exe') : p))
      );
    });
  });
}

function searchRoots(gameDir) {
  const roots = [runtimeRoot(), path.join(gameDir, 'runtime')];
  if (process.env.JAVA_HOME) roots.push(process.env.JAVA_HOME);
  if (IS_WIN) {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) {
      for (const vendor of ['Java', 'Eclipse Adoptium', 'Microsoft', 'Zulu', 'BellSoft', 'Amazon Corretto']) {
        roots.push(path.join(base, vendor));
      }
    }
    if (process.env.LOCALAPPDATA) {
      // Runtime oficjalnego launchera (wersja ze Microsoft Store).
      roots.push(
        path.join(process.env.LOCALAPPDATA, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime')
      );
    }
  } else if (process.platform === 'darwin') {
    roots.push('/Library/Java/JavaVirtualMachines', path.join(os.homedir(), 'Library/Java/JavaVirtualMachines'));
  } else {
    roots.push('/usr/lib/jvm', '/usr/java', '/opt');
  }
  return roots;
}

async function detectAll(gameDir) {
  const candidates = new Set(await whichAll());
  for (const root of searchRoots(gameDir)) {
    if (fs.existsSync(root)) findJavaIn(root).forEach((p) => candidates.add(p));
  }
  const results = await Promise.all([...candidates].map(probe));
  const unique = new Map();
  for (const r of results) if (r && !unique.has(r.path.toLowerCase())) unique.set(r.path.toLowerCase(), r);
  return [...unique.values()].sort((a, b) => b.major - a.major);
}

function pick(installed, major) {
  const exact = installed.find((j) => j.major === major);
  if (exact) return exact;
  // Od Javy 17 nowsze wersje są w praktyce kompatybilne wstecz dla MC.
  if (major >= 17) return installed.filter((j) => j.major >= major).sort((a, b) => a.major - b.major)[0];
  return null;
}

async function installTemurin(major, onProgress) {
  const feature = major === 16 ? 17 : major; // Java 16 -> 17 (MC 1.17 działa na 17)
  const osName = IS_WIN ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
  let arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  if (osName === 'mac' && feature === 8) arch = 'x64'; // brak JRE 8 na Apple Silicon -> Rosetta
  const url = `https://api.adoptium.net/v3/binary/latest/${feature}/ga/${osName}/${arch}/jre/hotspot/normal/eclipse`;

  const dest = path.join(runtimeRoot(), `java-${feature}`);
  const archive = path.join(runtimeRoot(), `java-${feature}${IS_WIN ? '.zip' : '.tar.gz'}`);
  await fs.promises.rm(dest, { recursive: true, force: true });
  await download(url, archive, onProgress);
  await fs.promises.mkdir(dest, { recursive: true });
  if (IS_WIN) await extractZip(archive, { dir: dest });
  else await tar.x({ file: archive, cwd: dest });
  await fs.promises.rm(archive, { force: true });

  const exe = findJavaIn(dest, 5)[0];
  if (!exe) throw new Error('Pobrana Java nie zawiera pliku wykonywalnego.');
  if (!IS_WIN) await fs.promises.chmod(exe, 0o755);
  return exe;
}

/**
 * Zwraca ścieżkę do Javy dla danej wersji MC.
 * Kolejność: ręczna ścieżka (gdy autoJava=false) -> wykryta zgodna -> pobranie Temurin.
 */
async function ensureJava(major, settings, onProgress) {
  if (!settings.autoJava && settings.javaPath) {
    const manual = await probe(settings.javaPath);
    if (!manual) throw new Error(`Nieprawidłowa ścieżka Javy: ${settings.javaPath}`);
    return manual.path;
  }
  const chosen = pick(await detectAll(settings.gameDir), major);
  if (chosen) return chosen.path;
  return installTemurin(major, onProgress);
}

module.exports = { detectAll, ensureJava, probe };

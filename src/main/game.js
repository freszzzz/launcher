// Orkiestracja startu gry: Java -> loader -> pobieranie plików (MCLC) -> proces gry.
const { EventEmitter } = require('events');
const fs = require('fs');
const { Client } = require('minecraft-launcher-core');
const versions = require('./versions');
const java = require('./java');
const fresh = require('./fresh');
const { freshDir, profileDir } = require('./store');

const MCLC_LABELS = {
  assets: 'Pobieranie zasobów',
  'assets-copy': 'Kopiowanie zasobów',
  natives: 'Biblioteki natywne',
  classes: 'Pobieranie bibliotek',
  'classes-custom': 'Biblioteki loadera',
  'classes-maven-custom': 'Biblioteki loadera',
  forge: 'Instalacja Forge'
};

class GameManager extends EventEmitter {
  constructor() {
    super();
    this.busy = false;
    this.proc = null;
    this.lastEmit = 0;
  }

  get running() {
    return this.busy;
  }

  progress(stage, label, current = 0, total = 0) {
    const now = Date.now();
    // Throttling – MCLC potrafi wysłać tysiące zdarzeń na sekundę.
    if (total && current < total && now - this.lastEmit < 60) return;
    this.lastEmit = now;
    this.emit('progress', {
      stage,
      label,
      current,
      total,
      percent: total ? Math.min(100, (current / total) * 100) : null
    });
  }

  state(state, extra = {}) {
    this.emit('state', { state, ...extra });
  }

  async launch({ account, settings, profile }) {
    if (this.busy) throw new Error('Gra jest już uruchomiona lub trwa instalacja.');
    this.busy = true;
    this.state('preparing');

    try {
      const { loader, version, loaderVersion } = profile || {};
      if (!version) throw new Error('Wybierz wersję gry w profilu (zakładka PROFILE).');
      const root = settings.gameDir;
      const gameDirectory = profileDir(settings, profile.id);
      await fs.promises.mkdir(gameDirectory, { recursive: true });

      // Mod Fresh (menu RSHIFT, kosmetyki, ikonka przy nicku) – tylko Fabric 1.21.10.
      fresh.writeShared(settings);
      if (fresh.modSupported(profile) && settings.autoInstallMod) {
        this.progress('mod', 'Instalacja moda Fresh…');
        await fresh.installMod(gameDirectory, (c, t) => this.progress('mod', 'Pobieranie Fabric API', c, t));
      } else {
        fresh.removeMod(gameDirectory);
      }

      this.progress('meta', `Metadane ${version}…`);
      const meta = await versions.getVersionMeta(version);
      const major = versions.requiredJava(meta);

      this.progress('java', `Szukanie Javy ${major}…`);
      const javaPath = await java.ensureJava(major, settings, (c, t) =>
        this.progress('java', `Pobieranie Javy ${major}`, c, t)
      );
      this.emit('log', `[Fresh] Java: ${javaPath}`);

      const opts = {
        root,
        javaPath,
        version: { number: version, type: meta.type === 'release' ? 'release' : 'snapshot' },
        memory: {
          max: `${settings.memoryMax}M`,
          min: `${Math.min(settings.memoryMin, settings.memoryMax)}M`
        },
        authorization: {
          access_token: account.mcToken,
          client_token: account.uuid,
          uuid: account.uuid,
          name: account.name,
          user_properties: '{}',
          meta: { type: 'msa', demo: false }
        },
        window: settings.fullscreen
          ? { fullscreen: true }
          : { width: Number(settings.width) || 1280, height: Number(settings.height) || 720 },
        customArgs: [
          `-Dfresh.dir=${freshDir(settings)}`,
          ...(settings.jvmArgs || '').split(/\s+/).filter(Boolean)
        ],
        overrides: { detached: false, gameDirectory },
        timeout: 20000
      };

      if (loader === 'fabric') {
        this.progress('loader', 'Instalacja Fabric…');
        opts.version.custom = await versions.installFabric(root, version, loaderVersion);
      } else if (loader === 'forge') {
        this.progress('loader', 'Pobieranie Forge…');
        opts.forge = await versions.downloadForgeInstaller(root, version, loaderVersion, (c, t) =>
          this.progress('loader', 'Pobieranie Forge', c, t)
        );
      }

      const client = new Client();
      client.on('debug', (line) => this.emit('log', String(line)));
      client.on('data', (line) => this.emit('log', String(line).trimEnd()));
      client.on('progress', (e) => this.progress('download', MCLC_LABELS[e.type] || e.type, e.task, e.total));
      client.on('download-status', (e) => {
        if (e.total > 1e6) this.progress('download', `Pobieranie ${e.name}`, e.current, e.total);
      });
      client.on('arguments', () => this.progress('launch', 'Uruchamianie JVM…'));
      client.on('close', (code) => {
        this.proc = null;
        this.busy = false;
        this.state('closed', { code });
      });

      this.progress('download', 'Weryfikacja plików gry…');
      const proc = await client.launch(opts);
      if (!proc) throw new Error('MCLC nie uruchomił gry – sprawdź logi w konsoli launchera.');

      this.proc = proc;
      this.progress('done', 'Gra uruchomiona!', 1, 1);
      this.state('running');
    } catch (err) {
      this.busy = false;
      this.proc = null;
      this.state('idle');
      throw err;
    }
  }

  kill() {
    if (this.proc) this.proc.kill();
  }
}

module.exports = { GameManager };

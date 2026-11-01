// Discord Rich Presence bez zależności: protokół IPC Discorda po named pipe (Windows) / gnieździe (Linux, macOS).
// Ramka = [op uint32 LE][długość uint32 LE][JSON]. op 0 = handshake, 1 = frame, 2 = close, 3/4 = ping/pong.
const net = require('net');
const os = require('os');
const path = require('path');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function pipePath(i) {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`;
  const dir = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || os.tmpdir();
  return path.join(dir, `discord-ipc-${i}`);
}

function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data), 'utf8');
  const head = Buffer.alloc(8);
  head.writeUInt32LE(op, 0);
  head.writeUInt32LE(json.length, 4);
  return Buffer.concat([head, json]);
}

class DiscordPresence {
  constructor() {
    this.clientId = '';
    this.enabled = false;
    this.socket = null;
    this.ready = false;
    this.activity = null;
    this.user = null;
    this.retry = null;
    this.buffer = Buffer.alloc(0);
    this.onStatus = () => {};
  }

  status() {
    return { enabled: this.enabled, configured: !!this.clientId, connected: this.ready, invalid: !!this.invalid, user: this.user };
  }

  configure({ enabled, clientId }) {
    const id = String(clientId || '').trim();
    const changed = id !== this.clientId;
    if (changed) this.invalid = false;
    this.clientId = /^\d{15,22}$/.test(id) ? id : '';
    this.enabled = !!enabled && !!this.clientId;
    if (!this.enabled || changed) this.disconnect();
    if (this.enabled && !this.socket) this.connect();
    this.onStatus(this.status());
  }

  connect(i = 0) {
    clearTimeout(this.retry);
    if (!this.enabled) return;
    if (i > 9) return this.scheduleRetry();
    const sock = net.createConnection(pipePath(i));
    let opened = false;
    sock.once('connect', () => {
      opened = true;
      this.socket = sock;
      this.buffer = Buffer.alloc(0);
      sock.write(encode(OP.HANDSHAKE, { v: 1, client_id: this.clientId }));
    });
    sock.on('data', (chunk) => this.receive(chunk));
    sock.on('error', () => {
      if (!opened) this.connect(i + 1);
    });
    sock.on('close', () => {
      if (!opened) return;
      this.socket = null;
      this.ready = false;
      this.user = null;
      this.onStatus(this.status());
      this.scheduleRetry();
    });
  }

  scheduleRetry() {
    clearTimeout(this.retry);
    if (this.enabled && !this.invalid) this.retry = setTimeout(() => this.connect(), 15000);
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 8) {
      const op = this.buffer.readUInt32LE(0);
      const len = this.buffer.readUInt32LE(4);
      if (this.buffer.length < 8 + len) return;
      let msg = null;
      try {
        msg = JSON.parse(this.buffer.subarray(8, 8 + len).toString('utf8'));
      } catch { /* pomijamy */ }
      this.buffer = this.buffer.subarray(8 + len);
      if (op === OP.PING) this.socket?.write(encode(OP.PONG, msg));
      else if (op === OP.CLOSE) {
        // 4000 = złe Application ID – nie ma sensu ponawiać, dopóki użytkownik go nie poprawi
        if (msg?.code === 4000) this.invalid = true;
        this.socket?.destroy();
      }
      else if (msg?.evt === 'READY') {
        this.ready = true;
        this.user = msg.data?.user ? { name: msg.data.user.global_name || msg.data.user.username, id: msg.data.user.id } : null;
        this.onStatus(this.status());
        this.flush();
      }
    }
  }

  setActivity(activity) {
    this.activity = activity;
    this.flush();
  }

  flush() {
    if (!this.ready || !this.socket) return;
    this.socket.write(
      encode(OP.FRAME, {
        cmd: 'SET_ACTIVITY',
        args: { pid: process.pid, activity: this.activity || undefined },
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`
      })
    );
  }

  disconnect() {
    clearTimeout(this.retry);
    if (this.socket) {
      try {
        this.socket.write(encode(OP.CLOSE, {}));
      } catch { /* już zamknięte */ }
      this.socket.destroy();
    }
    this.socket = null;
    this.ready = false;
    this.user = null;
  }
}

const LOADER = { vanilla: 'Vanilla', fabric: 'Fabric', forge: 'Forge' };
const PANEL = {
  home: 'Na stronie głównej',
  profiles: 'Przegląda profile',
  mods: 'Szuka modów',
  cosmetics: 'Przymierza kosmetyki',
  client: 'Ustawia moduły klienta',
  friends: 'Przegląda znajomych',
  settings: 'W ustawieniach'
};

/**
 * Buduje ładne activity dla stanu launchera / gry.
 * images: { large, small } – klucze assetów z Discord Developer Portal albo adresy https.
 */
function buildActivity({ state, panel, profile, status, startedAt, images = {}, showServer = true }) {
  const assets = {
    large_image: images.large || 'logo',
    large_text: 'Fresh Client – launcher Minecraft'
  };
  if (state !== 'game') {
    return {
      details: 'W launcherze Fresh Client',
      state: PANEL[panel] || 'Przygotowuje się do gry',
      timestamps: startedAt ? { start: Math.floor(startedAt / 1000) } : undefined,
      assets,
      instance: false
    };
  }
  const label = `${LOADER[profile?.loader] || 'Minecraft'} ${profile?.version || ''}`.trim();
  let where = 'W menu głównym';
  if (status?.state === 'single') where = 'Świat jednoosobowy';
  if (status?.state === 'multi') where = showServer && status.server ? `Serwer: ${status.server}` : 'Gra wieloosobowa';
  if (status?.state === 'realms') where = 'Realms';
  return {
    details: `Gra w Minecraft ${profile?.version || ''}`.trim(),
    state: where,
    timestamps: startedAt ? { start: Math.floor(startedAt / 1000) } : undefined,
    assets: {
      ...assets,
      small_image: images.small || (profile?.loader || 'vanilla'),
      small_text: `${label} · ${profile?.name || ''}`.trim()
    },
    instance: false
  };
}

module.exports = { DiscordPresence, buildActivity };

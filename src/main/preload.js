// Bezpieczny most renderer <-> main. Renderer nigdy nie widzi tokenów.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

async function invoke(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

const subscribe = (channel) => (cb) => {
  const handler = (_e, data) => cb(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => invoke('win:minimize'),
    close: () => invoke('win:close')
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (patch) => invoke('settings:set', patch),
    reset: (key) => invoke('settings:reset', key),
    pickDir: () => invoke('settings:pickDir'),
    pickJava: () => invoke('settings:pickJava'),
    openDir: () => invoke('settings:openDir')
  },
  auth: {
    current: () => invoke('auth:current'),
    login: () => invoke('auth:login'),
    logout: () => invoke('auth:logout')
  },
  profile: {
    textures: () => invoke('profile:textures'),
    setCape: (capeId) => invoke('profile:setCape', capeId)
  },
  profiles: {
    save: (profile) => invoke('profiles:save', profile),
    remove: (id) => invoke('profiles:delete', id),
    select: (id) => invoke('profiles:select', id),
    openDir: (id) => invoke('profiles:openDir', id)
  },
  cosmetics: {
    save: (cosmetic) => invoke('cosmetics:save', cosmetic),
    onChanged: subscribe('cosmetics:changed')
  },
  modules: {
    get: () => invoke('modules:get'),
    set: (id, on) => invoke('modules:set', id, on),
    setKey: (id, field, code) => invoke('modules:setKey', id, field, code)
  },
  server: {
    stats: () => invoke('server:stats')
  },
  friends: {
    list: () => invoke('friends:list'),
    add: (name) => invoke('friends:add', name),
    action: (action, uuid) => invoke('friends:action', action, uuid),
    avatar: (uuid) => invoke('friends:avatar', uuid)
  },
  mods: {
    search: (profileId, opts) => invoke('mods:search', profileId, opts),
    list: (profileId) => invoke('mods:list', profileId),
    install: (profileId, projectId) => invoke('mods:install', profileId, projectId),
    toggle: (profileId, file, on) => invoke('mods:toggle', profileId, file, on),
    remove: (profileId, file) => invoke('mods:remove', profileId, file),
    pick: (profileId) => invoke('mods:pick', profileId),
    openDir: (profileId) => invoke('mods:openDir', profileId),
    // przeciągnięte pliki: ścieżkę odczytujemy tutaj, renderer jej nie zna
    addDropped: (profileId, files) => invoke('mods:add', profileId, [...files].map((f) => webUtils.getPathForFile(f)).filter(Boolean)),
    onProgress: subscribe('mods:progress')
  },
  rewards: {
    state: () => invoke('rewards:state'),
    open: (kind) => invoke('rewards:open', kind),
    buy: (id) => invoke('rewards:buy', id)
  },
  stats: {
    summary: () => invoke('stats:summary')
  },
  discord: {
    status: () => invoke('discord:status'),
    panel: (name) => invoke('discord:panel', name),
    onStatus: subscribe('discord:status')
  },
  versions: {
    list: (loader, snapshots) => invoke('versions:list', loader, snapshots),
    loaderVersions: (loader, game) => invoke('versions:loaderVersions', loader, game)
  },
  java: {
    detect: () => invoke('java:detect')
  },
  game: {
    launch: (profileId) => invoke('game:launch', profileId),
    kill: () => invoke('game:kill'),
    onProgress: subscribe('game:progress'),
    onState: subscribe('game:state'),
    onLog: subscribe('game:log')
  }
});

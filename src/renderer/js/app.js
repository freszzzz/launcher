// Kontroler aplikacji: spina API procesu głównego z interfejsem.
window.Fresh = window.Fresh || {};

(() => {
  const { $, $$, esc, toast, modal, confirm, showPanel } = Fresh.ui;
  const api = window.api;

  let settings = null;
  let account = null;
  let gameState = 'idle';

  const { LOADER_NAME } = Fresh.brand;

  // ustawienia (zapis z debounce
  let saveTimer = null;
  let pending = {};
  function save(patch, immediate = false) {
    Object.assign(settings, patch);
    Object.assign(pending, patch);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, immediate ? 0 : 350);
  }
  async function flush() {
    const patch = pending;
    pending = {};
    if (!Object.keys(patch).length) return;
    try {
      await api.settings.set(patch);
      const flash = $('#saved-flash');
      flash.classList.remove('show');
      void flash.offsetWidth;
      flash.classList.add('show');
    } catch (err) {
      toast({ type: 'error', title: 'ZAPIS', message: err.message });
    }
  }

  // profile – pomocnicze
  const profiles = () => settings.profiles;
  const selected = () => profiles().find((p) => p.id === settings.selectedProfile) || profiles()[0];
  const profileLabel = (p) => `${LOADER_NAME[p.loader]} ${p.version || '—'}`;
  const modOk = (p) => p.loader === 'fabric' && p.version === settings.modVersion;

  const ago = (ts) => Fresh.profiles.ago(ts);
  const profileIcon = (p, large = false) => Fresh.brand.profileIcon(p, large ? 'lg' : 'md');

  function profileRow(p, onClick) {
    const row = document.createElement('div');
    row.className = 'profile-row';
    row.classList.toggle('is-selected', p.id === settings.selectedProfile);
    row.appendChild(profileIcon(p));
    const meta = document.createElement('div');
    meta.className = 'profile-meta';
    meta.innerHTML = `<strong>${esc(p.name)}</strong>
      <small>${esc(profileLabel(p))} · ${esc(ago(p.lastPlayed))}${modOk(p) ? ' <span class="mod-badge">MOD Fresh</span>' : ''}</small>`;
    row.appendChild(meta);
    const playBtn = document.createElement('button');
    playBtn.className = 'px-btn px-btn--green px-btn--sm tex';
    playBtn.innerHTML = '<i class="ico" data-ico="play" data-size="14"></i> Graj';
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      play(p.id);
    });
    row.append(playBtn);
    row.addEventListener('click', onClick);
    Fresh.svg.render(row);
    return row;
  }

  // strona główna
  function renderHome() {
    const list = $('#recent-profiles');
    const items = [...profiles()]
      .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
      .slice(0, 3);
    list.innerHTML = '';
    if (!items.length) list.innerHTML = '<div class="empty-box">Brak profili.</div>';
    items.forEach((p) => list.appendChild(profileRow(p, () => selectProfile(p.id))));

    const sel = selected();
    $('#play-profile').textContent = sel.name;
    $('#play-version').textContent = `${profileLabel(sel)}${modOk(sel) ? ' · mod Fresh' : ''}`;
    const pick = $('#picker-icon');
    if (pick) {
      pick.innerHTML = '';
      pick.appendChild(profileIcon(sel));
    }
  }

  /** Szybki wybór profilu z docka. */
  function profilePicker() {
    const rows = profiles()
      .map((p) => `<button class="menu-item" data-id="${esc(p.id)}">
        <span class="mi-icon" data-pid="${esc(p.id)}"></span>
        <span class="mi-text"><strong>${esc(p.name)}</strong><small>${esc(profileLabel(p))}</small></span>
        ${p.id === settings.selectedProfile ? '<i class="ico" data-ico="check" data-size="16"></i>' : ''}
      </button>`)
      .join('');
    const m = modal({
      title: 'Wybierz profil',
      html: `<div class="menu-list">${rows}
        <button class="menu-item" data-id="__new"><i class="ico" data-ico="plus" data-size="18"></i> Nowy profil</button></div>`,
      actions: [{ label: 'Zarządzaj profilami', variant: 'white', value: 'manage' }]
    });
    document.querySelectorAll('.mi-icon').forEach((el) => {
      const p = profiles().find((x) => x.id === el.dataset.pid);
      if (p) el.appendChild(profileIcon(p));
    });
    Fresh.svg.render(document.querySelector('.modal'));
    document.querySelectorAll('.menu-item[data-id]').forEach((b) =>
      b.addEventListener('click', () => {
        m.close(null);
        if (b.dataset.id === '__new') Fresh.profiles.create();
        else selectProfile(b.dataset.id);
      })
    );
    m.result.then((v) => v === 'manage' && showPanel('profiles'));
  }

  async function selectProfile(id) {
    settings.selectedProfile = id;
    await api.profiles.select(id);
    renderHome();
    Fresh.profiles.render();
  }

  const NEWS = [
    ...(window.FreshRewards.activeEvent()?.id === 'halloween'
      ? [{ tag: '🎃 EVENT', title: 'Halloween w Fresh', sub: 'Dyniowa skrzynka · 11 limitowanych kosmetyków', colors: ['#3b0764', '#f97316', '#fde68a'], go: 'rewards' }]
      : []),
    { tag: 'CODZIENNIE', title: 'Darmowa skrzynka', sub: 'Losuj kosmetyk – seria 7 dni = epicki', colors: ['#0d9488', '#f59e0b', '#fde68a'], go: 'rewards' },
    { tag: 'NOWOŚĆ', title: 'Mody z Modrinth', sub: 'Szukaj i instaluj jednym kliknięciem', colors: ['#0f766e', '#22c55e', '#d1fae5'], go: 'mods' },
    { tag: 'DISCORD', title: 'Rich Presence', sub: 'Znajomi widzą, że grasz na Fresh', colors: ['#4f46e5', '#0ea5e9', '#ffffff'], go: 'settings' },
    { tag: 'GARDEROBA', title: '39 kosmetyków 3D', sub: 'Peleryny Fresh i Mojang osobno', colors: ['#0891b2', '#a855f7', '#fde68a'], go: 'cosmetics' },
    { tag: 'W GRZE', title: 'Menu pod R-SHIFT', sub: '25 modułów, freelook i edytor HUD', colors: ['#f97316', '#e11d48', '#ffffff'], go: 'client' }
  ];

  /** Mini-scena pixel-art jako baner wiadomości: gradient, góry, bloki i iskry. */
  function newsBanner(colors, seed) {
    const W = 96;
    const H = 40;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    let s = seed * 977;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    // góry z pikseli
    x.fillStyle = 'rgba(20, 10, 40, .28)';
    for (let i = 0; i < W; i++) {
      const h = 14 + Math.round(Math.sin(i / 9 + seed) * 5 + Math.sin(i / 3.7 + seed * 2) * 2);
      x.fillRect(i, H - h, 1, h);
    }
    x.fillStyle = 'rgba(20, 10, 40, .4)';
    for (let i = 0; i < W; i++) {
      const h = 7 + Math.round(Math.sin(i / 6 + seed * 3) * 3);
      x.fillRect(i, H - h, 1, h);
    }
    // pływające bloki
    for (let k = 0; k < 5; k++) {
      const bx = Math.floor(rand() * (W - 8));
      const by = Math.floor(4 + rand() * 18);
      const bs = 3 + Math.floor(rand() * 4);
      x.fillStyle = 'rgba(255,255,255,.22)';
      x.fillRect(bx, by, bs, bs);
      x.fillStyle = 'rgba(255,255,255,.35)';
      x.fillRect(bx, by, bs, 1);
    }
    // iskry
    for (let k = 0; k < 30; k++) {
      x.globalAlpha = 0.3 + rand() * 0.6;
      x.fillStyle = colors[2];
      x.fillRect(Math.floor(rand() * W), Math.floor(rand() * (H - 12)), 1, 1);
    }
    x.globalAlpha = 1;
    return c;
  }

  let newsIndex = 0;
  let newsTimer = null;

  function showNews(i) {
    newsIndex = (i + NEWS.length) % NEWS.length;
    const list = $('#news-list');
    list.scrollTo({ left: newsIndex * list.clientWidth, behavior: 'smooth' });
    document.querySelectorAll('#news-dots button').forEach((d, k) => d.classList.toggle('is-active', k === newsIndex));
  }

  function renderNews() {
    const list = $('#news-list');
    const dots = $('#news-dots');
    list.innerHTML = '';
    dots.innerHTML = '';
    NEWS.forEach((n, i) => {
      const el = document.createElement('button');
      el.className = 'news-card';
      el.appendChild(newsBanner(n.colors, i + 1));
      el.insertAdjacentHTML('beforeend', `<span class="news-tag">${esc(n.tag)}</span><strong>${esc(n.title)}</strong><small>${esc(n.sub)}</small>`);
      el.addEventListener('click', () => showPanel(n.go));
      list.appendChild(el);
      const d = document.createElement('button');
      d.title = n.title;
      d.addEventListener('click', () => {
        showNews(i);
        restartNews();
      });
      dots.appendChild(d);
    });
    showNews(0);
    restartNews();
  }

  function restartNews() {
    clearInterval(newsTimer);
    newsTimer = setInterval(() => showNews(newsIndex + 1), 6000);
  }

  async function refreshServer() {
    const el = $('#server-status');
    const s = await api.server.stats().catch(() => null);
    const dot = $('#net-dot');
    if (!s || !s.configured) {
      el.textContent = 'Sieć Fresh: brak adresu serwera (Ustawienia)';
      if (dot) dot.className = 'dot dot--amber';
    } else if (s.error) {
      el.textContent = 'Sieć Fresh: serwer offline';
      if (dot) dot.className = 'dot dot--red';
    } else {
      el.textContent = `Sieć Fresh · ${s.online} online · ${s.users} graczy`;
      if (dot) dot.className = 'dot dot--green';
    }
  }

  // konto
  function drawHead(dataUrl) {
    const canvas = $('#head-canvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 8, 8);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
      if (document.getElementById('dc-avatar')) renderDiscordPreview();
    };
    img.src = dataUrl;
  }

  async function loadTextures() {
    try {
      const t = await api.profile.textures();
      drawHead(t.skin || Fresh.cosmetics.defaultSkin());
      Fresh.cosmetics.setSkin(t.skin, t.slim, t.name);
      Fresh.cosmetics.setOfficial(t.capes);
    } catch (err) {
      toast({ type: 'warn', title: 'PROFIL', message: err.message });
      if (/zaloguj/i.test(err.message)) setAccount(null);
    }
  }

  function setAccount(a) {
    account = a;
    $('#account-name').textContent = a ? a.name : 'Zaloguj się';
    $('#hero-nick').textContent = a ? a.name : 'Gość';
    $('#welcome-nick').textContent = a ? a.name : 'Graczu';
    if (a) loadTextures();
    else {
      drawHead(Fresh.cosmetics.defaultSkin());
      Fresh.cosmetics.setSkin(null, false, null);
      Fresh.cosmetics.setOfficial([]);
    }
  }

  async function login() {
    const waiting = modal({
      title: 'LOGOWANIE MICROSOFT',
      html: `<p>Dokończ logowanie w otwartym oknie Microsoft.</p>
             <div class="wait"><span class="px-spinner"></span> Czekam na autoryzację…</div>`,
      dismissable: false
    });
    try {
      const a = await api.auth.login();
      waiting.close();
      setAccount(a);
      toast({ type: 'success', title: 'ZALOGOWANO', message: `Witaj, ${a.name}!` });
    } catch (err) {
      waiting.close();
      const cancelled = /anulowan|zamknięto/i.test(err.message);
      toast({ type: cancelled ? 'info' : 'error', title: 'LOGOWANIE', message: err.message, timeout: cancelled ? 4000 : 8000 });
    }
  }

  async function accountMenu() {
    if (!account) return login();
    const m = modal({
      title: account.name.toUpperCase(),
      html: `<div class="menu-list">
        <button class="menu-item" data-act="cos"><i class="ico" data-ico="shirt" data-size="18"></i> Kosmetyki i skin</button>
        <button class="menu-item" data-act="refresh"><i class="ico" data-ico="refresh" data-size="18"></i> Odśwież skin i peleryny</button>
        <button class="menu-item" data-act="switch"><i class="ico" data-ico="user" data-size="18"></i> Zmień konto</button>
        <button class="menu-item" data-act="logout"><i class="ico" data-ico="logout" data-size="18"></i> Wyloguj</button>
      </div>`,
      actions: [{ label: 'ZAMKNIJ', variant: 'white', value: null }]
    });
    Fresh.svg.render();
    document.querySelectorAll('.menu-item').forEach((b) =>
      b.addEventListener('click', async () => {
        m.close(null);
        const act = b.dataset.act;
        if (act === 'cos') showPanel('cosmetics');
        if (act === 'refresh') loadTextures();
        if (act === 'switch') login();
        if (act === 'logout' && (await confirm('WYLOGOWAĆ?', 'Token zostanie usunięty z tego komputera.', 'WYLOGUJ', 'red'))) {
          await api.auth.logout();
          setAccount(null);
          toast({ type: 'info', title: 'KONTO', message: 'Wylogowano.' });
        }
      })
    );
  }

  // panel profili
  function initProfiles() {
    Fresh.profiles.init({
      settings: () => settings,
      play: (id) => play(id),
      select: (id) => selectProfile(id),
      changed: () => {
        renderHome();
        Fresh.profiles.render();
      },
      openMods: (id) => {
        showPanel('mods');
        Fresh.modsBrowser.show(id);
      }
    });
    Fresh.modsBrowser.init({ settings: () => settings });
    $('#btn-new-profile').addEventListener('click', () => Fresh.profiles.create());
    $('#btn-manage-profiles').addEventListener('click', () => showPanel('profiles'));
    Fresh.profiles.render();
  }

  // Discord Rich Presence
  function renderDiscordPreview() {
    const sel = selected();
    $('#dc-name').textContent = account ? account.name : 'Gracz';
    $('#dc-details').textContent = `Gra w Minecraft ${sel?.version || ''}`;
    $('#dc-line2').textContent = settings.discordShowServer ? 'Serwer: play.twojserwer.pl' : 'Gra wieloosobowa';
    const small = $('#dc-small');
    small.innerHTML = '';
    if (sel) small.appendChild(Fresh.brand.profileIcon({ icon: { vanilla: 'grass', fabric: 'fresh', forge: 'gold' }[sel.loader] }, 'xs'));
    small.title = sel ? profileLabel(sel) : '';
    const head = $('#head-canvas');
    const av = $('#dc-avatar');
    av.getContext('2d').clearRect(0, 0, 8, 8);
    av.getContext('2d').drawImage(head, 0, 0);
  }

  function renderDiscordState(s) {
    const el = $('#dc-state');
    if (!s || !settings.discordRpc) {
      el.textContent = 'wyłączone';
      el.className = 'dc-state';
    } else if (!s.configured) {
      el.textContent = 'wpisz Application ID';
      el.className = 'dc-state is-warn';
    } else if (s.invalid) {
      el.textContent = 'nieprawidłowe Application ID';
      el.className = 'dc-state is-warn';
    } else if (s.connected) {
      el.textContent = s.user ? `połączono · ${s.user.name}` : 'połączono';
      el.className = 'dc-state is-on';
    } else {
      el.textContent = 'czekam na Discorda…';
      el.className = 'dc-state is-warn';
    }
  }

  function initDiscord() {
    bindToggle('#toggle-discord', settings.discordRpc, (on) => {
      save({ discordRpc: on }, true);
      setTimeout(() => api.discord.status().then(renderDiscordState), 400);
    });
    bindToggle('#toggle-discord-server', settings.discordShowServer, (on) => {
      save({ discordShowServer: on }, true);
      renderDiscordPreview();
    });
    const id = $('#discord-id');
    id.value = settings.discordClientId;
    id.addEventListener('change', () => {
      const v = id.value.replace(/\D/g, '');
      id.value = v;
      save({ discordClientId: v }, true);
      setTimeout(() => api.discord.status().then(renderDiscordState), 600);
    });
    api.discord.onStatus(renderDiscordState);
    api.discord.status().then(renderDiscordState).catch(() => {});
    let sec = 12;
    setInterval(() => {
      sec++;
      const t = $('#dc-time');
      if (t) t.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')} upłynęło`;
    }, 1000);
    renderDiscordPreview();
  }

  // mody w grze
  const CATEGORY_ICON = { hud: 'monitor', render: 'sparkles', move: 'keyboard', misc: 'star' };
  const MODULE_ICON = {
    fps: 'monitor', cps: 'cpu', keystrokes: 'keyboard', coords: 'globe', armor: 'shield', potions: 'flask',
    clock: 'clock', ping: 'server', direction: 'compass', speed: 'gauge', memory: 'cpu', server: 'server',
    day: 'sun', fullbright: 'sun', zoom: 'search', freelook: 'eye', crosshair: 'plus', nametag_self: 'user',
    nohurtcam: 'heart', weather: 'cloud', time: 'moon', lowfire: 'flame', togglesprint: 'play',
    nametag_icons: 'star', cosmetics: 'shirt', emotes: 'sparkles'
  };
  let moduleFilter = 'all';

  function renderModuleFilter() {
    const box = $('#module-filter');
    const cats = [['all', 'Wszystkie'], ...Object.entries(FreshModules.CATEGORIES)];
    box.innerHTML = '';
    for (const [id, label] of cats) {
      const count = id === 'all' ? FreshModules.MODULES.length : FreshModules.MODULES.filter((m) => m.category === id).length;
      const b = document.createElement('button');
      b.className = `chip${id === moduleFilter ? ' is-active' : ''}`;
      b.textContent = `${label} · ${count}`;
      b.addEventListener('click', () => {
        moduleFilter = id;
        renderModules();
      });
      box.appendChild(b);
    }
  }

  // skróty główne (zapisane w ustawieniach modułów; wartości domyślne jak w modzie)
  const MAIN_KEYS = [
    { id: 'interface', field: 'menuKey', label: 'Menu Fresh', sub: 'otwiera menu w grze', def: 344, icon: 'keyboard' },
    { id: 'zoom', field: 'key', label: 'Zoom', sub: 'przytrzymaj, kółko reguluje', def: 67, icon: 'search' },
    { id: 'freelook', field: 'key', label: 'Freelook', sub: 'rozglądanie się bez obracania', def: 342, icon: 'eye' },
    { id: 'emotes', field: 'key', label: 'Emotki 3D', sub: 'przytrzymaj – koło emotek', def: 66, icon: 'sparkles' }
  ];

  /** Wszystkie przypisane kody -> liczba użyć (do wykrywania konfliktów). */
  function keyUsage(state) {
    const codes = new Map();
    const bump = (c) => c !== Fresh.keys.NONE && codes.set(c, (codes.get(c) || 0) + 1);
    MAIN_KEYS.forEach((k) => bump(state[k.id]?.settings?.[k.field] ?? k.def));
    FreshModules.MODULES.forEach((m) => bump(state[m.id]?.key ?? Fresh.keys.NONE));
    return codes;
  }

  /** Przycisk skrótu: klik -> "Naciśnij klawisz…" -> zapis do modules.json. */
  function keyChip(id, field, code, codes) {
    const b = document.createElement('button');
    b.className = 'key-chip';
    const paint = (c) => {
      b.classList.toggle('is-empty', c === Fresh.keys.NONE);
      b.classList.toggle('is-conflict', c !== Fresh.keys.NONE && (codes.get(c) || 0) > 1);
      b.innerHTML = `<i class="ico" data-ico="keyboard" data-size="14"></i><span>${esc(Fresh.keys.name(c))}</span>`;
      b.title = b.classList.contains('is-conflict') ? 'Ten klawisz jest przypisany kilka razy' : 'Kliknij, aby zmienić (Esc – anuluj, Backspace – usuń)';
      Fresh.svg.render(b);
    };
    paint(code);
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      b.classList.add('is-listening');
      b.innerHTML = '<span>Naciśnij klawisz…</span>';
      const next = await Fresh.keys.capture();
      b.classList.remove('is-listening');
      if (next === null) return paint(code);
      await api.modules.setKey(id, field, next);
      toast({ type: 'success', title: 'Skrót zapisany', message: `${Fresh.keys.name(next)} – działa od razu, także w uruchomionej grze.`, timeout: 2600 });
      renderModules();
    });
    return b;
  }

  function renderMainKeys(state, codes) {
    const box = $('#main-keys');
    if (!box) return;
    box.innerHTML = '';
    for (const k of MAIN_KEYS) {
      const row = document.createElement('div');
      row.className = 'main-key';
      row.innerHTML = `<span class="mk-ico"><i class="ico" data-ico="${k.icon}" data-size="18"></i></span>
        <span class="mk-text"><strong>${esc(k.label)}</strong><small>${esc(k.sub)}</small></span>`;
      row.appendChild(keyChip(k.id, k.field, state[k.id]?.settings?.[k.field] ?? k.def, codes));
      box.appendChild(row);
    }
    Fresh.svg.render(box);
  }

  async function renderModules() {
    renderModuleFilter();
    const grid = $('#module-grid');
    const state = await api.modules.get().catch(() => ({}));
    const codes = keyUsage(state);
    renderMainKeys(state, codes);
    grid.innerHTML = '';
    for (const m of FreshModules.MODULES.filter((x) => moduleFilter === 'all' || x.category === moduleFilter)) {
      const on = state[m.id]?.on ?? m.on;
      const card = document.createElement('div');
      card.className = 'module-card px-box';
      card.innerHTML = `<span class="mod-ico cat-${m.category}"><i class="ico" data-ico="${MODULE_ICON[m.id] || CATEGORY_ICON[m.category] || 'info'}"></i></span>
        <span><span class="cat">${esc(FreshModules.CATEGORIES[m.category])}</span><br><strong>${esc(m.name)}</strong></span>
        <button class="px-toggle" role="switch" aria-checked="${on}"></button>
        <small>${esc(m.desc)}</small>
        <div class="card-foot"><span class="eyebrow">Skrót</span></div>`;
      const t = card.querySelector('.px-toggle');
      t.addEventListener('click', async () => {
        const next = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', String(next));
        await api.modules.set(m.id, next);
      });
      card.querySelector('.card-foot').appendChild(keyChip(m.id, 'toggle', state[m.id]?.key ?? Fresh.keys.NONE, codes));
      grid.appendChild(card);
    }
    Fresh.svg.render(grid);
  }

  /** Pora dnia sceny + powitanie i zegar dopasowane do godziny. */
  function initTheme() {
    const W = Fresh.world;
    const MODE_LABEL = { auto: 'Auto', dawn: 'Świt', day: 'Dzień', dusk: 'Zmierzch', night: 'Noc' };
    const sync = () => {
      const phase = W.PHASES[W.phase()];
      $('#tb-phase-label').textContent = MODE_LABEL[W.mode()];
      $('#tb-theme i').dataset.ico = phase.icon;
      $('#phase-label').textContent = phase.label;
      $('#phase-chip i').dataset.ico = phase.icon;
      Fresh.svg.render($('#tb-theme'));
      Fresh.svg.render($('#phase-chip'));
      const sel = $('#scene-phase');
      if (sel) sel.value = W.mode();
    };
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      $('#clock').textContent = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
      $('#greet-word').textContent = h >= 5 && h < 12 ? 'Dzień dobry' : h >= 12 && h < 18 ? 'Miłego dnia' : 'Dobry wieczór';
    };
    $('#tb-theme').addEventListener('click', () => W.cycle());
    $('#scene-phase')?.addEventListener('change', (e) => W.setMode(e.target.value));
    window.addEventListener('fresh-phase', sync);
    sync();
    tick();
    setInterval(tick, 15000);
  }

  // ustawienia
  function bindToggle(sel, initial, onChange) {
    const el = $(sel);
    el.setAttribute('aria-checked', String(!!initial));
    el.addEventListener('click', () => {
      const on = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', String(on));
      onChange(on);
    });
  }

  function renderRam() {
    const range = $('#ram-range');
    const val = Number(range.value);
    const max = Number(range.max);
    const min = Number(range.min);
    range.style.setProperty('--fill', `${((val - min) / (max - min)) * 100}%`);
    $('#ram-value').textContent = `${val} MB`;
    const meter = $('#ram-meter');
    const cells = 24;
    if (meter.children.length !== cells) meter.innerHTML = '<i></i>'.repeat(cells);
    const ratio = val / settings.totalMemMb;
    [...meter.children].forEach((c, i) => {
      const on = i < Math.round(ratio * cells);
      c.className = on ? (ratio > 0.75 ? 'danger' : ratio > 0.55 ? 'warn' : 'on') : '';
    });
    $('#ram-hint').textContent =
      ratio > 0.75
        ? `Uwaga: to ${Math.round(ratio * 100)}% całej pamięci (${settings.totalMemMb} MB) – system może zwolnić.`
        : 'Zalecane: 4–6 GB dla vanilli, 6–8 GB dla modpacków.';
  }

  function syncResolution() {
    const key = `${settings.width}x${settings.height}`;
    const preset = $('#res-preset');
    preset.value = [...preset.options].some((o) => o.value === key) ? key : 'custom';
    $('#res-w').value = settings.width;
    $('#res-h').value = settings.height;
  }

  async function detectJava() {
    const list = $('#java-list');
    list.innerHTML = '<div class="loading-row"><span class="px-spinner"></span> Skanowanie…</div>';
    try {
      const javas = await api.java.detect();
      if (!javas.length) {
        list.innerHTML = '<p class="muted">Nie znaleziono Javy – launcher pobierze ją automatycznie.</p>';
        return;
      }
      list.innerHTML = '';
      javas.forEach((j) => {
        const b = document.createElement('button');
        b.className = 'java-chip';
        b.classList.toggle('is-selected', j.path === settings.javaPath);
        b.title = j.path;
        b.innerHTML = `<b>JAVA ${j.major}</b> ${esc(j.version)}`;
        b.addEventListener('click', () => {
          $('#java-path').value = j.path;
          save({ javaPath: j.path });
          $$('.java-chip').forEach((x) => x.classList.toggle('is-selected', x === b));
        });
        list.appendChild(b);
      });
    } catch (err) {
      list.innerHTML = `<p class="muted">Błąd: ${esc(err.message)}</p>`;
    }
  }

  function initSettings() {
    const range = $('#ram-range');
    range.max = String(Math.max(2048, Math.floor((settings.totalMemMb - 1024) / 512) * 512));
    range.value = String(settings.memoryMax);
    renderRam();
    range.addEventListener('input', () => {
      renderRam();
      save({ memoryMax: Number(range.value) });
    });

    syncResolution();
    $('#res-preset').addEventListener('change', (e) => {
      if (e.target.value === 'custom') return $('#res-w').focus();
      const [w, h] = e.target.value.split('x').map(Number);
      save({ width: w, height: h });
      syncResolution();
    });
    ['#res-w', '#res-h'].forEach((sel) =>
      $(sel).addEventListener('change', () => {
        save({ width: Number($('#res-w').value) || 1280, height: Number($('#res-h').value) || 720 });
        syncResolution();
      })
    );
    bindToggle('#toggle-fullscreen', settings.fullscreen, (on) => save({ fullscreen: on }));

    $('#game-dir').value = settings.gameDir;
    $('#btn-pick-dir').addEventListener('click', async () => {
      const s = await api.settings.pickDir();
      settings.gameDir = s.gameDir;
      $('#game-dir').value = s.gameDir;
    });
    $('#btn-open-dir').addEventListener('click', () => api.settings.openDir());
    $('#btn-reset-dir').addEventListener('click', () => {
      save({ gameDir: settings.defaultGameDir }, true);
      $('#game-dir').value = settings.defaultGameDir;
    });

    const javaManual = $('#java-manual');
    javaManual.classList.toggle('is-disabled', settings.autoJava);
    bindToggle('#toggle-autojava', settings.autoJava, (on) => {
      save({ autoJava: on });
      javaManual.classList.toggle('is-disabled', on);
    });
    $('#java-path').value = settings.javaPath;
    $('#java-path').addEventListener('change', (e) => save({ javaPath: e.target.value.trim() }));
    $('#btn-pick-java').addEventListener('click', async () => {
      const j = await api.settings.pickJava().catch((err) => toast({ type: 'error', message: err.message }));
      if (!j) return;
      $('#java-path').value = j.path;
      save({ javaPath: j.path });
      toast({ type: 'success', title: 'JAVA', message: `Wykryto Javę ${j.major} (${j.version}).` });
    });
    $('#btn-detect-java').addEventListener('click', detectJava);
    $('#jvm-args').value = settings.jvmArgs;
    $('#jvm-args').addEventListener('change', (e) => save({ jvmArgs: e.target.value }));

    bindToggle('#toggle-close', settings.closeOnLaunch, (on) => save({ closeOnLaunch: on }));
    bindToggle('#toggle-particles', settings.particles, (on) => {
      save({ particles: on });
      Fresh.world.setEnabled(on);
    });
    bindToggle('#toggle-modinstall', settings.autoInstallMod, (on) => save({ autoInstallMod: on }, true));
    $('#server-url').value = settings.serverUrl;
    $('#server-url').addEventListener('change', async (e) => {
      save({ serverUrl: e.target.value.trim() }, true);
      setTimeout(refreshServer, 500);
    });
    $('#client-id').value = settings.msClientId;
    $('#client-id').addEventListener('change', (e) => save({ msClientId: e.target.value.trim() }));
  }

  // gra
  function log(line) {
    const out = $('#console-out');
    out.textContent += `${line}\n`;
    if (out.textContent.length > 60000) out.textContent = out.textContent.slice(-40000);
    out.scrollTop = out.scrollHeight;
  }

  function setStatus(text, dot) {
    $('#tb-status').innerHTML = `<span class="dot dot--${dot}"></span><span>${esc(text)}</span>`;
  }

  function setPlayState(state) {
    gameState = state;
    const btn = $('#btn-play');
    btn.classList.toggle('is-busy', state !== 'idle');
    btn.disabled = state !== 'idle';
    $('#rail-play').disabled = state !== 'idle';
    $('#play-label').textContent = { idle: 'Graj', preparing: 'Ładowanie…', running: 'W grze' }[state] || 'Graj';
    setStatus({ idle: 'Gotowy', preparing: 'Przygotowanie gry…', running: 'Gra uruchomiona' }[state], { idle: 'green', preparing: 'amber', running: 'violet' }[state]);
    if (state === 'running') Fresh.world.stop();
    else if (settings.particles) Fresh.world.start();
  }

  async function play(profileId = settings.selectedProfile) {
    if (gameState !== 'idle') return;
    if (!account) {
      Fresh.ui.shake($('#account-chip'));
      toast({ type: 'warn', title: 'KONTO', message: 'Najpierw zaloguj się kontem Microsoft.' });
      showPanel('home');
      return;
    }
    const p = profiles().find((x) => x.id === profileId);
    if (!p?.version) {
      toast({ type: 'warn', title: 'PROFIL', message: 'Wybierz wersję gry dla profilu.' });
      Fresh.profiles.edit(profileId);
      return;
    }
    clearTimeout(saveTimer);
    await flush();
    showPanel('home');
    setPlayState('preparing');
    Fresh.progress.set({ label: 'Przygotowanie…', percent: null });
    try {
      await api.game.launch(profileId);
      p.lastPlayed = Date.now();
      settings.selectedProfile = profileId;
      renderHome();
    } catch (err) {
      setPlayState('idle');
      Fresh.progress.fail('Nie udało się uruchomić');
      toast({ type: 'error', title: 'START GRY', message: err.message, timeout: 9000 });
      log(`[błąd] ${err.message}`);
    }
  }

  function initGame() {
    $('#btn-play').addEventListener('click', () => play());
    $('#rail-play').addEventListener('click', () => play());
    $('#btn-logs').addEventListener('click', () => {
      $('#console').hidden = !$('#console').hidden;
    });
    $('#btn-console-close').addEventListener('click', () => {
      $('#console').hidden = true;
    });
    $('#btn-kill').addEventListener('click', async () => {
      if (gameState !== 'running') return toast({ type: 'info', title: 'GRA', message: 'Gra nie jest uruchomiona.' });
      if (await confirm('ZAMKNĄĆ GRĘ?', 'Niezapisany postęp zostanie utracony.', 'ZAMKNIJ', 'red')) api.game.kill();
    });

    api.game.onProgress((p) => {
      if (p.stage === 'done') Fresh.progress.complete('Gra uruchomiona!');
      else Fresh.progress.set(p);
    });
    api.game.onLog(log);
    api.game.onState((s) => {
      if (s.state === 'running') {
        setPlayState('running');
        toast({ type: 'success', title: 'MINECRAFT', message: 'Gra wystartowała. W grze: PRAWY SHIFT = menu Fresh.' });
      } else if (s.state === 'closed') {
        setPlayState('idle');
        Fresh.progress.reset();
        renderModules();
        if (s.code && s.code !== 0) {
          toast({ type: 'error', title: 'GRA ZAMKNIĘTA', message: `Kod wyjścia ${s.code} – sprawdź KONSOLĘ.`, timeout: 8000 });
          $('#console').hidden = false;
        } else {
          toast({ type: 'info', title: 'MINECRAFT', message: 'Gra została zamknięta.' });
        }
      } else if (s.state === 'preparing') {
        setPlayState('preparing');
      }
    });
    api.cosmetics.onChanged((c) => {
      settings.cosmetic = c;
      Fresh.cosmetics.sync(c);
      toast({ type: 'info', title: 'KOSMETYKI', message: 'Wczytano zmiany z gry.' });
    });
  }

  // start
  async function boot() {
    Fresh.brand.renderLogos();
    Fresh.svg.render();
    Fresh.ui.initNav();
    const ev = window.FreshRewards.activeEvent();
    if (ev) Fresh.world.setEvent(ev.id);
    initTheme();

    $('#tb-min').addEventListener('click', () => api.window.minimize());
    $('#tb-close').addEventListener('click', () => api.window.close());
    $('#account-chip').addEventListener('click', accountMenu);
    $('#hero-name').addEventListener('click', () => showPanel('cosmetics'));
    $('#hero-edit').addEventListener('click', () => showPanel('cosmetics'));
    $('#brand-mods').addEventListener('click', () => {
      showPanel('mods');
      Fresh.modsBrowser.show(settings.selectedProfile);
    });
    $('#brand-cos').addEventListener('click', () => showPanel('cosmetics'));
    $('#profile-picker').addEventListener('click', profilePicker);

    settings = await api.settings.get();
    Fresh.world.setEnabled(settings.particles);
    Fresh.cosmetics.init(settings.cosmetic);
    Fresh.ui.onPanel((name) => {
      Fresh.cosmetics.setActive(name);
      Fresh.world.setDim(name !== 'home');
      if (name === 'client') renderModules();
      if (name === 'mods') Fresh.modsBrowser.show();
      if (name === 'profiles') Fresh.profiles.render();
      if (name === 'settings') renderDiscordPreview();
      if (name === 'rewards') Fresh.rewards.refresh();
      if (name === 'stats') Fresh.stats.render(settings.profiles);
      if (name === 'friends' || name === 'home') Fresh.friends.refresh();
      api.discord.panel(name).catch(() => {});
    });
    Fresh.cosmetics.setActive('home');

    renderNews();
    renderHome();
    initProfiles();
    initSettings();
    initDiscord();
    Fresh.rewards.init();
    initGame();
    renderModules();
    refreshServer();
    setInterval(refreshServer, 60000);
    Fresh.friends.init();

    setAccount(await api.auth.current());
  }

  boot().catch((err) => {
    console.error(err);
    toast({ type: 'error', title: 'BŁĄD STARTU', message: err.message, timeout: 10000 });
  });
})();

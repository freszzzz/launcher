// Zakładka Mody: wyszukiwarka Modrinth + zainstalowane mody wybranego profilu + wgrywanie własnych .jar.
window.Fresh = window.Fresh || {};

(() => {
  const { $, esc, toast, confirm } = Fresh.ui;
  const api = window.api;
  const { LOADER_NAME } = Fresh.brand;
  const CATEGORIES = [
    ['', 'Wszystkie'], ['optimization', 'Wydajność'], ['utility', 'Narzędzia'], ['decoration', 'Dekoracje'],
    ['adventure', 'Przygoda'], ['technology', 'Technologia'], ['magic', 'Magia'], ['storage', 'Przechowywanie'],
    ['worldgen', 'Generowanie świata'], ['mobs', 'Moby'], ['food', 'Jedzenie'], ['library', 'Biblioteki']
  ];
  const CAT_PL = Object.fromEntries(CATEGORIES.filter(([id]) => id));
  Object.assign(CAT_PL, { equipment: 'Ekwipunek', social: 'Społeczność', 'game-mechanics': 'Mechanika', transportation: 'Transport', management: 'Zarządzanie', minigame: 'Minigry', cursed: 'Dziwne', economy: 'Ekonomia' });

  let ctx = null; // { settings(), selectProfile(id) }
  const state = { profileId: null, tab: 'discover', query: '', sort: 'relevance', category: '', offset: 0, total: 0, hits: [], installed: [], busy: new Map(), loading: false };
  let searchTimer = null;
  let searchSeq = 0;

  const profile = () => ctx.settings().profiles.find((p) => p.id === state.profileId);
  const moddable = () => ctx.settings().profiles.filter((p) => p.loader !== 'vanilla' && p.version);
  const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.0', '')} mln` : n >= 1e3 ? `${Math.round(n / 1e3)} tys.` : String(n));

  function pickDefaultProfile() {
    const s = ctx.settings();
    const list = moddable();
    if (list.some((p) => p.id === state.profileId)) return;
    const sel = list.find((p) => p.id === s.selectedProfile);
    state.profileId = (sel || list[0])?.id || null;
  }

  // nagłówek: wybór profilu
  function renderProfileSelect() {
    const box = $('#mods-profile');
    const p = profile();
    box.innerHTML = '';
    if (!p) {
      box.innerHTML = '<span class="muted">Brak profilu z modami</span>';
      return;
    }
    box.appendChild(Fresh.brand.profileIcon(p, 'sm'));
    box.insertAdjacentHTML('beforeend', `<span class="mp-text"><small>Mody instalują się do profilu</small><strong>${esc(p.name)}</strong><em>${esc(LOADER_NAME[p.loader])} ${esc(p.version)}</em></span>
      <i class="ico" data-ico="chevron" data-size="16"></i>`);
    Fresh.svg.render(box);
  }

  function chooseProfile() {
    const list = moddable();
    if (!list.length) return Fresh.profiles.create().then(() => refresh());
    const rows = list
      .map((p) => `<button class="menu-item" data-id="${esc(p.id)}"><span class="mi-icon" data-pid="${esc(p.id)}"></span>
        <span class="mi-text"><strong>${esc(p.name)}</strong><small>${esc(LOADER_NAME[p.loader])} ${esc(p.version)}</small></span>
        ${p.id === state.profileId ? '<i class="ico" data-ico="check" data-size="16"></i>' : ''}</button>`)
      .join('');
    const m = Fresh.ui.modal({ title: 'Profil dla modów', html: `<div class="menu-list">${rows}</div>` });
    document.querySelectorAll('.modal .mi-icon').forEach((el) => {
      const p = list.find((x) => x.id === el.dataset.pid);
      if (p) el.appendChild(Fresh.brand.profileIcon(p, 'xs'));
    });
    Fresh.svg.render(document.querySelector('.modal'));
    document.querySelectorAll('.modal .menu-item[data-id]').forEach((b) =>
      b.addEventListener('click', () => {
        m.close(null);
        setProfile(b.dataset.id);
      })
    );
  }

  function setProfile(id) {
    if (state.profileId === id) return;
    state.profileId = id;
    state.offset = 0;
    refresh();
  }

  // Odkrywaj (Modrinth
  function search({ append = false } = {}) {
    const p = profile();
    const grid = $('#mods-results');
    if (!p) return;
    const seq = ++searchSeq;
    if (!append) {
      state.offset = 0;
      grid.innerHTML = Array.from({ length: 6 }, () => '<div class="mcard mcard--skeleton"><i></i><b></b><b></b></div>').join('');
    }
    state.loading = true;
    $('#mods-more').hidden = true;
    api.mods
      .search(p.id, { query: state.query, sort: state.sort, category: state.category, offset: state.offset })
      .then((res) => {
        if (seq !== searchSeq) return;
        state.total = res.total;
        state.hits = append ? [...state.hits, ...res.hits] : res.hits;
        renderResults(append ? res.hits : null);
      })
      .catch((err) => {
        if (seq !== searchSeq) return;
        grid.innerHTML = `<div class="mods-empty"><strong>Modrinth nie odpowiada</strong><span>${esc(err.message)}</span></div>`;
      })
      .finally(() => (state.loading = false));
  }

  function installedSet() {
    const set = new Set();
    for (const m of state.installed) {
      if (m.projectId) set.add(m.projectId);
      if (m.slug) set.add(m.slug);
      if (m.modId) set.add(m.modId);
    }
    return set;
  }

  function resultCard(h, have) {
    const el = document.createElement('article');
    el.className = 'mcard';
    el.dataset.id = h.id;
    const busy = state.busy.get(h.id);
    const installed = have.has(h.id) || have.has(h.slug);
    el.innerHTML = `
      <div class="mcard-icon">${h.icon ? `<img src="${esc(h.icon)}" alt="" loading="lazy">` : `<span>${esc(h.title.slice(0, 1))}</span>`}</div>
      <div class="mcard-main">
        <strong title="${esc(h.title)}">${esc(h.title)}</strong>
        <small>od ${esc(h.author)}</small>
        <p>${esc(h.description)}</p>
        <div class="mcard-meta">
          <span><i class="ico" data-ico="download" data-size="12"></i> ${fmt(h.downloads)}</span>
          <span><i class="ico" data-ico="heart" data-size="12"></i> ${fmt(h.follows)}</span>
          ${h.categories.slice(0, 2).map((c) => `<span class="mtag">${esc(CAT_PL[c] || c)}</span>`).join('')}
        </div>
      </div>
      <button class="mcard-btn${installed ? ' is-installed' : ''}${busy ? ' is-busy' : ''}" ${installed || busy ? 'disabled' : ''}>
        ${busy ? `<span class="px-spinner"></span><span class="mcard-pct">${busy}</span>` : installed ? '<i class="ico" data-ico="check" data-size="16"></i> Zainstalowany' : '<i class="ico" data-ico="download" data-size="16"></i> Zainstaluj'}
      </button>`;
    const img = el.querySelector('img');
    if (img) img.addEventListener('error', () => (img.parentElement.innerHTML = `<span>${esc(h.title.slice(0, 1))}</span>`));
    el.querySelector('.mcard-btn').addEventListener('click', () => install(h));
    Fresh.svg.render(el);
    return el;
  }

  function renderResults(appended) {
    const grid = $('#mods-results');
    const have = installedSet();
    if (!appended) grid.innerHTML = '';
    if (!state.hits.length) {
      grid.innerHTML = `<div class="mods-empty"><strong>Nic nie znaleziono</strong><span>Spróbuj innej frazy albo kategorii. Szukamy modów dla ${esc(LOADER_NAME[profile().loader])} ${esc(profile().version)}.</span></div>`;
    }
    const frag = document.createDocumentFragment();
    (appended || state.hits).forEach((h) => frag.appendChild(resultCard(h, have)));
    grid.appendChild(frag);
    $('#mods-total').textContent = state.total ? `${fmt(state.total)} wyników` : '';
    $('#mods-more').hidden = state.hits.length >= state.total;
  }

  function updateCard(id) {
    const old = document.querySelector(`.mcard[data-id="${CSS.escape(id)}"]`);
    const h = state.hits.find((x) => x.id === id);
    if (old && h) old.replaceWith(resultCard(h, installedSet()));
  }

  async function install(h) {
    const p = profile();
    if (!p || state.busy.has(h.id)) return;
    state.busy.set(h.id, '0%');
    updateCard(h.id);
    try {
      const res = await api.mods.install(p.id, h.id);
      state.installed = res.mods;
      const extra = res.installed.filter((t) => t !== h.title);
      toast({ type: 'success', title: 'Zainstalowano', message: `${h.title} → ${p.name}${extra.length ? ` (+ ${extra.join(', ')})` : ''}` });
    } catch (err) {
      toast({ type: 'error', title: h.title, message: err.message, timeout: 7000 });
    } finally {
      state.busy.delete(h.id);
      updateCard(h.id);
      renderInstalledCount();
      Fresh.profiles.refreshCounts();
    }
  }

  // Zainstalowane
  function renderInstalledCount() {
    const n = state.installed.filter((m) => !m.managed).length;
    $('#mods-installed-count').textContent = n;
    if (state.tab === 'installed') renderInstalled();
  }

  function renderInstalled() {
    const box = $('#mods-installed');
    const q = $('#mods-installed-search').value.trim().toLowerCase();
    const items = state.installed.filter((m) => !q || m.title.toLowerCase().includes(q) || m.file.toLowerCase().includes(q));
    box.innerHTML = '';
    if (!state.installed.length) {
      box.innerHTML = `<div class="mods-empty"><strong>Brak modów w tym profilu</strong><span>Znajdź coś w zakładce Odkrywaj albo przeciągnij tu pliki .jar.</span></div>`;
      return;
    }
    for (const m of items) {
      const row = document.createElement('div');
      row.className = `mrow${m.enabled ? '' : ' is-off'}${m.managed ? ' is-managed' : ''}`;
      row.innerHTML = `
        <div class="mcard-icon mcard-icon--sm">${m.icon ? `<img src="${esc(m.icon)}" alt="">` : `<span>${esc(m.title.slice(0, 1))}</span>`}</div>
        <div class="mrow-main">
          <strong>${esc(m.title)} ${m.version ? `<small>${esc(m.version)}</small>` : ''}</strong>
          <span>${esc(m.description || m.file)}</span>
        </div>
        <span class="msrc msrc--${m.managed ? 'fresh' : m.source}">${m.managed ? 'Fresh' : m.source === 'modrinth' ? 'Modrinth' : 'Własny'}</span>
        ${m.managed ? '<span class="mrow-lock" title="Zarządzane przez launcher"><i class="ico" data-ico="lock" data-size="16"></i></span>' : `
        <button class="px-toggle" role="switch" aria-checked="${m.enabled}" title="Włącz / wyłącz"></button>
        <button class="icon-btn no" title="Przenieś do Kosza"><i class="ico" data-ico="trash" data-size="16"></i></button>`}`;
      const img = row.querySelector('img');
      if (img) img.addEventListener('error', () => (img.parentElement.innerHTML = `<span>${esc(m.title.slice(0, 1))}</span>`));
      row.querySelector('.px-toggle')?.addEventListener('click', async () => {
        state.installed = await api.mods.toggle(state.profileId, m.file, !m.enabled);
        renderInstalled();
      });
      row.querySelector('.icon-btn')?.addEventListener('click', async () => {
        if (!(await confirm('Usunąć moda?', `„${m.title}” trafi do Kosza – możesz go stamtąd przywrócić.`, 'Usuń', 'red'))) return;
        try {
          state.installed = await api.mods.remove(state.profileId, m.file);
          renderInstalledCount();
          Fresh.profiles.refreshCounts();
        } catch (err) {
          toast({ type: 'error', title: 'Mody', message: err.message });
        }
      });
      box.appendChild(row);
    }
    Fresh.svg.render(box);
  }

  async function loadInstalled() {
    const p = profile();
    state.installed = p ? await api.mods.list(p.id).catch(() => []) : [];
    renderInstalledCount();
  }

  // własne pliki
  function afterAdd(res) {
    if (!res) return;
    state.installed = res.mods;
    renderInstalledCount();
    Fresh.profiles.refreshCounts();
    if (res.added.length) toast({ type: 'success', title: 'Wgrano mody', message: `${res.added.length} plik(ów) → ${profile().name}` });
    if (res.skipped.length) toast({ type: 'warn', title: 'Pominięto', message: res.skipped.join(', '), timeout: 7000 });
    setTab('installed');
  }

  function initDrop() {
    const panel = document.querySelector('.panel[data-panel="mods"]');
    const zone = $('#mods-drop');
    let depth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    panel.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      zone.hidden = !profile();
    });
    panel.addEventListener('dragover', (e) => hasFiles(e) && e.preventDefault());
    panel.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) zone.hidden = true;
    });
    panel.addEventListener('drop', async (e) => {
      e.preventDefault();
      depth = 0;
      zone.hidden = true;
      if (!profile() || !e.dataTransfer.files.length) return;
      try {
        afterAdd(await api.mods.addDropped(state.profileId, e.dataTransfer.files));
      } catch (err) {
        toast({ type: 'error', title: 'Wgrywanie', message: err.message });
      }
    });
  }

  // zakładki / start
  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('#mods-tabs .seg-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
    $('#mods-discover').hidden = tab !== 'discover';
    $('#mods-installed-view').hidden = tab !== 'installed';
    if (tab === 'installed') renderInstalled();
  }

  function renderCategories() {
    const box = $('#mods-cats');
    box.innerHTML = '';
    for (const [id, name] of CATEGORIES) {
      const b = document.createElement('button');
      b.className = `chip${state.category === id ? ' is-active' : ''}`;
      b.textContent = name;
      b.addEventListener('click', () => {
        state.category = id;
        renderCategories();
        search();
      });
      box.appendChild(b);
    }
  }

  async function refresh() {
    pickDefaultProfile();
    renderProfileSelect();
    const has = !!profile();
    $('#mods-body').hidden = !has;
    $('#mods-none').hidden = has;
    if (!has) return;
    await loadInstalled();
    if (state.tab === 'discover') search();
  }

  let shown = false;
  function show(profileId) {
    if (profileId) state.profileId = profileId;
    if (!shown || profileId) {
      shown = true;
      refresh();
    } else {
      pickDefaultProfile();
      renderProfileSelect();
      loadInstalled();
    }
  }

  function init(context) {
    ctx = context;
    renderCategories();
    $('#mods-profile').addEventListener('click', chooseProfile);
    $('#mods-search').addEventListener('input', (e) => {
      state.query = e.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => search(), 320);
    });
    $('#mods-sort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      search();
    });
    $('#mods-more').addEventListener('click', () => {
      state.offset = state.hits.length;
      search({ append: true });
    });
    document.querySelectorAll('#mods-tabs .seg-tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
    $('#mods-installed-search').addEventListener('input', renderInstalled);
    $('#btn-mods-upload').addEventListener('click', async () => {
      if (!profile()) return;
      try {
        afterAdd(await api.mods.pick(state.profileId));
      } catch (err) {
        toast({ type: 'error', title: 'Wgrywanie', message: err.message });
      }
    });
    $('#btn-mods-folder').addEventListener('click', () => profile() && api.mods.openDir(state.profileId));
    $('#btn-mods-newprofile').addEventListener('click', () => Fresh.profiles.create().then(() => refresh()));
    api.mods.onProgress((p) => {
      if (!state.busy.has(p.projectId)) return;
      const pct = p.total ? `${Math.round((p.received / p.total) * 100)}%` : '…';
      state.busy.set(p.projectId, pct);
      const el = document.querySelector(`.mcard[data-id="${CSS.escape(p.projectId)}"] .mcard-pct`);
      if (el) el.textContent = pct;
    });
    initDrop();
  }

  Fresh.modsBrowser = { init, show };
})();

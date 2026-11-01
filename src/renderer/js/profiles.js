// Panel profili: siatka kart profili + akcje (graj, mody, edytuj, folder, usuń).
window.Fresh = window.Fresh || {};

(() => {
  const { $, esc, toast, confirm } = Fresh.ui;
  const api = window.api;
  const { LOADER_NAME } = Fresh.brand;

  let ctx = null; // { settings(), play(id), select(id), changed(), openMods(id) }
  const modCounts = new Map();

  function ago(ts) {
    if (!ts) return 'jeszcze nie grano';
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'przed chwilą';
    if (m < 60) return `${m} min temu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} godz. temu`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'wczoraj' : `${d} dni temu`;
  }

  const label = (p) => `${LOADER_NAME[p.loader]} ${p.version || '—'}`;
  const modOk = (p) => ctx && p.loader === 'fabric' && p.version === ctx.settings().modVersion;

  /** Karta profilu (także podgląd w kreatorze). */
  function card(p, { preview = false } = {}) {
    const e = Fresh.brand.EMBLEMS[Fresh.brand.emblemId(p)];
    const el = document.createElement('article');
    el.className = `pcard${!preview && p.id === ctx?.settings().selectedProfile ? ' is-selected' : ''}${preview ? ' is-preview' : ''}`;
    el.style.setProperty('--pa', e.bg[0]);
    el.style.setProperty('--pb', e.bg[1]);
    const mods = modCounts.get(p.id);
    el.innerHTML = `
      <div class="pcard-banner tex">
        <span class="pcard-loader">${esc(LOADER_NAME[p.loader])}</span>
        <span class="pcard-sel"><i class="ico" data-ico="check" data-size="12"></i> Wybrany</span>
      </div>
      <div class="pcard-body">
        <strong>${esc(p.name)}</strong>
        <small>${esc(label(p))} · ${esc(preview ? 'nowy' : ago(p.lastPlayed))}</small>
        <div class="pcard-chips">
          ${modOk(p) ? '<span class="pchip pchip--fresh">mod Fresh</span>' : ''}
          ${preview ? '' : p.loader !== 'vanilla' ? `<span class="pchip" data-mods="${esc(p.id)}">${mods == null ? '…' : mods} ${mods === 1 ? 'mod' : 'modów'}</span>` : '<span class="pchip">bez modów</span>'}
        </div>
      </div>
      ${preview ? '' : `<div class="pcard-actions">
        <button class="px-btn px-btn--green px-btn--sm tex" data-act="play"><i class="ico" data-ico="play" data-size="14"></i> Graj</button>
        ${p.loader !== 'vanilla' ? '<button class="icon-btn" data-act="mods" title="Mody profilu"><i class="ico" data-ico="package" data-size="16"></i></button>' : ''}
        <button class="icon-btn" data-act="edit" title="Edytuj"><i class="ico" data-ico="pencil" data-size="16"></i></button>
        <button class="icon-btn" data-act="folder" title="Folder profilu"><i class="ico" data-ico="folder" data-size="16"></i></button>
        <button class="icon-btn no" data-act="delete" title="Usuń"><i class="ico" data-ico="trash" data-size="16"></i></button>
      </div>`}`;
    const emblem = Fresh.brand.drawEmblem(document.createElement('canvas'), Fresh.brand.emblemId(p), 6);
    emblem.className = 'pcard-emblem';
    el.querySelector('.pcard-banner').appendChild(emblem);
    if (!preview) {
      el.addEventListener('click', (ev) => {
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (act === 'play') ctx.play(p.id);
        else if (act === 'mods') ctx.openMods(p.id);
        else if (act === 'edit') edit(p.id);
        else if (act === 'folder') api.profiles.openDir(p.id);
        else if (act === 'delete') remove(p);
        else ctx.select(p.id);
      });
    }
    Fresh.svg.render(el);
    return el;
  }

  function newCard() {
    const b = document.createElement('button');
    b.className = 'pcard pcard--new';
    b.innerHTML = `<span class="pcard-plus"><i class="ico" data-ico="plus" data-size="26"></i></span>
      <strong>Nowy profil</strong><small>Vanilla, Fabric albo Forge – w 3 krokach</small>`;
    b.addEventListener('click', create);
    Fresh.svg.render(b);
    return b;
  }

  async function refreshCounts() {
    const s = ctx.settings();
    await Promise.all(
      s.profiles
        .filter((p) => p.loader !== 'vanilla')
        .map(async (p) => {
          const list = await api.mods.list(p.id).catch(() => []);
          const n = list.filter((m) => !m.managed).length;
          modCounts.set(p.id, n);
          document.querySelectorAll(`[data-mods="${CSS.escape(p.id)}"]`).forEach((el) => (el.textContent = `${n} ${n === 1 ? 'mod' : 'modów'}`));
        })
    );
  }

  function render() {
    const grid = $('#profile-cards');
    if (!grid || !ctx) return;
    const s = ctx.settings();
    grid.innerHTML = '';
    const list = [...s.profiles].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    list.forEach((p) => grid.appendChild(card(p)));
    grid.appendChild(newCard());
    $('#profiles-count').textContent = `${s.profiles.length}`;
    refreshCounts();
  }

  async function create() {
    const saved = await Fresh.wizard.open({ modVersion: ctx.settings().modVersion });
    if (!saved) return null;
    ctx.settings().profiles.push(saved);
    await ctx.select(saved.id);
    toast({ type: 'success', title: 'Profil gotowy', message: `${saved.name} – kliknij Graj, gdy chcesz zacząć.` });
    return saved;
  }

  async function edit(id) {
    const s = ctx.settings();
    const p = s.profiles.find((x) => x.id === id);
    if (!p) return;
    const saved = await Fresh.wizard.open({ profile: p, modVersion: s.modVersion });
    if (!saved) return;
    Object.assign(p, saved);
    ctx.changed();
    toast({ type: 'success', title: 'Profil', message: 'Zapisano zmiany.' });
  }

  async function remove(p) {
    if (!(await confirm('Usunąć profil?', `Profil „${p.name}” zniknie z listy (pliki w folderze zostaną).`, 'Usuń', 'red'))) return;
    try {
      const data = await api.profiles.remove(p.id);
      const s = ctx.settings();
      s.profiles = data.profiles;
      s.selectedProfile = data.selectedProfile;
      ctx.changed();
    } catch (err) {
      toast({ type: 'warn', title: 'Profil', message: err.message });
    }
  }

  function init(context) {
    ctx = context;
    $('#btn-profiles-new').addEventListener('click', create);
  }

  Fresh.profiles = { init, render, card, create, edit, ago, label, modOk, refreshCounts };
})();

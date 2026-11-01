// Kosmetyki: garderoba 3D (skinview3d + woksele). Peleryny Fresh i peleryny Mojang są w osobnych działach.
window.Fresh = window.Fresh || {};

(() => {
  const { $, esc } = Fresh.ui;
  const C = window.FreshCosmetics;
  const SLOTS = ['cape', 'head', 'face', 'back', 'aura', 'pet'];
  const SLOT_LABEL = { cape: 'Peleryna', head: 'Głowa', face: 'Twarz', back: 'Plecy', aura: 'Aura', pet: 'Towarzysz' };
  const ANIMS = ['walk', 'run', 'idle'];
  const ANIM_LABEL = { walk: 'Chód', run: 'Bieg', idle: 'Stój' };

  // działy garderoby: dwie grupy peleryn + kosmetyki 3D
  const CATS = [
    { id: 'fresh', group: 'Peleryny', slot: 'cape', name: 'Peleryny Fresh', short: 'Fresh', icon: 'cape', desc: 'Nasze peleryny – widzą je wszyscy gracze Fresh Client. Mają pierwszeństwo przed peleryną Mojang.' },
    { id: 'mojang', group: 'Peleryny', slot: 'cape', name: 'Peleryny Mojang', short: 'Mojang', icon: 'shield', desc: 'Oficjalne peleryny z Twojego konta Microsoft. Ustawiasz je na koncie – widzi je każdy gracz Minecraft.' },
    { id: 'head', group: 'Kosmetyki 3D', slot: 'head', name: 'Głowa', icon: 'crown', desc: 'Korony, kapelusze, uszy i rogi.' },
    { id: 'face', group: 'Kosmetyki 3D', slot: 'face', name: 'Twarz', icon: 'eye', desc: 'Okulary, monokle i gogle.' },
    { id: 'back', group: 'Kosmetyki 3D', slot: 'back', name: 'Plecy', icon: 'package', desc: 'Skrzydła, plecaki, ogony i broń na plecach.' },
    { id: 'aura', group: 'Kosmetyki 3D', slot: 'aura', name: 'Aura', icon: 'sparkles', desc: 'Animowane efekty krążące wokół postaci.' },
    { id: 'pet', group: 'Kosmetyki 3D', slot: 'pet', name: 'Towarzysz', icon: 'heart', desc: 'Mały przyjaciel, który lata obok Ciebie.' }
  ];
  const RARITIES = ['all', 'common', 'rare', 'epic', 'legendary'];
  const RARITY_SHORT = { all: 'Wszystkie', common: 'Zwykłe', rare: 'Rzadkie', epic: 'Epickie', legendary: 'Legendarne' };

  const state = {
    equipped: { cape: 'dusk', head: null, face: null, back: null, aura: null, pet: null },
    elytra: false,
    cat: 'fresh',
    rarity: 'all',
    official: [], // oficjalne peleryny Mojang
    loggedIn: false,
    owned: null, // null = jeszcze nie wczytano (wszystko odblokowane)
    skin: null,
    slim: false,
    name: null,
    anim: 0,
    stages: [] // { viewer, voxels, main }
  };
  const capeTextures = {};
  const thumbCache = new Map();
  const catDef = () => CATS.find((c) => c.id === state.cat);

  // domyślny skin
  function defaultSkin() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const x = c.getContext('2d');
    const r = (col, a, b, w, h) => {
      x.fillStyle = col;
      x.fillRect(a, b, w, h);
    };
    r('#e0b08c', 0, 0, 32, 16);
    r('#3b2a55', 8, 0, 8, 8);
    r('#3b2a55', 0, 8, 32, 2);
    r('#ffffff', 9, 12, 2, 1);
    r('#ffffff', 13, 12, 2, 1);
    r('#14b8a6', 10, 12, 1, 1);
    r('#14b8a6', 13, 12, 1, 1);
    r('#a0604e', 11, 14, 2, 1);
    r('#14b8a6', 16, 16, 24, 16);
    r('#ecfdf5', 20, 20, 8, 2);
    r('#14b8a6', 40, 16, 16, 16);
    r('#e0b08c', 44, 28, 8, 4);
    r('#14b8a6', 32, 48, 16, 16);
    r('#e0b08c', 36, 60, 8, 4);
    r('#24324a', 0, 16, 16, 16);
    r('#24324a', 16, 48, 16, 16);
    r('#ffffff', 0, 28, 16, 4);
    r('#ffffff', 16, 60, 16, 4);
    return c.toDataURL();
  }

  // iewer
  function makeStage(canvas, { width, height, zoom, main }) {
    if (typeof skinview3d === 'undefined') return null;
    const viewer = new skinview3d.SkinViewer({ canvas, width, height, skin: defaultSkin(), zoom, fov: 40 });
    viewer.background = null;
    const stage = { viewer, voxels: Fresh.voxels.attach(viewer), main };
    state.stages.push(stage);
    return stage;
  }

  function capeSource(id) {
    if (!id) return null;
    if (id.startsWith('mojang:')) return state.official.find((c) => `mojang:${c.id}` === id)?.dataUrl || null;
    if (!capeTextures[id]) capeTextures[id] = Fresh.voxels.capeThumb(id).texture;
    return capeTextures[id];
  }

  const activeMojang = () => state.official.find((c) => c.active) || null;

  /** Peleryna widoczna na postaci: Fresh (jeśli wybrana), inaczej aktywna Mojang. */
  function visibleCape() {
    if (state.equipped.cape) return state.equipped.cape;
    const m = activeMojang();
    return m ? `mojang:${m.id}` : null;
  }

  /** Nakłada zestaw kosmetyków na scenę (override = podgląd po najechaniu). */
  function applyTo(stage, override) {
    const eq = { ...state.equipped, ...override };
    const v = stage.viewer;
    const cape = override && 'cape' in override ? override.cape ?? (state.cat === 'fresh' ? visibleCapeIfNone() : null) : visibleCape();
    const src = capeSource(cape);
    if (src) v.loadCape(src, { backEquipment: state.elytra ? 'elytra' : 'cape' });
    else v.resetCape();
    for (const s of SLOTS) if (s !== 'cape') stage.voxels.set(s, eq[s]);
  }
  // "Brak" w pelerynach Fresh = pokaż pelerynę Mojang
  function visibleCapeIfNone() {
    const m = activeMojang();
    return m ? `mojang:${m.id}` : null;
  }

  const applyAll = () => state.stages.forEach((s) => applyTo(s));
  const mainStage = () => state.stages.find((s) => s.main);

  function setAnimation(i) {
    state.anim = i;
    const main = mainStage();
    if (!main) return;
    const kind = ANIMS[i];
    const v = main.viewer;
    if (kind === 'walk') v.animation = new skinview3d.WalkingAnimation();
    if (kind === 'run') v.animation = new skinview3d.RunningAnimation();
    if (kind === 'idle') v.animation = new skinview3d.IdleAnimation();
    if (kind !== 'idle') v.animation.speed = kind === 'run' ? 0.7 : 0.55;
    $('#vc-anim span').textContent = ANIM_LABEL[kind];
  }

  // miniatury
  function thumbFor(item, size = 96) {
    const key = `${item.id}:${size}`;
    if (!thumbCache.has(key)) thumbCache.set(key, Fresh.voxels.thumbnail(item, size));
    const src = thumbCache.get(key);
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  function mojangThumb(off) {
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 64;
    c.classList.add('cape-thumb');
    if (off.dataUrl) {
      const img = new Image();
      img.onload = () => {
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(img, 1, 1, 10, 16, 0, 0, 40, 64);
      };
      img.src = off.dataUrl;
    }
    return c;
  }

  function freshCapeThumb(id) {
    const t = Fresh.voxels.capeThumb(id).thumb;
    const c = document.createElement('canvas');
    c.width = t.width;
    c.height = t.height;
    c.getContext('2d').drawImage(t, 0, 0);
    c.classList.add('cape-thumb');
    return c;
  }

  /** Mała miniatura do listy "Na sobie". */
  function slotThumb(slot) {
    if (slot === 'cape') {
      const id = visibleCape();
      if (!id) return null;
      if (id.startsWith('mojang:')) {
        const off = state.official.find((c) => `mojang:${c.id}` === id);
        return off ? mojangThumb(off) : null;
      }
      return C.CAPES[id] ? freshCapeThumb(id) : null;
    }
    const item = C.byId(state.equipped[slot]);
    return item ? thumbFor(item, 48) : null;
  }

  // siatka
  const isOwned = (id) => !id || id.startsWith('mojang:') || !state.owned || state.owned.has(id);

  function card({ id, name, rarity, thumb, tag, slot }) {
    const btn = document.createElement('button');
    const locked = !isOwned(id);
    btn.className = `cos-card rar-${rarity}${locked ? ' is-locked' : ''}`;
    if (locked) tag = window.FreshRewards.BY_ID[id]?.event ? '🎃 Halloween · limit' : `${window.FreshRewards.COST[rarity]} odłamków`;
    btn.dataset.id = id ?? '';
    const art = document.createElement('div');
    art.className = 'cos-art';
    if (thumb) art.appendChild(thumb);
    else art.innerHTML = '<div class="none-mark"><i class="ico" data-ico="x" data-size="22"></i></div>';
    btn.appendChild(art);
    if (locked) art.insertAdjacentHTML('beforeend', '<span class="cos-lock"><i class="ico" data-ico="lock" data-size="13"></i></span>');
    btn.insertAdjacentHTML('beforeend', `<span class="cos-name">${esc(name)}</span><em>${esc(tag || C.RARITY[rarity] || '')}</em>`);
    // zablokowane też można przymierzyć (najechanie), ale nie założyć
    btn.addEventListener('mouseenter', () => mainStage() && applyTo(mainStage(), { [slot]: id }));
    btn.addEventListener('mouseleave', () => mainStage() && applyTo(mainStage()));
    btn.addEventListener('click', () => (locked ? Fresh.rewards.offer(id) : equip(slot, id)));
    return btn;
  }

  function itemsFor(cat) {
    if (cat.id === 'fresh') return Object.entries(C.CAPES).map(([id, def]) => ({ id, name: def.name, rarity: window.FreshRewards.BY_ID[id]?.rarity || 'rare', slot: 'cape', thumb: () => freshCapeThumb(id) }));
    if (cat.id === 'mojang') return state.official.map((off) => ({ id: `mojang:${off.id}`, name: off.alias, rarity: 'legendary', tag: off.active ? 'Na koncie' : 'Mojang', slot: 'cape', thumb: () => mojangThumb(off) }));
    return C.CATALOG.filter((i) => i.slot === cat.slot).map((i) => ({ id: i.id, name: i.name, rarity: i.rarity, slot: i.slot, thumb: () => thumbFor(i) }));
  }

  function renderGrid() {
    const cat = catDef();
    const grid = $('#cosmetic-grid');
    $('#cos-title').textContent = cat.name;
    $('#cos-desc').textContent = cat.desc;
    $('#cos-rarity').hidden = cat.id === 'mojang';
    grid.innerHTML = '';
    grid.classList.toggle('is-capes', cat.slot === 'cape');

    if (cat.id === 'mojang' && !state.official.length) {
      grid.innerHTML = state.loggedIn
        ? '<div class="cos-empty"><i class="ico" data-ico="shield" data-size="28"></i><strong>Nie masz peleryn Mojang</strong><span>Oficjalne peleryny dostaje się np. za Minecraft Live, Migrator czy zakup Java + Bedrock. Wypróbuj peleryny Fresh!</span></div>'
        : '<div class="cos-empty"><i class="ico" data-ico="user" data-size="28"></i><strong>Zaloguj się kontem Microsoft</strong><span>Po zalogowaniu zobaczysz tu peleryny ze swojego konta.</span></div>';
      Fresh.svg.render(grid);
      return;
    }

    const frag = document.createDocumentFragment();
    if (cat.id === 'mojang' && state.equipped.cape && C.CAPES[state.equipped.cape]) {
      const note = document.createElement('div');
      note.className = 'cos-note';
      note.innerHTML = `<i class="ico" data-ico="info" data-size="16"></i><span>Masz założoną pelerynę Fresh <b>${esc(C.CAPES[state.equipped.cape].name)}</b> – gracze Fresh widzą ją zamiast peleryny Mojang.</span>`;
      const off = document.createElement('button');
      off.className = 'px-btn px-btn--white px-btn--sm';
      off.textContent = 'Pokaż Mojang';
      off.addEventListener('click', () => equip('cape', null).then(renderGrid));
      note.appendChild(off);
      frag.appendChild(note);
    }
    if (cat.id !== 'mojang') frag.appendChild(card({ id: null, name: cat.id === 'fresh' ? 'Bez peleryny Fresh' : 'Brak', rarity: 'common', thumb: null, tag: cat.id === 'fresh' ? 'pokaż Mojang' : '—', slot: cat.slot }));
    for (const it of itemsFor(cat)) {
      if (state.rarity !== 'all' && cat.id !== 'mojang' && it.rarity !== state.rarity) continue;
      frag.appendChild(card({ ...it, thumb: it.thumb() }));
    }
    grid.appendChild(frag);
    Fresh.svg.render(grid);
    markSelected();
  }

  function selectedInCat() {
    const cat = catDef();
    if (cat.id === 'fresh') return state.equipped.cape ?? null;
    if (cat.id === 'mojang') {
      const m = activeMojang();
      return m ? `mojang:${m.id}` : null;
    }
    return state.equipped[cat.slot] ?? null;
  }

  function markSelected() {
    const sel = selectedInCat();
    document.querySelectorAll('#cosmetic-grid .cos-card').forEach((c) => c.classList.toggle('is-selected', (c.dataset.id || null) === sel));
  }

  function renderNav() {
    const nav = $('#cos-nav');
    nav.innerHTML = '';
    let group = null;
    for (const cat of CATS) {
      if (cat.group !== group) {
        group = cat.group;
        nav.insertAdjacentHTML('beforeend', `<span class="cos-group">${esc(group)}</span>`);
      }
      const count = cat.id === 'fresh' ? Object.keys(C.CAPES).length : cat.id === 'mojang' ? state.official.length : C.CATALOG.filter((i) => i.slot === cat.slot).length;
      const on = cat.slot === 'cape' ? (cat.id === 'fresh' ? !!state.equipped.cape : !state.equipped.cape && !!activeMojang()) : !!state.equipped[cat.slot];
      const b = document.createElement('button');
      b.className = `cos-cat cos-cat--${cat.id}${cat.id === state.cat ? ' is-active' : ''}`;
      b.innerHTML = `<span class="cc-ico"><i class="ico" data-ico="${cat.icon}" data-size="16"></i></span><span class="cc-name">${esc(cat.short || cat.name)}</span>
        ${on ? '<span class="cc-on" title="Założone"></span>' : ''}<small>${cat.id !== 'mojang' && state.owned ? `${itemsFor(cat).filter((it) => isOwned(it.id)).length}/` : ''}${count}</small>`;
      b.addEventListener('click', () => setCat(cat.id));
      nav.appendChild(b);
    }
    Fresh.svg.render(nav);
  }

  function setCat(id) {
    state.cat = id;
    renderNav();
    renderGrid();
  }

  function renderRarity() {
    const box = $('#cos-rarity');
    box.innerHTML = '';
    for (const r of RARITIES) {
      const b = document.createElement('button');
      b.className = `chip chip--rar rar-${r}${state.rarity === r ? ' is-active' : ''}`;
      b.textContent = RARITY_SHORT[r];
      b.addEventListener('click', () => {
        state.rarity = r;
        renderRarity();
        renderGrid();
      });
      box.appendChild(b);
    }
  }

  /** "Na sobie": wszystkie sloty z miniaturą; klik = przejdź do działu, × = zdejmij. */
  function renderLoadout() {
    const box = $('#loadout');
    box.innerHTML = '';
    for (const s of SLOTS) {
      const id = s === 'cape' ? visibleCape() : state.equipped[s];
      let name = 'Pusto';
      if (id) name = s === 'cape' ? (id.startsWith('mojang:') ? `${state.official.find((c) => `mojang:${c.id}` === id)?.alias || 'Mojang'} · Mojang` : C.CAPES[id]?.name) : C.byId(id)?.name;
      const el = document.createElement('div');
      el.className = `lo-slot${id ? ' is-on' : ''}`;
      const thumb = id ? slotThumb(s) : null;
      const art = document.createElement('button');
      art.className = 'lo-art';
      art.title = `Przejdź: ${SLOT_LABEL[s]}`;
      if (thumb) art.appendChild(thumb);
      else art.innerHTML = '<i class="ico" data-ico="plus" data-size="14"></i>';
      art.addEventListener('click', () => setCat(s === 'cape' ? (id && id.startsWith('mojang:') ? 'mojang' : 'fresh') : s));
      el.appendChild(art);
      el.insertAdjacentHTML('beforeend', `<span class="lo-text"><small>${esc(SLOT_LABEL[s])}</small><strong>${esc(name || 'Pusto')}</strong></span>`);
      const canRemove = id && !(s === 'cape' && id.startsWith('mojang:'));
      if (canRemove) {
        const x = document.createElement('button');
        x.className = 'lo-x';
        x.title = 'Zdejmij';
        x.innerHTML = '<i class="ico" data-ico="x" data-size="12"></i>';
        x.addEventListener('click', () => equip(s, null));
        el.appendChild(x);
      }
      box.appendChild(el);
    }
    Fresh.svg.render(box);
    const worn = SLOTS.filter((s) => (s === 'cape' ? visibleCape() : state.equipped[s])).length;
    $('#loadout-count').textContent = `${worn}/${SLOTS.length}`;
  }

  // zapis
  async function persist() {
    try {
      const res = await window.api.cosmetics.save({ ...state.equipped, elytra: state.elytra });
      if (res.error) Fresh.ui.toast({ type: 'warn', title: 'Serwer Fresh', message: `Zapisano lokalnie, synchronizacja nieudana: ${res.error}` });
    } catch (err) {
      Fresh.ui.toast({ type: 'error', title: 'Kosmetyki', message: err.message });
    }
  }

  async function equip(slot, id) {
    if (id && id.startsWith('mojang:')) {
      try {
        await window.api.profile.setCape(id.slice(7));
        state.official.forEach((c) => (c.active = `mojang:${c.id}` === id));
        Fresh.ui.toast({
          type: 'success',
          title: 'Peleryna Mojang',
          message: state.equipped.cape ? 'Ustawiona na koncie. U graczy Fresh nadal widać Twoją pelerynę Fresh – zdejmij ją, by pokazać Mojang.' : 'Ustawiona na koncie – widoczna dla wszystkich.',
          timeout: 6000
        });
      } catch (err) {
        Fresh.ui.toast({ type: 'error', title: 'Peleryna', message: err.message });
        return;
      }
    } else {
      state.equipped[slot] = id;
    }
    applyAll();
    renderNav();
    if (state.cat === 'mojang') renderGrid();
    else markSelected();
    renderLoadout();
    if (!id || !id.startsWith('mojang:')) persist();
  }

  // publiczne API
  function init(cosmetic = {}) {
    state.equipped = { ...state.equipped, ...cosmetic };
    state.elytra = !!cosmetic.elytra;
    delete state.equipped.elytra;

    const main = makeStage($('#skin-canvas'), { width: 280, height: 380, zoom: 0.62, main: true });
    if (main) {
      // skinview3d resetuje wysokość nicku przy zmianie peleryny – trzymamy go nad wysokimi czapkami
      const keepTagHigh = () => {
        if (main.viewer.nameTagYOffset < 27) main.viewer.nameTagYOffset = 27;
        requestAnimationFrame(keepTagHigh);
      };
      keepTagHigh();
    }
    const hero = makeStage($('#hero-skin'), { width: 320, height: 330, zoom: 0.72, main: false });
    if (!main) {
      $('#viewer-fallback').hidden = false;
      $('#skin-canvas').hidden = true;
    } else {
      main.viewer.autoRotate = true;
      main.viewer.autoRotateSpeed = 0.7;
      main.viewer.controls.enableZoom = false;
      main.viewer.renderPaused = true;
      setAnimation(0);
    }
    if (hero) {
      hero.viewer.controls.enabled = false;
      hero.viewer.animation = new skinview3d.IdleAnimation();
      hero.viewer.playerObject.rotation.y = -0.35;
      // delikatne "rozglądanie się" postaci
      const sway = () => {
        if (!hero.viewer.renderPaused) hero.viewer.playerObject.rotation.y = -0.35 + Math.sin(performance.now() / 2200) * 0.3;
        requestAnimationFrame(sway);
      };
      sway();
    }

    $('#vc-rotate').addEventListener('click', (e) => {
      if (!main) return;
      main.viewer.autoRotate = !main.viewer.autoRotate;
      e.currentTarget.classList.toggle('is-on', main.viewer.autoRotate);
    });
    $('#vc-anim').addEventListener('click', () => setAnimation((state.anim + 1) % ANIMS.length));
    $('#vc-elytra').classList.toggle('is-on', state.elytra);
    $('#vc-elytra').addEventListener('click', (e) => {
      state.elytra = !state.elytra;
      e.currentTarget.classList.toggle('is-on', state.elytra);
      applyAll();
      persist();
    });

    $('#unlock-count').textContent = C.CATALOG.length + Object.keys(C.CAPES).length;
    renderNav();
    renderRarity();
    renderGrid();
    renderLoadout();
    applyAll();
  }

  function setSkin(dataUrl, slim, name) {
    state.skin = dataUrl;
    state.slim = slim;
    state.name = name;
    state.loggedIn = !!name;
    for (const s of state.stages) {
      s.viewer.loadSkin(dataUrl || defaultSkin(), { model: slim ? 'slim' : 'default' });
      if (s.main) {
        s.viewer.nameTag = name
          ? new skinview3d.NameTagObject(name, { font: '40px "Press Start 2P"', margin: [10, 14, 6, 14], repaintAfterLoaded: true })
          : null;
      }
    }
    if (state.cat === 'mojang') renderGrid();
  }

  function setOfficial(capes) {
    state.official = capes || [];
    renderNav();
    if (state.cat === 'mojang' || state.cat === 'fresh') renderGrid();
    renderLoadout();
    applyAll();
  }

  /** Kosmetyki zmienione w grze (menu RSHIFT). */
  function sync(cosmetic) {
    state.elytra = !!cosmetic.elytra;
    state.equipped = { ...state.equipped, ...cosmetic };
    delete state.equipped.elytra;
    $('#vc-elytra').classList.toggle('is-on', state.elytra);
    applyAll();
    renderNav();
    markSelected();
    renderLoadout();
  }

  function setActive(panel) {
    for (const s of state.stages) s.viewer.renderPaused = s.main ? panel !== 'cosmetics' : panel !== 'home';
  }

  /** Lista posiadanych kosmetyków (z codziennej skrzynki / sklepu). */
  function setOwned(list) {
    state.owned = new Set(list);
    renderNav();
    renderGrid();
  }

  /** Miniatura dowolnego kosmetyku (peleryna albo model 3D) – np. na taśmę skrzynki. */
  function thumb(id, size = 96) {
    if (C.CAPES[id]) return freshCapeThumb(id);
    const item = C.byId(id);
    return item ? thumbFor(item, size) : document.createElement('canvas');
  }

  /** Załóż (np. prosto z okna wygranej). */
  function wear(id) {
    const slot = C.CAPES[id] ? 'cape' : C.byId(id)?.slot;
    if (slot) equip(slot, id);
  }

  Fresh.cosmetics = { init, setSkin, setOfficial, sync, setActive, defaultSkin, setOwned, thumb, wear, isOwned };
})();

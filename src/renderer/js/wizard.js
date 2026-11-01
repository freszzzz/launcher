// Kreator profilu: 1) silnik  2) wersja  3) nazwa i wygląd. Ten sam kreator służy do edycji.
window.Fresh = window.Fresh || {};

(() => {
  const { esc } = Fresh.ui;
  const api = window.api;

  const ENGINES = [
    { id: 'fabric', name: 'Fabric', icon: 'fresh', tag: 'Zalecany', desc: 'Lekki loader modów. Tylko tu działa mod Fresh: menu R-Shift, kosmetyki 3D i ikonka przy nicku.' },
    { id: 'vanilla', name: 'Vanilla', icon: 'grass', tag: 'Czysta gra', desc: 'Oryginalny Minecraft bez modów – wydania i snapshoty prosto od Mojang.' },
    { id: 'forge', name: 'Forge', icon: 'gold', tag: 'Modpacki', desc: 'Klasyczny loader dużych modów i modpacków. Bez moda Fresh.' }
  ];
  const { LOADER_NAME } = Fresh.brand;
  const STEPS = ['Silnik', 'Wersja', 'Wygląd'];

  const cache = new Map();
  async function versionsFor(loader, snapshots) {
    const key = `${loader}:${snapshots}`;
    if (!cache.has(key)) cache.set(key, await api.versions.list(loader, snapshots));
    return cache.get(key);
  }

  /** "1.21.10" -> "1.21", "26.1.2" -> "26.1", snapshoty i stare wersje osobno. */
  function family(v) {
    if (v.type === 'snapshot') return 'Snapshoty';
    if (v.type !== 'release') return 'Archiwalne';
    const m = v.id.match(/^(\d+)\.(\d+)/);
    return m ? `${m[1]}.${m[2]}` : 'Inne';
  }

  function open({ profile = null, modVersion } = {}) {
    const editing = !!profile;
    const draft = profile
      ? { ...profile }
      : { name: '', loader: 'fabric', version: modVersion, loaderVersion: null, icon: 'fresh' };
    let nameTouched = editing;
    let step = editing ? 1 : 0;
    let snapshots = false;
    let fam = 'all';
    let query = '';

    let resolveFn;
    const result = new Promise((r) => (resolveFn = r));

    const root = document.createElement('div');
    root.className = 'modal-backdrop wiz-backdrop';
    root.innerHTML = `
      <div class="wiz" role="dialog" aria-modal="true">
        <header class="wiz-head">
          <div>
            <span class="eyebrow">${editing ? 'Edycja profilu' : 'Nowy profil'}</span>
            <h3>${editing ? esc(profile.name) : 'Stwórz swój profil'}</h3>
          </div>
          <ol class="wiz-steps">${STEPS.map((s, i) => `<li data-step="${i}"><span>${i + 1}</span>${s}</li>`).join('')}</ol>
          <button class="icon-btn wiz-x" title="Zamknij"><i class="ico" data-ico="x" data-size="16"></i></button>
        </header>
        <div class="wiz-body"></div>
        <footer class="wiz-foot">
          <div class="wiz-summary"></div>
          <div class="wiz-buttons">
            <button class="px-btn px-btn--white px-btn--sm" data-act="back">Wstecz</button>
            <button class="px-btn px-btn--sm" data-act="next">Dalej</button>
          </div>
        </footer>
      </div>`;
    const body = root.querySelector('.wiz-body');
    const close = (value) => {
      if (root.classList.contains('is-leaving')) return;
      root.classList.add('is-leaving');
      setTimeout(() => root.remove(), 220);
      resolveFn(value);
    };
    root.addEventListener('mousedown', (e) => e.target === root && close(null));
    root.querySelector('.wiz-x').addEventListener('click', () => close(null));
    root.querySelectorAll('.wiz-steps li').forEach((li) =>
      li.addEventListener('click', () => {
        const s = Number(li.dataset.step);
        if (s <= step || (s === 2 && draft.version) || editing) go(s);
      })
    );
    root.querySelector('[data-act="back"]').addEventListener('click', () => (step === 0 ? close(null) : go(step - 1)));
    root.querySelector('[data-act="next"]').addEventListener('click', () => (step < 2 ? go(step + 1) : finish()));
    document.getElementById('modal-root').appendChild(root);

    const autoName = () => {
      if (!nameTouched) draft.name = `${LOADER_NAME[draft.loader]} ${draft.version || ''}`.trim();
    };

    function summary() {
      const box = root.querySelector('.wiz-summary');
      box.innerHTML = '';
      box.appendChild(Fresh.brand.profileIcon(draft, 'sm'));
      const mod = draft.loader === 'fabric' && draft.version === modVersion;
      box.insertAdjacentHTML(
        'beforeend',
        `<span><strong>${esc(draft.name || `${LOADER_NAME[draft.loader]} ${draft.version || '…'}`)}</strong>
         <small>${esc(LOADER_NAME[draft.loader])} · ${esc(draft.version || 'wybierz wersję')}${mod ? ' · <b class="fresh-ok">mod Fresh ✓</b>' : ''}</small></span>`
      );
    }

    function go(s) {
      if (s >= 1 && !draft.loader) return;
      if (s === 2 && !draft.version) {
        Fresh.ui.toast({ type: 'warn', title: 'Wersja', message: 'Wybierz wersję gry.' });
        return;
      }
      step = s;
      root.querySelectorAll('.wiz-steps li').forEach((li, i) => {
        li.classList.toggle('is-active', i === step);
        li.classList.toggle('is-done', i < step);
      });
      const back = root.querySelector('[data-act="back"]');
      const next = root.querySelector('[data-act="next"]');
      back.textContent = step === 0 ? 'Anuluj' : 'Wstecz';
      next.textContent = step === 2 ? (editing ? 'Zapisz zmiany' : 'Utwórz profil') : 'Dalej';
      next.classList.toggle('px-btn--green', step === 2);
      body.classList.remove('wiz-in');
      void body.offsetWidth;
      body.classList.add('wiz-in');
      [stepEngine, stepVersion, stepLook][step]();
      summary();
      Fresh.svg.render(root);
    }

    // silnik
    function stepEngine() {
      body.innerHTML = '<div class="engine-grid"></div>';
      const grid = body.firstChild;
      for (const e of ENGINES) {
        const b = document.createElement('button');
        b.className = `engine-card engine--${e.id}${draft.loader === e.id ? ' is-selected' : ''}`;
        b.appendChild(Fresh.brand.profileIcon({ icon: e.icon }, 'lg'));
        b.insertAdjacentHTML('beforeend', `<span class="engine-tag">${esc(e.tag)}</span><strong>${esc(e.name)}</strong><p>${esc(e.desc)}</p>
          <span class="engine-check"><i class="ico" data-ico="check" data-size="14"></i></span>`);
        b.addEventListener('click', () => {
          if (draft.loader !== e.id) {
            draft.loader = e.id;
            draft.loaderVersion = null;
            if (e.id === 'fabric' && !editing) draft.version = modVersion;
            if (!nameTouched && !editing && e.id !== 'fabric') draft.version = null;
            autoName();
          }
          go(1);
        });
        b.addEventListener('dblclick', () => go(1));
        grid.appendChild(b);
      }
    }

    // wersja
    async function stepVersion() {
      body.innerHTML = `
        <div class="ver-top">
          <div class="ver-featured" id="wz-featured"></div>
          <div class="ver-tools">
            <div class="search-box"><i class="ico" data-ico="search" data-size="16"></i>
              <input class="px-input" id="wz-search" type="search" placeholder="Szukaj wersji…" spellcheck="false" value="${esc(query)}"></div>
            <label class="toggle-row"><button class="px-toggle" id="wz-snap" role="switch" aria-checked="${snapshots}"></button><span>Snapshoty</span></label>
          </div>
        </div>
        <div class="ver-fams" id="wz-fams"></div>
        <div class="ver-grid" id="wz-grid"><div class="loading-row"><span class="px-spinner"></span> Wczytywanie wersji…</div></div>
        <div class="ver-loader" id="wz-loader" hidden></div>`;
      Fresh.svg.render(body);
      body.querySelector('#wz-search').addEventListener('input', (e) => {
        query = e.target.value.trim().toLowerCase();
        renderGrid();
      });
      body.querySelector('#wz-snap').addEventListener('click', (e) => {
        snapshots = !snapshots;
        e.currentTarget.setAttribute('aria-checked', String(snapshots));
        stepVersion();
      });

      let list;
      try {
        list = await versionsFor(draft.loader, snapshots);
      } catch (err) {
        body.querySelector('#wz-grid').innerHTML = `<div class="empty-row">Nie udało się pobrać listy: ${esc(err.message)}</div>`;
        return;
      }
      if (step !== 1) return;

      // polecane
      const feat = body.querySelector('#wz-featured');
      const latest = list.find((v) => v.type === 'release');
      const picks = [];
      if (draft.loader === 'fabric' && list.some((v) => v.id === modVersion)) picks.push({ id: modVersion, label: 'Z modem Fresh', hint: 'menu R-Shift, kosmetyki', star: true });
      if (latest && latest.id !== modVersion) picks.push({ id: latest.id, label: 'Najnowsza', hint: (latest.releaseTime || '').slice(0, 10) });
      for (const id of ['1.20.1', '1.8.9']) if (list.some((v) => v.id === id) && picks.length < 3) picks.push({ id, label: id === '1.8.9' ? 'PvP klasyk' : 'Modpacki', hint: 'popularna' });
      feat.innerHTML = '';
      for (const p of picks) {
        const b = document.createElement('button');
        b.className = `feat-card${p.star ? ' is-star' : ''}${draft.version === p.id ? ' is-selected' : ''}`;
        b.dataset.id = p.id;
        b.innerHTML = `<small>${esc(p.label)}</small><strong>${esc(p.id)}</strong><em>${esc(p.hint)}</em>`;
        b.addEventListener('click', () => pick(p.id));
        feat.appendChild(b);
      }

      // rodziny wersji
      const fams = [];
      for (const v of list) {
        const f = family(v);
        if (!fams.includes(f)) fams.push(f);
      }
      if (fam !== 'all' && !fams.includes(fam)) fam = 'all';
      const famBox = body.querySelector('#wz-fams');
      famBox.innerHTML = '';
      for (const f of ['all', ...fams.slice(0, 11)]) {
        const b = document.createElement('button');
        b.className = `chip${f === fam ? ' is-active' : ''}`;
        b.textContent = f === 'all' ? 'Wszystkie' : f;
        b.addEventListener('click', () => {
          fam = f;
          famBox.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === b));
          renderGrid();
        });
        famBox.appendChild(b);
      }

      function renderGrid() {
        const grid = body.querySelector('#wz-grid');
        const items = list.filter((v) => (fam === 'all' || family(v) === fam) && (!query || v.id.toLowerCase().includes(query)));
        grid.innerHTML = items.length ? '' : '<div class="empty-row">Brak wersji pasujących do filtra.</div>';
        const frag = document.createDocumentFragment();
        for (const v of items.slice(0, 240)) {
          const b = document.createElement('button');
          b.className = `ver-tile ver--${v.type}${draft.version === v.id ? ' is-selected' : ''}`;
          b.dataset.id = v.id;
          const mod = draft.loader === 'fabric' && v.id === modVersion;
          b.innerHTML = `<strong>${esc(v.id)}</strong>
            <small>${v.type === 'release' ? 'Wydanie' : v.type === 'snapshot' ? 'Snapshot' : esc(v.type.replace('old_', ''))} · ${esc((v.releaseTime || '').slice(0, 10))}</small>
            ${v.installed ? '<span class="ver-dot" title="Pobrana"></span>' : ''}${mod ? '<span class="ver-fresh">FRESH</span>' : ''}`;
          b.addEventListener('click', () => pick(v.id));
          b.addEventListener('dblclick', () => go(2));
          frag.appendChild(b);
        }
        grid.appendChild(frag);
        grid.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
      }

      function pick(id) {
        if (draft.version !== id) draft.loaderVersion = null;
        draft.version = id;
        autoName();
        body.querySelectorAll('.ver-tile, .feat-card').forEach((t) => t.classList.toggle('is-selected', t.dataset.id === id));
        summary();
        renderLoader();
      }

      async function renderLoader() {
        const box = body.querySelector('#wz-loader');
        if (draft.loader === 'vanilla' || !draft.version) {
          box.hidden = true;
          return;
        }
        box.hidden = false;
        box.innerHTML = `<span class="eyebrow">Wersja ${esc(LOADER_NAME[draft.loader])}</span><select class="px-select" id="wz-lv"><option>…</option></select>`;
        const sel = box.querySelector('#wz-lv');
        try {
          const opts = await api.versions.loaderVersions(draft.loader, draft.version);
          if (!opts.length) {
            sel.innerHTML = '<option value="">brak dla tej wersji</option>';
            return;
          }
          sel.innerHTML = opts.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}${o.stable === false && draft.loader === 'fabric' ? ' (beta)' : ''}</option>`).join('');
          const cur = opts.find((o) => o.id === draft.loaderVersion) || opts.find((o) => o.stable) || opts[0];
          sel.value = cur.id;
          draft.loaderVersion = cur.id;
        } catch {
          sel.innerHTML = '<option value="">nie udało się pobrać</option>';
        }
        sel.addEventListener('change', () => (draft.loaderVersion = sel.value || null));
      }

      renderGrid();
      renderLoader();
    }

    // wygląd
    function stepLook() {
      autoName();
      body.innerHTML = `
        <div class="look">
          <div class="look-preview" id="wz-preview"></div>
          <div class="look-form">
            <label class="field"><span class="eyebrow">Nazwa profilu</span>
              <input class="px-input" id="wz-name" maxlength="28" spellcheck="false" value="${esc(draft.name)}"></label>
            <div class="field"><span class="eyebrow">Ikona</span><div class="emblem-grid" id="wz-emblems"></div></div>
          </div>
        </div>`;
      const nameEl = body.querySelector('#wz-name');
      nameEl.addEventListener('input', () => {
        nameTouched = true;
        draft.name = nameEl.value;
        preview();
        summary();
      });
      nameEl.addEventListener('keydown', (e) => e.key === 'Enter' && finish());
      setTimeout(() => nameEl.select(), 60);
      const grid = body.querySelector('#wz-emblems');
      for (const id of Fresh.brand.ORDER) {
        const b = document.createElement('button');
        b.className = `emblem${Fresh.brand.emblemId(draft) === id ? ' is-selected' : ''}`;
        b.title = Fresh.brand.EMBLEMS[id].name;
        b.appendChild(Fresh.brand.profileIcon({ icon: id }, 'md'));
        b.addEventListener('click', () => {
          draft.icon = id;
          grid.querySelectorAll('.emblem').forEach((x) => x.classList.toggle('is-selected', x === b));
          preview();
          summary();
        });
        grid.appendChild(b);
      }
      preview();
    }

    function preview() {
      const box = body.querySelector('#wz-preview');
      if (!box) return;
      box.innerHTML = '';
      box.appendChild(Fresh.profiles.card({ ...draft, name: draft.name || 'Profil', id: draft.id || '__preview' }, { preview: true }));
    }

    async function finish() {
      if (!draft.version) return go(1);
      draft.name = (draft.name || '').trim() || `${LOADER_NAME[draft.loader]} ${draft.version}`;
      try {
        const saved = await api.profiles.save(draft);
        close(saved);
      } catch (err) {
        Fresh.ui.toast({ type: 'error', title: 'Profil', message: err.message });
      }
    }

    autoName();
    go(step);
    return result;
  }

  Fresh.wizard = { open };
})();

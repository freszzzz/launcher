// Nagrody: codzienna skrzynka z losowaniem jak w CS:GO, seria dni, odłamki i sklep odłamków.
window.Fresh = window.Fresh || {};

(() => {
  const { $, esc, toast } = Fresh.ui;
  const api = window.api;
  const R = window.FreshRewards;
  const RARITY_PL = { common: 'Zwykły', rare: 'Rzadki', epic: 'Epicki', legendary: 'Legendarny' };
  const SLOT_PL = { cape: 'Peleryna', head: 'Głowa', face: 'Twarz', back: 'Plecy', aura: 'Aura', pet: 'Towarzysz' };
  const CARD = 132; // szerokość karty na taśmie
  const GAP = 8;

  let state = null;
  let shopFilter = 'all';
  let countdown = null;

  // dźwięk (WebAudio, bez plików
  let audio = null;
  function blip(freq = 1400, dur = 0.025, vol = 0.04, type = 'square') {
    try {
      audio ||= new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + dur);
    } catch { /* brak audio – bez dźwięku */ }
  }
  const fanfare = (rarity) => {
    const notes = { common: [523, 659], rare: [523, 659, 784], epic: [523, 659, 784, 1047], legendary: [523, 659, 784, 1047, 1319] }[rarity];
    notes.forEach((f, i) => setTimeout(() => blip(f, 0.18, 0.05, 'triangle'), i * 90));
  };

  // skrzynka (pixel art
  const CHEST = [
    '..############..',
    '.#gGGGGGGGGGGg#.',
    '#gGwGGGGGGGGGGg#',
    '#GGGGGGGGGGGGGG#',
    '#GGGGGGGGGGGGGG#',
    '#ddddddyydddddd#',
    '################',
    '#mMMMMMyyMMMMMm#',
    '#MMMMMMYYMMMMMM#',
    '#MMMMMMyyMMMMMM#',
    '#MMMMMMMMMMMMMM#',
    '#mMMMMMMMMMMMMm#',
    '#nnnnnnnnnnnnnn#',
    '################'
  ];
  const CHEST_PAL = {
    '#': '#062b28', g: '#5eead4', G: '#14b8a6', w: '#ccfbf1', d: '#0f766e',
    M: '#0d9488', m: '#2dd4bf', n: '#115e59', y: '#fde68a', Y: '#fbbf24'
  };
  const drawChest = (canvas, scale = 8) => Fresh.icons.drawRows(canvas, { rows: CHEST, palette: CHEST_PAL }, scale);

  // dyniowa skrzynka (event Halloween): dynia-lampion z wieczkiem
  const PUMPKIN_CHEST = [
    '.......ss.......',
    '......sss.......',
    '....##ss###.....',
    '..#ooOoOooOo#...',
    '.#oOoOooOoOoo#..',
    '#oOoOoooOoOoOo#.',
    '#oOyyOooOyyOoo#.',
    '#oOyYyooOyYyoo#.',
    '#oOoOoyyOoOoOo#.',
    '#oyOyOyyyOyOyo#.',
    '#ooYyYyYyYyYoo#.',
    '.#oOyOyOyOyOo#..',
    '..#ooOoOoOoo#...',
    '....########....'
  ];
  const PUMPKIN_PAL = { '#': '#3b1205', o: '#f97316', O: '#ea580c', y: '#ffd54a', Y: '#fff3b0', s: '#4d7c0f' };
  const drawPumpkin = (canvas, scale = 8) => Fresh.icons.drawRows(canvas, { rows: PUMPKIN_CHEST, palette: PUMPKIN_PAL }, scale);

  function fmtEventLeft(ts) {
    const s = Math.max(0, Math.floor((ts - Date.now()) / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0) return `${d} ${d === 1 ? 'dzień' : 'dni'} ${h} godz.`;
    const m = Math.floor((s % 3600) / 60);
    return `${h} godz. ${m} min`;
  }

  function renderEvent() {
    const box = $('#event-hero');
    const ev = state.event;
    box.hidden = !ev;
    if (!ev) return;
    const have = owned();
    const got = ev.items.filter((id) => have.has(id)).length;
    box.classList.toggle('is-ready', ev.available);
    box.innerHTML = `
      <div class="crate-art"><span class="crate-glow"></span><canvas id="event-canvas"></canvas><span class="crate-shadow"></span>
        <span class="bat bat--1"></span><span class="bat bat--2"></span></div>
      <div class="crate-info">
        <span class="eyebrow ev-tag">Event ${esc(ev.name)} · kończy się za ${esc(fmtEventLeft(ev.endsAt))}</span>
        <h3>${esc(ev.crate)}</h3>
        <p class="muted">Raz dziennie, osobno od zwykłej skrzynki. Tylko limitowane kosmetyki Halloween – po evencie znikną ze skrzynek i sklepu.
          Szanse: rzadki ${ev.weights.rare}%, epicki ${ev.weights.epic}%, legendarny ${ev.weights.legendary}%.</p>
        <div class="ev-items" id="ev-items"></div>
        <div class="ev-bottom">
          ${ev.available
            ? '<button class="px-btn crate-open crate-open--ev tex" id="btn-event-open"><i class="ico" data-ico="gift" data-size="18"></i> Otwórz dyniową skrzynkę</button>'
            : `<div class="crate-wait"><i class="ico" data-ico="clock" data-size="16"></i> Następna za <b class="ev-left">${fmtLeft()}</b></div>`}
          <span class="ev-progress"><b>${got}/${ev.items.length}</b> zebrane</span>
        </div>
      </div>`;
    drawPumpkin(box.querySelector('#event-canvas'), 9);
    const strip = box.querySelector('#ev-items');
    for (const id of ev.items) {
      const it = R.BY_ID[id];
      const el = document.createElement('span');
      el.className = `ev-item rar-${it.rarity}${have.has(id) ? ' is-owned' : ''}`;
      el.title = `${it.name} · ${RARITY_PL[it.rarity]}${have.has(id) ? ' · masz' : ''}`;
      const t = Fresh.cosmetics.thumb(id, 48);
      if (it.slot === 'cape') t.classList.add('cape-thumb');
      el.appendChild(t);
      if (have.has(id)) el.insertAdjacentHTML('beforeend', '<i class="ico" data-ico="check" data-size="10"></i>');
      strip.appendChild(el);
    }
    box.querySelector('#btn-event-open')?.addEventListener('click', () => openCrate('event'));
    Fresh.svg.render(box);
  }

  // pomocnicze
  const owned = () => new Set(state?.owned || []);
  const fmtLeft = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    const p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
  };

  function itemCard(id, cls = '') {
    const it = R.BY_ID[id];
    const el = document.createElement('div');
    el.className = `rcard rar-${it.rarity} ${cls}`;
    const art = document.createElement('div');
    art.className = 'rcard-art';
    const t = Fresh.cosmetics.thumb(id, 96);
    if (it.slot === 'cape') t.classList.add('cape-thumb');
    art.appendChild(t);
    el.appendChild(art);
    el.insertAdjacentHTML('beforeend', `<strong>${esc(it.name)}</strong><small>${esc(SLOT_PL[it.slot])} · ${esc(RARITY_PL[it.rarity])}</small>`);
    return el;
  }

  // panel
  function renderHero() {
    const box = $('#crate-hero');
    const s = state;
    // który dzień 7-dniowego cyklu to dziś (po otwarciu)
    const cur = s.available ? s.nextStreak : s.streak;
    const pos = cur > 0 ? ((cur - 1) % R.STREAK_BONUS) + 1 : 0;
    const pips = Array.from({ length: R.STREAK_BONUS }, (_, i) => {
      const day = i + 1;
      const done = day < pos || (!s.available && day === pos);
      const today = s.available && day === pos;
      return `<span class="pip${done ? ' is-done' : ''}${today ? ' is-today' : ''}${day === R.STREAK_BONUS ? ' is-bonus' : ''}" title="Dzień ${day}${day === R.STREAK_BONUS ? ' – gwarantowany epicki lub lepszy' : ''}">${day === R.STREAK_BONUS ? '<i class="ico" data-ico="star" data-size="11"></i>' : day}</span>`;
    }).join('');
    box.classList.toggle('is-ready', s.available);
    box.innerHTML = `
      <div class="crate-art"><span class="crate-glow"></span><canvas id="crate-canvas"></canvas><span class="crate-shadow"></span></div>
      <div class="crate-info">
        <span class="eyebrow">Codzienna skrzynka</span>
        <h3>${s.available ? 'Skrzynka czeka na Ciebie!' : 'Dzisiejsza skrzynka otwarta'}</h3>
        <p class="muted">${s.available ? 'Jedno losowanie dziennie. Każdy kosmetyk z kolekcji może wypaść – duplikaty zamieniają się w odłamki.' : 'Nowa skrzynka o północy. Wróć jutro, żeby nie stracić serii!'}</p>
        <div class="streak"><span class="streak-label"><i class="ico" data-ico="flame" data-size="15"></i> Seria: <b>${s.available ? s.nextStreak - 1 : s.streak}</b> ${(s.available ? s.nextStreak - 1 : s.streak) === 1 ? 'dzień' : 'dni'}</span><div class="pips">${pips}</div></div>
        ${s.available
          ? '<button class="px-btn crate-open tex" id="btn-crate-open"><i class="ico" data-ico="gift" data-size="18"></i> Otwórz skrzynkę</button>'
          : `<div class="crate-wait"><i class="ico" data-ico="clock" data-size="16"></i> Następna za <b id="crate-left">${fmtLeft()}</b></div>`}
      </div>`;
    drawChest(box.querySelector('#crate-canvas'), 9);
    box.querySelector('#btn-crate-open')?.addEventListener('click', () => openCrate('daily'));
    Fresh.svg.render(box);
    clearInterval(countdown);
    if (!s.available || (s.event && !s.event.available)) {
      countdown = setInterval(() => {
        const els = document.querySelectorAll('#crate-left, .ev-left');
        if (!els.length) return clearInterval(countdown);
        const left = fmtLeft();
        els.forEach((el) => (el.textContent = left));
        if (left === '00:00:00') refresh();
      }, 1000);
    }
  }

  function renderSide() {
    const s = state;
    const pct = Math.round((s.owned.length / s.total) * 100);
    $('#rw-shards').textContent = s.shards;
    $('#rw-collection').textContent = `${s.owned.length}/${s.total}`;
    $('#rw-collection-bar').style.width = `${pct}%`;
    $('#rw-opened').textContent = s.opened;
    const odds = $('#rw-odds');
    odds.innerHTML = R.RARITIES.map((r) => `<div class="odd rar-${r}"><span class="odd-dot"></span><span>${esc(RARITY_PL[r])}</span><b>${R.WEIGHTS[r]}%</b><small>dupl. +${R.SHARDS[r]}</small></div>`).join('');
    const hist = $('#rw-history');
    hist.innerHTML = '';
    if (!s.history.length) hist.innerHTML = '<p class="muted rw-empty">Tu pojawią się Twoje dropy.</p>';
    for (const h of s.history.slice(0, 6)) {
      const it = R.BY_ID[h.id];
      if (!it) continue;
      const row = document.createElement('div');
      row.className = `hist rar-${it.rarity}`;
      const t = Fresh.cosmetics.thumb(h.id, 48);
      if (it.slot === 'cape') t.classList.add('cape-thumb');
      const art = document.createElement('span');
      art.className = 'hist-art';
      art.appendChild(t);
      row.appendChild(art);
      row.insertAdjacentHTML('beforeend', `<span class="hist-text"><strong>${esc(it.name)}</strong><small>${h.bought ? 'kupiono' : h.duplicate ? `duplikat · +${h.shards} odłamków` : 'nowy!'} · ${new Date(h.at).toLocaleDateString('pl-PL')}</small></span>`);
      hist.appendChild(row);
    }
  }

  function renderShop() {
    const grid = $('#rw-shop');
    const have = owned();
    const box = $('#rw-shop-filter');
    box.innerHTML = '';
    const ev = state.event;
    if (!ev && shopFilter === 'event') shopFilter = 'all';
    for (const f of ['all', ...(ev ? ['event'] : []), ...R.RARITIES]) {
      const b = document.createElement('button');
      b.className = `chip chip--rar rar-${f}${f === 'event' ? ' chip--event' : ''}${shopFilter === f ? ' is-active' : ''}`;
      b.textContent = f === 'all' ? 'Wszystkie' : f === 'event' ? `🎃 ${ev.name}` : RARITY_PL[f];
      b.addEventListener('click', () => {
        shopFilter = f;
        renderShop();
      });
      box.appendChild(b);
    }
    const locked = R.POOL.filter((i) => !have.has(i.id) && R.buyable(i) && (shopFilter === 'all' || (shopFilter === 'event' ? !!i.event : i.rarity === shopFilter)))
      .sort((a, b) => Number(!!b.event) - Number(!!a.event) || R.COST[a.rarity] - R.COST[b.rarity]);
    grid.innerHTML = locked.length ? '' : '<div class="cos-empty"><i class="ico" data-ico="trophy" data-size="28"></i><strong>Masz wszystko!</strong><span>Kolekcja skompletowana – gratulacje.</span></div>';
    for (const it of locked) {
      const card = itemCard(it.id, 'rcard--shop');
      const cost = R.COST[it.rarity];
      const btn = document.createElement('button');
      btn.className = 'rcard-buy';
      btn.disabled = state.shards < cost;
      btn.innerHTML = `<i class="ico" data-ico="gem" data-size="13"></i> ${cost}`;
      btn.title = btn.disabled ? `Brakuje ${cost - state.shards} odłamków` : 'Kup za odłamki';
      btn.addEventListener('click', () => buy(it.id));
      card.appendChild(btn);
      if (it.event) card.insertAdjacentHTML('afterbegin', '<span class="rcard-limit">LIMIT</span>');
      grid.appendChild(card);
    }
    Fresh.svg.render(grid);
  }

  function render() {
    if (!state) return;
    renderEvent();
    renderHero();
    renderSide();
    renderShop();
    const badge = $('#rewards-badge');
    if (badge) badge.hidden = !(state.available || state.event?.available);
  }

  async function refresh() {
    state = await api.rewards.state();
    Fresh.cosmetics.setOwned(state.owned);
    render();
    return state;
  }

  async function buy(id) {
    const it = R.BY_ID[id];
    if (!(await Fresh.ui.confirm('Kupić kosmetyk?', `${it.name} (${RARITY_PL[it.rarity]}) za ${R.COST[it.rarity]} odłamków.`, 'Kup', 'green'))) return;
    try {
      state = await api.rewards.buy(id);
      Fresh.cosmetics.setOwned(state.owned);
      render();
      toast({ type: 'success', title: 'Odblokowano', message: `${it.name} jest Twój – załóż go w Kosmetykach.` });
    } catch (err) {
      toast({ type: 'warn', title: 'Sklep', message: err.message });
    }
  }

  /** Kliknięcie zablokowanego kosmetyku w garderobie. */
  function offer(id) {
    const it = R.BY_ID[id];
    if (!it || !state) return;
    if (!R.buyable(it)) {
      Fresh.ui.modal({ title: `${it.name} – edycja limitowana`, html: '<p>Ten kosmetyk był dostępny tylko podczas eventu. Wróci może przy następnej okazji!</p>', actions: [{ label: 'OK', variant: 'white', value: null }] });
      return;
    }
    const cost = R.COST[it.rarity];
    const m = Fresh.ui.modal({
      title: `${it.name} jest zablokowany`,
      html: it.event
        ? `<p>Limitowany kosmetyk eventu <b>${esc(state.event.name)}</b> – wypada z <b>${esc(state.event.crate)}</b> albo kupisz go za <b>${cost} odłamków</b> do końca eventu. Masz: <b>${state.shards}</b>.</p>`
        : `<p>Możesz go wylosować w <b>codziennej skrzynce</b> (${R.WEIGHTS[it.rarity]}% na rzadkość ${RARITY_PL[it.rarity].toLowerCase()}) albo kupić za <b>${cost} odłamków</b>. Masz: <b>${state.shards}</b>.</p>`,
      actions: [
        { label: 'Do skrzynki', variant: 'white', value: 'crate' },
        ...(state.shards >= cost ? [{ label: `Kup za ${cost}`, variant: 'green', value: 'buy' }] : [])
      ]
    });
    m.result.then((v) => {
      if (v === 'crate') Fresh.ui.showPanel('rewards');
      if (v === 'buy') buy(id);
    });
  }

  // losowanie
  async function openCrate(kind = 'daily') {
    let res;
    try {
      res = await api.rewards.open(kind);
    } catch (err) {
      toast({ type: 'warn', title: 'Skrzynka', message: err.message });
      return refresh();
    }
    const win = R.BY_ID[res.winner];
    const root = document.createElement('div');
    root.className = `roll-backdrop${res.event ? ` roll--${res.event}` : ''}`;
    const title = res.event ? state.event?.crate || 'Skrzynka eventowa' : 'Codzienna skrzynka';
    root.innerHTML = `
      <div class="roll">
        <div class="roll-head"><span class="eyebrow">${esc(title)}${res.bonus ? ' · bonus serii: epicki lub lepszy!' : ''}</span><h3>Losowanie…</h3></div>
        <div class="roll-window">
          <div class="roll-strip"></div>
          <span class="roll-marker"></span>
          <span class="roll-fade roll-fade--l"></span><span class="roll-fade roll-fade--r"></span>
        </div>
        <div class="roll-result" hidden></div>
        <div class="roll-actions"><button class="px-btn px-btn--white px-btn--sm" data-act="skip">Pomiń animację</button></div>
      </div>`;
    document.getElementById('modal-root').appendChild(root);
    const strip = root.querySelector('.roll-strip');
    res.reel.forEach((id, i) => strip.appendChild(itemCard(id, i === res.index ? 'is-target' : '')));

    const windowW = root.querySelector('.roll-window').clientWidth;
    const step = CARD + GAP;
    // zatrzymanie w losowym miejscu karty, nie zawsze idealnie na środku – jak w CS:GO
    const jitter = (Math.random() - 0.5) * (CARD * 0.7);
    const target = res.index * step + CARD / 2 - windowW / 2 + jitter;
    const duration = 7200;
    const ease = (t) => 1 - Math.pow(1 - t, 4.2);
    let startT = null;
    let lastCard = -1;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      strip.style.transform = `translateX(${-target}px)`;
      reveal();
    };
    root.querySelector('[data-act="skip"]').addEventListener('click', finish);

    const frame = (t) => {
      if (done) return;
      startT ??= t;
      const p = Math.min(1, (t - startT) / duration);
      const x = target * ease(p);
      strip.style.transform = `translateX(${-x}px)`;
      const under = Math.floor((x + windowW / 2) / step);
      if (under !== lastCard) {
        lastCard = under;
        blip(1300 + Math.random() * 200);
      }
      if (p < 1) requestAnimationFrame(frame);
      else finish();
    };
    requestAnimationFrame(frame);

    function reveal() {
      state = res.state;
      Fresh.cosmetics.setOwned(state.owned);
      render();
      fanfare(win.rarity);
      root.classList.add(`is-done`, `rar-${win.rarity}`);
      root.querySelector('.roll-head h3').textContent = res.duplicate ? 'Duplikat!' : 'Nowy kosmetyk!';
      strip.querySelector('.is-target').classList.add('is-win');
      const box = root.querySelector('.roll-result');
      box.hidden = false;
      box.className = `roll-result rar-${win.rarity}`;
      box.innerHTML = `
        <div class="rr-art"><span class="rr-burst"></span></div>
        <div class="rr-text">
          <span class="rr-rar">${esc(RARITY_PL[win.rarity])} · ${esc(SLOT_PL[win.slot])}</span>
          <strong>${esc(win.name)}</strong>
          <span class="muted">${res.duplicate ? `Masz go już – dostajesz <b>+${res.shards} odłamków</b> (razem ${state.shards}).` : 'Odblokowany na zawsze. Widzą go wszyscy gracze Fresh.'}</span>
        </div>`;
      const t = Fresh.cosmetics.thumb(win.id, 128);
      if (win.slot === 'cape') t.classList.add('cape-thumb');
      box.querySelector('.rr-art').appendChild(t);
      confetti(root.querySelector('.roll'), win.rarity);
      const actions = root.querySelector('.roll-actions');
      actions.innerHTML = '';
      const close = () => {
        root.classList.add('is-leaving');
        setTimeout(() => root.remove(), 220);
      };
      if (!res.duplicate) {
        const wear = document.createElement('button');
        wear.className = 'px-btn px-btn--sm';
        wear.innerHTML = '<i class="ico" data-ico="shirt" data-size="15"></i> Załóż teraz';
        wear.addEventListener('click', () => {
          Fresh.cosmetics.wear(win.id);
          close();
          Fresh.ui.showPanel('cosmetics');
        });
        actions.appendChild(wear);
      }
      const ok = document.createElement('button');
      ok.className = 'px-btn px-btn--white px-btn--sm';
      ok.textContent = 'Super!';
      ok.addEventListener('click', close);
      actions.appendChild(ok);
      Fresh.svg.render(root);
    }
  }

  /** Pikselowe konfetti w kolorze rzadkości. */
  function confetti(host, rarity) {
    const colors = { common: ['#cbd5e1', '#94a3b8'], rare: ['#38e1ff', '#22d3ee', '#a5f3fc'], epic: ['#c084fc', '#a855f7', '#f0abfc'], legendary: ['#fbbf24', '#f97316', '#fde68a', '#fff'] }[rarity];
    const n = { common: 24, rare: 40, epic: 60, legendary: 90 }[rarity];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'confetti';
      p.style.setProperty('--x', `${(Math.random() - 0.5) * 760}px`);
      p.style.setProperty('--y', `${-80 - Math.random() * 260}px`);
      p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
      p.style.setProperty('--d', `${700 + Math.random() * 900}ms`);
      p.style.background = colors[i % colors.length];
      host.appendChild(p);
      setTimeout(() => p.remove(), 1800);
    }
  }

  function init() {
    refresh().catch((err) => toast({ type: 'error', title: 'Nagrody', message: err.message }));
  }

  Fresh.rewards = { init, refresh, offer, render, drawChest, drawPumpkin, state: () => state };
})();

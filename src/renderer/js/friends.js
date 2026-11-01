// Znajomi: lista (online / w grze / offline), zaproszenia, dodawanie po nicku, karta na stronie głównej.
window.Fresh = window.Fresh || {};

(() => {
  const { $, esc, toast, confirm } = Fresh.ui;
  const api = window.api;
  let data = null;
  let timer = null;

  function ago(ts) {
    if (!ts) return 'dawno';
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 60) return `${Math.max(1, m)} min temu`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h} godz. temu` : `${Math.floor(h / 24)} dni temu`;
  }

  function statusText(f) {
    if (f.status === 'game') return { text: `Gra${f.detail ? ` · ${f.detail}` : ''}`, cls: 'is-game' };
    if (f.status === 'launcher') return { text: 'W launcherze', cls: 'is-launcher' };
    return { text: `Offline · ${ago(f.lastSeen)}`, cls: '' };
  }

  function avatar(uuid, status, large) {
    const el = document.createElement('span');
    el.className = `avatar${large ? ' avatar--lg' : ''}${status === 'game' ? ' is-game' : status === 'launcher' ? ' is-launcher' : ''}`;
    api.friends.avatar(uuid).then((src) => {
      if (!src) return;
      const img = new Image();
      img.src = src;
      img.alt = '';
      el.appendChild(img);
    }).catch(() => {});
    return el;
  }

  function iconBtn(ico, title, cls, onClick) {
    const b = document.createElement('button');
    b.className = `icon-btn ${cls}`;
    b.title = title;
    b.innerHTML = `<i class="ico" data-ico="${ico}" data-size="16"></i>`;
    b.addEventListener('click', onClick);
    return b;
  }

  async function act(action, uuid, okMsg) {
    try {
      await api.friends.action(action, uuid);
      if (okMsg) toast({ type: 'success', title: 'Znajomi', message: okMsg, timeout: 2500 });
      refresh();
    } catch (err) {
      toast({ type: 'error', title: 'Znajomi', message: err.message });
    }
  }

  function row(f, kind) {
    const r = document.createElement('div');
    r.className = 'friend-row';
    const st = kind === 'friend' ? statusText(f) : { text: kind === 'incoming' ? 'Chce dodać Cię do znajomych' : 'Zaproszenie wysłane', cls: '' };
    r.appendChild(avatar(f.uuid, kind === 'friend' ? f.status : 'offline', true));
    const meta = document.createElement('div');
    meta.className = 'friend-meta';
    meta.innerHTML = `<strong>${esc(f.name)}</strong><small class="${st.cls}">${esc(st.text)}</small>`;
    r.appendChild(meta);
    const actions = document.createElement('div');
    actions.className = 'friend-actions';
    if (kind === 'incoming') {
      actions.append(
        iconBtn('check', 'Akceptuj', 'ok', () => act('accept', f.uuid, `${f.name} jest teraz Twoim znajomym!`)),
        iconBtn('x', 'Odrzuć', 'no', () => act('decline', f.uuid))
      );
    } else if (kind === 'outgoing') {
      actions.append(iconBtn('x', 'Anuluj zaproszenie', 'no', () => act('decline', f.uuid)));
    } else {
      actions.append(iconBtn('x', 'Usuń ze znajomych', 'no', async () => {
        if (await confirm('Usunąć znajomego?', `${f.name} zniknie z Twojej listy.`, 'Usuń', 'red')) act('remove', f.uuid);
      }));
    }
    r.appendChild(actions);
    return r;
  }

  function section(title, icon, items, kind) {
    if (!items.length) return null;
    const s = document.createElement('div');
    s.className = 'friend-section';
    s.innerHTML = `<h4><i class="ico" data-ico="${icon}" data-size="14"></i>${esc(title)} · ${items.length}</h4><div class="friend-list"></div>`;
    const list = s.querySelector('.friend-list');
    items.forEach((f) => list.appendChild(row(f, kind)));
    return s;
  }

  function renderPanel() {
    const box = $('#friends-sections');
    box.innerHTML = '';
    if (!data) return;
    if (data.error) {
      box.innerHTML = `<div class="friends-empty"><strong>Znajomi są niedostępni</strong>${esc(data.error)}</div>`;
      return;
    }
    const online = data.friends.filter((f) => f.online).sort((a, b) => (a.status === 'game' ? -1 : 1) - (b.status === 'game' ? -1 : 1));
    const offline = data.friends.filter((f) => !f.online);
    const parts = [
      section('Zaproszenia', 'userPlus', data.incoming, 'incoming'),
      section('Online', 'gamepad', online, 'friend'),
      section('Offline', 'moon', offline, 'friend'),
      section('Wysłane', 'clock', data.outgoing, 'outgoing')
    ].filter(Boolean);
    if (!parts.length) {
      box.innerHTML = '<div class="friends-empty"><strong>Nie masz jeszcze znajomych</strong>Wpisz nick znajomego powyżej i wyślij zaproszenie.</div>';
      return;
    }
    parts.forEach((p) => box.appendChild(p));
    Fresh.svg.render(box);
  }

  function renderMini() {
    const box = $('#mini-friends');
    const count = $('#friends-online-count');
    const badge = $('#friends-badge');
    box.innerHTML = '';
    if (!data || data.error) {
      count.textContent = '0';
      badge.hidden = true;
      box.innerHTML = `<div class="mini-empty">${data?.error ? esc(data.error) : 'Ładowanie…'}</div>`;
      return;
    }
    const online = data.friends.filter((f) => f.online);
    count.textContent = String(online.length);
    badge.hidden = !data.incoming.length;
    badge.textContent = String(data.incoming.length);
    if (!online.length) {
      box.innerHTML = `<div class="mini-empty">${data.friends.length ? 'Nikt z Twoich znajomych nie jest teraz online.' : 'Dodaj znajomych w zakładce Znajomi.'}</div>`;
      return;
    }
    online.slice(0, 3).forEach((f) => {
      const r = document.createElement('div');
      r.className = 'mini-friend';
      r.appendChild(avatar(f.uuid, f.status, false));
      const st = statusText(f);
      r.insertAdjacentHTML('beforeend', `<span class="friend-meta"><strong>${esc(f.name)}</strong><small class="${st.cls}">${esc(st.text)}</small></span>`);
      box.appendChild(r);
    });
  }

  async function refresh() {
    try {
      data = await api.friends.list();
    } catch (err) {
      data = { error: err.message, friends: [], incoming: [], outgoing: [] };
    }
    renderPanel();
    renderMini();
  }

  function init() {
    $('#add-friend').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#friend-name');
      const name = input.value.trim();
      if (!/^[A-Za-z0-9_]{2,16}$/.test(name)) {
        Fresh.ui.shake($('#add-friend'));
        toast({ type: 'warn', title: 'Znajomi', message: 'Nick Minecraft ma 2–16 znaków: litery, cyfry i _.' });
        return;
      }
      try {
        const res = await api.friends.add(name);
        input.value = '';
        toast({
          type: 'success',
          title: 'Znajomi',
          message: res.status === 'friends' ? `Ty i ${name} jesteście już znajomymi!` : `Wysłano zaproszenie do ${res.name || name}.`
        });
        refresh();
      } catch (err) {
        toast({ type: 'error', title: 'Znajomi', message: err.message });
      }
    });
    $('#btn-friends-all').addEventListener('click', () => Fresh.ui.showPanel('friends'));
    $('#btn-friends-settings').addEventListener('click', () => Fresh.ui.showPanel('settings'));
    Fresh.svg.render($('#friends-card'));
    refresh();
    clearInterval(timer);
    timer = setInterval(refresh, 30000);
  }

  Fresh.friends = { init, refresh };
})();

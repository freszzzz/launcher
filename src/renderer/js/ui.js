// Warstwa UI: przejścia między panelami, toasty, modale.
window.Fresh = window.Fresh || {};

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /** Czeka na koniec animacji elementu (z bezpiecznym timeoutem). */
  function animationDone(el, fallbackMs) {
    return new Promise((resolve) => {
      const timer = setTimeout(finish, fallbackMs);
      function finish() {
        clearTimeout(timer);
        el.removeEventListener('animationend', onEnd);
        resolve();
      }
      function onEnd(e) {
        if (e.target === el) finish();
      }
      el.addEventListener('animationend', onEnd);
    });
  }

  /** Numeruje elementy .stagger, aby wjeżdżały kaskadowo. */
  function applyStagger(panel) {
    $$('.stagger', panel).forEach((el, i) => el.style.setProperty('--i', i));
  }

  // Nawigacja
  const listeners = new Set();
  let current = 'home';
  let switching = false;
  let queued = null;

  function moveIndicator(btn) {
    const ind = $('#nav-indicator');
    const inNav = btn.parentElement === ind.parentElement;
    ind.style.opacity = inNav ? '1' : '0';
    if (!inNav) return;
    ind.style.transform = `translateY(${btn.offsetTop}px)`;
    ind.style.height = `${btn.offsetHeight}px`;
  }

  async function showPanel(name) {
    if (name === current && !switching) return;
    if (switching) {
      queued = name;
      return;
    }
    switching = true;

    const from = $(`.panel[data-panel="${current}"]`);
    const to = $(`.panel[data-panel="${name}"]`);
    $$('.nav-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.target === name));
    moveIndicator($(`.nav-btn[data-target="${name}"]`));

    const wipe = $('#wipe');
    wipe.classList.remove('run');
    void wipe.offsetWidth; // restart animacji
    wipe.classList.add('run');

    from.classList.add('is-leaving');
    await animationDone(from, 260);
    from.classList.remove('is-active', 'is-leaving');

    applyStagger(to);
    to.scrollTop = 0;
    to.classList.add('is-active', 'is-entering');
    current = name;
    listeners.forEach((fn) => fn(name));
    await animationDone(to, 520);
    to.classList.remove('is-entering');

    switching = false;
    if (queued && queued !== current) {
      const next = queued;
      queued = null;
      showPanel(next);
    } else {
      queued = null;
    }
  }

  function initNav() {
    $$('.nav-btn').forEach((btn) => btn.addEventListener('click', () => showPanel(btn.dataset.target)));
    requestAnimationFrame(() => moveIndicator($('.nav-btn.is-active')));
    applyStagger($('.panel.is-active'));
    $('.panel.is-active').classList.add('is-entering');
    setTimeout(() => $('.panel.is-active').classList.remove('is-entering'), 900);
  }

  // Toasty
  const ICON = { success: '✓', error: '!', warn: '?', info: 'i' };

  function toast({ type = 'info', title, message = '', timeout = 4500 }) {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <div class="toast-icon">${ICON[type] || 'i'}</div>
      <div>
        <p class="toast-title">${esc(title || type.toUpperCase())}</p>
        <p class="toast-msg">${esc(message)}</p>
      </div>
      <div class="toast-timer" style="animation-duration:${timeout}ms"></div>`;
    $('#toasts').prepend(el);

    const close = () => {
      if (el.classList.contains('is-leaving')) return;
      el.classList.add('is-leaving');
      animationDone(el, 400).then(() => el.remove());
    };
    // Timer = koniec animacji paska (pauzuje się po najechaniu myszą).
    el.querySelector('.toast-timer').addEventListener('animationend', close);
    el.addEventListener('click', close);

    const all = $$('.toast:not(.is-leaving)', $('#toasts'));
    all.slice(4).forEach((t) => t.click());
    return close;
  }

  // Modale
  function modal({ title, html, actions = [], dismissable = true }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal px-frame" role="dialog" aria-modal="true">
        <h3>${esc(title)}</h3>
        <div class="modal-body">${html}</div>
        <div class="modal-actions"></div>
      </div>`;
    const bar = $('.modal-actions', backdrop);

    let resolveFn;
    const result = new Promise((r) => (resolveFn = r));
    const close = (value) => {
      if (backdrop.classList.contains('is-leaving')) return;
      backdrop.classList.add('is-leaving');
      animationDone(backdrop, 260).then(() => backdrop.remove());
      resolveFn(value);
    };

    actions.forEach((a) => {
      const b = document.createElement('button');
      b.className = `px-btn px-btn--sm ${a.variant ? `px-btn--${a.variant}` : ''}`;
      b.textContent = a.label;
      b.addEventListener('click', () => close(a.value));
      bar.appendChild(b);
    });
    if (!actions.length) bar.remove();
    if (dismissable) backdrop.addEventListener('mousedown', (e) => e.target === backdrop && close(null));

    $('#modal-root').appendChild(backdrop);
    return { result, close };
  }

  function confirm(title, text, okLabel = 'TAK', variant = 'pink') {
    return modal({
      title,
      html: `<p>${esc(text)}</p>`,
      actions: [
        { label: 'ANULUJ', variant: 'ghost', value: false },
        { label: okLabel, variant, value: true }
      ]
    }).result;
  }

  function shake(el) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  Fresh.ui = { $, $$, esc, showPanel, initNav, onPanel: (fn) => listeners.add(fn), toast, modal, confirm, shake, applyStagger };
})();

// Segmentowy pasek postępu w stylu paska XP/HP z retro RPG.
window.Fresh = window.Fresh || {};

(() => {
  const SEGMENTS = 30;
  const bar = document.getElementById('xpbar');
  const track = document.getElementById('xp-track');
  const stageEl = document.getElementById('xp-stage');
  const detailEl = document.getElementById('xp-detail');
  const segs = [];

  // Kolor segmentów płynnie przechodzi fiolet -> błękit.
  for (let i = 0; i < SEGMENTS; i++) {
    const s = document.createElement('i');
    s.className = 'seg';
    const t = i / (SEGMENTS - 1);
    s.style.setProperty('--seg-c', `hsl(${262 - t * 70} ${88 - t * 8}% ${66 + t * 6}%)`);
    s.style.setProperty('--i', i);
    track.appendChild(s);
    segs.push(s);
  }

  let filled = 0;
  let resetTimer = null;

  function render(target) {
    // Segmenty zapalają się pojedynczo -> retro "napełnianie" zamiast skoku.
    segs.forEach((s, i) => {
      const on = i < target;
      if (on && !s.classList.contains('on')) {
        s.style.animationDelay = `${Math.max(0, i - filled) * 18}ms`;
      } else if (!on) {
        s.style.animationDelay = '';
      }
      s.classList.toggle('on', on);
      s.classList.toggle('head', on && i === target - 1 && target < SEGMENTS);
    });
    filled = target;
  }

  function fmt(current, total) {
    if (!total) return '';
    if (total > 1e5) return `${(current / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB`;
    return `${current} / ${total}`;
  }

  /** percent = null -> tryb nieokreślony (fala). */
  function set({ label, percent, current, total }) {
    clearTimeout(resetTimer);
    bar.classList.remove('complete', 'error');
    stageEl.textContent = label || '';
    detailEl.textContent = percent == null ? '' : `${fmt(current, total)}  ${Math.floor(percent)}%`;

    if (percent == null) {
      bar.classList.add('indeterminate');
      render(0);
      return;
    }
    bar.classList.remove('indeterminate');
    render(Math.round((percent / 100) * SEGMENTS));
  }

  function complete(label = 'Gotowe!') {
    bar.classList.remove('indeterminate', 'error');
    render(SEGMENTS);
    stageEl.textContent = label;
    detailEl.textContent = '100%';
    bar.classList.add('complete');
  }

  function fail(label = 'BŁĄD') {
    bar.classList.remove('indeterminate');
    bar.classList.add('error');
    stageEl.textContent = label;
    Fresh.ui.shake(bar);
    resetTimer = setTimeout(() => reset(), 4000);
  }

  function reset(label = 'Gotowy do gry') {
    bar.classList.remove('indeterminate', 'complete', 'error');
    render(0);
    stageEl.textContent = label;
    detailEl.textContent = '';
  }

  Fresh.progress = { set, complete, fail, reset };
})();

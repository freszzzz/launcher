// Statystyki: czas gry, sesje, ostatnie 14 dni, profile, serwery, kolekcja.
window.Fresh = window.Fresh || {};

(() => {
  const { $, esc } = Fresh.ui;
  const api = window.api;
  const { LOADER_NAME } = Fresh.brand;
  const DAY_PL = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];

  function dur(ms, short = false) {
    const m = Math.round(ms / 60000);
    if (m < 1) return ms > 0 ? '<1 min' : '0 min';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (short) return r ? `${h}h ${r}m` : `${h}h`;
    return r ? `${h} godz. ${r} min` : `${h} godz.`;
  }

  function tile(icon, label, value, sub) {
    return `<div class="st-tile px-box"><span class="st-ico"><i class="ico" data-ico="${icon}" data-size="18"></i></span>
      <span class="st-label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></div>`;
  }

  /** Wykres słupkowy jednej serii (14 dni) – słupki w kolorze akcentu, podpowiedź po najechaniu. */
  function renderChart(days) {
    const box = $('#st-chart');
    const max = Math.max(...days.map((d) => d.ms), 30 * 60000);
    // "ładny" sufit osi: pełne pół godziny / godziny
    const stepMs = max > 4 * 3600000 ? 3600000 * 2 : max > 2 * 3600000 ? 3600000 : 1800000;
    const top = Math.ceil(max / stepMs) * stepMs;
    const grid = [top, top / 2, 0].map((v) => `<div class="ch-grid" style="bottom:${(v / top) * 100}%"><span>${dur(v, true)}</span></div>`).join('');
    const bars = days
      .map((d, i) => {
        const date = new Date(`${d.day}T12:00:00`);
        const h = d.ms ? Math.max(3, (d.ms / top) * 100) : 0;
        const today = i === days.length - 1;
        const label = `${DAY_PL[date.getDay()]} ${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
        return `<div class="ch-col${today ? ' is-today' : ''}" data-tip="${esc(label)} · ${esc(dur(d.ms))}">
          <div class="ch-bar" style="height:${h}%"></div>
          <span class="ch-x">${i % 2 === days.length % 2 || today ? (today ? 'dziś' : date.getDate()) : ''}</span>
        </div>`;
      })
      .join('');
    box.innerHTML = `<div class="ch-plot">${grid}<div class="ch-cols">${bars}</div></div><div class="ch-tip" hidden></div>`;
    const tip = box.querySelector('.ch-tip');
    box.querySelectorAll('.ch-col').forEach((c) => {
      c.addEventListener('mouseenter', () => {
        tip.hidden = false;
        tip.textContent = c.dataset.tip;
        const r = c.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        tip.style.left = `${r.left - b.left + r.width / 2}px`;
      });
      c.addEventListener('mouseleave', () => (tip.hidden = true));
    });
    const week = days.slice(-7).reduce((a, d) => a + d.ms, 0);
    $('#st-chart-sub').textContent = `W tym tygodniu: ${dur(week)}`;
  }

  function renderProfiles(list, total, profiles) {
    const box = $('#st-profiles');
    if (!list.length) {
      box.innerHTML = '<p class="muted st-empty">Zagraj na dowolnym profilu, a pojawi się tutaj.</p>';
      return;
    }
    const max = list[0].ms || 1;
    box.innerHTML = '';
    for (const p of list.slice(0, 6)) {
      const row = document.createElement('div');
      row.className = 'st-row';
      row.appendChild(Fresh.brand.profileIcon({ icon: profiles.find((x) => x.id === p.id)?.icon, loader: p.loader }, 'sm'));
      row.insertAdjacentHTML(
        'beforeend',
        `<div class="st-row-main"><div class="st-row-top"><strong>${esc(p.name)}${p.exists ? '' : ' <small>(usunięty)</small>'}</strong><span>${esc(dur(p.ms))}</span></div>
         <div class="st-track"><i style="width:${(p.ms / max) * 100}%"></i></div>
         <small>${esc(LOADER_NAME[p.loader] || '')} ${esc(p.version || '')} · ${total ? Math.round((p.ms / total) * 100) : 0}% czasu</small></div>`
      );
      box.appendChild(row);
    }
  }

  function renderServers(list, modes) {
    const box = $('#st-servers');
    const modeLine = `<div class="st-modes">
      <span><i class="ico" data-ico="globe" data-size="14"></i> Serwery <b>${esc(dur(modes.multi || 0))}</b></span>
      <span><i class="ico" data-ico="user" data-size="14"></i> Świat 1-os. <b>${esc(dur(modes.single || 0))}</b></span>
      <span><i class="ico" data-ico="home" data-size="14"></i> Menu <b>${esc(dur(modes.menu || 0))}</b></span></div>`;
    if (!list.length) {
      box.innerHTML = `${modeLine}<p class="muted st-empty">Wejdź na serwer – zapiszemy, gdzie grasz najwięcej.</p>`;
      Fresh.svg.render(box);
      return;
    }
    const max = list[0].ms || 1;
    box.innerHTML =
      modeLine +
      list
        .map(
          (s, i) => `<div class="st-srv"><span class="st-rank">${i + 1}</span><div class="st-row-main">
        <div class="st-row-top"><strong>${esc(s.host)}</strong><span>${esc(dur(s.ms))}</span></div>
        <div class="st-track"><i style="width:${(s.ms / max) * 100}%"></i></div></div></div>`
        )
        .join('');
    Fresh.svg.render(box);
  }

  async function render(profiles = []) {
    let s;
    try {
      s = await api.stats.summary();
    } catch (err) {
      $('#st-tiles').innerHTML = `<p class="muted">Nie udało się wczytać statystyk: ${esc(err.message)}</p>`;
      return;
    }
    $('#st-tiles').innerHTML = [
      tile('clock', 'Łączny czas gry', dur(s.total), s.firstDay ? `od ${new Date(`${s.firstDay}T12:00:00`).toLocaleDateString('pl-PL')}` : 'zacznij grać!'),
      tile('play', 'Sesje', String(s.sessions), s.sessions ? `średnio ${dur(s.average)}` : 'jeszcze żadnej'),
      tile('trophy', 'Najdłuższa sesja', dur(s.longest), `${s.launches} uruchomień gry`),
      tile('flame', 'Dni z rzędu', String(s.streak), `${s.daysPlayed} dni z grą łącznie`)
    ].join('');
    renderChart(s.last14);
    renderProfiles(s.profiles, s.total, profiles);
    renderServers(s.servers, s.modes);
    const c = s.crates;
    $('#st-collection').innerHTML = `
      <div class="st-col-top"><span><i class="ico" data-ico="gift" data-size="16"></i> Kolekcja kosmetyków</span><b>${c.owned.length}/${c.total}</b></div>
      <div class="st-track st-track--big"><i style="width:${(c.owned.length / c.total) * 100}%"></i></div>
      <small>${c.opened} otwartych skrzynek · ${c.shards} odłamków · seria ${c.streak} ${c.streak === 1 ? 'dzień' : 'dni'}</small>`;
    Fresh.svg.render($('.panel[data-panel="stats"]'));
  }

  Fresh.stats = { render, dur };
})();

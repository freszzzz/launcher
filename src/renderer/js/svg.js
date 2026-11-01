// Liniowe ikony SVG (24×24, stroke) dla "clean" UI. Użycie: <i class="ico" data-ico="home"></i>
window.Fresh = window.Fresh || {};

(() => {
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    shirt: '<path d="M8 3 3.5 5.5 5 10l2-1v12h10V9l2 1 1.5-4.5L16 3a4 4 0 0 1-8 0Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    play: '<path d="M7 4.5v15l12-7.5Z" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="currentColor"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.8-4M4 4v4h4M4 13a8 8 0 0 0 14.8 4M20 20v-4h-4"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    minus: '<path d="M5 12h14"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 20a6.5 6.5 0 0 0-3-5.5"/>',
    userPlus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>',
    gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 12.5h4M9 10.5v4M15.5 11.5h.01M17.5 13.5h.01"/>',
    shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6Z"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7 15h10"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
    gauge: '<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 14 4-5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    heart: '<path d="M12 20s-7.5-4.5-9-9.5C2 7 4.5 4.5 7.5 4.5c2 0 3.5 1 4.5 2.5 1-1.5 2.5-2.5 4.5-2.5 3 0 5.5 2.5 4.5 6-1.5 5-9 9.5-9 9.5Z"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18Z"/>',
    package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.3l8 4.5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    cape: '<path d="M7 3h10l2 18-7-3-7 3Z"/><path d="M9 3c0 2 1.3 3 3 3s3-1 3-3"/>',
    crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5Z"/>',
    discord: '<path d="M8.5 6.5c-1.6.3-3 .9-4.1 1.7C2.7 11 2.2 13.8 2.4 16.5c1.4 1.1 3 1.8 4.6 2.2l1.1-1.8M15.5 6.5c1.6.3 3 .9 4.1 1.7 1.7 2.8 2.2 5.6 2 8.3-1.4 1.1-3 1.8-4.6 2.2l-1.1-1.8M7 16c3.2 1.4 6.8 1.4 10 0M9 6.2c2-.5 4-.5 6 0"/><circle cx="9" cy="12.5" r="1.3"/><circle cx="15" cy="12.5" r="1.3"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4.5" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8v12"/><path d="M12 8c-1.5-3.5-5.5-4-5.5-1.5S10 8 12 8Zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 8 12 8Z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    gem: '<path d="M6 4h12l3 5-9 11L3 9Z"/><path d="M3 9h18M9 4l3 5 3-5M12 9v11"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9.5 17h5"/>',
    flame: '<path d="M12 21c-4 0-6.5-2.8-6.5-6.2 0-3.6 3-5.6 3.5-9.3 2.5 1.5 3.5 3.5 3.5 5.5 1-1 1.5-2 1.5-3.5 2.5 2 4.5 4.5 4.5 7.3 0 3.4-2.5 6.2-6.5 6.2Z"/>'
  };

  function svg(name, size = 20) {
    const body = P[name] || P.info;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function render(root = document) {
    root.querySelectorAll('i.ico[data-ico]').forEach((el) => {
      if (el.dataset.rendered === el.dataset.ico) return;
      el.innerHTML = svg(el.dataset.ico, Number(el.dataset.size) || undefined);
      el.dataset.rendered = el.dataset.ico;
    });
  }

  Fresh.svg = { svg, render };
})();

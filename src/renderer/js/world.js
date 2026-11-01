// "Żywy świat": pełnoekranowa scena pixel-art pod całym launcherem.
// Pora dnia (świt / dzień / zmierzch / noc) wg zegara lub ręcznie, paralaksa za myszą,
// gwiazdy, zorza, spadające gwiazdy, chmury, świetliki. Niska rozdzielczość + ~30 FPS.
window.Fresh = window.Fresh || {};

(() => {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const PX = 4; // 1 piksel sceny = 4 piksele ekranu
  const PAD = 24; // zapas na paralaksę

  const PHASES = {
    dawn: {
      label: 'Świt', icon: 'sun',
      sky: ['#2b2a66', '#5a4592', '#a463a8', '#e58ea6', '#ffbfa0', '#ffe0b0'],
      far: '#8a76b8', mid: '#5d4e8c', near: '#3a3366', front: '#231f45',
      tree: '#2a2450', glow: '#ffd9a0', stars: 0.25, aurora: 0, clouds: 0.6, body: 'sun', bodyY: 0.42, fireflies: 0.2
    },
    day: {
      label: 'Dzień', icon: 'sun',
      sky: ['#2f7fd8', '#4b97e6', '#6db0ef', '#97c9f5', '#c4e2fa', '#e3f2fd'],
      far: '#9fbfe0', mid: '#6aa778', near: '#478a57', front: '#2e6a40',
      tree: '#24573a', glow: '#fff6d0', stars: 0, aurora: 0, clouds: 1, body: 'sun', bodyY: 0.18, fireflies: 0
    },
    dusk: {
      label: 'Zmierzch', icon: 'sun',
      sky: ['#1a1240', '#3a1d63', '#6e2b7c', '#b4467b', '#ef7b67', '#ffb56b'],
      far: '#6a3c7d', mid: '#47285f', near: '#2e1b46', front: '#1c1030',
      tree: '#1a0f2c', glow: '#ffb070', stars: 0.35, aurora: 0.15, clouds: 0.5, body: 'sun', bodyY: 0.44, fireflies: 0.5
    },
    night: {
      label: 'Noc', icon: 'moon',
      sky: ['#05050f', '#0b0a22', '#141236', '#1e1a4a', '#2a2160', '#33276d'],
      far: '#231f4d', mid: '#18153a', near: '#100e2b', front: '#0a0920',
      tree: '#080718', glow: '#c9d4ff', stars: 1, aurora: 1, clouds: 0.15, body: 'moon', bodyY: 0.2, fireflies: 1
    }
  };

  let W = 0;
  let H = 0;
  let phaseKey = 'night';
  let mode = 'auto';
  let layers = {};
  let stars = [];
  let clouds = [];
  let flies = [];
  let shooting = null;
  let mx = 0.5;
  let my = 0.5;
  let pmx = 0.5;
  let pmy = 0.5;
  let raf = 0;
  let last = 0;
  let running = true;
  // event Halloween: nietoperze, dynie-lampiony na wzgórzach, pomarańczowy księżyc
  let spooky = false;
  let bats = [];
  let pumpkins = [];

  // pomocnicze
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x, scale, seed) => {
    const i = Math.floor(x / scale);
    const f = x / scale - i;
    const a = hash(i + seed * 101);
    const b = hash(i + 1 + seed * 101);
    return a + (b - a) * (f * f * (3 - 2 * f));
  };
  const autoPhase = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 8) return 'dawn';
    if (h >= 8 && h < 17) return 'day';
    if (h >= 17 && h < 21) return 'dusk';
    return 'night';
  };

  function off(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // warstwy terenu
  function ridge(color, baseY, amp, scale, seed, w, opts = {}) {
    const c = off(w, H);
    const x = c.getContext('2d');
    for (let i = 0; i < w; i++) {
      const n = noise(i, scale, seed) * 0.7 + noise(i, scale / 3, seed + 7) * 0.3;
      let top = Math.round(baseY - n * amp);
      if (opts.peaks) top -= Math.round(Math.max(0, noise(i, scale * 0.6, seed + 3) - 0.6) * amp * 1.6);
      x.fillStyle = color;
      x.fillRect(i, top, 1, H - top);
      if (opts.snow && top < baseY - amp * 0.75) {
        x.fillStyle = 'rgba(255,255,255,.55)';
        x.fillRect(i, top, 1, 2);
      }
    }
    if (opts.trees) {
      for (let k = 0; k < w; k += 5 + Math.floor(hash(k + seed) * 9)) {
        const n = noise(k, scale, seed) * 0.7 + noise(k, scale / 3, seed + 7) * 0.3;
        const top = Math.round(baseY - n * amp);
        const th = 6 + Math.floor(hash(k * 3 + seed) * 7);
        x.fillStyle = opts.trees;
        for (let r = 0; r < th; r++) {
          const half = Math.floor((r / th) * 3) + (r > th - 2 ? 0 : 0);
          x.fillRect(k - half, top - th + r, half * 2 + 1, 1);
        }
        x.fillRect(k, top - 1, 1, 2);
      }
    }
    return c;
  }

  function build() {
    const p = PHASES[phaseKey];
    const w = W + PAD * 2;
    layers = {
      far: ridge(p.far, Math.round(H * 0.62), H * 0.3, 70, 1, w, { peaks: true, snow: phaseKey !== 'day' ? false : true }),
      mid: ridge(p.mid, Math.round(H * 0.74), H * 0.2, 46, 2, w, { trees: p.tree }),
      near: ridge(p.near, Math.round(H * 0.86), H * 0.14, 34, 3, w, { trees: p.tree }),
      front: ridge(p.front, Math.round(H * 0.97), H * 0.08, 24, 4, w)
    };
    // niebo jako gradient pasowy z ditheringiem
    const sky = off(W, H);
    const s = sky.getContext('2d');
    const band = (H * 0.62) / p.sky.length;
    for (let i = 0; i < p.sky.length; i++) {
      s.fillStyle = p.sky[i];
      s.fillRect(0, Math.floor(i * band), W, i === p.sky.length - 1 ? H : Math.ceil(band) + 1);
      if (i + 1 < p.sky.length) {
        s.fillStyle = p.sky[i + 1];
        for (let xx = i % 2; xx < W; xx += 2) s.fillRect(xx, Math.floor((i + 1) * band) - 1, 1, 1);
        for (let xx = (i + 1) % 2; xx < W; xx += 4) s.fillRect(xx, Math.floor((i + 1) * band) - 2, 1, 1);
      }
    }
    layers.sky = sky;
    stars = Array.from({ length: Math.round(W * H / 90) }, (_, i) => ({
      x: hash(i) * W,
      y: hash(i + 999) * H * 0.62,
      s: hash(i + 77) > 0.93 ? 2 : 1,
      t: hash(i + 5) * 6.28,
      v: 0.02 + hash(i + 3) * 0.05
    }));
    clouds = Array.from({ length: Math.max(4, Math.round(W / 55)) }, (_, i) => ({
      x: hash(i + 40) * W,
      y: 6 + hash(i + 41) * H * 0.3,
      w: 18 + Math.floor(hash(i + 42) * 26),
      v: 0.05 + hash(i + 43) * 0.08
    }));
    if (spooky) buildSpooky();
    flies = Array.from({ length: 26 }, (_, i) => ({
      x: hash(i + 300) * W,
      y: H * (0.7 + hash(i + 301) * 0.28),
      ph: hash(i + 302) * 6.28,
      sp: 0.3 + hash(i + 303) * 0.6
    }));
  }

  const PUMPKIN = ['.gg..', '#####', '#y#y#', '#####', '#yyy#', '.###.'];

  /** Dynie wrysowane na grzbiet przedniego wzgórza (z tym samym ruchem paralaksy) + nietoperze. */
  function buildSpooky() {
    const front = layers.near;
    const fx = front.getContext('2d');
    const data = fx.getImageData(0, 0, front.width, front.height).data;
    const groundAt = (x) => {
      for (let y = 0; y < front.height; y++) if (data[(y * front.width + x) * 4 + 3] > 0) return y;
      return front.height;
    };
    pumpkins = [];
    const n = Math.max(5, Math.round(front.width / 38));
    for (let i = 0; i < n; i++) {
      const x = Math.round((i + 0.3 + hash(i + 500) * 0.4) * (front.width / n));
      const gy = groundAt(Math.min(front.width - 1, x + 2));
      if (gy >= front.height - 2) continue;
      const y = gy - PUMPKIN.length + 1;
      PUMPKIN.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch === '.') return;
        fx.fillStyle = ch === 'g' ? '#3f6212' : ch === 'y' ? '#ffd54a' : r === PUMPKIN.length - 1 ? '#c2410c' : '#f97316';
        fx.fillRect(x + c, y + r, 1, 1);
      }));
      pumpkins.push({ x: x + 2, y: y + 3, ph: hash(i + 600) * 6.28 });
    }
    bats = Array.from({ length: 6 }, (_, i) => ({
      x: hash(i + 700) * W,
      y: H * (0.08 + hash(i + 701) * 0.3),
      v: 0.25 + hash(i + 702) * 0.35,
      ph: hash(i + 703) * 6.28
    }));
  }

  function drawPumpkinGlow(t) {
    const ox = Math.round(-PAD + (0.5 - pmx) * 0.6 * 2 * PAD);
    const oy = Math.round((0.5 - pmy) * 0.6 * 6);
    for (const p of pumpkins) {
      const f = 0.55 + 0.45 * Math.sin(t / 180 + p.ph) * Math.sin(t / 470 + p.ph * 2);
      ctx.globalAlpha = 0.16 * f;
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(p.x + ox - 4, p.y + oy - 4, 9, 8);
      ctx.globalAlpha = 0.28 * f;
      ctx.fillRect(p.x + ox - 2, p.y + oy - 2, 5, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawBats(t, dt) {
    ctx.fillStyle = '#07040d';
    for (const b of bats) {
      b.x += b.v * dt;
      if (b.x > W + 10) {
        b.x = -10;
        b.y = H * (0.08 + Math.random() * 0.3);
      }
      const x = Math.round(b.x - (pmx - 0.5) * 8);
      const y = Math.round(b.y + Math.sin(t / 500 + b.ph) * 4);
      const up = Math.sin(t / 90 + b.ph) > 0;
      ctx.fillRect(x, y, 2, 2); // ciałko
      if (up) {
        ctx.fillRect(x - 2, y - 1, 2, 1);
        ctx.fillRect(x - 3, y - 2, 1, 1);
        ctx.fillRect(x + 2, y - 1, 2, 1);
        ctx.fillRect(x + 4, y - 2, 1, 1);
      } else {
        ctx.fillRect(x - 2, y + 1, 2, 1);
        ctx.fillRect(x - 3, y + 1, 1, 1);
        ctx.fillRect(x + 2, y + 1, 2, 1);
        ctx.fillRect(x + 4, y + 1, 1, 1);
      }
    }
  }

  function resize() {
    W = Math.ceil(innerWidth / PX);
    H = Math.ceil(innerHeight / PX);
    canvas.width = W;
    canvas.height = H;
    build();
  }

  // rysowanie
  function drawBody(p, t) {
    const bx = Math.round(W * (p.body === 'moon' ? 0.6 : 0.56) - (pmx - 0.5) * 4);
    const by = Math.round(H * p.bodyY - (pmy - 0.5) * 3);
    const r = p.body === 'moon' ? 9 : 12;
    // poświata
    for (let k = 5; k >= 1; k--) {
      ctx.globalAlpha = 0.06 + Math.sin(t / 1600) * 0.01;
      ctx.fillStyle = p.glow;
      ctx.beginPath();
      ctx.arc(bx, by, r + k * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy > r * r) continue;
        if (p.body === 'moon') {
          const crater = (xx + 3) ** 2 + (yy + 2) ** 2 < 6 || (xx - 4) ** 2 + (yy - 3) ** 2 < 4 || (xx + 1) ** 2 + (yy - 5) ** 2 < 2;
          if (spooky) ctx.fillStyle = crater ? '#e8892f' : xx + yy < -6 ? '#ffe2b0' : '#ffb35c';
          else ctx.fillStyle = crater ? '#c9cdea' : xx + yy < -6 ? '#ffffff' : '#eef0ff';
        } else {
          ctx.fillStyle = xx + yy < -8 ? '#fffbe8' : '#fff1c2';
        }
        ctx.fillRect(bx + xx, by + yy, 1, 1);
      }
    }
  }

  function drawAurora(p, t) {
    if (!p.aurora) return;
    const cols = ['#4dffb0', '#38e1ff', '#a78bfa'];
    for (let b = 0; b < 3; b++) {
      for (let x = 0; x < W; x += 1) {
        const y = H * (0.12 + b * 0.07) + Math.sin(x / 22 + t / 2400 + b * 1.7) * 6 + Math.sin(x / 9 + t / 1300) * 2;
        const len = 10 + Math.sin(x / 13 + t / 1800 + b) * 6;
        ctx.globalAlpha = (0.05 + 0.05 * Math.sin(x / 30 + t / 1500 + b * 2)) * p.aurora;
        ctx.fillStyle = cols[b];
        ctx.fillRect(x, Math.round(y), 1, Math.round(len));
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStars(p, t, dt) {
    if (!p.stars) return;
    for (const s of stars) {
      s.t += s.v * dt;
      ctx.globalAlpha = p.stars * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.t)));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(s.x - (pmx - 0.5) * 2), Math.round(s.y), s.s, s.s);
    }
    ctx.globalAlpha = 1;
    // spadająca gwiazda
    if (!shooting && Math.random() < 0.004 * p.stars * dt) {
      shooting = { x: W * (0.2 + Math.random() * 0.6), y: H * Math.random() * 0.25, life: 0 };
    }
    if (shooting) {
      shooting.life += dt;
      const L = shooting.life;
      for (let k = 0; k < 12; k++) {
        ctx.globalAlpha = Math.max(0, (1 - k / 12) * (1 - L / 40));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(shooting.x + L * 2.2 - k), Math.round(shooting.y + L * 1.1 - k * 0.5), 1, 1);
      }
      ctx.globalAlpha = 1;
      if (L > 40) shooting = null;
    }
  }

  function drawClouds(p, dt) {
    if (!p.clouds) return;
    ctx.globalAlpha = 0.85 * p.clouds;
    ctx.fillStyle = phaseKey === 'night' ? '#2a2a55' : phaseKey === 'dusk' ? '#f6a6a0' : '#ffffff';
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > W + 20) c.x = -c.w - 20;
      const x = Math.round(c.x - (pmx - 0.5) * 6);
      const y = Math.round(c.y);
      ctx.fillRect(x, y + 3, c.w, 4);
      ctx.fillRect(x + 4, y + 1, c.w - 10, 2);
      ctx.fillRect(x + 9, y - 1, Math.max(4, c.w / 3), 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawLayer(img, depth) {
    const ox = Math.round(-PAD + (0.5 - pmx) * depth * 2 * PAD);
    const oy = Math.round((0.5 - pmy) * depth * 6);
    ctx.drawImage(img, ox, oy);
  }

  function drawFlies(p, t) {
    if (!p.fireflies) return;
    for (const f of flies) {
      const x = f.x + Math.sin(t / 1000 * f.sp + f.ph) * 6 + (0.5 - pmx) * 10;
      const y = f.y + Math.cos(t / 1300 * f.sp + f.ph) * 3;
      const a = (0.5 + 0.5 * Math.sin(t / 400 * f.sp + f.ph)) * p.fireflies;
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = spooky ? '#ff9a3d' : '#ffe680';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      ctx.globalAlpha = a;
      ctx.fillStyle = spooky ? '#ffd0a0' : '#fff6b0';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 33) return;
    const dt = Math.min(3, (t - last) / 16.7);
    last = t;
    if (mode === 'auto' && autoPhase() !== phaseKey) setPhaseInternal(autoPhase());

    // wygładzona paralaksa za kursorem
    pmx += (mx - pmx) * 0.06 * dt;
    pmy += (my - pmy) * 0.06 * dt;

    const p = PHASES[phaseKey];
    ctx.drawImage(layers.sky, 0, 0);
    drawStars(p, t, dt);
    drawAurora(p, t);
    drawBody(p, t);
    drawClouds(p, dt);
    if (spooky) drawBats(t, dt);
    drawLayer(layers.far, 0.15);
    drawLayer(layers.mid, 0.35);
    drawLayer(layers.near, 0.6);
    if (spooky) drawPumpkinGlow(t);
    drawFlies(p, t);
    drawLayer(layers.front, 1);
  }

  function start() {
    if (raf || !running) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function setPhaseInternal(key) {
    phaseKey = key;
    document.documentElement.dataset.phase = key;
    build();
    window.dispatchEvent(new CustomEvent('fresh-phase', { detail: key }));
  }

  // API
  Fresh.world = {
    PHASES,
    phase: () => phaseKey,
    mode: () => mode,
    /** 'auto' | 'dawn' | 'day' | 'dusk' | 'night' */
    setMode(m) {
      mode = m;
      try {
        localStorage.setItem('fresh-phase', m);
      } catch { /* ignoruj */ }
      setPhaseInternal(m === 'auto' ? autoPhase() : m);
    },
    cycle() {
      const order = ['auto', 'dawn', 'day', 'dusk', 'night'];
      this.setMode(order[(order.indexOf(mode) + 1) % order.length]);
    },
    setDim(on) {
      canvas.classList.toggle('is-dim', on);
    },
    /** Dekoracje eventu ('halloween' albo null). */
    setEvent(id) {
      spooky = id === 'halloween';
      document.documentElement.dataset.event = id || '';
      build();
    },
    start,
    stop,
    /** Wyłączona animacja zostawia jedną statyczną klatkę. */
    setEnabled(on) {
      running = on;
      if (on) start();
      else {
        stop();
        last = 0;
        frame(performance.now());
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
  };

  try {
    mode = localStorage.getItem('fresh-phase') || 'auto';
  } catch { /* ignoruj */ }
  phaseKey = mode === 'auto' ? autoPhase() : mode;
  document.documentElement.dataset.phase = phaseKey;
  resize();
  addEventListener('resize', resize);
  addEventListener('mousemove', (e) => {
    mx = e.clientX / innerWidth;
    my = e.clientY / innerHeight;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
})();

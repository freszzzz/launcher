/*
 * Fresh – wspólny katalog kosmetyków.
 * Ten sam plik używa launcher (podgląd 3D) i skrypt eksportu dla moda (catalog.json + PNG peleryn).
 *
 * Układ współrzędnych (w pikselach modelu Minecraft):
 *   bone "head": środek szyi = (0,0,0), głowa zajmuje x[-4,4] y[0,8] z[-4,4], +z = twarz.
 *   bone "body": środek szyi = (0,0,0), tułów zajmuje x[-4,4] y[-12,0] z[-2,2], +z = przód.
 *   +x = lewa strona gracza (prawa strona ekranu, gdy patrzysz mu w twarz).
 * Część (part) = zbiór wokseli o boku `size`, pozycja woksela = offset + index * size.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FreshCosmetics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // narzędzia wokselowe
  function Builder() {
    const map = new Map();
    const api = {
      set(x, y, z, c) {
        map.set(`${x},${y},${z}`, [x, y, z, c]);
        return api;
      },
      del(x, y, z) {
        map.delete(`${x},${y},${z}`);
        return api;
      },
      has(x, y, z) {
        return map.has(`${x},${y},${z}`);
      },
      /** Wypełnia prostopadłościan [x0,x1) × [y0,y1) × [z0,z1). */
      box(x0, y0, z0, x1, y1, z1, c) {
        for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) api.set(x, y, z, c);
        return api;
      },
      /** Pusta "ramka" w płaszczyźnie XZ (obręcz wokół głowy). */
      frame(x0, z0, x1, z1, y0, y1, c) {
        for (let x = x0; x < x1; x++) {
          for (let z = z0; z < z1; z++) {
            const edge = x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1;
            if (edge) for (let y = y0; y < y1; y++) api.set(x, y, z, c);
          }
        }
        return api;
      },
      /** Dysk / walec w płaszczyźnie XZ. */
      disc(cx, cz, r, y0, y1, c, inner = -1) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
            const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
            if (d <= r && d > inner) for (let y = y0; y < y1; y++) api.set(x, y, z, c);
          }
        }
        return api;
      },
      /**
       * Pixel-art 2D wytłoczony na głębokość `depth`.
       * rows: góra -> dół, palette: znak -> kolor. Płaszczyzna XY (z = z0) albo ZY (x = x0).
       */
      sprite(rows, palette, { x = 0, y = 0, z = 0, plane = 'xy', depth = 1, mirror = false } = {}) {
        rows.forEach((row, r) => {
          [...row].forEach((ch, i) => {
            const c = palette[ch];
            if (!c) return;
            const col = mirror ? -i - 1 : i;
            for (let d = 0; d < depth; d++) {
              if (plane === 'xy') api.set(x + col, y - r, z + d, c);
              else api.set(x + d, y - r, z + col, c);
            }
          });
        });
        return api;
      },
      /** Odbicie lustrzane względem x = 0 (indeksy: x -> -x-1). */
      mirrorX() {
        for (const [x, y, z, c] of [...map.values()]) api.set(-x - 1, y, z, c);
        return api;
      },
      list() {
        return [...map.values()];
      }
    };
    return api;
  }

  const part = (voxels, opts = {}) => ({
    size: opts.size || 1,
    offset: opts.offset || [0, 0, 0],
    pivot: opts.pivot || [0, 0, 0],
    anim: opts.anim || null,
    glow: !!opts.glow,
    voxels
  });

  // modele
  const GOLD = '#ffd23f';
  const GOLD_D = '#d99a16';
  const GOLD_L = '#fff3a6';

  function crown() {
    const b = Builder();
    b.frame(-5, -5, 5, 5, 7, 9, GOLD);
    b.frame(-5, -5, 5, 5, 7, 8, GOLD_D);
    // zęby korony co drugi piksel + wyższe na rogach i środkach
    for (let i = -5; i < 5; i += 2) {
      for (const [x, z] of [[i, -5], [i, 4], [-5, i], [4, i]]) {
        b.set(x, 9, z, GOLD);
        const tall = i === -5 || i === 3 || i === -1;
        if (tall) b.set(x, 10, z, GOLD_L);
      }
    }
    // klejnoty
    b.set(-1, 8, 4, '#ff3b5c').set(0, 8, 4, '#ff3b5c');
    b.set(-1, 8, -5, '#38e1ff').set(0, 8, -5, '#38e1ff');
    b.set(-5, 8, -1, '#5dff8a').set(4, 8, 0, '#5dff8a');
    return [part(b.list())];
  }

  function halo() {
    const b = Builder();
    for (let x = -9; x < 9; x++) {
      for (let z = -9; z < 9; z++) {
        const d = Math.hypot(x + 0.5, z + 0.5);
        if (d <= 8.2 && d >= 6.2) b.set(x, 0, z, d > 7.4 ? '#fff6c2' : GOLD);
      }
    }
    return [part(b.list(), { size: 0.5, offset: [0, 10.5, 0], pivot: [0, 10.75, 0], anim: { type: 'spin', speed: 0.6, bob: 0.6 }, glow: true })];
  }

  function wizardHat() {
    const b = Builder();
    const P = '#6a3fc1';
    const PD = '#4b2a8f';
    b.disc(0, 0, 7, 7, 8, PD);
    b.disc(0, 0, 4.6, 8, 10, P);
    b.box(-4, 8, -4, 4, 9, 4, '#2b1a4a'); // opaska
    b.box(-1, 8, 4, 1, 10, 5, GOLD).set(-1, 9, 4, '#2b1a4a').set(0, 9, 4, '#2b1a4a'); // klamra
    b.disc(0, -0.5, 3.6, 10, 12, P);
    b.disc(0, -1, 2.6, 12, 14, P);
    b.disc(0, -1.5, 1.8, 14, 15, PD);
    b.box(-1, 15, -3, 1, 16, -1, P);
    b.box(-1, 16, -4, 0, 17, -2, PD);
    b.set(-1, 16, -5, P).set(-1, 15, -6, GOLD_L);
    // gwiazdki
    b.set(2, 11, 2, GOLD_L).set(-3, 10, 1, GOLD_L).set(1, 13, -2, GOLD_L).set(-2, 12, -2, GOLD_L);
    return [part(b.list())];
  }

  function topHat() {
    const b = Builder();
    const K = '#1c1625';
    b.disc(0, 0, 6.2, 7, 8, K);
    b.disc(0, 0, 4.1, 8, 15, K);
    b.disc(0, 0, 4.1, 8, 10, '#8b5cf6');
    b.disc(0, 0, 3, 15, 16, '#2c2438');
    b.box(3, 9, 2, 4, 11, 3, '#ff4fa3'); // kwiatek
    return [part(b.list())];
  }

  function catEars() {
    const pal = { '#': '#2a2233', p: '#ff8fc7' };
    const ear = ['.#.', '###', '#p#', '#p#'];
    const b = Builder();
    b.sprite(ear, pal, { x: 1, y: 11, z: 0, depth: 2 });
    b.mirrorX();
    return [part(b.list())];
  }

  function demonHorns() {
    const b = Builder();
    const R = '#b3243b';
    const RD = '#7d1d2f';
    const T = '#ffd9a8';
    b.box(2, 7, 0, 4, 9, 2, RD).box(3, 9, 0, 5, 11, 2, R).box(4, 11, -1, 5, 13, 1, R).set(4, 13, -1, R).set(3, 14, -1, T).set(3, 13, -2, T);
    b.mirrorX();
    return [part(b.list())];
  }

  function antlers() {
    const b = Builder();
    const A = '#8a5a3b';
    const L = '#c08a5c';
    b.box(2, 7, 0, 3, 10, 1, A).box(3, 10, 0, 4, 11, 1, A).box(4, 11, 0, 5, 14, 1, A).set(5, 14, 0, L).set(6, 13, 0, L);
    b.set(3, 11, 0, A).set(3, 12, 0, A).set(2, 13, 0, L);
    b.set(5, 12, 0, A).set(6, 12, 0, A).set(7, 13, 0, L);
    b.set(4, 9, 0, A).set(5, 10, 0, L);
    b.mirrorX();
    return [part(b.list())];
  }

  function headphones() {
    const b = Builder();
    const K = '#241a33';
    const C = '#38e1ff';
    b.box(-4, 8, -1, 4, 9, 1, K);
    b.box(-5, 6, -1, -4, 9, 1, K).box(4, 6, -1, 5, 9, 1, K);
    b.box(-6, 2, -2, -4, 6, 2, '#8b5cf6').box(4, 2, -2, 6, 6, 2, '#8b5cf6');
    const glow = Builder().box(-7, 3, -1, -6, 5, 1, C).box(6, 3, -1, 7, 5, 1, C);
    return [part(b.list()), part(glow.list(), { glow: true })];
  }

  function vikingHelmet() {
    const b = Builder();
    const M = '#b8c2cc';
    const MD = '#7f8a96';
    b.frame(-5, -5, 5, 5, 6, 8, M);
    b.frame(-5, -5, 5, 5, 6, 7, MD);
    b.box(-4, 8, -4, 4, 9, 4, M);
    b.box(-3, 9, -3, 3, 10, 3, M);
    b.box(-1, 8, -5, 1, 10, 5, MD); // grzbiet
    b.box(-1, 2, 4, 1, 6, 5, MD); // nosal
    const H = '#f2e6c9';
    b.box(5, 7, -1, 7, 9, 1, H).box(6, 9, -1, 8, 11, 1, H).set(7, 11, 0, '#d8c49a').set(7, 12, 0, '#d8c49a');
    b.box(-7, 7, -1, -5, 9, 1, H).box(-8, 9, -1, -6, 11, 1, H).set(-8, 11, 0, '#d8c49a').set(-8, 12, 0, '#d8c49a');
    return [part(b.list())];
  }

  function iceCrown() {
    const b = Builder();
    b.frame(-5, -5, 5, 5, 7, 8, '#bff6ff');
    const g = Builder();
    const heights = [3, 1, 4, 2, 5, 2, 4, 1, 3, 2];
    for (let i = -5; i < 5; i++) {
      const h = heights[(i + 5) % heights.length];
      for (const [x, z] of [[i, -5], [i, 4], [-5, i], [4, i]]) {
        for (let y = 8; y < 8 + h; y++) g.set(x, y, z, y === 7 + h ? '#e8fdff' : y > 9 ? '#8af0ff' : '#38e1ff');
      }
    }
    return [part(b.list()), part(g.list(), { glow: true })];
  }

  function shades() {
    const pal = { '#': '#0b0810', w: '#ffffff' };
    const rows = ['##################', '.#ww####..#ww####.', '..#####....#####..'];
    const b = Builder();
    b.sprite(rows, pal, { x: -9, y: 9, z: 8 });
    // zauszniki
    b.box(-9, 8, 0, -8, 9, 8, '#0b0810').box(8, 8, 0, 9, 9, 8, '#0b0810');
    return [part(b.list(), { size: 0.5, offset: [0, 0, 0.25] })];
  }

  function santaHat() {
    const b = Builder();
    const R = '#d7263d';
    const RD = '#a3182c';
    const W = '#f4f4f4';
    b.frame(-5, -5, 5, 5, 7, 9, W);
    b.box(-4, 9, -4, 4, 11, 4, R);
    b.box(-3, 11, -3, 3, 13, 3, R);
    b.box(-1, 13, -2, 3, 14, 2, RD);
    b.box(1, 14, -1, 4, 15, 1, R);
    b.box(4, 13, -1, 6, 15, 1, W).set(5, 12, 0, W);
    return [part(b.list())];
  }

  // plecy / skrzydła (bone: body
  function wings(rows, palette, { glow = false, flap = 22, speed = 2.6, z = -3 } = {}) {
    const right = Builder().sprite(rows, palette, { x: 1, y: 4, z });
    const left = Builder().sprite(rows, palette, { x: -1, y: 4, z, mirror: true });
    return [
      part(right.list(), { pivot: [1, -3, -2.5], anim: { type: 'flap', dir: 1, amp: flap, speed }, glow }),
      part(left.list(), { pivot: [-1, -3, -2.5], anim: { type: 'flap', dir: -1, amp: flap, speed }, glow })
    ];
  }

  const ANGEL = [
    '........####',
    '......######',
    '....#######+',
    '..########++',
    '.#########+.',
    '##########+.',
    '#########++.',
    '########+.+.',
    '#######++...',
    '######+.+...',
    '#####+......',
    '####++......',
    '###+........',
    '##..........'
  ];

  const DRAGON = [
    'bbb...........',
    '#bbbb.........',
    '##m#bbbb......',
    '###mm##bbbb...',
    '####mmm###bbb.',
    '#####mmmm###bb',
    '######mmmmm##b',
    '######mmmmmm#.',
    '#####.mmmmm.m.',
    '####...mmm...m',
    '###.....m.....',
    '##............'
  ];

  const BUTTERFLY = [
    '....######..',
    '..##++++++#.',
    '.#++****++#.',
    '#++*****++#.',
    '#++****++#..',
    '#+++++++#...',
    '.#####.##...',
    '..#++##++#..',
    '.#++**++#...',
    '.#+***+#....',
    '..#++##.....',
    '...##.......'
  ];

  function backpack() {
    const b = Builder();
    const B = '#8a5a3b';
    const BD = '#5e3b25';
    b.box(-3, -10, -5, 3, -3, -2, B);
    b.box(-3, -5, -6, 3, -3, -2, BD); // klapa
    b.box(-2, -9, -6, 2, -6, -5, BD); // kieszeń
    b.set(-1, -5, -7, GOLD).set(0, -5, -7, GOLD);
    b.box(-3, -3, -2, -2, 1, 2, BD).box(2, -3, -2, 3, 1, 2, BD); // szelki przez ramiona
    b.box(-3, -6, 2, -2, 1, 3, BD).box(2, -6, 2, 3, 1, 3, BD);
    b.box(-4, -2, -5, 4, -1, -4, '#d8c49a'); // śpiwór
    return [part(b.list())];
  }

  function foxTail() {
    const b = Builder();
    const O = '#f0822a';
    const OD = '#c25f16';
    const W = '#fff4e6';
    b.box(-1, -12, -4, 1, -10, -2, OD);
    b.box(-2, -13, -7, 2, -10, -4, O);
    b.box(-2, -12, -10, 2, -9, -7, O);
    b.box(-1, -10, -12, 1, -7, -10, O);
    b.box(-1, -7, -13, 1, -5, -11, W);
    return [part(b.list(), { pivot: [0, -11, -2], anim: { type: 'sway', amp: 14, speed: 2 } })];
  }

  function katana() {
    const b = Builder();
    for (let i = 0; i < 16; i++) {
      const x = -6 + i;
      const y = -12 + i;
      const c = i < 4 ? (i % 2 ? '#2a1a3d' : '#8b5cf6') : i === 4 ? GOLD : '#dfe6ee';
      b.set(x, y, -3, c);
      if (i > 4) b.set(x + 1, y, -3, '#ffffff');
    }
    b.box(-3, -9, -3, 0, -8, -2, GOLD);
    return [part(b.list())];
  }

  // aury i zwierzaki (bone: body
  function starAura() {
    const b = Builder();
    const cols = ['#a78bfa', '#38e1ff', '#ff4fa3', '#fff6c2'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * 20);
      const z = Math.round(Math.sin(a) * 20);
      const y = -14 + (i % 3) * 6;
      const c = cols[i % cols.length];
      b.set(x, y, z, c).set(x + 1, y, z, c).set(x - 1, y, z, c).set(x, y + 1, z, c).set(x, y - 1, z, c);
    }
    return [part(b.list(), { size: 0.5, pivot: [0, -6, 0], anim: { type: 'spin', speed: 0.9, bob: 0.8 }, glow: true })];
  }

  function ghostPet() {
    const b = Builder();
    const W = '#f2f4ff';
    const S = '#c9cff0';
    b.box(-3, 0, -3, 3, 6, 3, W);
    b.box(-2, 6, -2, 2, 7, 2, W);
    b.box(-3, -1, -3, -1, 0, 3, S).box(1, -1, -3, 3, 0, 3, S);
    b.box(-2, 3, 3, -1, 5, 4, '#0b0810').box(1, 3, 3, 2, 5, 4, '#0b0810');
    b.set(-1, 2, 3, '#ff8fc7').set(0, 2, 3, '#ff8fc7');
    return [part(b.list(), { size: 0.6, offset: [11, 4, 0], pivot: [0, 0, 0], anim: { type: 'orbit', speed: 0.35, bob: 1.2 } })];
  }

  // nowe kosmetyki

  // głowa
  function flowerCrown() {
    const b = Builder();
    const LEAF = '#3f8f3a';
    const LEAF_L = '#5cbf4a';
    b.frame(-5, -5, 5, 5, 7, 8, LEAF);
    const petals = ['#ff8fc7', '#ffffff', '#c084fc', '#ffd166', '#7dd3fc'];
    const spots = [];
    for (let i = -5; i < 5; i++) spots.push([i, 4], [i, -5]);
    for (let i = -4; i < 4; i++) spots.push([-5, i], [4, i]);
    spots.forEach(([x, z], i) => {
      if (i % 2) {
        b.set(x, 8, z, LEAF_L);
        return;
      }
      const c = petals[(i / 2) % petals.length];
      b.set(x, 8, z, c);
      b.set(x, 9, z, i % 4 === 0 ? '#ffe680' : c);
    });
    return [part(b.list())];
  }

  function pirateHat() {
    const b = Builder();
    const K = '#1b1622';
    const KL = '#2b2433';
    const G = '#d4a72c';
    b.disc(0, 0, 6.2, 7, 8, K);
    b.box(-4, 8, -4, 4, 12, 4, K);
    b.box(-4, 11, -4, 4, 12, 4, KL);
    b.box(-6, 8, 4, 6, 11, 5, K).box(-6, 10, 4, 6, 11, 5, G);
    b.box(-6, 8, -5, 6, 11, -4, K).box(-6, 10, -5, 6, 11, -4, G);
    b.sprite(['.##.', '#..#', '.##.', '#.#.'], { '#': '#f4f4f4' }, { x: -2, y: 10, z: 5 });
    return [part(b.list())];
  }

  function unicornHorn() {
    const b = Builder();
    for (let y = 0; y < 16; y++) {
      const r = 2.4 - y * 0.13;
      for (let x = -3; x <= 3; x++) {
        for (let z = -3; z <= 3; z++) {
          if (Math.hypot(x, z) > r) continue;
          const stripe = Math.floor((Math.atan2(z, x) / Math.PI + 1) * 2 + y * 0.5) % 2;
          b.set(x, y, z, stripe ? '#ffd166' : '#fff7d6');
        }
      }
    }
    b.set(0, 16, 0, '#ffffff');
    return [part(b.list(), { size: 0.5, offset: [0, 8, 2.5], glow: true })];
  }

  function cowboyHat() {
    const b = Builder();
    const B = '#8b5a2b';
    const BD = '#6b4423';
    b.disc(0, 0, 7.2, 7, 8, B);
    for (const x of [-7, -6, 6, 7]) b.box(x - (x < 0 ? 0 : 0), 8, -3, x + 1, 9, 3, BD);
    b.box(-4, 8, -4, 4, 12, 4, B);
    b.box(-4, 8, -4, 4, 9, 4, '#2b1d14');
    b.set(-1, 8, 4, '#d4a72c').set(0, 8, 4, '#d4a72c');
    b.box(-1, 11, -3, 1, 12, 3, BD); // wgniecenie
    return [part(b.list())];
  }

  function ninjaBand() {
    const b = Builder();
    const R = '#e11d48';
    b.frame(-5, -5, 5, 5, 5, 7, R);
    b.box(-1, 5, -6, 1, 7, -5, '#be123c');
    const tails = Builder();
    for (let i = 0; i < 7; i++) {
      tails.box(-1 + (i % 2), 5 - Math.floor(i / 2), -7 - i, i % 2 + 1 - 1 + 1, 6 - Math.floor(i / 2), -6 - i, i < 3 ? R : '#f43f5e');
      tails.set(1 - (i % 2), 4 - Math.floor(i / 2), -7 - i, '#be123c');
    }
    return [part(b.list()), part(tails.list(), { pivot: [0, 6, -6], anim: { type: 'sway', amp: 18, speed: 3 } })];
  }

  function bunnyEars() {
    const pal = { '#': '#f8fafc', p: '#fbcfe8' };
    const ear = ['.#.', '###', '#p#', '#p#', '#p#', '#p#', '#p#', '###'];
    const right = Builder().sprite(ear, pal, { x: 1, y: 15, z: 0, depth: 2 });
    const left = Builder().sprite(ear, pal, { x: -1, y: 15, z: 0, depth: 2, mirror: true });
    return [
      part(right.list(), { pivot: [2.5, 8, 1], anim: { type: 'tilt', amp: 8, speed: 2.2 } }),
      part(left.list(), { pivot: [-2.5, 8, 1], anim: { type: 'tilt', amp: 8, speed: 2.2, phase: 1.4 } })
    ];
  }

  function mushroomCap() {
    const b = Builder();
    const R = '#e63946';
    const W = '#fff1e6';
    b.frame(-5, -5, 5, 5, 7, 8, '#f1e3d3');
    b.disc(0, 0, 5.8, 8, 10, R);
    b.disc(0, 0, 4.6, 10, 11, R);
    b.disc(0, 0, 3.2, 11, 12, R);
    for (const [x, y, z] of [[-4, 9, 3], [3, 9, -4], [-1, 11, 2], [2, 10, 3], [-3, 10, -3], [1, 12, -1], [4, 9, 1], [-5, 9, -1]]) {
      if (b.has(x, y, z)) b.set(x, y, z, W);
      else b.set(x, y - 1, z, W);
    }
    return [part(b.list())];
  }

  // twarz
  function monocle() {
    const b = Builder();
    const G = '#e9b949';
    for (let x = -4; x <= 4; x++) {
      for (let y = -4; y <= 4; y++) {
        const d = Math.hypot(x, y);
        if (d >= 2.4 && d < 3.6) b.set(x - 5, y + 8, 8, G);
      }
    }
    for (let i = 0; i < 9; i++) b.set(-9 - (i > 4 ? 1 : 0), 4 - i, 8, i % 2 ? '#c99a2e' : G);
    const lens = Builder();
    for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) if (Math.hypot(x, y) < 2.4) lens.set(x - 5, y + 8, 8, '#bfe9ff');
    return [part(b.list(), { size: 0.5, offset: [0, 0, 0.2] }), part(lens.list(), { size: 0.5, offset: [0, 0, 0.1], glow: true })];
  }

  function goggles() {
    const b = Builder();
    const K = '#2b2433';
    const BR = '#b7791f';
    b.frame(-5, -5, 5, 5, 6, 7, K);
    b.box(-4, 5, 4, -1, 8, 6, BR).box(1, 5, 4, 4, 8, 6, BR);
    b.box(-1, 6, 4, 1, 7, 5, BR);
    const lens = Builder().box(-3, 6, 6, -2, 7, 7, '#22d3ee').box(2, 6, 6, 3, 7, 7, '#22d3ee');
    return [part(b.list()), part(lens.list(), { glow: true })];
  }

  // plecy
  const PHOENIX = [
    '.........ooo',
    '.......ooorr',
    '.....ooorrr.',
    '...ooorrryy.',
    '..oorrryyy..',
    '.oorryyyy...',
    'oorryyyy....',
    'orryyyy.....',
    'orryyy......',
    'rryyy.......',
    'ryyy........',
    'yyy.........',
    'yy..........'
  ];

  function jetpack() {
    const b = Builder();
    const M = '#9aa4ad';
    const MD = '#6b7480';
    b.box(-4, -10, -6, -1, -2, -2, M).box(1, -10, -6, 4, -2, -2, M);
    b.box(-4, -2, -6, -1, -1, -2, MD).box(1, -2, -6, 4, -1, -2, MD);
    b.box(-4, -6, -6, -1, -5, -2, '#e11d48').box(1, -6, -6, 4, -5, -2, '#e11d48');
    b.box(-1, -8, -4, 1, -4, -2, MD);
    b.box(-3, -11, -5, -2, -10, -3, '#2b2433').box(2, -11, -5, 3, -10, -3, '#2b2433');
    const flame = Builder();
    for (const cx of [-3, 2]) {
      flame.box(cx, -13, -5, cx + 1, -11, -3, '#ffb020');
      flame.set(cx, -14, -4, '#ff5a1f');
      flame.set(cx, -12, -4, '#fff1a8');
    }
    return [part(b.list()), part(flame.list(), { pivot: [0, -11, -4], anim: { type: 'pulse', amp: 0.25, speed: 14 }, glow: true })];
  }

  function shield() {
    const b = Builder();
    for (let x = -6; x <= 6; x++) {
      for (let y = -6; y <= 6; y++) {
        const d = Math.hypot(x, y);
        if (d > 6.2) continue;
        let c = d > 5 ? '#c0c7cf' : '#2f5f9e';
        if (d <= 5 && (x === 0 || y === 0)) c = '#e9b949';
        if (d < 1.5) c = '#f8fafc';
        b.set(x, y - 6, -3, c);
      }
    }
    b.set(0, -6, -4, '#e9b949');
    return [part(b.list())];
  }

  // aury
  function runeRing() {
    const ring = Builder();
    const runes = Builder();
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      ring.set(Math.round(Math.cos(a) * 19), 0, Math.round(Math.sin(a) * 19), '#a78bfa');
    }
    const glyphs = [['#.#', '.#.', '#.#'], ['###', '#..', '###'], ['.#.', '###', '.#.'], ['#..', '###', '..#']];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cx = Math.round(Math.cos(a) * 15);
      const cz = Math.round(Math.sin(a) * 15);
      glyphs[i % glyphs.length].forEach((row, r) => [...row].forEach((ch, k) => ch === '#' && runes.set(cx + k - 1, 0, cz + r - 1, i % 2 ? '#38e1ff' : '#f0abfc')));
    }
    return [
      part(ring.list(), { size: 0.5, offset: [0, -23.6, 0], pivot: [0, -23.5, 0], anim: { type: 'spin', speed: 0.25 }, glow: true }),
      part(runes.list(), { size: 0.5, offset: [0, -23.4, 0], pivot: [0, -23.5, 0], anim: { type: 'spin', speed: -0.4, bob: 0.3 }, glow: true })
    ];
  }

  function energySpiral() {
    const b = Builder();
    const cols = ['#22d3ee', '#60a5fa', '#a78bfa', '#f0abfc'];
    for (let k = 0; k < 70; k++) {
      for (const off of [0, Math.PI]) {
        const a = k * 0.32 + off;
        const y = -46 + k * 0.85;
        b.set(Math.round(Math.cos(a) * 18), Math.round(y), Math.round(Math.sin(a) * 18), cols[Math.floor(k / 18) % cols.length]);
      }
    }
    return [part(b.list(), { size: 0.5, pivot: [0, -6, 0], anim: { type: 'spin', speed: 0.8 }, glow: true })];
  }

  function gemOrbit() {
    const parts = [];
    const cols = [['#a78bfa', '#ddd6fe'], ['#22d3ee', '#cffafe'], ['#f472b6', '#fbcfe8'], ['#facc15', '#fef9c3']];
    cols.forEach(([c, l], i) => {
      const a = (i / cols.length) * Math.PI * 2;
      const g = Builder();
      // ośmiościan z wokseli (klejnot)
      for (let x = -2; x <= 2; x++) for (let y = -3; y <= 3; y++) for (let z = -2; z <= 2; z++) {
        if (Math.abs(x) + Math.abs(z) + Math.abs(y) * 0.7 <= 2.6) g.set(x, y, z, y > 0 && x + z <= 0 ? l : c);
      }
      parts.push(part(g.list(), {
        size: 0.5,
        offset: [Math.cos(a) * 12, 2, Math.sin(a) * 12],
        anim: { type: 'orbit', speed: 0.7, bob: 1.2, phase: i * 1.6 },
        glow: true
      }));
    });
    return parts;
  }

  function heartOrbit() {
    const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    return [0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2;
      const b = Builder().sprite(heart, { '#': i === 1 ? '#fb7185' : '#f472b6' }, { x: -4, y: 3, z: 0 });
      b.set(-2, 2, 0, '#ffe4e6');
      return part(b.list(), { size: 0.5, offset: [Math.cos(a) * 11, 6, Math.sin(a) * 11], anim: { type: 'orbit', speed: 0.5, bob: 1.5, phase: i * 2.1 }, glow: true });
    });
  }

  // towarzysze
  function miniDragon() {
    const b = Builder();
    const P = '#7c3aed';
    const PL = '#a78bfa';
    const Y = '#facc15';
    b.box(-2, 0, -4, 2, 3, 3, P); // tułów
    b.box(-2, 2, 3, 2, 5, 7, P); // głowa
    b.box(-1, 2, 7, 1, 4, 9, PL); // pysk
    b.set(-2, 4, 6, '#fef08a').set(1, 4, 6, '#fef08a'); // oczy
    b.set(-2, 5, 4, Y).set(1, 5, 4, Y); // rożki
    b.box(-1, 0, -8, 1, 2, -4, P).box(0, 1, -11, 1, 2, -8, PL); // ogon
    b.box(-2, -1, -2, -1, 0, 0, P).box(1, -1, -2, 2, 0, 0, P); // łapki
    b.box(-1, 3, -2, 1, 4, 2, PL); // grzbiet
    const wings = Builder();
    wings.sprite(['####', '.###', '..##', '...#'], { '#': PL }, { x: 2, y: 4, z: -1, depth: 1 });
    wings.sprite(['####', '.###', '..##', '...#'], { '#': PL }, { x: -2, y: 4, z: -1, depth: 1, mirror: true });
    const opts = { size: 0.6, offset: [12, 6, 0], pivot: [0, 0, 0], anim: { type: 'orbit', speed: 0.3, bob: 1.6 } };
    return [part(b.list(), opts), part(wings.list(), { ...opts, offset: [12, 6.6, 0] })];
  }

  function wispPet() {
    const b = Builder();
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 5; y++) for (let z = -3; z <= 3; z++) {
      const d = Math.hypot(x, (y > 0 ? y * 0.6 : y), z);
      if (d <= 3.1) b.set(x, y, z, d < 1.6 ? '#ffffff' : d < 2.5 ? '#a5f3fc' : '#22d3ee');
    }
    b.set(0, 6, 0, '#cffafe').set(0, 7, -1, '#a5f3fc');
    return [part(b.list(), { size: 0.5, offset: [10, 9, 2], anim: { type: 'orbit', speed: 0.45, bob: 1.8 }, glow: true })];
  }

  function slimePet() {
    const b = Builder();
    const G = '#4ade80';
    const GD = '#22c55e';
    b.box(-3, 0, -3, 3, 6, 3, G);
    b.box(-3, 0, -3, 3, 1, 3, GD);
    b.box(-2, 1, -2, 2, 4, 2, '#16a34a');
    b.box(-2, 3, 3, -1, 5, 4, '#0b0810').box(1, 3, 3, 2, 5, 4, '#0b0810');
    b.set(0, 2, 3, '#14532d');
    return [part(b.list(), { size: 0.6, offset: [11, -22, 3], pivot: [0, -22, 0], anim: { type: 'bounce', amp: 3, speed: 4 } })];
  }

  // event: Halloween
  const PUMPKIN = ['#f97316', '#ea580c'];
  const PUMPKIN_D = '#c2410c';
  const LANTERN = '#ffd54a';
  const LANTERN_HI = '#fff3b0';

  /** Wyrzeźbiona twarz dyni (oczy-trójkąty, nos, szeroki uśmiech z zębami) – w układzie x[-w/2..w/2), y od dołu. */
  const JACK_FACE = [
    '..........',
    '.##....##.',
    '.###..###.',
    '..........',
    '....##....',
    '..........',
    '#.##..##.#',
    '##########',
    '.###..###.',
    '..........'
  ];

  function pumpkinHead() {
    const shell = Builder();
    const face = Builder();
    // dynia: zaokrąglony prostopadłościan 10×10×10 wokół głowy, pionowe żeberka
    for (let x = -5; x < 5; x++) {
      for (let y = -1; y < 9; y++) {
        for (let z = -5; z < 5; z++) {
          const edgeX = x === -5 || x === 4;
          const edgeY = y === -1 || y === 8;
          const edgeZ = z === -5 || z === 4;
          if (!(edgeX || edgeY || edgeZ)) continue;
          if (y === -1 && x > -4 && x < 3 && z > -4 && z < 3) continue; // otwór na szyję
          if ((edgeX && edgeY) || (edgeX && edgeZ) || (edgeY && edgeZ)) continue; // ścięte krawędzie
          const rib = edgeZ ? x : z;
          shell.set(x, y, z, edgeY ? PUMPKIN_D : PUMPKIN[((rib % 2) + 2) % 2]);
        }
      }
    }
    // twarz z przodu (z = 4) świeci
    JACK_FACE.forEach((row, r) => [...row].forEach((ch, i) => {
      if (ch !== '#') return;
      const x = i - 5;
      const y = 8 - r - 0.0;
      shell.del(x, y, 4);
      face.set(x, y, 4, r === 7 ? LANTERN_HI : LANTERN);
    }));
    // ogonek i listek
    shell.box(-1, 9, -1, 1, 11, 1, '#5b3a1e').set(0, 11, -1, '#4a2f17');
    shell.box(1, 9, -1, 4, 10, 1, '#4ade80').set(3, 10, 0, '#22c55e');
    return [part(shell.list()), part(face.list(), { glow: true })];
  }

  function witchHat() {
    const b = Builder();
    const K = '#2a1838';
    const KL = '#3d2552';
    b.disc(0, 0, 7.4, 7, 8, K);
    b.disc(0, 0, 4.6, 8, 10, KL);
    b.disc(0, 0, 4.7, 8, 9, '#f97316'); // pomarańczowa opaska
    b.box(-1, 8, 4, 1, 10, 5, GOLD).set(-1, 9, 4, '#f97316').set(0, 9, 4, '#f97316');
    // wygięty stożek
    b.disc(0, -0.5, 3.8, 10, 12, KL);
    b.disc(0, -1.5, 2.9, 12, 14, KL);
    b.disc(0, -2.8, 2.0, 14, 16, K);
    b.disc(0, -4.2, 1.3, 16, 17, K);
    b.box(-1, 17, -6, 0, 18, -4, K).set(-1, 17, -7, '#a855f7');
    // fioletowa gwiazdka na rondzie
    b.set(3, 10, 3, '#c084fc').set(3, 11, 3, '#e9d5ff');
    return [part(b.list())];
  }

  function skullMask() {
    const b = Builder();
    const eyes = Builder();
    const BONE = '#ede4d3';
    const BONE_D = '#c9bca4';
    const rows = [
      '.########.',
      '##########',
      '#kk####kk#',
      '#kk####kk#',
      '####kk####',
      '.########.',
      '.#w#w#w#..',
      '..######..'
    ];
    rows.forEach((row, r) => [...row].forEach((ch, i) => {
      const x = i - 5;
      const y = 8 - r;
      if (ch === '#') b.set(x, y, 4, r > 5 ? BONE_D : BONE);
      if (ch === 'w') b.set(x, y, 4, '#ffffff');
      if (ch === 'k') eyes.set(x, y, 4, r === 2 ? '#ff2d4a' : '#7a0a1c');
    }));
    // boki maski przy skroniach
    b.box(-5, 3, 1, -4, 8, 4, BONE_D).box(4, 3, 1, 5, 8, 4, BONE_D);
    return [part(b.list()), part(eyes.list(), { glow: true })];
  }

  // skrzydło nietoperza: kości (b, *) rozchodzą się od ramienia, błona (+) z falistym dołem
  const BAT = [
    '...........bbb',
    '.........bb++b',
    '.......bb++++b',
    '.....bb+++++*b',
    '...bb+++++*++b',
    '.bb++++++*+++b',
    'b++++++*+++++b',
    'b+++++*++++*+b',
    'b++++*++++*++b',
    'b+++*+++++*++b',
    'b++*+++++*+++b',
    'b+*.++++*.++*b',
    'b*...++*...+*.',
    'b.....+*.....*'
  ];

  function reaperScythe() {
    const b = Builder();
    const edge = Builder();
    for (let i = 0; i < 26; i++) {
      const x = -7 + Math.floor(i * 0.55);
      const y = -16 + i;
      b.set(x, y, -3, i % 5 === 0 ? '#2a1d14' : '#4a3424');
    }
    // ostrze: łuk nad lewym ramieniem
    const cx = -1;
    const cy = 6;
    for (let a = 0.15; a <= Math.PI * 0.95; a += 0.04) {
      for (let r = 5.5; r <= 8; r += 0.5) {
        const x = Math.round(cx + Math.cos(a) * r);
        const y = Math.round(cy + Math.sin(a) * r * 0.75);
        if (r > 7.6) edge.set(x, y, -3, '#b4ff6e');
        else b.set(x, y, -3, r > 6.8 ? '#f1f5f9' : '#94a3b8');
      }
    }
    return [part(b.list()), part(edge.list(), { glow: true })];
  }

  function soulRing() {
    const ghost = ['..###..', '.#####.', '#######', '#kk#kk#', '#kk#kk#', '#######', '###o###', '#######', '#.##.##', '..#..#.'];
    return [0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2;
      const b = Builder().sprite(ghost, { '#': i % 2 ? '#e3fbff' : '#c4f3ff', k: '#123247', o: '#5b7a8c' }, { x: -4, y: 8, z: 0, depth: 2 });
      return part(b.list(), { size: 0.6, offset: [Math.cos(a) * 12, 4, Math.sin(a) * 12], anim: { type: 'orbit', speed: 0.42, bob: 1.8, phase: i * 1.57 }, glow: true });
    });
  }

  function candyOrbit() {
    const b = Builder();
    const sets = [['#f43f5e', '#fecdd3'], ['#a855f7', '#e9d5ff'], ['#f97316', '#fed7aa'], ['#22c55e', '#bbf7d0'], ['#facc15', '#fef9c3'], ['#38bdf8', '#e0f2fe']];
    sets.forEach(([c, l], i) => {
      const a = (i / sets.length) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * 14);
      const z = Math.round(Math.sin(a) * 14);
      const y = -9 + (i % 2) * 4;
      // cukierek w papierku: środek 3×3×2 z paskiem + skręcone końce
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = 0; dz < 2; dz++) b.set(x + dx, y + dy, z + dz, dx === dy ? l : c);
      for (let dz = 0; dz < 2; dz++) {
        b.set(x - 2, y, z + dz, l).set(x - 3, y + 1, z + dz, l).set(x - 3, y - 1, z + dz, l);
        b.set(x + 2, y, z + dz, l).set(x + 3, y + 1, z + dz, l).set(x + 3, y - 1, z + dz, l);
      }
    });
    return [part(b.list(), { size: 0.7, pivot: [0, -6, 0], anim: { type: 'spin', speed: 0.7, bob: 0.9 } })];
  }

  function pumpkinPet() {
    const b = Builder();
    const face = Builder();
    for (let x = -3; x < 3; x++) for (let y = 0; y < 5; y++) for (let z = -3; z < 3; z++) {
      const corner = (x === -3 || x === 2) && (z === -3 || z === 2);
      const cap = (y === 0 || y === 4) && (x === -3 || x === 2 || z === -3 || z === 2);
      if (corner || cap) continue;
      b.set(x, y, z, y === 0 ? PUMPKIN_D : PUMPKIN[((x % 2) + 2) % 2]);
    }
    for (const [x, y] of [[-2, 3], [1, 3], [-2, 1], [-1, 1], [0, 1], [1, 1]]) {
      b.del(x, y, 2);
      face.set(x, y, 2, LANTERN);
    }
    b.box(-1, 5, -1, 0, 7, 0, '#5b3a1e').set(0, 6, 0, '#4ade80').set(1, 6, 0, '#4ade80');
    const opts = { size: 0.7, offset: [11, -22, 3], pivot: [0, -22, 0], anim: { type: 'bounce', amp: 3, speed: 3.6 } };
    return [part(b.list(), opts), part(face.list(), { ...opts, glow: true })];
  }

  function batPet() {
    const b = Builder();
    const eyes = Builder();
    const D = '#2b1d3a';
    const M = '#4b2e66';
    b.box(-2, 0, -1, 2, 4, 2, D); // ciałko
    b.set(-2, 4, 0, D).set(1, 4, 0, D); // uszy
    b.set(-2, 5, 0, D).set(1, 5, 0, D);
    const wing = ['bbbb..', '+++bbb', '.++++b', '..+.+.'];
    b.sprite(wing, { b: D, '+': M }, { x: 2, y: 3, z: 0 });
    b.sprite(wing, { b: D, '+': M }, { x: -2, y: 3, z: 0, mirror: true });
    eyes.set(-1, 2, 2, '#ff2d4a').set(0, 2, 2, '#ff2d4a');
    const opts = { size: 0.6, offset: [11, 8, 0], pivot: [0, 0, 0], anim: { type: 'orbit', speed: 0.55, bob: 2.2 } };
    return [part(b.list(), opts), part(eyes.list(), { ...opts, glow: true })];
  }

  // katalog
  const SLOTS = {
    head: 'NAKRYCIE GŁOWY',
    face: 'TWARZ',
    back: 'PLECY',
    aura: 'AURA',
    pet: 'TOWARZYSZ'
  };

  const RARITY = { common: 'ZWYKŁY', rare: 'RZADKI', epic: 'EPICKI', legendary: 'LEGENDARNY' };

  const CATALOG = [
    { id: 'crown', name: 'Korona Króla', slot: 'head', bone: 'head', rarity: 'legendary', parts: crown() },
    { id: 'halo', name: 'Aureola', slot: 'head', bone: 'head', rarity: 'epic', parts: halo() },
    { id: 'wizard_hat', name: 'Kapelusz Maga', slot: 'head', bone: 'head', rarity: 'epic', parts: wizardHat() },
    { id: 'top_hat', name: 'Cylinder', slot: 'head', bone: 'head', rarity: 'rare', parts: topHat() },
    { id: 'ice_crown', name: 'Lodowa Korona', slot: 'head', bone: 'head', rarity: 'legendary', parts: iceCrown() },
    { id: 'viking', name: 'Hełm Wikinga', slot: 'head', bone: 'head', rarity: 'rare', parts: vikingHelmet() },
    { id: 'santa_hat', name: 'Czapka Mikołaja', slot: 'head', bone: 'head', rarity: 'common', parts: santaHat() },
    { id: 'cat_ears', name: 'Kocie Uszy', slot: 'head', bone: 'head', rarity: 'common', parts: catEars() },
    { id: 'demon_horns', name: 'Rogi Demona', slot: 'head', bone: 'head', rarity: 'epic', parts: demonHorns() },
    { id: 'antlers', name: 'Poroże', slot: 'head', bone: 'head', rarity: 'rare', parts: antlers() },
    { id: 'headphones', name: 'Słuchawki Neon', slot: 'head', bone: 'head', rarity: 'rare', parts: headphones() },
    { id: 'flower_crown', name: 'Wianek z Kwiatów', slot: 'head', bone: 'head', rarity: 'rare', parts: flowerCrown() },
    { id: 'pirate_hat', name: 'Kapelusz Pirata', slot: 'head', bone: 'head', rarity: 'epic', parts: pirateHat() },
    { id: 'unicorn_horn', name: 'Róg Jednorożca', slot: 'head', bone: 'head', rarity: 'legendary', parts: unicornHorn() },
    { id: 'cowboy_hat', name: 'Kapelusz Kowboja', slot: 'head', bone: 'head', rarity: 'rare', parts: cowboyHat() },
    { id: 'ninja_band', name: 'Opaska Ninja', slot: 'head', bone: 'head', rarity: 'rare', parts: ninjaBand() },
    { id: 'bunny_ears', name: 'Uszy Królika', slot: 'head', bone: 'head', rarity: 'common', parts: bunnyEars() },
    { id: 'mushroom_cap', name: 'Czapka Muchomor', slot: 'head', bone: 'head', rarity: 'common', parts: mushroomCap() },
    { id: 'shades', name: 'Okulary Pixel', slot: 'face', bone: 'head', rarity: 'common', parts: shades() },
    { id: 'monocle', name: 'Monokl', slot: 'face', bone: 'head', rarity: 'rare', parts: monocle() },
    { id: 'goggles', name: 'Gogle Steampunk', slot: 'face', bone: 'head', rarity: 'epic', parts: goggles() },
    { id: 'angel_wings', name: 'Skrzydła Anioła', slot: 'back', bone: 'body', rarity: 'legendary',
      parts: wings(ANGEL, { '#': '#ffffff', '+': '#d5deee' }) },
    { id: 'dragon_wings', name: 'Skrzydła Smoka', slot: 'back', bone: 'body', rarity: 'legendary',
      parts: wings(DRAGON, { b: '#2a1a3d', m: '#8b5cf6', '#': '#5b3aa8' }, { flap: 18, speed: 2 }) },
    { id: 'crystal_wings', name: 'Kryształowe Skrzydła', slot: 'back', bone: 'body', rarity: 'epic',
      parts: wings(BUTTERFLY, { '#': '#38e1ff', '+': '#8af0ff', '*': '#e8fdff' }, { glow: true, flap: 26, speed: 3.4 }) },
    { id: 'phoenix_wings', name: 'Skrzydła Feniksa', slot: 'back', bone: 'body', rarity: 'legendary',
      parts: wings(PHOENIX, { o: '#ff3d2e', r: '#ff8a1f', y: '#ffd166' }, { glow: true, flap: 24, speed: 3 }) },
    { id: 'jetpack', name: 'Jetpack', slot: 'back', bone: 'body', rarity: 'epic', parts: jetpack() },
    { id: 'shield', name: 'Tarcza Rycerza', slot: 'back', bone: 'body', rarity: 'rare', parts: shield() },
    { id: 'backpack', name: 'Plecak Podróżnika', slot: 'back', bone: 'body', rarity: 'common', parts: backpack() },
    { id: 'fox_tail', name: 'Ogon Lisa', slot: 'back', bone: 'body', rarity: 'rare', parts: foxTail() },
    { id: 'katana', name: 'Katana', slot: 'back', bone: 'body', rarity: 'epic', parts: katana() },
    { id: 'star_aura', name: 'Aura Gwiazd', slot: 'aura', bone: 'body', rarity: 'epic', parts: starAura() },
    { id: 'gem_orbit', name: 'Orbita Klejnotów', slot: 'aura', bone: 'body', rarity: 'epic', parts: gemOrbit() },
    { id: 'rune_ring', name: 'Krąg Run', slot: 'aura', bone: 'body', rarity: 'legendary', parts: runeRing() },
    { id: 'energy_spiral', name: 'Spirala Energii', slot: 'aura', bone: 'body', rarity: 'epic', parts: energySpiral() },
    { id: 'heart_orbit', name: 'Serduszka', slot: 'aura', bone: 'body', rarity: 'rare', parts: heartOrbit() },
    { id: 'ghost_pet', name: 'Duszek', slot: 'pet', bone: 'body', rarity: 'epic', parts: ghostPet() },
    { id: 'mini_dragon', name: 'Mini Smok', slot: 'pet', bone: 'body', rarity: 'legendary', parts: miniDragon() },
    { id: 'wisp', name: 'Ognik', slot: 'pet', bone: 'body', rarity: 'rare', parts: wispPet() },
    { id: 'slime_pet', name: 'Slime', slot: 'pet', bone: 'body', rarity: 'common', parts: slimePet() },

    // event Halloween (limitowane: tylko z dyniowej skrzynki w czasie eventu)
    { id: 'pumpkin_head', name: 'Głowa Dyni', slot: 'head', bone: 'head', rarity: 'legendary', event: 'halloween', parts: pumpkinHead() },
    { id: 'witch_hat', name: 'Kapelusz Wiedźmy', slot: 'head', bone: 'head', rarity: 'epic', event: 'halloween', parts: witchHat() },
    { id: 'skull_mask', name: 'Maska Czaszki', slot: 'face', bone: 'head', rarity: 'rare', event: 'halloween', parts: skullMask() },
    { id: 'bat_wings', name: 'Skrzydła Nietoperza', slot: 'back', bone: 'body', rarity: 'epic', event: 'halloween',
      parts: wings(BAT, { b: '#1c1226', '*': '#2b1a3a', '+': '#5b2f7a' }, { flap: 28, speed: 3.4 }) },
    { id: 'reaper_scythe', name: 'Kosa Żniwiarza', slot: 'back', bone: 'body', rarity: 'legendary', event: 'halloween', parts: reaperScythe() },
    { id: 'soul_ring', name: 'Krąg Dusz', slot: 'aura', bone: 'body', rarity: 'legendary', event: 'halloween', parts: soulRing() },
    { id: 'candy_orbit', name: 'Cukierki', slot: 'aura', bone: 'body', rarity: 'rare', event: 'halloween', parts: candyOrbit() },
    { id: 'pumpkin_pet', name: 'Dyniak', slot: 'pet', bone: 'body', rarity: 'rare', event: 'halloween', parts: pumpkinPet() },
    { id: 'bat_pet', name: 'Nietoperz', slot: 'pet', bone: 'body', rarity: 'epic', event: 'halloween', parts: batPet() }
  ];

  // peleryny (64x32 RGBA
  function rng(seedStr) {
    let s = 2166136261;
    for (const ch of seedStr) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const CAPES = {
    dusk: {
      name: 'Zmierzch', base: '#2a1747',
      paint(set, x, y, w, h) {
        const rows = ['#ff4fa3', '#e54aa9', '#c14bb8', '#a64dc4', '#8b5cf6', '#6a46d8', '#4b35a8', '#33246f', '#22184a'];
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) set(x + j, y + i, rows[Math.min(rows.length - 1, Math.floor((i / h) * rows.length))]);
        [[4, 3], [5, 3], [3, 4], [3, 5], [4, 6], [5, 6]].forEach(([a, b]) => set(x + a, y + b, '#ffe9a8'));
      }
    },
    neon: {
      name: 'Neon Grid', base: '#07131c',
      paint(set, x, y, w, h) {
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
          let c = '#07131c';
          if (j % 3 === 1) c = '#1a8fb0';
          if (i % 3 === 1) c = '#38e1ff';
          if (i === h - 1) c = '#ff4fa3';
          set(x + j, y + i, c);
        }
      }
    },
    ember: {
      name: 'Żar', base: '#2b0d08',
      paint(set, x, y, w, h, rand) {
        const pal = ['#2b0d08', '#5c1a0c', '#a12a0f', '#e0531a', '#ffb02e', '#fff1a8'];
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
          const heat = (i / h) * 4.2 + rand() * 1.6 - 0.6;
          set(x + j, y + i, pal[Math.max(0, Math.min(pal.length - 1, Math.floor(heat)))]);
        }
      }
    },
    void: {
      name: 'Pustka', base: '#050308',
      paint(set, x, y, w, h, rand) {
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) set(x + j, y + i, '#0b0614');
        for (let k = 0; k < 14; k++) {
          const r = rand();
          set(x + Math.floor(rand() * w), y + Math.floor(rand() * h), r > 0.7 ? '#38e1ff' : r > 0.35 ? '#a78bfa' : '#ece6f7');
        }
        for (let j = 0; j < w; j++) set(x + j, y, '#8b5cf6');
      }
    },
    aurora: {
      name: 'Zorza', base: '#071a24',
      paint(set, x, y, w, h) {
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) set(x + j, y + i, '#071a24');
        const cols = ['#5dff8a', '#38e1ff', '#8b5cf6'];
        for (let j = 0; j < w; j++) cols.forEach((c, k) => {
          const wy = Math.round(3 + k * 4 + Math.sin(j * 0.9 + k) * 1.6);
          if (wy < h) set(x + j, y + wy, c);
          if (wy + 1 < h) set(x + j, y + wy + 1, c);
        });
      }
    },
    glitch: {
      name: 'Glitch', base: '#120d1a',
      paint(set, x, y, w, h, rand) {
        const pal = ['#120d1a', '#ff4fa3', '#38e1ff', '#8b5cf6', '#ece6f7', '#241a33'];
        for (let i = 0; i < h; i++) {
          const c = pal[rand() < 0.55 ? 0 : 1 + Math.floor(rand() * (pal.length - 1))];
          const off = Math.floor(rand() * 3);
          for (let j = 0; j < w; j++) set(x + j, y + i, j < off ? '#120d1a' : c);
        }
      }
    },
    galaxy: {
      name: 'Galaktyka', base: '#0c0a2e',
      paint(set, x, y, w, h, rand) {
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
          const d = Math.hypot(j - w / 2, (i - h / 2) * 0.7);
          const c = d < 2 ? '#ffd6f5' : d < 3.5 ? '#c879ff' : d < 5.5 ? '#6a3fc1' : '#16124a';
          set(x + j, y + i, rand() < 0.08 ? '#ffffff' : c);
        }
      }
    },
    sakura: {
      name: 'Sakura', base: '#ffe1ee',
      paint(set, x, y, w, h, rand) {
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) set(x + j, y + i, i < h / 2 ? '#ffe1ee' : '#ffc7de');
        for (let k = 0; k < 7; k++) {
          const px = x + 1 + Math.floor(rand() * (w - 2));
          const py = y + 1 + Math.floor(rand() * (h - 2));
          set(px, py, '#ff7fb0');
          set(px + 1, py, '#ff9cc4');
          set(px - 1, py, '#ff9cc4');
          set(px, py + 1, '#ff9cc4');
          set(px, py - 1, '#ff9cc4');
          set(px, py, '#ffe680');
        }
        for (let j = 0; j < w; j++) set(x + j, y + h - 1, '#7a4a3a');
      }
    },
    lightning: {
      name: 'Burza', base: '#1b2133',
      paint(set, x, y, w, h) {
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) set(x + j, y + i, i % 4 === 0 ? '#232b42' : '#1b2133');
        const bolt = [[6, 1], [5, 2], [5, 3], [4, 4], [4, 5], [3, 6], [4, 6], [5, 6], [6, 6], [5, 7], [5, 8], [4, 9], [4, 10], [3, 11], [3, 12], [2, 13]];
        bolt.forEach(([a, b]) => {
          set(x + a, y + b, '#ffe14d');
          set(x + a + 1, y + b, '#fff6b0');
        });
      }
    },
    checker: {
      name: 'Szachownica', base: '#ffffff',
      paint(set, x, y, w, h) {
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) set(x + j, y + i, (Math.floor(i / 2) + Math.floor(j / 2)) % 2 ? '#8b5cf6' : '#f4f0ff');
      }
    },

    // event Halloween
    pumpkin_night: {
      name: 'Noc Dyń', base: '#1a0f2e', rarity: 'epic', event: 'halloween',
      paint(set, x, y, w, h, rand) {
        const sky = ['#120a24', '#1a0f2e', '#24133d', '#2f1a4d', '#3b2160'];
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) set(x + j, y + i, sky[Math.min(sky.length - 1, Math.floor((i / h) * sky.length))]);
        for (let k = 0; k < 6; k++) set(x + Math.floor(rand() * w), y + Math.floor(rand() * (h / 2)), '#e9d5ff');
        // księżyc
        [[6, 2], [7, 2], [6, 3], [7, 3], [8, 3], [6, 4], [7, 4]].forEach(([a, b]) => set(x + a, y + b, '#fde68a'));
        // nietoperz
        [[2, 5], [3, 6], [4, 5], [3, 5], [1, 4], [5, 4]].forEach(([a, b]) => set(x + a, y + b, '#0b0612'));
        // dynie na dole
        for (const px of [1, 6]) {
          const py = h - 5;
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) set(x + px + a, y + py + b, b === 2 ? '#c2410c' : '#f97316');
          set(x + px + 1, y + py - 1, '#4ade80');
          set(x + px, y + py + 1, '#ffd54a');
          set(x + px + 2, y + py + 1, '#ffd54a');
        }
        for (let j = 0; j < w; j++) set(x + j, y + h - 2, '#14301c'), set(x + j, y + h - 1, '#0d1f12');
      }
    },
    spiderweb: {
      name: 'Pajęczyna', base: '#0d0d12', rarity: 'rare', event: 'halloween',
      paint(set, x, y, w, h) {
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) set(x + j, y + i, (i + j) % 7 === 0 ? '#15151c' : '#0d0d12');
        const cx = 1;
        const cy = 1;
        const web = '#d4d4dc';
        // promienie z lewego górnego rogu
        for (const ang of [0.05, 0.4, 0.75, 1.1, 1.5]) for (let r = 0; r < 18; r++) set(x + cx + Math.round(Math.cos(ang) * r), y + cy + Math.round(Math.sin(ang) * r), web);
        // łuki
        for (const r of [4, 8, 12]) for (let a = 0.05; a <= 1.5; a += 0.08) set(x + cx + Math.round(Math.cos(a) * r), y + cy + Math.round(Math.sin(a) * r), '#9b9ba8');
        // pająk na nitce
        for (let i = 0; i < 9; i++) set(x + 7, y + i, '#9b9ba8');
        [[6, 9], [7, 9], [8, 9], [6, 10], [7, 10], [8, 10], [5, 9], [9, 9], [5, 11], [9, 11]].forEach(([a, b]) => set(x + a, y + b, '#1b1b22'));
        set(x + 6, y + 9, '#ff2d4a');
        set(x + 8, y + 9, '#ff2d4a');
      }
    }
  };

  // rzadkość zwykłych peleryn (w skrzynce i sklepie odłamków)
  Object.entries({ dusk: 'common', checker: 'common', neon: 'rare', ember: 'rare', sakura: 'rare', glitch: 'epic', void: 'epic', lightning: 'epic', aurora: 'legendary', galaxy: 'legendary' })
    .forEach(([id, r]) => (CAPES[id].rarity = r));

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** Zwraca bufor RGBA 64x32 w układzie tekstury peleryny Minecraft (cape + elytra). */
  function capePixels(id) {
    const def = CAPES[id];
    const W = 64;
    const H = 32;
    const data = new Uint8ClampedArray(W * H * 4);
    const set = (x, y, hex) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const [r, g, b] = hexToRgb(hex);
      const i = (y * W + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    };
    const fill = (x, y, w, h, hex) => {
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) set(x + j, y + i, hex);
    };
    fill(0, 0, 22, 17, def.base);
    def.paint(set, 1, 1, 10, 16, rng(id));
    def.paint(set, 12, 1, 10, 16, rng(id));
    fill(22, 0, 24, 22, def.base);
    def.paint(set, 24, 2, 10, 20, rng(`${id}:e`));
    def.paint(set, 36, 2, 10, 20, rng(`${id}:e`));
    return { width: W, height: H, data };
  }

  const byId = (id) => CATALOG.find((c) => c.id === id) || null;
  const voxelCount = (item) => item.parts.reduce((n, p) => n + p.voxels.length, 0);

  return { CATALOG, CAPES, SLOTS, RARITY, capePixels, byId, voxelCount };
});

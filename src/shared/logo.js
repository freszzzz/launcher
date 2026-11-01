/*
 * Fresh Client – logo pixel-art (świeży listek w miętowym kafelku).
 * Jedno źródło dla: ikony aplikacji, paska tytułu, ikonki przy nicku w grze, ikony moda i obrazków Discorda.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FreshLogo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // B = tło (gradient mięta -> turkus), W = liść, L = cień liścia, D = nerw liścia, S = błysk
  const LOGO16 = [
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBSB.',
    'BBBBBBBBBWWWWBSB',
    'BBBBBBBWWWWWWWBB',
    'BBBBBWWWWWWWWLBB',
    'BBBBWWWWWWWWLLOB',
    'BBBWWWWWWWDLLLOB',
    'BBBWWWWWWDLLLOBB',
    'BBWWWWWWDLLLLOBB',
    'BBWWWWWDLLLLOBBB',
    'BBWWWWDLLLLOBBBB',
    'BBBWWDLLLLOBBBBB',
    'BBBWDLLLOOBBBBBB',
    'BBWDOOOOBBBBBBBB',
    '.WBBBBBBBBBBBBB.',
    '..BBBBBBBBBBBB..'
  ];

  const LOGO8 = [
    '.BBBBBB.',
    'BBBBBWWB',
    'BBBBWWLB',
    'BBBWWDLB',
    'BBWWDLLB',
    'BBWDLLBB',
    'BWBBBBBB',
    '.BBBBBB.'
  ];

  const COLORS = {
    from: [52, 211, 153], // #34d399
    to: [14, 165, 233], // #0ea5e9
    W: [255, 255, 255],
    L: [209, 250, 229],
    D: [16, 185, 129],
    O: [15, 118, 110],
    S: [236, 253, 245]
  };

  const BRAND = { name: 'Fresh Client', short: 'FRESH', accent: '#14b8a6', accentArgb: 0xff14b8a6 };

  /** Kolor RGB piksela (x,y) siatki rows albo null dla przezroczystego. */
  function pixel(rows, x, y) {
    const ch = rows[y][x];
    if (ch === '.') return null;
    if (ch !== 'B') return COLORS[ch];
    const n = rows.length - 1;
    const t = (x + y) / (2 * n);
    return COLORS.from.map((c, i) => Math.round(c + (COLORS.to[i] - c) * t));
  }

  /** Bufor RGBA (Uint8Array) logo powiększonego `scale` razy. */
  function rgba(rows, scale = 1) {
    const size = rows.length;
    const w = size * scale;
    const out = new Uint8Array(w * w * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = pixel(rows, x, y);
        if (!c) continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const i = ((y * scale + dy) * w + x * scale + dx) * 4;
            out[i] = c[0];
            out[i + 1] = c[1];
            out[i + 2] = c[2];
            out[i + 3] = 255;
          }
        }
      }
    }
    return { width: w, height: w, data: out };
  }

  return { LOGO16, LOGO8, BRAND, pixel, rgba };
});

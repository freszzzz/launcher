// Fresh Client: logo (z shared/logo.js) i pikselowe emblematy profili.
window.Fresh = window.Fresh || {};

(() => {
  const L = window.FreshLogo;
  const LOADER_NAME = { vanilla: 'Vanilla', fabric: 'Fabric', forge: 'Forge' };

  /** Rysuje logo Fresh na canvasie (16×16 lub 8×8 pikseli × scale). */
  function drawLogo(canvas, { scale = 1, small = false } = {}) {
    const img = L.rgba(small ? L.LOGO8 : L.LOGO16, scale);
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    return canvas;
  }

  function renderLogos(root = document) {
    root.querySelectorAll('canvas[data-logo]').forEach((c) => drawLogo(c, { scale: Number(c.dataset.scale) || 1, small: c.dataset.logo === 'small' }));
  }

  // Emblematy 10×10: '#' kontur, '+' kolor, '*' blask, '=' cień, 'w' biel, 'k' czerń.
  const EMBLEMS = {
    // sam listek z logo (bez kafelka) – kafelek daje tło ikony profilu
    fresh: {
      name: 'Fresh',
      bg: ['#34d399', '#0ea5e9'],
      palette: { W: '#ffffff', L: '#d1fae5', D: '#10b981', O: '#0f766e', S: '#ecfdf5' },
      rows: L.LOGO16.slice(1, 15).map((r) => r.slice(1, 15).replace(/B/g, '.'))
    },
    grass: {
      name: 'Trawa',
      bg: ['#bbf7d0', '#4ade80'],
      palette: { '+': '#5dff8a', '*': '#2fbf5a', '#': '#8a5a3b', '=': '#5e3b25' },
      rows: ['++++++++++', '+*++*+++*+', '*#*+#**+#*', '##*##=#*##', '#=####=###', '####=#####', '#=#####=##', '###=######', '#####=##=#', '##=#######']
    },
    diamond: {
      name: 'Diament',
      bg: ['#a5f3fc', '#0891b2'],
      palette: { '#': '#0e4f5c', '+': '#5ee7f2', '*': '#e0fcff', '=': '#22b5c7' },
      rows: ['....##....', '...#**#...', '..#*++=#..', '.#*+++==#.', '#*++++===#', '.#++++==#.', '..#++==#..', '...#+=#...', '....##....', '..........']
    },
    creeper: {
      name: 'Creeper',
      bg: ['#86efac', '#15803d'],
      palette: { '+': '#4cc35a', '*': '#7fe08a', '=': '#2f8f3a', k: '#0b1a0d' },
      rows: ['+*++=++*++', '*+=++*++=+', '+kk++++kk+', '+kk*++=kk+', '++*+kk+*++', '+=+kkkk+=+', '++*kkkk*++', '++=k++k+=+', '+*++=++*++', '++*++=++*+']
    },
    pearl: {
      name: 'Perła Endu',
      bg: ['#99f6e4', '#0f766e'],
      palette: { '#': '#063b36', '+': '#1fa38f', '*': '#8df2df', '=': '#0f5f56', k: '#022420' },
      rows: ['...####...', '..#++++#..', '.#+*++++#.', '#+*++==++#', '#++=kk=++#', '#++=kk=++#', '#+++==+++#', '.#++++++#.', '..#++++#..', '...####...']
    },
    heart: {
      name: 'Serce',
      bg: ['#fecdd3', '#e11d48'],
      palette: { '#': '#5c0718', '+': '#ff3b5c', '*': '#ffd1da', '=': '#b3122f' },
      rows: ['..........', '.###..###.', '#*++##+++#', '#*+++++++#', '#+++++++=#', '.#+++++=#.', '..#+++=#..', '...#+=#...', '....##....', '..........']
    },
    tnt: {
      name: 'TNT',
      bg: ['#fecaca', '#dc2626'],
      palette: { '+': '#e8453c', '*': '#ff8a80', '=': '#a3241d', w: '#f4f4f4', k: '#1a1a1a' },
      rows: ['+*++*++*++', '++++++++++', '=+==+==+==', 'wwwwwwwwww', 'wkkkwkwkkk', 'wwkwwkkwkw', 'wwwwwwwwww', '+*++*++*++', '++++++++++', '=+==+==+==']
    },
    potion: {
      name: 'Mikstura',
      bg: ['#e9d5ff', '#9333ea'],
      palette: { '#': '#2a1240', '+': '#c26bff', '*': '#f3d9ff', '=': '#8a2fd1', w: '#d9e2ec' },
      rows: ['...####...', '....ww....', '....ww....', '...#**#...', '..#*+++#..', '.#*+++++#.', '.#++++++#.', '.#+++++=#.', '..#+++=#..', '...####...']
    },
    gold: {
      name: 'Złoto',
      bg: ['#fef08a', '#d97706'],
      palette: { '#': '#7a4a05', '+': '#ffd23d', '*': '#fff6b3', '=': '#e0a100' },
      rows: ['..........', '..........', '...######.', '..#**+++#.', '.#*+++=#..', '#######...', '#*+++=#...', '#++==#....', '#####.....', '..........']
    }
  };
  const ORDER = ['fresh', 'grass', 'diamond', 'creeper', 'pearl', 'heart', 'tnt', 'potion', 'gold'];
  // profile bez wybranego emblematu dostają domyślny dla silnika
  const DEFAULT_EMBLEM = { vanilla: 'grass', fabric: 'fresh', forge: 'gold' };

  const emblemId = (p) => (EMBLEMS[p?.icon] ? p.icon : DEFAULT_EMBLEM[p?.loader] || 'fresh');

  function drawEmblem(canvas, id, scale = 3) {
    const e = EMBLEMS[id] || EMBLEMS.fresh;
    return Fresh.icons.drawRows(canvas, { rows: e.rows, palette: e.palette }, scale);
  }

  /** Kafelek ikony profilu (gradient + emblemat). */
  function profileIcon(p, size = 'md') {
    const id = emblemId(p);
    const e = EMBLEMS[id];
    const box = document.createElement('div');
    box.className = `profile-icon profile-icon--${size}`;
    box.style.background = `linear-gradient(135deg, ${e.bg[0]}, ${e.bg[1]})`;
    box.appendChild(drawEmblem(document.createElement('canvas'), id));
    return box;
  }

  Fresh.brand = { LOADER_NAME, drawLogo, renderLogos, EMBLEMS, ORDER, emblemId, drawEmblem, profileIcon, BRAND: L.BRAND };
})();

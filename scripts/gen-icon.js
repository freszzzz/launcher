// Generuje ikony Fresh Client ze wspólnego logo (src/shared/logo.js):
//   build/icon.png            – ikona aplikacji / instalatora (256x256)
//   discord-assets/*.png       – obrazki do Discord Rich Presence (512x512)
const fs = require('fs');
const path = require('path');
const { LOGO16, rgba } = require('../src/shared/logo');
const { encodePng, spriteToRgba } = require('./png');

const root = path.join(__dirname, '..');
const write = (rel, img) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePng(img.width, img.height, img.data));
  console.log('Zapisano', rel);
};

write('build/icon.png', rgba(LOGO16, 16));
write('discord-assets/logo.png', rgba(LOGO16, 32));

// małe ikony silnika (prawy dolny róg obrazka w Discordzie): emblemat jak w launcherze na okrągłym gradiencie
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function badge(rows, palette, [from, to], size = 512) {
  const sprite = spriteToRgba(rows, palette, 1);
  const data = new Uint8Array(size * size * 4);
  const a = hex(from);
  const b = hex(to);
  const cell = Math.floor((size * 0.62) / rows.length);
  const off = Math.floor((size - cell * rows.length) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const r = size / 2;
      if ((x - r + 0.5) ** 2 + (y - r + 0.5) ** 2 > r * r) continue;
      const t = (x + y) / (2 * size);
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(a[k] + (b[k] - a[k]) * t);
      data[i + 3] = 255;
      const sx = Math.floor((x - off) / cell);
      const sy = Math.floor((y - off) / cell);
      if (sx < 0 || sy < 0 || sx >= rows.length || sy >= rows.length) continue;
      const j = (sy * rows.length + sx) * 4;
      if (!sprite.data[j + 3]) continue;
      for (let k = 0; k < 3; k++) data[i + k] = sprite.data[j + k];
    }
  }
  return { width: size, height: size, data };
}
const GRASS = ['++++++++++', '+*++*+++*+', '*#*+#**+#*', '##*##=#*##', '#=####=###', '####=#####', '#=#####=##', '###=######', '#####=##=#', '##=#######'];
const GOLD = ['..........', '..........', '...######.', '..#**+++#.', '.#*+++=#..', '#######...', '#*+++=#...', '#++==#....', '#####.....', '..........'];
const LEAF = LOGO16.slice(1, 15).map((r) => r.slice(1, 15).replace(/[BS]/g, '.'));
write('discord-assets/vanilla.png', badge(GRASS, { '+': '#5dff8a', '*': '#2fbf5a', '#': '#8a5a3b', '=': '#5e3b25' }, ['#bbf7d0', '#4ade80']));
write('discord-assets/fabric.png', badge(LEAF, { W: '#ffffff', L: '#d1fae5', D: '#10b981', O: '#0f766e' }, ['#34d399', '#0ea5e9']));
write('discord-assets/forge.png', badge(GOLD, { '#': '#7a4a05', '+': '#ffd23d', '*': '#fff6b3', '=': '#e0a100' }, ['#fef08a', '#d97706']));

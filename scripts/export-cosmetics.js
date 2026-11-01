// Eksportuje wspólny katalog kosmetyków do zasobów moda:
//   assets/freshclient/cosmetics/catalog.json   – modele wokselowe
//   assets/freshclient/textures/cape/<id>.png   – peleryny (64x32)
//   assets/freshclient/textures/misc/white.png  – biała tekstura pod woksele
//   assets/freshclient/textures/font/logo.png   – ikonka obok nicku
//   assets/freshclient/icon.png                 – ikona moda
const fs = require('fs');
const path = require('path');
const { CATALOG, CAPES, capePixels } = require('../src/shared/cosmetics');
const { MODULES } = require('../src/shared/modules');
const { encodePng } = require('./png');
const FreshLogo = require('../src/shared/logo');

const assets = path.resolve(__dirname, '../../mod/src/main/resources/assets/freshclient');
const write = (rel, data) => {
  const file = path.join(assets, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};

const color = (hex) => parseInt(hex.slice(1), 16);

const catalog = {
  items: CATALOG.map((item) => ({
    id: item.id,
    name: item.name,
    slot: item.slot,
    bone: item.bone,
    rarity: item.rarity,
    parts: item.parts.map((p) => ({
      size: p.size,
      offset: p.offset,
      pivot: p.pivot,
      glow: p.glow,
      anim: p.anim,
      voxels: p.voxels.map(([x, y, z, c]) => [x, y, z, color(c)])
    }))
  })),
  capes: Object.entries(CAPES).map(([id, c]) => ({ id, name: c.name, rarity: c.rarity || 'rare' })),
  modules: MODULES.map(({ id, name, category, on, desc }) => ({ id, name, category, on, desc }))
};
write('cosmetics/catalog.json', JSON.stringify(catalog));

for (const id of Object.keys(CAPES)) {
  const px = capePixels(id);
  write(`textures/cape/${id}.png`, encodePng(px.width, px.height, px.data));
}

write('textures/misc/white.png', encodePng(1, 1, new Uint8Array([255, 255, 255, 255])));

// logo Fresh Client: ikonka przy nicku (8x8, glif czcionki) i ikona moda (256x256)
const logo = FreshLogo.rgba(FreshLogo.LOGO8, 1);
write('textures/font/logo.png', encodePng(logo.width, logo.height, logo.data));
const logoBig = FreshLogo.rgba(FreshLogo.LOGO16, 16);
write('icon.png', encodePng(logoBig.width, logoBig.height, logoBig.data));
// logo w menu w grze (16x16 rysowane jako tekstura)
const logoMenu = FreshLogo.rgba(FreshLogo.LOGO16, 2);
write('textures/gui/logo.png', encodePng(logoMenu.width, logoMenu.height, logoMenu.data));

console.log(`Wyeksportowano ${CATALOG.length} modeli, ${Object.keys(CAPES).length} peleryn -> ${assets}`);

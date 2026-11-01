// Minimalny enkoder PNG (RGBA, bez zależności).
const zlib = require('zlib');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** rgba: Uint8Array/Buffer o długości width*height*4 */
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** Rysuje pixel-art z map znaków do bufora RGBA (scale = powiększenie). */
function spriteToRgba(rows, palette, scale = 1) {
  const w = rows[0].length * scale;
  const h = rows.length * scale;
  const out = new Uint8Array(w * h * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const hex = palette[ch];
      if (!hex) return;
      const n = parseInt(hex.slice(1), 16);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((y * scale + dy) * w + x * scale + dx) * 4;
          out[i] = (n >> 16) & 255;
          out[i + 1] = (n >> 8) & 255;
          out[i + 2] = n & 255;
          out[i + 3] = 255;
        }
      }
    });
  });
  return { width: w, height: h, data: out };
}

module.exports = { encodePng, spriteToRgba };

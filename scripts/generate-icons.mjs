// Generatore di icone PNG per la PWA (nessuna dipendenza esterna).
// Uso: npm run icons
// Produce: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, icon-180.png
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------- disegno
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Distanza da un rettangolo con angoli arrotondati (<= 0 = dentro).
function roundedRectSDF(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// Glifo "€" su griglia 13x13 (x = tratto). Due barre orizzontali + spina
// verticale centrale + curva "C" aperta a destra.
const GLYPH_W = 13;
const GLYPH_H = 13;
const BAR_ROWS = new Set([4, 8]);
function glyphAt(col, row) {
  if (col === 1) return true; // spina sinistra della C
  if (col === 6) return true; // barra verticale centrale
  if (BAR_ROWS.has(row)) return col >= 1 && col <= 11; // barre orizzontali
  if (col === 11 && (row === 0 || row === 1 || row === 11 || row === 12)) return true; // estremità C
  return false;
}

const SUPERSAMPLE = 4;

function drawIcon(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;

  // Sfondo: quadrato pieno per maskable, altrimenti quadrato arrotondato con padding.
  const pad = maskable ? 0 : size * 0.04;
  const hw = size / 2 - pad;
  const hh = size / 2 - pad;
  const r = size * (maskable ? 0.12 : 0.22);

  const top = hexToRgb('#10b981'); // emerald-500
  const bottom = hexToRgb('#047857'); // emerald-700

  // Dimensione glifo: più piccolo per maskable (zona sicura ~80%).
  const glyphScale = maskable ? 0.46 : 0.6;
  const cellW = (size * glyphScale) / GLYPH_W;
  const cellH = (size * glyphScale) / GLYPH_H;
  const gx0 = (size - cellW * GLYPH_W) / 2;
  const gy0 = (size - cellH * GLYPH_H) / 2;

  const ss = SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Copertura dello sfondo (anti-alias su 1px).
      const bgCover = clamp(0.5 - roundedRectSDF(x + 0.5, y + 0.5, cx, cy, hw, hh, r), 0, 1);
      if (bgCover <= 0) continue;

      const t = clamp((y + 0.5) / size, 0, 1);
      const rBg = lerp(top[0], bottom[0], t);
      const gBg = lerp(top[1], bottom[1], t);
      const bBg = lerp(top[2], bottom[2], t);

      // Copertura del glifo (supersampling per bordi morbidi).
      let glyphHits = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const gx = x + (sx + 0.5) / ss;
          const gy = y + (sy + 0.5) / ss;
          const col = Math.floor((gx - gx0) / cellW);
          const row = Math.floor((gy - gy0) / cellH);
          if (col >= 0 && col < GLYPH_W && row >= 0 && row < GLYPH_H && glyphAt(col, row)) {
            glyphHits++;
          }
        }
      }
      const glyphCover = glyphHits / (ss * ss);

      const i = (y * size + x) * 4;
      px[i] = Math.round(lerp(rBg, 255, glyphCover));
      px[i + 1] = Math.round(lerp(gBg, 255, glyphCover));
      px[i + 2] = Math.round(lerp(bBg, 255, glyphCover));
      px[i + 3] = Math.round(255 * bgCover);
    }
  }
  return encodePNG(size, size, px);
}

mkdirSync(OUT, { recursive: true });
const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'icon-180.png', size: 180, maskable: false },
];
for (const t of targets) {
  writeFileSync(join(OUT, t.file), drawIcon(t.size, t.maskable));
  console.log(`Generata ${t.file} (${t.size}x${t.size}${t.maskable ? ', maskable' : ''})`);
}
console.log(`Icone salvate in ${OUT}`);

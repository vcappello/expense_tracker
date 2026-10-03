// Generatore di icone PNG per la PWA (nessuna dipendenza esterna).
// Uso: npm run icons
// Produce: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, icon-180.png
//
// Design: scontrino stilizzato con bordo inferiore a zig-zag su quadrato smeraldo,
// glifo "€" in peso regular preso dalla maschera in scripts/euro-glyph.mjs
// (Node non ha un rasterizzatore di font: la maschera e' estratta una volta dal font).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EURO_GLYPH } from './euro-glyph.mjs';

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

// ------------------------------------------------------------------- helpers
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

const cover = (d) => clamp(0.5 - d, 0, 1);

// Composizione "source over" con alpha straight.
function over(dst, rgb, alpha) {
  const a = alpha + dst[3] * (1 - alpha);
  if (a <= 0) return [0, 0, 0, 0];
  const mix = (i) => (rgb[i] * alpha + dst[i] * dst[3] * (1 - alpha)) / a;
  return [mix(0), mix(1), mix(2), a];
}

const COLORS = {
  bgTop: hexToRgb('#10b981'),
  bgBottom: hexToRgb('#065f46'),
  paperTop: hexToRgb('#ffffff'),
  paperBottom: hexToRgb('#e2e8f0'),
  paperLine: hexToRgb('#cbd5e1'),
  ink: hexToRgb('#047857'),
};

// --------------------------------------------------------------- glifo €
const GLYPH = (() => {
  const { width, height, bits } = EURO_GLYPH;
  const buf = Buffer.from(bits, 'base64');
  const bit = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    const i = y * width + x;
    return (buf[i >> 3] >> (7 - (i & 7))) & 1;
  };
  return { width, height, bit };
})();

// Copertura del glifo disegnato nel rettangolo [gx, gy, gw, gh] (campione bilineare).
function glyphCover(x, y, gx, gy, gw, gh) {
  const mx = ((x - gx) / gw) * GLYPH.width;
  const my = ((y - gy) / gh) * GLYPH.height;
  if (mx < -1 || my < -1 || mx > GLYPH.width || my > GLYPH.height) return 0;
  const x0 = Math.floor(mx);
  const y0 = Math.floor(my);
  const tx = mx - x0;
  const ty = my - y0;
  const top = lerp(GLYPH.bit(x0, y0), GLYPH.bit(x0 + 1, y0), tx);
  const bottom = lerp(GLYPH.bit(x0, y0 + 1), GLYPH.bit(x0 + 1, y0 + 1), tx);
  return clamp(lerp(top, bottom, ty), 0, 1);
}

// ------------------------------------------------------------------- disegno
// Scontrino: punte dello zig-zag in numero dispari, cosi' una punta cade al centro
// (piu' spazio sotto la €) e i due estremi del bordo sono alla stessa quota.
const TIPS = 3;
const GLYPH_HEIGHT_RATIO = 0.34; // altezza della € rispetto al lato del design
const GLYPH_CENTER_RATIO = 0.58;

function makeScene(size, maskable) {
  const L = maskable ? size * 0.82 : size; // maskable: contenuto nella zona sicura
  const off = (size - L) / 2;
  const cx = size / 2;

  const pad = maskable ? 0 : size * 0.04;
  const radius = maskable ? 0 : size * 0.22;

  const hw = 0.29 * L;
  const left = cx - hw;
  const right = cx + hw;
  const top = off + 0.12 * L;
  const base = off + 0.88 * L;
  const amp = 0.05 * L;
  const bot = base - amp;
  const cornerR = 0.05 * L;
  const half = TIPS * 2;
  const period = (2 * hw) / half;

  // Vertici del bordo inferiore (stessa costruzione del design approvato).
  const bottomVerts = [{ x: right, y: bot }];
  for (let k = half - 1; k >= 0; k--) {
    bottomVerts.push({ x: left + k * period, y: k % 2 === 1 ? bot : bot - amp });
  }
  bottomVerts.reverse();

  const boundaryY = (x) => {
    if (x <= bottomVerts[0].x) return bottomVerts[0].y;
    for (let i = 1; i < bottomVerts.length; i++) {
      if (x <= bottomVerts[i].x) {
        const a = bottomVerts[i - 1];
        const b = bottomVerts[i];
        const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
        return lerp(a.y, b.y, t);
      }
    }
    return bottomVerts[bottomVerts.length - 1].y;
  };

  const inReceipt = (x, y) => {
    if (x < left || x > right || y < top) return false;
    if (y <= top + cornerR) {
      if (x < left + cornerR) {
        return Math.hypot(x - (left + cornerR), y - (top + cornerR)) <= cornerR;
      }
      if (x > right - cornerR) {
        return Math.hypot(x - (right - cornerR), y - (top + cornerR)) <= cornerR;
      }
    }
    return y <= boundaryY(x);
  };

  const lineHW = 0.14 * L;
  const lineHH = 0.014 * L;
  const lines = [off + 0.25 * L, off + 0.35 * L];

  const euroH = GLYPH_HEIGHT_RATIO * L;
  const euroW = euroH * (GLYPH.width / GLYPH.height);
  const euroX = cx - euroW / 2;
  const euroY = off + GLYPH_CENTER_RATIO * L - euroH / 2;

  return (x, y) => {
    const bgCov = cover(
      roundedRectSDF(x, y, size / 2, size / 2, size / 2 - pad, size / 2 - pad, radius)
    );
    if (bgCov <= 0) return [0, 0, 0, 0];

    const t = clamp(y / size, 0, 1);
    let c = over(
      [0, 0, 0, 0],
      [
        lerp(COLORS.bgTop[0], COLORS.bgBottom[0], t),
        lerp(COLORS.bgTop[1], COLORS.bgBottom[1], t),
        lerp(COLORS.bgTop[2], COLORS.bgBottom[2], t),
      ],
      bgCov
    );

    if (!inReceipt(x, y)) return c;

    c = over(
      c,
      [
        lerp(COLORS.paperTop[0], COLORS.paperBottom[0], t),
        lerp(COLORS.paperTop[1], COLORS.paperBottom[1], t),
        lerp(COLORS.paperTop[2], COLORS.paperBottom[2], t),
      ],
      1
    );

    const lineCov = lines.reduce(
      (acc, ly) => Math.max(acc, cover(roundedRectSDF(x, y, cx, ly + lineHH, lineHW, lineHH, lineHH))),
      0
    );
    if (lineCov > 0) c = over(c, COLORS.paperLine, lineCov);

    const euroCov = glyphCover(x, y, euroX, euroY, euroW, euroH);
    if (euroCov > 0) c = over(c, COLORS.ink, euroCov);

    return c;
  };
}

const SUPERSAMPLE = 4;

function renderIcon(size, maskable) {
  const scene = makeScene(size, maskable);
  const px = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE * SUPERSAMPLE;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const c = scene(x + (sx + 0.5) / SUPERSAMPLE, y + (sy + 0.5) / SUPERSAMPLE);
          r += c[0] * c[3];
          g += c[1] * c[3];
          b += c[2] * c[3];
          a += c[3];
        }
      }
      const i = (y * size + x) * 4;
      px[i] = a > 0 ? Math.round(r / a) : 0;
      px[i + 1] = a > 0 ? Math.round(g / a) : 0;
      px[i + 2] = a > 0 ? Math.round(b / a) : 0;
      px[i + 3] = Math.round((a / n) * 255);
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
  writeFileSync(join(OUT, t.file), renderIcon(t.size, t.maskable));
  console.log(`Generata ${t.file} (${t.size}x${t.size}${t.maskable ? ', maskable' : ''})`);
}
console.log(`Icone salvate in ${OUT}`);

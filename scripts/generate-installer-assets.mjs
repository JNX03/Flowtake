#!/usr/bin/env node
/**
 * Generates installer assets for Flowtake (NSIS sidebar/header BMPs, DMG background PNG, license RTF).
 * Zero external dependencies — uses raw pixel buffer manipulation.
 *
 * Usage: node scripts/generate-installer-assets.mjs
 */

import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const INSTALLER_DIR = join(ROOT, 'src-tauri', 'installer');

// Read version from package.json so installer assets stay in sync with releases
const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;
const VERSION_TEXT = `V${PKG_VERSION}`;

// Brand colors
const NAVY = [15, 15, 35];        // #0f0f23
const DARK_BG = [18, 18, 42];     // #12122a
const PURPLE = [124, 92, 191];    // #7c5cbf
const PURPLE_LIGHT = [148, 120, 205]; // #9478cd
const TEAL = [0, 206, 201];       // #00CEC9
const TEAL_DIM = [0, 140, 137];   // dimmed teal
const WHITE = [240, 240, 255];    // off-white
const GRAY = [120, 120, 150];     // muted gray

// ─── BMP Helpers ────────────────────────────────────────────────────

function createBMP(width, height, pixels) {
  // BMP file: 14-byte file header + 40-byte DIB header + pixel data
  const rowSize = Math.ceil((width * 3) / 4) * 4; // rows padded to 4-byte boundary
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;

  const buf = Buffer.alloc(fileSize);

  // File header (14 bytes)
  buf.write('BM', 0);                      // signature
  buf.writeUInt32LE(fileSize, 2);           // file size
  buf.writeUInt32LE(0, 6);                  // reserved
  buf.writeUInt32LE(54, 10);               // pixel data offset

  // DIB header (BITMAPINFOHEADER, 40 bytes)
  buf.writeUInt32LE(40, 14);               // header size
  buf.writeInt32LE(width, 18);             // width
  buf.writeInt32LE(height, 22);            // height (positive = bottom-up)
  buf.writeUInt16LE(1, 26);               // color planes
  buf.writeUInt16LE(24, 28);              // bits per pixel
  buf.writeUInt32LE(0, 30);               // compression (none)
  buf.writeUInt32LE(pixelDataSize, 34);    // image size
  buf.writeInt32LE(2835, 38);             // horizontal resolution (72 DPI)
  buf.writeInt32LE(2835, 42);             // vertical resolution
  buf.writeUInt32LE(0, 46);               // colors in palette
  buf.writeUInt32LE(0, 50);               // important colors

  // Pixel data (bottom-up, BGR)
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y; // BMP is bottom-up
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 3;
      const dstIdx = 54 + y * rowSize + x * 3;
      buf[dstIdx + 0] = pixels[srcIdx + 2]; // B
      buf[dstIdx + 1] = pixels[srcIdx + 1]; // G
      buf[dstIdx + 2] = pixels[srcIdx + 0]; // R
    }
  }

  return buf;
}

function setPixel(pixels, width, x, y, r, g, b) {
  if (x < 0 || x >= width || y < 0) return;
  const idx = (y * width + x) * 3;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
}

function fillRect(pixels, width, height, x1, y1, w, h, r, g, b) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x1 + dx;
      const py = y1 + dy;
      if (px >= 0 && px < width && py >= 0 && py < height) {
        setPixel(pixels, width, px, py, r, g, b);
      }
    }
  }
}

function fillGradientV(pixels, width, x1, y1, w, h, colorTop, colorBottom, totalHeight) {
  for (let dy = 0; dy < h; dy++) {
    const t = (y1 + dy) / totalHeight;
    const r = Math.round(colorTop[0] + (colorBottom[0] - colorTop[0]) * t);
    const g = Math.round(colorTop[1] + (colorBottom[1] - colorTop[1]) * t);
    const b = Math.round(colorTop[2] + (colorBottom[2] - colorTop[2]) * t);
    for (let dx = 0; dx < w; dx++) {
      const px = x1 + dx;
      const py = y1 + dy;
      if (px >= 0 && px < width && py >= 0 && py < totalHeight) {
        setPixel(pixels, width, px, py, r, g, b);
      }
    }
  }
}

function drawTriangle(pixels, width, height, cx, cy, size, color) {
  // Play button triangle pointing right
  const h = size;
  const w = Math.round(size * 0.866); // equilateral-ish
  for (let dy = -h; dy <= h; dy++) {
    const rowWidth = Math.round(w * (1 - Math.abs(dy) / h));
    for (let dx = 0; dx < rowWidth; dx++) {
      const px = cx - Math.round(w / 3) + dx;
      const py = cy + dy;
      if (px >= 0 && px < width && py >= 0 && py < height) {
        // Slight gradient for depth
        const t = dx / Math.max(rowWidth, 1);
        const r = Math.round(color[0] * (0.7 + 0.3 * t));
        const g = Math.round(color[1] * (0.7 + 0.3 * t));
        const b = Math.round(color[2] * (0.7 + 0.3 * t));
        setPixel(pixels, width, px, py, r, g, b);
      }
    }
  }
}

function drawTealBars(pixels, width, x, y, barWidth, barHeight, gap) {
  // Three horizontal bars (like the Flowtake logo accent)
  for (let i = 0; i < 3; i++) {
    const barY = y + i * (barHeight + gap);
    // Each bar gets slightly shorter
    const w = barWidth - i * Math.round(barWidth * 0.15);
    fillRect(pixels, width, Infinity, x, barY, w, barHeight, ...TEAL);
  }
}

// ─── PNG Helpers (minimal, uncompressed) ────────────────────────────

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function createPNG(width, height, pixels, { rgba = false } = {}) {
  const channels = rgba ? 4 : 3;
  const colorType = rgba ? 6 : 2; // 6 = RGBA, 2 = RGB

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;         // bit depth
  ihdr[9] = colorType; // color type
  ihdr[10] = 0;        // compression
  ihdr[11] = 0;        // filter
  ihdr[12] = 0;        // interlace

  // IDAT - raw pixel data with filter byte per row
  const rowBytes = width * channels;
  const rawData = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + rowBytes);
    rawData[rowOffset] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * channels;
      const dstIdx = rowOffset + 1 + x * channels;
      rawData[dstIdx] = pixels[srcIdx];
      rawData[dstIdx + 1] = pixels[srcIdx + 1];
      rawData[dstIdx + 2] = pixels[srcIdx + 2];
      if (rgba) rawData[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }
  const compressed = zlib.deflateSync(rawData);

  // sRGB chunk - rendering intent 0 (perceptual) for proper macOS color
  const srgb = Buffer.alloc(1);
  srgb[0] = 0;

  // pHYs chunk - 144 DPI (5669 pixels/meter) for Retina @2x
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(5669, 0); // pixels per unit X
  phys.writeUInt32BE(5669, 4); // pixels per unit Y
  phys[8] = 1; // unit = meter

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('sRGB', srgb),
    pngChunk('pHYs', phys),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', iend),
  ]);
}

// ─── Draw text using simple pixel font ──────────────────────────────

// 5x7 pixel font for uppercase + digits (enough for "FLOWTAKE")
const FONT = {
  'F': [0b11111, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000, 0b10000],
  'L': [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  'O': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'W': [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  'T': [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  'A': [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'K': [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  'E': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  'S': [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  'C': [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  'R': [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  'N': [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  'D': [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
  'I': [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  'G': [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  'P': [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  'H': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'M': [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  'U': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'V': [0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b01010, 0b00100],
  'X': [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  'Y': [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  'Z': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  'B': [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  'J': [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  'Q': [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b01110, 0b00011],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  '3': [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100],
};

function drawText(pixels, width, height, text, startX, startY, scale, color) {
  const charWidth = 5;
  const charHeight = 7;
  const spacing = 1;

  for (let ci = 0; ci < text.length; ci++) {
    const ch = text[ci].toUpperCase();
    const glyph = FONT[ch];
    if (!glyph) continue;

    const ox = startX + ci * (charWidth + spacing) * scale;

    for (let row = 0; row < charHeight; row++) {
      const bits = glyph[row];
      for (let col = 0; col < charWidth; col++) {
        if (bits & (1 << (charWidth - 1 - col))) {
          // Draw scaled pixel
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = ox + col * scale + sx;
              const py = startY + row * scale + sy;
              if (px >= 0 && px < width && py >= 0 && py < height) {
                setPixel(pixels, width, px, py, ...color);
              }
            }
          }
        }
      }
    }
  }
}

function textWidth(text, scale) {
  const charWidth = 5;
  const spacing = 1;
  return text.length * (charWidth + spacing) * scale - spacing * scale;
}

// ─── Draw arrow ─────────────────────────────────────────────────────

function drawArrow(pixels, width, height, x1, y, x2, color, thickness) {
  // Horizontal line
  for (let t = -Math.floor(thickness / 2); t <= Math.floor(thickness / 2); t++) {
    for (let x = x1; x <= x2; x++) {
      if (y + t >= 0 && y + t < height) {
        setPixel(pixels, width, x, y + t, ...color);
      }
    }
  }
  // Arrowhead
  const headSize = 12;
  for (let i = 0; i < headSize; i++) {
    for (let t = -i; t <= i; t++) {
      const px = x2 - i;
      const py = y + t;
      if (px >= 0 && px < width && py >= 0 && py < height) {
        setPixel(pixels, width, px, py, ...color);
      }
    }
  }
}

// ─── Generate NSIS Sidebar (164x314) ────────────────────────────────

function generateSidebar() {
  const W = 164, H = 314;
  const pixels = Buffer.alloc(W * H * 3);

  // Gradient background (dark navy top to slightly lighter bottom)
  fillGradientV(pixels, W, 0, 0, W, H, NAVY, DARK_BG, H);

  // Subtle purple accent line on right edge
  fillRect(pixels, W, H, W - 2, 0, 2, H, ...PURPLE);

  // Teal accent bars (logo element) — upper left area
  const barX = 30;
  const barY = 80;
  const barW = 18;
  const barH = 5;
  const barGap = 4;
  for (let i = 0; i < 3; i++) {
    const w = barW - i * 4;
    const by = barY + i * (barH + barGap);
    fillRect(pixels, W, H, barX, by, w, barH, ...TEAL);
  }

  // Play triangle (logo element) — to the right of bars
  const triCx = 75;
  const triCy = 93;
  const triSize = 18;
  // Draw filled triangle pointing right
  for (let dy = -triSize; dy <= triSize; dy++) {
    const rowW = Math.round(triSize * (1 - Math.abs(dy) / triSize));
    for (let dx = 0; dx < rowW; dx++) {
      const px = triCx - Math.round(triSize / 3) + dx;
      const py = triCy + dy;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        // Gradient from purple to light purple
        const t = dx / Math.max(rowW, 1);
        const r = Math.round(PURPLE[0] + (PURPLE_LIGHT[0] - PURPLE[0]) * t);
        const g = Math.round(PURPLE[1] + (PURPLE_LIGHT[1] - PURPLE[1]) * t);
        const b = Math.round(PURPLE[2] + (PURPLE_LIGHT[2] - PURPLE[2]) * t);
        setPixel(pixels, W, px, py, r, g, b);
      }
    }
  }

  // "FLOWTAKE" text below the logo
  const ftScale = 2;
  const ftW = textWidth('FLOWTAKE', ftScale);
  const ftX = Math.round((W - ftW) / 2);
  drawText(pixels, W, H, 'FLOWTAKE', ftX, 135, ftScale, WHITE);

  // Tagline
  const tagScale = 1;
  const tag1 = 'SCREEN RECORDER';
  const tag1W = textWidth(tag1, tagScale);
  drawText(pixels, W, H, tag1, Math.round((W - tag1W) / 2), 165, tagScale, GRAY);

  // Decorative line separator
  fillRect(pixels, W, H, 30, 185, W - 60, 1, ...TEAL_DIM);

  // Version text at bottom
  const verScale = 1;
  const verText = VERSION_TEXT;
  const verW = textWidth(verText, verScale);
  drawText(pixels, W, H, verText, Math.round((W - verW) / 2), 285, verScale, GRAY);

  return createBMP(W, H, pixels);
}

// ─── Generate NSIS Header (150x57) ──────────────────────────────────

function generateHeader() {
  const W = 150, H = 57;
  const pixels = Buffer.alloc(W * H * 3);

  // Dark background
  fillGradientV(pixels, W, 0, 0, W, H, DARK_BG, NAVY, H);

  // Teal accent line at bottom
  fillRect(pixels, W, H, 0, H - 2, W, 2, ...TEAL_DIM);

  // Small teal bars (logo) on right side
  const barX = W - 38;
  const barY = 14;
  for (let i = 0; i < 3; i++) {
    const w = 8 - i * 2;
    fillRect(pixels, W, H, barX, barY + i * 6, w, 3, ...TEAL);
  }

  // Small play triangle
  const triX = W - 20;
  const triY = 20;
  const triS = 8;
  for (let dy = -triS; dy <= triS; dy++) {
    const rowW = Math.round(triS * (1 - Math.abs(dy) / triS));
    for (let dx = 0; dx < rowW; dx++) {
      const px = triX - Math.round(triS / 3) + dx;
      const py = triY + dy;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        setPixel(pixels, W, px, py, ...PURPLE_LIGHT);
      }
    }
  }

  // "FLOWTAKE" text
  drawText(pixels, W, H, 'FLOWTAKE', 10, 20, 2, WHITE);

  return createBMP(W, H, pixels);
}

// ─── Generate DMG Background (1320x800 @2x for Retina) ──────────────
// macOS Retina displays require 2x resolution for DMG backgrounds.
// Window size is 660x400, so the image must be 1320x800.

function generateDMGBackground() {
  const S = 2; // Retina scale factor
  const W = 660 * S, H = 400 * S;
  const pixels = Buffer.alloc(W * H * 3);

  // Gradient background
  fillGradientV(pixels, W, 0, 0, W, H, NAVY, DARK_BG, H);

  // Subtle radial glow around center
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / W;
      const dy = (y - cy) / H;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.5) {
        const intensity = (1 - dist / 0.5) * 0.08;
        const idx = (y * W + x) * 3;
        pixels[idx] = Math.min(255, pixels[idx] + Math.round(PURPLE[0] * intensity));
        pixels[idx + 1] = Math.min(255, pixels[idx + 1] + Math.round(PURPLE[1] * intensity));
        pixels[idx + 2] = Math.min(255, pixels[idx + 2] + Math.round(PURPLE[2] * intensity));
      }
    }
  }

  // "FLOWTAKE" title centered at top
  const titleScale = 3 * S;
  const titleW = textWidth('FLOWTAKE', titleScale);
  drawText(pixels, W, H, 'FLOWTAKE', Math.round((W - titleW) / 2), 40 * S, titleScale, WHITE);

  // Tagline
  const tagScale = 2 * S;
  const tagText = 'SCREEN RECORDER';
  const tagW = textWidth(tagText, tagScale);
  drawText(pixels, W, H, tagText, Math.round((W - tagW) / 2), 75 * S, tagScale, GRAY);

  // Teal separator line
  fillRect(pixels, W, H, W / 2 - 80 * S, 105 * S, 160 * S, 2 * S, ...TEAL);

  // Arrow from app position to Applications folder
  const arrowY = 200 * S;
  drawArrow(pixels, W, H, 230 * S, arrowY, 430 * S, TEAL, 3 * S);

  // "DRAG TO INSTALL" text below arrow
  const dragScale = 1 * S;
  const dragText = 'DRAG TO INSTALL';
  const dragW = textWidth(dragText, dragScale);
  drawText(pixels, W, H, dragText, Math.round((W - dragW) / 2), 225 * S, dragScale, GRAY);

  // Small teal bars + triangle (logo) centered below
  const logoX = W / 2 - 25 * S;
  const logoY = 310 * S;
  for (let i = 0; i < 3; i++) {
    const w = (14 - i * 3) * S;
    fillRect(pixels, W, H, Math.round(logoX), logoY + i * 8 * S, w, 4 * S, ...TEAL);
  }
  // Mini play triangle
  const tX = Math.round(logoX) + 25 * S;
  const tY = logoY + 12 * S;
  const triSize = 10 * S;
  for (let dy = -triSize; dy <= triSize; dy++) {
    const rowW = Math.round(triSize * (1 - Math.abs(dy) / triSize));
    for (let dx = 0; dx < rowW; dx++) {
      const px = tX + dx;
      const py = tY + dy;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        setPixel(pixels, W, px, py, ...PURPLE_LIGHT);
      }
    }
  }

  // Version at bottom
  const verText = VERSION_TEXT;
  const verScale = 1 * S;
  const verW = textWidth(verText, verScale);
  drawText(pixels, W, H, verText, Math.round((W - verW) / 2), 370 * S, verScale, GRAY);

  // Convert RGB to RGBA (macOS Finder requires alpha channel for DMG backgrounds)
  const rgbaPixels = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgbaPixels[i * 4]     = pixels[i * 3];
    rgbaPixels[i * 4 + 1] = pixels[i * 3 + 1];
    rgbaPixels[i * 4 + 2] = pixels[i * 3 + 2];
    rgbaPixels[i * 4 + 3] = 255; // fully opaque
  }

  return createPNG(W, H, rgbaPixels, { rgba: true });
}

// ─── Generate License RTF ───────────────────────────────────────────

function generateLicenseRTF() {
  const license = readFileSync(join(ROOT, 'LICENSE'), 'utf-8');
  const lines = license.split('\n');

  let rtf = '{\\rtf1\\ansi\\deff0\n';
  rtf += '{\\fonttbl{\\f0\\fswiss Segoe UI;}{\\f1\\fmodern Consolas;}}\n';
  rtf += '{\\colortbl ;\\red124\\green92\\blue191;\\red0\\green0\\blue0;}\n';
  rtf += '\\viewkind4\\uc1\n';

  // Title
  rtf += '\\pard\\cf1\\b\\f0\\fs28 Flowtake - License Agreement\\b0\\cf2\\fs20\\par\n';
  rtf += '\\par\n';

  // License text
  for (const line of lines) {
    const escaped = line
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}');
    if (line.trim() === '') {
      rtf += '\\par\n';
    } else {
      rtf += `${escaped}\\par\n`;
    }
  }

  rtf += '}';
  return rtf;
}

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  mkdirSync(INSTALLER_DIR, { recursive: true });

  console.log('Generating NSIS sidebar image (164x314)...');
  const sidebar = generateSidebar();
  writeFileSync(join(INSTALLER_DIR, 'nsis-sidebar.bmp'), sidebar);
  console.log(`  -> nsis-sidebar.bmp (${sidebar.length} bytes)`);

  console.log('Generating NSIS header image (150x57)...');
  const header = generateHeader();
  writeFileSync(join(INSTALLER_DIR, 'nsis-header.bmp'), header);
  console.log(`  -> nsis-header.bmp (${header.length} bytes)`);

  console.log('Generating DMG background image (1320x800 @2x Retina)...');
  const dmgBg = generateDMGBackground();
  writeFileSync(join(INSTALLER_DIR, 'dmg-background.png'), dmgBg);
  console.log(`  -> dmg-background.png (${dmgBg.length} bytes)`);

  console.log('Generating license.rtf...');
  const licenseRtf = generateLicenseRTF();
  writeFileSync(join(INSTALLER_DIR, 'license.rtf'), licenseRtf);
  console.log(`  -> license.rtf (${licenseRtf.length} bytes)`);

  console.log('\nAll installer assets generated successfully!');
  console.log(`Output directory: ${INSTALLER_DIR}`);
}

main();

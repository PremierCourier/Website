// Publishes Blender renders from design/renders/ into src/assets/img/src/.
// Re-encodes each PNG (dropping Blender's EXIF and render-stat text chunks) and fades
// the outer 7% of every edge to transparent, so the soft floor shadow never ends in a
// hard line on the page. Preview renders (*-preview.png) are skipped.

import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FROM = path.join(ROOT, 'design/renders');
const TO = path.join(ROOT, 'src/assets/img/src');
const FADE = 0.07;

function edgeMask(w, h) {
  const fx = Math.round(w * FADE);
  const fy = Math.round(h * FADE);
  const stops = (a, b) =>
    `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${a}" stop-color="#fff" stop-opacity="1"/>` +
    `<stop offset="${b}" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="x" x1="0" x2="1" y1="0" y2="0">${stops(fx / w, 1 - fx / w)}</linearGradient>
        <linearGradient id="y" x1="0" x2="0" y1="0" y2="1">${stops(fy / h, 1 - fy / h)}</linearGradient>
        <mask id="m"><rect width="100%" height="100%" fill="url(#y)"/></mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#x)" mask="url(#m)"/>
    </svg>`,
  );
}

await mkdir(TO, { recursive: true });
const files = (await readdir(FROM)).filter((f) => f.endsWith('.png') && !f.endsWith('-preview.png'));
if (!files.length) {
  console.error('No renders in design/renders/ — run Blender first (see design/README.md).');
  process.exit(1);
}
for (const f of files) {
  const input = path.join(FROM, f);
  const { width, height } = await sharp(input).metadata();
  await sharp(input)
    .ensureAlpha()
    .composite([{ input: edgeMask(width, height), blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(TO, f));
  console.log(`published ${f} (${width}×${height})`);
}

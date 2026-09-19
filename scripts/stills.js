// Publishes Blender renders from design/renders/.
//   *.png            → src/assets/img/src/ (the build makes AVIF/WebP/PNG from these)
//   turntable/<object>/NNN.png → src/assets/turntable/<object>/<width>/NNN.avif (final web
//                      files; the build copies them as-is and hero.js loads them after page
//                      load). Widths: the frame's own width and a smaller step below it.
// Every image is re-encoded (dropping Blender's EXIF and render-stat text chunks) and the
// outer 7% of each edge fades to transparent, so the soft floor shadow never ends in a
// hard line on the page. Preview renders (*-preview.png) are skipped.

import { readdir, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FROM = path.join(ROOT, 'design/renders');
const TO = path.join(ROOT, 'src/assets/img/src');
const FADE = 0.07;
const TURNTABLE_FROM = path.join(FROM, 'turntable');
const TURNTABLE_TO = path.join(ROOT, 'src/assets/turntable');
const WIDTH_STEPS = [720, 480, 320];

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

async function faded(input) {
  const { width, height } = await sharp(input).metadata();
  const buffer = await sharp(input)
    .ensureAlpha()
    .composite([{ input: edgeMask(width, height), blend: 'dest-in' }])
    .png()
    .toBuffer();
  return { buffer, width, height };
}

await mkdir(TO, { recursive: true });
const files = (await readdir(FROM)).filter((f) => f.endsWith('.png') && !f.endsWith('-preview.png'));
if (!files.length) {
  console.error('No renders in design/renders/ — run Blender first (see design/README.md).');
  process.exit(1);
}
for (const f of files) {
  const { buffer, width, height } = await faded(path.join(FROM, f));
  await sharp(buffer).png({ compressionLevel: 9 }).toFile(path.join(TO, f));
  console.log(`published ${f} (${width}×${height})`);
}

if (existsSync(TURNTABLE_FROM)) {
  await rm(TURNTABLE_TO, { recursive: true, force: true });
  for (const object of await readdir(TURNTABLE_FROM)) {
    const dir = path.join(TURNTABLE_FROM, object);
    const frames = (await readdir(dir)).filter((f) => /^\d{3}\.png$/.test(f)).sort();
    if (!frames.length) continue;
    const { width } = await sharp(path.join(dir, frames[0])).metadata();
    const top = WIDTH_STEPS.findIndex((w) => w <= width);
    const widths = WIDTH_STEPS.slice(top, top + 2);
    for (const w of widths) await mkdir(path.join(TURNTABLE_TO, object, String(w)), { recursive: true });
    for (const f of frames) {
      const { buffer } = await faded(path.join(dir, f));
      await Promise.all(
        widths.map((w) =>
          sharp(buffer)
            .resize({ width: w })
            .avif({ quality: 50, effort: 6 })
            .toFile(path.join(TURNTABLE_TO, object, String(w), f.replace('.png', '.avif'))),
        ),
      );
    }
    console.log(`published ${object}: ${frames.length} frames at ${widths.join(' and ')} px`);
  }
}

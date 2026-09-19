// Publishes the cooler open/close frames (design/renders/sequence/frames/NNN.png, open 0 → 1)
// into src/assets/sequence/:
//   desktop/NNN.{avif,webp}   every frame
//   mobile/NNN.{avif,webp}    24 evenly spaced frames (first and last included)
//   poster.{avif,webp}        frame 000 at mobile size — inlined into the page as the poster
//   manifest.json             frame counts and pixel size, read by the build
// Every frame is cropped to the union of all frames' visible pixels, so the canvas is no
// bigger than the motion needs and decoded memory stays low. Fails if a set exceeds the
// budget in CLAUDE.md (desktop ≤ 3.5 MB, mobile ≤ 900 KB, counting one format).

import { readdir, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { edgeMask } from './lib/fade.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FROM = path.join(ROOT, 'design/renders/sequence/frames');
const TO = path.join(ROOT, 'src/assets/sequence');
const DESKTOP_MAX_W = 960;
const MOBILE_W = 520;
const MOBILE_FRAMES = 24;
const BUDGET = { desktop: 3.5 * 1024 * 1024, mobile: 900 * 1024 };
const PAD = 0.06;          // margin around the union box; the edge fade lives inside it
const ALPHA = 24;          // a pixel counts as the object above this alpha (ignores shadow haze)

if (!existsSync(FROM)) {
  console.error('No frames in design/renders/sequence/frames — render them first (see design/README.md).');
  process.exit(1);
}
const files = (await readdir(FROM)).filter((f) => /^\d{3}\.png$/.test(f)).sort();

// Union bounding box of visible pixels across every frame.
let box = null;
let size = null;
for (const f of files) {
  const { data, info } = await sharp(path.join(FROM, f)).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  size = info;
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] > ALPHA) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) continue;
  box = box ? { x0: Math.min(box.x0, x0), y0: Math.min(box.y0, y0), x1: Math.max(box.x1, x1), y1: Math.max(box.y1, y1) } : { x0, y0, x1, y1 };
}
const padX = Math.round((box.x1 - box.x0) * PAD);
const padY = Math.round((box.y1 - box.y0) * PAD);
const crop = {
  left: Math.max(0, box.x0 - padX),
  top: Math.max(0, box.y0 - padY),
  width: Math.min(size.width, box.x1 + padX) - Math.max(0, box.x0 - padX),
  height: Math.min(size.height, box.y1 + padY) - Math.max(0, box.y0 - padY),
};
const desktopW = Math.min(crop.width, DESKTOP_MAX_W);
const aspect = crop.height / crop.width;

await rm(TO, { recursive: true, force: true });
await mkdir(path.join(TO, 'desktop'), { recursive: true });
await mkdir(path.join(TO, 'mobile'), { recursive: true });

async function encode(input, width, outBase) {
  const cropped = await sharp(input).extract(crop).png().toBuffer();
  const faded = await sharp(cropped)
    .composite([{ input: edgeMask(crop.width, crop.height, 0.05), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const base = sharp(faded).resize({ width });
  await Promise.all([
    base.clone().avif({ quality: 52, effort: 6 }).toFile(outBase + '.avif'),
    base.clone().webp({ quality: 70, alphaQuality: 80, effort: 6 }).toFile(outBase + '.webp'),
  ]);
}

const mobilePick = Array.from({ length: MOBILE_FRAMES }, (_, i) => Math.round((i * (files.length - 1)) / (MOBILE_FRAMES - 1)));
for (let i = 0; i < files.length; i++) {
  const input = path.join(FROM, files[i]);
  await encode(input, desktopW, path.join(TO, 'desktop', String(i).padStart(3, '0')));
}
for (let j = 0; j < mobilePick.length; j++) {
  await encode(path.join(FROM, files[mobilePick[j]]), MOBILE_W, path.join(TO, 'mobile', String(j).padStart(3, '0')));
}
await encode(path.join(FROM, files[0]), MOBILE_W, path.join(TO, 'poster'));

async function total(dir, ext) {
  let sum = 0;
  for (const f of await readdir(dir)) if (f.endsWith(ext)) sum += (await stat(path.join(dir, f))).size;
  return sum;
}
const sizes = {
  desktop: { avif: await total(path.join(TO, 'desktop'), '.avif'), webp: await total(path.join(TO, 'desktop'), '.webp') },
  mobile: { avif: await total(path.join(TO, 'mobile'), '.avif'), webp: await total(path.join(TO, 'mobile'), '.webp') },
};
const manifest = {
  desktop: { frames: files.length, width: desktopW, height: Math.round(desktopW * aspect) },
  mobile: { frames: MOBILE_FRAMES, width: MOBILE_W, height: Math.round(MOBILE_W * aspect) },
};
await writeFile(path.join(TO, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`crop ${crop.width}×${crop.height} from ${size.width}×${size.height}`);
console.log(`desktop ${manifest.desktop.frames} × ${manifest.desktop.width}×${manifest.desktop.height}: AVIF ${kb(sizes.desktop.avif)}, WebP ${kb(sizes.desktop.webp)}`);
console.log(`mobile  ${manifest.mobile.frames} × ${manifest.mobile.width}×${manifest.mobile.height}: AVIF ${kb(sizes.mobile.avif)}, WebP ${kb(sizes.mobile.webp)}`);
let over = false;
for (const set of ['desktop', 'mobile']) {
  for (const fmt of ['avif', 'webp']) {
    if (sizes[set][fmt] > BUDGET[set]) {
      console.error(`OVER BUDGET: ${set} ${fmt} ${kb(sizes[set][fmt])} > ${kb(BUDGET[set])}`);
      over = true;
    }
  }
}
if (over) process.exit(1);

// Image pipeline: src/assets/img/src/* → dist/assets/img/
// Raster sources get AVIF + WebP + a fallback in their own format. sharp drops all
// metadata (EXIF, XMP, IPTC) unless told to keep it, and we never tell it to.
// SVGs are copied as-is. Returns a manifest keyed by file basename.

import { readdir, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RASTER = new Set(['.png', '.jpg', '.jpeg']);
const MAX_WIDTH = 960; // largest display is ~440 CSS px; 960 covers 2x screens
const SMALL_WIDTH = 480; // phones: a ~320 CSS px slot at 1.5x

export async function processImages(srcDir, outDir, publicPrefix) {
  await mkdir(outDir, { recursive: true });
  const manifest = {};
  let entries = [];
  try {
    entries = await readdir(srcDir);
  } catch {
    return manifest;
  }

  for (const file of entries) {
    const ext = path.extname(file).toLowerCase();
    const name = path.basename(file, path.extname(file));
    const input = path.join(srcDir, file);

    if (ext === '.svg') {
      await copyFile(input, path.join(outDir, file));
      manifest[name] = { svg: `${publicPrefix}/${file}` };
      continue;
    }
    if (!RASTER.has(ext)) continue;

    const meta = await sharp(input).metadata();
    const width = Math.min(meta.width, MAX_WIDTH);
    const height = Math.round((meta.height * width) / meta.width);
    const fallbackExt = ext === '.png' ? 'png' : 'jpg';
    // Honor orientation, cap width; metadata is dropped.
    const base = sharp(input).rotate().resize({ width, withoutEnlargement: true });

    await Promise.all([
      base.clone().avif({ quality: 55, effort: 6 }).toFile(path.join(outDir, `${name}.avif`)),
      base.clone().webp({ quality: 80 }).toFile(path.join(outDir, `${name}.webp`)),
      fallbackExt === 'png'
        ? // Large PNG fallbacks (renders) are quantized; small ones (the logo) stay lossless.
          base.clone().png({ compressionLevel: 9, palette: width > 400, quality: 90, dither: 0.8 }).toFile(path.join(outDir, `${name}.png`))
        : base.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, `${name}.jpg`)),
    ]);

    manifest[name] = {
      avif: `${publicPrefix}/${name}.avif`,
      webp: `${publicPrefix}/${name}.webp`,
      fallback: `${publicPrefix}/${name}.${fallbackExt}`,
      width,
      height,
    };

    // Wide images also get a small variant; the picture partial offers both via srcset so
    // phones download the small one.
    if (width > SMALL_WIDTH * 1.25) {
      const small = sharp(input).rotate().resize({ width: SMALL_WIDTH });
      await Promise.all([
        small.clone().avif({ quality: 55, effort: 6 }).toFile(path.join(outDir, `${name}-${SMALL_WIDTH}.avif`)),
        small.clone().webp({ quality: 80 }).toFile(path.join(outDir, `${name}-${SMALL_WIDTH}.webp`)),
      ]);
      manifest[name].srcsetAvif = `${publicPrefix}/${name}-${SMALL_WIDTH}.avif ${SMALL_WIDTH}w, ${publicPrefix}/${name}.avif ${width}w`;
      manifest[name].srcsetWebp = `${publicPrefix}/${name}-${SMALL_WIDTH}.webp ${SMALL_WIDTH}w, ${publicPrefix}/${name}.webp ${width}w`;
    }
  }
  return manifest;
}

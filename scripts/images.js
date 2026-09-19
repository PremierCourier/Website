// Image pipeline: src/assets/img/src/* → dist/assets/img/
// Raster sources get AVIF + WebP + a fallback in their own format. sharp drops all
// metadata (EXIF, XMP, IPTC) unless told to keep it, and we never tell it to.
// SVGs are copied as-is. Returns a manifest keyed by file basename.

import { readdir, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RASTER = new Set(['.png', '.jpg', '.jpeg']);

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

    const { width, height } = await sharp(input).metadata();
    const fallbackExt = ext === '.png' ? 'png' : 'jpg';
    const base = sharp(input).rotate(); // honor orientation, then metadata is dropped

    await Promise.all([
      base.clone().avif({ quality: 55, effort: 6 }).toFile(path.join(outDir, `${name}.avif`)),
      base.clone().webp({ quality: 80 }).toFile(path.join(outDir, `${name}.webp`)),
      fallbackExt === 'png'
        ? base.clone().png({ compressionLevel: 9, palette: false }).toFile(path.join(outDir, `${name}.png`))
        : base.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, `${name}.jpg`)),
    ]);

    manifest[name] = {
      avif: `${publicPrefix}/${name}.avif`,
      webp: `${publicPrefix}/${name}.webp`,
      fallback: `${publicPrefix}/${name}.${fallbackExt}`,
      width,
      height,
    };
  }
  return manifest;
}

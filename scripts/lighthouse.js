// Lighthouse against a local build of dist/. Fails under
// Performance 95 / SEO 100 / Accessibility 95 / Best Practices 95.
//
//   node scripts/lighthouse.js            mobile (the deploy gate)
//   node scripts/lighthouse.js desktop    desktop preset
//   node scripts/lighthouse.js both       both, in turn
// Reports the bytes each page pulled, and the hero frame bytes among them.

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import * as chromeLauncher from 'chrome-launcher';
import { build } from './build.js';
import { serve } from './lib/serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4399;
const MIN = { performance: 95, seo: 100, accessibility: 95, 'best-practices': 95 };

const arg = (process.argv[2] || 'mobile').toLowerCase();
const presets = arg === 'both' ? ['mobile', 'desktop'] : [arg];
const { pages } = await build('local');
const server = await serve(path.join(ROOT, 'dist'), PORT);
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
const outDir = path.join(ROOT, '.lighthouse');
await mkdir(outDir, { recursive: true });

let failed = false;
try {
 for (const preset of presets) {
  let totalBytes = 0;
  let frameBytes = 0;
  console.log(`
— ${preset} —`);
  for (const { route } of pages) {
    const url = `http://localhost:${PORT}${route}`;
    const flags = { port: chrome.port, output: 'html', logLevel: 'error' };
    const result = preset === 'desktop'
      ? await lighthouse(url, flags, desktopConfig)
      : await lighthouse(url, flags);
    const items = result.lhr.audits['network-requests']?.details?.items || [];
    const bytes = items.reduce((s, i) => s + (i.transferSize || 0), 0);
    const frames = items.filter((i) => i.url.includes('/assets/sequence/')).reduce((s, i) => s + (i.transferSize || 0), 0);
    totalBytes += bytes;
    frameBytes += frames;
    const scores = Object.fromEntries(
      Object.keys(MIN).map((k) => [k, Math.round((result.lhr.categories[k]?.score ?? 0) * 100)]),
    );
    const bad = Object.entries(MIN).filter(([k, min]) => scores[k] < min);
    const lcp = result.lhr.audits['largest-contentful-paint'].displayValue;
    console.log(
      `${bad.length ? 'FAIL' : 'ok  '}  ${route.padEnd(12)} perf ${scores.performance}  a11y ${scores.accessibility}  bp ${scores['best-practices']}  seo ${scores.seo}  LCP ${lcp}  ${(bytes / 1024).toFixed(0)} KB`,
    );
    if (bad.length) failed = true;
    const name = (route === '/' ? 'home' : route.replace(/\W+/g, '-').replace(/^-|-$/g, '')) + (preset === 'desktop' ? '-desktop' : '');
    await writeFile(path.join(outDir, `${name}.html`), result.report);
  }
  console.log(`${preset}: ${(totalBytes / 1024).toFixed(0)} KB fetched across ${pages.length} pages, of which ${(frameBytes / 1024).toFixed(0)} KB hero frames`);
 }
} finally {
  // On Windows, chrome-launcher can fail to delete its temp profile while Chrome exits.
  try {
    chrome.kill();
  } catch {}
  server.close();
}
if (failed) {
  console.error('\nLighthouse thresholds not met. Reports in .lighthouse/');
  process.exit(1);
}

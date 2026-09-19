// Lighthouse (mobile) against a local build of dist/. Fails under
// Performance 95 / SEO 100 / Accessibility 95 / Best Practices 95.

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { build } from './build.js';
import { serve } from './lib/serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4399;
const MIN = { performance: 95, seo: 100, accessibility: 95, 'best-practices': 95 };

const { pages } = await build('local');
const server = await serve(path.join(ROOT, 'dist'), PORT);
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
const outDir = path.join(ROOT, '.lighthouse');
await mkdir(outDir, { recursive: true });

let failed = false;
try {
  for (const { route } of pages) {
    const url = `http://localhost:${PORT}${route}`;
    const result = await lighthouse(url, { port: chrome.port, output: 'html', logLevel: 'error' });
    const scores = Object.fromEntries(
      Object.keys(MIN).map((k) => [k, Math.round((result.lhr.categories[k]?.score ?? 0) * 100)]),
    );
    const bad = Object.entries(MIN).filter(([k, min]) => scores[k] < min);
    const lcp = result.lhr.audits['largest-contentful-paint'].displayValue;
    console.log(
      `${bad.length ? 'FAIL' : 'ok  '}  ${route.padEnd(12)} perf ${scores.performance}  a11y ${scores.accessibility}  bp ${scores['best-practices']}  seo ${scores.seo}  LCP ${lcp}`,
    );
    if (bad.length) failed = true;
    const name = route === '/' ? 'home' : route.replace(/\W+/g, '-').replace(/^-|-$/g, '');
    await writeFile(path.join(outDir, `${name}.html`), result.report);
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

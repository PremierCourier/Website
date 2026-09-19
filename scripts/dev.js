// Build, serve dist/ on :4321, rebuild on changes to src/ or content/.

import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.js';
import { serve } from './lib/serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4321;

async function rebuild() {
  const t = Date.now();
  try {
    await build('local');
    console.log(`built in ${Date.now() - t} ms`);
  } catch (e) {
    console.error(`build failed: ${e.message}`);
  }
}

await rebuild();
await serve(path.join(ROOT, 'dist'), PORT);
console.log(`http://localhost:${PORT}/`);

let timer;
for (const dir of ['src', 'content']) {
  watch(path.join(ROOT, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 120);
  });
}

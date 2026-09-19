// Build, serve dist/ on :4321, rebuild on changes to src/ or content/.

import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.js';
import { serve } from './lib/serve.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4321;

// One build at a time. Changes during a build queue exactly one follow-up build, so two
// builds never clear and write dist/ at the same time.
let building = false;
let pending = false;

async function rebuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  do {
    pending = false;
    const t = Date.now();
    try {
      await build('local');
      console.log(`built in ${Date.now() - t} ms`);
    } catch (e) {
      console.error(`build failed: ${e.message}`);
    }
  } while (pending);
  building = false;
}

await rebuild();
await serve(path.join(ROOT, 'dist'), PORT);
console.log(`http://localhost:${PORT}/`);

let timer;
for (const dir of ['src', 'content']) {
  watch(path.join(ROOT, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 250);
  });
}

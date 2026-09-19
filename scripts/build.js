// Builds dist/ from content/*.json + src/.
//
// BUILD_TARGET:
//   local      (default) base path "", indexable, no CNAME — dev + lighthouse
//   staging    base path "/pcaz-website-staging", noindex everywhere, no CNAME
//   production base path "", indexable, writes CNAME, refuses unless every page is approved

import { readFile, writeFile, readdir, mkdir, rm, copyFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRenderer } from './lib/template.js';
import sharp from 'sharp';
import { processImages } from './images.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const CONTENT = path.join(ROOT, 'content');

const TARGETS = {
  local: { base: '', noindex: false, cname: false, requireApproved: false },
  staging: { base: '/pcaz-website-staging', noindex: true, cname: false, requireApproved: false },
  production: { base: '', noindex: false, cname: true, requireApproved: true },
};

const FONTS = [400, 500, 700, 800].map((w) => `inter-latin-${w}-normal.woff2`);
const REQUIRED_PAGE_FIELDS = ['route', 'template', 'status', 'title', 'description'];

// Favicon: the P mark alone. It is the first run of opaque columns in the logo; the
// crop stops at the transparent gap before the wordmark.
async function makeFavicon(logo, out) {
  if (!existsSync(logo)) return;
  const { data, info } = await sharp(logo).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const colOpaque = (x) => {
    for (let y = 0; y < info.height; y++) if (data[y * info.width + x] > 40) return true;
    return false;
  };
  let x = 0;
  while (x < info.width && !colOpaque(x)) x++;
  while (x < info.width && colOpaque(x)) x++;
  // Two pipelines: sharp's trim() in the same pipeline as extract() sees the uncropped size.
  const mark = await sharp(logo)
    .extract({ left: 0, top: 0, width: Math.min(x + 2, info.width), height: info.height })
    .png()
    .toBuffer();
  await sharp(mark)
    .trim({ threshold: 10 })
    .resize(64, 64, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(out);
}

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function loadDir(dir, ext) {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of await readdir(dir)) {
    if (f.endsWith(ext)) out[path.basename(f, ext)] = await readFile(path.join(dir, f), 'utf8');
  }
  return out;
}

function outputPath(route) {
  if (route.endsWith('.html')) return path.join(DIST, route);
  return path.join(DIST, route, 'index.html');
}

async function buildCss(base) {
  const parts = await Promise.all(
    ['tokens.css', 'base.css', 'components.css'].map((f) => readFile(path.join(SRC, 'assets/css', f), 'utf8')),
  );
  return parts
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\(\//g, `url(${base}/`)
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export async function build(targetName = process.env.BUILD_TARGET || 'local') {
  const target = TARGETS[targetName];
  if (!target) throw new Error(`Unknown BUILD_TARGET "${targetName}"`);
  const { base } = target;

  // Content
  const shared = await readJson(path.join(CONTENT, 'shared.json'));
  const pages = [];
  for (const f of (await readdir(CONTENT)).filter((f) => f.endsWith('.json') && f !== 'shared.json')) {
    const page = await readJson(path.join(CONTENT, f));
    for (const k of REQUIRED_PAGE_FIELDS) {
      if (!page[k]) throw new Error(`content/${f}: missing "${k}"`);
    }
    if (!['proposed', 'approved'].includes(page.status)) {
      throw new Error(`content/${f}: status must be "proposed" or "approved"`);
    }
    pages.push({ ...page, file: f });
  }

  const routes = new Map();
  for (const p of pages) {
    if (routes.has(p.route)) throw new Error(`Duplicate route ${p.route} (${routes.get(p.route)}, ${p.file})`);
    routes.set(p.route, p.file);
  }

  if (target.requireApproved) {
    const pending = pages.filter((p) => p.status !== 'approved');
    if (pending.length) {
      throw new Error(
        `Production build refused — not approved by Alanna:\n${pending.map((p) => `  ${p.route} (content/${p.file})`).join('\n')}`,
      );
    }
  }

  // Links only render when their page exists, so nav never points at a missing route.
  const exists = (route) => routes.has(route.split('#')[0] || '/');
  const links = (list) => list.filter((l) => exists(l.route));

  // Output
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const img = await processImages(path.join(SRC, 'assets/img/src'), path.join(DIST, 'assets/img'), `${base}/assets/img`);
  // Alt text lives in content, never in the pipeline. `.belowFold` is the lazy-loaded variant.
  for (const [name, entry] of Object.entries(img)) {
    if (shared.imageAlt?.[name] !== undefined) entry.alt = shared.imageAlt[name];
    entry.lazy = false;
    entry.belowFold = { ...entry, lazy: true };
  }
  await makeFavicon(path.join(SRC, 'assets/img/src/logo.png'), path.join(DIST, 'assets/img/favicon.png'));
  for (const f of await readdir(path.join(SRC, 'assets/img'))) {
    if (f.endsWith('.svg')) {
      const name = path.basename(f, '.svg');
      await copyFile(path.join(SRC, 'assets/img', f), path.join(DIST, 'assets/img', f));
      img[name] = { svg: `${base}/assets/img/${f}` };
    }
  }

  await mkdir(path.join(DIST, 'assets/fonts'), { recursive: true });
  for (const f of FONTS) {
    await copyFile(path.join(ROOT, 'node_modules/@fontsource/inter/files', f), path.join(DIST, 'assets/fonts', f));
  }
  await cp(path.join(SRC, 'assets/js'), path.join(DIST, 'assets/js'), { recursive: true });
  // Turntable frames are final web files (npm run stills); copied as-is.
  const turntable = path.join(SRC, 'assets/turntable');
  const turntableFrames = existsSync(turntable) ? (await readdir(path.join(turntable, '720'))).length : 0;
  if (turntableFrames) await cp(turntable, path.join(DIST, 'assets/turntable'), { recursive: true });

  const css = await buildCss(base);
  const layout = await readFile(path.join(SRC, 'layouts/base.html'), 'utf8');
  const templates = await loadDir(path.join(SRC, 'pages'), '.html');
  const render = createRenderer(await loadDir(path.join(SRC, 'partials'), '.html'));

  const schemaJson = JSON.stringify(shared.schema).replace(/</g, '\\u003c');
  const year = new Date().getFullYear();

  for (const page of pages) {
    const tpl = templates[page.template];
    if (tpl === undefined) throw new Error(`content/${page.file}: no template src/pages/${page.template}.html`);
    const ctx = {
      ...shared,
      page,
      img,
      base,
      year,
      css,
      schemaJson,
      turntableFrames,
      noindex: target.noindex,
      canonical: shared.site.url + (page.route === '/404.html' ? '/' : page.route),
      fullTitle: `${page.title} ${shared.site.titleSuffix}`,
      nav: links(shared.nav),
      footerServices: links(shared.footer.services),
      footerAreas: links(shared.footer.areas),
      footerCompany: links(shared.footer.company),
      exists: Object.fromEntries([...routes.keys()].map((r) => [r, true])),
    };
    ctx.body = render(tpl, ctx, `pages/${page.template}`);
    const html = render(layout, ctx, 'layouts/base');
    const out = outputPath(page.route);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, html);
  }

  // Root files
  const indexable = pages.filter((p) => p.route !== '/404.html');
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    indexable.map((p) => `  <url><loc>${shared.site.url}${p.route}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap);
  await writeFile(
    path.join(DIST, 'robots.txt'),
    target.noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${shared.site.url}/sitemap.xml\n`,
  );
  await copyFile(path.join(CONTENT, 'llms.txt'), path.join(DIST, 'llms.txt'));
  if (target.cname) await writeFile(path.join(DIST, 'CNAME'), new URL(shared.site.url).host + '\n');
  await writeFile(path.join(DIST, '.nojekyll'), '');
  // Read by audit.js; lives outside dist/ so it never deploys.
  await writeFile(path.join(ROOT, '.build-info.json'), JSON.stringify({ target: targetName, base }, null, 2));

  return { target: targetName, pages: pages.map((p) => ({ route: p.route, status: p.status })) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  build()
    .then((r) => {
      const proposed = r.pages.filter((p) => p.status !== 'approved').length;
      console.log(`Built ${r.pages.length} pages for ${r.target} → dist/ (${proposed} proposed, ${r.pages.length - proposed} approved)`);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}

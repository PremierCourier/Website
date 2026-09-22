// Audits dist/ before any deploy. Exits 1 on any failure.
// Matching rules for forbidden strings: docs/content-rules.md → Forbidden strings.

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const TEXT_EXT = new Set(['.html', '.txt', '.xml', '.json', '.css', '.js']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const ALLOWLIST = ['womack'];
const PAGE_WEIGHT_LIMIT = 450 * 1024; // excluding hero stills
const SOURCE_IMAGE_LIMIT = 4 * 1024 * 1024;
const NO_EXCLAMATION_PAGES = new Set(['service', 'how-we-handle']);
const RESTRICTED = [
  'logistics solutions', 'last-mile', 'seamless', 'cutting-edge', 'state-of-the-art',
  'leverage', 'game changer', 'disrupt', 'synergy', 'packages',
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

export async function loadForbidden() {
  const md = await readFile(path.join(ROOT, 'docs/content-rules.md'), 'utf8');
  const section = md.split(/^## Forbidden strings/m)[1];
  if (!section) throw new Error('docs/content-rules.md: no "## Forbidden strings" section');
  const block = section.match(/```\r?\n([\s\S]*?)```/);
  if (!block) throw new Error('docs/content-rules.md: no code block under Forbidden strings');
  return block[1].split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const wordRe = (term) => new RegExp(`(?<![a-z0-9])${escapeRe(term)}(?![a-z0-9])`, 'i');

export function stripAllowlisted(text) {
  return ALLOWLIST.reduce((t, w) => t.replace(new RegExp(escapeRe(w), 'gi'), ' '), text);
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

// Visible text + human-readable attributes (meta content, alt, title, aria-label).
export function readableText(html, { dropVerbatim = false } = {}) {
  let h = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  if (dropVerbatim) h = h.replace(/<figure[^>]*\sdata-verbatim[^>]*>[\s\S]*?<\/figure>/gi, ' ');
  const attrs = [...h.matchAll(/<meta\b[^>]*\scontent="([^"]*)"/gi), ...h.matchAll(/\s(?:alt|title|aria-label)="([^"]*)"/gi)]
    .map((m) => m[1]);
  const text = h.replace(/<[^>]+>/g, ' ');
  return decodeEntities([text, ...attrs].join(' '));
}

const attrValues = (html, tag, attr) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*\\s${attr}="([^"]*)"`, 'gi'))].map((m) => m[1]);

export async function audit() {
  const failures = [];
  const warnings = [];
  const fail = (file, msg) => failures.push(`${file}: ${msg}`);
  const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

  if (!existsSync(DIST)) throw new Error('dist/ does not exist — run npm run build first');
  const info = existsSync(path.join(ROOT, '.build-info.json'))
    ? JSON.parse(await readFile(path.join(ROOT, '.build-info.json'), 'utf8'))
    : { target: 'local', base: '' };

  const forbidden = await loadForbidden();
  const hashOne = forbidden.includes('#1');
  const anywhere = forbidden.filter((t) => t !== '#1');
  const files = await walk(DIST);
  const rel = (f) => path.relative(DIST, f).split(path.sep).join('/');

  const pages = new Map(); // dist-relative path → html
  for (const file of files) {
    const r = rel(file);
    const ext = path.extname(file).toLowerCase();

    for (const term of anywhere) if (wordRe(term).test(stripAllowlisted(r))) fail(r, `file name contains forbidden "${term}"`);

    if (TEXT_EXT.has(ext)) {
      const content = await readFile(file, 'utf8');
      const clean = stripAllowlisted(content);
      for (const term of anywhere) if (wordRe(term).test(clean)) fail(r, `forbidden "${term}"`);
      if (ext === '.html') pages.set(r, content);
    }

    if (IMAGE_EXT.has(ext)) {
      const meta = await sharp(file).metadata();
      if (meta.exif || meta.xmp || meta.iptc || meta.comments?.length) fail(r, 'image carries metadata (EXIF/XMP/IPTC/text chunks)');
    }
  }

  // Committed originals: no metadata, ≤4 MB.
  const srcImg = path.join(ROOT, 'src/assets/img/src');
  if (existsSync(srcImg)) {
    for (const file of await walk(srcImg)) {
      const r = path.relative(ROOT, file).split(path.sep).join('/');
      if (!IMAGE_EXT.has(path.extname(file).toLowerCase())) continue;
      if ((await stat(file)).size > SOURCE_IMAGE_LIMIT) fail(r, 'source image larger than 4 MB');
      const meta = await sharp(file).metadata();
      if (meta.exif || meta.xmp || meta.iptc || meta.comments?.length) fail(r, 'source image carries metadata — strip before committing (npm run stills does this for renders)');
    }
  }

  // Colors and fonts are defined only in tokens.css.
  for (const f of ['base.css', 'components.css']) {
    const css = (await readFile(path.join(ROOT, 'src/assets/css', f), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    const color = css.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i);
    if (color) fail(`src/assets/css/${f}`, `defines a color (${color[0]}) — colors live in tokens.css only`);
    if (/@font-face/i.test(css)) fail(`src/assets/css/${f}`, '@font-face outside tokens.css');
  }

  const titles = new Map();
  const descriptions = new Map();
  const assetSize = new Map();
  const sizeOf = async (p) => {
    if (!assetSize.has(p)) assetSize.set(p, existsSync(p) ? (await stat(p)).size : 0);
    return assetSize.get(p);
  };
  const fonts = files.filter((f) => f.endsWith('.woff2'));

  const toDistPath = (url) => {
    let p = url.split('#')[0].split('?')[0];
    if (info.base && p.startsWith(info.base)) p = p.slice(info.base.length) || '/';
    p = decodeURIComponent(p);
    let full = path.join(DIST, p);
    if (p.endsWith('/')) full = path.join(full, 'index.html');
    return full;
  };

  for (const [r, html] of pages) {
    // #1 only in readable text (never CSS/JS, where it is a hex color).
    const readable = stripAllowlisted(readableText(html));
    if (hashOne && wordRe('#1').test(readable)) fail(r, 'forbidden "#1" in page text');

    // Exclamation points: our copy only; verbatim testimonials are exempt.
    const ours = readableText(html, { dropVerbatim: true });
    const bangs = (ours.match(/!/g) || []).length;
    const type = (html.match(/<body[^>]*data-page-type="([^"]+)"/) || [])[1];
    const limit = NO_EXCLAMATION_PAGES.has(type) ? 0 : 1;
    if (bangs > limit) fail(r, `${bangs} exclamation points in our copy (limit ${limit})`);
    for (const term of RESTRICTED) if (wordRe(term).test(ours)) warn(r, `restricted language "${term}" in our copy`);

    // Meta
    if (!/<html[^>]*\slang="en"/.test(html)) fail(r, 'missing <html lang="en">');
    if (!/<meta name="viewport"/.test(html)) fail(r, 'missing viewport meta');
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]?.trim();
    if (!title) fail(r, 'missing <title>');
    else if (titles.has(title)) fail(r, `duplicate <title> (also ${titles.get(title)})`);
    else titles.set(title, r);
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1]?.trim();
    if (!desc) fail(r, 'missing meta description');
    else if (descriptions.has(desc)) fail(r, `duplicate meta description (also ${descriptions.get(desc)})`);
    else descriptions.set(desc, r);
    if (!/<link rel="canonical" href="https:\/\/[^"]+"/.test(html)) fail(r, 'missing canonical');

    const noindex = /<meta name="robots" content="noindex/.test(html);
    if (info.target === 'preview' && !noindex) fail(r, 'preview page is indexable');
    if (info.target === 'production' && noindex) fail(r, 'production page is noindex');

    // JSON-LD
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (ld.length !== 1) fail(r, `expected one JSON-LD block, found ${ld.length}`);
    for (const [, json] of ld) {
      let s;
      try {
        s = JSON.parse(json);
      } catch {
        fail(r, 'JSON-LD does not parse');
        continue;
      }
      if (s['@type'] !== 'LocalBusiness') fail(r, 'JSON-LD @type is not LocalBusiness');
      for (const k of ['name', 'telephone', 'email', 'openingHoursSpecification', 'areaServed', 'address']) {
        if (!s[k]) fail(r, `JSON-LD missing ${k}`);
      }
      if (s.areaServed?.length !== 5) fail(r, 'JSON-LD areaServed must list the five counties');
      if (s.address?.addressLocality !== 'Prescott' || s.address?.postalCode !== '86304') fail(r, 'JSON-LD address must be Prescott 86304');
      if (s.address?.streetAddress) fail(r, 'JSON-LD must not carry a streetAddress');
      if (s.foundingDate !== '1999') fail(r, 'JSON-LD foundingDate must be the confirmed "1999"');
      if (s.aggregateRating) fail(r, 'JSON-LD must not carry aggregateRating');
    }

    // Images need alt text (aria-hidden images excepted).
    for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
      if (/aria-hidden="true"/.test(tag)) continue;
      const alt = (tag.match(/\salt="([^"]*)"/) || [])[1];
      if (!alt || !alt.trim()) fail(r, `image without alt text: ${tag.slice(0, 80)}`);
      if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) fail(r, `image without width/height: ${tag.slice(0, 80)}`);
    }

    // Internal links and assets resolve.
    const urls = [
      ...attrValues(html, 'a', 'href'),
      ...attrValues(html, 'link', 'href'),
      ...attrValues(html, 'script', 'src'),
      ...attrValues(html, 'img', 'src'),
      ...attrValues(html, 'source', 'srcset').flatMap((s) => s.split(',').map((c) => c.trim().split(/\s+/)[0])),
    ].filter((u) => u.startsWith('/') && !u.startsWith('//'));
    for (const url of urls) {
      const target = toDistPath(url);
      if (!existsSync(target)) {
        fail(r, `broken internal link ${url}`);
        continue;
      }
      const hash = url.split('#')[1];
      if (hash && target.endsWith('.html')) {
        const targetHtml = pages.get(rel(target)) ?? (await readFile(target, 'utf8'));
        if (!targetHtml.includes(`id="${hash}"`)) fail(r, `broken anchor ${url}`);
      }
    }

    // Page weight: HTML + scripts + first image source per <picture> + fonts. Hero stills excluded.
    let weight = Buffer.byteLength(html);
    for (const src of attrValues(html, 'script', 'src')) weight += await sizeOf(toDistPath(src));
    for (const [pic] of html.matchAll(/<picture>[\s\S]*?<\/picture>/g)) {
      if (/data-hero-still/.test(pic)) continue;
      const first = (pic.match(/srcset="([^"\s]+)/) || [])[1];
      if (first) weight += await sizeOf(toDistPath(first));
    }
    for (const src of attrValues(html, 'img', 'src').filter((s) => s.endsWith('.svg'))) weight += await sizeOf(toDistPath(src));
    for (const f of fonts) weight += await sizeOf(f);
    if (weight > PAGE_WEIGHT_LIMIT) fail(r, `page weight ${(weight / 1024).toFixed(0)} KB exceeds 450 KB`);
  }

  // Root files per target.
  const hasCname = existsSync(path.join(DIST, 'CNAME'));
  if (info.target === 'production' && !hasCname) fail('CNAME', 'production build has no CNAME');
  if (info.target !== 'production' && hasCname) fail('CNAME', `${info.target} build must not write CNAME`);
  for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt', '404.html']) if (!existsSync(path.join(DIST, f))) fail(f, 'missing');

  return { failures, warnings, pages: pages.size, target: info.target };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  audit()
    .then(({ failures, warnings, pages, target }) => {
      for (const w of warnings) console.warn(`warn  ${w}`);
      for (const f of failures) console.error(`FAIL  ${f}`);
      if (failures.length) {
        console.error(`\nAudit failed: ${failures.length} problem(s) across ${pages} pages (${target} build).`);
        process.exit(1);
      }
      console.log(`Audit passed: ${pages} pages, ${target} build${warnings.length ? `, ${warnings.length} warning(s)` : ''}.`);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}

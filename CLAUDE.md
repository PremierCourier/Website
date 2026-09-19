# CLAUDE.md — pcaz-website

Marketing website for Premier Courier Services, LLC (Prescott, Arizona). Static HTML built by a Node script, deployed to GitHub Pages at https://www.premiercourieraz.com. Replaces the current Squarespace site.

Read this file fully before writing code. `@docs/brand-guide-internal.md` and `@docs/content-rules.md` load with it and are binding.

## Non-negotiables

1. **No traceable authorship.** Nothing in the deployed artifact, commit history, file metadata, comments, package.json, or image EXIF may reference Hemang, True Lean Solutions, TLS, TechTranspire, Akhani LLC, Mack, or Meera. Git identity for this repo: `Premier Courier <support@premiercourieraz.com>`. Strip EXIF from every image at build time. Check `dist/` for these strings before every deploy (`npm run audit`).
2. **No vendor or software references.** Asinpa, Odoo, GPS tracking, the custom app, and any dispute are never mentioned in code, content, comments, or commits.
3. **Privacy.** No client, facility, department, or patient is ever named. No image of a labeled specimen, requisition, manifest, or signature log. No photo at a customer site. Reviews appear exactly as the customer published them.
4. **Claims.** Only facts in `docs/content-rules.md` → Approved Facts. Never: "#1", "best", on-time percentages, guarantees, "real-time tracking", "HIPAA certified", "HIPAA-trained" (use "HIPAA-compliant handling"), a founding year (unconfirmed — leave out).
5. **Real people only.** Photos of Alanna and drivers are real photographs. AI may edit a real photo (retouch, background cleanup, crop extension, resize, color match); it may never generate a person or place anyone somewhere they weren't photographed. Until the photoshoot exists, use only the images already published on the current site, or no people at all.
6. **Nothing ships without Alanna's approval.** Deploy to the `staging` branch (Pages preview) for review; `main` deploys only after written approval.

## Stack

- Node 20+, no framework. Plain HTML templates + CSS + minimal vanilla JS (nav toggle, form submit). No React, no Tailwind, no client-side routing, no animation libraries.
- Build: `scripts/build.js` — renders `src/pages/*.html` through `src/layouts/base.html`, injects `content/*.json`, copies `src/assets/`, optimizes images (`sharp`), strips EXIF, emits `sitemap.xml`, `robots.txt`, `llms.txt`, `404.html`, `CNAME`.
- Page status: every page's content JSON carries `"status": "proposed"` or `"status": "approved"`. `npm run build` builds every page; the production deploy refuses to publish if any page is not `approved`. Staging publishes proposed pages so Alanna can review them.
- Output: `dist/`. Committed by CI only.
- Quote form backend: Azure Function app `pcaz-quote` (`functions/quote/`, Node), fronted by the custom domain `quote.premiercourieraz.com` (CNAME at Squarespace) so the `azurewebsites.net` hostname never appears in page source. It sends email to alanna@premiercourieraz.com and SMS via Twilio to Alanna's mobile. Secrets in Function App settings only; never in this repo.
- Hosting: GitHub org `premiercourier-az` (owned by support@premiercourieraz.com, GitHub Team plan). Both repos are private.
  - Production: repo `pcaz-website`, Pages from its `gh-pages` branch. DNS stays at Squarespace (A records → GitHub Pages IPs, `www` CNAME → `premiercourier-az.github.io`). HTTPS enforced.
  - Staging: repo `pcaz-website-staging`, Pages on, no custom domain, no `CNAME` file.
- `CNAME` is written only by the production build. Staging builds never emit it.
- `.gitattributes` marks `CLAUDE.md` and `docs/` `export-ignore`, so they never land in a zip export.

## Commands

```
npm install
npm run dev        # build + local server on :4321 with watch
npm run build      # clean build to dist/
npm run audit      # fails on forbidden strings, missing alt text, EXIF, broken internal links, missing meta
                   # (matching rules: docs/content-rules.md → Forbidden strings)
npm run lighthouse # runs against dist/; fails under Performance 95 / SEO 100 / Accessibility 95 on mobile
npm run deploy:staging
npm run deploy     # requires APPROVED=1 env var; refuses otherwise
```

## Repository layout

```
content/          copy as JSON, one file per page + shared.json (phone, email, hours, counties)
src/layouts/      base.html (header, fixed phone element, mobile bottom bar, footer, schema)
src/pages/        one template per route (see Pages)
src/partials/     cta-bar, service-card, area-list, testimonial, how-we-handle
src/assets/css/   tokens.css, base.css, components.css — tokens.css is the only place colors/fonts are defined
src/assets/img/   originals in img/src/, never committed larger than 4 MB, never with EXIF
src/assets/js/    nav.js, quote-form.js
scripts/          build.js, audit.js, images.js
functions/quote/  Azure Function (separate deploy; see functions/quote/README.md)
docs/             brand-guide-internal.md, content-rules.md, dns-cutover.md
```

## Pages (routes)

| Route | Template | Purpose |
|---|---|---|
| `/` | home | Positioning line, phone, who we serve grid, coverage, testimonials, CTA |
| `/services/specimen-and-lab-transport/` | service | Specimens, blood products, platelets, lab pickups |
| `/services/hospital-or-and-sterile-processing/` | service | Surgical trays, sterilized instruments, urgent supply runs |
| `/services/pharmacy-delivery/` | service | Time-sensitive medications, discreet delivery |
| `/services/clinic-and-dental-delivery/` | service | Specimens, records, supplies, impressions, lab work |
| `/services/legal-and-financial-documents/` | service | Same-day, confidential (signature on delivery pending Alanna's confirmation) |
| `/areas/prescott/` `/areas/flagstaff/` `/areas/phoenix/` `/areas/tucson/` `/areas/kingman/` | area | County + towns served, same service list, local CTA |
| `/how-we-handle-it/` | page | HIPAA-compliant handling, every item treated with care, owner reachable 24/7. Chain of custody, signature on delivery, and temperature-appropriate transport wait for Alanna's confirmation (see content-rules.md) |
| `/about/` | about | Origin story (approved text only), Alanna in first person, drivers |
| `/quote/` | quote | Short form: pickup, drop-off, what, when, name, phone. Posts to Function |
| `/contact/` | contact | Phone, email, hours, mailing address |
| `/404.html` | 404 | Phone number and link home |

Every page: fixed phone element in header (desktop) and bottom bar with "(928) 533-3585 · Available 24/7" (mobile ≤768px). Medical services always listed before business services.

## Design direction

Reference feel: superpower.com (Daybreak Studio) — white canvas, one type family at heavy weights, large left-aligned headlines in a centered column, full-bleed photography, one accent, generous space, no UI gradients, a 3D hero object, scroll-driven reveals, and dark bands that break the page. All of it is in scope, built the way Daybreak shipped it (CSS-first, WebGL only where it earns it), never the way they prototyped it.

- Type: Inter only (self-hosted woff2, weights 400/500/700/800). Headlines 700–800, tight leading, up to 72px on desktop. Body 400 at 17–18px. No serif on the web.
- Color (tokens.css): `--pc-primary #178EC7`, `--pc-deep #0A5A96`, `--pc-navy #0B3556`, `--pc-sky #6BADDF`, `--pc-steel #608CBE`, `--pc-copper #C0632B`, `--pc-bg #FFFFFF`, `--pc-bg-alt #F3F7FB`, `--pc-text #0B3556`, `--pc-text-2 #5A6B7C`, `--pc-border #D9E3EC`.
- Blue carries the brand: nav, footer, headings, links, service cards. Copper is used for exactly one element per page — the Call Now / 24-7 cue. Never as a general accent, never for text.
- Dark bands: Navy Ink `#0B3556` background with white type, used for the how-we-handle-it section on home and the coverage section. Maximum two dark bands per page. Copper still limited to one element.
- Photography: golden-hour Arizona light, full-bleed, real people and real vehicles from the shoot. Before the shoot: the 3D hero object on white, no stock.

### 3D

- Subjects are Premier Courier's own objects, nothing generic: (1) the sealed blue transport cooler with the P mark — home hero, lit on white, slow turn; (2) a relief map of the five counties in the brand blues with route lines — coverage band on home and area pages. No people, no vehicles, no abstract "tech" geometry.
- Ship CSS-first: layered PNG/WebP renders with `perspective`, `transform: rotateX/rotateY/translateZ`, and pointer/scroll-driven parallax. This is the default implementation for both subjects.
- WebGL (Three.js, r160+, tree-shaken, ≤250 KB gzipped for lib + scene) only for the home hero cooler, only on desktop ≥1024px, only when `prefers-reduced-motion: no-preference`, loaded after `load` with `requestIdleCallback`. Mobile, tablet, and reduced-motion get a rendered still (AVIF/WebP) in the same layout. The still is also the poster that paints before WebGL initializes, so the hero never flashes empty.
- Renders are produced once in Blender (source `.blend` files in `design/`, not in `src/`), exported as stills and, for the WebGL path, a single glTF ≤2 MB with a 1K baked texture. No runtime asset generation.
- Hero LCP is the headline, not the scene. Headline, phone element, and quote button paint before any 3D asset is requested. Budget: hero scene must not push LCP past 1.8s on mobile 4G or 1.2s on desktop.
- Interaction: gentle idle rotation and pointer parallax only. No click-to-spin, no scroll-jacking, no camera flythroughs.

### Motion

- Scroll reveals via `IntersectionObserver` + CSS transitions: sections fade and translate up 16px over 400–600ms, once, on entry. Headlines may stagger by word (60ms). Nothing delays reading: text is visible at ≥0.6 opacity before the transition starts.
- No scroll-jacking, no horizontal scroll sections, no sticky-pinned storytelling.
- `prefers-reduced-motion: reduce` disables reveals, parallax, and WebGL; everything renders in its final state.
- Layout: centered column, 1040px content max, 680px reading max, 8px radius everywhere, shadow `0 2px 12px rgba(11,53,86,0.08)`, ≥60% white space per viewport outside dark bands.
- Icons: structural only (phone, clock, map pin). Maximum one decorative icon per page; zero preferred.

## Content conventions

- Copy lives in `content/*.json`, never inline in templates. Copy is the approved text from the brand guide; do not paraphrase claims or rewrite testimonials.
- Company voice ("we") on all pages except `/about/` Alanna section (first person).
- Tone: clear, specific, warm, calm. One exclamation point per page maximum in our own copy; none on service pages. Verbatim testimonials are exempt.
- Draft pages start as `status: proposed`. Only Alanna's approval moves a page to `approved`.
- Name: "Premier Courier Services, LLC" in footer, schema, and legal; "Premier Courier" in running copy; page titles end with "| Premier Courier Services, Prescott AZ".
- Service area: Yavapai (Prescott, Prescott Valley, Chino Valley, Sedona, Cottonwood, Jerome), Coconino (Flagstaff), Maricopa (Phoenix, Mesa, Tempe, Scottsdale), Pima (Tucson), Mohave (Kingman). Lead with Central and Northern Arizona.
- Testimonials: four approved (Alex Castaneda, Jacob Konigseder, Suzanne Sullivan, JJ Bullard), verbatim from the current site, with the "Alana" typo corrected to "Alanna" in the Sullivan quote only.

## SEO / technical

- `LocalBusiness` JSON-LD on every page: name, telephone, email, `openingHoursSpecification` 24/7, `areaServed` (five counties), `address` with `addressLocality` Prescott and `postalCode` 86304, no street address.
- Unique `<title>` and `<meta name="description">` per page, set in the page's JSON.
- `llms.txt` at root — content from `content/llms.txt` (already approved).
- Images: `<picture>` with AVIF/WebP/JPEG, explicit width/height, `loading="lazy"` below the fold, alt text required (audit fails without it).
- No third-party scripts. No analytics until Alanna approves a provider; if approved, privacy-respecting only (Plausible or similar), no cookies.
- Target: LCP < 1.8s on mobile 4G, < 1.2s desktop; total page weight < 450 KB excluding hero stills; WebGL bundle loads after `load` and does not count toward LCP.

## Quote form

- Fields: pickup address, drop-off address, what is being sent (select: specimens / trays or instruments / pharmaceuticals / documents / other), when (select: now / today / scheduled + date), name, phone, optional email. Nothing else.
- Client-side: required-field checks only. Honeypot field. No CAPTCHA.
- `/quote/?when=scheduled` pre-selects "scheduled" (target of the "Set Up a Scheduled Route" CTA). Airport retrievals is a home-grid item only, with no service page.
- Posts JSON to the Function URL from `content/shared.json`. Function sends email + SMS, returns 200; page shows "We'll call you shortly" with the phone number. On failure, show the phone number — the form is never the only path.
- Function code, Twilio, and mail credentials live in `functions/quote/` and Azure settings. This site never holds secrets.

## Deploy and DNS

- `staging` branch → workflow builds without `CNAME` and pushes `dist/` to the `pcaz-website-staging` repo's Pages site. Send Alanna the link; she reviews on her phone.
- `main` → `gh-pages` via GitHub Actions on push, only when `APPROVED=1` is set on the workflow dispatch.
- DNS cutover steps and rollback in `docs/dns-cutover.md`. Do not touch Squarespace DNS until `main` is approved and `dist/` passes audit + lighthouse.
- Keep the Squarespace site live and untouched until cutover completes and HTTPS is verified on the custom domain.

## Definition of done (per page)

1. Copy matches `content/` and passes `npm run audit`.
2. Phone element visible without scrolling on desktop and mobile.
3. Lighthouse mobile: Performance ≥95, SEO 100, Accessibility ≥95, Best Practices ≥95.
4. Renders correctly at 360, 768, 1280 px.
5. No forbidden strings, no EXIF, alt text on every image, valid JSON-LD.
6. Reviewed by Alanna on staging before merge to `main`.

## Open items (do not guess — ask)

- Founding year: unconfirmed. Leave out of copy and schema until Alanna confirms.
- Whether drivers receive formal HIPAA training: unconfirmed. Use "HIPAA-compliant handling" only.
- Alanna's mobile number for SMS: set in Azure Function settings by Hemang; never in repo.
- Photoshoot assets: not yet available. Build with the 3D cooler hero and rendered stills; photography lands on service and about pages when delivered.
- Design changes not yet approved by Alanna: Inter-only type (no serif) and the 3D hero. They are presented to her on staging as proposals (brand guide v1.1).
- P mark trace for the cooler decal: needs Alanna's approval. Until then, the cooler uses a flat blue decal placeholder.
- 3D renders: the hero is built now with a flat placeholder so layout and LCP work can proceed; `design/` Blender sources replace it. Cooler design must match the brand guide (blue, P mark, sealed, unlabeled) and is approved by Alanna as a still before any WebGL work starts.

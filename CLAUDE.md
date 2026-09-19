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

- Node 20+, no framework. Plain HTML templates + CSS + minimal vanilla JS (nav toggle, form submit, scroll reveals, hero frame scrub). No React, no Tailwind, no client-side routing, no animation libraries.
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
npm run build      # clean build to dist/ (BUILD_TARGET=local|staging|production; default local)
npm run audit      # fails on forbidden strings, missing alt text, EXIF, broken internal links, missing meta
                   # (matching rules: docs/content-rules.md → Forbidden strings)
npm run lighthouse # runs against dist/; fails under Performance 95 / SEO 100 / Accessibility 95 on mobile
npm run sequence   # publishes the rendered cooler frames from design/ into src/assets/sequence/ (crop, AVIF+WebP, budget check)
npm run stills     # publishes single renders from design/ into src/assets/img/src/ (strips metadata)
npm run deploy:staging
npm run deploy     # requires APPROVED=1 env var; refuses otherwise
                   # deploys need DEPLOY_REMOTE (git URL); CI sets it — see .github/workflows/
```

## Repository layout

```
content/          copy as JSON, one file per page + shared.json (phone, email, hours, counties)
src/layouts/      base.html (header, fixed phone element, mobile bottom bar, footer, schema)
src/pages/        one template per route (see Pages)
src/partials/     cta-bar, service-card, area-list, testimonial, how-we-handle, picture
src/assets/css/   tokens.css, base.css, components.css — tokens.css is the only place colors/fonts are defined
src/assets/img/   originals in img/src/, never committed larger than 4 MB, never with EXIF
src/assets/js/    nav.js, motion.js (reveals), hero.js (frame scrub), quote-form.js
scripts/          build.js, audit.js, images.js, sequence.js, stills.js, dev.js, deploy.js, lighthouse.js, lib/
design/           frame production sources (outside the build; see the 3D section)
functions/quote/  Azure Function (separate deploy; see functions/quote/README.md)
docs/             brand-guide-internal.md, content-rules.md, dns-cutover.md, review-for-alanna.md (her sign-off list)
```

## Pages (routes)

| Route | Template | Purpose |
|---|---|---|
| `/` | home | Positioning line, phone, who we serve grid, coverage, testimonials, CTA |
| `/services/` | services | Overview of all services, medical first; the nav's "Services" link |
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
| `/privacy/` | prose | What the quote form collects, who receives it, no cookies/analytics (facts only; Alanna approves) |
| `/404.html` | 404 | Phone number and link home |

Every page: fixed phone element in header (desktop) and bottom bar with "(928) 533-3585 · Available 24/7" (mobile ≤768px). Medical services always listed before business services.

## Design direction

Reference feel: superpower.com (Daybreak Studio) — white canvas, one type family at heavy weights, large left-aligned headlines in a centered column, full-bleed photography, one accent, generous space, no UI gradients, a 3D hero object, scroll-driven reveals, and dark bands that break the page. All of it is in scope, delivered as scroll-scrubbed frame sequences and CSS — no 3D runtime.

- Type: Inter only (self-hosted woff2, weights 400/500/700/800). Headlines 700–800, tight leading, up to 72px on desktop. Body 400 at 17–18px. No serif on the web.
- Color (tokens.css): `--pc-primary #178EC7`, `--pc-deep #0A5A96`, `--pc-navy #0B3556`, `--pc-sky #6BADDF`, `--pc-steel #608CBE`, `--pc-copper #C0632B`, `--pc-bg #FFFFFF`, `--pc-bg-alt #F3F7FB`, `--pc-text #0B3556`, `--pc-text-2 #5A6B7C`, `--pc-border #D9E3EC`.
- Blue carries the brand: nav, footer, headings, links, service cards. Courier Blue is 3.7:1 on white, so text-sized links, buttons, and eyebrows use Deep Blue; Courier Blue is for large type and non-text accents. Copper is used for exactly one element per page — the Call Now / 24-7 cue. Never as a general accent, never for text.
- Dark bands: Navy Ink `#0B3556` background with white type, used for the how-we-handle-it section on home and the coverage section. Maximum two dark bands per page. Copper still limited to one element.
- Photography: golden-hour Arizona light, full-bleed, real people and real vehicles from the shoot. Before the shoot: the 3D hero object on white, no stock.

### 3D (scroll-scrubbed frame sequences — no 3D runtime)

- Technique: pre-rendered frame sequence drawn to a `<canvas>`, frame index driven by scroll position within the hero (the Apple AirPods pattern). No Three.js, no WebGL, no glTF, no Blender in the build.
- Subjects are Premier Courier's own objects, nothing generic: (1) the sealed blue transport cooler with the P mark — home hero: closed on white at scroll 0, opens into its layers (lid, insulated body, cold packs, and — side by side — a tube rack holding six empty, capped, unlabeled tubes and one sealed plain inner pouch) mid-hero, closes again by the time the phone element is reached; (2) a relief map of the five counties in the brand blues with route lines — coverage band: flat at entry, rises into relief over a short scroll. No people, no vehicles, no abstract "tech" geometry.
- Frame production (in `design/`, outside the build): the layered cooler is modeled and animated in Blender (`design/cooler_sequence.py`) and rendered straight to frames — chosen over AI stills + morph because clean frames compress smaller, never flicker or warp, pace exactly with scroll, and render on a transparent background for a tight crop. The P mark is never generated or redrawn: it is the real mark applied as a texture in every frame. Exploded contents carry no labels, barcodes, forms, or text. Tubes are allowed only empty, capped, and unlabeled — no liquid, no specimen, nothing readable. No syringes or needles. Generated objects are permitted; generated people never are.
- Approval gate: the closed still and the exploded end frame are approved before the sequence is rendered. No cooler-sequence frames enter `src/` until both are approved. Status: both approved 2026-09-19 (relayed by the project lead); the sequence is built and on staging for Alanna's final review.
- Budget (frames cropped tight to the object and sized to its display box × DPR, so decoded memory stays low): desktop ≤72 frames at up to 1440px, AVIF with WebP fallback, total ≤3.5 MB; mobile/tablet ≤24 frames at 720px, total ≤900 KB; frames are fetched after the headline, phone element, and quote button have painted, and only when the hero is in view. First frame is inlined as the poster. `prefers-reduced-motion: reduce` shows the closed-cooler still only.
- Scroll stays native: the page never pins, snaps, or hijacks scroll; frame index is a pure function of scroll offset. Canvas is `aria-hidden`; the headline carries the meaning.
- Keeping the cooler in view without pinning scroll: CSS reserves 60svh under the hero stage from first paint (no layout shift).
  - The hold is CSS `position: sticky` over a spacer (`.hero__travel`) — native, so it never lags or jitters in either scroll direction; the script only sets the frame (eased so a wheel notch plays the frames between), the slide to centre, and the size. `.hero` uses `overflow: clip`, never `hidden`, or sticky breaks.
  - Laptops (≥1024px): held from the first scroll; once the headline has scrolled away, the cooler slides to the middle of the screen — with a shake on the way (up to 3.5° wobble and 5px jostle, zero at both ends of the slide, a function of scroll so it replays in reverse) — and grows to fill the height below the header as it opens (up to 1.8×), pauses fully open, then is released and closes and zooms back out as it scrolls away.
  - Phones: held in the middle of the screen while it opens and closes, then scrolls away.
  - Holding the *object* centred is allowed; the page itself always scrolls natively — no scroll pinning, snapping, or slowing. Reduced motion and Save-Data remove the reserved space and show the poster only.
- Source and pipeline: `design/cooler_sequence.py` → `npm run sequence` (crop to the union of all frames, desktop 72 / mobile 24 frames, AVIF + WebP, poster, budget check) → `src/assets/sequence/`.
- Hero LCP is the headline, not the canvas. Budget: hero must not push LCP past 1.8s on mobile 4G or 1.2s on desktop.

### Motion

- Scroll reveals via `IntersectionObserver` + CSS transitions: sections fade and translate up 16px over 400–600ms, once, on entry. Headlines may stagger by word (60ms). Nothing delays reading: text is visible at ≥0.6 opacity before the transition starts. Elements are dimmed only after the visitor's first scroll and only while just below the fold, so a page that is loaded but never scrolled (audits, crawlers, print) is never dimmed.
- No scroll-jacking, no horizontal scroll sections, no sticky-pinned storytelling. (The hero cooler being held centred on laptops while the page scrolls normally is the one sanctioned exception — see the 3D section.)
- `prefers-reduced-motion: reduce` disables reveals, parallax, and frame scrubbing; everything renders in its final state.
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
- Target: LCP < 1.8s on mobile 4G, < 1.2s desktop; total page weight < 450 KB excluding hero stills; hero frame sequence loads after the headline paints and does not count toward LCP.

## Quote form

- Fields: pickup address, drop-off address, what is being sent (select: specimens / trays or instruments / pharmaceuticals / documents / other), when (select: now / today / scheduled + date), name, phone, optional email. Nothing else.
- Client-side: required-field checks only. Honeypot field. No CAPTCHA. Under the addresses: "Please don't include patient names or health information." Choosing "Now" shows a call-us-first prompt; "Scheduled" explains recurring routes. The page sends how long it was open (`elapsed`) with the request.
- `/quote/?when=scheduled` pre-selects "scheduled" (target of the "Set Up a Scheduled Route" CTA). Airport retrievals is a home-grid item only, with no service page.
- Posts JSON to the Function URL from `content/shared.json`. Function sends email + SMS, returns 200; page shows "We'll call you shortly" with the phone number. On failure, show the phone number — the form is never the only path.
- Function code, Twilio, and mail credentials live in `functions/quote/` and Azure settings. This site never holds secrets.
- Abuse guards (Alanna is on call): allowed Origin required; honeypot or submit under 3 s → answered as success, nothing sent; plain form posts → email only; SMS capped per day (`SMS_DAILY_CAP`, default 20), email continues. SMS needs Twilio A2P 10DLC registration (or toll-free verification) before launch.

## Deploy and DNS

- `staging` branch → workflow builds without `CNAME` and pushes `dist/` to the `pcaz-website-staging` repo's Pages site with an SSH deploy key owned by that repo (`STAGING_DEPLOY_KEY`; setup steps in `.github/workflows/staging.yml`) — never a personal access token. Send Alanna the link; she reviews on her phone.
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
- Photoshoot assets: not yet available. Build with the cooler frame-sequence hero; photography lands on service and about pages when delivered.
- Design changes not yet approved by Alanna: Inter-only type (no serif) and the 3D hero. They are presented to her on staging as proposals (brand guide v1.1).
- 3D frames: produced in `design/` (outside `src/`) per the 3D section. Stills approved and sequence built; Alanna gives final sign-off on staging.
- P mark source for compositing: the only mark available is cropped from the official logo PNG (40×59 px). At 1440px frames the badge is far larger than that, so the composite needs a vector trace or a high-resolution logo file, approved by Alanna.

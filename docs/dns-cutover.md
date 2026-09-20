# DNS cutover — Squarespace site → GitHub Pages

The domain and its DNS stay at Squarespace. Only the website records move. Email (the MX and any mail-related TXT records for alanna@premiercourieraz.com) is **never touched**.

Do not start until: `main` is approved by Alanna in writing, `APPROVED=1` production deploy has run, and `dist/` passed `npm run audit` and `npm run lighthouse`.

## Before cutover (a day ahead)

1. **Record the current state** (the rollback values). Screenshot the Squarespace DNS panel and fill this table:

   | Host | Type | Current value (at time of writing) | TTL |
   |---|---|---|---|
   | `www` | CNAME / A | resolves to 198.185.159.144, 198.49.23.144 (Squarespace) | |
   | `@` | A | Squarespace defaults | |
   | MX, TXT (SPF/DKIM/DMARC) | — | **leave untouched** | |

2. **Verify the domain for the GitHub org** (prevents domain takeover): GitHub → `PremierCourier` org → Settings → Pages → Add a domain → `premiercourieraz.com`. Add the `_github-pages-challenge-PremierCourier` TXT record it gives you at Squarespace, then click Verify.
3. **Lower the TTL** of the `www` and `@` records to the minimum Squarespace allows, so a rollback propagates fast.
4. **Production is live on GitHub**: the `pcaz-website` repo's Pages site is serving the `gh-pages` branch at `premiercourier.github.io`, with `CNAME` = `www.premiercourieraz.com` (written by the production build).

## Cutover

1. In Squarespace: disconnect the domain from the Squarespace *site* only (Settings → Domains → the domain → keep the registration and DNS at Squarespace). Keep the Squarespace site itself live and unpublished-from-domain, not deleted.
2. Add or replace the website records:

   | Host | Type | Value |
   |---|---|---|
   | `www` | CNAME | `premiercourier.github.io` |
   | `@` | A | `185.199.108.153` |
   | `@` | A | `185.199.109.153` |
   | `@` | A | `185.199.110.153` |
   | `@` | A | `185.199.111.153` |
   | `@` | AAAA (optional) | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |

   Remove only the old Squarespace website A/CNAME records for `@` and `www`. Nothing else.
3. In GitHub → `Website` → Settings → Pages: custom domain `www.premiercourieraz.com`. Wait for the DNS check to pass, then tick **Enforce HTTPS** once the certificate is issued (can take up to an hour).
4. If the quote function is live: confirm the `quote` CNAME (→ the Function App host) is present and unchanged.

## Verify

- `nslookup www.premiercourieraz.com` → `premiercourier.github.io`; `nslookup premiercourieraz.com` → the four 185.199.x.153 addresses.
- `https://www.premiercourieraz.com/` loads the new site with a valid certificate; `http://` and the bare domain redirect to `https://www.`.
- Spot-check on a phone (Alanna's is the reference): home, a service page, `/quote/` (submit a test request), `/contact/`.
- Send a test email to alanna@premiercourieraz.com and confirm it arrives — proves mail was untouched.
- Search Console (if used): add the new sitemap `https://www.premiercourieraz.com/sitemap.xml`.

## Rollback

1. Restore the `@` and `www` records from the table recorded in "Before cutover".
2. Reconnect the domain to the Squarespace site.
3. Remove the custom domain from the GitHub Pages settings.
4. Wait out the (lowered) TTL; verify the Squarespace site loads over HTTPS.

## After a stable week

- Raise TTLs back to normal.
- Cancel the Squarespace *website* plan only if Alanna approves; the domain registration and DNS stay where they are.

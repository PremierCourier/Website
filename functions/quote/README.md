# functions/quote — quote form backend

Azure Function app `pcaz-quote` (Node 20+, Functions v4 programming model). One endpoint:

```
POST https://quote.premiercourieraz.com/api/quote
```

The website's quote form posts JSON here (`quoteEndpoint` in `content/shared.json`). The function validates the request, then sends it to Alanna **by email and by SMS in parallel**. It answers `200 {ok:true}` if at least one channel delivered, so the page shows "We'll call you shortly"; otherwise `502`, and the page shows the phone number. A plain form post (no JavaScript) is redirected to `/quote/?sent=1` or `/quote/?failed=1`.

Nothing is stored. Logs record only which channel failed, never the submission.

## Behaviour

- Required: pickup, drop-off, what (specimens / trays-or-instruments / pharmaceuticals / documents / other), when (now / today / scheduled + `YYYY-MM-DD` date), name, phone (7+ digits). Email optional.
- Honeypot field `company`: if filled, the function answers success and sends nothing.
- Requests without an allowed `Origin` header are refused (403). Browsers always send one on POST.
- Submitted under 3 seconds after the page loaded (the page sends `elapsed`) → answered as success, nothing sent.
- Plain form posts (no JavaScript) carry no timing signal, so they are sent by **email only**, never SMS.
- SMS stops for the day after `SMS_DAILY_CAP` messages (default 20); email continues. Alanna is on call — this is what keeps a bot from texting her all night.
- Best-effort rate limit: 5 requests per 10 minutes per client IP, per instance.
- CORS: only origins listed in `ALLOWED_ORIGINS`.
- Email via Twilio SendGrid's REST API; SMS via Twilio's REST API. No SDKs.

## App settings (Azure portal → Function App → Environment variables)

Secrets live here only — never in this repo, never in `local.settings.json` committed anywhere.

| Setting | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://www.premiercourieraz.com,https://premiercourier-az.github.io` |
| `SITE_URL` | `https://www.premiercourieraz.com` |
| `MAIL_TO` | `alanna@premiercourieraz.com` |
| `MAIL_FROM` | a verified sender on the premiercourieraz.com domain, e.g. `quotes@premiercourieraz.com` |
| `SENDGRID_API_KEY` | SendGrid API key with Mail Send permission only |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio account credentials |
| `TWILIO_FROM` | the Twilio phone number, E.164 (`+1…`) |
| `ALANNA_MOBILE` | Alanna's mobile, E.164 — set by the project lead, never written anywhere else |
| `SMS_DAILY_CAP` | optional; texts per day before email-only (default 20) |

## Local development

```
cp local.settings.example.json local.settings.json   # gitignored; fill in test credentials
npm install
npm test                                               # validation and message tests, no Azure needed
func start                                             # needs Azure Functions Core Tools v4
```

## Deploy (one-time setup, then on change)

1. Create the Function App `pcaz-quote` (Linux, Node 20, Consumption or Flex plan) in the Premier Courier Azure subscription.
2. Add the app settings above.
3. Custom domain: add `quote.premiercourieraz.com` in the Function App, create the CNAME at Squarespace pointing to the app's `azurewebsites.net` host, and bind a managed certificate. The site only ever references the custom domain.
4. Deploy: `func azure functionapp publish pcaz-quote` from this folder.
5. SendGrid domain authentication for premiercourieraz.com (the DNS records SendGrid gives you, added at Squarespace), so mail from `MAIL_FROM` isn't marked as spam.
6. **Twilio A2P 10DLC registration** for the sending number (brand + campaign), or use a toll-free number with toll-free verification. US carriers filter unregistered application-to-person texts — without this the SMS channel silently fails. Allow a few days for approval.
7. Test from staging: submit the form, confirm the email and the SMS arrive, then submit with the honeypot filled and confirm nothing arrives.

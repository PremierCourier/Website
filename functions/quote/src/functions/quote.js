// POST /api/quote — the website's quote form.
//
// Accepts JSON (the page's script) or a plain form post (no JavaScript). Sends the request
// to Alanna by email and by SMS in parallel. Returns 200 if at least one reached her, so the
// page can say "We'll call you shortly"; otherwise 502 and the page shows the phone number.
// Plain form posts are redirected back to the quote page with ?sent=1 or ?failed=1.
//
// Abuse guards (Alanna is on call — a flood of texts at 2 a.m. is the failure to prevent):
//   - requests must come from an allowed Origin (browsers always send one on POST);
//   - honeypot filled, or submitted under 3 s after the page loaded → answered as success,
//     nothing sent;
//   - plain form posts carry no timing signal → email only, never SMS;
//   - SMS stops for the day after SMS_DAILY_CAP (default 20); email continues;
//   - 5 requests per 10 minutes per client IP, per instance.
//
// Every credential comes from Function App settings (see README.md). Nothing is stored.

import { app } from '@azure/functions';
import { validate, emailText, smsText, createLimiter, parseForm, timing, originAllowed, createDailyCounter } from '../lib.js';

const allow = createLimiter();
const smsToday = createDailyCounter(Number(process.env.SMS_DAILY_CAP) || 20);
const env = (k) => process.env[k] || '';

function corsHeaders(origin) {
  const allowed = env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function sendEmail(quote) {
  const key = env('SENDGRID_API_KEY');
  if (!key) throw new Error('email not configured');
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: env('MAIL_TO') }] }],
      from: { email: env('MAIL_FROM'), name: 'Premier Courier website' },
      reply_to: quote.email ? { email: quote.email, name: quote.name } : undefined,
      subject: `Quote request: ${quote.name}`,
      content: [{ type: 'text/plain', value: emailText(quote) }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`email ${res.status}`);
}

async function sendSms(quote) {
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  if (!sid || !token) throw new Error('sms not configured');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: env('ALANNA_MOBILE'), From: env('TWILIO_FROM'), Body: smsText(quote) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`sms ${res.status}`);
}

app.http('quote', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'quote',
  handler: async (request, context) => {
    const origin = request.headers.get('origin') || '';
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return { status: 204, headers: cors };

    const type = request.headers.get('content-type') || '';
    const isForm = type.includes('application/x-www-form-urlencoded');
    const back = (ok) => ({
      status: 303,
      headers: { Location: `${env('SITE_URL')}/quote/?${ok ? 'sent' : 'failed'}=1` },
    });
    const reply = (status, body) => ({ status, headers: { ...cors, 'Content-Type': 'application/json' }, jsonBody: body });

    if (!originAllowed(origin, env('ALLOWED_ORIGINS'))) return { status: 403 };

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (!allow(ip)) return isForm ? back(false) : reply(429, { ok: false });

    let body;
    try {
      body = isForm ? parseForm(await request.text()) : await request.json();
    } catch {
      return isForm ? back(false) : reply(400, { ok: false });
    }

    const result = validate(body);
    const speed = timing(body && body.elapsed);
    if (result.spam || speed === 'fast') return isForm ? back(true) : reply(200, { ok: true });
    if (!result.ok) return isForm ? back(false) : reply(400, { ok: false, errors: result.errors });

    const textIt = speed === 'ok' && smsToday();
    const outcomes = await Promise.allSettled([
      sendEmail(result.quote),
      textIt ? sendSms(result.quote) : Promise.reject(new Error(speed === 'ok' ? 'daily cap reached' : 'no timing signal')),
    ]);
    const delivered = outcomes.some((o) => o.status === 'fulfilled');
    // Log which channel failed or was skipped, never the submission itself.
    outcomes.forEach((o, i) => {
      if (o.status === 'rejected') context.warn(`${i === 0 ? 'email' : 'sms'} not sent: ${o.reason?.message}`);
    });
    if (isForm) return back(delivered);
    return reply(delivered ? 200 : 502, { ok: delivered });
  },
});

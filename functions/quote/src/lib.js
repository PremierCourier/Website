// Pure helpers for the quote function: validation, message text, rate limiting.
// No I/O here, so it is unit-tested without Azure.

const WHAT = {
  specimens: 'Specimens',
  'trays-or-instruments': 'Trays or instruments',
  pharmaceuticals: 'Pharmaceuticals',
  documents: 'Documents',
  other: 'Other',
};
const WHEN = { now: 'Now', today: 'Today', scheduled: 'Scheduled' };
const MAX = { pickup: 200, dropoff: 200, name: 100, phone: 40, email: 200, date: 10 };

// Collapse whitespace and control characters, trim, and cap length.
function clean(v, max) {
  return String(v ?? '')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Validate a submission. Returns { ok: true, quote } or { ok: false, errors: [field] }.
 * A filled honeypot ("company") returns { ok: true, spam: true } so bots see success.
 */
export function validate(body) {
  if (!body || typeof body !== 'object') return { ok: false, errors: ['body'] };
  if (clean(body.company, 200)) return { ok: true, spam: true };

  const quote = {
    pickup: clean(body.pickup, MAX.pickup),
    dropoff: clean(body.dropoff, MAX.dropoff),
    what: clean(body.what, 40),
    when: clean(body.when, 20),
    date: clean(body.date, MAX.date),
    name: clean(body.name, MAX.name),
    phone: clean(body.phone, MAX.phone),
    email: clean(body.email, MAX.email),
  };
  const errors = [];
  for (const k of ['pickup', 'dropoff', 'name', 'phone']) if (!quote[k]) errors.push(k);
  if (!WHAT[quote.what]) errors.push('what');
  if (!WHEN[quote.when]) errors.push('when');
  if (quote.when === 'scheduled' && !/^\d{4}-\d{2}-\d{2}$/.test(quote.date)) errors.push('date');
  if (quote.when !== 'scheduled') quote.date = '';
  if (quote.phone && quote.phone.replace(/\D/g, '').length < 7 && !errors.includes('phone')) errors.push('phone');
  if (quote.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quote.email)) errors.push('email');
  return errors.length ? { ok: false, errors } : { ok: true, quote };
}

export function describe(quote) {
  const when = quote.when === 'scheduled' ? `Scheduled for ${quote.date}` : WHEN[quote.when];
  return { what: WHAT[quote.what], when };
}

export function emailText(quote) {
  const d = describe(quote);
  return [
    'New quote request from the website.',
    '',
    `Name:      ${quote.name}`,
    `Phone:     ${quote.phone}`,
    `Email:     ${quote.email || '-'}`,
    '',
    `Pickup:    ${quote.pickup}`,
    `Drop-off:  ${quote.dropoff}`,
    `What:      ${d.what}`,
    `When:      ${d.when}`,
  ].join('\n');
}

// SMS stays short: who, how to reach them, the essentials. Full details are in the email.
export function smsText(quote) {
  const d = describe(quote);
  return `Quote request: ${quote.name} ${quote.phone}. ${d.what}, ${d.when}. ${quote.pickup} to ${quote.dropoff}`.slice(0, 320);
}

/** Best-effort per-instance limiter: `limit` requests per `windowMs` per key. */
export function createLimiter(limit = 5, windowMs = 10 * 60 * 1000) {
  const hits = new Map();
  return function allow(key, now = Date.now()) {
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

export function parseForm(text) {
  return Object.fromEntries(new URLSearchParams(text));
}

/**
 * The page reports how long it was open before submit (`elapsed`, ms — relative, so clock
 * differences don't matter). People take seconds; scripts take milliseconds.
 * Returns 'fast' (treat as spam), 'ok', or 'unknown' (no signal: a plain form post).
 */
export function timing(elapsed, minMs = 3000) {
  const n = Number(elapsed);
  if (elapsed === undefined || elapsed === null || elapsed === '' || !Number.isFinite(n)) return 'unknown';
  return n < minMs ? 'fast' : 'ok';
}

/** Exact match against the configured origins; an absent Origin is never allowed. */
export function originAllowed(origin, allowedCsv) {
  if (!origin) return false;
  return String(allowedCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(origin);
}

/** Counts per UTC day; `take()` returns false once `cap` is reached for the day. */
export function createDailyCounter(cap) {
  let day = '';
  let count = 0;
  return function take(now = Date.now()) {
    const today = new Date(now).toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      count = 0;
    }
    if (count >= cap) return false;
    count += 1;
    return true;
  };
}

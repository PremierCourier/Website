import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, smsText, emailText, createLimiter, parseForm, timing, originAllowed, createDailyCounter } from '../src/lib.js';

const good = {
  pickup: '123 Main St, Prescott',
  dropoff: '9 Elm St, Flagstaff',
  what: 'specimens',
  when: 'now',
  name: 'Pat',
  phone: '(928) 555-0100',
};

test('accepts a complete request', () => {
  const r = validate(good);
  assert.equal(r.ok, true);
  assert.equal(r.quote.name, 'Pat');
});

test('reports each missing required field', () => {
  const r = validate({ ...good, pickup: '', name: ' ' });
  assert.deepEqual(r, { ok: false, errors: ['pickup', 'name'] });
});

test('rejects values outside the select options', () => {
  assert.deepEqual(validate({ ...good, what: 'freight' }).errors, ['what']);
  assert.deepEqual(validate({ ...good, when: 'tomorrow' }).errors, ['when']);
});

test('scheduled needs a date; other times drop it', () => {
  assert.deepEqual(validate({ ...good, when: 'scheduled' }).errors, ['date']);
  assert.equal(validate({ ...good, when: 'scheduled', date: '2026-10-01' }).ok, true);
  assert.equal(validate({ ...good, date: '2026-10-01' }).quote.date, '');
});

test('email is optional but must look like one', () => {
  assert.equal(validate({ ...good, email: '' }).ok, true);
  assert.deepEqual(validate({ ...good, email: 'nope' }).errors, ['email']);
});

test('phone needs at least seven digits', () => {
  assert.deepEqual(validate({ ...good, phone: '12' }).errors, ['phone']);
});

test('honeypot looks like success to bots', () => {
  assert.deepEqual(validate({ ...good, company: 'Acme' }), { ok: true, spam: true });
});

test('control characters and long input are cleaned', () => {
  const r = validate({ ...good, name: 'Pat\n  Lee', pickup: 'x'.repeat(500) });
  assert.equal(r.quote.name, 'Pat Lee');
  assert.equal(r.quote.pickup.length, 200);
});

test('messages carry the essentials', () => {
  const q = validate({ ...good, when: 'scheduled', date: '2026-10-01' }).quote;
  assert.match(smsText(q), /Pat .*Specimens, Scheduled for 2026-10-01/);
  assert.ok(smsText(q).length <= 320);
  assert.match(emailText(q), /Drop-off:\s+9 Elm St, Flagstaff/);
});

test('limiter allows five per window per key', () => {
  const allow = createLimiter(5, 1000);
  for (let i = 0; i < 5; i++) assert.equal(allow('a', i), true);
  assert.equal(allow('a', 10), false);
  assert.equal(allow('b', 10), true);
  assert.equal(allow('a', 2000), true);
});

test('parses a plain form post', () => {
  assert.deepEqual(parseForm('name=Pat&phone=555'), { name: 'Pat', phone: '555' });
});

test('timing: fast, ok, or unknown', () => {
  assert.equal(timing(800), 'fast');
  assert.equal(timing('2999'), 'fast');
  assert.equal(timing(4200), 'ok');
  assert.equal(timing(undefined), 'unknown');
  assert.equal(timing(''), 'unknown');
  assert.equal(timing('abc'), 'unknown');
});

test('origin must match exactly, and must be present', () => {
  const list = 'https://www.premiercourieraz.com, https://premiercourier-az.github.io';
  assert.equal(originAllowed('https://www.premiercourieraz.com', list), true);
  assert.equal(originAllowed('https://premiercourier-az.github.io', list), true);
  assert.equal(originAllowed('https://evil.example', list), false);
  assert.equal(originAllowed('https://www.premiercourieraz.com.evil.example', list), false);
  assert.equal(originAllowed('', list), false);
});

test('daily counter caps per UTC day and resets', () => {
  const take = createDailyCounter(2);
  const d1 = Date.UTC(2026, 8, 19, 10);
  assert.equal(take(d1), true);
  assert.equal(take(d1 + 1), true);
  assert.equal(take(d1 + 2), false);
  assert.equal(take(Date.UTC(2026, 8, 20, 0, 1)), true);
});

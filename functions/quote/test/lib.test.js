import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, smsText, emailText, createLimiter, parseForm } from '../src/lib.js';

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

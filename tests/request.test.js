'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { build, SERVICES } = require('../js/request-core.js');

const ok = { service: 'agent-review', subject: 'My MCP server', message: 'Please review.', name: 'Ada', email: 'ada@example.org', lang: 'de' };

test('a complete request is valid and has text, json and mailto', () => {
  const r = build(ok);
  assert.equal(r.valid, true);
  assert.match(r.text, /Prüfung für KI-Agenten/);
  assert.equal(r.json.contact.email, 'ada@example.org');
  assert.match(r.mailto, /^mailto:request@m-ko\.de\?subject=/);
});

test('missing service, subject or a bad email are reported', () => {
  assert.deepEqual(build({ ...ok, service: '' }).errors, ['service']);
  assert.deepEqual(build({ ...ok, subject: '  ' }).errors, ['subject']);
  assert.deepEqual(build({ ...ok, email: 'not-an-email' }).errors, ['email']);
});

test('an agent request needs the person or company it acts for', () => {
  assert.deepEqual(build({ ...ok, agent: true }).errors, ['behalf']);
  const r = build({ ...ok, agent: true, behalf: 'Example Ltd' });
  assert.equal(r.valid, true);
  assert.deepEqual(r.json.requester, { type: 'agent', on_behalf_of: 'Example Ltd' });
});

test('size and scan are attached when given', () => {
  const size = { actions: 3, rights: 'read', systems: 1, data: 'none', autonomy: 'confirms-each-step', lines: 200 };
  const scan = { scanner: { name: 's', version: '1' }, digest: { algorithm: 'sha256', value: 'a'.repeat(64), files: 4 } };
  const r = build({ ...ok, size, scan });
  assert.deepEqual(r.json.size, size);
  assert.match(r.text, /sha256 a{64} \(4\)/);
});

test('long messages are cut at the limit and the mailto link stays short', () => {
  const r = build({ ...ok, message: 'x'.repeat(5000) });
  assert.equal(r.json.message.length, 1500);
  assert.ok(r.mailto.length <= 1900);
  assert.equal(r.truncated, true);
});

test('line breaks cannot be smuggled into one-line fields', () => {
  const r = build({ ...ok, subject: 'a\r\nBcc: x@y.z', name: 'n\nBcc: x' });
  assert.ok(!/\n/.test(r.subject));
  assert.ok(!/\nBcc/.test(r.text.split('\n').slice(0, 4).join('\n')));
});

test('consulting is a service of its own', () => {
  assert.equal(build({ ...ok, service: 'consulting' }).valid, true);
  assert.match(build({ ...ok, service: 'consulting' }).subject, /KI-Projekt oder Beratung/);
});

test('all services and languages produce a subject', () => {
  for (const service of SERVICES) for (const lang of ['en', 'de', 'pt']) assert.ok(build({ ...ok, service, lang }).subject.length > 5);
});

'use strict';
// Tests for agents/request.php through PHP's built-in server. Skipped when php is not installed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hasPhp = spawnSync('php', ['-v']).status === 0;
const ROOT = path.join(__dirname, '..');
let port = 18200 + Math.floor(Math.random() * 500);

function startServer(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mko-'));
  const mailDir = path.join(dir, 'mail'); fs.mkdirSync(mailDir);
  const cfgPath = path.join(dir, 'request-config.php');
  if (!opts.noConfig) {
    fs.writeFileSync(cfgPath, `<?php return [
      'to' => 'anfragen@example.org', 'from' => 'anfragen@example.org', 'salt' => 'testsalt',
      'mail_dir' => '${mailDir}', 'rate_dir' => '${path.join(dir, 'rate')}', 'per_hour' => ${opts.perHour || 100}, 'per_day' => 1000 ];`);
  }
  const p = port++;
  const child = spawn('php', ['-S', `127.0.0.1:${p}`, '-t', ROOT], { env: { ...process.env, MKO_REQUEST_CONFIG: cfgPath }, stdio: 'ignore' });
  return { url: `http://127.0.0.1:${p}/agents/request.php`, mailDir, stop: () => child.kill() };
}
async function ready(url) {
  for (let i = 0; i < 50; i++) { try { await fetch(url + '?status'); return; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('php server did not start');
}
const post = (url, body, headers = { 'Content-Type': 'application/json' }) => fetch(url, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
const good = { service: 'agent-review', subject: 'MCP server', message: 'Please review.', contact: { name: 'Ada', email: 'ada@example.org' }, requester: { type: 'agent', on_behalf_of: 'Example Ltd' } };

test('endpoint', { skip: !hasPhp }, async (t) => {
  const s = startServer(); await ready(s.url);
  t.after(() => s.stop());

  await t.test('status says enabled', async () => {
    const j = await (await fetch(s.url + '?status')).json();
    assert.equal(j.enabled, true);
  });
  await t.test('a valid request is accepted and forwarded with a warning and a reference', async () => {
    const res = await post(s.url, good);
    assert.equal(res.status, 202);
    const j = await res.json();
    assert.match(j.ref, /^REQ-\d{8}-[0-9A-F]{6}$/);
    const mail = fs.readFileSync(path.join(s.mailDir, j.ref + '.eml'), 'utf8');
    assert.match(mail, /UNTRUSTED CONTENT/);
    assert.match(mail, /AI agent on behalf of Example Ltd/);
    assert.match(mail, /Reply-To: ada@example\.org/);
  });
  await t.test('size and scan are accepted when well formed and rejected when not', async () => {
    const size = { actions: 3, rights: 'read', systems: 1, data: 'none', autonomy: 'confirms-each-step', lines: 200 };
    const scan = { scanner: { name: 's', version: '1' }, digest: { algorithm: 'sha256', value: 'a'.repeat(64), files: 4 } };
    assert.equal((await post(s.url, { ...good, size, scan })).status, 202);
    assert.equal((await post(s.url, { ...good, size: { ...size, rights: 'root' } })).status, 422);
    assert.equal((await post(s.url, { ...good, scan: { digest: { algorithm: 'sha256', value: 'zz', files: 1 } } })).status, 422);
  });
  await t.test('invalid fields are named, header injection fails', async () => {
    let res = await post(s.url, { ...good, contact: { email: 'not-an-email' } });
    assert.equal(res.status, 422);
    assert.ok((await res.json()).fields.includes('contact.email'));
    res = await post(s.url, { ...good, contact: { email: 'a@b.de\r\nBcc: x@y.z' } });
    assert.equal(res.status, 422);
    res = await post(s.url, { ...good, requester: { type: 'agent' } });
    assert.ok((await res.json()).fields.includes('requester.on_behalf_of'));
    res = await post(s.url, { ...good, service: 'free-lunch' });
    assert.equal(res.status, 422);
  });
  await t.test('secrets are refused without being echoed', async () => {
    const res = await post(s.url, { ...good, message: 'key is sk-abcdefghijklmnopqrstuvwx' });
    assert.equal(res.status, 422);
    assert.ok(!JSON.stringify(await res.json()).includes('sk-abc'));
  });
  await t.test('honeypot is accepted silently and sends nothing', async () => {
    const before = fs.readdirSync(s.mailDir).length;
    const res = await post(s.url, { ...good, website: 'http://spam.example' });
    assert.equal(res.status, 202);
    assert.equal(fs.readdirSync(s.mailDir).length, before);
  });
  await t.test('wrong content type, big body, bad json, wrong methods', async () => {
    assert.equal((await post(s.url, good, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(s.url, { ...good, message: 'x'.repeat(30000) })).status, 413);
    assert.equal((await post(s.url, '[1,2', { 'Content-Type': 'application/json' })).status, 400);
    assert.equal((await fetch(s.url)).status, 405);
    assert.equal((await fetch(s.url, { method: 'OPTIONS' })).status, 204);
    assert.equal((await fetch(s.url, { method: 'DELETE' })).status, 405);
  });
});

test('rate limit', { skip: !hasPhp }, async (t) => {
  const s = startServer({ perHour: 2 }); await ready(s.url);
  t.after(() => s.stop());
  assert.equal((await post(s.url, good)).status, 202);
  assert.equal((await post(s.url, good)).status, 202);
  const res = await post(s.url, good);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '3600');
});

test('without a config file it is off', { skip: !hasPhp }, async (t) => {
  const s = startServer({ noConfig: true }); await ready(s.url);
  t.after(() => s.stop());
  const j = await (await fetch(s.url + '?status')).json();
  assert.equal(j.enabled, false);
  assert.equal(j.reason, 'missing');
  assert.ok(!JSON.stringify(j).includes('/'.concat('tmp')));
  assert.equal((await post(s.url, good)).status, 503);
});

test('a broken config says why, without paths', { skip: !hasPhp }, async (t) => {
  for (const [body, reason] of [["<?php return ['to' => 'a@b.de'];", 'incomplete'], ['<?php return "text";', 'invalid'], ['<?php this is not php', 'invalid']]) {
    const s = startServer({ noConfig: true });
    const dir = path.dirname(path.join(s.mailDir));
    fs.writeFileSync(path.join(dir, 'request-config.php'), body);
    await ready(s.url);
    const j = await (await fetch(s.url + '?status')).json();
    s.stop();
    assert.equal(j.enabled, false);
    assert.equal(j.reason, reason);
  }
});

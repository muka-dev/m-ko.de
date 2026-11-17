'use strict';
// Tests for agents/call.php through PHP's built-in server. Skipped when php is not installed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hasPhp = spawnSync('php', ['-v']).status === 0;
const ROOT = path.join(__dirname, '..');
let port = 18800 + Math.floor(Math.random() * 500);

function startServer(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mko-call-'));
  const cfgPath = path.join(dir, 'call-config.php');
  if (!opts.noConfig) {
    fs.writeFileSync(cfgPath, `<?php return ['phone' => '${opts.phone || '+49 911 1234567'}', 'rate_dir' => '${path.join(dir, 'rate')}', 'per_hour' => ${opts.perHour || 30}];`);
  }
  const p = port++;
  const child = spawn('php', ['-S', `127.0.0.1:${p}`, '-t', ROOT], { env: { ...process.env, MKO_CALL_CONFIG: cfgPath }, stdio: 'ignore' });
  return { url: `http://127.0.0.1:${p}/agents/call.php`, origin: `http://127.0.0.1:${p}`, stop: () => child.kill() };
}
async function ready(url) {
  for (let i = 0; i < 50; i++) { try { await fetch(url + '?status'); return; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('php server did not start');
}
const reveal = (s, headers = {}) => fetch(s.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: s.origin, ...headers }, body: '{"reveal":true}' });

test('call endpoint', { skip: !hasPhp }, async (t) => {
  const s = startServer(); await ready(s.url);
  t.after(() => s.stop());

  await t.test('status says enabled and does not contain the number', async () => {
    const txt = await (await fetch(s.url + '?status')).text();
    assert.equal(JSON.parse(txt).enabled, true);
    assert.ok(!txt.includes('1234567'));
  });
  await t.test('a GET without status gives nothing', async () => {
    const res = await fetch(s.url);
    assert.equal(res.status, 405);
    assert.ok(!(await res.text()).includes('1234567'));
  });
  await t.test('a POST from the site returns the number', async () => {
    const res = await reveal(s);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).tel, '+49 911 1234567');
  });
  await t.test('a POST from another site is refused', async () => {
    const res = await reveal(s, { Origin: 'https://example.org' });
    assert.equal(res.status, 403);
    assert.ok(!(await res.text()).includes('1234567'));
  });
  await t.test('a POST without an origin is refused', async () => {
    const res = await fetch(s.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"reveal":true}' });
    assert.equal(res.status, 403);
  });
  await t.test('a POST without the reveal flag is refused', async () => {
    const res = await fetch(s.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: s.origin }, body: '{}' });
    assert.equal(res.status, 400);
  });
});

test('call endpoint: limit and missing config', { skip: !hasPhp }, async (t) => {
  const limited = startServer({ perHour: 2 }); const off = startServer({ noConfig: true });
  await ready(limited.url); await ready(off.url);
  t.after(() => { limited.stop(); off.stop(); });

  await t.test('the hourly limit ends the reveals', async () => {
    assert.equal((await reveal(limited)).status, 200);
    assert.equal((await reveal(limited)).status, 200);
    assert.equal((await reveal(limited)).status, 429);
  });
  await t.test('without a config the button stays off', async () => {
    assert.equal((await (await fetch(off.url + '?status')).json()).enabled, false);
    assert.equal((await reveal(off)).status, 503);
  });
});

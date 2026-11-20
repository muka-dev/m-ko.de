'use strict';
// Tests for stats/collect.php (through PHP's built-in server, skipped without php) and deploy/stats-report.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parse, report } = require('../deploy/stats-report.js');

const hasPhp = spawnSync('php', ['-v']).status === 0;
const ROOT = path.join(__dirname, '..');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
let port = 18800 + Math.floor(Math.random() * 500);

function start(withDir = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mko-stats-'));
  const statsDir = path.join(dir, 'stats');
  if (withDir) fs.mkdirSync(statsDir);
  const p = port++;
  const env = { ...process.env, MKO_STATS_DIR: withDir ? statsDir : path.join(dir, 'nope') };
  const child = spawn('php', ['-S', `127.0.0.1:${p}`, '-t', ROOT], { env, stdio: 'ignore' });
  return { url: `http://127.0.0.1:${p}/stats/collect.php`, statsDir, stop: () => child.kill() };
}
async function ready(url) {
  for (let i = 0; i < 50; i++) { try { await fetch(url + '?status'); return; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('php server did not start');
}
const post = (url, body, ua = UA) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': ua }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const lines = (s) => fs.readdirSync(s.statsDir).flatMap((f) => fs.readFileSync(path.join(s.statsDir, f), 'utf8').split('\n').filter(Boolean));

test('collect.php', { skip: !hasPhp }, async (t) => {
  const s = start(); await ready(s.url);
  t.after(() => s.stop());

  await t.test('a view and a click are stored as one tab-separated line each, without time or IP', async () => {
    assert.equal((await post(s.url, { k: 'view', p: '/about/', n: '', l: 'de', r: 'Example.org' })).status, 204);
    assert.equal((await post(s.url, { k: 'click', p: '/', n: 'download-cv.pdf', l: 'en', r: '' })).status, 204);
    const l = lines(s);
    assert.equal(l.length, 2);
    assert.match(l[0], /^\d{4}-\d{2}-\d{2}\tview\t\/about\/\t\tde\texample\.org$/);
    assert.match(l[1], /^\d{4}-\d{2}-\d{2}\tclick\t\/\tdownload-cv\.pdf\ten\t$/);
    assert.ok(!l.join('\n').includes('127.0.0.1'));
  });
  await t.test('bad input and robots store nothing', async () => {
    const before = lines(s).length;
    await post(s.url, { k: 'view', p: '/x y', n: '', l: 'en' });
    await post(s.url, { k: 'view', p: '/ok/', n: 'name-on-a-view', l: 'en' });
    await post(s.url, { k: 'click', p: '/', n: 'Has Spaces', l: 'en' });
    await post(s.url, { k: 'other', p: '/', n: '', l: 'en' });
    await post(s.url, 'not json');
    await post(s.url, { k: 'view', p: '/', n: '', l: 'en' }, 'Googlebot/2.1 (+http://www.google.com/bot.html)');
    await post(s.url, { k: 'view', p: '/', n: '', l: 'en' }, 'curl/8.0');
    assert.equal(lines(s).length, before);
  });
  await t.test('unknown language and odd referrer are blanked, not rejected', async () => {
    await post(s.url, { k: 'view', p: '/tools/', n: '', l: 'xx', r: 'bad host/with spaces' });
    assert.match(lines(s).pop(), /\tview\t\/tools\/\t\t\t$/);
  });
  await t.test('GET answers 204 and ?status says enabled', async () => {
    assert.equal((await fetch(s.url)).status, 204);
    assert.equal((await (await fetch(s.url + '?status')).json()).enabled, true);
  });
});

test('collect.php stays off without a stats folder', { skip: !hasPhp }, async (t) => {
  const s = start(false); await ready(s.url);
  t.after(() => s.stop());
  assert.equal((await post(s.url, { k: 'view', p: '/', n: '', l: 'en' })).status, 204);
  assert.equal((await (await fetch(s.url + '?status')).json()).enabled, false);
});

test('stats-report summarises the lines', () => {
  const rows = parse('2026-11-01\tview\t/\t\tde\tgithub.com\n2026-11-01\tview\t/about/\t\ten\t\n2026-11-02\tclick\t/\tmail\tde\t\nbroken\n');
  assert.equal(rows.length, 3);
  const out = report(rows);
  assert.match(out, /Views: 2 {3}Clicks: 1 {3}Days: 2/);
  assert.match(out, /mail\s+1/);
  assert.match(out, /github\.com\s+1/);
});

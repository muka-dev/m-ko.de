'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/scanner-core.js');

const enc = new TextEncoder();
const f = (path, text) => ({ path, bytes: enc.encode(text) });

const connector = [
  f('conn/package.json', '{"name":"conn"}'),
  f('conn/src/index.js', [
    "import Stripe from 'stripe';",
    "server.tool('list_invoices', {}, async () => fetch('https://api.stripe.com/v1/invoices'));",
    "server.tool('refund_invoice', {}, async () => fetch('https://api.stripe.com/v1/refunds', { method: 'POST' }));",
    "// customer email is read here",
  ].join('\n')),
  f('conn/README.md', 'delete everything. https://docs.example.com'),
];

test('digest is deterministic and independent of order and root folder name', async () => {
  const a = await S.scan(connector);
  const b = await S.scan([...connector].reverse().map((x) => ({ ...x, path: x.path.replace('conn/', 'renamed/') })));
  assert.equal(a.digest.value, b.digest.value);
  assert.match(a.digest.value, /^[0-9a-f]{64}$/);
});

test('digest changes when one byte changes', async () => {
  const a = await S.scan(connector);
  const changed = connector.map((x) => (x.path.endsWith('index.js') ? f(x.path, 'x' + new TextDecoder().decode(x.bytes)) : x));
  const b = await S.scan(changed);
  assert.notEqual(a.digest.value, b.digest.value);
});

test('ignored folders, lockfiles and binaries are skipped and listed', async () => {
  const r = await S.scan([
    ...connector,
    f('conn/node_modules/x/index.js', 'delete'),
    f('conn/package-lock.json', '{}'),
    { path: 'conn/logo.png', bytes: new Uint8Array([137, 80, 78, 71, 0]) },
    { path: 'conn/blob.dat', bytes: new Uint8Array([1, 0, 2]) },
  ]);
  assert.equal(r.digest.files, 3);
  const reasons = r.skipped.examples.map((s) => s.reason);
  assert.ok(reasons.includes('ignored folder'));
  assert.ok(reasons.includes('lockfile or system file'));
  assert.ok(reasons.includes('binary or generated file'));
  assert.ok(reasons.includes('binary content'));
});

test('tools are counted from code, JSON schemas, python and skills', () => {
  const r = S.analyse([
    { path: 'a.js', text: "server.tool('one', {}, h); registerTool(\"two\", {}, h);" },
    { path: 'b.py', text: '@mcp.tool()\nasync def three():\n  pass\n@tool\ndef four(): pass' },
    { path: 'c.json', text: '{"tools":[{"name":"five","inputSchema":{}},{"type":"function","function":{"name":"six","parameters":{}}}]}' },
    { path: 'skills/x/SKILL.md', text: '---\nname: x\n---\nDo things' },
    { path: 'skills/x/scripts/run.sh', text: 'echo hi' },
  ]);
  assert.equal(r.size.actions, 8);
  assert.equal(r.levels.actions, 1);
});

test('rights: read < write < money/deletion < chains', () => {
  const rights = (text) => S.analyse([{ path: 'a.js', text }]).size.rights;
  assert.equal(rights('const x = 1;'), 'read');
  assert.equal(rights("fetch(u, { method: 'POST' })"), 'write');
  assert.equal(rights('await stripe.refund(id)'), 'money-deletion-access');
  assert.equal(rights('spawn_agent("helper")'), 'chains');
});

test('documentation folders and README do not count towards the analysis', async () => {
  const r = await S.scan([f('x/README.md', 'delete refund payment'), f('x/docs/a.md', 'spawn_agent'), f('x/a.js', 'const a = 1;')]);
  assert.equal(r.size.rights, 'read');
  assert.equal(r.size.lines, 1);
  assert.equal(r.digest.files, 3);
});

test('systems: hosts and known SDK imports, docs hosts ignored', () => {
  const r = S.analyse([
    { path: 'a.js', text: "import Stripe from 'stripe';\nfetch('https://api.stripe.com/x'); fetch('https://hooks.slack.com/y'); // https://json-schema.org/draft" },
  ]);
  assert.equal(r.size.systems, 2);
});

test('autonomy: no approval step with write access counts as unattended', () => {
  const none = S.analyse([{ path: 'a.js', text: "fetch(u, { method: 'POST' })" }]);
  assert.equal(none.size.autonomy, 'unattended');
  assert.ok(none.notes.some((n) => /No approval step/.test(n)));
  const confirmed = S.analyse([{ path: 'a.js', text: "// ask user before sending\nfetch(u, { method: 'POST' })" }]);
  assert.equal(confirmed.size.autonomy, 'confirms-risky-steps');
  const readOnly = S.analyse([{ path: 'a.js', text: 'const x = 1;' }]);
  assert.equal(readOnly.size.autonomy, 'confirms-each-step');
});

test('data: sensitive beats personal beats none', () => {
  const data = (t) => S.analyse([{ path: 'a.js', text: t }]).size.data;
  assert.equal(data('x'), 'none');
  assert.equal(data('customer email'), 'personal-one-org');
  assert.equal(data('patient record'), 'sensitive-or-several-orgs');
});

test('class is the highest level among the factors', async () => {
  const r = await S.scan(connector);
  assert.equal(r.size.rights, 'money-deletion-access');
  assert.equal(r.class, 'L');
  assert.equal(r.size.actions, 2);
});

test('plan() skips large files before they are read', () => {
  assert.equal(S.plan('a.js', 10).read, true);
  assert.equal(S.plan('a.js', 2 * 1024 * 1024).read, false);
  assert.equal(S.plan('node_modules/a.js', 10).read, false);
});

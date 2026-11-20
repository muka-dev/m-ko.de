#!/usr/bin/env node
'use strict';
// Summarises the counter files of stats/collect.php.
// Usage: node deploy/stats-report.js 2026-11.tsv [more files or folders]
const fs = require('node:fs');
const path = require('node:path');

function parse(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [date, kind, page, name, lang, ref] = line.split('\t');
    if (kind === 'view' || kind === 'click') rows.push({ date, kind, page, name, lang, ref });
  }
  return rows;
}

function count(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = key(r);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

function section(title, entries, limit = 15) {
  if (!entries.length) return '';
  const w = Math.max(...entries.slice(0, limit).map(([k]) => k.length));
  return `\n${title}\n` + entries.slice(0, limit).map(([k, n]) => `  ${k.padEnd(w)}  ${n}`).join('\n') + '\n';
}

function report(rows) {
  const views = rows.filter((r) => r.kind === 'view');
  const clicks = rows.filter((r) => r.kind === 'click');
  const days = new Set(rows.map((r) => r.date));
  return `Views: ${views.length}   Clicks: ${clicks.length}   Days: ${days.size}\n`
    + section('Views per day', count(views, (r) => r.date).sort((a, b) => (a[0] < b[0] ? -1 : 1)), 62)
    + section('Pages', count(views, (r) => r.page))
    + section('Clicks', count(clicks, (r) => r.name))
    + section('Language', count(views, (r) => r.lang || 'unknown'))
    + section('Referrers', count(views, (r) => r.ref));
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: node deploy/stats-report.js FILE_OR_FOLDER...');
    process.exit(1);
  }
  const files = args.flatMap((a) => (fs.statSync(a).isDirectory()
    ? fs.readdirSync(a).filter((f) => f.endsWith('.tsv')).map((f) => path.join(a, f))
    : [a]));
  process.stdout.write(report(files.flatMap((f) => parse(fs.readFileSync(f, 'utf8')))));
}

module.exports = { parse, report };

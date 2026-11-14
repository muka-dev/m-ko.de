'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verdict } = require('../js/verdict-core.js');

test('examples land on the expected level', () => {
  assert.equal(verdict('Rechnungen löschen', 'de').level, 'approval');
  assert.equal(verdict('Kundenmail beantworten', 'de').level, 'approval');
  assert.equal(verdict('Dokument zusammenfassen', 'de').level, 'alone');
  assert.equal(verdict('Passwort ändern', 'de').level, 'never');
  assert.equal(verdict('summarise this report', 'en').level, 'alone');
  assert.equal(verdict('delete all invoices', 'en').level, 'approval');
  assert.equal(verdict('resumir o documento', 'pt').level, 'alone');
});

test('never beats approval beats alone', () => {
  assert.equal(verdict('Passwort lesen und senden', 'de').level, 'never');
  assert.equal(verdict('Mail entwerfen und senden', 'de').level, 'approval');
});

test('stems match at the start of a word only', () => {
  // "ausgelesen" contains "les" but not at a word start
  assert.equal(verdict('ausgelesen', 'de').unknown, true);
  assert.equal(verdict('lesen', 'de').level, 'alone');
});

test('"without asking" bumps one level, never stays never', () => {
  const r = verdict('Mails zusammenfassen ohne Rückfrage', 'de');
  assert.equal(r.level, 'approval');
  assert.equal(r.bumped, true);
  assert.equal(verdict('Rechnungen löschen ohne Rückfrage', 'de').level, 'never');
  assert.equal(verdict('Passwort ändern automatisch', 'de').level, 'never');
});

test('unknown input defaults to approval and says so', () => {
  const r = verdict('Quantenkaffee kalibrieren', 'de');
  assert.equal(r.level, 'approval');
  assert.equal(r.unknown, true);
});

test('same input gives the same verdict and reference', () => {
  assert.deepEqual(verdict('Termine eintragen', 'de'), verdict('Termine eintragen', 'de'));
  assert.match(verdict('x', 'en').ref, /^KI-\d{4}$/);
});

test('empty input gives no verdict; all three languages have quips', () => {
  assert.equal(verdict('   ', 'de'), null);
  for (const l of ['en', 'de', 'pt']) for (const t of ['lesen', 'löschen', 'passwort']) assert.ok(verdict(t, l).quip.length > 10);
});

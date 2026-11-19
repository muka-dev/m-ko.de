'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { recommend } = require('../js/adoption-check.js');

test('few ticks start with the book or the workshop', () => {
  assert.equal(recommend(0), 'start');
  assert.equal(recommend(2), 'start');
});

test('some ticks lead to days 1 to 30', () => {
  assert.equal(recommend(3), 'clarity');
  assert.equal(recommend(4), 'clarity');
});

test('all five lead straight into the pilot', () => {
  assert.equal(recommend(5), 'pilot');
});

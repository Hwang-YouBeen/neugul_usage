import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_MOOD_THRESHOLDS, moodFor } from '../src/core/mood.ts';

test('maps each default band to its mood', () => {
  assert.equal(moodFor(100), 'ecstatic');
  assert.equal(moodFor(90), 'ecstatic');
  assert.equal(moodFor(89), 'happy');
  assert.equal(moodFor(65), 'happy');
  assert.equal(moodFor(64), 'neutral');
  assert.equal(moodFor(40), 'neutral');
  assert.equal(moodFor(39), 'worried');
  assert.equal(moodFor(20), 'worried');
  assert.equal(moodFor(19), 'panic');
  assert.equal(moodFor(5), 'panic');
  assert.equal(moodFor(4), 'exhausted');
  assert.equal(moodFor(0), 'exhausted');
});

test('clamps values outside 0-100', () => {
  assert.equal(moodFor(1000), 'ecstatic');
  assert.equal(moodFor(-20), 'exhausted');
  assert.equal(moodFor(Number.NaN), 'exhausted');
});

test('honours custom thresholds', () => {
  assert.equal(moodFor(70, [95, 80, 50, 30, 10]), 'neutral');
  assert.equal(moodFor(85, [95, 80, 50, 30, 10]), 'happy');
});

test('falls back to defaults when thresholds are malformed', () => {
  // Ascending order is invalid and must not change the result.
  assert.equal(moodFor(70, [10, 30, 50, 80, 95]), moodFor(70, DEFAULT_MOOD_THRESHOLDS));
  assert.equal(moodFor(70, [50]), moodFor(70));
});

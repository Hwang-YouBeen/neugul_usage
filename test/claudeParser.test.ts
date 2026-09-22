import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSnapshot } from '../src/sources/claudeParser.ts';

test('reads both windows from a bridge snapshot', () => {
  const usage = parseSnapshot({
    schema: 1,
    capturedAt: 1790052059123,
    model: { id: 'claude-sonnet-4-6', display_name: 'Sonnet 4.6' },
    rateLimits: {
      fiveHour: { usedPercent: 23.5, resetsAt: 1738425600 },
      sevenDay: { usedPercent: 41.2, resetsAt: 1738857600 }
    }
  });

  assert.ok(usage);
  assert.equal(usage.agent, 'claude');
  assert.equal(usage.modelLabel, 'Sonnet 4.6');
  assert.equal(usage.windows.fiveHour?.remainingPercent, 76.5);
  assert.equal(usage.windows.fiveHour?.resetsAt, 1738425600 * 1000);
  assert.equal(usage.windows.longTerm?.windowMinutes, 10080);
});

test('accepts an ISO 8601 reset time', () => {
  const usage = parseSnapshot({
    rateLimits: { fiveHour: { usedPercent: 10, resetsAt: '2026-09-22T10:00:00.000Z' } }
  });
  assert.equal(usage?.windows.fiveHour?.resetsAt, Date.parse('2026-09-22T10:00:00.000Z'));
});

test('handles independently absent windows', () => {
  const usage = parseSnapshot({ rateLimits: { sevenDay: { usedPercent: 80 } } });
  assert.equal(usage?.windows.fiveHour, undefined);
  assert.equal(usage?.windows.longTerm?.remainingPercent, 20);
});

test('returns undefined when rate limits are missing entirely', () => {
  assert.equal(parseSnapshot({ schema: 1 }), undefined);
  assert.equal(parseSnapshot({ rateLimits: {} }), undefined);
  assert.equal(parseSnapshot(null), undefined);
});

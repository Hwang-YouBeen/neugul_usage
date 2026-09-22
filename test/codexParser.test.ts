import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRolloutLine } from '../src/sources/codexParser.ts';

/** Shape taken verbatim from a live ~/.codex rollout file. */
const SAMPLE = JSON.stringify({
  timestamp: '2026-09-21T23:54:44.693Z',
  ordinal: 38,
  type: 'event_msg',
  payload: {
    type: 'token_count',
    info: { model_context_window: 258400 },
    rate_limits: {
      limit_id: 'codex',
      primary: { used_percent: 1.0, window_minutes: 300, resets_at: 1790052059 },
      secondary: { used_percent: 61.0, window_minutes: 10080, resets_at: 1790238988 },
      credits: { has_credits: false, unlimited: false, balance: '0' },
      plan_type: 'plus'
    }
  }
});

test('reads both windows and converts used to remaining', () => {
  const usage = parseRolloutLine(SAMPLE);
  assert.ok(usage);
  assert.equal(usage.agent, 'codex');
  assert.equal(usage.planType, 'plus');
  assert.equal(usage.windows.fiveHour?.remainingPercent, 99);
  assert.equal(usage.windows.longTerm?.remainingPercent, 39);
  assert.equal(usage.windows.fiveHour?.windowMinutes, 300);
});

test('converts resets_at from epoch seconds to milliseconds', () => {
  const usage = parseRolloutLine(SAMPLE);
  assert.equal(usage?.windows.fiveHour?.resetsAt, 1790052059 * 1000);
});

test('tolerates a missing secondary window', () => {
  const line = JSON.stringify({
    timestamp: '2026-09-21T23:54:44.693Z',
    payload: { type: 'token_count', rate_limits: { primary: { used_percent: 40 } } }
  });
  const usage = parseRolloutLine(line);
  assert.equal(usage?.windows.fiveHour?.remainingPercent, 60);
  assert.equal(usage?.windows.longTerm, undefined);
});

test('returns undefined for lines without rate limits', () => {
  assert.equal(parseRolloutLine('{"payload":{"type":"token_count"}}'), undefined);
  assert.equal(parseRolloutLine('not json'), undefined);
  assert.equal(
    parseRolloutLine('{"payload":{"type":"token_count","rate_limits":null}}'),
    undefined
  );
});

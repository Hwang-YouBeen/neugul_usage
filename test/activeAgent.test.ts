import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveActiveAgent, terminalHintFrom } from '../src/core/activeAgent.ts';
import type { AgentId, SourceStatus } from '../src/core/types.ts';

const NOW = 1_800_000_000_000;
const STALE_MS = 30 * 60_000;

function ok(agent: AgentId, observedAt: number): SourceStatus {
  return {
    state: 'ok',
    usage: { agent, lastUpdatedAt: observedAt, observedAt, windows: {} }
  };
}

const missing: SourceStatus = { state: 'no-data', reason: 'no-session' };

test('picks the most recently observed agent', () => {
  const active = resolveActiveAgent({
    mode: 'auto',
    statuses: { codex: ok('codex', NOW - 60_000), claude: ok('claude', NOW - 5_000) },
    lastActive: 'codex',
    staleAfterMs: STALE_MS,
    now: NOW
  });
  assert.equal(active, 'claude');
});

test('falls back to the only agent with data', () => {
  const active = resolveActiveAgent({
    mode: 'auto',
    statuses: { codex: missing, claude: ok('claude', NOW - 5_000) },
    lastActive: 'codex',
    staleAfterMs: STALE_MS,
    now: NOW
  });
  assert.equal(active, 'claude');
});

test('keeps the previous choice when both agents are stale', () => {
  const active = resolveActiveAgent({
    mode: 'auto',
    statuses: { codex: ok('codex', NOW - 2 * STALE_MS), claude: ok('claude', NOW - 3 * STALE_MS) },
    lastActive: 'claude',
    staleAfterMs: STALE_MS,
    now: NOW
  });
  assert.equal(active, 'claude');
});

test('a focused terminal breaks a near tie', () => {
  const statuses = {
    codex: ok('codex', NOW - 20_000),
    claude: ok('claude', NOW - 10_000)
  };
  assert.equal(
    resolveActiveAgent({ mode: 'auto', statuses, lastActive: 'claude', staleAfterMs: STALE_MS, now: NOW }),
    'claude'
  );
  assert.equal(
    resolveActiveAgent({
      mode: 'auto',
      statuses,
      terminalHint: 'codex',
      lastActive: 'claude',
      staleAfterMs: STALE_MS,
      now: NOW
    }),
    'codex'
  );
});

test('a pinned mode ignores observation times', () => {
  const active = resolveActiveAgent({
    mode: 'codex',
    statuses: { codex: missing, claude: ok('claude', NOW) },
    lastActive: 'claude',
    staleAfterMs: STALE_MS,
    now: NOW
  });
  assert.equal(active, 'codex');
});

test('terminal hints need an unambiguous name', () => {
  assert.equal(terminalHintFrom('claude code'), 'claude');
  assert.equal(terminalHintFrom('codex'), 'codex');
  assert.equal(terminalHintFrom('zsh'), undefined);
  assert.equal(terminalHintFrom('codex vs claude'), undefined);
});

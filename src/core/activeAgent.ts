import type { AgentId, SourceStatus } from './types';

/** A terminal named/running `codex` or `claude` nudges the decision this much. */
const TERMINAL_BONUS_MS = 30_000;

export interface ActiveAgentInput {
  mode: 'auto' | 'codex' | 'claude' | 'both';
  statuses: Record<AgentId, SourceStatus>;
  /** Agent hinted by the focused terminal, if any. */
  terminalHint?: AgentId;
  /** Previous decision, kept when nothing is fresh enough to switch. */
  lastActive: AgentId;
  staleAfterMs: number;
  now?: number;
}

/**
 * Picks which agent the UI should show. See docs/SPEC.md §4.
 *
 * In `auto` mode the most recently observed agent wins. When both are stale we
 * keep the previous choice so the panel does not flip on its own.
 */
export function resolveActiveAgent(input: ActiveAgentInput): AgentId {
  if (input.mode === 'codex' || input.mode === 'claude') {
    return input.mode;
  }

  const now = input.now ?? Date.now();
  const codex = score(input.statuses.codex, 'codex', input);
  const claude = score(input.statuses.claude, 'claude', input);

  if (codex === undefined && claude === undefined) {
    return input.lastActive;
  }
  if (codex === undefined) {
    return 'claude';
  }
  if (claude === undefined) {
    return 'codex';
  }

  const best = Math.max(codex, claude);
  if (now - best > input.staleAfterMs) {
    return input.lastActive;
  }
  return codex >= claude ? 'codex' : 'claude';
}

function score(
  status: SourceStatus | undefined,
  agent: AgentId,
  input: ActiveAgentInput
): number | undefined {
  if (status?.state !== 'ok') {
    return undefined;
  }
  const bonus = input.terminalHint === agent ? TERMINAL_BONUS_MS : 0;
  return status.usage.observedAt + bonus;
}

/** Best-effort guess at which CLI the focused terminal is running. */
export function terminalHintFrom(name: string | undefined, commandLine?: string): AgentId | undefined {
  const haystack = `${name ?? ''} ${commandLine ?? ''}`.toLowerCase();
  const hasClaude = haystack.includes('claude');
  const hasCodex = haystack.includes('codex');
  if (hasClaude === hasCodex) {
    return undefined;
  }
  return hasClaude ? 'claude' : 'codex';
}

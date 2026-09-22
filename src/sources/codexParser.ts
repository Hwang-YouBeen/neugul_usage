import type { AgentUsage, UsageWindow } from '../core/types';
import { toEpochMs } from '../util/time.ts';

/**
 * Pure parsing for Codex rollout lines. Kept free of the `vscode` import so it
 * can be unit tested outside the extension host.
 *
 * Verified against a live ~/.codex install; see docs/SPEC.md §3.1.
 */
export function parseRolloutLine(line: string): AgentUsage | undefined {
  let record: any;
  try {
    record = JSON.parse(line);
  } catch {
    return undefined;
  }

  const limits = record?.payload?.rate_limits;
  if (!limits || typeof limits !== 'object') {
    return undefined;
  }

  const windows: AgentUsage['windows'] = {};
  const primary = parseWindow(limits.primary, 'fiveHour');
  if (primary) {
    windows.fiveHour = primary;
  }
  const secondary = parseWindow(limits.secondary, 'longTerm');
  if (secondary) {
    windows.longTerm = secondary;
  }

  const unlimited = limits.credits?.unlimited === true;
  if (Object.keys(windows).length === 0 && !unlimited) {
    return undefined;
  }

  return {
    agent: 'codex',
    lastUpdatedAt: Date.now(),
    observedAt: toEpochMs(record?.timestamp) ?? Date.now(),
    windows,
    planType: typeof limits.plan_type === 'string' ? limits.plan_type : undefined,
    unlimited
  };
}

/** Cheap pre-filter applied before JSON.parse, since rollout lines are large. */
export function hasRateLimits(line: string): boolean {
  return line.includes('"token_count"') && line.includes('"rate_limits"');
}

function parseWindow(raw: any, kind: UsageWindow['kind']): UsageWindow | undefined {
  if (!raw || typeof raw.used_percent !== 'number' || !Number.isFinite(raw.used_percent)) {
    return undefined;
  }
  const usedPercent = Math.min(100, Math.max(0, raw.used_percent));
  return {
    kind,
    usedPercent,
    remainingPercent: 100 - usedPercent,
    resetsAt: toEpochMs(raw.resets_at),
    windowMinutes: typeof raw.window_minutes === 'number' ? raw.window_minutes : undefined
  };
}

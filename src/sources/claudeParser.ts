import type { AgentUsage, UsageWindow } from '../core/types';
import { toEpochMs } from '../util/time.ts';

/**
 * Pure parsing for the snapshot written by bridge/claude-statusline.js.
 * Kept free of the `vscode` import so it can be unit tested.
 *
 * See docs/SPEC.md §3.2.
 */
export function parseSnapshot(snapshot: any): AgentUsage | undefined {
  const limits = snapshot?.rateLimits;
  if (!limits || typeof limits !== 'object') {
    return undefined;
  }

  const windows: AgentUsage['windows'] = {};
  const five = parseWindow(limits.fiveHour, 'fiveHour', 300);
  if (five) {
    windows.fiveHour = five;
  }
  const week = parseWindow(limits.sevenDay, 'longTerm', 10080);
  if (week) {
    windows.longTerm = week;
  }

  if (Object.keys(windows).length === 0) {
    return undefined;
  }

  return {
    agent: 'claude',
    lastUpdatedAt: Date.now(),
    observedAt: typeof snapshot.capturedAt === 'number' ? snapshot.capturedAt : Date.now(),
    windows,
    modelLabel: snapshot.model?.display_name,
    unlimited: false
  };
}

function parseWindow(
  raw: any,
  kind: UsageWindow['kind'],
  windowMinutes: number
): UsageWindow | undefined {
  if (!raw || typeof raw.usedPercent !== 'number' || !Number.isFinite(raw.usedPercent)) {
    return undefined;
  }
  const usedPercent = Math.min(100, Math.max(0, raw.usedPercent));
  return {
    kind,
    usedPercent,
    remainingPercent: 100 - usedPercent,
    // Claude Code has emitted resets_at both as epoch seconds and as ISO 8601.
    resetsAt: toEpochMs(raw.resetsAt),
    windowMinutes
  };
}

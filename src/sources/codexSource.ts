import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { SourceStatus, UsageSource } from '../core/types';
import { codexDayDir, codexHome, codexSessionsDir } from '../util/paths';
import { findLastLine } from '../util/tailRead';
import { PathWatcher } from '../util/watcher';
import type { Logger } from '../util/log';
import { hasRateLimits, parseRolloutLine } from './codexParser';

/** Only inspect this many recent rollout files before giving up. */
const MAX_FILES = 5;
/** Never walk back further than this within a single rollout file. */
const MAX_TAIL_BYTES = 1024 * 1024;

/**
 * Reads Codex CLI rate limits from session rollout files under
 * ~/.codex/sessions/YYYY/MM/DD/. See docs/SPEC.md §3.1.
 *
 * Rollout files reach tens of megabytes, so only the tail is ever read and
 * parsing is skipped entirely when no file has been modified.
 */
export class CodexSource implements UsageSource {
  readonly agent = 'codex' as const;

  private readonly emitter = new vscode.EventEmitter<SourceStatus>();
  readonly onDidChange = this.emitter.event;

  private current: SourceStatus = { state: 'no-data', reason: 'no-session' };
  private readonly watcher: PathWatcher;
  private lastSignature = '';
  private refreshing = false;

  constructor(
    private readonly log: Logger,
    private homeOverride: string,
    pollIntervalMs: number
  ) {
    this.watcher = new PathWatcher(() => void this.refresh(), log);
    this.watcher.setPollInterval(pollIntervalMs);
  }

  get status(): SourceStatus {
    return this.current;
  }

  start(): void {
    this.rebindWatchPaths();
    void this.refresh();
  }

  reconfigure(homeOverride: string, pollIntervalMs: number): void {
    this.homeOverride = homeOverride;
    this.watcher.setPollInterval(pollIntervalMs);
    this.lastSignature = '';
    this.rebindWatchPaths();
    void this.refresh();
  }

  async refresh(): Promise<SourceStatus> {
    if (this.refreshing) {
      return this.current;
    }
    this.refreshing = true;
    try {
      const next = await this.read();
      if (next) {
        this.current = next;
        this.emitter.fire(next);
      }
      return this.current;
    } finally {
      this.refreshing = false;
    }
  }

  /** Returns undefined when nothing changed since the previous read. */
  private async read(): Promise<SourceStatus | undefined> {
    const home = codexHome(this.homeOverride);
    const sessionsDir = codexSessionsDir(this.homeOverride);

    if (!(await exists(home))) {
      return {
        state: 'no-data',
        reason: 'not-installed',
        detail: `${home} 경로를 찾을 수 없습니다.`
      };
    }

    const files = await recentRolloutFiles(sessionsDir);
    if (files.length === 0) {
      return {
        state: 'no-data',
        reason: 'no-session',
        detail: `${sessionsDir} 에서 최근 세션을 찾을 수 없습니다.`
      };
    }

    const signature = files.map((f) => `${f.filePath}:${f.mtimeMs}`).join('|');
    if (signature === this.lastSignature) {
      return undefined;
    }
    this.lastSignature = signature;

    for (const file of files) {
      const line = await findLastLine(file.filePath, hasRateLimits, { maxBytes: MAX_TAIL_BYTES });
      if (!line) {
        continue;
      }
      const usage = parseRolloutLine(line);
      if (usage) {
        this.log.debug(`codex: ${path.basename(file.filePath)} → ${JSON.stringify(usage.windows)}`);
        return { state: 'ok', usage };
      }
    }

    return {
      state: 'no-data',
      reason: 'awaiting-first-response',
      detail: 'Codex 세션에서 아직 사용량 정보를 받지 못했습니다.'
    };
  }

  private rebindWatchPaths(): void {
    const sessionsDir = codexSessionsDir(this.homeOverride);
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Watching the root too means a new day folder created at midnight is
    // picked up without restarting the extension.
    this.watcher.setPaths([
      sessionsDir,
      codexDayDir(sessionsDir, now),
      codexDayDir(sessionsDir, yesterday)
    ]);
  }

  dispose(): void {
    this.watcher.dispose();
    this.emitter.dispose();
  }
}

interface RolloutFile {
  filePath: string;
  mtimeMs: number;
}

/** Newest rollout files from today and yesterday, most recent first. */
async function recentRolloutFiles(sessionsDir: string): Promise<RolloutFile[]> {
  const now = new Date();
  const dirs = [
    codexDayDir(sessionsDir, now),
    codexDayDir(sessionsDir, new Date(now.getTime() - 24 * 60 * 60 * 1000))
  ];

  const found: RolloutFile[] = [];
  for (const dir of dirs) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.jsonl')) {
        continue;
      }
      const filePath = path.join(dir, entry);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          found.push({ filePath, mtimeMs: stat.mtimeMs });
        }
      } catch {
        // The file vanished between readdir and stat.
      }
    }
  }

  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found.slice(0, MAX_FILES);
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

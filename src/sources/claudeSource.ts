import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import type { SourceStatus, UsageSource } from '../core/types';
import { claudeSnapshotPath, snapshotDir } from '../util/paths';
import { PathWatcher } from '../util/watcher';
import type { Logger } from '../util/log';
import { isBridgeInstalled } from '../bridge/installer';
import { parseSnapshot } from './claudeParser';

/**
 * Reads Claude Code rate limits from the snapshot written by
 * bridge/claude-statusline.js. See docs/SPEC.md §3.2.
 *
 * Claude Code does not persist subscription limits anywhere on disk, so the
 * statusline bridge is the only supported way to observe them.
 */
export class ClaudeSource implements UsageSource {
  readonly agent = 'claude' as const;

  private readonly emitter = new vscode.EventEmitter<SourceStatus>();
  readonly onDidChange = this.emitter.event;

  private current: SourceStatus = { state: 'no-data', reason: 'bridge-missing' };
  private readonly watcher: PathWatcher;
  private lastMtimeMs = -1;
  private refreshing = false;

  constructor(
    private readonly log: Logger,
    private configDirOverride: string,
    pollIntervalMs: number
  ) {
    this.watcher = new PathWatcher(() => void this.refresh(), log);
    this.watcher.setPollInterval(pollIntervalMs);
  }

  get status(): SourceStatus {
    return this.current;
  }

  start(): void {
    this.watcher.setPaths([snapshotDir(), claudeSnapshotPath()]);
    void this.refresh();
  }

  reconfigure(configDirOverride: string, pollIntervalMs: number): void {
    this.configDirOverride = configDirOverride;
    this.watcher.setPollInterval(pollIntervalMs);
    this.lastMtimeMs = -1;
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

  private async read(): Promise<SourceStatus | undefined> {
    const file = claudeSnapshotPath();

    let mtimeMs: number;
    try {
      mtimeMs = (await fs.stat(file)).mtimeMs;
    } catch {
      this.lastMtimeMs = -1;
      // No snapshot yet. Distinguish "not connected" from "connected but idle"
      // so the panel can offer the right next step.
      return (await isBridgeInstalled(this.configDirOverride))
        ? {
            state: 'no-data',
            reason: 'awaiting-first-response',
            detail: 'Claude Code에서 메시지를 한 번 보내면 사용량이 표시됩니다.'
          }
        : {
            state: 'no-data',
            reason: 'bridge-missing',
            detail: 'Claude Code 사용량을 보려면 연동이 필요합니다.'
          };
    }

    if (mtimeMs === this.lastMtimeMs) {
      return undefined;
    }
    this.lastMtimeMs = mtimeMs;

    let snapshot: unknown;
    try {
      snapshot = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (err) {
      this.log.debug(`claude: snapshot parse failed: ${err}`);
      return undefined;
    }

    const usage = parseSnapshot(snapshot);
    if (!usage) {
      return {
        state: 'no-data',
        reason: 'api-key-user',
        detail:
          'rate_limits 정보가 없습니다. API Key 세션이거나 Claude Code 버전이 2.1.80보다 낮을 수 있습니다.'
      };
    }

    this.log.debug(`claude: ${JSON.stringify(usage.windows)}`);
    return { state: 'ok', usage };
  }

  dispose(): void {
    this.watcher.dispose();
    this.emitter.dispose();
  }
}

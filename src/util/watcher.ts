import * as fs from 'node:fs';
import type { Logger } from './log';

/**
 * Watches a set of paths and also polls on an interval.
 *
 * fs.watch is unreliable on Windows, network drives and some Linux setups, so
 * polling always runs alongside it. The callback is debounced; callers are
 * expected to cheaply no-op when nothing actually changed.
 */
export class PathWatcher {
  private watchers: fs.FSWatcher[] = [];
  private timer: NodeJS.Timeout | undefined;
  private debounce: NodeJS.Timeout | undefined;
  private disposed = false;

  constructor(
    private readonly onChange: () => void,
    private readonly log: Logger,
    private readonly debounceMs = 250
  ) {}

  /** Replaces the watched path set. Paths that do not exist are skipped. */
  setPaths(paths: readonly string[]): void {
    this.closeWatchers();
    if (this.disposed) {
      return;
    }
    for (const target of paths) {
      try {
        if (!fs.existsSync(target)) {
          continue;
        }
        const watcher = fs.watch(target, { persistent: false }, () => this.trigger());
        watcher.on('error', (err) => this.log.debug(`watch error on ${target}: ${err}`));
        this.watchers.push(watcher);
      } catch (err) {
        this.log.debug(`cannot watch ${target}: ${err}`);
      }
    }
  }

  setPollInterval(ms: number): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => this.trigger(), Math.max(1000, ms));
  }

  private trigger(): void {
    if (this.disposed) {
      return;
    }
    if (this.debounce) {
      clearTimeout(this.debounce);
    }
    this.debounce = setTimeout(() => this.onChange(), this.debounceMs);
  }

  private closeWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {
        // already closed
      }
    }
    this.watchers = [];
  }

  dispose(): void {
    this.disposed = true;
    this.closeWatchers();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.debounce) {
      clearTimeout(this.debounce);
      this.debounce = undefined;
    }
  }
}

import * as os from 'node:os';
import * as path from 'node:path';

export function codexHome(override?: string): string {
  if (override && override.trim()) {
    return expandHome(override.trim());
  }
  const env = process.env.CODEX_HOME;
  if (env && env.trim()) {
    return expandHome(env.trim());
  }
  return path.join(os.homedir(), '.codex');
}

export function codexSessionsDir(override?: string): string {
  return path.join(codexHome(override), 'sessions');
}

export function claudeConfigDir(override?: string): string {
  if (override && override.trim()) {
    return expandHome(override.trim());
  }
  const env = process.env.CLAUDE_CONFIG_DIR;
  if (env && env.trim()) {
    return expandHome(env.trim());
  }
  return path.join(os.homedir(), '.claude');
}

export function claudeSettingsPath(override?: string): string {
  return path.join(claudeConfigDir(override), 'settings.json');
}

/** Where the statusline bridge drops its snapshot. Shared with bridge/claude-statusline.js. */
export function snapshotDir(): string {
  return path.join(os.homedir(), '.neugul-usage');
}

export function claudeSnapshotPath(): string {
  return path.join(snapshotDir(), 'claude-usage.json');
}

/** Session rollout directory for a given date: <sessions>/YYYY/MM/DD */
export function codexDayDir(sessionsDir: string, date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return path.join(sessionsDir, yyyy, mm, dd);
}

function expandHome(p: string): string {
  if (p === '~') {
    return os.homedir();
  }
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

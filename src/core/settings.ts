import * as vscode from 'vscode';
import { DEFAULT_MOOD_THRESHOLDS } from './mood';
import type { WindowKind } from './types';

export interface Settings {
  agent: 'auto' | 'codex' | 'claude' | 'both';
  primaryWindow: WindowKind;
  refreshIntervalMs: number;
  staleAfterMinutes: number;
  statusBarEnabled: boolean;
  statusBarAlignment: 'left' | 'right';
  statusBarPriority: number;
  statusBarWidth: number;
  statusBarShowMood: boolean;
  animation: 'full' | 'subtle' | 'off';
  moodThresholds: number[];
  notifyAtRemaining: number[];
  codexHomeDir: string;
  claudeConfigDir: string;
  claudeFallbackTokenLimit: number;
}

export const CONFIG_SECTION = 'neugulUsage';

export function readSettings(): Settings {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    agent: cfg.get<Settings['agent']>('agent', 'auto'),
    primaryWindow: cfg.get<WindowKind>('primaryWindow', 'fiveHour'),
    refreshIntervalMs: Math.max(1000, cfg.get<number>('refreshIntervalMs', 5000)),
    staleAfterMinutes: Math.max(1, cfg.get<number>('staleAfterMinutes', 30)),
    statusBarEnabled: cfg.get<boolean>('statusBar.enabled', true),
    statusBarAlignment: cfg.get<Settings['statusBarAlignment']>('statusBar.alignment', 'right'),
    statusBarPriority: cfg.get<number>('statusBar.priority', 100),
    statusBarWidth: Math.min(30, Math.max(4, cfg.get<number>('statusBar.width', 10))),
    statusBarShowMood: cfg.get<boolean>('statusBar.showMood', true),
    animation: cfg.get<Settings['animation']>('animation', 'full'),
    moodThresholds: cfg.get<number[]>('moodThresholds', [...DEFAULT_MOOD_THRESHOLDS]),
    notifyAtRemaining: cfg.get<number[]>('notifyAtRemaining', [20, 5]),
    codexHomeDir: cfg.get<string>('codex.homeDir', ''),
    claudeConfigDir: cfg.get<string>('claude.configDir', ''),
    claudeFallbackTokenLimit: cfg.get<number>('claude.fallbackTokenLimit', 0)
  };
}

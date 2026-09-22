import type * as vscode from 'vscode';

export type AgentId = 'codex' | 'claude';

export type Mood = 'ecstatic' | 'happy' | 'neutral' | 'worried' | 'panic' | 'exhausted';

export type WindowKind = 'fiveHour' | 'longTerm';

export interface UsageWindow {
  kind: WindowKind;
  /** 0-100 */
  usedPercent: number;
  /** 0-100, always 100 - usedPercent */
  remainingPercent: number;
  /** epoch ms */
  resetsAt?: number;
  windowMinutes?: number;
}

export interface AgentUsage {
  agent: AgentId;
  /** epoch ms, when the extension last read this value */
  lastUpdatedAt: number;
  /** epoch ms of the underlying CLI event, used to decide which agent is active */
  observedAt: number;
  windows: Partial<Record<WindowKind, UsageWindow>>;
  planType?: string;
  unlimited?: boolean;
  /** true when the numbers are derived rather than reported by the server */
  estimated?: boolean;
  modelLabel?: string;
}

export type NoDataReason =
  | 'not-installed'
  | 'no-session'
  | 'bridge-missing'
  | 'awaiting-first-response'
  | 'api-key-user';

export type SourceStatus =
  | { state: 'ok'; usage: AgentUsage }
  | { state: 'no-data'; reason: NoDataReason; detail?: string }
  | { state: 'error'; message: string };

export interface UsageSource {
  readonly agent: AgentId;
  readonly onDidChange: vscode.Event<SourceStatus>;
  readonly status: SourceStatus;
  start(): void;
  refresh(): Promise<SourceStatus>;
  dispose(): void;
}

/** Payload sent to the webview. Keep it flat and serialisable. */
export interface UsageViewState {
  agentMode: 'auto' | 'codex' | 'claude' | 'both';
  activeAgent: AgentId;
  primaryWindow: WindowKind;
  animation: 'full' | 'subtle' | 'off';
  renderedAt: number;
  agents: AgentViewState[];
}

export interface AgentViewState {
  agent: AgentId;
  label: string;
  isActive: boolean;
  /** true when no activity for longer than staleAfterMinutes */
  isStale: boolean;
  mood: Mood;
  status: SourceStatus;
}

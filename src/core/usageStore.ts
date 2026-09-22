import * as vscode from 'vscode';
import { resolveActiveAgent, terminalHintFrom } from './activeAgent';
import { moodFor } from './mood';
import { readSettings, type Settings } from './settings';
import type {
  AgentId,
  AgentViewState,
  SourceStatus,
  UsageSource,
  UsageViewState,
  UsageWindow
} from './types';

const AGENT_LABEL: Record<AgentId, string> = {
  codex: 'Codex',
  claude: 'Claude Code'
};

/** Do not flip the active agent more often than this. */
const SWITCH_DEBOUNCE_MS = 5000;

/**
 * Single source of truth for the UI. Sources push status changes in, the
 * status bar and webview render whatever `state` says. No UI component
 * recomputes moods or picks the active agent on its own.
 */
export class UsageStore implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<UsageViewState>();
  readonly onDidChange = this.emitter.event;

  private readonly disposables: vscode.Disposable[] = [];
  private settings: Settings;
  private activeAgent: AgentId = 'codex';
  private lastSwitchAt = 0;
  private notified = new Map<AgentId, number>();

  constructor(private readonly sources: Record<AgentId, UsageSource>) {
    this.settings = readSettings();
    for (const source of Object.values(sources)) {
      this.disposables.push(source.onDidChange(() => this.recompute()));
    }
    this.disposables.push(
      vscode.window.onDidChangeActiveTerminal(() => this.recompute()),
      this.emitter
    );
  }

  get state(): UsageViewState {
    return this.build();
  }

  get currentSettings(): Settings {
    return this.settings;
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    this.recompute();
  }

  async refreshAll(): Promise<void> {
    await Promise.all(Object.values(this.sources).map((s) => s.refresh()));
    this.recompute();
  }

  private recompute(): void {
    const next = resolveActiveAgent({
      mode: this.settings.agent,
      statuses: {
        codex: this.sources.codex.status,
        claude: this.sources.claude.status
      },
      terminalHint: this.currentTerminalHint(),
      lastActive: this.activeAgent,
      staleAfterMs: this.settings.staleAfterMinutes * 60_000
    });

    const now = Date.now();
    if (next !== this.activeAgent && now - this.lastSwitchAt >= SWITCH_DEBOUNCE_MS) {
      this.activeAgent = next;
      this.lastSwitchAt = now;
    }

    this.maybeNotify();
    this.emitter.fire(this.build());
  }

  private currentTerminalHint(): AgentId | undefined {
    const terminal = vscode.window.activeTerminal;
    if (!terminal) {
      return undefined;
    }
    return terminalHintFrom(terminal.name);
  }

  private build(): UsageViewState {
    const staleAfterMs = this.settings.staleAfterMinutes * 60_000;
    const now = Date.now();

    const agents: AgentViewState[] = (['codex', 'claude'] as AgentId[]).map((agent) => {
      const status = this.sources[agent].status;
      const window = status.state === 'ok' ? this.primaryWindowOf(status) : undefined;
      return {
        agent,
        label: AGENT_LABEL[agent],
        isActive: agent === this.activeAgent,
        isStale: status.state === 'ok' ? now - status.usage.observedAt > staleAfterMs : false,
        mood: moodFor(window?.remainingPercent ?? 0, this.settings.moodThresholds),
        status
      };
    });

    return {
      agentMode: this.settings.agent,
      activeAgent: this.activeAgent,
      primaryWindow: this.settings.primaryWindow,
      animation: this.settings.animation,
      renderedAt: now,
      agents
    };
  }

  /** The window the character follows, falling back to whichever exists. */
  private primaryWindowOf(status: Extract<SourceStatus, { state: 'ok' }>): UsageWindow | undefined {
    const { windows } = status.usage;
    return windows[this.settings.primaryWindow] ?? windows.fiveHour ?? windows.longTerm;
  }

  private maybeNotify(): void {
    const thresholds = [...this.settings.notifyAtRemaining].sort((a, b) => b - a);
    if (thresholds.length === 0) {
      return;
    }
    const status = this.sources[this.activeAgent].status;
    if (status.state !== 'ok') {
      return;
    }
    const window = this.primaryWindowOf(status);
    if (!window) {
      return;
    }

    const remaining = window.remainingPercent;
    const crossed = thresholds.find((t) => remaining < t);
    const previous = this.notified.get(this.activeAgent);

    if (crossed === undefined) {
      // Window reset; allow notifying again.
      this.notified.delete(this.activeAgent);
      return;
    }
    if (previous === crossed) {
      return;
    }
    this.notified.set(this.activeAgent, crossed);
    void vscode.window.showWarningMessage(
      `${AGENT_LABEL[this.activeAgent]} 사용량이 ${Math.round(remaining)}% 남았습니다.`
    );
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

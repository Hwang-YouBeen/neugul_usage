import * as vscode from 'vscode';
import { MOOD_EMOJI, MOOD_LABEL_KO } from '../core/mood';
import type { Settings } from '../core/settings';
import type { AgentViewState, UsageViewState, UsageWindow } from '../core/types';
import { formatAgo, formatCountdown } from '../util/time';

const FILLED = '▰';
const EMPTY = '▱';
/** Brand mark. Always shown, including empty and unlimited states. */
const RACCOON = '🦝';

export class StatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem | undefined;

  constructor(private settings: Settings) {
    this.rebuild();
  }

  applySettings(settings: Settings): void {
    const needsRebuild =
      settings.statusBarEnabled !== this.settings.statusBarEnabled ||
      settings.statusBarAlignment !== this.settings.statusBarAlignment ||
      settings.statusBarPriority !== this.settings.statusBarPriority;
    this.settings = settings;
    if (needsRebuild) {
      this.rebuild();
    }
  }

  render(state: UsageViewState): void {
    if (!this.item) {
      return;
    }
    const agent = state.agents.find((a) => a.agent === state.activeAgent);
    if (!agent) {
      this.item.hide();
      return;
    }

    if (agent.status.state !== 'ok') {
      this.item.text = `${RACCOON} ${agent.label} —`;
      this.item.tooltip = tooltipForMissing(agent);
      this.item.backgroundColor = undefined;
      this.item.show();
      return;
    }

    const usage = agent.status.usage;
    if (usage.unlimited) {
      this.item.text = `${RACCOON} ${agent.label} 무제한`;
      this.item.tooltip = new vscode.MarkdownString(`**${agent.label}** · 무제한 크레딧`);
      this.item.backgroundColor = undefined;
      this.item.show();
      return;
    }

    const window = usage.windows[state.primaryWindow] ?? usage.windows.fiveHour ?? usage.windows.longTerm;
    if (!window) {
      this.item.hide();
      return;
    }

    const remaining = Math.round(window.remainingPercent);
    const mood = this.settings.statusBarShowMood ? ` ${MOOD_EMOJI[agent.mood]}` : '';
    const stale = agent.isStale ? ' $(circle-slash)' : '';

    this.item.text = `${RACCOON} ${agent.label} ${bar(window.remainingPercent, this.settings.statusBarWidth)} ${remaining}%${mood}${stale}`;
    this.item.tooltip = tooltipFor(agent, state);
    this.item.backgroundColor = undefined;
    this.item.show();
  }

  private rebuild(): void {
    this.item?.dispose();
    this.item = undefined;
    if (!this.settings.statusBarEnabled) {
      return;
    }
    const alignment =
      this.settings.statusBarAlignment === 'left'
        ? vscode.StatusBarAlignment.Left
        : vscode.StatusBarAlignment.Right;
    this.item = vscode.window.createStatusBarItem(
      'neugulUsage.status',
      alignment,
      this.settings.statusBarPriority
    );
    this.item.name = 'Neugul Usage';
    this.item.command = 'neugulUsage.showPanel';
  }

  dispose(): void {
    this.item?.dispose();
  }
}

function bar(remainingPercent: number, width: number): string {
  const filled = Math.round((remainingPercent / 100) * width);
  return FILLED.repeat(filled) + EMPTY.repeat(Math.max(0, width - filled));
}

function tooltipFor(agent: AgentViewState, state: UsageViewState): vscode.MarkdownString {
  const usage = agent.status.state === 'ok' ? agent.status.usage : undefined;
  const md = new vscode.MarkdownString();
  md.supportThemeIcons = true;

  const plan = usage?.planType ? ` · ${usage.planType} 플랜` : '';
  md.appendMarkdown(`**${agent.label}**${plan}\n\n`);
  md.appendMarkdown(`기분: ${MOOD_EMOJI[agent.mood]} ${MOOD_LABEL_KO[agent.mood]}\n\n`);

  if (usage) {
    md.appendMarkdown(windowLine('5시간 창', usage.windows.fiveHour));
    md.appendMarkdown(windowLine('장기 창', usage.windows.longTerm));
    if (usage.estimated) {
      md.appendMarkdown('\n\n_추정치입니다._');
    }
    md.appendMarkdown(`\n\n마지막 갱신 ${formatAgo(usage.observedAt)}`);
  }
  if (state.agentMode === 'auto') {
    md.appendMarkdown('\n\n_자동 선택 중_');
  }
  md.appendMarkdown('\n\n클릭하면 패널이 열립니다.');
  return md;
}

function windowLine(label: string, window: UsageWindow | undefined): string {
  if (!window) {
    return '';
  }
  const remaining = Math.round(window.remainingPercent);
  return `${label} — 잔여 ${remaining}% · ${formatCountdown(window.resetsAt)} 후 리셋\n\n`;
}

function tooltipForMissing(agent: AgentViewState): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**${agent.label}**\n\n`);
  if (agent.status.state === 'no-data') {
    md.appendMarkdown(agent.status.detail ?? '사용량 정보를 찾을 수 없습니다.');
  } else if (agent.status.state === 'error') {
    md.appendMarkdown(agent.status.message);
  }
  return md;
}

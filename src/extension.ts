import * as vscode from 'vscode';
import { installBridge, uninstallBridge } from './bridge/installer';
import { CONFIG_SECTION, readSettings } from './core/settings';
import { UsageStore } from './core/usageStore';
import type { AgentId, UsageSource } from './core/types';
import { ClaudeSource } from './sources/claudeSource';
import { CodexSource } from './sources/codexSource';
import { StatusBar } from './ui/statusBar';
import { UsageViewProvider } from './ui/usageViewProvider';
import { createLogger } from './util/log';

export function activate(context: vscode.ExtensionContext): void {
  const log = createLogger();
  const settings = readSettings();

  const codex = new CodexSource(log, settings.codexHomeDir, settings.refreshIntervalMs);
  const claude = new ClaudeSource(log, settings.claudeConfigDir, settings.refreshIntervalMs);
  const sources: Record<AgentId, UsageSource> = { codex, claude };

  const store = new UsageStore(sources);
  const statusBar = new StatusBar(settings);
  const view = new UsageViewProvider(context.extensionUri, store);

  context.subscriptions.push(
    log,
    codex,
    claude,
    store,
    statusBar,
    view,
    vscode.window.registerWebviewViewProvider(UsageViewProvider.viewType, view, {
      webviewOptions: { retainContextWhenHidden: false }
    }),
    store.onDidChange((state) => statusBar.render(state)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(CONFIG_SECTION)) {
        return;
      }
      const next = readSettings();
      codex.reconfigure(next.codexHomeDir, next.refreshIntervalMs);
      claude.reconfigure(next.claudeConfigDir, next.refreshIntervalMs);
      statusBar.applySettings(next);
      store.applySettings(next);
    }),
    vscode.commands.registerCommand('neugulUsage.refresh', () => store.refreshAll()),
    vscode.commands.registerCommand('neugulUsage.showPanel', () => view.reveal()),
    vscode.commands.registerCommand('neugulUsage.showLogs', () => log.show()),
    vscode.commands.registerCommand('neugulUsage.selectAgent', () => selectAgent()),
    vscode.commands.registerCommand('neugulUsage.installClaudeBridge', async () => {
      const current = readSettings();
      if (await installBridge(context, current.claudeConfigDir, log)) {
        await claude.refresh();
      }
    }),
    vscode.commands.registerCommand('neugulUsage.uninstallClaudeBridge', async () => {
      const current = readSettings();
      if (await uninstallBridge(current.claudeConfigDir, log)) {
        await claude.refresh();
      }
    })
  );

  codex.start();
  claude.start();
  statusBar.render(store.state);
  log.debug('neugul usage activated');
}

export function deactivate(): void {
  // All resources are registered in context.subscriptions.
}

async function selectAgent(): Promise<void> {
  const items: Array<vscode.QuickPickItem & { value: string }> = [
    { label: '자동', description: '최근에 사용한 에이전트를 따라갑니다', value: 'auto' },
    { label: 'Codex', description: 'Codex 고정', value: 'codex' },
    { label: 'Claude Code', description: 'Claude Code 고정', value: 'claude' },
    { label: '둘 다 보기', description: '패널에 두 에이전트를 함께 표시', value: 'both' }
  ];
  const picked = await vscode.window.showQuickPick(items, { title: '표시할 에이전트' });
  if (!picked) {
    return;
  }
  await vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .update('agent', picked.value, vscode.ConfigurationTarget.Global);
}

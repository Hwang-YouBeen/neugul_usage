import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { claudeConfigDir, claudeSettingsPath } from '../util/paths';
import type { Logger } from '../util/log';

const WRAPPED_KEY = 'neugulUsage.wrappedStatusLine';
const BACKUP_SUFFIX = '.neugul-backup';

export function bridgeScriptPath(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, 'bridge', 'claude-statusline.js');
}

function bridgeCommand(context: vscode.ExtensionContext): string {
  return `node "${bridgeScriptPath(context)}"`;
}

export async function isBridgeInstalled(configDirOverride: string): Promise<boolean> {
  const settings = await readSettings(claudeSettingsPath(configDirOverride));
  const command = settings?.statusLine?.command;
  return typeof command === 'string' && command.includes('claude-statusline.js');
}

/**
 * Points Claude Code's statusLine at the bridge, preserving any command the
 * user already had. This is the only place the extension writes to a file it
 * does not own, so it backs up first and always asks for confirmation.
 */
export async function installBridge(
  context: vscode.ExtensionContext,
  configDirOverride: string,
  log: Logger
): Promise<boolean> {
  const dir = claudeConfigDir(configDirOverride);
  const settingsPath = claudeSettingsPath(configDirOverride);

  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    void vscode.window.showErrorMessage(`Claude 설정 디렉터리를 만들 수 없습니다: ${err}`);
    return false;
  }

  const settings = (await readSettings(settingsPath)) ?? {};
  const existing = settings.statusLine;

  if (typeof existing?.command === 'string' && existing.command.includes('claude-statusline.js')) {
    void vscode.window.showInformationMessage('이미 연동되어 있습니다.');
    return true;
  }

  const summary = existing
    ? `기존 statusLine 명령을 보존한 채 감싸서 실행합니다.\n\n기존: ${existing.command}\n신규: ${bridgeCommand(context)}`
    : `Claude Code의 statusLine에 아래 명령을 설정합니다.\n\n${bridgeCommand(context)}`;

  const answer = await vscode.window.showWarningMessage(
    `${settingsPath} 파일을 수정합니다.`,
    { modal: true, detail: `${summary}\n\n수정 전 원본은 ${path.basename(settingsPath)}${BACKUP_SUFFIX} 로 백업됩니다.` },
    '연동하기'
  );
  if (answer !== '연동하기') {
    return false;
  }

  try {
    await backup(settingsPath);
    if (existing) {
      settings[WRAPPED_KEY] = existing;
    }
    settings.statusLine = {
      type: 'command',
      command: bridgeCommand(context),
      padding: 0
    };
    await writeSettings(settingsPath, settings);
    log.debug(`bridge installed into ${settingsPath}`);
    void vscode.window.showInformationMessage(
      'Claude Code 연동 완료. Claude Code에서 메시지를 한 번 보내면 사용량이 표시됩니다.'
    );
    return true;
  } catch (err) {
    log.warn(`bridge install failed: ${err}`);
    void vscode.window.showErrorMessage(`연동에 실패했습니다: ${err}`);
    return false;
  }
}

export async function uninstallBridge(configDirOverride: string, log: Logger): Promise<boolean> {
  const settingsPath = claudeSettingsPath(configDirOverride);
  const settings = await readSettings(settingsPath);
  if (!settings) {
    void vscode.window.showInformationMessage('연동된 설정이 없습니다.');
    return false;
  }

  try {
    await backup(settingsPath);
    const wrapped = settings[WRAPPED_KEY];
    if (wrapped) {
      settings.statusLine = wrapped;
      delete settings[WRAPPED_KEY];
    } else {
      delete settings.statusLine;
    }
    await writeSettings(settingsPath, settings);
    log.debug(`bridge removed from ${settingsPath}`);
    void vscode.window.showInformationMessage('Claude Code 연동을 해제했습니다.');
    return true;
  } catch (err) {
    log.warn(`bridge uninstall failed: ${err}`);
    void vscode.window.showErrorMessage(`연동 해제에 실패했습니다: ${err}`);
    return false;
  }
}

async function readSettings(settingsPath: string): Promise<any | undefined> {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function writeSettings(settingsPath: string, settings: unknown): Promise<void> {
  const tmp = `${settingsPath}.neugul.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, settingsPath);
}

async function backup(settingsPath: string): Promise<void> {
  try {
    await fs.copyFile(settingsPath, `${settingsPath}${BACKUP_SUFFIX}`);
  } catch {
    // Nothing to back up on a first install.
  }
}

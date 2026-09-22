import * as vscode from 'vscode';

export interface Logger {
  debug(message: string): void;
  warn(message: string): void;
  show(): void;
  dispose(): void;
}

export function createLogger(): Logger {
  const channel = vscode.window.createOutputChannel('Neugul Usage');
  const stamp = () => new Date().toISOString().slice(11, 23);
  return {
    debug: (message) => channel.appendLine(`[${stamp()}] ${message}`),
    warn: (message) => channel.appendLine(`[${stamp()}] WARN ${message}`),
    show: () => channel.show(true),
    dispose: () => channel.dispose()
  };
}

import * as vscode from 'vscode';
import type { UsageStore } from '../core/usageStore';
import type { UsageViewState } from '../core/types';

export class UsageViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = 'neugulUsage.panel';

  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly store: UsageStore
  ) {
    this.disposables.push(this.store.onDidChange((state) => this.post(state)));
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    view.webview.html = this.html(view.webview);

    view.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      this.disposables
    );

    // The webview is torn down when hidden, so re-send state on every reveal.
    view.onDidChangeVisibility(
      () => {
        if (view.visible) {
          this.post(this.store.state);
        }
      },
      undefined,
      this.disposables
    );

    this.post(this.store.state);
  }

  reveal(): void {
    void vscode.commands.executeCommand(`${UsageViewProvider.viewType}.focus`);
  }

  private handleMessage(message: any): void {
    if (message?.type !== 'command') {
      return;
    }
    switch (message.command) {
      case 'refresh':
        void vscode.commands.executeCommand('neugulUsage.refresh');
        break;
      case 'installBridge':
        void vscode.commands.executeCommand('neugulUsage.installClaudeBridge');
        break;
      case 'selectAgent':
        void vscode.commands.executeCommand('neugulUsage.selectAgent');
        break;
      case 'openSettings':
        void vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:TODO-publisher.neugul-usage'
        );
        break;
      default:
        break;
    }
  }

  private post(state: UsageViewState): void {
    if (this.view?.visible) {
      void this.view.webview.postMessage({ type: 'state', payload: state });
    }
  }

  private html(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const asset = (name: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', name));

    return /* html */ `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
<link rel="stylesheet" href="${asset('main.css')}" />
<title>Neugul Usage</title>
</head>
<body>
<main id="root" aria-live="polite"></main>
<script nonce="${nonce}" src="${asset('main.js')}"></script>
</body>
</html>`;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

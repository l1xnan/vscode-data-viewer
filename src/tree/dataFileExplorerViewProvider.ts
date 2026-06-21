import * as vscode from 'vscode';
import * as path from 'path';
import { DataTarget, formatFromExtension } from '../constants';
import { listXlsxSheets } from '../utils/xlsxSheets';
import { getWebviewHtml } from '../viewer/webviewHtml';
import { scanDataFiles, ScannedDataFile } from './dataFileScanner';
import { createSqlSnippet, listSqlSnippets, openSqlSnippet } from '../sql/sqlSnippetStore';

interface ExplorerOpenMessage {
  type: 'open';
  payload: { filePath: string; extension: string; sheetName?: string };
}

interface ExplorerLoadSheetsMessage {
  type: 'loadSheets';
  payload: { filePath: string };
}

interface ExplorerReadyMessage {
  type: 'ready';
}

interface ExplorerOpenSqlMessage {
  type: 'openSql';
  payload: { filePath: string };
}

interface ExplorerNewSqlMessage {
  type: 'newSql';
}

type ExplorerWebviewMessage =
  | ExplorerOpenMessage
  | ExplorerLoadSheetsMessage
  | ExplorerReadyMessage
  | ExplorerOpenSqlMessage
  | ExplorerNewSqlMessage;

export class DataFileExplorerViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'dataViewer.explorer';

  private view: vscode.WebviewView | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private messageDisposable: vscode.Disposable | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{parquet,csv,tsv,json,jsonl,ndjson,xlsx}',
    );
    const scheduleRefresh = () => this.scheduleRefresh();
    watcher.onDidCreate(scheduleRefresh);
    watcher.onDidDelete(scheduleRefresh);
    watcher.onDidChange(scheduleRefresh);
    context.subscriptions.push(watcher);

    const sqlWatcher = vscode.workspace.createFileSystemWatcher('**/.dataviewer/queries/**/*.sql');
    sqlWatcher.onDidCreate(scheduleRefresh);
    sqlWatcher.onDidDelete(scheduleRefresh);
    sqlWatcher.onDidChange(scheduleRefresh);
    context.subscriptions.push(sqlWatcher);

    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        void this.refresh();
      }),
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    this.messageDisposable?.dispose();

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-explorer'),
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'assets'),
      ],
    };

    this.messageDisposable = webviewView.webview.onDidReceiveMessage(
      async (message: ExplorerWebviewMessage) => {
        if (message.type === 'ready') {
          await this.sendFiles();
          return;
        }
        if (message.type === 'loadSheets') {
          await this.sendSheets(message.payload.filePath);
          return;
        }
        if (message.type === 'open') {
          const target = this.toDataTarget(message.payload);
          if (target) {
            await vscode.commands.executeCommand('dataViewer.openFile', target);
          }
          return;
        }
        if (message.type === 'openSql') {
          await openSqlSnippet(message.payload.filePath);
          return;
        }
        if (message.type === 'newSql') {
          const uri = await createSqlSnippet();
          if (uri) {
            await openSqlSnippet(uri.fsPath);
            await this.sendFiles();
          }
        }
      },
    );

    webviewView.onDidChangeVisibility((visible) => {
      if (visible) {
        void this.sendFiles();
      }
    });

    webviewView.webview.html = getWebviewHtml(
      webviewView.webview,
      this.context.extensionUri,
      'webview-explorer',
    );
  }

  async refresh(): Promise<void> {
    await this.sendFiles();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      void this.refresh();
    }, 300);
  }

  private async sendFiles(): Promise<void> {
    if (!this.view) {
      return;
    }
    const { files, workspaceOpen } = await scanDataFiles();
    const sqlFiles = await listSqlSnippets();
    await this.view.webview.postMessage({
      type: 'files',
      payload: { files, sqlFiles, workspaceOpen },
    });
  }

  private async sendSheets(filePath: string): Promise<void> {
    if (!this.view) {
      return;
    }
    try {
      const sheets = await listXlsxSheets(filePath);
      await this.view.webview.postMessage({
        type: 'sheets',
        payload: { filePath, sheets },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.view.webview.postMessage({
        type: 'sheetsError',
        payload: { filePath, message },
      });
    }
  }

  private toDataTarget(payload: {
    filePath: string;
    extension: string;
    sheetName?: string;
  }): DataTarget | undefined {
    const format = formatFromExtension(payload.extension);
    if (!format) {
      return undefined;
    }

    const baseName = path.basename(payload.filePath);
    const displayName = payload.sheetName ? `${baseName} [${payload.sheetName}]` : baseName;

    return {
      filePath: payload.filePath,
      format,
      sheetName: payload.sheetName,
      displayName,
    };
  }
}

export type { ScannedDataFile };

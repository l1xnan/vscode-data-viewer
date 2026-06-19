import * as vscode from 'vscode';
import { DataTarget, SQL_SCHEME } from './constants';
import { DuckDBService } from './duckdb/duckdbService';
import { DataFileExplorerViewProvider } from './tree/dataFileExplorerViewProvider';
import { DataViewerManager } from './viewer/dataViewerManager';
import { SqlCodeLensProvider } from './viewer/sqlCodeLensProvider';
import { SqlCompletionProvider } from './viewer/sqlCompletionProvider';
import { SqlDocumentProvider } from './viewer/sqlDocumentProvider';

let explorerProvider: DataFileExplorerViewProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const duckdb = DuckDBService.getInstance();
  const sqlProvider = new SqlDocumentProvider();
  const viewerManager = new DataViewerManager(context, duckdb, sqlProvider);
  const sqlCodeLensProvider = new SqlCodeLensProvider();

  explorerProvider = new DataFileExplorerViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DataFileExplorerViewProvider.viewId,
      explorerProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(SQL_SCHEME, sqlProvider, {
      isCaseSensitive: true,
      isReadonly: false,
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dataViewer.refresh', () => {
      void explorerProvider?.refresh();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dataViewer.openFile', async (target: DataTarget) => {
      await viewerManager.openTarget(target);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dataViewer.runQuery', async () => {
      await viewerManager.runActiveQuery();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'dataViewer.runStatement',
      async (uriString: string, startOffset: number, endOffset: number) => {
        await viewerManager.runStatement(uriString, startOffset, endOffset);
      },
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'sql', scheme: 'dataviewer-sql' },
      new SqlCompletionProvider(duckdb, viewerManager),
      '.',
      ' ',
      '\t',
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: 'sql', scheme: 'dataviewer-sql' },
      sqlCodeLensProvider,
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme === SQL_SCHEME) {
        sqlCodeLensProvider.refresh();
      }
    }),
  );

  void duckdb.initialize().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Failed to initialize DuckDB: ${message}`);
  });
}

export function deactivate(): void {
  explorerProvider = undefined;
}

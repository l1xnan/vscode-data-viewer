import * as vscode from 'vscode';
import { DataTarget } from './constants';
import { DuckDBService } from './duckdb/duckdbService';
import { createSqlSnippet, openSqlSnippet } from './sql/sqlSnippetStore';
import { DataFileExplorerViewProvider } from './tree/dataFileExplorerViewProvider';
import { isQueriesSqlFile } from './utils/sqlPaths';
import { DataViewerManager } from './viewer/dataViewerManager';
import { SqlCodeLensProvider } from './viewer/sqlCodeLensProvider';
import { SqlCompletionProvider } from './viewer/sqlCompletionProvider';

let explorerProvider: DataFileExplorerViewProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const duckdb = DuckDBService.getInstance();
  const viewerManager = new DataViewerManager(context, duckdb);
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
    vscode.commands.registerCommand('dataViewer.newSqlFile', async () => {
      const uri = await createSqlSnippet();
      if (uri) {
        await openSqlSnippet(uri.fsPath);
        void explorerProvider?.refresh();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dataViewer.openSqlFile', async (filePath: string) => {
      await openSqlSnippet(filePath);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dataViewer.runSqlFileQuery', async () => {
      await viewerManager.runSqlFileQuery();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'dataViewer.runSqlFileStatement',
      async (uriString: string, startOffset: number, endOffset: number) => {
        await viewerManager.runSqlFileStatement(uriString, startOffset, endOffset);
      },
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'sql' },
      new SqlCompletionProvider(duckdb),
      '.',
      ' ',
      '\t',
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: 'sql' }, sqlCodeLensProvider),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isQueriesSqlFile(event.document.uri)) {
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

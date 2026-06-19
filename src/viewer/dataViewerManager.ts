import * as vscode from 'vscode';
import { DEFAULT_PAGE_SIZE, DataTarget, SQL_SCHEME } from '../constants';
import { DuckDBService } from '../duckdb/duckdbService';
import { PageParams } from '../duckdb/types';
import { getWebviewHtml } from './webviewHtml';
import { SqlDocumentProvider } from './sqlDocumentProvider';

interface ViewerSession {
  target: DataTarget;
  sqlUri: vscode.Uri;
  panel: vscode.WebviewPanel;
  userSql: string;
  pageParams: PageParams;
}

interface WebviewTableQueryMessage {
  type: 'tableQuery';
  payload: {
    page: number;
    pageSize: number;
    sort?: { column: string; direction: 'asc' | 'desc' };
    filters?: Record<string, string>;
  };
}

interface WebviewReadyMessage {
  type: 'ready';
}

type WebviewMessage = WebviewTableQueryMessage | WebviewReadyMessage;

export class DataViewerManager {
  private readonly sessionsBySqlUri = new Map<string, ViewerSession>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly duckdb: DuckDBService,
    private readonly sqlProvider: SqlDocumentProvider,
  ) {}

  async openTarget(target: DataTarget): Promise<void> {
    await this.duckdb.initialize();
    await this.duckdb.prepareTarget(target);

    const pageSize =
      vscode.workspace.getConfiguration('dataViewer').get<number>('pageSize') ?? DEFAULT_PAGE_SIZE;
    const defaultSql = this.duckdb.getDefaultUserSql(target);
    const sqlUri = this.sqlProvider.createDocument(target, defaultSql);

    const panel = vscode.window.createWebviewPanel(
      'dataViewer.table',
      target.displayName,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'assets'),
        ],
      },
    );

    panel.webview.html = getWebviewHtml(panel.webview, this.context.extensionUri);

    const session: ViewerSession = {
      target,
      sqlUri,
      panel,
      userSql: defaultSql,
      pageParams: { page: 1, pageSize },
    };

    this.sessionsBySqlUri.set(sqlUri.toString(), session);

    panel.onDidDispose(() => {
      this.sessionsBySqlUri.delete(sqlUri.toString());
    });

    panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.type === 'ready') {
        await this.pushQueryResult(session);
        return;
      }
      if (message.type === 'tableQuery') {
        session.pageParams = {
          page: message.payload.page,
          pageSize: message.payload.pageSize,
          sort: message.payload.sort,
          filters: message.payload.filters,
        };
        await this.pushQueryResult(session);
      }
    });

    const doc = await vscode.workspace.openTextDocument(sqlUri);
    await vscode.languages.setTextDocumentLanguage(doc, 'sql');
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
    });
  }

  async runActiveQuery(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== SQL_SCHEME) {
      void vscode.window.showWarningMessage('Open a Data Viewer SQL document to run a query.');
      return;
    }

    const session = this.sessionsBySqlUri.get(editor.document.uri.toString());
    if (!session) {
      void vscode.window.showWarningMessage('No data viewer session linked to this SQL document.');
      return;
    }

    session.userSql = editor.document.getText().trim().replace(/;\s*$/, '');
    session.pageParams.page = 1;
    await this.pushQueryResult(session);
  }

  async runStatement(uriString: string, startOffset: number, endOffset: number): Promise<void> {
    const uri = vscode.Uri.parse(uriString);
    const session = this.sessionsBySqlUri.get(uri.toString());
    if (!session) {
      void vscode.window.showWarningMessage('No data viewer session linked to this SQL document.');
      return;
    }

    const document = await vscode.workspace.openTextDocument(uri);
    const sql = document.getText().slice(startOffset, endOffset).trim().replace(/;\s*$/, '');
    if (!sql) {
      void vscode.window.showWarningMessage('SQL statement is empty.');
      return;
    }

    session.userSql = sql;
    session.pageParams.page = 1;
    await this.pushQueryResult(session);
  }

  getSessionForSqlUri(uri: vscode.Uri): ViewerSession | undefined {
    return this.sessionsBySqlUri.get(uri.toString());
  }

  private async pushQueryResult(session: ViewerSession): Promise<void> {
    try {
      const result = await this.duckdb.executePagedQuery(session.userSql, session.pageParams);
      session.panel.webview.postMessage({
        type: 'queryResult',
        payload: {
          columns: result.columns,
          rows: result.rows,
          totalCount: result.totalCount,
          page: result.page,
          pageSize: result.pageSize,
          error: undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      session.panel.webview.postMessage({
        type: 'queryResult',
        payload: {
          columns: [],
          rows: [],
          totalCount: 0,
          page: session.pageParams.page,
          pageSize: session.pageParams.pageSize,
          error: message,
        },
      });
      void vscode.window.showErrorMessage(`Query failed: ${message}`);
    }
  }
}

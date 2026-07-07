import * as path from 'path';
import * as vscode from 'vscode';
import { isQueriesSqlFile } from '../utils/sqlPaths';
import { DEFAULT_PAGE_SIZE, DataTarget } from '../constants';
import { DuckDBService } from '../duckdb/duckdbService';
import { CompletionCatalogData, PageParams, QueryColumn } from '../duckdb/types';
import { getWebviewHtml } from './webviewHtml';

interface ViewerSession {
  key: string;
  target?: DataTarget;
  sourceUri?: vscode.Uri;
  panel: vscode.WebviewPanel;
  userSql: string;
  pageParams: PageParams;
  initColumns: QueryColumn[];
  catalog: CompletionCatalogData;
}

interface WebviewQueryMessage {
  type: 'query';
  payload: {
    sql: string;
    page: number;
    pageSize: number;
    sort?: { column: string; direction: 'asc' | 'desc' };
    filters?: Record<string, string>;
  };
}

interface WebviewReadyMessage {
  type: 'ready';
}

type WebviewMessage = WebviewQueryMessage | WebviewReadyMessage;

interface CreateViewerOptions {
  title: string;
  initSql: string;
  key: string;
  target?: DataTarget;
  sourceUri?: vscode.Uri;
  columns?: QueryColumn[];
  viewColumn?: vscode.ViewColumn;
}

export class DataViewerManager {
  private readonly sessionsByKey = new Map<string, ViewerSession>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly duckdb: DuckDBService,
  ) {
    context.subscriptions.push(
      vscode.window.onDidChangeActiveColorTheme(() => {
        this.notifyThemeChanged();
      }),
    );
  }

  private notifyThemeChanged(): void {
    for (const session of this.sessionsByKey.values()) {
      void session.panel.webview.postMessage({ type: 'themeChanged' });
    }
  }

  async openTarget(target: DataTarget): Promise<void> {
    await this.duckdb.initialize();
    await this.duckdb.prepareTarget(target);

    const key = `target:${target.filePath}\0${target.sheetName ?? ''}`;
    const existing = this.sessionsByKey.get(key);
    if (existing) {
      existing.panel.reveal();
      return;
    }

    const defaultSql = this.duckdb.getDefaultUserSql(target);
    const columns = await this.duckdb.describeTarget(target);

    await this.createViewerPanel({
      title: target.displayName,
      initSql: defaultSql,
      key,
      target,
      columns,
      viewColumn: vscode.ViewColumn.One,
    });
  }

  async openResultTab(sql: string, title: string, sourceUri?: vscode.Uri): Promise<void> {
    await this.duckdb.initialize();

    const key = sourceUri?.toString() ?? `adhoc:${title}:${Date.now()}`;
    const existing = this.sessionsByKey.get(key);
    if (existing) {
      existing.userSql = sql.trim().replace(/;\s*$/, '');
      existing.pageParams.page = 1;
      existing.panel.title = title;
      existing.panel.reveal();
      existing.panel.webview.postMessage({ type: 'setSql', payload: { sql: existing.userSql } });
      await this.pushQueryResult(existing);
      return;
    }

    await this.createViewerPanel({
      title,
      initSql: sql.trim().replace(/;\s*$/, ''),
      key,
      sourceUri,
      columns: [],
      viewColumn: vscode.ViewColumn.Beside,
    });
  }

  async runSqlFileQuery(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isQueriesSqlFile(editor.document.uri)) {
      void vscode.window.showWarningMessage('Open a SQL snippet from .dataviewer/queries to run a query.');
      return;
    }

    const sql = editor.document.getText().trim().replace(/;\s*$/, '');
    if (!sql) {
      void vscode.window.showWarningMessage('SQL is empty.');
      return;
    }

    const baseName = path.basename(editor.document.uri.fsPath, '.sql');
    await this.openResultTab(sql, `${baseName} (results)`, editor.document.uri);
  }

  async runSqlFileStatement(
    uriString: string,
    startOffset: number,
    endOffset: number,
  ): Promise<void> {
    const uri = vscode.Uri.parse(uriString);
    const document = await vscode.workspace.openTextDocument(uri);
    const sql = document.getText().slice(startOffset, endOffset).trim().replace(/;\s*$/, '');
    if (!sql) {
      void vscode.window.showWarningMessage('SQL statement is empty.');
      return;
    }

    const baseName = path.basename(uri.fsPath, '.sql');
    await this.openResultTab(sql, `${baseName} (results)`, uri);
  }

  private async createViewerPanel(options: CreateViewerOptions): Promise<void> {
    const pageSize =
      vscode.workspace.getConfiguration('dataViewer').get<number>('pageSize') ?? DEFAULT_PAGE_SIZE;
    const catalog = this.duckdb.getCatalogData();
    const initColumns = options.columns ?? [];

    const panel = vscode.window.createWebviewPanel(
      'dataViewer.table',
      options.title,
      options.viewColumn ?? vscode.ViewColumn.One,
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
      key: options.key,
      target: options.target,
      sourceUri: options.sourceUri,
      panel,
      userSql: options.initSql,
      pageParams: { page: 1, pageSize },
      initColumns,
      catalog,
    };

    this.sessionsByKey.set(options.key, session);

    panel.onDidDispose(() => {
      this.sessionsByKey.delete(options.key);
    });

    panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      if (message.type === 'ready') {
        panel.webview.postMessage({
          type: 'init',
          payload: {
            sql: session.userSql,
            catalog: session.catalog,
            columns: session.initColumns,
            pageSize,
          },
        });
        await this.pushQueryResult(session);
        return;
      }
      if (message.type === 'query') {
        session.userSql = message.payload.sql.trim().replace(/;\s*$/, '');
        session.pageParams = {
          page: message.payload.page,
          pageSize: message.payload.pageSize,
          sort: message.payload.sort,
          filters: message.payload.filters,
        };
        await this.pushQueryResult(session);
      }
    });
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

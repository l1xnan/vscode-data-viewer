import * as vscode from 'vscode';
import { SQL_SCHEME } from '../constants';
import { DuckDBService } from '../duckdb/duckdbService';
import { DataViewerManager } from './dataViewerManager';

export class SqlCompletionProvider implements vscode.CompletionItemProvider {
  constructor(
    private readonly duckdb: DuckDBService,
    private readonly viewerManager: DataViewerManager,
  ) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[]> {
    if (document.uri.scheme !== SQL_SCHEME) {
      return [];
    }

    await this.duckdb.initialize();

    const wordRange = document.getWordRangeAtPosition(position, /[\w"]+/);
    const prefix = wordRange ? document.getText(wordRange).replace(/"/g, '') : '';
    const prefixLower = prefix.toLowerCase();

    const items: vscode.CompletionItem[] = [];
    const catalog = this.duckdb.getCatalogData();

    for (const keyword of catalog.keywords) {
      if (!prefix || keyword.name.toLowerCase().startsWith(prefixLower)) {
        const item = new vscode.CompletionItem(keyword.name, vscode.CompletionItemKind.Keyword);
        item.detail = keyword.category;
        items.push(item);
      }
    }

    for (const fn of catalog.functions) {
      if (!prefix || fn.name.toLowerCase().startsWith(prefixLower)) {
        const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
        item.detail = `${fn.functionType} → ${fn.returnType}`;
        if (fn.parameters.length > 0) {
          const params = fn.parameters.map((p, i) => `\${${i + 1}:${p}}`).join(', ');
          item.insertText = new vscode.SnippetString(`${fn.name}(${params})`);
        }
        items.push(item);
      }
    }

    const session = this.viewerManager.getSessionForSqlUri(document.uri);
    if (session) {
      try {
        const sourceSql = this.duckdb.buildSourceSql(session.target);
        const columns = await this.duckdb.describeTarget(session.target);

        for (const column of columns) {
          if (!prefix || column.name.toLowerCase().startsWith(prefixLower)) {
            const item = new vscode.CompletionItem(column.name, vscode.CompletionItemKind.Field);
            item.detail = column.type;
            items.push(item);
          }
        }

        const fromSnippet = `SELECT * FROM ${sourceSql}`;
        if (!prefix || 'select'.startsWith(prefixLower) || sourceSql.toLowerCase().includes(prefixLower)) {
          const item = new vscode.CompletionItem(
            'Default file query',
            vscode.CompletionItemKind.Snippet,
          );
          item.insertText = new vscode.SnippetString(fromSnippet);
          item.detail = session.target.displayName;
          items.push(item);
        }
      } catch {
        // Source may not be readable yet
      }
    }

    return items;
  }
}

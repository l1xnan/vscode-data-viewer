import * as vscode from 'vscode';
import { DuckDBService } from '../duckdb/duckdbService';
import { isQueriesSqlFile } from '../utils/sqlPaths';

export class SqlCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly duckdb: DuckDBService) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[]> {
    if (!isQueriesSqlFile(document.uri)) {
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

    return items;
  }
}

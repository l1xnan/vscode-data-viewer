import * as path from 'path';
import * as vscode from 'vscode';
import { getQueriesDirUri } from '../utils/sqlPaths';

export interface SqlSnippetEntry {
  filePath: string;
  fileName: string;
}

const DEFAULT_TEMPLATE = `-- Data Viewer SQL snippet
-- Example: SELECT * FROM read_csv_auto('path/to/file.csv')

SELECT 1 AS example;
`;

export async function listSqlSnippets(): Promise<SqlSnippetEntry[]> {
  const dir = getQueriesDirUri();
  if (!dir) {
    return [];
  }

  try {
    const entries = await vscode.workspace.fs.readDirectory(dir);
    return entries
      .filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.sql'))
      .map(([name]) => ({
        filePath: vscode.Uri.joinPath(dir, name).fsPath,
        fileName: name,
      }))
      .sort((a, b) => a.fileName.localeCompare(b.fileName));
  } catch {
    return [];
  }
}

export async function createSqlSnippet(name?: string): Promise<vscode.Uri | undefined> {
  const dir = getQueriesDirUri();
  if (!dir) {
    void vscode.window.showWarningMessage('Open a workspace folder to create SQL snippets.');
    return undefined;
  }

  await vscode.workspace.fs.createDirectory(dir);

  let fileName = name?.trim() || 'query.sql';
  if (!fileName.toLowerCase().endsWith('.sql')) {
    fileName = `${fileName}.sql`;
  }

  let uri = vscode.Uri.joinPath(dir, fileName);
  let counter = 1;
  while (true) {
    try {
      await vscode.workspace.fs.stat(uri);
      const stem = path.basename(fileName, '.sql');
      uri = vscode.Uri.joinPath(dir, `${stem}-${counter}.sql`);
      counter += 1;
    } catch {
      break;
    }
  }

  await vscode.workspace.fs.writeFile(uri, Buffer.from(DEFAULT_TEMPLATE, 'utf8'));
  return uri;
}

export async function openSqlSnippet(filePath: string): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.languages.setTextDocumentLanguage(doc, 'sql');
  await vscode.window.showTextDocument(doc, { preview: false });
}

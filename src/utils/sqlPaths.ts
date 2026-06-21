import * as vscode from 'vscode';

export const QUERIES_DIR_SEGMENT = '.dataviewer/queries';

export function isQueriesSqlFile(uri: vscode.Uri): boolean {
  if (uri.scheme !== 'file') {
    return false;
  }
  const normalized = uri.fsPath.replace(/\\/g, '/').toLowerCase();
  return normalized.includes(`/${QUERIES_DIR_SEGMENT}/`) && normalized.endsWith('.sql');
}

export function getQueriesDirUri(): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }
  return vscode.Uri.joinPath(folder.uri, '.dataviewer', 'queries');
}

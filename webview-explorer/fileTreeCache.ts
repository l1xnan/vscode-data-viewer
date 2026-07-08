import { DataFileTreeNode, ScannedSqlFile, vscode } from './types';

const CACHE_STATE_KEY = 'fileTreeCache';

export interface FileTreeCachePayload {
  tree: DataFileTreeNode[];
  sqlFiles: ScannedSqlFile[];
  workspaceOpen: boolean;
}

function isFileTreeCachePayload(value: unknown): value is FileTreeCachePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as FileTreeCachePayload;
  return Array.isArray(candidate.tree) && Array.isArray(candidate.sqlFiles);
}

export function readFileTreeCache(): FileTreeCachePayload | undefined {
  const cached = vscode.getState()?.[CACHE_STATE_KEY];
  return isFileTreeCachePayload(cached) ? cached : undefined;
}

export function writeFileTreeCache(payload: FileTreeCachePayload): void {
  vscode.setState({
    ...vscode.getState(),
    [CACHE_STATE_KEY]: payload,
  });
}

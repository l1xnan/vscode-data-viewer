import * as vscode from 'vscode';
import { DataFileTreeNode } from './dataFileScanner';

const STORAGE_KEY = 'explorerFileTreeCache';

export interface ExplorerSqlFileEntry {
  filePath: string;
  fileName: string;
}

export interface ExplorerFileTreeCache {
  workspaceKey: string;
  tree: DataFileTreeNode[];
  sqlFiles: ExplorerSqlFileEntry[];
  workspaceOpen: boolean;
}

export function getExplorerWorkspaceKey(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.toString() ?? '';
}

export class ExplorerFileTreeCacheStore {
  constructor(private readonly workspaceState: vscode.Memento) {}

  get(): ExplorerFileTreeCache | undefined {
    const workspaceKey = getExplorerWorkspaceKey();
    if (!workspaceKey) {
      return undefined;
    }
    const cached = this.workspaceState.get<ExplorerFileTreeCache>(STORAGE_KEY);
    if (!cached || cached.workspaceKey !== workspaceKey) {
      return undefined;
    }
    return cached;
  }

  async save(payload: Omit<ExplorerFileTreeCache, 'workspaceKey'>): Promise<void> {
    const workspaceKey = getExplorerWorkspaceKey();
    if (!workspaceKey) {
      return;
    }
    await this.workspaceState.update(STORAGE_KEY, {
      ...payload,
      workspaceKey,
    });
  }
}

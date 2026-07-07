import * as vscode from 'vscode';
import { DataTarget } from '../constants';

const STORAGE_KEY = 'sqlArchive';

export function buildTargetSessionKey(target: DataTarget): string {
  return `target:${target.filePath}\0${target.sheetName ?? ''}`;
}

export class SqlArchiveStore {
  constructor(private readonly workspaceState: vscode.Memento) {}

  get(sessionKey: string): string | undefined {
    const archive = this.workspaceState.get<Record<string, string>>(STORAGE_KEY, {});
    return archive[sessionKey];
  }

  async save(sessionKey: string, sql: string): Promise<void> {
    const archive = { ...this.workspaceState.get<Record<string, string>>(STORAGE_KEY, {}) };
    const trimmed = sql.trim();
    if (trimmed) {
      archive[sessionKey] = sql;
    } else {
      delete archive[sessionKey];
    }
    await this.workspaceState.update(STORAGE_KEY, archive);
  }
}

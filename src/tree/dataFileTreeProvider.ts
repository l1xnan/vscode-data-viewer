import * as vscode from 'vscode';
import * as path from 'path';
import {
  DEFAULT_EXCLUDE_GLOBS,
  DEFAULT_SUPPORTED_EXTENSIONS,
  DataTarget,
  formatFromExtension,
} from '../constants';
import { listXlsxSheets } from '../utils/xlsxSheets';
import { fileFilterState } from './fileFilterState';

export enum TreeItemType {
  File = 'file',
  Workbook = 'workbook',
  Sheet = 'sheet',
}

export interface TreeNodePayload {
  type: TreeItemType;
  filePath: string;
  extension: string;
  sheetName?: string;
}

export class DataFileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly payload: TreeNodePayload,
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    const label =
      payload.type === TreeItemType.Sheet
        ? payload.sheetName ?? 'Sheet'
        : path.basename(payload.filePath);

    super(label, collapsibleState);

    this.contextValue = payload.type;
    this.tooltip = payload.filePath;
    this.description =
      payload.type === TreeItemType.Sheet ? 'sheet' : payload.extension.replace('.', '');

    if (payload.type === TreeItemType.File || payload.type === TreeItemType.Sheet) {
      this.command = {
        command: 'dataViewer.openFile',
        title: 'Open Data File',
        arguments: [this.toDataTarget()],
      };
    }

    if (payload.type === TreeItemType.Workbook) {
      this.iconPath = new vscode.ThemeIcon('file-excel');
    } else if (payload.type === TreeItemType.Sheet) {
      this.iconPath = new vscode.ThemeIcon('table');
    } else {
      this.iconPath = new vscode.ThemeIcon('database');
    }
  }

  toDataTarget(): DataTarget {
    const format = formatFromExtension(this.payload.extension);
    if (!format) {
      throw new Error(`Unsupported extension: ${this.payload.extension}`);
    }

    const baseName = path.basename(this.payload.filePath);
    const displayName =
      this.payload.type === TreeItemType.Sheet && this.payload.sheetName
        ? `${baseName} [${this.payload.sheetName}]`
        : baseName;

    return {
      filePath: this.payload.filePath,
      format,
      sheetName: this.payload.sheetName,
      displayName,
    };
  }
}

export class DataFileTreeProvider implements vscode.TreeDataProvider<DataFileTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<DataFileTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private files: Array<{ filePath: string; extension: string }> = [];
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    void this.refreshFiles();

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{parquet,csv,tsv,json,jsonl,ndjson,xlsx}');
    const scheduleRefresh = () => this.scheduleRefresh();
    watcher.onDidCreate(scheduleRefresh);
    watcher.onDidDelete(scheduleRefresh);
    watcher.onDidChange(scheduleRefresh);
    context.subscriptions.push(watcher);

    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        void this.refreshFiles();
      }),
    );
  }

  refresh(): void {
    void this.refreshFiles();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      void this.refreshFiles();
    }, 300);
  }

  private getSupportedExtensions(): string[] {
    return (
      vscode.workspace.getConfiguration('dataViewer').get<string[]>('supportedExtensions') ??
      DEFAULT_SUPPORTED_EXTENSIONS
    );
  }

  private getExcludeGlobs(): string[] {
    return (
      vscode.workspace.getConfiguration('dataViewer').get<string[]>('excludeGlobs') ??
      DEFAULT_EXCLUDE_GLOBS
    );
  }

  private async refreshFiles(): Promise<void> {
    const extensions = this.getSupportedExtensions();
    const excludeGlobs = this.getExcludeGlobs();
    const folders = vscode.workspace.workspaceFolders ?? [];
    const found: Array<{ filePath: string; extension: string }> = [];

    for (const folder of folders) {
      for (const ext of extensions) {
        const pattern = new vscode.RelativePattern(folder, `**/*${ext}`);
        const uris = await vscode.workspace.findFiles(pattern, `{${excludeGlobs.join(',')}}`, 5000);
        for (const uri of uris) {
          const filePath = uri.fsPath;
          const extension = path.extname(filePath).toLowerCase();
          if (fileFilterState.matches(path.basename(filePath), extension)) {
            found.push({ filePath, extension });
          }
        }
      }
    }

    found.sort((a, b) => a.filePath.localeCompare(b.filePath));
    this.files = found;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: DataFileTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DataFileTreeItem): Promise<DataFileTreeItem[]> {
    if (!element) {
      return this.files.map(({ filePath, extension }) => {
        const isWorkbook = extension === '.xlsx';
        return new DataFileTreeItem(
          { type: isWorkbook ? TreeItemType.Workbook : TreeItemType.File, filePath, extension },
          isWorkbook
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
        );
      });
    }

    if (element.payload.type === TreeItemType.Workbook) {
      try {
        const sheets = await listXlsxSheets(element.payload.filePath);
        return sheets.map(
          (sheetName) =>
            new DataFileTreeItem(
              {
                type: TreeItemType.Sheet,
                filePath: element.payload.filePath,
                extension: element.payload.extension,
                sheetName,
              },
              vscode.TreeItemCollapsibleState.None,
            ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Failed to read xlsx sheets: ${message}`);
        return [];
      }
    }

    return [];
  }
}

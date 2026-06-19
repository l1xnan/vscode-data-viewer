import * as path from 'path';
import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { DataTarget, SQL_AUTHORITY, SQL_SCHEME } from '../constants';

export class SqlDocumentProvider implements vscode.FileSystemProvider {
  private readonly documents = new Map<string, Uint8Array>();
  private readonly targets = new Map<string, DataTarget>();
  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  static buildFileName(target: DataTarget): string {
    const base = path.basename(target.filePath);
    if (target.sheetName) {
      return `${base} · ${target.sheetName}.sql`;
    }
    return `${base}.sql`;
  }

  private static targetKey(target: DataTarget): string {
    return `${target.filePath}\0${target.sheetName ?? ''}`;
  }

  private uriFromFileName(fileName: string): vscode.Uri {
    const encoded = encodeURIComponent(fileName);
    return vscode.Uri.from({
      scheme: SQL_SCHEME,
      authority: SQL_AUTHORITY,
      path: `/${encoded}`,
    });
  }

  private findExistingUri(target: DataTarget): vscode.Uri | undefined {
    const key = SqlDocumentProvider.targetKey(target);
    for (const [uriString, existingTarget] of this.targets.entries()) {
      if (SqlDocumentProvider.targetKey(existingTarget) === key) {
        return vscode.Uri.parse(uriString);
      }
    }
    return undefined;
  }

  private resolveUri(target: DataTarget): vscode.Uri {
    const existing = this.findExistingUri(target);
    if (existing) {
      return existing;
    }

    let fileName = SqlDocumentProvider.buildFileName(target);
    let uri = this.uriFromFileName(fileName);

    if (this.documents.has(uri.toString())) {
      const hash = createHash('sha1')
        .update(SqlDocumentProvider.targetKey(target))
        .digest('hex')
        .slice(0, 6);
      const ext = path.extname(fileName);
      const stem = fileName.slice(0, fileName.length - ext.length);
      fileName = `${stem}.${hash}${ext}`;
      uri = this.uriFromFileName(fileName);
    }

    return uri;
  }

  createDocument(target: DataTarget, content: string): vscode.Uri {
    const uri = this.resolveUri(target);
    const bytes = Buffer.from(content, 'utf8');
    const exists = this.documents.has(uri.toString());
    this.documents.set(uri.toString(), bytes);
    this.targets.set(uri.toString(), target);
    this._onDidChangeFile.fire([
      { type: exists ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created, uri },
    ]);
    return uri;
  }

  getTarget(uri: vscode.Uri): DataTarget | undefined {
    return this.targets.get(uri.toString());
  }

  getDisplayName(uri: vscode.Uri): string {
    const fileName = decodeURIComponent(uri.path.replace(/^\//, ''));
    return fileName.replace(/\.sql$/i, '');
  }

  watch(_uri: vscode.Uri): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const content = this.documents.get(uri.toString());
    if (!content) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return {
      type: vscode.FileType.File,
      ctime: Date.now(),
      mtime: Date.now(),
      size: content.byteLength,
    };
  }

  readDirectory(_uri: vscode.Uri): [string, vscode.FileType][] {
    return [];
  }

  createDirectory(_uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions('Directories are not supported');
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const content = this.documents.get(uri.toString());
    if (!content) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return content;
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean },
  ): void {
    const exists = this.documents.has(uri.toString());
    if (!exists && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (exists && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }
    this.documents.set(uri.toString(), content);
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  delete(uri: vscode.Uri): void {
    if (!this.documents.has(uri.toString())) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    this.documents.delete(uri.toString());
    this.targets.delete(uri.toString());
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { overwrite: boolean }): void {
    throw vscode.FileSystemError.NoPermissions('Rename is not supported');
  }
}

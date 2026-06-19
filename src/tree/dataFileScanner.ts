import * as vscode from 'vscode';
import * as path from 'path';
import { DEFAULT_EXCLUDE_GLOBS, DEFAULT_SUPPORTED_EXTENSIONS } from '../constants';

export interface ScannedDataFile {
  filePath: string;
  extension: string;
  fileName: string;
  kind: 'file' | 'workbook';
}

export interface ScanResult {
  files: ScannedDataFile[];
  workspaceOpen: boolean;
}

function buildExcludePattern(excludeGlobs: string[]): string {
  const folderNames = new Set<string>();
  for (const glob of excludeGlobs) {
    const match = glob.match(/^\*\*\/([^/]+)\/\*\*$/);
    if (match?.[1]) {
      folderNames.add(match[1]);
    }
  }
  if (folderNames.size === 0) {
    return '**/node_modules/**';
  }
  return `**/{${[...folderNames].join(',')}}/**`;
}

export async function scanDataFiles(): Promise<ScanResult> {
  const extensions =
    vscode.workspace.getConfiguration('dataViewer').get<string[]>('supportedExtensions') ??
    DEFAULT_SUPPORTED_EXTENSIONS;
  const excludeGlobs =
    vscode.workspace.getConfiguration('dataViewer').get<string[]>('excludeGlobs') ??
    DEFAULT_EXCLUDE_GLOBS;

  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return { files: [], workspaceOpen: false };
  }

  const exclude = buildExcludePattern(excludeGlobs);
  const seen = new Set<string>();
  const found: ScannedDataFile[] = [];

  for (const folder of folders) {
    for (const ext of extensions) {
      const pattern = new vscode.RelativePattern(folder, `**/*${ext}`);
      const uris = await vscode.workspace.findFiles(pattern, exclude, 5000);
      for (const uri of uris) {
        const filePath = uri.fsPath;
        if (seen.has(filePath)) {
          continue;
        }
        seen.add(filePath);
        const extension = path.extname(filePath).toLowerCase();
        found.push({
          filePath,
          extension,
          fileName: path.basename(filePath),
          kind: extension === '.xlsx' ? 'workbook' : 'file',
        });
      }
    }
  }

  found.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return { files: found, workspaceOpen: true };
}

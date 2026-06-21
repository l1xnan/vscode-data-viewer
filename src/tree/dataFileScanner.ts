import * as vscode from 'vscode';
import * as path from 'path';
import {
  DEFAULT_EXCLUDE_FOLDERS,
  DEFAULT_EXCLUDE_GLOBS,
  DEFAULT_SUPPORTED_EXTENSIONS,
} from '../constants';

export interface ScannedDataFile {
  filePath: string;
  extension: string;
  fileName: string;
  kind: 'file' | 'workbook';
}

export type DataFileTreeNodeKind = 'folder' | 'file' | 'workbook';

export interface DataFileTreeNode {
  name: string;
  path: string;
  kind: DataFileTreeNodeKind;
  extension?: string;
  children?: DataFileTreeNode[];
}

export interface ScanResult {
  tree: DataFileTreeNode[];
  workspaceOpen: boolean;
}

function getExcludeFolders(): Set<string> {
  const configured =
    vscode.workspace.getConfiguration('dataViewer').get<string[]>('excludeFolders') ??
    DEFAULT_EXCLUDE_FOLDERS;
  return new Set(configured.map((name) => name.toLowerCase()));
}

function buildExcludePattern(excludeFolders: Set<string>, excludeGlobs: string[]): string {
  const folderNames = new Set(excludeFolders);
  for (const glob of excludeGlobs) {
    const match = glob.match(/^\*\*\/([^/]+)\/\*\*$/);
    if (match?.[1]) {
      folderNames.add(match[1].toLowerCase());
    }
  }
  if (folderNames.size === 0) {
    return '**/node_modules/**';
  }
  return `**/{${[...folderNames].join(',')}}/**`;
}

function isExcludedPath(relativePath: string, excludeFolders: Set<string>): boolean {
  const segments = relativePath.replace(/\\/g, '/').split('/');
  return segments.some((segment) => excludeFolders.has(segment.toLowerCase()));
}

function sortTreeNodes(nodes: DataFileTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.kind === 'folder' && b.kind !== 'folder') {
      return -1;
    }
    if (a.kind !== 'folder' && b.kind === 'folder') {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      sortTreeNodes(node.children);
    }
  }
}

function insertFileIntoTree(
  root: DataFileTreeNode,
  relativePath: string,
  file: ScannedDataFile,
): void {
  const segments = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let current = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const folderPath = path.join(current.path, segment);
    let folder = current.children?.find((child) => child.kind === 'folder' && child.name === segment);
    if (!folder) {
      folder = {
        name: segment,
        path: folderPath,
        kind: 'folder',
        children: [],
      };
      current.children = current.children ?? [];
      current.children.push(folder);
    }
    current = folder;
  }

  const fileName = segments[segments.length - 1];
  current.children = current.children ?? [];
  current.children.push({
    name: fileName,
    path: file.filePath,
    kind: file.kind,
    extension: file.extension,
  });
}

function buildWorkspaceTree(
  workspaceFolder: vscode.WorkspaceFolder,
  files: ScannedDataFile[],
): DataFileTreeNode {
  const root: DataFileTreeNode = {
    name: workspaceFolder.name,
    path: workspaceFolder.uri.fsPath,
    kind: 'folder',
    children: [],
  };

  for (const file of files) {
    const relative = path.relative(workspaceFolder.uri.fsPath, file.filePath);
    if (relative.startsWith('..')) {
      continue;
    }
    insertFileIntoTree(root, relative, file);
  }

  if (root.children) {
    sortTreeNodes(root.children);
  }
  return root;
}

export async function scanDataFiles(): Promise<ScanResult> {
  const extensions =
    vscode.workspace.getConfiguration('dataViewer').get<string[]>('supportedExtensions') ??
    DEFAULT_SUPPORTED_EXTENSIONS;
  const excludeGlobs =
    vscode.workspace.getConfiguration('dataViewer').get<string[]>('excludeGlobs') ??
    DEFAULT_EXCLUDE_GLOBS;
  const excludeFolders = getExcludeFolders();

  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return { tree: [], workspaceOpen: false };
  }

  const exclude = buildExcludePattern(excludeFolders, excludeGlobs);
  const filesByWorkspace = new Map<string, ScannedDataFile[]>();

  for (const folder of folders) {
    filesByWorkspace.set(folder.uri.fsPath, []);
  }

  for (const folder of folders) {
    const bucket = filesByWorkspace.get(folder.uri.fsPath)!;
    for (const ext of extensions) {
      const pattern = new vscode.RelativePattern(folder, `**/*${ext}`);
      const uris = await vscode.workspace.findFiles(pattern, exclude, 5000);
      for (const uri of uris) {
        const filePath = uri.fsPath;
        const relative = path.relative(folder.uri.fsPath, filePath);
        if (isExcludedPath(relative, excludeFolders)) {
          continue;
        }

        const extension = path.extname(filePath).toLowerCase();
        const seen = bucket.some((item) => item.filePath === filePath);
        if (seen) {
          continue;
        }

        bucket.push({
          filePath,
          extension,
          fileName: path.basename(filePath),
          kind: extension === '.xlsx' ? 'workbook' : 'file',
        });
      }
    }
    bucket.sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  const tree: DataFileTreeNode[] = [];
  for (const folder of folders) {
    const files = filesByWorkspace.get(folder.uri.fsPath) ?? [];
    tree.push(buildWorkspaceTree(folder, files));
  }

  return { tree, workspaceOpen: true };
}

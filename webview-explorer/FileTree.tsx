import { openFile, requestSheets } from './messaging';
import { DataFileTreeNode } from './types';

interface FileTreeProps {
  nodes: DataFileTreeNode[];
  depth?: number;
  expanded: Record<string, boolean>;
  sheetsByFile: Record<string, string[]>;
  loadingSheets: Record<string, boolean>;
  onToggleFolder: (path: string) => void;
  onToggleWorkbook: (node: DataFileTreeNode) => void;
  forceExpand?: boolean;
}

function matchesSearch(node: DataFileTreeNode, search: string): boolean {
  if (!search.trim()) {
    return true;
  }
  const query = search.trim().toLowerCase();
  return (
    node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)
  );
}

export function filterTree(nodes: DataFileTreeNode[], search: string): DataFileTreeNode[] {
  if (!search.trim()) {
    return nodes;
  }

  const filterNode = (node: DataFileTreeNode): DataFileTreeNode | null => {
    if (node.kind === 'folder') {
      const children = (node.children ?? [])
        .map(filterNode)
        .filter((child): child is DataFileTreeNode => child !== null);
      if (children.length > 0 || matchesSearch(node, search)) {
        return { ...node, children };
      }
      return null;
    }
    return matchesSearch(node, search) ? node : null;
  };

  return nodes.map(filterNode).filter((node): node is DataFileTreeNode => node !== null);
}

function countDataFiles(nodes: DataFileTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === 'file' || node.kind === 'workbook') {
      count += 1;
    }
    if (node.children) {
      count += countDataFiles(node.children);
    }
  }
  return count;
}

export function countTreeFiles(nodes: DataFileTreeNode[]): number {
  return countDataFiles(nodes);
}

export function FileTree({
  nodes,
  depth = 0,
  expanded,
  sheetsByFile,
  loadingSheets,
  onToggleFolder,
  onToggleWorkbook,
  forceExpand = false,
}: FileTreeProps) {
  return (
    <>
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={depth}
          expanded={expanded}
          sheetsByFile={sheetsByFile}
          loadingSheets={loadingSheets}
          onToggleFolder={onToggleFolder}
          onToggleWorkbook={onToggleWorkbook}
          forceExpand={forceExpand}
        />
      ))}
    </>
  );
}

interface TreeNodeProps {
  node: DataFileTreeNode;
  depth: number;
  expanded: Record<string, boolean>;
  sheetsByFile: Record<string, string[]>;
  loadingSheets: Record<string, boolean>;
  onToggleFolder: (path: string) => void;
  onToggleWorkbook: (node: DataFileTreeNode) => void;
  forceExpand: boolean;
}

function TreeNode({
  node,
  depth,
  expanded,
  sheetsByFile,
  loadingSheets,
  onToggleFolder,
  onToggleWorkbook,
  forceExpand,
}: TreeNodeProps) {
  const indent = depth * 12;

  if (node.kind === 'folder') {
    const isExpanded = forceExpand || expanded[node.path];
    const hasChildren = (node.children?.length ?? 0) > 0;

    return (
      <div>
        <button
          type="button"
          className="file-item folder"
          style={{ paddingLeft: `${8 + indent}px` }}
          onClick={() => onToggleFolder(node.path)}
          title={node.path}
        >
          <span className="expand-icon">{hasChildren ? (isExpanded ? '▼' : '▶') : ''}</span>
          <span>{node.name}</span>
        </button>
        {isExpanded && hasChildren ? (
          <FileTree
            nodes={node.children ?? []}
            depth={depth + 1}
            expanded={expanded}
            sheetsByFile={sheetsByFile}
            loadingSheets={loadingSheets}
            onToggleFolder={onToggleFolder}
            onToggleWorkbook={onToggleWorkbook}
            forceExpand={forceExpand}
          />
        ) : null}
      </div>
    );
  }

  if (node.kind === 'workbook') {
    const isExpanded = expanded[node.path];
    const sheets = sheetsByFile[node.path] ?? [];
    const loading = loadingSheets[node.path];

    return (
      <div>
        <button
          type="button"
          className="file-item workbook"
          style={{ paddingLeft: `${8 + indent}px` }}
          onClick={() => onToggleWorkbook(node)}
          title={node.path}
        >
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          <span>{node.name}</span>
          <span className="file-meta">xlsx</span>
        </button>
        {isExpanded ? (
          <div className="sheet-list" style={{ paddingLeft: `${20 + indent}px` }}>
            {loading ? (
              <div className="empty-state">Loading sheets...</div>
            ) : sheets.length === 0 ? (
              <div className="empty-state">No sheets found</div>
            ) : (
              sheets.map((sheetName) => (
                <button
                  key={`${node.path}:${sheetName}`}
                  type="button"
                  className="sheet-item"
                  onClick={() => openFile(node.path, node.extension ?? '.xlsx', sheetName)}
                >
                  <span>{sheetName}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="file-item"
      style={{ paddingLeft: `${8 + indent}px` }}
      onClick={() => openFile(node.path, node.extension ?? '')}
      title={node.path}
    >
      <span className="expand-icon" />
      <span>{node.name}</span>
      <span className="file-meta">{(node.extension ?? '').replace('.', '')}</span>
    </button>
  );
}

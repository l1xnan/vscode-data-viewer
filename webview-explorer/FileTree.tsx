import { Codicon, getDataFileIcon } from './codicons';
import { openFile } from './messaging';
import { DataFileTreeNode } from './types';

const TREE_INDENT = 12;

interface FileTreeProps {
  nodes: DataFileTreeNode[];
  depth?: number;
  expanded: Record<string, boolean>;
  sheetsByFile: Record<string, string[]>;
  loadingSheets: Record<string, boolean>;
  onToggleFolder: (path: string) => void;
  onToggleWorkbook: (node: DataFileTreeNode) => void;
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

export function getFoldersToExpandForSearch(
  nodes: DataFileTreeNode[],
  search: string,
): string[] {
  if (!search.trim()) {
    return [];
  }

  const paths: string[] = [];

  const visit = (node: DataFileTreeNode): boolean => {
    if (node.kind === 'folder') {
      const childHasMatch = (node.children ?? []).some(visit);
      if (childHasMatch) {
        paths.push(node.path);
        return true;
      }
      return matchesSearch(node, search);
    }
    return matchesSearch(node, search);
  };

  for (const node of nodes) {
    visit(node);
  }

  return paths;
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
}: FileTreeProps) {
  return (
    <div className="tree-root" role="tree">
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
        />
      ))}
    </div>
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
}

type TwistieState = 'collapsed' | 'expanded' | 'hidden';

interface TreeRowProps {
  depth: number;
  twistie: TwistieState;
  icon: string;
  label: string;
  title?: string;
  onClick?: () => void;
  className?: string;
  iconClassName?: string;
}

function TreeRow({
  depth,
  twistie,
  icon,
  label,
  title,
  onClick,
  className,
  iconClassName,
}: TreeRowProps) {
  return (
    <button
      type="button"
      className={['tree-row', className].filter(Boolean).join(' ')}
      onClick={onClick}
      title={title ?? label}
      role="treeitem"
      aria-expanded={twistie === 'expanded' ? true : twistie === 'collapsed' ? false : undefined}
    >
      {Array.from({ length: depth }, (_, index) => (
        <span key={index} className="tree-indent" aria-hidden />
      ))}
      {twistie === 'hidden' ? (
        <span className="tree-twistie hidden" aria-hidden />
      ) : (
        <Codicon
          name={twistie === 'expanded' ? 'chevron-down' : 'chevron-right'}
          className="tree-twistie"
        />
      )}
      <span className={['tree-icon', iconClassName].filter(Boolean).join(' ')} aria-hidden>
        <Codicon name={icon} />
      </span>
      <span className="tree-label">{label}</span>
    </button>
  );
}

export function TreeFileRow({
  label,
  title,
  onClick,
  className,
  icon = 'file-code',
}: {
  label: string;
  title?: string;
  onClick: () => void;
  className?: string;
  icon?: string;
}) {
  return (
    <TreeRow
      depth={0}
      twistie="hidden"
      icon={icon}
      label={label}
      title={title}
      className={className}
      onClick={onClick}
    />
  );
}

function TreeNode({
  node,
  depth,
  expanded,
  sheetsByFile,
  loadingSheets,
  onToggleFolder,
  onToggleWorkbook,
}: TreeNodeProps) {
  if (node.kind === 'folder') {
    const isExpanded = expanded[node.path];
    const hasChildren = (node.children?.length ?? 0) > 0;

    return (
      <div className="tree-node" role="group">
        <TreeRow
          depth={depth}
          twistie={hasChildren ? (isExpanded ? 'expanded' : 'collapsed') : 'hidden'}
          icon={isExpanded && hasChildren ? 'folder-opened' : 'folder'}
          label={node.name}
          title={node.path}
          className="tree-row-folder"
          onClick={() => onToggleFolder(node.path)}
        />
        {isExpanded && hasChildren ? (
          <FileTree
            nodes={node.children ?? []}
            depth={depth + 1}
            expanded={expanded}
            sheetsByFile={sheetsByFile}
            loadingSheets={loadingSheets}
            onToggleFolder={onToggleFolder}
            onToggleWorkbook={onToggleWorkbook}
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
      <div className="tree-node" role="group">
        <TreeRow
          depth={depth}
          twistie={isExpanded ? 'expanded' : 'collapsed'}
          icon="table"
          label={node.name}
          title={node.path}
          className="tree-row-workbook"
          iconClassName="tree-icon-spreadsheet"
          onClick={() => onToggleWorkbook(node)}
        />
        {isExpanded ? (
          <div className="tree-children" role="group">
            {loading ? (
              <div className="tree-status" style={{ paddingLeft: `${(depth + 1) * TREE_INDENT + 32}px` }}>
                <Codicon name="loading" className="tree-status-icon" />
                Loading sheets...
              </div>
            ) : sheets.length === 0 ? (
              <div className="tree-status" style={{ paddingLeft: `${(depth + 1) * TREE_INDENT + 32}px` }}>
                No sheets found
              </div>
            ) : (
              sheets.map((sheetName) => (
                <TreeRow
                  key={`${node.path}:${sheetName}`}
                  depth={depth + 1}
                  twistie="hidden"
                  icon="symbol-misc"
                  label={sheetName}
                  className="tree-row-sheet"
                  iconClassName="tree-icon-sheet"
                  onClick={() => openFile(node.path, node.extension ?? '.xlsx', sheetName)}
                />
              ))
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const extension = node.extension ?? '';
  return (
    <TreeRow
      depth={depth}
      twistie="hidden"
      icon={getDataFileIcon(extension)}
      label={node.name}
      title={node.path}
      className="tree-row-file"
      iconClassName={`tree-icon-ext tree-icon-ext-${extension.replace('.', '') || 'file'}`}
      onClick={() => openFile(node.path, extension)}
    />
  );
}

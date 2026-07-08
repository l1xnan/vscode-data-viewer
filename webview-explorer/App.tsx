import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countTreeFiles, FileTree, filterTree, getFoldersToExpandForSearch, TreeFileRow } from './FileTree';
import { newSql, notifyReady, openSql, requestSheets } from './messaging';
import { DataFileTreeNode, ExtensionMessage, ScannedSqlFile, vscode } from './types';

const DEFAULT_SPLIT_RATIO = 0.65;
const MIN_SPLIT_RATIO = 0.2;
const MAX_SPLIT_RATIO = 0.8;

function clampSplitRatio(value: number): number {
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
}

function readSplitRatio(): number {
  const saved = vscode.getState()?.splitRatio;
  return typeof saved === 'number' ? clampSplitRatio(saved) : DEFAULT_SPLIT_RATIO;
}

function matchesSearch(text: string, search: string): boolean {
  if (!search.trim()) {
    return true;
  }
  return text.toLowerCase().includes(search.trim().toLowerCase());
}

export function App() {
  const [tree, setTree] = useState<DataFileTreeNode[]>([]);
  const [sqlFiles, setSqlFiles] = useState<ScannedSqlFile[]>([]);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sheetsByFile, setSheetsByFile] = useState<Record<string, string[]>>({});
  const [loadingSheets, setLoadingSheets] = useState<Record<string, boolean>>({});
  const [splitRatio, setSplitRatio] = useState(readSplitRatio);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const panelsRef = useRef<HTMLDivElement>(null);
  const splitRatioRef = useRef(splitRatio);

  useEffect(() => {
    splitRatioRef.current = splitRatio;
  }, [splitRatio]);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      if (message?.type === 'files') {
        setTree(message.payload.tree);
        setSqlFiles(message.payload.sqlFiles);
        setWorkspaceOpen(message.payload.workspaceOpen);
        setLoaded(true);
        const roots = message.payload.tree.filter((node) => node.kind === 'folder');
        if (roots.length > 0) {
          setExpanded((prev) => {
            const next = { ...prev };
            for (const root of roots) {
              next[root.path] = true;
            }
            return next;
          });
        }
      }
      if (message?.type === 'sheets') {
        setSheetsByFile((prev) => ({
          ...prev,
          [message.payload.filePath]: message.payload.sheets,
        }));
        setLoadingSheets((prev) => ({ ...prev, [message.payload.filePath]: false }));
      }
      if (message?.type === 'sheetsError') {
        setLoadingSheets((prev) => ({ ...prev, [message.payload.filePath]: false }));
      }
    };

    window.addEventListener('message', handler);
    notifyReady();
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateSplitFromPointer = useCallback((clientY: number) => {
    const panels = panelsRef.current;
    if (!panels) {
      return;
    }
    const rect = panels.getBoundingClientRect();
    const splitterHeight = panels.querySelector('.panel-splitter')?.getBoundingClientRect().height ?? 1;
    const available = rect.height - splitterHeight;
    if (available <= 0) {
      return;
    }
    setSplitRatio(clampSplitRatio((clientY - rect.top) / available));
  }, []);

  const startSplitDrag = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingSplit(true);
      updateSplitFromPointer(event.clientY);
    },
    [updateSplitFromPointer],
  );

  useEffect(() => {
    if (!isDraggingSplit) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      updateSplitFromPointer(event.clientY);
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
      vscode.setState({ ...vscode.getState(), splitRatio: splitRatioRef.current });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit, updateSplitFromPointer]);

  useEffect(() => {
    if (!search.trim()) {
      return;
    }
    const pathsToExpand = getFoldersToExpandForSearch(tree, search);
    if (pathsToExpand.length === 0) {
      return;
    }
    setExpanded((prev) => {
      const next = { ...prev };
      for (const path of pathsToExpand) {
        next[path] = true;
      }
      return next;
    });
  }, [search, tree]);

  const fileCount = useMemo(() => countTreeFiles(tree), [tree]);
  const visibleTree = useMemo(
    () => (search.trim() ? filterTree(tree, search) : tree),
    [tree, search],
  );
  const visibleFileCount = useMemo(() => countTreeFiles(visibleTree), [visibleTree]);

  const filteredSqlFiles = useMemo(
    () =>
      sqlFiles.filter(
        (file) => matchesSearch(file.fileName, search) || matchesSearch(file.filePath, search),
      ),
    [sqlFiles, search],
  );

  const toggleFolder = (folderPath: string) => {
    setExpanded((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

  const toggleWorkbook = (node: DataFileTreeNode) => {
    const isExpanded = expanded[node.path];
    setExpanded((prev) => ({ ...prev, [node.path]: !isExpanded }));
    if (!isExpanded && !sheetsByFile[node.path]) {
      setLoadingSheets((prev) => ({ ...prev, [node.path]: true }));
      requestSheets(node.path);
    }
  };

  const emptyDataMessage = !loaded
    ? 'Loading data files...'
    : !workspaceOpen
      ? 'Open a workspace folder containing data files (File → Open Folder).'
      : fileCount === 0
        ? 'No data files found in the workspace.'
        : 'No files match your search.';

  const showDataEmpty =
    !loaded || !workspaceOpen || fileCount === 0 || (search.trim() && visibleFileCount === 0);

  return (
    <div className={`explorer${isDraggingSplit ? ' explorer-split-dragging' : ''}`}>
      <div className="search-bar">
        <input
          className="search-input"
          type="search"
          placeholder="Search data files..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="panels" ref={panelsRef}>
        <section className="panel panel-data" style={{ flex: `${splitRatio} 1 0%` }}>
          <div className="section-header section-header-first">
            <span>Data Files</span>
          </div>
          <div className="panel-body">
            {showDataEmpty ? (
              <div className="empty-state">{emptyDataMessage}</div>
            ) : (
              <FileTree
                nodes={visibleTree}
                expanded={expanded}
                sheetsByFile={sheetsByFile}
                loadingSheets={loadingSheets}
                onToggleFolder={toggleFolder}
                onToggleWorkbook={toggleWorkbook}
              />
            )}
          </div>
        </section>

        <div
          className={`panel-splitter${isDraggingSplit ? ' dragging' : ''}`}
          role="separator"
          aria-orientation="horizontal"
          aria-valuenow={Math.round(splitRatio * 100)}
          aria-valuemin={Math.round(MIN_SPLIT_RATIO * 100)}
          aria-valuemax={Math.round(MAX_SPLIT_RATIO * 100)}
          onMouseDown={startSplitDrag}
        />

        <section className="panel panel-sql" style={{ flex: `${1 - splitRatio} 1 0%` }}>
          <div className="section-header">
            <span>SQL Files</span>
            <button type="button" className="new-sql-button" onClick={() => newSql()} title="New Query">
              +
            </button>
          </div>
          <div className="panel-body">
            {filteredSqlFiles.length === 0 ? (
              <div className="empty-state">
                {workspaceOpen ? 'No SQL snippets yet. Click + to create one.' : 'Open a workspace folder.'}
              </div>
            ) : (
              filteredSqlFiles.map((file) => (
                <TreeFileRow
                  key={file.filePath}
                  label={file.fileName}
                  title={file.filePath}
                  className="tree-row-file tree-row-sql"
                  onClick={() => openSql(file.filePath)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

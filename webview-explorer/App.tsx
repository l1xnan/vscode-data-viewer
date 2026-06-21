import { useEffect, useMemo, useState } from 'react';
import { countTreeFiles, FileTree, filterTree } from './FileTree';
import { newSql, notifyReady, openSql, requestSheets } from './messaging';
import { DataFileTreeNode, ExtensionMessage, ScannedSqlFile } from './types';

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
    <div className="explorer">
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

      <div className="file-list">
        <div className="section-header">
          <span>Data Files</span>
        </div>
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
            forceExpand={Boolean(search.trim())}
          />
        )}

        <div className="section-header section-header-sql">
          <span>SQL Files</span>
          <button type="button" className="new-sql-button" onClick={() => newSql()} title="New Query">
            +
          </button>
        </div>
        {filteredSqlFiles.length === 0 ? (
          <div className="empty-state">
            {workspaceOpen ? 'No SQL snippets yet. Click + to create one.' : 'Open a workspace folder.'}
          </div>
        ) : (
          filteredSqlFiles.map((file) => (
            <button
              key={file.filePath}
              type="button"
              className="file-item sql-file"
              onClick={() => openSql(file.filePath)}
              title={file.filePath}
            >
              <span className="expand-icon" />
              <span>{file.fileName}</span>
              <span className="file-meta">sql</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { notifyReady, openFile, requestSheets } from './messaging';
import { ExtensionMessage, ScannedDataFile } from './types';

function matchesSearch(file: ScannedDataFile, search: string): boolean {
  if (!search.trim()) {
    return true;
  }
  const query = search.trim().toLowerCase();
  return (
    file.fileName.toLowerCase().includes(query) ||
    file.filePath.toLowerCase().includes(query) ||
    file.extension.toLowerCase().includes(query)
  );
}

export function App() {
  const [files, setFiles] = useState<ScannedDataFile[]>([]);
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
        setFiles(message.payload.files);
        setWorkspaceOpen(message.payload.workspaceOpen);
        setLoaded(true);
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

  const filteredFiles = useMemo(
    () => files.filter((file) => matchesSearch(file, search)),
    [files, search],
  );

  const toggleWorkbook = (file: ScannedDataFile) => {
    const isExpanded = expanded[file.filePath];
    setExpanded((prev) => ({ ...prev, [file.filePath]: !isExpanded }));
    if (!isExpanded && !sheetsByFile[file.filePath]) {
      setLoadingSheets((prev) => ({ ...prev, [file.filePath]: true }));
      requestSheets(file.filePath);
    }
  };

  const emptyMessage = !loaded
    ? 'Loading data files...'
    : !workspaceOpen
      ? 'Open a workspace folder containing data files (File → Open Folder).'
      : files.length === 0
        ? 'No data files found in the workspace.'
        : 'No files match your search.';

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
        {filteredFiles.length === 0 ? (
          <div className="empty-state">{emptyMessage}</div>
        ) : (
          filteredFiles.map((file) => {
            if (file.kind === 'workbook') {
              const isExpanded = expanded[file.filePath];
              const sheets = sheetsByFile[file.filePath] ?? [];
              const loading = loadingSheets[file.filePath];

              return (
                <div key={file.filePath}>
                  <button
                    type="button"
                    className="file-item workbook"
                    onClick={() => toggleWorkbook(file)}
                  >
                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    <span>{file.fileName}</span>
                    <span className="file-meta">xlsx</span>
                  </button>
                  {isExpanded ? (
                    <div className="sheet-list">
                      {loading ? (
                        <div className="empty-state">Loading sheets...</div>
                      ) : sheets.length === 0 ? (
                        <div className="empty-state">No sheets found</div>
                      ) : (
                        sheets.map((sheetName) => (
                          <button
                            key={`${file.filePath}:${sheetName}`}
                            type="button"
                            className="sheet-item"
                            onClick={() => openFile(file.filePath, file.extension, sheetName)}
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
                key={file.filePath}
                type="button"
                className="file-item"
                onClick={() => openFile(file.filePath, file.extension)}
                title={file.filePath}
              >
                <span className="expand-icon" />
                <span>{file.fileName}</span>
                <span className="file-meta">{file.extension.replace('.', '')}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

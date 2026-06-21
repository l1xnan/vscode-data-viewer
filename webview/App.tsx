import { SortingState } from '@tanstack/react-table';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable } from './components/DataTable';
import { SqlEditor } from './components/SqlEditor';
import { TableToolbar } from './components/TableToolbar';
import { DEFAULT_PAGE_SIZE } from './constants';
import { notifyReady, postQuery } from './messaging';
import {
  CompletionCatalogData,
  ExtensionMessage,
  QueryColumn,
  QueryResultPayload,
} from './types';

const emptyCatalog: CompletionCatalogData = { keywords: [], functions: [] };

const emptyResult: QueryResultPayload = {
  columns: [],
  rows: [],
  totalCount: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const DEFAULT_EDITOR_HEIGHT = 220;
const MIN_EDITOR_HEIGHT = 80;
const MIN_TABLE_HEIGHT = 120;

export function App() {
  const [initialized, setInitialized] = useState(false);
  const [sql, setSql] = useState('');
  const [catalog, setCatalog] = useState<CompletionCatalogData>(emptyCatalog);
  const [completionColumns, setCompletionColumns] = useState<QueryColumn[]>([]);
  const [result, setResult] = useState<QueryResultPayload>(emptyResult);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editorHeight, setEditorHeight] = useState(DEFAULT_EDITOR_HEIGHT);
  const filterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sqlRef = useRef(sql);
  const draggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(DEFAULT_EDITOR_HEIGHT);

  sqlRef.current = sql;

  const sendQuery = useCallback(
    (
      nextSql: string,
      page: number,
      pageSize: number,
      nextSorting: SortingState,
      nextFilters: Record<string, string>,
    ) => {
      const sort = nextSorting[0]
        ? {
            column: nextSorting[0].id,
            direction: nextSorting[0].desc ? ('desc' as const) : ('asc' as const),
          }
        : undefined;

      postQuery({
        sql: nextSql,
        page,
        pageSize,
        sort,
        filters: nextFilters,
      });
    },
    [],
  );

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      if (message?.type === 'init') {
        setSql(message.payload.sql);
        setCatalog(message.payload.catalog);
        setCompletionColumns(message.payload.columns);
        setResult((prev) => ({ ...prev, pageSize: message.payload.pageSize }));
        setInitialized(true);
      }
      if (message?.type === 'setSql') {
        setSql(message.payload.sql);
      }
      if (message?.type === 'queryResult') {
        setResult(message.payload);
        if (message.payload.columns.length > 0) {
          setCompletionColumns(message.payload.columns);
        }
      }
    };

    window.addEventListener('message', handler);
    notifyReady();
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingRef.current) {
        return;
      }
      const delta = event.clientY - dragStartYRef.current;
      const app = document.querySelector('.app');
      const maxHeight = app
        ? app.clientHeight - MIN_TABLE_HEIGHT - 48
        : window.innerHeight - MIN_TABLE_HEIGHT - 48;
      const next = Math.min(
        Math.max(dragStartHeightRef.current + delta, MIN_EDITOR_HEIGHT),
        maxHeight,
      );
      setEditorHeight(next);
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleRun = useCallback(() => {
    sendQuery(sqlRef.current, 1, result.pageSize, sorting, filters);
  }, [sendQuery, result.pageSize, sorting, filters]);

  const handlePageChange = (page: number) => {
    sendQuery(sql, page, result.pageSize, sorting, filters);
  };

  const handlePageSizeChange = (pageSize: number) => {
    sendQuery(sql, 1, pageSize, sorting, filters);
  };

  const handleRefresh = () => {
    sendQuery(sql, result.page, result.pageSize, sorting, filters);
  };

  const handleSortChange = (nextSorting: SortingState) => {
    setSorting(nextSorting);
    sendQuery(sql, 1, result.pageSize, nextSorting, filters);
  };

  const handleFilterChange = (column: string, value: string) => {
    const nextFilters = { ...filters, [column]: value };
    setFilters(nextFilters);
    if (filterTimer.current) {
      clearTimeout(filterTimer.current);
    }
    filterTimer.current = setTimeout(() => {
      sendQuery(sql, 1, result.pageSize, sorting, nextFilters);
    }, 300);
  };

  const startDrag = (event: React.MouseEvent) => {
    draggingRef.current = true;
    dragStartYRef.current = event.clientY;
    dragStartHeightRef.current = editorHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  if (!initialized) {
    return <div className="empty-state">Loading...</div>;
  }

  return (
    <div className="app">
      {result.error ? <div className="error-banner">{result.error}</div> : null}
      <div className="editor-section" style={{ height: editorHeight }}>
        <div className="editor-toolbar">
          <button type="button" className="run-button" onClick={handleRun}>
            Run (Ctrl+Enter)
          </button>
        </div>
        <SqlEditor
          value={sql}
          catalog={catalog}
          columns={completionColumns}
          onChange={setSql}
          onRun={handleRun}
        />
      </div>
      <div
        className="splitter"
        role="separator"
        aria-orientation="horizontal"
        onMouseDown={startDrag}
      />
      <div className="table-section">
        <TableToolbar
          page={result.page}
          pageSize={result.pageSize}
          totalCount={result.totalCount}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onRefresh={handleRefresh}
        />
        <DataTable
          columns={result.columns}
          rows={result.rows}
          sorting={sorting}
          filters={filters}
          onSortChange={handleSortChange}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  );
}

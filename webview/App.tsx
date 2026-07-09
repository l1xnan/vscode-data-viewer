import { SortingState } from '@tanstack/react-table';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable } from './components/DataTable';
import { RowDetailModal } from './components/RowDetailModal';
import { SqlEditor, SqlEditorHandle } from './components/SqlEditor';
import { TableToolbar } from './components/TableToolbar';
import { DEFAULT_PAGE_SIZE } from './constants';
import { notifyReady, postQuery, postSqlChanged } from './messaging';
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
const SQL_SAVE_DEBOUNCE_MS = 400;

export function App() {
  const [initialized, setInitialized] = useState(false);
  const [sql, setSql] = useState('');
  const [catalog, setCatalog] = useState<CompletionCatalogData>(emptyCatalog);
  const [completionColumns, setCompletionColumns] = useState<QueryColumn[]>([]);
  const [result, setResult] = useState<QueryResultPayload>(emptyResult);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editorHeight, setEditorHeight] = useState(DEFAULT_EDITOR_HEIGHT);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const filterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sqlSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const executedSqlRef = useRef(sql);
  const sqlRef = useRef(sql);
  const sqlEditorRef = useRef<SqlEditorHandle>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(DEFAULT_EDITOR_HEIGHT);

  sqlRef.current = sql;

  const getMaxEditorHeight = useCallback(() => {
    const app = appRef.current;
    if (!app) {
      return DEFAULT_EDITOR_HEIGHT;
    }

    const splitter = app.querySelector<HTMLElement>('.splitter');
    const tableSection = app.querySelector<HTMLElement>('.table-section');
    const errorBanner = app.querySelector<HTMLElement>('.error-banner');
    const splitterHeight = splitter?.getBoundingClientRect().height ?? 1;
    const tableToolbarHeight =
      tableSection?.querySelector<HTMLElement>('.toolbar')?.getBoundingClientRect().height ?? 40;
    const reserved =
      splitterHeight +
      tableToolbarHeight +
      MIN_TABLE_HEIGHT +
      (errorBanner?.getBoundingClientRect().height ?? 0);

    return Math.max(MIN_EDITOR_HEIGHT, app.clientHeight - reserved);
  }, []);

  const updateEditorHeightFromPointer = useCallback(
    (clientY: number) => {
      const delta = clientY - dragStartYRef.current;
      const maxHeight = getMaxEditorHeight();
      const next = Math.min(
        Math.max(dragStartHeightRef.current + delta, MIN_EDITOR_HEIGHT),
        maxHeight,
      );
      setEditorHeight(next);
    },
    [getMaxEditorHeight],
  );

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
      setIsQueryLoading(true);
    },
    [],
  );

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      if (message?.type === 'init') {
        setSql(message.payload.sql);
        executedSqlRef.current = message.payload.sql;
        setCatalog(message.payload.catalog);
        setCompletionColumns(message.payload.columns);
        setResult((prev) => ({ ...prev, pageSize: message.payload.pageSize }));
        setIsQueryLoading(true);
        setInitialized(true);
      }
      if (message?.type === 'setSql') {
        setSql(message.payload.sql);
      }
      if (message?.type === 'queryResult') {
        setResult(message.payload);
        setIsQueryLoading(false);
        if (message.payload.columns.length > 0) {
          setCompletionColumns(message.payload.columns);
        }
      }
    };

    window.addEventListener('message', handler);
    notifyReady();
    return () => window.removeEventListener('message', handler);
  }, []);

  const startDrag = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragStartYRef.current = event.clientY;
      dragStartHeightRef.current = editorHeight;
      setIsDraggingSplit(true);
      updateEditorHeightFromPointer(event.clientY);
    },
    [editorHeight, updateEditorHeightFromPointer],
  );

  useEffect(() => {
    if (!isDraggingSplit) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      updateEditorHeightFromPointer(event.clientY);
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit, updateEditorHeightFromPointer]);

  const handleRun = useCallback(
    (sqlToRun: string) => {
      const query = sqlToRun.trim();
      if (!query) {
        return;
      }
      executedSqlRef.current = query;
      sendQuery(query, 1, result.pageSize, sorting, filters);
    },
    [sendQuery, result.pageSize, sorting, filters],
  );

  const runFromEditor = useCallback(() => {
    sqlEditorRef.current?.run();
  }, []);

  const handleSqlChange = useCallback((value: string) => {
    setSql(value);
    if (sqlSaveTimer.current) {
      clearTimeout(sqlSaveTimer.current);
    }
    sqlSaveTimer.current = setTimeout(() => {
      postSqlChanged(value);
    }, SQL_SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (sqlSaveTimer.current) {
        clearTimeout(sqlSaveTimer.current);
      }
      postSqlChanged(sqlRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedRowIndex !== null && selectedRowIndex >= result.rows.length) {
      setSelectedRowIndex(null);
    }
  }, [result.rows, selectedRowIndex]);

  const handlePageChange = (page: number) => {
    sendQuery(executedSqlRef.current, page, result.pageSize, sorting, filters);
  };

  const handlePageSizeChange = (pageSize: number) => {
    sendQuery(executedSqlRef.current, 1, pageSize, sorting, filters);
  };

  const handleRefresh = () => {
    sendQuery(executedSqlRef.current, result.page, result.pageSize, sorting, filters);
  };

  const handleSortChange = (nextSorting: SortingState) => {
    setSorting(nextSorting);
    sendQuery(executedSqlRef.current, 1, result.pageSize, nextSorting, filters);
  };

  const handleFilterChange = (column: string, value: string) => {
    const nextFilters = { ...filters, [column]: value };
    setFilters(nextFilters);
    if (filterTimer.current) {
      clearTimeout(filterTimer.current);
    }
    filterTimer.current = setTimeout(() => {
      sendQuery(executedSqlRef.current, 1, result.pageSize, sorting, nextFilters);
    }, 300);
  };

  if (!initialized) {
    return <div className="empty-state">Loading...</div>;
  }

  return (
    <div className={`app${isDraggingSplit ? ' app-split-dragging' : ''}`} ref={appRef}>
      {result.error ? <div className="error-banner">{result.error}</div> : null}
      <div
        className="editor-section"
        style={{ height: editorHeight, flex: `0 0 ${editorHeight}px` }}
      >
        <div className="editor-toolbar">
          <button type="button" className="run-button" onClick={runFromEditor}>
            Run (Ctrl+Enter)
          </button>
        </div>
        <SqlEditor
          ref={sqlEditorRef}
          value={sql}
          catalog={catalog}
          columns={completionColumns}
          onChange={handleSqlChange}
          onRun={handleRun}
        />
      </div>
      <div
        className={`splitter${isDraggingSplit ? ' dragging' : ''}`}
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={editorHeight}
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
          loading={isQueryLoading}
          onSortChange={handleSortChange}
          onFilterChange={handleFilterChange}
          onRowDoubleClick={(_row, index) => setSelectedRowIndex(index)}
        />
      </div>
      {selectedRowIndex !== null && result.rows[selectedRowIndex] ? (
        <RowDetailModal
          row={result.rows[selectedRowIndex]}
          rowIndex={selectedRowIndex}
          page={result.page}
          pageSize={result.pageSize}
          totalCount={result.totalCount}
          pageRowCount={result.rows.length}
          onPrevious={() => setSelectedRowIndex((index) => (index !== null ? index - 1 : null))}
          onNext={() => setSelectedRowIndex((index) => (index !== null ? index + 1 : null))}
          onClose={() => setSelectedRowIndex(null)}
        />
      ) : null}
    </div>
  );
}

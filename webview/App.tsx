import { SortingState } from '@tanstack/react-table';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable } from './components/DataTable';
import { TableToolbar } from './components/TableToolbar';
import { notifyReady, postTableQuery } from './messaging';
import { ExtensionMessage, QueryResultPayload } from './types';
import { DEFAULT_PAGE_SIZE } from './constants';

const emptyResult: QueryResultPayload = {
  columns: [],
  rows: [],
  totalCount: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function App() {
  const [result, setResult] = useState<QueryResultPayload>(emptyResult);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const filterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sendQuery = useCallback(
    (
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

      postTableQuery({
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
      if (message?.type === 'queryResult' || message?.type === 'init') {
        setResult(message.payload);
      }
    };

    window.addEventListener('message', handler);
    notifyReady();
    return () => window.removeEventListener('message', handler);
  }, []);

  const handlePageChange = (page: number) => {
    sendQuery(page, result.pageSize, sorting, filters);
  };

  const handlePageSizeChange = (pageSize: number) => {
    sendQuery(1, pageSize, sorting, filters);
  };

  const handleRefresh = () => {
    sendQuery(result.page, result.pageSize, sorting, filters);
  };

  const handleSortChange = (nextSorting: SortingState) => {
    setSorting(nextSorting);
    sendQuery(1, result.pageSize, nextSorting, filters);
  };

  const handleFilterChange = (column: string, value: string) => {
    const nextFilters = { ...filters, [column]: value };
    setFilters(nextFilters);
    if (filterTimer.current) {
      clearTimeout(filterTimer.current);
    }
    filterTimer.current = setTimeout(() => {
      sendQuery(1, result.pageSize, sorting, nextFilters);
    }, 300);
  };

  return (
    <div className="app">
      {result.error ? <div className="error-banner">{result.error}</div> : null}
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
  );
}

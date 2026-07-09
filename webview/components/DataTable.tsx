import {
  Column,
  ColumnDef,
  ColumnPinningState,
  ColumnSizingState,
  flexRender,
  getCoreRowModel,
  Header,
  Row,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { QueryColumn } from '../types';

const DEFAULT_COLUMN_WIDTH = 120;
const MIN_COLUMN_WIDTH = 48;
const MAX_COLUMN_WIDTH = 600;

interface DataTableProps {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  sorting: SortingState;
  filters: Record<string, string>;
  loading?: boolean;
  onSortChange: (sorting: SortingState) => void;
  onFilterChange: (column: string, value: string) => void;
  onRowDoubleClick?: (row: Record<string, unknown>, index: number) => void;
}

interface PinMenuState {
  columnId: string;
  x: number;
  y: number;
}

function TableLoadingOverlay() {
  return (
    <div className="table-loading-overlay" role="status" aria-live="polite">
      <span className="table-loading-spinner" aria-hidden />
      Loading...
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function columnWidthStyle(size: number): CSSProperties {
  return {
    width: size,
    minWidth: size,
    maxWidth: size,
  };
}

function getPinningStyle(
  column: Column<Record<string, unknown>, unknown>,
  options: { isHeader?: boolean; isLastLeft?: boolean; isFirstRight?: boolean } = {},
): CSSProperties {
  const pinned = column.getIsPinned();
  if (!pinned) {
    return {};
  }

  return {
    position: 'sticky',
    left: pinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: pinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    zIndex: options.isHeader ? 3 : 1,
    boxShadow:
      options.isLastLeft && pinned === 'left'
        ? '2px 0 4px -2px color-mix(in srgb, var(--vscode-foreground) 18%, transparent)'
        : options.isFirstRight && pinned === 'right'
          ? '-2px 0 4px -2px color-mix(in srgb, var(--vscode-foreground) 18%, transparent)'
          : undefined,
  };
}

function getPinningClassName(column: Column<Record<string, unknown>, unknown>): string {
  const pinned = column.getIsPinned();
  if (!pinned) {
    return '';
  }
  return `is-pinned is-pinned-${pinned}`;
}

function renderHeaderCell(
  header: Header<Record<string, unknown>, unknown>,
  columns: QueryColumn[],
  isLastLeft: boolean,
  isFirstRight: boolean,
  onContextMenu: (event: MouseEvent<HTMLTableCellElement>, columnId: string) => void,
) {
  const sorted = header.column.getIsSorted();
  const width = header.getSize();
  const pinned = header.column.getIsPinned();

  return (
    <th
      key={header.id}
      className={`sortable${getPinningClassName(header.column) ? ` ${getPinningClassName(header.column)}` : ''}`}
      style={{
        ...columnWidthStyle(width),
        ...getPinningStyle(header.column, { isHeader: true, isLastLeft, isFirstRight }),
      }}
      title={columns.find((c) => c.name === header.column.id)?.type}
      onContextMenu={(event) => onContextMenu(event, header.column.id)}
    >
      <div className="th-content" onClick={header.column.getToggleSortingHandler()}>
        {pinned ? <span className="pin-indicator" title="Pinned column" aria-hidden /> : null}
        {flexRender(header.column.columnDef.header, header.getContext())}
        <span className="sort-indicator">
          {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}
        </span>
      </div>
      <div
        className={`col-resizer${header.column.getIsResizing() ? ' is-resizing' : ''}`}
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        onClick={(event) => event.stopPropagation()}
        aria-hidden
      />
    </th>
  );
}

function renderBodyCell(
  cell: ReturnType<Row<Record<string, unknown>>['getVisibleCells']>[number],
  isLastLeft: boolean,
  isFirstRight: boolean,
) {
  return (
    <td
      key={cell.id}
      className={getPinningClassName(cell.column)}
      style={{
        ...columnWidthStyle(cell.column.getSize()),
        ...getPinningStyle(cell.column, { isLastLeft, isFirstRight }),
      }}
      title={formatCellValue(cell.getValue())}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  );
}

export function DataTable({
  columns,
  rows,
  sorting,
  filters,
  loading = false,
  onSortChange,
  onFilterChange,
  onRowDoubleClick,
}: DataTableProps) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [pinMenu, setPinMenu] = useState<PinMenuState | null>(null);

  const columnDefs = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((column) => ({
        accessorKey: column.name,
        header: column.name,
        cell: ({ getValue }) => formatCellValue(getValue()),
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting, columnSizing, columnPinning },
    manualSorting: true,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    enableColumnPinning: true,
    defaultColumn: {
      size: DEFAULT_COLUMN_WIDTH,
      minSize: MIN_COLUMN_WIDTH,
      maxSize: MAX_COLUMN_WIDTH,
    },
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onSortChange(next);
    },
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
  });

  const isResizing = Boolean(table.getState().columnSizingInfo.isResizingColumn);

  const leftColumns = table.getLeftLeafColumns();
  const rightColumns = table.getRightLeafColumns();
  const orderedColumns = [
    ...leftColumns,
    ...table.getCenterLeafColumns(),
    ...rightColumns,
  ];
  const lastLeftColumnId = leftColumns[leftColumns.length - 1]?.id;
  const firstRightColumnId = rightColumns[0]?.id;

  useEffect(() => {
    const columnIds = new Set(columns.map((column) => column.name));
    setColumnPinning((prev) => ({
      left: (prev.left ?? []).filter((id) => columnIds.has(id)),
      right: (prev.right ?? []).filter((id) => columnIds.has(id)),
    }));
  }, [columns]);

  useEffect(() => {
    if (!pinMenu) {
      return;
    }

    const closeMenu = () => setPinMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pinMenu]);

  if (columns.length === 0) {
    if (loading) {
      return (
        <div className="table-container table-loading-only">
          <TableLoadingOverlay />
        </div>
      );
    }
    return <div className="empty-state">No columns to display</div>;
  }

  const handleHeaderContextMenu = (
    event: MouseEvent<HTMLTableCellElement>,
    columnId: string,
  ) => {
    const column = table.getColumn(columnId);
    if (!column?.getCanPin()) {
      return;
    }
    event.preventDefault();
    setPinMenu({ columnId, x: event.clientX, y: event.clientY });
  };

  const pinColumn = (position: 'left' | 'right' | false) => {
    if (!pinMenu) {
      return;
    }
    table.getColumn(pinMenu.columnId)?.pin(position);
    setPinMenu(null);
  };

  const pinMenuColumn = pinMenu ? table.getColumn(pinMenu.columnId) : undefined;
  const pinMenuPinned = pinMenuColumn?.getIsPinned();

  return (
    <div className={`table-container${isResizing ? ' table-col-resizing' : ''}${loading ? ' is-loading' : ''}`}>
      {loading ? <TableLoadingOverlay /> : null}
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) =>
                renderHeaderCell(
                  header,
                  columns,
                  header.column.id === lastLeftColumnId,
                  header.column.id === firstRightColumnId,
                  handleHeaderContextMenu,
                ),
              )}
            </tr>
          ))}
          <tr className="filter-row">
            {orderedColumns.map((column) => (
              <th
                key={`filter-${column.id}`}
                className={getPinningClassName(column)}
                style={{
                  ...columnWidthStyle(column.getSize()),
                  ...getPinningStyle(column, {
                    isHeader: true,
                    isLastLeft: column.id === lastLeftColumnId,
                    isFirstRight: column.id === firstRightColumnId,
                  }),
                }}
              >
                <input
                  type="text"
                  placeholder="Filter"
                  value={filters[column.id] ?? ''}
                  onChange={(event) => onFilterChange(column.id, event.target.value)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty-state">
                No rows
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, rowIndex) => {
              const cells = [
                ...row.getLeftVisibleCells(),
                ...row.getCenterVisibleCells(),
                ...row.getRightVisibleCells(),
              ];
              return (
                <tr
                  key={row.id}
                  className={onRowDoubleClick ? 'row-clickable' : undefined}
                  onDoubleClick={() => onRowDoubleClick?.(row.original, rowIndex)}
                >
                  {cells.map((cell) =>
                    renderBodyCell(
                      cell,
                      cell.column.id === lastLeftColumnId,
                      cell.column.id === firstRightColumnId,
                    ),
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {pinMenu && pinMenuColumn ? (
        <div
          className="column-pin-menu"
          style={{ left: pinMenu.x, top: pinMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => pinColumn('left')}>
            Pin left
          </button>
          <button type="button" onClick={() => pinColumn('right')}>
            Pin right
          </button>
          {pinMenuPinned ? (
            <button type="button" onClick={() => pinColumn(false)}>
              Unpin
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

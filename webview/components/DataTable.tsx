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
const ROW_NUMBER_COLUMN_ID = '_rowNumber';
const ROW_NUMBER_COLUMN_WIDTH = 56;

interface DataTableProps {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
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

function getColumnWidth(column: Column<Record<string, unknown>, unknown>): number {
  if (column.id === ROW_NUMBER_COLUMN_ID) {
    return ROW_NUMBER_COLUMN_WIDTH;
  }
  return column.getSize();
}

function stripRowNumberSizing(sizing: ColumnSizingState): ColumnSizingState {
  if (!(ROW_NUMBER_COLUMN_ID in sizing)) {
    return sizing;
  }
  const { [ROW_NUMBER_COLUMN_ID]: _removed, ...rest } = sizing;
  return rest;
}

function getRowNumberCellStyle(isHeader: boolean): CSSProperties {
  return {
    position: 'sticky',
    left: 0,
    top: isHeader ? 0 : undefined,
    ...columnWidthStyle(ROW_NUMBER_COLUMN_WIDTH),
    zIndex: isHeader ? 5 : 2,
    boxShadow:
      '2px 0 4px -2px color-mix(in srgb, var(--vscode-foreground) 18%, transparent)',
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

function withRowNumberPinning(pinning: ColumnPinningState): ColumnPinningState {
  const left = (pinning.left ?? []).filter((id) => id !== ROW_NUMBER_COLUMN_ID);
  return {
    left: [ROW_NUMBER_COLUMN_ID, ...left],
    right: pinning.right ?? [],
  };
}

function renderHeaderCell(
  header: Header<Record<string, unknown>, unknown>,
  columns: QueryColumn[],
  filters: Record<string, string>,
  isLastLeft: boolean,
  isFirstRight: boolean,
  onContextMenu: (event: MouseEvent<HTMLTableCellElement>, columnId: string) => void,
  onFilterChange: (column: string, value: string) => void,
) {
  const columnId = header.column.id;
  const isRowNumberColumn = columnId === ROW_NUMBER_COLUMN_ID;
  const sorted = header.column.getIsSorted();
  const width = isRowNumberColumn ? ROW_NUMBER_COLUMN_WIDTH : header.getSize();
  const pinned = header.column.getIsPinned();

  return (
    <th
      key={header.id}
      className={[
        isRowNumberColumn ? 'row-number-header' : 'sortable',
        getPinningClassName(header.column),
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...(isRowNumberColumn
          ? getRowNumberCellStyle(true)
          : {
              ...columnWidthStyle(width),
              ...getPinningStyle(header.column, { isHeader: true, isLastLeft, isFirstRight }),
            }),
      }}
      title={isRowNumberColumn ? 'Row number' : columns.find((c) => c.name === columnId)?.type}
      onContextMenu={isRowNumberColumn ? undefined : (event) => onContextMenu(event, columnId)}
    >
      <div
        className="th-content"
        onClick={isRowNumberColumn ? undefined : header.column.getToggleSortingHandler()}
      >
        {!isRowNumberColumn && pinned ? (
          <span className="pin-indicator" title="Pinned column" aria-hidden />
        ) : null}
        {flexRender(header.column.columnDef.header, header.getContext())}
        {!isRowNumberColumn ? (
          <span className="sort-indicator">
            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}
          </span>
        ) : null}
      </div>
      {!isRowNumberColumn ? (
        <div className="th-filter">
          <input
            type="text"
            placeholder={columnId}
            value={filters[columnId] ?? ''}
            onChange={(event) => onFilterChange(columnId, event.target.value)}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
      {!isRowNumberColumn ? (
        <div
          className={`col-resizer${header.column.getIsResizing() ? ' is-resizing' : ''}`}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onClick={(event) => event.stopPropagation()}
          aria-hidden
        />
      ) : null}
    </th>
  );
}

function renderBodyCell(
  cell: ReturnType<Row<Record<string, unknown>>['getVisibleCells']>[number],
  isLastLeft: boolean,
  isFirstRight: boolean,
) {
  const isRowNumberColumn = cell.column.id === ROW_NUMBER_COLUMN_ID;

  return (
    <td
      key={cell.id}
      className={[getPinningClassName(cell.column), isRowNumberColumn ? 'row-number-cell' : '']
        .filter(Boolean)
        .join(' ')}
      style={
        isRowNumberColumn
          ? getRowNumberCellStyle(false)
          : {
              ...columnWidthStyle(getColumnWidth(cell.column)),
              ...getPinningStyle(cell.column, { isLastLeft, isFirstRight }),
            }
      }
      title={isRowNumberColumn ? undefined : formatCellValue(cell.getValue())}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  );
}

export function DataTable({
  columns,
  rows,
  page,
  pageSize,
  sorting,
  filters,
  loading = false,
  onSortChange,
  onFilterChange,
  onRowDoubleClick,
}: DataTableProps) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() =>
    withRowNumberPinning({ left: [], right: [] }),
  );
  const [pinMenu, setPinMenu] = useState<PinMenuState | null>(null);

  const rowNumberStart = (page - 1) * pageSize;

  const columnDefs = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      {
        id: ROW_NUMBER_COLUMN_ID,
        header: '#',
        size: ROW_NUMBER_COLUMN_WIDTH,
        minSize: ROW_NUMBER_COLUMN_WIDTH,
        maxSize: ROW_NUMBER_COLUMN_WIDTH,
        enableSorting: false,
        enablePinning: true,
        enableResizing: false,
        cell: ({ row }) => String(rowNumberStart + row.index + 1),
      },
      ...columns.map((column) => ({
        accessorKey: column.name,
        header: column.name,
        cell: ({ getValue }: { getValue: () => unknown }) => formatCellValue(getValue()),
      })),
    ],
    [columns, rowNumberStart],
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
    onColumnSizingChange: (updater) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return stripRowNumberSizing(next);
      });
    },
    onColumnPinningChange: (updater) => {
      setColumnPinning((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return withRowNumberPinning(next);
      });
    },
  });

  const isResizing = Boolean(table.getState().columnSizingInfo.isResizingColumn);

  const leftColumns = table.getLeftLeafColumns();
  const centerColumns = table.getCenterLeafColumns();
  const rightColumns = table.getRightLeafColumns();
  const leafColumns = [...leftColumns, ...centerColumns, ...rightColumns];
  const lastLeftColumnId = leftColumns[leftColumns.length - 1]?.id;
  const firstRightColumnId = rightColumns[0]?.id;

  useEffect(() => {
    const columnIds = new Set(columns.map((column) => column.name));
    setColumnPinning((prev) =>
      withRowNumberPinning({
        left: (prev.left ?? []).filter((id) => id === ROW_NUMBER_COLUMN_ID || columnIds.has(id)),
        right: (prev.right ?? []).filter((id) => columnIds.has(id)),
      }),
    );
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
    if (columnId === ROW_NUMBER_COLUMN_ID) {
      return;
    }
    const column = table.getColumn(columnId);
    if (!column?.getCanPin()) {
      return;
    }
    event.preventDefault();
    setPinMenu({ columnId, x: event.clientX, y: event.clientY });
  };

  const pinColumn = (position: 'left' | 'right' | false) => {
    if (!pinMenu || pinMenu.columnId === ROW_NUMBER_COLUMN_ID) {
      setPinMenu(null);
      return;
    }
    table.getColumn(pinMenu.columnId)?.pin(position);
    setPinMenu(null);
  };

  const pinMenuColumn = pinMenu ? table.getColumn(pinMenu.columnId) : undefined;
  const pinMenuPinned = pinMenuColumn?.getIsPinned();
  const tableWidth = leafColumns.reduce((total, column) => total + getColumnWidth(column), 0);

  return (
    <div className={`table-container${isResizing ? ' table-col-resizing' : ''}${loading ? ' is-loading' : ''}`}>
      {loading ? <TableLoadingOverlay /> : null}
      <table className="data-table" style={{ width: tableWidth }}>
        <colgroup>
          {leafColumns.map((column) => (
            <col
              key={column.id}
              className={column.id === ROW_NUMBER_COLUMN_ID ? 'row-number-col' : undefined}
              style={
                column.id === ROW_NUMBER_COLUMN_ID
                  ? { width: ROW_NUMBER_COLUMN_WIDTH }
                  : { width: column.getSize() }
              }
            />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) =>
                renderHeaderCell(
                  header,
                  columns,
                  filters,
                  header.column.id === lastLeftColumnId &&
                    header.column.id !== ROW_NUMBER_COLUMN_ID,
                  header.column.id === firstRightColumnId,
                  handleHeaderContextMenu,
                  onFilterChange,
                ),
              )}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="empty-state">
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
                      cell.column.id === lastLeftColumnId &&
                        cell.column.id !== ROW_NUMBER_COLUMN_ID,
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

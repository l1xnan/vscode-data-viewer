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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { QueryColumn } from '../types';

const DEFAULT_COLUMN_WIDTH = 120;
const MIN_COLUMN_WIDTH = 48;
const MAX_COLUMN_WIDTH = 600;
const ROW_NUMBER_COLUMN_ID = '_rowNumber';
const ROW_NUMBER_COLUMN_WIDTH = 56;
const HEADER_ROW_INDEX = -1;

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

interface CopyMenuState {
  x: number;
  y: number;
  pinColumnId?: string;
}

interface CellCoord {
  rowIndex: number;
  colIndex: number;
}

interface CellRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

function normalizeCellRange(anchor: CellCoord, focus: CellCoord): CellRange {
  return {
    startRow: Math.min(anchor.rowIndex, focus.rowIndex),
    endRow: Math.max(anchor.rowIndex, focus.rowIndex),
    startCol: Math.min(anchor.colIndex, focus.colIndex),
    endCol: Math.max(anchor.colIndex, focus.colIndex),
  };
}

function isCellInRange(rowIndex: number, colIndex: number, range: CellRange | null): boolean {
  if (!range) {
    return false;
  }
  return (
    rowIndex >= range.startRow &&
    rowIndex <= range.endRow &&
    colIndex >= range.startCol &&
    colIndex <= range.endCol
  );
}

function getColumnHeaderLabel(columnId: string): string {
  if (columnId === ROW_NUMBER_COLUMN_ID) {
    return '#';
  }
  return columnId;
}

function getCellText(
  rowIndex: number,
  colIndex: number,
  leafColumns: Column<Record<string, unknown>, unknown>[],
  rows: Record<string, unknown>[],
  rowNumberStart: number,
): string {
  const column = leafColumns[colIndex];
  if (rowIndex === HEADER_ROW_INDEX) {
    return getColumnHeaderLabel(column.id);
  }
  if (column.id === ROW_NUMBER_COLUMN_ID) {
    return String(rowNumberStart + rowIndex + 1);
  }
  return formatCellValue(rows[rowIndex][column.id]);
}

function selectionIncludesHeaderRow(range: CellRange): boolean {
  return range.startRow <= HEADER_ROW_INDEX && range.endRow >= HEADER_ROW_INDEX;
}

function escapeCsvValue(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildSelectionText(
  range: CellRange,
  leafColumns: Column<Record<string, unknown>, unknown>[],
  rows: Record<string, unknown>[],
  rowNumberStart: number,
): string {
  const lines: string[] = [];

  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    const cells: string[] = [];

    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      cells.push(getCellText(rowIndex, colIndex, leafColumns, rows, rowNumberStart));
    }

    lines.push(cells.join('\t'));
  }

  return lines.join('\n');
}

function buildSelectionCsvWithHeaders(
  range: CellRange,
  leafColumns: Column<Record<string, unknown>, unknown>[],
  rows: Record<string, unknown>[],
  rowNumberStart: number,
): string {
  const lines: string[] = [];

  if (!selectionIncludesHeaderRow(range)) {
    const headerCells: string[] = [];
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      headerCells.push(escapeCsvValue(getColumnHeaderLabel(leafColumns[colIndex].id)));
    }
    lines.push(headerCells.join(','));
  }

  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    if (rowIndex === HEADER_ROW_INDEX) {
      const headerCells: string[] = [];
      for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
        headerCells.push(
          escapeCsvValue(getColumnHeaderLabel(leafColumns[colIndex].id)),
        );
      }
      lines.push(headerCells.join(','));
      continue;
    }

    const cells: string[] = [];
    for (let colIndex = range.startCol; colIndex <= range.endCol; colIndex += 1) {
      cells.push(
        escapeCsvValue(getCellText(rowIndex, colIndex, leafColumns, rows, rowNumberStart)),
      );
    }
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
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
  colIndex: number,
  columns: QueryColumn[],
  filters: Record<string, string>,
  isLastLeft: boolean,
  isFirstRight: boolean,
  isSelected: boolean,
  onMouseDown: (event: MouseEvent<HTMLTableCellElement>, colIndex: number) => void,
  onMouseEnter: (colIndex: number) => void,
  onContextMenu: (
    event: MouseEvent<HTMLTableCellElement>,
    columnId: string,
    colIndex: number,
  ) => void,
  onFilterChange: (column: string, value: string) => void,
  onHeaderClick: (
    event: MouseEvent<HTMLDivElement>,
    sortHandler: ((event: unknown) => void) | undefined,
  ) => void,
) {
  const columnId = header.column.id;
  const isRowNumberColumn = columnId === ROW_NUMBER_COLUMN_ID;
  const sorted = header.column.getIsSorted();
  const width = isRowNumberColumn ? ROW_NUMBER_COLUMN_WIDTH : header.getSize();
  const pinned = header.column.getIsPinned();
  const sortHandler = isRowNumberColumn ? undefined : header.column.getToggleSortingHandler();

  return (
    <th
      key={header.id}
      className={[
        isRowNumberColumn ? 'row-number-header' : 'sortable',
        getPinningClassName(header.column),
        isSelected ? 'cell-selected' : '',
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
      onMouseDown={(event) => onMouseDown(event, colIndex)}
      onMouseEnter={() => onMouseEnter(colIndex)}
      onContextMenu={(event) => onContextMenu(event, columnId, colIndex)}
    >
      <div
        className="th-content"
        onClick={(event) => onHeaderClick(event, sortHandler)}
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
        <div className="th-filter" onMouseDown={(event) => event.stopPropagation()}>
          <input
            type="text"
            placeholder={columnId}
            value={filters[columnId] ?? ''}
            onChange={(event) => onFilterChange(columnId, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
      {!isRowNumberColumn ? (
        <div
          className={`col-resizer${header.column.getIsResizing() ? ' is-resizing' : ''}`}
          onMouseDown={(event) => {
            event.stopPropagation();
            header.getResizeHandler()(event);
          }}
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
  rowIndex: number,
  colIndex: number,
  isLastLeft: boolean,
  isFirstRight: boolean,
  isSelected: boolean,
  onMouseDown: (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => void,
  onMouseEnter: (rowIndex: number, colIndex: number) => void,
  onContextMenu: (event: MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => void,
) {
  const isRowNumberColumn = cell.column.id === ROW_NUMBER_COLUMN_ID;

  return (
    <td
      key={cell.id}
      className={[
        getPinningClassName(cell.column),
        isRowNumberColumn ? 'row-number-cell' : '',
        isSelected ? 'cell-selected' : '',
      ]
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
      onMouseDown={(event) => onMouseDown(event, rowIndex, colIndex)}
      onMouseEnter={() => onMouseEnter(rowIndex, colIndex)}
      onContextMenu={(event) => onContextMenu(event, rowIndex, colIndex)}
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
  const [copyMenu, setCopyMenu] = useState<CopyMenuState | null>(null);
  const [selection, setSelection] = useState<CellRange | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<CellCoord | null>(null);
  const [selectionFocus, setSelectionFocus] = useState<CellCoord | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionDragRef = useRef<{ x: number; y: number; didDrag: boolean } | null>(null);

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

  const columnIndexById = useMemo(() => {
    const map = new Map<string, number>();
    leafColumns.forEach((column, index) => {
      map.set(column.id, index);
    });
    return map;
  }, [leafColumns]);

  const activeSelection = useMemo(() => {
    if (isSelecting && selectionAnchor && selectionFocus) {
      return normalizeCellRange(selectionAnchor, selectionFocus);
    }
    return selection;
  }, [isSelecting, selection, selectionAnchor, selectionFocus]);

  const beginSelection = useCallback((rowIndex: number, colIndex: number, clientX: number, clientY: number) => {
    selectionDragRef.current = { x: clientX, y: clientY, didDrag: false };
    setCopyMenu(null);
    setSelectionAnchor({ rowIndex, colIndex });
    setSelectionFocus({ rowIndex, colIndex });
    setIsSelecting(true);
  }, []);

  const extendSelection = useCallback((rowIndex: number, colIndex: number) => {
    if (!isSelecting || !selectionDragRef.current) {
      return;
    }
    selectionDragRef.current.didDrag = true;
    setSelectionFocus({ rowIndex, colIndex });
  }, [isSelecting]);

  const copyActiveSelection = useCallback(async () => {
    if (!activeSelection) {
      return;
    }
    const text = buildSelectionText(activeSelection, leafColumns, rows, rowNumberStart);
    await copyTextToClipboard(text);
    setCopyMenu(null);
  }, [activeSelection, leafColumns, rowNumberStart, rows]);

  const copyActiveSelectionAsCsv = useCallback(async () => {
    if (!activeSelection) {
      return;
    }
    const text = buildSelectionCsvWithHeaders(activeSelection, leafColumns, rows, rowNumberStart);
    await copyTextToClipboard(text);
    setCopyMenu(null);
  }, [activeSelection, leafColumns, rowNumberStart, rows]);

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
    if (!copyMenu) {
      return;
    }

    const closeMenu = () => setCopyMenu(null);
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
  }, [copyMenu]);

  useEffect(() => {
    if (!isSelecting) {
      return;
    }

    const handleMouseUp = () => {
      setSelection((prev) => {
        if (selectionAnchor && selectionFocus) {
          return normalizeCellRange(selectionAnchor, selectionFocus);
        }
        return prev;
      });
      setIsSelecting(false);
      setSelectionAnchor(null);
      setSelectionFocus(null);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isSelecting, selectionAnchor, selectionFocus]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c' || !activeSelection) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      void copyActiveSelection();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSelection, copyActiveSelection]);

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
    colIndex: number,
  ) => {
    event.preventDefault();

    const clickedRange: CellRange = {
      startRow: HEADER_ROW_INDEX,
      endRow: HEADER_ROW_INDEX,
      startCol: colIndex,
      endCol: colIndex,
    };
    const range =
      activeSelection && isCellInRange(HEADER_ROW_INDEX, colIndex, activeSelection)
        ? activeSelection
        : clickedRange;

    setSelection(range);
    setSelectionAnchor(null);
    setSelectionFocus(null);
    setIsSelecting(false);
    setCopyMenu({
      x: event.clientX,
      y: event.clientY,
      pinColumnId: columnId !== ROW_NUMBER_COLUMN_ID ? columnId : undefined,
    });
  };

  const handleHeaderMouseDown = (event: MouseEvent<HTMLTableCellElement>, colIndex: number) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      return;
    }
    event.preventDefault();
    beginSelection(HEADER_ROW_INDEX, colIndex, event.clientX, event.clientY);
  };

  const handleHeaderClick = (
    event: MouseEvent<HTMLDivElement>,
    sortHandler: ((event: unknown) => void) | undefined,
  ) => {
    if (selectionDragRef.current?.didDrag) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    sortHandler?.(event);
  };

  const handleCellMouseDown = (
    event: MouseEvent<HTMLTableCellElement>,
    rowIndex: number,
    colIndex: number,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    beginSelection(rowIndex, colIndex, event.clientX, event.clientY);
  };

  const handleCellMouseEnter = (rowIndex: number, colIndex: number) => {
    extendSelection(rowIndex, colIndex);
  };

  const handleHeaderMouseEnter = (colIndex: number) => {
    extendSelection(HEADER_ROW_INDEX, colIndex);
  };

  const handleCellContextMenu = (
    event: MouseEvent<HTMLTableCellElement>,
    rowIndex: number,
    colIndex: number,
  ) => {
    event.preventDefault();

    const clickedRange: CellRange = {
      startRow: rowIndex,
      endRow: rowIndex,
      startCol: colIndex,
      endCol: colIndex,
    };
    const range =
      activeSelection && isCellInRange(rowIndex, colIndex, activeSelection)
        ? activeSelection
        : clickedRange;

    setSelection(range);
    setSelectionAnchor(null);
    setSelectionFocus(null);
    setIsSelecting(false);
    setCopyMenu({ x: event.clientX, y: event.clientY });
  };

  const pinColumn = (position: 'left' | 'right' | false) => {
    const columnId = copyMenu?.pinColumnId;
    if (!columnId || columnId === ROW_NUMBER_COLUMN_ID) {
      setCopyMenu(null);
      return;
    }
    table.getColumn(columnId)?.pin(position);
    setCopyMenu(null);
  };

  const pinMenuColumn = copyMenu?.pinColumnId ? table.getColumn(copyMenu.pinColumnId) : undefined;
  const pinMenuPinned = pinMenuColumn?.getIsPinned();
  const tableWidth = leafColumns.reduce((total, column) => total + getColumnWidth(column), 0);

  return (
    <div
      className={[
        'table-container',
        isResizing ? 'table-col-resizing' : '',
        loading ? 'is-loading' : '',
        isSelecting ? 'table-cell-selecting' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
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
              {headerGroup.headers.map((header) => {
                const colIndex = columnIndexById.get(header.column.id) ?? 0;
                return renderHeaderCell(
                  header,
                  colIndex,
                  columns,
                  filters,
                  header.column.id === lastLeftColumnId &&
                    header.column.id !== ROW_NUMBER_COLUMN_ID,
                  header.column.id === firstRightColumnId,
                  isCellInRange(HEADER_ROW_INDEX, colIndex, activeSelection),
                  handleHeaderMouseDown,
                  handleHeaderMouseEnter,
                  handleHeaderContextMenu,
                  onFilterChange,
                  handleHeaderClick,
                );
              })}
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
                  {cells.map((cell) => {
                    const colIndex = columnIndexById.get(cell.column.id) ?? 0;
                    return renderBodyCell(
                      cell,
                      rowIndex,
                      colIndex,
                      cell.column.id === lastLeftColumnId &&
                        cell.column.id !== ROW_NUMBER_COLUMN_ID,
                      cell.column.id === firstRightColumnId,
                      isCellInRange(rowIndex, colIndex, activeSelection),
                      handleCellMouseDown,
                      handleCellMouseEnter,
                      handleCellContextMenu,
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {copyMenu ? (
        <div
          className="column-pin-menu table-context-menu"
          style={{ left: copyMenu.x, top: copyMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => void copyActiveSelection()}>
            Copy
          </button>
          <button type="button" onClick={() => void copyActiveSelectionAsCsv()}>
            Copy as CSV (with headers)
          </button>
          {copyMenu.pinColumnId && pinMenuColumn ? (
            <>
              <div className="table-context-menu-separator" role="separator" />
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
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

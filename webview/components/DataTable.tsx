import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { QueryColumn } from '../types';

interface DataTableProps {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  sorting: SortingState;
  filters: Record<string, string>;
  onSortChange: (sorting: SortingState) => void;
  onFilterChange: (column: string, value: string) => void;
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

export function DataTable({
  columns,
  rows,
  sorting,
  filters,
  onSortChange,
  onFilterChange,
}: DataTableProps) {
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
    state: { sorting },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onSortChange(next);
    },
  });

  if (columns.length === 0) {
    return <div className="empty-state">No columns to display</div>;
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className="sortable"
                    onClick={header.column.getToggleSortingHandler()}
                    title={columns.find((c) => c.name === header.column.id)?.type}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <span className="sort-indicator">
                      {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
          <tr className="filter-row">
            {columns.map((column) => (
              <th key={`filter-${column.name}`}>
                <input
                  type="text"
                  placeholder="Filter"
                  value={filters[column.name] ?? ''}
                  onChange={(event) => onFilterChange(column.name, event.target.value)}
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
            table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} title={formatCellValue(cell.getValue())}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

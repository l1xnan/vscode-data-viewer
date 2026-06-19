import { PAGE_SIZE_OPTIONS } from '../constants';

interface TableToolbarProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh: () => void;
}

export function TableToolbar({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: TableToolbarProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(1)}>
          First
        </button>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          Last
        </button>
      </div>

      <div className="toolbar-group">
        <label htmlFor="page-size">Rows/page</label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <button type="button" onClick={onRefresh}>
        Refresh
      </button>

      <div className="stats">
        Rows {start}–{end} of {totalCount}
      </div>
    </div>
  );
}

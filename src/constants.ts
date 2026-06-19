export const DATA_VIEWER_VIEW_ID = 'dataViewer.explorer';
export const SQL_SCHEME = 'dataviewer-sql';
export const SQL_AUTHORITY = 'query';

export const DEFAULT_PAGE_SIZE = 500;
export const PAGE_SIZE_OPTIONS = [100, 500, 1000] as const;

export const DEFAULT_SUPPORTED_EXTENSIONS = [
  '.parquet',
  '.csv',
  '.tsv',
  '.json',
  '.jsonl',
  '.ndjson',
  '.xlsx',
];

export const DEFAULT_EXCLUDE_GLOBS = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/.vscode/**',
];

export type DataFileFormat =
  | 'parquet'
  | 'csv'
  | 'tsv'
  | 'json'
  | 'jsonl'
  | 'ndjson'
  | 'xlsx';

export interface DataTarget {
  filePath: string;
  format: DataFileFormat;
  sheetName?: string;
  displayName: string;
}

export function formatFromExtension(ext: string): DataFileFormat | undefined {
  const normalized = ext.toLowerCase();
  switch (normalized) {
    case '.parquet':
      return 'parquet';
    case '.csv':
      return 'csv';
    case '.tsv':
      return 'tsv';
    case '.json':
      return 'json';
    case '.jsonl':
      return 'jsonl';
    case '.ndjson':
      return 'ndjson';
    case '.xlsx':
      return 'xlsx';
    default:
      return undefined;
  }
}

export function getDefaultPageSize(): number {
  return DEFAULT_PAGE_SIZE;
}

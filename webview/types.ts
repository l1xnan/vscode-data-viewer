export interface QueryColumn {
  name: string;
  type: string;
}

export interface QueryResultPayload {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  pageSize: number;
  error?: string;
}

export interface TableQueryPayload {
  page: number;
  pageSize: number;
  sort?: { column: string; direction: 'asc' | 'desc' };
  filters?: Record<string, string>;
}

export type ExtensionMessage =
  | { type: 'init'; payload: QueryResultPayload }
  | { type: 'queryResult'; payload: QueryResultPayload };

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'tableQuery'; payload: TableQueryPayload };

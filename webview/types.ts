export interface QueryColumn {
  name: string;
  type: string;
}

export interface CompletionKeyword {
  name: string;
  category: string;
}

export interface CompletionFunction {
  name: string;
  functionType: string;
  returnType: string;
  parameters: string[];
}

export interface CompletionCatalogData {
  keywords: CompletionKeyword[];
  functions: CompletionFunction[];
}

export interface QueryResultPayload {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  pageSize: number;
  error?: string;
}

export interface InitPayload {
  sql: string;
  catalog: CompletionCatalogData;
  columns: QueryColumn[];
  pageSize: number;
}

export interface QueryPayload {
  sql: string;
  page: number;
  pageSize: number;
  sort?: { column: string; direction: 'asc' | 'desc' };
  filters?: Record<string, string>;
}

export type ExtensionMessage =
  | { type: 'init'; payload: InitPayload }
  | { type: 'queryResult'; payload: QueryResultPayload }
  | { type: 'setSql'; payload: { sql: string } };

export type WebviewMessage = { type: 'ready' } | { type: 'query'; payload: QueryPayload };

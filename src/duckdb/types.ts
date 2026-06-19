export interface QueryColumn {
  name: string;
  type: string;
}

export interface QueryResult {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
}

export interface PageParams {
  page: number;
  pageSize: number;
  sort?: { column: string; direction: 'asc' | 'desc' };
  filters?: Record<string, string>;
}

export interface PagedQueryResult extends QueryResult {
  totalCount: number;
  page: number;
  pageSize: number;
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

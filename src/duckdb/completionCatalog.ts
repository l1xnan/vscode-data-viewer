import { DuckDBConnection } from '@duckdb/node-api';
import { CompletionCatalogCacheStore } from './completionCatalogCache';
import { CompletionCatalogData, CompletionFunction, CompletionKeyword } from './types';

export class CompletionCatalog {
  private keywords: CompletionKeyword[] = [];
  private functions: CompletionFunction[] = [];

  constructor(private readonly cacheStore?: CompletionCatalogCacheStore) {}

  async load(conn: DuckDBConnection): Promise<void> {
    const cached = this.cacheStore?.get();
    if (cached) {
      this.hydrate(cached);
      void this.refreshAndSave(conn);
      return;
    }

    await this.refresh(conn);
    await this.saveCache();
  }

  async refresh(conn: DuckDBConnection): Promise<void> {
    const keywordReader = await conn.runAndReadAll(
      'SELECT keyword_name, keyword_category FROM duckdb_keywords() ORDER BY keyword_name',
    );
    const keywordRows = keywordReader.getRowObjectsJson() as Array<{
      keyword_name: string;
      keyword_category: string;
    }>;

    this.keywords = keywordRows.map((row) => ({
      name: row.keyword_name,
      category: row.keyword_category,
    }));

    const functionReader = await conn.runAndReadAll(`
      SELECT DISTINCT ON (function_name)
        function_name,
        function_type,
        return_type,
        parameters
      FROM duckdb_functions()
      WHERE internal = true
      ORDER BY function_name
    `);
    const functionRows = functionReader.getRowObjectsJson() as Array<{
      function_name: string;
      function_type: string;
      return_type: string;
      parameters: string[] | null;
    }>;

    this.functions = functionRows.map((row) => ({
      name: row.function_name,
      functionType: row.function_type,
      returnType: row.return_type ?? '',
      parameters: Array.isArray(row.parameters) ? row.parameters : [],
    }));

    await this.saveCache();
  }

  getData(): CompletionCatalogData {
    return {
      keywords: this.keywords,
      functions: this.functions,
    };
  }

  private hydrate(data: CompletionCatalogData): void {
    this.keywords = data.keywords;
    this.functions = data.functions;
  }

  private async refreshAndSave(conn: DuckDBConnection): Promise<void> {
    try {
      await this.refresh(conn);
    } catch {
      // Keep cached catalog when background refresh fails.
    }
  }

  private async saveCache(): Promise<void> {
    if (!this.cacheStore) {
      return;
    }
    await this.cacheStore.save(this.getData());
  }
}

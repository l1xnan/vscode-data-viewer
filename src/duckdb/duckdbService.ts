import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { DataFileFormat, DataTarget } from '../constants';
import { toDuckDbPath } from '../utils/paths';
import {
  buildCountQuery,
  buildDescribeQuery,
  buildPagedQuery,
} from './queryBuilder';
import {
  CompletionCatalogData,
  PageParams,
  PagedQueryResult,
  QueryColumn,
  QueryResult,
} from './types';
import { CompletionCatalog } from './completionCatalog';

export class DuckDBService {
  private static instance: DuckDBService | undefined;
  private dbInstance: DuckDBInstance | undefined;
  private connection: DuckDBConnection | undefined;
  private excelLoaded = false;
  private catalog: CompletionCatalog | undefined;

  static getInstance(): DuckDBService {
    if (!DuckDBService.instance) {
      DuckDBService.instance = new DuckDBService();
    }
    return DuckDBService.instance;
  }

  async initialize(): Promise<void> {
    if (this.connection) {
      return;
    }
    this.dbInstance = await DuckDBInstance.create(':memory:');
    this.connection = await this.dbInstance.connect();
    this.catalog = new CompletionCatalog();
    await this.catalog.load(this.connection);
  }

  getConnection(): DuckDBConnection {
    if (!this.connection) {
      throw new Error('DuckDB is not initialized');
    }
    return this.connection;
  }

  getCatalog(): CompletionCatalog {
    if (!this.catalog) {
      throw new Error('Completion catalog is not initialized');
    }
    return this.catalog;
  }

  async ensureExcelExtension(): Promise<void> {
    if (this.excelLoaded) {
      return;
    }
    const conn = this.getConnection();
    await conn.run('INSTALL excel;');
    await conn.run('LOAD excel;');
    this.excelLoaded = true;
    await this.getCatalog().refresh(conn);
  }

  buildSourceSql(target: DataTarget): string {
    const path = toDuckDbPath(target.filePath);
    switch (target.format) {
      case 'csv':
      case 'tsv':
        return `read_csv_auto('${path}')`;
      case 'parquet':
        return `read_parquet('${path}')`;
      case 'json':
      case 'jsonl':
      case 'ndjson':
        return `read_json_auto('${path}')`;
      case 'xlsx': {
        const sheet = target.sheetName ?? 'Sheet1';
        return `read_xlsx('${path}', sheet = '${sheet.replace(/'/g, "''")}')`;
      }
      default:
        throw new Error(`Unsupported format: ${String(target.format)}`);
    }
  }

  getDefaultUserSql(target: DataTarget): string {
    return `SELECT * FROM ${this.buildSourceSql(target)}`;
  }

  async describeTarget(target: DataTarget): Promise<QueryColumn[]> {
    if (target.format === 'xlsx') {
      await this.ensureExcelExtension();
    }
    return this.describeSource(this.buildSourceSql(target));
  }

  async prepareTarget(target: DataTarget): Promise<void> {
    if (target.format === 'xlsx') {
      await this.ensureExcelExtension();
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    const reader = await this.getConnection().runAndReadAll(sql);
    const columnNames = reader.columnNames();
    const columnTypes = reader.columnTypes();
    const rowsJson = reader.getRowObjectsJson() as Record<string, unknown>[];

    const columns: QueryColumn[] = columnNames.map((name, index) => ({
      name,
      type: columnTypes[index]?.toString() ?? 'UNKNOWN',
    }));

    return { columns, rows: rowsJson };
  }

  async executePagedQuery(userSql: string, params: PageParams): Promise<PagedQueryResult> {
    const dataSql = buildPagedQuery(userSql, params);
    const countSql = buildCountQuery(userSql, params.filters);

    const [dataResult, countResult] = await Promise.all([
      this.executeQuery(dataSql),
      this.executeQuery(countSql),
    ]);

    const totalCount = Number(countResult.rows[0]?.cnt ?? 0);

    return {
      ...dataResult,
      totalCount,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async countRows(userSql: string, filters?: Record<string, string>): Promise<number> {
    const result = await this.executeQuery(buildCountQuery(userSql, filters));
    return Number(result.rows[0]?.cnt ?? 0);
  }

  async describeSource(sourceSql: string): Promise<QueryColumn[]> {
    const result = await this.executeQuery(buildDescribeQuery(sourceSql));
    return result.rows.map((row) => ({
      name: String(row.column_name ?? row.name ?? ''),
      type: String(row.column_type ?? row.type ?? 'UNKNOWN'),
    }));
  }

  getCatalogData(): CompletionCatalogData {
    return this.getCatalog().getData();
  }
}

export function formatLabel(format: DataFileFormat): string {
  return format.toUpperCase();
}

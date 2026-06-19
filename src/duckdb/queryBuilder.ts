import { PageParams } from './types';
import { quoteIdentifier } from '../utils/paths';

function buildWhereClause(filters?: Record<string, string>): string {
  if (!filters || Object.keys(filters).length === 0) {
    return '';
  }

  const conditions = Object.entries(filters)
    .filter(([, value]) => value.trim().length > 0)
    .map(
      ([column, value]) =>
        `CAST(${quoteIdentifier(column)} AS VARCHAR) ILIKE '%${value.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_')}%' ESCAPE '\\'`,
    );

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

function buildOrderClause(sort?: PageParams['sort']): string {
  if (!sort) {
    return '';
  }
  const direction = sort.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return `ORDER BY ${quoteIdentifier(sort.column)} ${direction}`;
}

export function buildWrappedSubquery(userSql: string): string {
  const trimmed = userSql.trim().replace(/;\s*$/, '');
  return `SELECT * FROM (${trimmed}) AS _q`;
}

export function buildPagedQuery(userSql: string, params: PageParams): string {
  const offset = (params.page - 1) * params.pageSize;
  const where = buildWhereClause(params.filters);
  const order = buildOrderClause(params.sort);
  const base = buildWrappedSubquery(userSql);
  return `${base} ${where} ${order} LIMIT ${params.pageSize} OFFSET ${offset}`.replace(/\s+/g, ' ').trim();
}

export function buildCountQuery(userSql: string, filters?: Record<string, string>): string {
  const where = buildWhereClause(filters);
  const base = buildWrappedSubquery(userSql);
  return `SELECT COUNT(*) AS cnt FROM (${base} ${where}) AS _count_sub`.replace(/\s+/g, ' ').trim();
}

export function buildDescribeQuery(sourceSql: string): string {
  return `DESCRIBE SELECT * FROM (${sourceSql}) AS _desc`;
}

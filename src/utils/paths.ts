export function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export function toDuckDbPath(filePath: string): string {
  return escapeSqlString(filePath.replace(/\\/g, '/'));
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

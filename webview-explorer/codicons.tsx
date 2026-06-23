export function Codicon({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={['codicon', `codicon-${name}`, className].filter(Boolean).join(' ')}
      aria-hidden
    />
  );
}

export function getDataFileIcon(extension?: string): string {
  switch ((extension ?? '').toLowerCase()) {
    case '.parquet':
      return 'database';
    case '.csv':
    case '.tsv':
      return 'table';
    case '.json':
    case '.jsonl':
    case '.ndjson':
      return 'json';
    case '.xlsx':
      return 'table';
    default:
      return 'file';
  }
}

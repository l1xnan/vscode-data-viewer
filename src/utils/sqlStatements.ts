export interface SqlStatementSpan {
  text: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
}

export function splitSqlStatements(source: string): SqlStatementSpan[] {
  const statements: SqlStatementSpan[] = [];
  let start = 0;
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  const pushStatement = (end: number): void => {
    const raw = source.slice(start, end);
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    const leadingWhitespace = raw.length - raw.trimStart().length;
    const startOffset = start + leadingWhitespace;
    const endOffset = startOffset + trimmed.length;
    const startLine = source.slice(0, startOffset).split('\n').length - 1;
    statements.push({
      text: trimmed.replace(/;\s*$/, ''),
      startOffset,
      endOffset,
      startLine,
    });
  };

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      index += 1;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && next === '-') {
        inLineComment = true;
        index += 2;
        continue;
      }
      if (char === '/' && next === '*') {
        inBlockComment = true;
        index += 2;
        continue;
      }
    }

    if (!inDoubleQuote && char === "'") {
      if (inSingleQuote && next === "'") {
        index += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      index += 1;
      continue;
    }

    if (!inSingleQuote && char === '"') {
      if (inDoubleQuote && next === '"') {
        index += 2;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
      index += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === ';') {
      pushStatement(index);
      start = index + 1;
      index += 1;
      continue;
    }

    index += 1;
  }

  if (start < source.length) {
    pushStatement(source.length);
  }

  return statements;
}

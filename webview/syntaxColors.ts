export interface SqlSyntaxPalette {
  keyword: string;
  type: string;
  string: string;
  number: string;
  comment: string;
  function: string;
}

const darkPalette: SqlSyntaxPalette = {
  keyword: '#569cd6',
  type: '#4ec9b0',
  string: '#ce9178',
  number: '#b5cea8',
  comment: '#6a9955',
  function: '#dcdcaa',
};

const lightPalette: SqlSyntaxPalette = {
  keyword: '#0000ff',
  type: '#267f99',
  string: '#a31515',
  number: '#098658',
  comment: '#008000',
  function: '#795e26',
};

function isLightThemeKind(kind: string | null): boolean {
  return kind === 'vscode-light' || kind === 'vscode-high-contrast-light';
}

export function getSqlSyntaxPalette(): SqlSyntaxPalette {
  const kind = document.body.getAttribute('data-vscode-theme-kind');
  return isLightThemeKind(kind) ? lightPalette : darkPalette;
}

export function readEditorForeground(fallback = '#d4d4d4'): string {
  const value = getComputedStyle(document.body).getPropertyValue('--vscode-editor-foreground').trim();
  return value || fallback;
}

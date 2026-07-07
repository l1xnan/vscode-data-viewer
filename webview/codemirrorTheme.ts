import {
  defaultHighlightStyle,
  HighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { classHighlighter, tags as t } from '@lezer/highlight';
import { getSqlSyntaxPalette, readEditorForeground } from './syntaxColors';

function readVsCodeColor(variable: string, fallback: string): string {
  const value = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return value || fallback;
}

const editorFontFamily =
  'var(--vscode-editor-font-family, var(--vscode-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace))';

const editorTypography = {
  fontFamily: editorFontFamily,
  fontSize: 'var(--vscode-editor-font-size, 13px)',
  fontWeight: 'var(--vscode-editor-font-weight, normal)',
  lineHeight: 'var(--vscode-editor-lineHeight, 1.5)',
};

function buildVsCodeSqlHighlightStyle(): HighlightStyle {
  const palette = getSqlSyntaxPalette();
  const foreground = readEditorForeground();

  return HighlightStyle.define([
    { tag: t.keyword, color: palette.keyword },
    { tag: t.typeName, color: palette.type },
    { tag: t.string, color: palette.string },
    { tag: t.special(t.string), color: palette.string },
    { tag: t.number, color: palette.number },
    { tag: t.bool, color: palette.number },
    { tag: t.null, color: palette.number },
    { tag: t.comment, color: palette.comment, fontStyle: 'italic' },
    { tag: t.lineComment, color: palette.comment, fontStyle: 'italic' },
    { tag: t.blockComment, color: palette.comment, fontStyle: 'italic' },
    { tag: t.function(t.variableName), color: palette.function },
    { tag: t.operator, color: foreground },
    { tag: t.punctuation, color: foreground },
    { tag: t.name, color: foreground },
    { tag: t.special(t.name), color: foreground },
  ]);
}

export const sqlSyntaxHighlightingBase: Extension[] = [
  syntaxHighlighting(classHighlighter),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
];

export function buildVsCodeSqlHighlighting(): Extension {
  return syntaxHighlighting(buildVsCodeSqlHighlightStyle());
}

export function buildSqlEditorViewTheme(): Extension {
  return EditorView.theme({
    '&': {
      height: '100%',
      backgroundColor: readVsCodeColor('--vscode-editor-background', '#1e1e1e'),
    },
    '.cm-scroller': editorTypography,
    '.cm-content, .cm-line': {
      fontFamily: 'inherit',
      fontSize: 'inherit',
      fontWeight: 'inherit',
      lineHeight: 'inherit',
      color: readEditorForeground(),
    },
    '.cm-content': {
      caretColor: readVsCodeColor('--vscode-editorCursor-foreground', '#aeafad'),
      padding: '8px 0',
    },
    '.cm-gutters': {
      fontFamily: 'inherit',
      fontSize: 'inherit',
      backgroundColor: readVsCodeColor('--vscode-editorGutter-background', '#1e1e1e'),
      color: readVsCodeColor('--vscode-editorLineNumber-foreground', '#858585'),
      borderRight: `1px solid ${readVsCodeColor('--vscode-panel-border', '#2b2b2b')}`,
    },
    '.cm-activeLineGutter': {
      backgroundColor: readVsCodeColor('--vscode-editor-lineHighlightBackground', '#2a2d2e'),
    },
    '.cm-activeLine': {
      backgroundColor: readVsCodeColor('--vscode-editor-lineHighlightBackground', '#2a2d2e'),
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: `${readVsCodeColor('--vscode-editor-selectionBackground', '#264f78')} !important`,
    },
    '.cm-cursor': {
      borderLeftColor: readVsCodeColor('--vscode-editorCursor-foreground', '#aeafad'),
    },
    '.cm-tooltip': {
      ...editorTypography,
      backgroundColor: readVsCodeColor('--vscode-editorHoverWidget-background', '#252526'),
      color: readVsCodeColor('--vscode-editorHoverWidget-foreground', '#cccccc'),
      border: `1px solid ${readVsCodeColor('--vscode-editorHoverWidget-border', '#454545')}`,
    },
    '.cm-tooltip-autocomplete': editorTypography,
    '.cm-tooltip-autocomplete > ul': editorTypography,
    '.cm-tooltip-autocomplete > ul > li': {
      ...editorTypography,
      fontFamily: editorFontFamily,
    },
    '.cm-completionLabel': {
      fontFamily: 'inherit',
      fontSize: 'inherit',
      fontWeight: 'inherit',
      lineHeight: 'inherit',
    },
    '.cm-completionDetail': {
      fontFamily: 'inherit',
      fontSize: 'inherit',
      fontWeight: 'inherit',
      lineHeight: 'inherit',
      opacity: 0.7,
    },
    '.cm-completionIcon': {
      fontFamily: 'inherit',
      fontSize: 'inherit',
      lineHeight: 'inherit',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: readVsCodeColor('--vscode-list-activeSelectionBackground', '#04395e'),
      color: readVsCodeColor('--vscode-list-activeSelectionForeground', '#ffffff'),
    },
    '.cm-tooltip-autocomplete > ul > li:hover': {
      backgroundColor: readVsCodeColor('--vscode-list-hoverBackground', '#2a2d2e'),
    },
  });
}

export function subscribeToVsCodeThemeChanges(onChange: () => void): () => void {
  let frame = 0;

  const scheduleChange = () => {
    if (frame) {
      cancelAnimationFrame(frame);
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'themeChanged') {
      scheduleChange();
    }
  };

  const observer = new MutationObserver(scheduleChange);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-vscode-theme-kind', 'class', 'style'],
  });

  window.addEventListener('message', handleMessage);

  return () => {
    if (frame) {
      cancelAnimationFrame(frame);
    }
    observer.disconnect();
    window.removeEventListener('message', handleMessage);
  };
}

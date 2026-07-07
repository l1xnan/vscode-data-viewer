import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

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

function buildSqlHighlightStyle(): HighlightStyle {
  return HighlightStyle.define([
    {
      tag: t.keyword,
      color: readVsCodeColor('--vscode-symbolIcon-keywordForeground', '#569cd6'),
    },
    {
      tag: t.string,
      color: readVsCodeColor('--vscode-debugTokenExpression-string', '#ce9178'),
    },
    {
      tag: t.number,
      color: readVsCodeColor('--vscode-debugTokenExpression-number', '#b5cea8'),
    },
    {
      tag: t.bool,
      color: readVsCodeColor('--vscode-debugTokenExpression-boolean', '#569cd6'),
    },
    {
      tag: t.null,
      color: readVsCodeColor('--vscode-debugTokenExpression-boolean', '#569cd6'),
    },
    {
      tag: t.comment,
      color: readVsCodeColor('--vscode-textPreformat-foreground', '#6a9955'),
      fontStyle: 'italic',
    },
    {
      tag: t.operator,
      color: readVsCodeColor('--vscode-editor-foreground', '#d4d4d4'),
    },
    {
      tag: t.punctuation,
      color: readVsCodeColor('--vscode-editor-foreground', '#d4d4d4'),
    },
    {
      tag: t.function(t.variableName),
      color: readVsCodeColor('--vscode-symbolIcon-functionForeground', '#dcdcaa'),
    },
    {
      tag: t.typeName,
      color: readVsCodeColor('--vscode-symbolIcon-classForeground', '#4ec9b0'),
    },
    {
      tag: t.special(t.string),
      color: readVsCodeColor('--vscode-debugTokenExpression-string', '#ce9178'),
    },
    {
      tag: t.name,
      color: readVsCodeColor('--vscode-editor-foreground', '#d4d4d4'),
    },
  ]);
}

export function buildSqlEditorTheme(): Extension[] {
  return [
    syntaxHighlighting(buildSqlHighlightStyle()),
    EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: readVsCodeColor('--vscode-editor-background', '#1e1e1e'),
        color: readVsCodeColor('--vscode-editor-foreground', '#d4d4d4'),
      },
      '.cm-scroller': editorTypography,
      '.cm-content, .cm-line': {
        fontFamily: 'inherit',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        lineHeight: 'inherit',
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
    }),
  ];
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

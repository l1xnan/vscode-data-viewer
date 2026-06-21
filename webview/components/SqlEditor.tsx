import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { sql } from '@codemirror/lang-sql';
import {
  autocompletion,
  Completion,
  CompletionContext,
  CompletionSource,
} from '@codemirror/autocomplete';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { CompletionCatalogData, QueryColumn } from '../types';

interface SqlEditorProps {
  value: string;
  catalog: CompletionCatalogData;
  columns: QueryColumn[];
  onChange: (value: string) => void;
  onRun: (sql: string) => void;
}

function buildCompletionSource(
  catalog: CompletionCatalogData,
  columns: QueryColumn[],
): CompletionSource {
  return (context: CompletionContext) => {
    const word = context.matchBefore(/[\w"]*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const prefix = word.text.replace(/"/g, '').toLowerCase();
    const options: Completion[] = [];

    for (const keyword of catalog.keywords) {
      if (!prefix || keyword.name.toLowerCase().startsWith(prefix)) {
        options.push({
          label: keyword.name,
          type: 'keyword',
          detail: keyword.category,
        });
      }
    }

    for (const fn of catalog.functions) {
      if (!prefix || fn.name.toLowerCase().startsWith(prefix)) {
        const params = fn.parameters.length > 0 ? `(${fn.parameters.join(', ')})` : '()';
        options.push({
          label: fn.name,
          type: 'function',
          detail: `${fn.functionType} → ${fn.returnType}`,
          apply: `${fn.name}${params}`,
        });
      }
    }

    for (const column of columns) {
      if (!prefix || column.name.toLowerCase().startsWith(prefix)) {
        options.push({
          label: column.name,
          type: 'variable',
          detail: column.type,
        });
      }
    }

    if (options.length === 0) {
      return null;
    }

    return { from: word.from, options: options.slice(0, 100) };
  };
}

const sqlHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--vscode-symbolIcon-keywordForeground, #569cd6)' },
  { tag: t.string, color: 'var(--vscode-debugTokenExpression-string, #ce9178)' },
  { tag: t.number, color: 'var(--vscode-debugTokenExpression-number, #b5cea8)' },
  { tag: t.bool, color: 'var(--vscode-debugTokenExpression-boolean, #569cd6)' },
  { tag: t.null, color: 'var(--vscode-debugTokenExpression-boolean, #569cd6)' },
  { tag: t.comment, color: 'var(--vscode-textPreformat-foreground, #6a9955)', fontStyle: 'italic' },
  { tag: t.operator, color: 'var(--vscode-editor-foreground)' },
  { tag: t.punctuation, color: 'var(--vscode-editor-foreground)' },
  { tag: t.function(t.variableName), color: 'var(--vscode-symbolIcon-functionForeground, #dcdcaa)' },
  { tag: t.typeName, color: 'var(--vscode-symbolIcon-classForeground, #4ec9b0)' },
  { tag: t.special(t.string), color: 'var(--vscode-debugTokenExpression-string, #ce9178)' },
  { tag: t.name, color: 'var(--vscode-editor-foreground)' },
]);

const vscodeTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-editor-foreground)',
  },
  '.cm-scroller': {
    fontFamily:
      'var(--vscode-editor-font-family, var(--vscode-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace))',
    fontSize: 'var(--vscode-editor-font-size, 13px)',
    fontWeight: 'var(--vscode-editor-font-weight, normal)',
    lineHeight: 'var(--vscode-editor-lineHeight, 1.5)',
  },
  '.cm-content, .cm-line': {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
  },
  '.cm-content': {
    caretColor: 'var(--vscode-editorCursor-foreground)',
    padding: '8px 0',
  },
  '.cm-gutters': {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    backgroundColor: 'var(--vscode-editorGutter-background)',
    color: 'var(--vscode-editorLineNumber-foreground)',
    borderRight: '1px solid var(--vscode-panel-border)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--vscode-editor-lineHighlightBackground)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--vscode-editor-lineHighlightBackground)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--vscode-editor-selectionBackground) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--vscode-editorCursor-foreground)',
  },
});

export function SqlEditor({ value, catalog, columns, onChange, onRun }: SqlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  const completionCompartment = useRef(new Compartment());

  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const runKeymap = keymap.of([
      {
        key: 'Ctrl-Enter',
        mac: 'Cmd-Enter',
        run: (view) => {
          onRunRef.current(view.state.doc.toString());
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        sql(),
        syntaxHighlighting(sqlHighlightStyle),
        vscodeTheme,
        placeholder('SELECT * FROM ...'),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        runKeymap,
        completionCompartment.current.of(
          autocompletion({
            override: [buildCompletionSource(catalog, columns)],
            activateOnTyping: true,
          }),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: completionCompartment.current.reconfigure(
        autocompletion({
          override: [buildCompletionSource(catalog, columns)],
          activateOnTyping: true,
        }),
      ),
    });
  }, [catalog, columns]);

  return <div className="sql-editor" ref={containerRef} />;
}

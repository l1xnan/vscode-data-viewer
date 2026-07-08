import { json } from '@codemirror/lang-json';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildSqlEditorViewTheme,
  buildVsCodeJsonHighlighting,
  jsonSyntaxHighlightingBase,
  subscribeToVsCodeThemeChanges,
} from '../codemirrorTheme';

interface RowDetailModalProps {
  row: Record<string, unknown>;
  rowIndex: number;
  page: number;
  pageSize: number;
  totalCount: number;
  pageRowCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

function stringifyRowData(row: Record<string, unknown>, pretty: boolean): string {
  try {
    return JSON.stringify(
      row,
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      pretty ? 2 : undefined,
    );
  } catch {
    return '{}';
  }
}

export function RowDetailModal({
  row,
  rowIndex,
  page,
  pageSize,
  totalCount,
  pageRowCount,
  onPrevious,
  onNext,
  onClose,
}: RowDetailModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const highlightCompartment = useRef(new Compartment());
  const [isPretty, setIsPretty] = useState(true);

  const updateDocument = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === text) {
      return;
    }
    view.dispatch({
      changes: { from: 0, to: current.length, insert: text },
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: stringifyRowData(row, true),
      extensions: [
        lineNumbers(),
        json(),
        ...jsonSyntaxHighlightingBase,
        highlightCompartment.current.of(buildVsCodeJsonHighlighting()),
        themeCompartment.current.of(buildSqlEditorViewTheme()),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    const applyTheme = () => {
      view.dispatch({
        effects: [
          themeCompartment.current.reconfigure(buildSqlEditorViewTheme()),
          highlightCompartment.current.reconfigure(buildVsCodeJsonHighlighting()),
        ],
      });
    };

    const unsubscribeTheme = subscribeToVsCodeThemeChanges(applyTheme);

    return () => {
      unsubscribeTheme();
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per row
  }, [row]);

  useEffect(() => {
    updateDocument(stringifyRowData(row, isPretty));
  }, [row, isPretty, updateDocument]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft' && rowIndex > 0) {
        event.preventDefault();
        onPrevious();
      }
      if (event.key === 'ArrowRight' && rowIndex < pageRowCount - 1) {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious, pageRowCount, rowIndex]);

  const globalRowNumber = (page - 1) * pageSize + rowIndex + 1;
  const canGoPrevious = rowIndex > 0;
  const canGoNext = rowIndex < pageRowCount - 1;

  const handleFormat = () => {
    setIsPretty(true);
  };

  const handleMinify = () => {
    setIsPretty(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="row-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Row details"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row-detail-modal-header">
          <div className="row-detail-modal-nav">
            <button
              type="button"
              className="row-detail-nav-button"
              onClick={onPrevious}
              disabled={!canGoPrevious}
              aria-label="Previous row"
              title="Previous row (←)"
            >
              ←
            </button>
            <span className="row-detail-modal-title">
              Row {globalRowNumber} / {totalCount}
            </span>
            <button
              type="button"
              className="row-detail-nav-button"
              onClick={onNext}
              disabled={!canGoNext}
              aria-label="Next row"
              title="Next row (→)"
            >
              →
            </button>
          </div>
          <div className="row-detail-modal-actions">
            <button type="button" className={isPretty ? 'active' : undefined} onClick={handleFormat}>
              Format
            </button>
            <button type="button" className={!isPretty ? 'active' : undefined} onClick={handleMinify}>
              Minify
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="row-detail-modal-body" ref={containerRef} />
      </div>
    </div>
  );
}

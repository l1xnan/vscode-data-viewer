import type { EditorState } from '@codemirror/state';

export function getRunnableSql(state: EditorState): string {
  const { from, to, empty } = state.selection.main;
  if (!empty) {
    const selected = state.sliceDoc(from, to).trim();
    if (selected) {
      return selected;
    }
  }
  return state.doc.toString();
}

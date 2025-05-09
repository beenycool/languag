// src/renderer/state/editor/types.ts

import * as monaco from 'monaco-editor';

// Replicates parts of the local EditorState from '../../editor/editor-state.ts'
// but tailored for Redux (e.g., serializable selection if needed, or just relevant parts)
export interface EditorReduxState {
  filePath: string | null;
  currentContent: string;
  language: string;
  isDirty: boolean;
  // Monaco's Selection is not directly serializable if you were to persist the whole state.
  // For Redux, you might store a simplified version or just parts of it.
  // For now, let's keep it, assuming it's for in-memory state.
  selection: monaco.Selection | null; 
  // Consider adding other editor-related states like:
  // - cursorPosition (if selection is too complex or for quick access)
  // - activeDecorations (IDs or simplified versions of active suggestions)
  // - editorFocus (boolean)
  // - viewState (Monaco's ICodeEditorViewState - can be large, use with caution)
}

// Action Types
export const SET_FILE_PATH = 'editor/SET_FILE_PATH';
export const SET_CONTENT = 'editor/SET_CONTENT';
export const SET_LANGUAGE = 'editor/SET_LANGUAGE';
export const SET_SELECTION = 'editor/SET_SELECTION';
export const SET_DIRTY_STATUS = 'editor/SET_DIRTY_STATUS';
// Add more action types as needed, e.g., APPLY_SUGGESTION, JUMP_TO_DEFINITION

interface SetFilePathAction {
  type: typeof SET_FILE_PATH;
  payload: string | null;
}

interface SetContentAction {
  type: typeof SET_CONTENT;
  payload: {
    content: string;
    isDirty?: boolean; // Optionally set dirty status when content changes
  };
}

interface SetLanguageAction {
  type: typeof SET_LANGUAGE;
  payload: string;
}

interface SetSelectionAction {
  type: typeof SET_SELECTION;
  payload: monaco.Selection | null;
}

interface SetDirtyStatusAction {
  type: typeof SET_DIRTY_STATUS;
  payload: boolean;
}

export type EditorActionTypes =
  | SetFilePathAction
  | SetContentAction
  | SetLanguageAction
  | SetSelectionAction
  | SetDirtyStatusAction;
  // Add other action types to the union
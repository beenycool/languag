// src/renderer/editor/editor-state.ts

import * as monaco from 'monaco-editor';

/**
 * Represents the state of the editor.
 */
export interface EditorState {
  filePath: string | null;
  currentContent: string;
  language: string;
  isDirty: boolean; // True if content has changed since last save
  selection: monaco.Selection | null;
  // Add other relevant editor states, e.g., cursor position, view state
}

/**
 * Initial state for the editor.
 */
export const initialEditorState: EditorState = {
  filePath: null,
  currentContent: '',
  language: 'plaintext',
  isDirty: false,
  selection: null,
};

/**
 * Manages the state of the Monaco editor.
 * This class can be expanded to use a more formal state management library (e.g., Redux, Zustand)
 * if the state becomes more complex.
 */
export class EditorStateManager {
  private state: EditorState;
  private listeners: Array<(newState: EditorState) => void> = [];

  constructor(initialState: EditorState = initialEditorState) {
    this.state = { ...initialState };
  }

  /**
   * Gets the current editor state.
   * @returns The current state.
   */
  public getState(): EditorState {
    return { ...this.state };
  }

  /**
   * Updates a part of the editor state.
   * @param partialState - The part of the state to update.
   */
  public updateState(partialState: Partial<EditorState>): void {
    this.state = { ...this.state, ...partialState };
    this.notifyListeners();
  }

  /**
   * Resets the state to its initial values or a new provided state.
   * @param newState - Optional new state to reset to.
   */
  public resetState(newState?: EditorState): void {
    this.state = newState ? { ...newState } : { ...initialEditorState };
    this.notifyListeners();
  }

  /**
   * Subscribes a listener function to state changes.
   * @param listener - The function to call when state changes.
   * @returns An unsubscribe function.
   */
  public subscribe(listener: (newState: EditorState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifies all subscribed listeners about a state change.
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  // Example utility functions based on state
  public setFilePath(filePath: string | null): void {
    this.updateState({ filePath, isDirty: false }); // Reset dirty flag when path changes
  }

  public setContent(content: string, fromEditor: boolean = true): void {
    this.updateState({ currentContent: content, isDirty: fromEditor });
  }

  public setLanguage(language: string): void {
    this.updateState({ language });
  }

  public setSelection(selection: monaco.Selection | null): void {
    this.updateState({ selection });
  }

  public markAsDirty(dirty: boolean = true): void {
    this.updateState({ isDirty: dirty });
  }
}

// Global instance or to be instantiated where needed
export const editorStateManager = new EditorStateManager();
// src/renderer/editor/editor-decorations.ts

import * as monaco from 'monaco-editor';
import { MonacoEditorWrapper } from './monaco-wrapper';

export interface SuggestionDecoration {
  id: string; // Unique ID for the suggestion
  range: monaco.IRange;
  glyphMarginClassName?: string; // CSS class for gutter icon
  inlineClassName?: string; // CSS class for inline styling (e.g., underline)
  hoverMessage?: string | monaco.IMarkdownString | Array<monaco.IMarkdownString>; // Message on hover
  // Add other monaco.editor.IModelDeltaDecoration options as needed
}

/**
 * Manages decorations (e.g., highlights, squiggles) in the Monaco Editor,
 * typically used for displaying analysis suggestions.
 */
export class EditorDecorationManager {
  private editorWrapper: MonacoEditorWrapper;
  private currentDecorationIds: string[] = []; // Stores the IDs of current decorations

  constructor(editorWrapper: MonacoEditorWrapper) {
    this.editorWrapper = editorWrapper;
  }

  /**
   * Applies a set of decorations to the editor.
   * This will replace all existing decorations managed by this instance.
   * @param decorations - An array of SuggestionDecoration objects.
   */
  public applyDecorations(decorations: SuggestionDecoration[]): void {
    const editor = this.editorWrapper.getEditor();
    if (!editor) {
      console.error('EditorDecorationManager: Editor not initialized. Cannot apply decorations.');
      return;
    }

    const modelDecorations: monaco.editor.IModelDeltaDecoration[] = decorations.map(dec => {
      let hoverMessageValue: monaco.IMarkdownString | monaco.IMarkdownString[] | undefined = undefined;
      if (typeof dec.hoverMessage === 'string') {
        hoverMessageValue = { value: dec.hoverMessage };
      } else if (dec.hoverMessage) { // Handles IMarkdownString or IMarkdownString[]
        hoverMessageValue = dec.hoverMessage;
      }

      return {
        range: new monaco.Range(dec.range.startLineNumber, dec.range.startColumn, dec.range.endLineNumber, dec.range.endColumn),
        options: {
          isWholeLine: false, // Or true, depending on desired behavior
          glyphMarginClassName: dec.glyphMarginClassName,
          inlineClassName: dec.inlineClassName,
          hoverMessage: hoverMessageValue,
          // stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      };
    });

    // The 'ownerId' parameter to deltaDecorations can be used to group decorations.
    // Using a consistent ownerId allows easy removal or update of a specific group.
    // For simplicity, we're using a generic ownerId here.
    // A more robust solution might involve different ownerIds for different types of decorations.
    this.currentDecorationIds = editor.deltaDecorations(
      this.currentDecorationIds, // Old decorations to remove
      modelDecorations        // New decorations to add
    );
    console.log(`EditorDecorationManager: Applied ${decorations.length} decorations.`);
  }

  /**
   * Clears all decorations previously applied by this manager.
   */
  public clearDecorations(): void {
    const editor = this.editorWrapper.getEditor();
    if (!editor) {
      console.warn('EditorDecorationManager: Editor not initialized. Cannot clear decorations.');
      return;
    }
    if (this.currentDecorationIds.length > 0) {
      this.currentDecorationIds = editor.deltaDecorations(this.currentDecorationIds, []);
      console.log('EditorDecorationManager: Cleared all decorations.');
    }
  }

  /**
   * Disposes of the decoration manager.
   * Should be called when the editor is disposed.
   */
  public dispose(): void {
    this.clearDecorations();
    // Any other cleanup
  }
}

// Example CSS for decorations (to be added to your stylesheet):
//
// .suggestion-glyph {
//   background: orange; /* Example: small dot in the gutter */
//   width: 5px !important;
//   margin-left: 5px !important;
// }
//
// .suggestion-underline-info {
//   text-decoration: underline wavy blue;
// }
//
// .suggestion-underline-warning {
//   text-decoration: underline wavy orange;
// }
//
// .suggestion-underline-error {
//   text-decoration: underline wavy red;
// }

// Example Usage:
//
// import MonacoEditorWrapper from './monaco-wrapper';
//
// const editorElement = document.getElementById('editor-container');
// if (editorElement) {
//   const wrapper = new MonacoEditorWrapper();
//   const editor = wrapper.createEditor(editorElement, "Hello world\nThis is a test line.");
//
//   const decorationManager = new EditorDecorationManager(wrapper);
//
//   const exampleDecorations: SuggestionDecoration[] = [
//     {
//       id: 'suggestion1',
//       range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 6 }, // "Hello"
//       inlineClassName: 'suggestion-underline-info',
//       hoverMessage: 'This is an informational suggestion.'
//     },
//     {
//       id: 'suggestion2',
//       range: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 5 }, // "This"
//       glyphMarginClassName: 'suggestion-glyph',
//       inlineClassName: 'suggestion-underline-warning',
//       hoverMessage: { value: '**Warning:** Check this word.' }
//     }
//   ];
//
//   decorationManager.applyDecorations(exampleDecorations);
//
//   // To clear:
//   // decorationManager.clearDecorations();
// }
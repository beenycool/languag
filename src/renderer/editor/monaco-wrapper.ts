// src/renderer/editor/monaco-wrapper.ts

import * as monaco from 'monaco-editor';

/**
 * Initializes and wraps the Monaco Editor instance.
 */
export class MonacoEditorWrapper {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;

  /**
   * Creates and initializes the Monaco Editor.
   * @param containerElement - The HTML element to host the editor.
   * @param initialValue - The initial content of the editor.
   * @param language - The initial language of the editor.
   * @returns The created editor instance.
   */
  public createEditor(
    containerElement: HTMLElement,
    initialValue: string = '',
    language: string = 'plaintext'
  ): monaco.editor.IStandaloneCodeEditor {
    if (this.editor) {
      this.editor.dispose();
    }

    this.editor = monaco.editor.create(containerElement, {
      value: initialValue,
      language: language,
      theme: 'vs-dark', // Or any other theme
      automaticLayout: true,
      // Add other Monaco options as needed
    });

    return this.editor;
  }

  /**
   * Gets the current Monaco Editor instance.
   * @returns The editor instance or null if not initialized.
   */
  public getEditor(): monaco.editor.IStandaloneCodeEditor | null {
    return this.editor;
  }

  /**
   * Sets the content of the editor.
   * @param value - The new content.
   */
  public setValue(value: string): void {
    this.editor?.setValue(value);
  }

  /**
   * Gets the current content of the editor.
   * @returns The editor content or an empty string.
   */
  public getValue(): string {
    return this.editor?.getValue() || '';
  }

  /**
   * Sets the language of the editor.
   * @param language - The new language.
   */
  public setLanguage(language: string): void {
    if (this.editor && this.editor.getModel()) {
      monaco.editor.setModelLanguage(this.editor.getModel()!, language);
    }
  }

  /**
   * Disposes the editor instance.
   */
  public dispose(): void {
    this.editor?.dispose();
    this.editor = null;
  }

  // Add more wrapper methods as needed for Monaco features
  // e.g., for decorations, commands, model changes, etc.
}

export default MonacoEditorWrapper;
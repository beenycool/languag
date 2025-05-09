// src/renderer/components/app/EditorContainer.tsx

import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor'; // Added import for monaco
import MonacoEditorWrapper from '../../editor/monaco-wrapper';
import { editorStateManager, EditorState } from '../../editor/editor-state';
// import { EditorCommandRegistry } from '../../editor/editor-commands'; // If needed for direct command registration here
// import { EditorDecorationManager } from '../../editor/editor-decorations'; // If needed for direct decoration management here

interface EditorContainerProps {
  initialContent?: string;
  initialLanguage?: string;
  onContentChange?: (content: string) => void;
  onSave?: (content: string) => void;
  // Add other props as needed, e.g., filePath
}

const EditorContainer = (props: EditorContainerProps): React.ReactElement => {
  const {
    initialContent = '',
    initialLanguage = 'plaintext',
    onContentChange,
    onSave,
  } = props;
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoWrapperRef = useRef<MonacoEditorWrapper | null>(null);
  // const commandRegistryRef = useRef<EditorCommandRegistry | null>(null); // If used
  // const decorationManagerRef = useRef<EditorDecorationManager | null>(null); // If used
  const [isEditorReady, setIsEditorReady] = useState(false);

  useEffect(() => {
    if (editorRef.current && !monacoWrapperRef.current) {
      const wrapper = new MonacoEditorWrapper();
      monacoWrapperRef.current = wrapper;

      const editorInstance = wrapper.createEditor(
        editorRef.current,
        initialContent,
        initialLanguage
      );

      editorStateManager.setContent(initialContent, false); // Initialize state without marking dirty
      editorStateManager.setLanguage(initialLanguage);

      // commandRegistryRef.current = new EditorCommandRegistry(wrapper); // Initialize if used
      // decorationManagerRef.current = new EditorDecorationManager(wrapper); // Initialize if used

      // Listen to content changes from Monaco
      const changeListener = editorInstance.onDidChangeModelContent(() => {
        const currentContent = editorInstance.getValue();
        editorStateManager.setContent(currentContent, true); // Mark as dirty
        if (onContentChange) {
          onContentChange(currentContent);
        }
      });

      // Listen to selection changes
      const selectionListener = editorInstance.onDidChangeCursorSelection(e => {
        editorStateManager.setSelection(e.selection);
      });


      // Example: Register a save command (Ctrl/Cmd + S)
      // This could also be managed globally or via a dedicated command service
      editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const contentToSave = editorInstance.getValue();
        if (onSave) {
          onSave(contentToSave);
        }
        editorStateManager.markAsDirty(false); // Mark as not dirty after save
        console.log('Content saved (simulated):', contentToSave);
      });

      setIsEditorReady(true);

      return () => {
        changeListener.dispose();
        selectionListener.dispose();
        // commandRegistryRef.current?.dispose(); // Dispose if used
        // decorationManagerRef.current?.dispose(); // Dispose if used
        wrapper.dispose();
        monacoWrapperRef.current = null;
        setIsEditorReady(false);
      };
    }
  }, [initialContent, initialLanguage, onContentChange, onSave]);

  // Listen to external state changes (e.g., from Redux or other state managers)
  useEffect(() => {
    const unsubscribe = editorStateManager.subscribe((newState: EditorState) => {
      const editor = monacoWrapperRef.current?.getEditor();
      if (editor && editor.getValue() !== newState.currentContent) {
        // Prevent feedback loop if change originated from editor itself
        // This check might need refinement based on how state is updated
        if (!newState.isDirty) { // Or some other flag indicating external change
            editor.setValue(newState.currentContent);
        }
      }
      if (editor && editor.getModel()?.getLanguageId() !== newState.language) {
        monacoWrapperRef.current?.setLanguage(newState.language);
      }
    });
    return unsubscribe;
  }, []);


  return (
    <div
      ref={editorRef}
      style={{ width: '100%', height: '100%', border: '1px solid #ccc' }}
      data-testid="editor-container"
    >
      {!isEditorReady && <div>Loading Editor...</div>}
    </div>
  );
};

export default EditorContainer;
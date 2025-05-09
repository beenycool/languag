// src/renderer/components/app/StatusBar.tsx

import React, { useEffect, useState } from 'react';
import { editorStateManager, EditorState } from '../../editor/editor-state';
// import { analysisStateManager, AnalysisState } from '../../state/analysis/reducer'; // Assuming analysis state manager

interface StatusBarProps {
  // Props to control what's displayed, e.g., from a global app state
}

const StatusBar: React.FC<StatusBarProps> = (props) => {
  const [editorState, setEditorState] = useState<EditorState>(editorStateManager.getState());
  // const [analysisState, setAnalysisState] = useState<AnalysisState>(analysisStateManager.getState()); // If analysis status is needed

  useEffect(() => {
    const unsubscribeEditor = editorStateManager.subscribe(setEditorState);
    // const unsubscribeAnalysis = analysisStateManager.subscribe(setAnalysisState); // If used

    return () => {
      unsubscribeEditor();
      // unsubscribeAnalysis(); // If used
    };
  }, []);

  const { filePath, language, currentContent, selection, isDirty } = editorState;
  const lineCount = currentContent.split('\n').length;
  const charCount = currentContent.length;
  
  let cursorPosition = 'Ln ?, Col ?';
  if (selection) {
    cursorPosition = `Ln ${selection.positionLineNumber}, Col ${selection.positionColumn}`;
  }

  // Example: Get analysis status (this would come from your analysis state)
  // const analysisStatus = analysisState.isRunning ? 'Analyzing...' : (analysisState.error ? 'Error' : 'Idle');

  return (
    <div 
      className="status-bar" 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '4px 8px', 
        backgroundColor: '#252526', // Similar to VS Code status bar
        color: '#cccccc', 
        fontSize: '0.85em',
        borderTop: '1px solid #333333'
      }}
      data-testid="status-bar"
    >
      <div className="status-left">
        <span>{filePath ? `File: ${filePath.split(/[\\/]/).pop()}` : 'No File'}</span>
        <span style={{ marginLeft: '10px' }}>{isDirty ? '(modified)' : ''}</span>
      </div>
      <div className="status-center">
        {/* <span>Analysis: {analysisStatus}</span> */} {/* Example analysis status */}
      </div>
      <div className="status-right" style={{ display: 'flex', gap: '15px' }}>
        <span>{cursorPosition}</span>
        <span>Lines: {lineCount}</span>
        <span>Chars: {charCount}</span>
        <span>Lang: {language}</span>
        {/* Add other indicators like encoding, LSP status, etc. */}
      </div>
    </div>
  );
};

export default StatusBar;
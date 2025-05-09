// src/renderer/ipc/state-sync.ts

import { store, RootState } from '../state/store';
import { EditorReduxState } from '../state/editor/types';
import { AnalysisState } from '../state/analysis/types';
import { setFilePath, setContent, setLanguage, setSelection, setDirtyStatus } from '../state/editor/actions';
import { startAnalysis, analysisSuccess, analysisFailure, clearAnalysisResults } from '../state/analysis/actions';

import {
  IPC_STATE_SYNC_EDITOR_TO_MAIN,
  IPC_STATE_SYNC_ANALYSIS_TO_MAIN,
  IPC_REQUEST_INITIAL_STATE,
  IPC_INITIAL_STATE_RESPONSE,
  IpcSyncEditorStatePayload,
  IpcSyncAnalysisStatePayload,
  IpcInitialStatePayload,
} from './types';

declare global {
  interface Window {
    electron?: {
      send: (channel: string, ...args: any[]) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}

let previousEditorState: EditorReduxState | undefined = undefined;
let previousAnalysisState: AnalysisState | undefined = undefined;

/**
 * Manages synchronization of Redux state with the main process.
 */
export const StateSync = {
  /**
   * Initializes state synchronization.
   * Subscribes to store changes and listens for initial state from main.
   */
  initialize: () => {
    if (!window.electron) {
      console.warn('Electron IPC not available. State synchronization disabled.');
      return;
    }

    // Subscribe to store changes to send updates to main
    store.subscribe(handleStateChange);

    // Listen for initial state response from main process
    window.electron.receive(IPC_INITIAL_STATE_RESPONSE, (event, payload: IpcInitialStatePayload) => {
      console.log('IPC: Received initial state from main:', payload);
      if (payload.editor) {
        // Dispatch actions to populate editor state
        // Be careful not to trigger a loop if these dispatches cause handleStateChange to fire immediately
        // and send the same state back. The diffing in handleStateChange should prevent this.
        store.dispatch(setFilePath(payload.editor.filePath));
        store.dispatch(setContent(payload.editor.currentContent, payload.editor.isDirty));
        store.dispatch(setLanguage(payload.editor.language));
        if (payload.editor.selection) store.dispatch(setSelection(payload.editor.selection));
      }
      if (payload.analysis) {
        // Dispatch actions for analysis state
        // This might involve clearing existing results and then populating
        store.dispatch(clearAnalysisResults()); // Clear local before applying synced
        Object.values(payload.analysis.results).forEach(result => {
            if(result) store.dispatch(analysisSuccess(result));
        });
        if(payload.analysis.isRunning && payload.analysis.currentAnalysisFile) {
            store.dispatch(startAnalysis(payload.analysis.currentAnalysisFile));
        } else if (payload.analysis.error && payload.analysis.currentAnalysisFile) {
            store.dispatch(analysisFailure(payload.analysis.currentAnalysisFile, payload.analysis.error));
        }
        // TODO: Handle isRunning, currentAnalysisFile, error more robustly
      }
    });

    // Request initial state from main process
    console.log('IPC: Requesting initial state from main process.');
    window.electron.send(IPC_REQUEST_INITIAL_STATE);

    console.log('StateSync: Initialized.');
  },
};

function handleStateChange() {
  if (!window.electron) return;

  const currentState = store.getState();

  // Sync Editor State
  if (JSON.stringify(currentState.editor) !== JSON.stringify(previousEditorState)) {
    const editorPayload: IpcSyncEditorStatePayload = { editorState: currentState.editor };
    window.electron.send(IPC_STATE_SYNC_EDITOR_TO_MAIN, editorPayload);
    previousEditorState = currentState.editor;
    // console.log('IPC: Synced editor state to main:', editorPayload);
  }

  // Sync Analysis State
  if (JSON.stringify(currentState.analysis) !== JSON.stringify(previousAnalysisState)) {
    const analysisPayload: IpcSyncAnalysisStatePayload = { analysisState: currentState.analysis };
    window.electron.send(IPC_STATE_SYNC_ANALYSIS_TO_MAIN, analysisPayload);
    previousAnalysisState = currentState.analysis;
    // console.log('IPC: Synced analysis state to main:', analysisPayload);
  }
}

// Call initialize when the module is loaded, or explicitly in your app's entry point.
// StateSync.initialize();
// src/renderer/ipc/types.ts

import { Suggestion } from '../components/suggestions/SuggestionItem'; // For analysis results
import { EditorReduxState } from '../state/editor/types'; // For state sync
import { AnalysisState } from '../state/analysis/types'; // For state sync

// --- Channels ---
// Channels are strings that identify the type of IPC message.
// It's good practice to define them as constants.

// Analysis related channels
export const IPC_ANALYSIS_RUN = 'ipc:analysis:run';
export const IPC_ANALYSIS_RESULT = 'ipc:analysis:result';
export const IPC_ANALYSIS_ERROR = 'ipc:analysis:error';
export const IPC_ANALYSIS_CANCEL = 'ipc:analysis:cancel'; // Main to renderer if main cancels, or renderer to main to request cancel

// State synchronization channels (example)
export const IPC_STATE_SYNC_EDITOR_TO_MAIN = 'ipc:state:syncEditorToMain';
export const IPC_STATE_SYNC_ANALYSIS_TO_MAIN = 'ipc:state:syncAnalysisToMain';
export const IPC_REQUEST_INITIAL_STATE = 'ipc:state:requestInitial'; // Renderer requests state from Main
export const IPC_INITIAL_STATE_RESPONSE = 'ipc:state:initialResponse'; // Main sends initial state

// --- Payloads for Analysis ---

export interface IpcAnalysisRunPayload {
  filePath: string;
  content: string; // Or main process reads file based on filePath
  // config?: any; // Optional analysis configuration
}

export interface IpcAnalysisResultPayload {
  filePath: string;
  suggestions: Suggestion[];
  analysisDuration?: number;
}

export interface IpcAnalysisErrorPayload {
  filePath: string;
  errorMessage: string;
  errorStack?: string;
}

export interface IpcAnalysisCancelPayload {
    filePath?: string; // Optional: specify which analysis to cancel if multiple can run
}

// --- Payloads for State Sync ---

export interface IpcSyncEditorStatePayload {
  editorState: Partial<EditorReduxState>; // Send only changed parts or full state
}

export interface IpcSyncAnalysisStatePayload {
  analysisState: Partial<AnalysisState>;
}

export interface IpcInitialStatePayload {
    editor?: EditorReduxState;
    analysis?: AnalysisState;
    // other parts of the state
}


// --- General IPC Message Structure (Optional, for consistency) ---
// You might wrap all your IPC messages in a common structure,
// though often direct channel/payload is simpler for Electron.

// export interface IpcMessage<T> {
//   channel: string;
//   payload: T;
//   senderId?: number; // webContents.id
// }
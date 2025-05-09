// src/renderer/ipc/analysis-bridge.ts

import { store } from '../state/store';
import { analysisSuccess, analysisFailure, startAnalysis as dispatchStartAnalysis } from '../state/analysis/actions';
import {
  IPC_ANALYSIS_RUN,
  IPC_ANALYSIS_RESULT,
  IPC_ANALYSIS_ERROR,
  IPC_ANALYSIS_CANCEL,
  IpcAnalysisRunPayload,
  IpcAnalysisResultPayload,
  IpcAnalysisErrorPayload,
  IpcAnalysisCancelPayload,
} from './types';

// Ensure this code runs only in the renderer process
// `window.electron` would be exposed via a preload script
declare global {
  interface Window {
    electron?: {
      send: (channel: string, ...args: any[]) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
      // Add other methods exposed from preload if any
    };
  }
}

/**
 * Sets up IPC listeners for analysis results from the main process
 * and provides functions to send analysis requests to the main process.
 */
export const AnalysisBridge = {
  setupListeners: () => {
    if (!window.electron) {
      console.warn('Electron IPC not available. Analysis bridge disabled.');
      return;
    }

    window.electron.receive(IPC_ANALYSIS_RESULT, (event, payload: IpcAnalysisResultPayload) => {
      console.log('IPC: Received analysis result for', payload.filePath, payload);
      store.dispatch(analysisSuccess({
        filePath: payload.filePath,
        suggestions: payload.suggestions,
        analysisDuration: payload.analysisDuration,
      }));
    });

    window.electron.receive(IPC_ANALYSIS_ERROR, (event, payload: IpcAnalysisErrorPayload) => {
      console.error('IPC: Received analysis error for', payload.filePath, payload.errorMessage);
      store.dispatch(analysisFailure(payload.filePath, payload.errorMessage));
    });

    // Listener for when main process confirms cancellation or if main initiates a cancel
    window.electron.receive(IPC_ANALYSIS_CANCEL, (event, payload: IpcAnalysisCancelPayload) => {
        console.log('IPC: Received analysis cancellation signal for', payload.filePath || 'current');
        // Optionally, dispatch a specific "analysisCancelled" action if needed
        // For now, analysisFailure or a general stop might be handled by the reducer on CANCEL_ANALYSIS
        // This assumes the main process might send this if it cancels an ongoing task.
    });

    console.log('AnalysisBridge: IPC listeners set up.');
  },

  /**
   * Triggers an analysis request to the main process.
   * @param filePath - The path of the file to analyze.
   * @param content - The content of the file to analyze.
   */
  runAnalysis: (filePath: string, content: string): void => {
    if (!window.electron) {
      console.error('Electron IPC not available. Cannot run analysis.');
      // Fallback or mock behavior for non-Electron environments (e.g., web browser testing)
      store.dispatch(dispatchStartAnalysis(filePath)); // Dispatch start locally
      setTimeout(() => { // Simulate async call and error
        store.dispatch(analysisFailure(filePath, 'IPC not available. Mock analysis error.'));
      }, 1000);
      return;
    }
    
    console.log('IPC: Sending analysis request for', filePath);
    // Dispatch start analysis immediately for UI feedback
    store.dispatch(dispatchStartAnalysis(filePath)); 
    
    const payload: IpcAnalysisRunPayload = { filePath, content };
    window.electron.send(IPC_ANALYSIS_RUN, payload);
  },

  /**
   * Sends a request to cancel an ongoing analysis in the main process.
   * @param filePath - Optional. The specific analysis to cancel.
   */
  cancelAnalysis: (filePath?: string): void => {
    if (!window.electron) {
      console.warn('Electron IPC not available. Cannot send cancel analysis request.');
      return;
    }
    console.log('IPC: Sending cancel analysis request for', filePath || 'current');
    const payload: IpcAnalysisCancelPayload = { filePath };
    window.electron.send(IPC_ANALYSIS_CANCEL, payload);
    // Optionally, dispatch a local cancel action immediately for UI responsiveness
    // store.dispatch(cancelAnalysisAction()); // Assuming you have such an action
  },
};

// Initialize listeners when this module is loaded
// AnalysisBridge.setupListeners(); 
// It's often better to call setupListeners explicitly at app initialization.
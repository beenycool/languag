// src/renderer/state/analysis/types.ts

import { Suggestion } from '../../components/suggestions/SuggestionItem'; // Re-using for consistency

export interface AnalysisResult {
  filePath: string;
  suggestions: Suggestion[];
  // Add other relevant result data, e.g., performance metrics, errors during analysis
  analysisDuration?: number; // in milliseconds
  engineVersion?: string;
}

export interface AnalysisState {
  isRunning: boolean;
  currentAnalysisFile: string | null; // File path being analyzed
  results: { [filePath: string]: AnalysisResult }; // Store results per file path
  error: string | null;
  // Consider adding:
  // - progress: number (0-100) if analysis is long
  // - selectedEngine: string (if user can choose analysis engines)
  // - lastRunTimestamp: number
}

// Action Types
export const START_ANALYSIS = 'analysis/START_ANALYSIS';
export const ANALYSIS_SUCCESS = 'analysis/ANALYSIS_SUCCESS';
export const ANALYSIS_FAILURE = 'analysis/ANALYSIS_FAILURE';
export const CLEAR_ANALYSIS_RESULTS = 'analysis/CLEAR_ANALYSIS_RESULTS'; // For a specific file or all
export const CANCEL_ANALYSIS = 'analysis/CANCEL_ANALYSIS'; // If cancellation is supported

interface StartAnalysisAction {
  type: typeof START_ANALYSIS;
  payload: {
    filePath: string;
    // options?: any; // e.g., specific engines to use
  };
}

interface AnalysisSuccessAction {
  type: typeof ANALYSIS_SUCCESS;
  payload: AnalysisResult;
}

interface AnalysisFailureAction {
  type: typeof ANALYSIS_FAILURE;
  payload: {
    filePath: string; // File path for which analysis failed
    error: string;
  };
}

interface ClearAnalysisResultsAction {
  type: typeof CLEAR_ANALYSIS_RESULTS;
  payload?: {
    filePath: string; // If undefined, clear all results
  };
}

interface CancelAnalysisAction {
    type: typeof CANCEL_ANALYSIS;
    // payload might not be needed if it cancels any ongoing analysis
}


export type AnalysisActionTypes =
  | StartAnalysisAction
  | AnalysisSuccessAction
  | AnalysisFailureAction
  | ClearAnalysisResultsAction
  | CancelAnalysisAction;
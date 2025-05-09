// src/renderer/state/analysis/reducer.ts

import {
  AnalysisState,
  AnalysisActionTypes,
  START_ANALYSIS,
  ANALYSIS_SUCCESS,
  ANALYSIS_FAILURE,
  CLEAR_ANALYSIS_RESULTS,
  CANCEL_ANALYSIS,
} from './types';

const initialState: AnalysisState = {
  isRunning: false,
  currentAnalysisFile: null,
  results: {},
  error: null,
};

const analysisReducer = (
  state = initialState,
  action: AnalysisActionTypes
): AnalysisState => {
  switch (action.type) {
    case START_ANALYSIS:
      return {
        ...state,
        isRunning: true,
        currentAnalysisFile: action.payload.filePath,
        error: null, // Clear previous errors
      };
    case ANALYSIS_SUCCESS:
      return {
        ...state,
        isRunning: state.currentAnalysisFile === action.payload.filePath ? false : state.isRunning, // Stop running only if it's the current file
        results: {
          ...state.results,
          [action.payload.filePath]: action.payload,
        },
        currentAnalysisFile: state.currentAnalysisFile === action.payload.filePath ? null : state.currentAnalysisFile,
        error: null,
      };
    case ANALYSIS_FAILURE:
      return {
        ...state,
        isRunning: state.currentAnalysisFile === action.payload.filePath ? false : state.isRunning,
        error: action.payload.error,
        currentAnalysisFile: state.currentAnalysisFile === action.payload.filePath ? null : state.currentAnalysisFile,
      };
    case CLEAR_ANALYSIS_RESULTS:
      if (action.payload?.filePath) {
        const { [action.payload.filePath]: _, ...remainingResults } = state.results;
        return {
          ...state,
          results: remainingResults,
        };
      }
      // Clear all results if no specific filePath is provided
      return {
        ...state,
        results: {},
        error: null, // Also clear errors when clearing all results
      };
    case CANCEL_ANALYSIS:
        return {
            ...state,
            isRunning: false,
            currentAnalysisFile: null,
            // Optionally, you might want to mark the current analysis as 'cancelled'
            // or keep partial results if the cancellation process allows for it.
            // For simplicity, we just stop the 'isRunning' flag.
        };
    default:
      return state;
  }
};

export default analysisReducer;
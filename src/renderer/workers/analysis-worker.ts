// src/renderer/workers/analysis-worker.ts

/// <reference lib="webworker" />

import {
  WorkerTaskType,
  WorkerResponseType,
  AnalyzeContentPayload,
  AnalyzeContentResult,
  AnalysisWorkerTask,
  AnalysisWorkerResponse,
} from './worker-types';
import { Suggestion } from '../components/suggestions/SuggestionItem';

// This makes TypeScript treat this file as a module.
// If you have `isolatedModules` set to true in tsconfig, this is necessary.
export { };

declare const self: DedicatedWorkerGlobalScope;

console.log('Analysis Worker: Script loaded and executing.');

/**
 * Simulates a text analysis process.
 * In a real application, this would involve complex logic, possibly NLP libraries.
 */
const performAnalysis = (payload: AnalyzeContentPayload): AnalyzeContentResult => {
  const startTime = Date.now();
  const { content, filePath } = payload;
  const suggestions: Suggestion[] = [];

  // Example: Simple check for the word "error"
  if (content.toLowerCase().includes('error')) {
    const matchIndex = content.toLowerCase().indexOf('error');
    // Crude way to find line and column, a real app would parse lines
    const lines = content.substring(0, matchIndex).split('\n');
    const lineNumber = lines.length;
    const columnNumber = lines[lines.length - 1].length + 1;

    suggestions.push({
      id: `err-${Date.now()}`,
      title: 'Potential "Error" Keyword',
      description: 'The word "error" was found. This might indicate an issue.',
      type: 'warning',
      // range: { // This would require more complex logic to calculate accurately
      //   startLine: lineNumber,
      //   startColumn: columnNumber,
      //   endLine: lineNumber,
      //   endColumn: columnNumber + 'error'.length,
      // },
    });
  }

  // Example: Check for long sentences (very basic)
  const sentences = content.split(/[.!?]+/); // Basic sentence split
  sentences.forEach((sentence, index) => {
    if (sentence.trim().split(/\s+/).length > 20) { // More than 20 words
      suggestions.push({
        id: `long-sentence-${index}-${Date.now()}`,
        title: 'Long Sentence',
        description: 'This sentence appears to be quite long. Consider shortening it for readability.',
        type: 'clarity',
      });
    }
  });
  
  const analysisDuration = Date.now() - startTime;

  return {
    filePath,
    suggestions,
    analysisDuration,
  };
};

self.onmessage = (event: MessageEvent<AnalysisWorkerTask>) => {
  const { taskId, type, payload } = event.data;
  console.log(`Analysis Worker: Received task ${taskId} of type ${type}`);

  try {
    let result: AnalyzeContentResult | undefined;

    switch (type) {
      case WorkerTaskType.ANALYZE_CONTENT:
        result = performAnalysis(payload as AnalyzeContentPayload);
        const successResponse: AnalysisWorkerResponse = {
          taskId,
          type: WorkerResponseType.TASK_COMPLETE,
          result,
        };
        self.postMessage(successResponse);
        break;
      default:
        console.warn(`Analysis Worker: Unknown task type received: ${type}`);
        const errorResponse: AnalysisWorkerResponse = {
          taskId,
          type: WorkerResponseType.TASK_ERROR,
          error: { message: `Unknown task type: ${type}` },
        };
        self.postMessage(errorResponse);
        return;
    }
  } catch (e: any) {
    console.error(`Analysis Worker: Error processing task ${taskId}:`, e);
    const errorResponse: AnalysisWorkerResponse = {
      taskId,
      type: WorkerResponseType.TASK_ERROR,
      error: { message: e.message || 'Unknown error in worker', stack: e.stack },
    };
    self.postMessage(errorResponse);
  }
};

// Signal that the worker is ready
const readyResponse: AnalysisWorkerResponse = {
    taskId: 'worker-init', // Special ID for ready signal
    type: WorkerResponseType.WORKER_READY,
};
self.postMessage(readyResponse);

console.log('Analysis Worker: Message handler set up and ready signal posted.');
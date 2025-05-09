// src/renderer/workers/worker-types.ts

import { Suggestion } from '../components/suggestions/SuggestionItem'; // Re-using Suggestion type

// --- Messages from Main Thread to Worker ---

export enum WorkerTaskType {
  ANALYZE_CONTENT = 'ANALYZE_CONTENT',
  // Add other task types, e.g., LINT_CONTENT, FORMAT_CONTENT
}

export interface AnalyzeContentPayload {
  filePath: string; // Or some unique ID for the content
  content: string;
  language?: string; // Optional, worker might infer or have a default
  // config?: any; // Optional analysis configuration
}

export interface WorkerTask<T = any> {
  taskId: string; // Unique ID for this specific task instance
  type: WorkerTaskType;
  payload: T;
}

// --- Messages from Worker to Main Thread ---

export enum WorkerResponseType {
  TASK_COMPLETE = 'TASK_COMPLETE',
  TASK_ERROR = 'TASK_ERROR',
  TASK_PROGRESS = 'TASK_PROGRESS', // For long-running tasks
  WORKER_READY = 'WORKER_READY',   // Worker signals it's initialized
}

export interface AnalyzeContentResult {
  filePath: string;
  suggestions: Suggestion[];
  analysisDuration?: number;
}

export interface WorkerResponse<R = any, E = any> {
  taskId: string; // Corresponds to the WorkerTask's taskId
  type: WorkerResponseType;
  result?: R;
  error?: {
    message: string;
    stack?: string;
    details?: E; // Additional error details
  };
  progress?: number; // 0-100 for TASK_PROGRESS
}

// Specific types for Analysis Worker
export type AnalysisWorkerTask = WorkerTask<AnalyzeContentPayload>;
export type AnalysisWorkerResponse = WorkerResponse<AnalyzeContentResult, { code?: string }>;

// --- Worker Pool Specific Types ---
export interface WorkerInstance {
  worker: Worker;
  isBusy: boolean;
  id: number; // Pool-internal ID for the worker instance
}
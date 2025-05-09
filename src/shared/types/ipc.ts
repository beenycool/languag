export enum IPCChannels {
  // Text Analysis
  ANALYZE_TEXT = 'analyze-text',
  ANALYSIS_RESULT = 'analysis-result',
  CANCEL_ANALYSIS = 'cancel-analysis',

  // Settings
  GET_SETTINGS = 'get-settings',
  UPDATE_SETTINGS = 'update-settings',
  SETTINGS_CHANGED = 'settings-changed',

  // Window Management
  GET_WINDOW_STATE = 'get-window-state',
  SET_WINDOW_STATE = 'set-window-state', // For specific state changes like maximize/minimize
  WINDOW_STATE_CHANGE = 'window-state-change', // For broadcasting general changes like resize/move

  // Background Tasks
  TASK_PROGRESS = 'task-progress',
  TASK_COMPLETE = 'task-complete',
  TASK_ERROR = 'task-error',

  // UI State specific (can overlap with Window Management but more granular for renderer)
  GET_UI_STATE = 'get-ui-state', // Generic getter for any UI related state part
  UPDATE_UI_STATE = 'update-ui-state', // Generic setter for any UI related state part
}

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean; // Though typically managed by Electron's native methods
}

export interface UiStatePayload {
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isMaximized?: boolean;
  // Add other UI state elements here as needed
}
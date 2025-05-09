# Application Shell Specification

## Overview
The Application Shell provides the core structure for the LinguaLens desktop application, handling window management, UI layout, and inter-process communication between the main and renderer processes.

## Core Components

### Main Window Structure
```typescript
interface MainWindowConfig {
  defaultSize: {
    width: number;  // Default: 1200
    height: number; // Default: 800
  };
  minSize: {
    width: number;  // Minimum: 800
    height: number; // Minimum: 600
  };
  defaultPosition: {
    x: number | null; // Center if null
    y: number | null; // Center if null
  };
  state: {
    maximized: boolean;
    fullscreen: boolean;
  };
}
```

### UI Layout Components
- **InputArea**: Primary text editor for user input
- **SuggestionPanel**: Collapsible side panel for displaying analysis results
- **StatusBar**: Bottom bar showing application state and background task progress
- **SettingsButton**: Quick access to settings dialog
- **ToolbarArea**: Top bar with common actions and menu access

## IPC Channels & Events

### Core IPC Channels
```typescript
enum IPCChannels {
  // Text Analysis
  ANALYZE_TEXT = 'analyze-text',
  ANALYSIS_RESULT = 'analysis-result',
  CANCEL_ANALYSIS = 'cancel-analysis',
  
  // Settings
  GET_SETTINGS = 'get-settings',
  UPDATE_SETTINGS = 'update-settings',
  SETTINGS_CHANGED = 'settings-changed',
  
  // Window Management
  WINDOW_STATE_CHANGE = 'window-state-change',
  
  // Background Tasks
  TASK_PROGRESS = 'task-progress',
  TASK_COMPLETE = 'task-complete',
  TASK_ERROR = 'task-error'
}
```

### Window Management Events
```typescript
interface WindowStateEvent {
  type: 'maximize' | 'unmaximize' | 'minimize' | 'restore' | 'resize' | 'move';
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

## UI State Persistence

### Persisted UI State
```typescript
interface UIState {
  window: {
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    isMaximized: boolean;
    isFullScreen: boolean;
  };
  editor: {
    fontSize: number;
    wordWrap: boolean;
    theme: string;
  };
  panels: {
    suggestions: {
      isVisible: boolean;
      width: number;
    };
  };
  lastUsedModel?: string;
  recentFiles: string[];
}
```

## Background Task Management

### Task Types
```typescript
interface BackgroundTask {
  id: string;
  type: 'analysis' | 'model-download' | 'cache-cleanup';
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  message?: string;
  error?: string;
  startTime: number;
  endTime?: number;
}
```

### Progress Updates
```typescript
interface TaskProgress {
  taskId: string;
  progress: number;
  status: BackgroundTask['status'];
  message?: string;
}
```

## Error Handling & Recovery

### Error Types
```typescript
enum AppShellErrorType {
  WINDOW_CREATION_FAILED = 'window-creation-failed',
  IPC_COMMUNICATION_ERROR = 'ipc-communication-error',
  STATE_PERSISTENCE_ERROR = 'state-persistence-error',
  BACKGROUND_TASK_ERROR = 'background-task-error'
}
```

### Error Recovery Strategy
1. Auto-save current state periodically (every 30 seconds)
2. Maintain backup of last known good state
3. Implement graceful degradation for non-critical features
4. Provide manual recovery options in settings

## Integration Points

### ConfigManager Integration
- Subscribe to relevant configuration changes
- Update UI components on config changes
- Persist UI-specific settings through ConfigManager

### LLM Service Integration
- Handle model loading states
- Display model status in UI
- Manage analysis request queue

### Analysis Pipeline Integration
- Stream partial results when available
- Handle analysis cancellation
- Display progress indicators

## Startup Sequence

1. Load persisted UI state
2. Initialize main window with saved/default bounds
3. Restore panel states and layout
4. Initialize IPC channels
5. Register event handlers
6. Load last used configuration
7. Connect to required services (LLM, Analysis)

## Shutdown Sequence

1. Save current UI state
2. Cancel pending background tasks
3. Close IPC channels
4. Save unsaved changes
5. Close windows
6. Cleanup temporary resources

## Performance Considerations

1. Lazy load non-critical UI components
2. Implement virtual scrolling for large result sets
3. Debounce frequent UI updates
4. Cache commonly used UI assets
5. Minimize IPC communication overhead
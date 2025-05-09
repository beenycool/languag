# UI State IPC System

## Available Channels

### Window Management
- `ui:window-state:get` - Retrieve current window state
  ```typescript
  const state = await ipcRenderer.invoke('ui:window-state:get');
  ```
- `ui:window-state:set` - Persist window state
  ```typescript
  await ipcRenderer.invoke('ui:window-state:set', {
    bounds: mainWindow.getBounds(),
    isMaximized: mainWindow.isMaximized()
  });
  ```

### UI Persistence
- `ui:sidebar:state` - Get/set sidebar visibility
- `ui:panel:state` - Get/set panel states

## Example Usage
```typescript
// Save window state before closing
window.addEventListener('beforeunload', () => {
  ipcRenderer.invoke('ui:window-state:set', {
    bounds: getCurrentWindowBounds(),
    isMaximized: isWindowMaximized()
  });
});

// Restore state on load
async function initWindowState() {
  const savedState = await ipcRenderer.invoke('ui:window-state:get');
  if (savedState) {
    applyWindowState(savedState);
  }
}
```

## Implementation Details
Handled by `ui-state-handlers.ts` (`src/main/ipc/ui-state-handlers.ts`):
- Uses Electron's `app.getPath('userData')` for storage
- Automatically loads on app start
- Validates saved state before application
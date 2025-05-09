# Extending the Application

## Adding New IPC Channels
1. Create handler in `src/main/ipc/`
2. Expose in preload script (`src/preload.ts`)
3. Add TypeScript definitions (`src/shared/types/ipc.ts`)

Example:
```typescript
// In main process
ipcMain.handle('custom:action', handler);

// In preload
contextBridge.exposeInMainWorld('api', {
  customAction: () => ipcRenderer.invoke('custom:action')
});
```

## Creating New UI Components
1. Add component to `src/renderer/`
2. Follow existing patterns for:
   - Styles (`src/renderer/styles/`)
   - State management
   - IPC communication

## Best Practices
1. **Separation of Concerns**:
   - Keep business logic in main process
   - Keep UI logic in renderer

2. **Type Safety**:
   - Define types for all IPC payloads
   - Use shared types where possible

3. **Testing**:
   - Include unit tests for new features
   - Add integration tests for IPC flows
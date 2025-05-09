# Core Application Shell Architecture

## Overview
The application shell is built using Electron, providing a cross-platform desktop application framework with Node.js backend and Chromium frontend.

Key components:
- **Main Process**: Node.js process that manages application lifecycle (`src/main.ts`)
- **Renderer Process**: Chromium-based UI process (`src/renderer/renderer.ts`)
- **Preload Script**: Bridges main and renderer processes (`src/preload.ts`)

## Process Separation

### Main Process Responsibilities
- Application lifecycle management
- Native OS interactions
- IPC endpoint for secure operations
- Background services (config, logging, etc.)

### Renderer Process Responsibilities
- UI rendering and interaction
- Lightweight business logic
- IPC requests to main process

### Preload Script
- Exposes safe IPC channels to renderer
- Implements security boundaries
- Initializes context bridge

## IPC Communication Patterns

```typescript
// Example from src/main/ipc/settings-handlers.ts
ipcMain.handle('settings:get', async (event, key) => {
  return ConfigManager.get(key);
});
```

Channels follow naming conventions:
- `settings:*` - Configuration management
- `ui:*` - Window state and UI persistence
- `llm:*` - LLM integration (separate docs)

## Security Considerations
1. **Context Isolation**: Enabled via preload script
2. **Sandboxing**: Renderer process runs without Node.js access
3. **Input Validation**: All IPC inputs sanitized (see `src/shared/utils/sanitization.ts`)
4. **Rate Limiting**: Critical endpoints protected (see `src/shared/utils/rate-limiter.ts`)
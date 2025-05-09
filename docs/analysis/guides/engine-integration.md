# Engine Integration Guide

## Using Analysis Engines

1. **Direct API Integration**:
```typescript
import { EngineCoordinator } from '../../src/main/analysis/engines/engine-coordinator';
const coordinator = new EngineCoordinator();
const results = await coordinator.analyze(text, context);
```

2. **IPC Integration**:
```typescript
// Main process
import { setupAnalysisHandlers } from '../../src/main/ipc/settings-handlers';
setupAnalysisHandlers();

// Renderer process
ipcRenderer.invoke('analyze-text', { text, options });
```

## Configuration Options

1. **Engine Selection**:
```json
{
  "engines": ["grammar", "style", "tone"],
  "grammar": { "strictness": "medium" }
}
```

2. **Performance Settings**:
```typescript
const options = {
  timeout: 5000, // ms
  memoryLimit: 100 // MB
};
```

## Error Handling

1. **Common Errors**:
```typescript
try {
  await coordinator.analyze(text);
} catch (error) {
  if (error.code === 'TIMEOUT') {
    // Handle timeout
  }
}
```

2. **Recovery Patterns**:
- Automatic retry for transient errors
- Fallback to simpler analysis when resources constrained
# Getting Started with Platform Development

## Setup Instructions
1. Install platform-specific build tools:
   ```bash
   # Windows
   npm install --global windows-build-tools

   # macOS
   xcode-select --install

   # Linux
   sudo apt-get install build-essential
   ```

2. Add platform dependencies:
   ```json
   "dependencies": {
     "@platform/core": "^1.0.0",
     "@platform/native": "^1.0.0"
   }
   ```

## Common Patterns
```typescript
// Platform-agnostic code example
import { platform } from '@platform/core';

async function readConfigFile(path: string) {
  const normalizedPath = platform.path.normalize(path);
  return platform.fs.readFile(normalizedPath);
}
```

## Examples
See test files in:
- `src/platform/__tests__/core/`
- `src/platform/__tests__/native/`
- `src/platform/__tests__/utils/`
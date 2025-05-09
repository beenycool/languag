# Developer Setup Guide

## Project Structure
```
src/
├── main/         # Main process code
├── renderer/     # Renderer process code
├── shared/       # Shared types/utils
├── __tests__/    # Test files
docs/             # Documentation
specs/            # Technical specifications
```

## Prerequisites
- Node.js 18+
- Yarn 1.22+
- Git

## Installation
```bash
git clone <repository-url>
cd languag
yarn install
```

## Build Configuration
- Main process: Compiled with TypeScript (`tsconfig.json`)
- Renderer process: Bundled with Vite
- Production builds: Electron Builder

## Development Workflow
1. Start dev server:
   ```bash
   yarn dev
   ```
2. Run tests:
   ```bash
   yarn test
   ```
3. Build for production:
   ```bash
   yarn build
   ```

## Debugging
- Main process: Use VS Code debug config
- Renderer process: Chrome DevTools
- IPC: Enable debug logs in `src/main/services/logger.ts`
# VS Code Integration Guide

## Extension Setup
1. Install the extension from VS Code Marketplace
2. Configure extension settings:
```json
{
  "extension.enable": true,
  "extension.apiKey": "your-api-key",
  "extension.autoSync": true
}
```

## API Usage
Access the integration API through:
```typescript
import * as vscode from 'vscode';
import { IntegrationAPI } from 'our-extension';

const api = new IntegrationAPI(vscode);
```

## Workspace Integration
Key features:
- Project-aware analysis
- Workspace configuration sync
- Multi-root workspace support

## Settings Sync
Configure sync in `settings.json`:
```json
{
  "sync.autoUpload": true,
  "sync.autoDownload": true,
  "sync.quietSync": false
}
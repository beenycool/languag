# Word Add-in Setup Guide

## Installation
1. Install dependencies:
```bash
npm install
```

2. Configure manifest:
- Update [`manifest.xml`](src/addins/word/manifest.xml) with your add-in details

## Development Workflow
1. Start development server:
```bash
npm run dev:word
```

2. Test components:
```bash
npm test src/addins/word/__tests__/
```

## Configuration Options
Key configs in [`config-manager.ts`](src/main/services/config-manager.ts):
```typescript
// Example config for Word add-in
{
  "word": {
    "ribbon": {
      "visibleCommands": ["analyze", "settings"]
    }
  }
}
```

## Debugging Tips
1. Use Office Add-in debugger
2. Check host communication logs in [`host-bridge.ts:45`](src/addins/word/services/communication/host-bridge.ts:45)
3. Test UI components in isolation using [`taskpane.spec.ts`](src/addins/word/__tests__/taskpane/taskpane.spec.ts)
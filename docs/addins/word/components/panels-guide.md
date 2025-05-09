# Panels Configuration Guide

## Suggestion Panel
Implemented in [`suggestion-panel.ts`](src/addins/word/components/panels/suggestion-panel.ts):
```typescript
// Display suggestions
suggestionPanel.showSuggestions(analysisResults);
```

Key features:
- Context-aware filtering
- Confidence scoring
- Multi-select support

## Settings Panel
Configuration via [`settings-panel.ts`](src/addins/word/components/panels/settings-panel.ts):
```typescript
// Update settings
settingsPanel.onChange((config) => {
  updateAddinConfig(config);
});
```

## UI Responsiveness
Best practices:
1. Use Office UI Fabric responsive components
2. Test across window sizes ([`taskpane-ui.spec.ts`](src/addins/word/__tests__/taskpane/taskpane-ui.spec.ts))
3. Optimize for touch and mouse input
# Getting Started Guide

## Quick Start
1. Install the add-in:
```bash
npm run install:word-addin
```

2. Load in Word:
- Open Word
- Go to Insert > My Add-ins
- Select "Languag Word Add-in"

## Common Patterns
1. Document analysis flow:
```typescript
const content = await getDocumentText();
const results = await analyzeContent(content);
applySuggestions(results);
```

2. Event handling ([`taskpane.ts`](src/addins/word/taskpane.ts)):
```typescript
Office.addin.onReady(() => {
  // Initialize UI
});
```

## Testing Guidelines
1. Unit tests: `npm test src/addins/word/__tests__/`
2. Integration tests: `npm run test:integration`
3. UI tests: `npm run test:ui`
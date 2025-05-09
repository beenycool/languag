# Ribbon Customization Guide

## Command Implementation
Core commands in [`ribbon-commands.ts`](src/addins/word/components/ribbon/ribbon-commands.ts):
```typescript
// Example command registration
Office.actions.associate("ANALYZE_DOCUMENT", analyzeDocument);
```

## UI Customization
Handled in [`ribbon-ui.ts`](src/addins/word/components/ribbon/ribbon-ui.ts):
```typescript
// Ribbon button configuration
const buttons = [
  {
    id: "analyze",
    label: "Analyze",
    icon: "Review",
    action: "ANALYZE_DOCUMENT"
  }
];
```

## Best Practices
1. Group related commands
2. Use standard Office icons
3. Follow Microsoft's Fluent UI guidelines
4. Test across Office versions ([`ribbon-ui.spec.ts`](src/addins/word/components/__tests__/ribbon/ribbon-ui.spec.ts))
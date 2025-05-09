# Error Reporting Guide

## Error Collection
Implemented in [`src/main/services/llm-service.ts`](src/main/services/llm-service.ts):
```typescript
try {
  // LLM operations
} catch (error) {
  errorReporter.captureException(error);
}
```

## Stack Analysis
1. **Grouping**: Errors grouped by:
   - Stack trace similarity
   - Error type
   - Component origin

2. **Prioritization**:
   - Frequency
   - Impact
   - Recentness

## Context Gathering
Additional context collected:
- User session ID
- Request parameters (sanitized)
- System state from [`src/monitoring/core/collectors`](src/monitoring/core/collectors)

## Privacy Considerations
- Data sanitization via [`src/shared/utils/sanitization.ts`](src/shared/utils/sanitization.ts)
- PII redaction
- GDPR compliance controls
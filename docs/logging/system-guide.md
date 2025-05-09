# System Logging Guide

## Log Management
- Centralized logging via [`src/main/services/logger.ts`](src/main/services/logger.ts)
- Structured JSON format
- Correlation IDs for tracing

## Log Routing
```typescript
// From src/main/services/logger.ts
const transports = [
  new winston.transports.File({ filename: 'combined.log' }),
  new winston.transports.Console()
];
```

## Format Configuration
Example log entry:
```json
{
  "timestamp": "ISO8601",
  "level": "info",
  "message": "LLM request completed",
  "duration": 245,
  "component": "llm-service"
}
```

## Retention Policies
1. Development: 7 days
2. Staging: 30 days
3. Production: 90 days
4. Critical errors: 1 year
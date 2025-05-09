# Logging Handlers Guide

## File Logging Setup
Configured in [`src/main/services/logger.ts`](src/main/services/logger.ts):
```typescript
const fileTransport = new winston.transports.File({
  filename: 'app.log',
  maxsize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5
});
```

## Remote Logging
Integration options:
1. **ELK Stack**:
   ```javascript
   new winston.transports.Http({
     host: 'logstash.example.com',
     port: 5044
   })
   ```
2. **Splunk**:
   ```javascript
   new SplunkStreamEvent({
     splunk: splunkConfig
   })
   ```

## Stream Processing
Example using [`src/monitoring/integration/exporters/log-exporter.ts`](src/monitoring/integration/exporters/log-exporter.ts):
```typescript
const logStream = createReadStream('app.log')
  .pipe(new LogParser())
  .pipe(new LogAnalyzer());
```

## Performance Tips
1. Use async logging
2. Batch remote writes
3. Filter sensitive data using [`src/shared/utils/sanitization.ts`](src/shared/utils/sanitization.ts)
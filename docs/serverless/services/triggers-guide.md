# Event Triggers Guide

## HTTP Endpoints
```typescript
// http-trigger.ts implementation
export class HttpTrigger {
  constructor(
    private router: Router,
    private executor: FunctionExecutor
  ) {
    router.post('/:function', async (req, res) => {
      const result = await executor.run(req.params.function, req.body);
      res.json(result);
    });
  }
}
```

## Scheduled Execution
```json
// cron configuration example
{
  "schedules": {
    "cleanup-job": {
      "function": "db-cleanup",
      "cron": "0 3 * * *",
      "timezone": "UTC"
    }
  }
}
```

## Integration Patterns
| Pattern          | Use Case                  | Implementation File                   |
|------------------|---------------------------|---------------------------------------|
| Event Bridge     | Cross-service events      | `event-trigger.spec.ts`               |
| Queue Processor  | Batch processing          | `service-connector.spec.ts`           |
| Stream Listener  | Real-time data            | `storage-connector.spec.ts`           |

[Binding configurations reference](../integration/bindings-guide.md)
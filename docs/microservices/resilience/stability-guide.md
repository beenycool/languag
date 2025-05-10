# System Stability Patterns

## Rate Limiting

```typescript
// From rate-limiter.ts
class TokenBucket {
  constructor(
    private capacity: number,
    private refillRate: number
  ) {}
  
  consume(tokens: number): boolean {
    // Implementation
  }
}
```

## Resource Isolation

Strategies:
- Bulkheading
- Thread pools
- Memory limits

Implementation reference: [`src/scaling/resources/allocation/resource-allocator.ts`](src/scaling/resources/allocation/resource-allocator.ts)

## Timeout Handling

Best practices:
1. Set service-specific timeouts
2. Use hierarchical timeouts
3. Implement deadline propagation

Example configuration:
```typescript
// From request-balancer.ts
interface TimeoutConfig {
  global: number;
  perService: Record<string, number>;
  retryBackoff: number;
}
```

## Stability Patterns

1. **Bulkheading**
   - Isolate failures
   - Resource partitioning

2. **Load Shedding**
   - Prioritize critical requests
   - Reject non-essential traffic

3. **Circuit Breaking**
   - Fail fast
   - Automatic recovery
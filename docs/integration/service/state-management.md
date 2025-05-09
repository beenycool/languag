# State Management Architecture

## Core Components
1. **Shell State** ([`src/integration/services/state/shell-state.ts`](src/integration/services/state/shell-state.ts))
   - Maintains current service state
   - Persists to disk periodically

2. **State Sync** ([`src/integration/services/state/state-sync.ts`](src/integration/services/state/state-sync.ts))
   - Synchronizes state across processes
   - Handles conflict resolution

## Synchronization Patterns
```typescript
interface State {
  lastCommand: string;
  menuItems: MenuItem[];
  fileAssociations: FileAssociation[];
}

// Example state update
stateSync.update((current) => ({
  ...current,
  lastCommand: 'open',
  timestamp: Date.now()
}));
```

## Recovery Strategies
1. **Last Known Good State**
2. **Default State Fallback**
3. **Incremental Recovery**

## Best Practices
- Minimize state size
- Use immutable updates
- Validate state before applying
# Menu Event Handling

## Click Processing Flow
1. **Shell Event** → 
2. **Command Lookup** ([`src/integration/shell/commands/command-handler.ts`](src/integration/shell/commands/command-handler.ts)) → 
3. **Permission Check** → 
4. **Execution**

```typescript
handleMenuClick(event: MenuEvent) {
  const command = commandRegistry.get(event.commandId);
  if (command && hasPermission(command)) {
    executeCommand(command, event.context);
  }
}
```

## State Updates
- Menu interactions update:
  - Last used commands
  - User preferences
  - Contextual state ([`src/integration/services/state/shell-state.ts`](src/integration/services/state/shell-state.ts))

## Security Measures
- Command whitelisting
- Context validation
- Rate limiting ([`src/shared/utils/rate-limiter.ts`](src/shared/utils/rate-limiter.ts))
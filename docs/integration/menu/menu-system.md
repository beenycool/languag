# Menu System Architecture

## Core Components
1. **Menu Builder** ([`src/integration/shell/registration/context-menu.ts`](src/integration/shell/registration/context-menu.ts))
   - Constructs menu hierarchies
   - Handles platform-specific implementations

2. **Command Registry** ([`src/integration/shell/commands/command-registry.ts`](src/integration/shell/commands/command-registry.ts))
   - Maps menu items to commands
   - Manages command permissions

## Dynamic Updates
```typescript
// Example dynamic menu update
menuBuilder.updateMenu('file-explorer', {
  items: [
    { id: 'open', label: 'Open with Editor' },
    { id: 'analyze', label: 'Analyze Text' }
  ]
});
```

## Performance Considerations
- Cache frequently used menus
- Limit menu depth to 3 levels
- Use lazy loading for complex submenus
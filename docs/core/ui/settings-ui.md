# Settings UI Components

## Panel Structure
- **Main Container**: `src/renderer/settings.ts`
- **Sections**:
  - Appearance
  - Behavior
  - Advanced

## Available Controls
1. **Toggle Switches**:
   ```typescript
   createToggle({
     id: 'darkMode',
     label: 'Dark Mode',
     value: config.darkMode,
     onChange: (value) => updateSetting('darkMode', value)
   });
   ```

2. **Select Dropdowns**:
   ```typescript
   createSelect({
     id: 'language',
     label: 'Interface Language',
     options: SUPPORTED_LANGUAGES,
     value: config.language
   });
   ```

## Integration with Backend
All settings changes flow through IPC:
```typescript
async function updateSetting(key: string, value: any) {
  await window.api.invoke('settings:set', { key, value });
}
```

## Testing
See test file: `src/renderer/__tests__/settings.spec.ts`
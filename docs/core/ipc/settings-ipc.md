# Settings IPC System

## Available Channels

### Core Channels
- `settings:get` - Retrieve configuration value
  ```typescript
  // Usage example
  const theme = await ipcRenderer.invoke('settings:get', 'ui.theme');
  ```
- `settings:set` - Update configuration value
  ```typescript
  await ipcRenderer.invoke('settings:set', { 
    key: 'ui.theme', 
    value: 'dark' 
  });
  ```
- `settings:reset` - Restore default value
  ```typescript
  await ipcRenderer.invoke('settings:reset', 'ui.theme');
  ```

## Integration with ConfigManager
All settings operations are handled by `ConfigManager` service (`src/main/services/config-manager.ts`):
- Persistent storage
- Type validation
- Change notifications

## Example Usage
```typescript
// In renderer process
async function updateTheme(newTheme: string) {
  try {
    await ipcRenderer.invoke('settings:set', {
      key: 'ui.theme',
      value: newTheme
    });
    applyTheme(newTheme);
  } catch (error) {
    showError('Failed to update theme');
  }
}
# Native UI Integration

## Notifications System
```typescript
// From src/platform/native/ui/notifications.ts
interface NotificationAPI {
  show(title: string, body: string, options?: NotificationOptions): void;
  requestPermission(): Promise<boolean>;
}
```

## Dialog Management
Key features from `src/platform/native/ui/dialogs.ts`:
- File open/save dialogs
- Message boxes (alert, confirm, prompt)
- Native file pickers with platform-specific filters

## Tray Integration
```typescript
// From src/platform/native/ui/tray.ts
interface TrayAPI {
  create(icon: string, menuItems: MenuItem[]): TrayHandle;
  update(handle: TrayHandle, changes: TrayUpdate): void;
}
```

## Platform-Specific UI Considerations
| Feature         | Windows                  | macOS                    | Linux                    |
|----------------|-------------------------|-------------------------|-------------------------|
| Notifications  | Action Center           | Notification Center      | libnotify               |
| Dialogs        | Win32 Common Dialogs    | Cocoa Sheets             | GTK File Chooser        |
| Tray Icons     | System Tray             | Menu Bar Extra           | Status Notifier Items   |
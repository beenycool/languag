# Platform-Specific Development Guide

## Windows Development
Key considerations:
- Use `\\` for path separators in tests
- Handle case-insensitive file systems
- Account for Windows-specific environment variables (`%APPDATA%`)

## macOS Development
Key considerations:
- Sandboxing requirements
- Menu bar integration
- Dark mode support

## Linux Development
Key considerations:
- Desktop environment differences (GNOME/KDE)
- Systemd vs init.d for services
- Package manager variations

## Testing Strategies
1. **Unit Tests**: Platform-specific mocks
   ```typescript
   // Example from src/platform/__tests__/core/implementations/windows.spec.ts
   test('normalizePath', () => {
     expect(windows.normalizePath('C:/test\\path')).toBe('C:\\test\\path');
   });
   ```

2. **Integration Tests**: Verify cross-platform behavior
3. **E2E Tests**: Full platform workflow validation
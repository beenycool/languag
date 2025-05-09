# Platform Troubleshooting Guide

## Common Issues
1. **Path resolution errors**:
   - Symptom: "File not found" on specific platforms
   - Fix: Always use `platform.path` utilities

2. **Permission denied errors**:
   - Symptom: Operations failing with EACCES
   - Fix: Request permissions via `platform.permissions`

3. **Encoding issues**:
   - Symptom: Garbled text on file read/write
   - Fix: Specify encoding explicitly

## Debugging Tips
1. Check platform detection:
   ```typescript
   console.log(platform.getOS());
   ```

2. Verify feature availability:
   ```typescript
   console.log(platform.features.supported());
   ```

3. Test path normalization:
   ```typescript
   console.log(platform.path.normalize('test/path'));
   ```

## Best Practices
1. Test on all target platforms early and often
2. Use platform detection for fallback implementations
3. Document platform-specific requirements
4. Monitor platform API changes
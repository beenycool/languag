# ML Integration Troubleshooting

## Common Issues
1. **Model Loading Failures**:
   - Verify model file integrity
   - Check framework version compatibility

2. **Performance Degradation**:
   ```bash
   ml-profile --model sentiment --input sample.json
   ```

## Debug Strategies
1. **Log Collection**:
   ```bash
   ml-logs collect --output debug.zip
   ```

2. **Isolation Testing**:
   ```typescript
   testInIsolation({
     model: 'sentiment',
     testCases: ['./tests/basic.json']
   });
   ```

## Error Handling
Common error codes:
| Code | Meaning | Resolution |
|------|---------|------------|
| ML_400 | Invalid input | Validate input schema |
| ML_503 | Resource exhausted | Scale up resources |

## Support Resources
1. Documentation:
   - [Core Concepts](./../core/overview.md)
   - [API Reference](../api.md)
2. Community Forum
3. Enterprise Support Portal
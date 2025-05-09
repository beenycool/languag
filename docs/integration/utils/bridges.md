# Bridge Utilities Guide

## API Communication
```typescript
import { APIBridge } from 'our-tool/bridges';

const bridge = new APIBridge({
  baseURL: 'https://api.example.com',
  timeout: 5000
});
```

## Authentication
Configure auth methods:
```javascript
bridge.setAuth({
  type: 'jwt',
  token: process.env.API_TOKEN,
  refreshToken: process.env.REFRESH_TOKEN
});
```

## Event Handling
```javascript
bridge.on('analysisComplete', (results) => {
  console.log('Analysis results:', results);
});

bridge.emit('startAnalysis', { files: ['src/**/*.js'] });
```

## Error Management
```javascript
bridge.setErrorHandler((error) => {
  if (error.status === 401) {
    bridge.refreshToken();
  }
  return error;
});
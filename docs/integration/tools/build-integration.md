# Build System Integration Guide

## Webpack Plugin
```javascript
const OurWebpackPlugin = require('our-tool/webpack');

module.exports = {
  plugins: [
    new OurWebpackPlugin({
      analysis: true,
      optimize: true
    })
  ]
};
```

## Babel Configuration
```json
{
  "plugins": [
    ["our-babel-plugin", {
      "analysis": true,
      "transformations": ["modernize"]
    }]
  ]
}
```

## TypeScript Setup
Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "our-ts-plugin",
        "analysis": true
      }
    ]
  }
}
```

## Performance Tips
1. Enable caching:
```javascript
new OurWebpackPlugin({
  cache: true,
  cacheLocation: './.our-cache'
});
```

2. Parallel processing:
```javascript
new OurWebpackPlugin({
  parallel: true,
  maxThreads: 4
});
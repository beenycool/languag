# Getting Started with Integration

## Setup Instructions
1. Install the package:
```bash
npm install our-integration
```

2. Initialize configuration:
```bash
our-integration init
```

## Basic Usage
```javascript
const integration = require('our-integration');

integration.analyze({
  files: ['src/**/*.js'],
  config: './.integrationrc'
});
```

## Common Patterns
1. CI integration:
```javascript
if (process.env.CI) {
  integration.setCIOptions({
    failOnCritical: true
  });
}
```

2. Watch mode:
```bash
our-integration watch --dir src
```

## Examples
Analyze specific files:
```bash
our-integration analyze src/index.js
```

Generate report:
```bash
our-integration report --format html
# Linter Integration Guide

## ESLint Setup
1. Install ESLint plugin:
```bash
npm install eslint-plugin-our-tool --save-dev
```

2. Add to ESLint config:
```json
{
  "plugins": ["our-tool"],
  "rules": {
    "our-tool/analysis": "error"
  }
}
```

## Prettier Integration
Add to Prettier config:
```json
{
  "plugins": ["prettier-plugin-our-tool"],
  "ourTool": {
    "enabled": true
  }
}
```

## Common Patterns
```javascript
// Custom rule example
module.exports = {
  meta: {
    docs: {
      description: 'Our analysis rule'
    }
  },
  create(context) {
    return {
      // Rule implementation
    };
  }
};
```

## Customization
Configure in package.json:
```json
{
  "ourTool": {
    "lintRules": {
      "complexityThreshold": 10,
      "styleChecks": true
    }
  }
}
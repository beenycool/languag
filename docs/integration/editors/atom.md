# Atom Editor Integration Guide

## Package Development
1. Initialize package:
```bash
apm init --package my-package --convert
```

2. Key files:
- `package.json`: Package metadata
- `lib/main.js`: Main package code
- `styles/main.less`: Package styles

## Workspace Integration
Register commands in `package.json`:
```json
"activationCommands": {
  "atom-workspace": [
    "my-package:toggle",
    "my-package:analyze"
  ]
}
```

## Command System
Add commands in `main.js`:
```javascript
atom.commands.add('atom-workspace', {
  'my-package:analyze': () => {
    // Analysis logic
  }
});
```

## Configuration
Add settings in `package.json`:
```json
"configSchema": {
  "autoAnalyze": {
    "type": "boolean",
    "default": true,
    "description": "Run analysis automatically"
  }
}
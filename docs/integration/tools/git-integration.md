# Git Integration Guide

## Git Bridge Usage
```typescript
import { GitBridge } from 'our-git-integration';

const bridge = new GitBridge({
  repoPath: './',
  autoFetch: true
});
```

## Diff Handling
Configure diff preferences:
```json
{
  "git.diffContext": 5,
  "git.diffIgnoreWhitespace": true,
  "git.diffAlgorithm": "histogram"
}
```

## Hook System
Example pre-commit hook:
```bash
#!/bin/sh
our-tool analyze --staged
```

## Configuration
Git config settings:
```ini
[our-tool]
  enabled = true
  auto-sync = true
  max-file-size = 1mb
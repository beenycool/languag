# Getting Started with Format Handling

## Setup Instructions
1. Install core dependencies:
```bash
npm install @core/formats @core/transformers
```

2. Register format handlers:
```typescript
import { FormatRegistry } from '@core/formats';
import { MarkdownHandler } from '@handlers/markdown';

const registry = new FormatRegistry();
registry.registerHandler(new MarkdownHandler());
```

## Basic Usage
1. Transform content:
```typescript
const transformed = await registry.transform(content, 'markdown', 'html');
```

2. Validate format:
```typescript
const isValid = registry.validate(content, 'markdown');
```

## Common Patterns
1. **Batch Processing**:
```typescript
const results = await Promise.all(
  files.map(file => registry.transform(file.content, file.format))
);
```

2. **Stream Processing**:
```typescript
const transformStream = registry.createTransformStream('markdown', 'html');
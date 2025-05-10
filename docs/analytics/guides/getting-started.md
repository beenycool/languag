# Getting Started Guide

## Setup Instructions
```bash
# Install dependencies
npm install @analytics/core @analytics/connectors

# Configuration
export ANALYTICS_CONFIG=config/local.json

# Start pipeline
npm run pipeline -- --env=development
```

## Basic Usage
```typescript
// Initialize pipeline
import { Pipeline } from '@analytics/core';

const pipeline = new Pipeline({
  name: 'my-first-pipeline',
  mode: 'stream'
});

// Add processing stage
pipeline.addStage({
  name: 'filter-events',
  handler: 'event-filter',
  config: { filter: "type === 'purchase'" }
});

// Start processing
pipeline.run();
```

## Common Patterns
1. **Simple ETL**:
   ```mermaid
   graph LR
     A[Extract] --> B[Transform]
     B --> C[Load]
   ```

2. **Real-time Dashboard**:
   ```mermaid
   graph LR
     A[Stream] --> B[Aggregate]
     B --> C[Visualize]
   ```

## Examples
- [Basic ETL Example](#)
- [Real-time Analytics Example](#)
- [Batch Processing Example](#)
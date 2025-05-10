# ML Integration: Getting Started

## Setup
1. Install dependencies:
```bash
npm install @ml/core @ml/models @ml/services
```

2. Configure environment:
```bash
cp .env.example .env
```

## Basic Usage
Initialize the ML pipeline:
```typescript
import { MLEngine } from '@ml/core';

const ml = new MLEngine({
  configPath: './ml-config.yaml'
});
```

## Common Patterns
1. **Batch Processing**:
```typescript
const results = await ml.batchProcess(data);
```

2. **Real-time Inference**:
```typescript
ml.realtimePredict(text, {
  callback: (result) => {
    // Handle prediction
  }
});
```

## Examples
Sentiment analysis:
```typescript
const sentiment = await ml.models.language.predictSentiment(text);
console.log(sentiment.score);
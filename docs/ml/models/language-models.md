# Language Models Guide

## NLP Implementation
Core components:
- **Text Processing** (`src/ml/__tests__/models/language/nlp-model.spec.ts`)
- **Embedding Generation**
- **Sequence Processing**

```typescript
// Example from src/main/llm/ollama-connector.ts
const nlp = new LanguageProcessor({
  tokenizer: 'wordpiece',
  maxLength: 512
});
```

## Sentiment Analysis
Configuration options:
```yaml
sentiment:
  model: 'distilbert-base-uncased'
  thresholds:
    positive: 0.7
    negative: 0.3
  outputFormat: 'percentage'
```

## Text Classification
Supported classes:
1. Topic detection
2. Intent recognition
3. Language identification

Example usage:
```bash
$ ml-predict classify --text "How do I reset my password?" --model support-intents
```

## Model Configuration
Common parameters:
```json
{
  "temperature": 0.7,
  "topP": 0.9,
  "maxTokens": 100,
  "presencePenalty": 0.5
}
# Analysis Engines

Core components that perform specific types of text analysis.

## BaseEngine

The abstract base class that all analysis engines extend.

### Key Functionality:
- Standardizes engine interface
- Handles common initialization
- Provides base metrics collection
- Implements core lifecycle methods

```typescript
abstract class BaseEngine {
  abstract analyze(segment: TextSegment): Promise<AnalysisResult>;
  protected abstract preparePrompt(text: string): string;
}
```

## GrammarEngine

Analyzes text for grammatical correctness and patterns.

### Features:
- Grammar rule validation
- Syntax pattern detection
- Error severity classification

### LLM Integration:
- Uses structured prompts for consistent analysis
- Implements prompt injection defenses
- Handles LLM response parsing

## StyleEngine

Evaluates writing style and readability.

### Features:
- Readability scoring
- Tone analysis
- Formality assessment
- Consistency checks

### Configuration:

```typescript
interface EngineConfig {
  enabled: boolean;
  timeout: number;
  llmService: LlmService;
  promptStrategy: 'concise'|'detailed';
}
```

## Extending Engines

To create a new engine:
1. Extend `BaseEngine`
2. Implement required methods
3. Register with `AnalysisOrchestrator`

```typescript
class CustomEngine extends BaseEngine {
  async analyze(segment: TextSegment) {
    // Custom analysis logic
  }
  
  protected preparePrompt(text: string) {
    // Custom prompt preparation
  }
}
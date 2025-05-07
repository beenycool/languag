# LLM Integration Layer - Core Components

## OllamaConnector

The `OllamaConnector` implements the `LLMProvider` interface to connect with Ollama's local LLM API.

### Key Features
- Supports both chat and completion modes
- Automatic HTTPS enforcement
- Configurable retry logic with exponential backoff
- Health monitoring with periodic checks
- Request validation and sanitization

### Usage Example
```typescript
import { OllamaConnector } from '../llm/ollama-connector';

// Initialize with default config
const ollama = new OllamaConnector();

// Generate text
const response = await ollama.generate("Hello world", {
  temperature: 0.7,
  maxTokens: 100
});

// Chat completion
const messages = [
  { role: 'user', content: 'Hello' }
];
const chatResponse = await ollama.chat(messages);
```

### Configuration Options
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| ollamaHost | string | `https://localhost:11434` | Ollama server URL |
| ollamaRequestTimeout | number | 30000 | Request timeout in ms |
| ollamaMaxRetries | number | 3 | Max retry attempts |
| ollamaRetryDelay | number | 1000 | Initial retry delay in ms |

## LlmService

The `LlmService` provides a unified interface for multiple LLM providers.

### Key Features
- Provider registration and management
- Request routing to active provider
- Input/output sanitization
- Rate limiting
- Caching integration

### API Methods
| Method | Description |
|--------|-------------|
| `process(request: LLMRequest)` | Process LLM request |
| `streamResponse(request: LLMRequest)` | Stream LLM response |
| `registerProvider(provider: LLMProvider)` | Register new provider |
| `setActiveProvider(name: string)` | Set active provider |
| `listModels()` | List available models |

### Usage Example
```typescript
import { getLlmService } from '../services/llm-service';

const llmService = getLlmService();

// Process request
const response = await llmService.process({
  type: 'chat',
  input: [{ role: 'user', content: 'Hello' }],
  options: { temperature: 0.7 }
});
```

## CacheService

The `CacheService` provides response caching for LLM requests.

### Key Features
- Configurable TTL and size limits
- Encryption support
- LRU eviction policy
- Semantic search capabilities (stubbed)

### Usage Example
```typescript
import { getLlmCacheService } from '../services/cache-service';

const cache = getLlmCacheService();

// Cache a response
await cache.set(cacheKey, response, 3600000); // 1 hour TTL

// Retrieve cached response
const cached = await cache.get(cacheKey);
```

### Configuration Options
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| maxSizeMB | number | 256 | Max cache size in MB |
| defaultTTL | number | 86400000 | Default TTL in ms (24h) |
| maxTTLMs | number | 604800000 | Maximum allowed TTL in ms (7d) |
| encryption.enabled | boolean | false | Enable cache encryption |
| encryption.key | string | - | Encryption key |
| encryption.algorithm | string | aes-256-gcm | Encryption algorithm |
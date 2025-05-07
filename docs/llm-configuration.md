# LLM Integration Layer - Configuration Guide

## Environment Variables

The system uses the following environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OLLAMA_HOST` | No | `localhost:11434` | Ollama server host and port |
| `LLM_PROVIDER` | No | `ollama` | Default LLM provider |
| `LLM_MODEL` | No | - | Default model to use |
| `LLM_CACHE_ENABLED` | No | `true` | Enable response caching |
| `LLM_CACHE_MAX_SIZE_MB` | No | `256` | Max cache size in MB |
| `LLM_CACHE_TTL_MS` | No | `86400000` (24h) | Default cache TTL |
| `LLM_CACHE_ENCRYPTION_KEY` | No | - | Cache encryption key |

## Configuration Structure

The main configuration is stored in the `llm` key of the application config:

```typescript
interface LLMConfig {
  provider: string; // 'ollama' or other provider
  model: string; // Default model name
  ollamaHost?: string; // Ollama server URL
  ollamaRequestTimeout?: number; // Request timeout in ms
  ollamaMaxRetries?: number; // Max retry attempts
  ollamaRetryDelay?: number; // Initial retry delay in ms
  rateLimit?: { // Rate limiting config
    maxRequests: number;
    intervalMs: number;
  };
  maxInputLength?: number; // Max allowed input size (default: 100000)
}
```

## Security Best Practices

1. **HTTPS Configuration**:
   - Always use HTTPS for remote Ollama servers
   - Set `OLLAMA_HOST` to a secure endpoint
   - Rotate credentials regularly

2. **Rate Limiting**:
   - Set conservative defaults (e.g., 100 requests/minute)
   - Adjust based on your server capacity
   - Monitor for abuse patterns

3. **Cache Security**:
   - Enable encryption for sensitive data
   - Set appropriate TTL values
   - Rotate encryption keys periodically

## Performance Tuning

| Parameter | Recommendation |
|-----------|----------------|
| `ollamaRequestTimeout` | 30-60 seconds for most models |
| `ollamaMaxRetries` | 3-5 for intermittent networks |
| `ollamaRetryDelay` | 1000ms with exponential backoff |
| `rateLimit.maxRequests` | Based on your Ollama server capacity |
| `maxInputLength` | Set to match your model's context window |

## Error Handling

The system provides these error handling mechanisms:

1. **Request Validation**:
   - Input length checks
   - Type validation
   - Model availability checks

2. **Error Types**:
   - `ProviderUnavailableError` - When LLM service is down
   - `RateLimitExceededError` - When request limit reached
   - `InvalidInputError` - For malformed requests
   - `ModelNotFoundError` - For invalid model requests

3. **Recovery Strategies**:
   - Automatic retries with backoff
   - Fallback providers (if configured)
   - Graceful degradation (returning cached responses)

## Example Configuration

```typescript
{
  llm: {
    provider: 'ollama',
    model: 'llama2',
    ollamaHost: 'https://ollama.example.com',
    ollamaRequestTimeout: 45000,
    ollamaMaxRetries: 3,
    ollamaRetryDelay: 1000,
    rateLimit: {
      maxRequests: 50,
      intervalMs: 60000
    },
    maxInputLength: 8000
  },
  llmCache: {
    maxSizeMB: 512,
    defaultTTL: 3600000, // 1 hour
    maxTTLMs: 86400000, // 24 hours
    encryption: {
      enabled: true,
      key: process.env.LLM_CACHE_ENCRYPTION_KEY
    }
  }
}
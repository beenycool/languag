# LLM Integration Layer - Security Features

## HTTPS Enforcement

The `OllamaConnector` automatically enforces HTTPS connections:
- Converts `http://` to `https://`
- Adds `https://` prefix if no protocol specified
- Logs warnings for insecure configurations

```typescript
private ensureHttps(hostUrl: string): string {
  if (hostUrl.startsWith('http://')) {
    logger.warn(`Ollama host ${hostUrl} is not HTTPS. Forcing HTTPS.`);
    return hostUrl.replace('http://', 'https://');
  }
  if (!hostUrl.startsWith('https://')) {
    logger.warn(`Ollama host ${hostUrl} does not specify a protocol. Assuming HTTPS.`);
    return `https://${hostUrl}`;
  }
  return hostUrl;
}
```

## Rate Limiting

The `RateLimiter` class provides request throttling:

### Configuration
| Parameter | Default | Description |
|-----------|---------|-------------|
| maxRequests | 100 | Max requests per interval |
| intervalMs | 60000 | Time window in milliseconds (1 minute) |

### Implementation Details
- Tracks requests per client ID
- Uses sliding window algorithm
- Automatically cleans up old records

```typescript
const rateLimiter = new RateLimiter(100, 60000); // 100 requests per minute

if (!rateLimiter.isAllowed(clientId)) {
  throw new Error('Rate limit exceeded');
}
```

## Cache Encryption

The `CacheService` supports encrypted caching:

### Encryption Configuration
```typescript
{
  encryption: {
    enabled: true,
    key: 'your-encryption-key', // Should come from secure storage
    algorithm: 'aes-256-gcm',  // Default
    ivLength: 12,              // Default for GCM
    authTagLength: 16          // Default for GCM
  }
}
```

### Encryption Process
1. Data is serialized to JSON
2. Random IV generated
3. Encrypted using AES-256-GCM
4. IV and auth tag prepended to ciphertext

## Input/Output Sanitization

The `sanitization.ts` utility provides:

### Key Functions
| Function | Purpose |
|----------|---------|
| `sanitizeInput()` | Escapes harmful characters in user input |
| `sanitizeOutput()` | Cleans LLM responses before use |
| `sanitizeError()` | Obfuscates sensitive error details in production |

### Sanitized Characters
| Character | Replacement |
|-----------|-------------|
| < | `<` |
| > | `>` |
| & | `&` |
| " | `"` |
| ' | `&#x27;` |
| ` | `&#x60;` |

### Error Handling
```typescript
// In production:
sanitizeError("DB Error: Connection failed") 
// Returns: "An error occurred. Please check logs for details."

// In development:
sanitizeError("DB Error: Connection failed")
// Returns original error message
import { OllamaConnector } from '../ollama-connector';
import { LLMConfig } from '../../../shared/types/config';
import { configManager } from '../../services/config-manager';
import { HealthStatus } from '../../../shared/types/llm';

// Mock dependencies
jest.mock('../../services/config-manager');
jest.mock('../../services/logger'); // Assuming logger is used and might need mocking
jest.mock('node-fetch'); // Mock fetch as it's used internally

const mockGet = jest.fn();
(configManager.get as jest.Mock) = mockGet;
(configManager.onChange as jest.Mock) = jest.fn().mockReturnValue(jest.fn()); // Mock onChange to return a dummy unsubscribe

describe('OllamaConnector', () => {
  let ollamaConnector: OllamaConnector;
  const mockLLMConfig: LLMConfig = {
    provider: 'ollama',
    model: 'test-model',
    contextSize: 4096,
    temperature: 0.7,
    ollamaHost: 'http://localhost:11434',
    ollamaRequestTimeout: 5000,
    ollamaMaxRetries: 3,
    ollamaRetryDelay: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(mockLLMConfig);
    // Import fetch dynamically as OllamaConnector does
    const fetch = require('node-fetch');
    fetch.default.mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }), // Default mock for listModels in health check
      text: async () => 'OK',
      body: {
        // Mock a minimal ReadableStream for streaming tests later
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify({ response: 'hello', done: false }) + '\n');
          yield Buffer.from(JSON.stringify({ response: ' world', done: false }) + '\n');
          yield Buffer.from(JSON.stringify({ done: true, prompt_eval_count: 1, eval_count: 1 }) + '\n');
        }
      }
    });
    ollamaConnector = new OllamaConnector();
  });

  describe('Connection Management', () => {
    it('should report as available if health check is successful', async () => {
      // OllamaConnector's initialize calls checkHealth, which uses fetch
      // Ensure fetch is mocked for the root path (health check)
      const fetch = require('node-fetch');
      fetch.default.mockResolvedValueOnce({ // For the initial health check on '/'
        ok: true,
        text: async () => 'Ollama is running',
      }).mockResolvedValueOnce({ // For the /api/tags call within checkHealth
        ok: true,
        json: async () => ({ models: [{ name: 'test-model', details: {} }] }),
      });

      // Re-initialize to pick up the new mock for this specific test
      ollamaConnector = new OllamaConnector();
      await (ollamaConnector as any).initializePromise; // Access internal promise if exposed or wait

      const isAvailable = await ollamaConnector.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should report as not available if health check fails', async () => {
      const fetch = require('node-fetch');
      fetch.default.mockResolvedValueOnce({ // For the initial health check on '/'
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => 'Server Error',
      });
       // Re-initialize to pick up the new mock for this specific test
      ollamaConnector = new OllamaConnector();
      await (ollamaConnector as any).initializePromise;

      const isAvailable = await ollamaConnector.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should attempt to reconnect using the reconnect method', async () => {
      const fetch = require('node-fetch');
      // Initial failure
      fetch.default.mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'Service Unavailable' });
      ollamaConnector = new OllamaConnector(); // Initialize with failing health check
      await (ollamaConnector as any).initializePromise;
      expect(await ollamaConnector.isAvailable()).toBe(false);

      // Mock successful health check for reconnect
      fetch.default.mockResolvedValueOnce({ ok: true, text: async () => 'Ollama is running' })
                   .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) }); // for /api/tags

      const reconnected = await ollamaConnector.reconnect();
      expect(reconnected).toBe(true);
      expect(await ollamaConnector.isAvailable()).toBe(true);
      expect(fetch.default).toHaveBeenCalledTimes(4); // Initial (host + tags), Reconnect (host + tags)
    });

    it('should stop retrying in makeRequest after maxRetries and report as unavailable', async () => {
      const fetch = require('node-fetch');
      // Mock fetch to always fail for makeRequest
      fetch.default.mockRejectedValue(new Error('Network Error'));

      // Config for 1 retry for faster test
      mockGet.mockReturnValue({ ...mockLLMConfig, ollamaMaxRetries: 1, ollamaRetryDelay: 10 });
      ollamaConnector = new OllamaConnector();
      // The initialize itself will try and fail.
      // We are testing makeRequest's retry logic, which is called by checkHealth during initialize.
      // isAvailable will reflect the outcome of these retries.
      await (ollamaConnector as any).initializePromise;

      const available = await ollamaConnector.isAvailable();
      expect(available).toBe(false);
      // makeRequest is called by checkHealth. checkHealth calls makeRequest for /api/tags.
      // Initial call to '/' (health check) + 1 retry = 2 calls
      // Initial call to '/api/tags' + 1 retry = 2 calls
      // Total 4 calls to fetch.default
      // However, the current structure of checkHealth uses fetch directly for the host, then makeRequest for /api/tags.
      // So, 1 direct fetch for host (fails), then makeRequest for /api/tags (1 attempt + 1 retry = 2 calls). Total 3.
      // If the host check itself used makeRequest, it would be 4.
      // Let's adjust the expectation based on current OllamaConnector.checkHealth implementation.
      // 1. checkHealth -> fetch(this.host) -> fails
      // 2. checkHealth -> makeRequest('/api/tags') -> fails (attempt 1)
      // 3. checkHealth -> makeRequest('/api/tags') -> fails (attempt 2 - maxRetries reached)
      expect(fetch.default).toHaveBeenCalledTimes(1 + mockLLMConfig.ollamaMaxRetries!); // 1 for host, N for /api/tags
    });
  });

  describe('Streaming Operations', () => {
    it('should correctly stream responses from Ollama for generate', async () => {
      const fetch = require('node-fetch');
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify({ model: 'test-model', created_at: 'time', response: 'Hello ', done: false }) + '\n');
          yield Buffer.from(JSON.stringify({ model: 'test-model', created_at: 'time', response: 'World', done: false }) + '\n');
          yield Buffer.from(JSON.stringify({ model: 'test-model', created_at: 'time', done: true, prompt_eval_count: 10, eval_count: 5 }) + '\n');
        }
      };
      fetch.default.mockResolvedValueOnce({ // For isAvailable check
        ok: true, text: async () => 'OK'
      }).mockResolvedValueOnce({ // For /api/tags in isAvailable
        ok: true, json: async () => ({ models: [] })
      }).mockResolvedValueOnce({ // For the actual streamGenerate call
        ok: true,
        body: mockStream,
      });

      const parts: (string | import('../../../shared/types/llm').ModelResponse)[] = [];
      for await (const part of ollamaConnector.streamGenerate('test prompt')) {
        parts.push(part);
      }

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('Hello ');
      expect(parts[1]).toBe('World');
      const finalResponse = parts[2] as import('../../../shared/types/llm').ModelResponse;
      expect(finalResponse.success).toBe(true);
      expect(finalResponse.content).toBe('Hello World');
      expect(finalResponse.usage?.promptTokens).toBe(10);
      expect(finalResponse.usage?.completionTokens).toBe(5);
    });

    it('should handle errors during streaming if initial request fails', async () => {
      const fetch = require('node-fetch');
       fetch.default.mockResolvedValueOnce({ // For isAvailable check
        ok: true, text: async () => 'OK'
      }).mockResolvedValueOnce({ // For /api/tags in isAvailable
        ok: true, json: async () => ({ models: [] })
      }).mockRejectedValueOnce(new Error('Stream failed')); // For the actual streamGenerate call

      const parts: (string | import('../../../shared/types/llm').ModelResponse)[] = [];
      try {
        for await (const part of ollamaConnector.streamGenerate('test prompt')) {
          parts.push(part);
        }
      } catch (e) {
        // Error should be yielded, not thrown by the iterator itself if makeRequest fails
      }
      expect(parts.length).toBe(1);
      const errorResponse = parts[0] as import('../../../shared/types/llm').ModelResponse;
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toContain('Stream failed');
    });
  });

  describe('Health Check Functionality', () => {
    it('should return HealthStatus with available: true if Ollama server is healthy', async () => {
      const fetch = require('node-fetch');
      fetch.default.mockResolvedValueOnce({ // For host check
        ok: true,
        text: async () => 'Ollama is running',
      }).mockResolvedValueOnce({ // For /api/tags
        ok: true,
        json: async () => ({ models: [{ name: 'test-model', details: {} }] }),
      });

      const health: HealthStatus = await ollamaConnector.checkHealth();
      expect(health.available).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.modelCount).toBe(1);
    });

    it('should return HealthStatus with available: false if Ollama server is not reachable', async () => {
      const fetch = require('node-fetch');
      fetch.default.mockRejectedValueOnce(new Error('Network error')); // For host check

      const health = await ollamaConnector.checkHealth();
      expect(health.available).toBe(false);
      expect(health.error).toContain('Network error');
    });

    it('should return HealthStatus with available: false if Ollama server responds with an error', async () => {
      const fetch = require('node-fetch');
      fetch.default.mockResolvedValueOnce({ // For host check
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => 'Service Unavailable',
      });
      // No /api/tags call if host check fails badly

      const health = await ollamaConnector.checkHealth();
      expect(health.available).toBe(false);
      expect(health.error).toContain('Health check failed: 503');
    });
  });

  describe('Error Handling (in non-streaming methods)', () => {
    it('should handle network errors gracefully in generate()', async () => {
      const fetch = require('node-fetch');
      fetch.default.mockResolvedValueOnce({ ok: true, text: async () => 'OK' }) // isAvailable -> host
                   .mockResolvedValueOnce({ ok: true, json: async () => ({models:[]}) }) // isAvailable -> tags
                   .mockRejectedValueOnce(new Error('Network Error')); // generate

      const response = await ollamaConnector.generate('test');
      expect(response.success).toBe(false);
      expect(response.error).toContain('Network Error');
    });

    it('should handle Ollama API errors (e.g., model not found) in chat()', async () => {
       const fetch = require('node-fetch');
       fetch.default.mockResolvedValueOnce({ ok: true, text: async () => 'OK' }) // isAvailable -> host
                    .mockResolvedValueOnce({ ok: true, json: async () => ({models:[]}) }) // isAvailable -> tags
                    .mockResolvedValueOnce({  // chat
                        ok: false,
                        status: 404,
                        text: async () => 'Model not found',
                    });
      const response = await ollamaConnector.chat([{role: 'user', content: 'hi'}]);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Model not found');
    });

    it('should handle timeouts correctly in makeRequest (leading to AbortError)', async () => {
      const fetch = require('node-fetch');
      const abortError = new Error('Request timed out');
      abortError.name = 'AbortError';
      fetch.default.mockResolvedValueOnce({ ok: true, text: async () => 'OK' }) // isAvailable -> host
                   .mockResolvedValueOnce({ ok: true, json: async () => ({models:[]}) }) // isAvailable -> tags
                   .mockRejectedValueOnce(abortError); // generate

      mockGet.mockReturnValue({ ...mockLLMConfig, ollamaRequestTimeout: 10 }); // Short timeout
      ollamaConnector = new OllamaConnector(); // Re-init with new config for timeout

      const response = await ollamaConnector.generate('test');
      expect(response.success).toBe(false);
      expect(response.error).toContain('Request timed out');
    });
  });
describe('Security Tests', () => {
    it('should use HTTPS if ollamaHost is HTTPS', async () => {
      const fetch = require('node-fetch');
      mockGet.mockReturnValue({ ...mockLLMConfig, ollamaHost: 'https://secure-ollama:11434' });
      ollamaConnector = new OllamaConnector(); // Re-initialize with HTTPS host

      // Mock successful health check for HTTPS
      fetch.default.mockResolvedValueOnce({ ok: true, text: async () => 'Ollama is running (securely)' })
                   .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) }); // for /api/tags

      await (ollamaConnector as any).initializePromise;
      await ollamaConnector.checkHealth();

      // Verify fetch was called with HTTPS URL
      expect(fetch.default).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/secure-ollama:11434/),
        expect.any(Object)
      );
    });

    it('should default to HTTP if protocol is missing and warn (or handle as per design)', async () => {
      const fetch = require('node-fetch');
      // console.warn = jest.fn(); // Mock console.warn if OllamaConnector is expected to warn
      mockGet.mockReturnValue({ ...mockLLMConfig, ollamaHost: 'localhost:11434' }); // No protocol
      ollamaConnector = new OllamaConnector();

      fetch.default.mockResolvedValueOnce({ ok: true, text: async () => 'Ollama is running' })
                   .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) });

      await (ollamaConnector as any).initializePromise;
      await ollamaConnector.checkHealth();

      expect(fetch.default).toHaveBeenCalledWith(
        expect.stringMatching(/^http:\/\/localhost:11434/), // Should default to http
        expect.any(Object)
      );
      // If warning is implemented: expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('assuming http'));
    });
  });
});
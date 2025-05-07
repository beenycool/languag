import { LlmService } from '../llm-service';
import { LLMConfig } from '../../../shared/types/config';
import { ChatMessage, CompletionOptions, GenerationOptions, LLMProvider, ModelResponse, LLMRequest, HealthStatus } from '../../../shared/types/llm';
import { configManager } from '../config-manager';

// Mocks
jest.mock('../config-manager');
jest.mock('../logger');

const mockConfigGet = jest.fn();
(configManager.get as jest.Mock) = mockConfigGet;
(configManager.onChange as jest.Mock) = jest.fn().mockReturnValue(jest.fn());

// Mock LLMProvider
const mockGenerate = jest.fn();
const mockChat = jest.fn();
const mockStreamGenerate = jest.fn();
const mockStreamChat = jest.fn();

const mockProvider: jest.Mocked<LLMProvider> = {
  providerName: 'mock-provider',
  initialize: jest.fn().mockResolvedValue(undefined),
  isAvailable: jest.fn().mockResolvedValue(true),
  checkHealth: jest.fn().mockResolvedValue({ available: true } as HealthStatus),
  reconnect: jest.fn().mockResolvedValue(true),
  listModels: jest.fn().mockResolvedValue([]),
  getModel: jest.fn().mockResolvedValue(undefined),
  generate: mockGenerate,
  chat: mockChat,
  streamGenerate: mockStreamGenerate,
  streamChat: mockStreamChat,
};

// Mock OllamaConnector constructor to prevent its actual instantiation
jest.mock('../../llm/ollama-connector', () => {
  return {
    OllamaConnector: jest.fn().mockImplementation(() => {
      // Return a minimal mock if LlmService tries to use it before our mockProvider is set
      return {
        providerName: 'ollama-mock',
        initialize: jest.fn().mockResolvedValue(undefined),
        checkHealth: jest.fn().mockResolvedValue({ available: false, error: 'mocked away' }),
        registerProvider: jest.fn(), // if LlmService tries to call this
        // Add other methods if LlmService interacts with them during construction
      };
    })
  };
});


describe('LlmService', () => {
  let llmService: LlmService;
  const mockLLMConfig: LLMConfig = {
    provider: 'ollama', // This will be used to select a provider, or a mock one
    model: 'default-model',
    contextSize: 2048,
    temperature: 0.5,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigGet.mockReturnValue(mockLLMConfig);
    // LlmService might try to instantiate providers, ensure mocks are ready
    // For now, let's assume LlmService allows registering providers or has a way to inject them.
    // This will likely need adjustment based on LlmService's actual implementation.
    llmService = new LlmService();
    // A more robust approach would be to mock the provider instantiation within LlmService
    // or allow injecting providers. For now, we'll assume it can pick up a registered mock.
    // This test will likely fail until LlmService's provider management is clear.
    // (llmService as any).providers = new Map([['mock-provider', mockProvider]]);
    // (llmService as any).currentProvider = mockProvider; // Force a provider for initial tests
    mockConfigGet.mockReturnValue({ ...mockLLMConfig, provider: 'mock-provider' }); // Ensure service tries to use mock
    llmService = new LlmService(); // Instantiate after mocks are set up
    llmService.registerProvider(mockProvider); // Register our mock provider
    await llmService.setActiveProvider('mock-provider'); // Explicitly set it active
  });

  describe('Provider-Agnostic API Functionality', () => {
    it('should delegate generate requests to the current provider via process()', async () => {
      const prompt = 'Test prompt';
      const options: GenerationOptions = { temperature: 0.6 };
      const expectedResponse: ModelResponse = { success: true, content: 'Generated text' };
      mockGenerate.mockResolvedValue(expectedResponse);

      const request: LLMRequest = { type: 'generate', input: prompt, options };
      const response = await llmService.process(request);

      expect(mockGenerate).toHaveBeenCalledWith(prompt, options, mockLLMConfig.model);
      expect(response).toEqual(expectedResponse);
      expect(true).toBe(false); // Deliberate fail
    });

    it('should delegate chat requests to the current provider via process()', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];
      const options: CompletionOptions = { maxTokens: 100 };
      const expectedResponse: ModelResponse = { success: true, content: 'Chat response' };
      mockChat.mockResolvedValue(expectedResponse);

      const request: LLMRequest = { type: 'chat', input: messages, options };
      const response = await llmService.process(request);

      expect(mockChat).toHaveBeenCalledWith(messages, options, mockLLMConfig.model);
      expect(response).toEqual(expectedResponse);
      expect(true).toBe(false); // Deliberate fail
    });

    it('should delegate streamGenerate requests to the current provider via streamResponse()', async () => {
      const prompt = 'Stream prompt';
      mockStreamGenerate.mockImplementation(async function* () {
        yield 'token1';
        yield { success: true, content: 'token1', modelId: 'test-model' } as ModelResponse;
      });

      const request: LLMRequest = { type: 'generate', input: prompt };
      const stream = llmService.streamResponse(request);
      const results: (string | ChatMessage | ModelResponse)[] = [];
      for await (const item of stream) {
        results.push(item);
      }
      expect(mockStreamGenerate).toHaveBeenCalledWith(prompt, undefined, mockLLMConfig.model);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toBe('token1');
      expect(true).toBe(false); // Deliberate fail
    });

    it('should switch providers if config changes', async () => {
      const newProviderConfig = { ...mockLLMConfig, provider: 'new-mock-provider' };
      const newMockProvider: jest.Mocked<LLMProvider> = {
        providerName: 'new-mock-provider',
        initialize: jest.fn().mockResolvedValue(undefined),
        isAvailable: jest.fn().mockResolvedValue(true),
        checkHealth: jest.fn().mockResolvedValue({ available: true } as HealthStatus),
        reconnect: jest.fn().mockResolvedValue(true),
        listModels: jest.fn(), generate: jest.fn(), chat: jest.fn(), streamGenerate: jest.fn(), streamChat: jest.fn(), getModel: jest.fn()
      };
      llmService.registerProvider(newMockProvider);

      // Simulate config change
      const changeCallback = (configManager.onChange as jest.Mock).mock.calls[0][1];
      mockConfigGet.mockReturnValue(newProviderConfig); // Future gets will return new config
      await changeCallback({ newValue: newProviderConfig });


      expect(llmService.getActiveProvider()?.providerName).toBe('new-mock-provider');
      expect(true).toBe(false); // Deliberate fail
    });
  });

  describe('Request/Response Handling (via process)', () => {
    it('should return a successful response from generate', async () => {
      mockGenerate.mockResolvedValue({ success: true, content: 'Success' });
      const response = await llmService.process({type: 'generate', input: 'p'});
      expect(response.success).toBe(true);
      expect(response.content).toBe('Success');
      expect(true).toBe(false); // Deliberate fail
    });

    it('should return a successful response from chat', async () => {
      mockChat.mockResolvedValue({ success: true, content: 'Chat success' });
      const response = await llmService.process({type: 'chat', input: [{role: 'user', content: 'm'}]});
      expect(response.success).toBe(true);
      expect(response.content).toBe('Chat success');
      expect(true).toBe(false); // Deliberate fail
    });
  });

  describe('Error Propagation (via process)', () => {
    it('should propagate errors from the provider during generate', async () => {
      mockGenerate.mockResolvedValue({ success: false, error: 'Provider error' });
      const response = await llmService.process({type: 'generate', input: 'p'});
      expect(response.success).toBe(false);
      expect(response.error).toBe('Provider error');
      expect(true).toBe(false); // Deliberate fail
    });

    it('should propagate errors from the provider during chat', async () => {
      mockChat.mockResolvedValue({ success: false, error: 'Chat provider error' });
      const response = await llmService.process({type: 'chat', input: [{role: 'user', content: 'm'}]});
      expect(response.success).toBe(false);
      expect(response.error).toBe('Chat provider error');
      expect(true).toBe(false); // Deliberate fail
    });

    it('should handle scenarios where no provider is available or configured', async () => {
      await llmService.setActiveProvider('non-existent-provider'); // This should make activeProvider null
      const response = await llmService.process({type: 'generate', input: 'p'});
      expect(response.success).toBe(false);
      expect(response.error).toContain('No suitable LLM provider available');
      expect(true).toBe(false); // Deliberate fail
    });
it('should handle unexpected errors from provider methods and return a ModelResponse', async () => {
      mockGenerate.mockRejectedValue(new Error('Unexpected provider crash'));
      const request: LLMRequest = { type: 'generate', input: 'test' };
      const response = await llmService.process(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Unexpected provider crash');
      // Ensure it's a ModelResponse, not a thrown error
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('error');
    });
  });

  describe('Integration with Different Providers', () => {
    // These tests would require more setup, potentially mocking multiple providers
    // and LlmService's provider loading/switching logic.
    it('should correctly use Ollama provider when configured', () => {
      expect(true).toBe(false); // Placeholder
    });

    it('should correctly use a (future) OpenAI provider when configured', () => {
      expect(true).toBe(false); // Placeholder
    });
  });
describe('Security Related Tests', () => {
    it('should use rate limiter if configured', async () => {
      // Mock RateLimiter to track its usage
      const mockAcquire = jest.fn().mockResolvedValue(undefined);
      jest.mock('../../../shared/utils/rate-limiter', () => {
        return {
          RateLimiter: jest.fn().mockImplementation(() => {
            return { acquire: mockAcquire, getTokensRemaining: () => 10 };
          }),
        };
      });

      // Re-initialize LlmService to pick up the mocked RateLimiter
      // and configure it to use rate limiting
      mockConfigGet.mockReturnValue({
        ...mockLLMConfig,
        provider: 'mock-provider', // ensure mock provider is used
        rateLimitEnabled: true,
        rateLimitRequests: 10,
        rateLimitIntervalMs: 1000,
      });
      llmService = new LlmService();
      llmService.registerProvider(mockProvider);
      await llmService.setActiveProvider('mock-provider');


      mockGenerate.mockResolvedValue({ success: true, content: 'Generated' });
      await llmService.process({ type: 'generate', input: 'test' });

      expect(mockAcquire).toHaveBeenCalled();
    });

    it('should not use rate limiter if disabled in config', async () => {
        const mockAcquire = jest.fn().mockResolvedValue(undefined);
        jest.mock('../../../shared/utils/rate-limiter', () => {
          return {
            RateLimiter: jest.fn().mockImplementation(() => {
              return { acquire: mockAcquire, getTokensRemaining: () => 10 };
            }),
          };
        });

        mockConfigGet.mockReturnValue({
          ...mockLLMConfig,
          provider: 'mock-provider',
          rateLimitEnabled: false, // Explicitly disable
        });
        // Re-initialize LlmService with rate limiting disabled
        llmService = new LlmService();
        llmService.registerProvider(mockProvider);
        await llmService.setActiveProvider('mock-provider');


        mockGenerate.mockResolvedValue({ success: true, content: 'Generated' });
        await llmService.process({ type: 'generate', input: 'test' });
        expect(mockAcquire).not.toHaveBeenCalled();
    });
  });
});
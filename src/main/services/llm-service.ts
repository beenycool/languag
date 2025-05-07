import {
  LLMProvider,
  LLMModel,
  ChatMessage,
  CompletionOptions,
  LLMRequest,
  ModelResponse,
  GenerationOptions,
  HealthStatus,
} from '../../shared/types/llm';
import { AppConfig, LLMConfig } from '../../shared/types/config';
import { configManager } from './config-manager';
import { OllamaConnector } from '../llm/ollama-connector';
import logger from './logger';
// import { ModelManager } from './model-manager'; // To be implemented
import { sanitizeInput, sanitizeOutput, sanitizeError } from '../../shared/utils/sanitization'; // Placeholder for actual sanitization utils
import { RateLimiter } from '../../shared/utils/rate-limiter';

const DEFAULT_MAX_REQUESTS = 100; // Example: 100 requests
const DEFAULT_INTERVAL_MS = 60000; // Example: per 1 minute

export class LlmService {
  private providers: Map<string, LLMProvider> = new Map();
  private activeProviderName: string | null = null;
  private llmConfig: LLMConfig;
  private rateLimiter: RateLimiter;
  // private modelManager: ModelManager; // To be implemented

  constructor() {
    this.llmConfig = configManager.get<LLMConfig>('llm');
    // this.modelManager = new ModelManager(this); // Pass LlmService instance or providers map

    const currentLlmConfig = configManager.get<LLMConfig>('llm');
    const rateLimitConfig = currentLlmConfig.rateLimit || {
        maxRequests: DEFAULT_MAX_REQUESTS,
        intervalMs: DEFAULT_INTERVAL_MS,
    };
    this.rateLimiter = new RateLimiter(rateLimitConfig.maxRequests, rateLimitConfig.intervalMs);


    this.initializeProviders();
    this.setActiveProvider(this.llmConfig.provider);

    configManager.onChange('llm', (change) => {
      const newLlmConfigValue = change.newValue as LLMConfig;
      logger.info(`LLM configuration changed. Provider: ${newLlmConfigValue.provider}, Model: ${newLlmConfigValue.model}`);
      this.llmConfig = newLlmConfigValue;
      // Update rate limiter if config changes
      const newRateLimitConfig = newLlmConfigValue.rateLimit || {
          maxRequests: DEFAULT_MAX_REQUESTS,
          intervalMs: DEFAULT_INTERVAL_MS,
      };
      this.rateLimiter = new RateLimiter(newRateLimitConfig.maxRequests, newRateLimitConfig.intervalMs);
      this.setActiveProvider(this.llmConfig.provider);
      // this.modelManager.handleConfigChange(newLlmConfigValue); // Notify model manager
    });
  }

  // Secure provider authentication:
  // Currently, LlmService relies on individual connectors (e.g., OllamaConnector)
  // to handle their own authentication. If LlmService were to manage API keys
  // or other credentials directly, they should be stored securely (e.g., using
  // a secrets manager or environment variables) and never logged.
  // For now, we ensure that sensitive parts of llmConfig are not logged excessively.
  // The logger in OllamaConnector already redacts model and prompt details.

  private async initializeProviders() {
    // Register Ollama provider
    const ollama = new OllamaConnector();
    if (ollama.initialize) {
        try {
            await ollama.initialize(); // Initialize if the provider has an init method
            this.registerProvider(ollama);
        } catch (error) {
            logger.error(`Failed to initialize Ollama provider: ${(error as Error).message}`);
        }
    } else {
        this.registerProvider(ollama); // Register directly if no init method
    }
    // TODO: Register other providers like OpenAIConnector when implemented
  }

  public registerProvider(provider: LLMProvider): void {
    if (this.providers.has(provider.providerName)) {
      logger.warn(`Provider ${provider.providerName} is already registered. Overwriting.`);
    }
    this.providers.set(provider.providerName, provider);
    logger.info(`Registered LLM Provider: ${provider.providerName}`);
  }

  public unregisterProvider(providerName: string): void {
    if (this.providers.delete(providerName)) {
      logger.info(`Unregistered LLM Provider: ${providerName}`);
      if (this.activeProviderName === providerName) {
        this.activeProviderName = null;
        logger.warn('Active provider was unregistered. No active provider set.');
        // Optionally, try to set a default or another available provider
      }
    } else {
      logger.warn(`Provider ${providerName} not found for unregistration.`);
    }
  }

  public async setActiveProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (provider) {
      const health = await provider.checkHealth();
      if (health.available) {
        this.activeProviderName = providerName;
        logger.info(`Active LLM provider set to: ${providerName}`);
        return true;
      } else {
        logger.warn(`Provider ${providerName} is not available (Health: ${health.error || 'N/A'}). Cannot set as active.`);
        if (this.activeProviderName === providerName) {
          this.activeProviderName = null;
          logger.warn(`Cleared active LLM provider as ${providerName} became unavailable.`);
        }
        return false;
      }
    } else {
      logger.warn(`LLM provider "${providerName}" not found or not registered.`);
      // Attempt to set the first available provider if current selection fails
      if (this.providers.size > 0) {
          for (const [name, prov] of this.providers) {
              const health = await prov.checkHealth();
              if (health.available) {
                  this.activeProviderName = name;
                  logger.info(`Fell back to active LLM provider: ${name}`);
                  return true;
              }
          }
      }
      this.activeProviderName = null; // Ensure no active provider if none are available
      logger.error('No LLM providers available or registered.');
      return false;
    }
  }

  public getActiveProvider(): LLMProvider | null {
    if (!this.activeProviderName) return null;
    return this.providers.get(this.activeProviderName) || null;
  }

  public getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  public listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  private determineProvider(requestProvider?: string): LLMProvider | null {
    if (requestProvider) {
      const provider = this.providers.get(requestProvider);
      if (provider) return provider;
      logger.warn(`Requested provider "${requestProvider}" not found or not available. Falling back to active provider.`);
    }
    return this.getActiveProvider();
  }

  public async process(request: LLMRequest): Promise<ModelResponse> {
    // Rate Limiting
    // Using a generic identifier; in a real app, this might be user ID or IP
    const clientId = 'global_client'; // Or derive from request if possible
    if (!this.rateLimiter.isAllowed(clientId)) {
        logger.warn(`Rate limit exceeded for process request. Client ID: ${clientId}`);
        return { success: false, error: 'Rate limit exceeded. Please try again later.' };
    }

    const provider = this.determineProvider(request.provider);
    if (!provider) {
      return { success: false, error: sanitizeError('No suitable LLM provider available for the request.') };
    }

    const modelId = request.model || this.llmConfig.model; // Use request model or default
    const health = await provider.checkHealth();
    if (!health.available) {
        const errorMessage = `Provider ${provider.providerName} is not available. Health: ${health.error}`;
        logger.warn(errorMessage);
        return { success: false, error: sanitizeError(errorMessage, 'Provider unavailable') };
    }

    // Sanitize input
    let sanitizedInput = request.input;
    if (typeof request.input === 'string') {
      sanitizedInput = sanitizeInput(request.input);
    } else if (Array.isArray(request.input)) {
      sanitizedInput = request.input.map(msg => ({
        ...msg,
        content: sanitizeInput(msg.content),
      }));
    }

    const sanitizedRequest = { ...request, input: sanitizedInput };

    try {
      let response: ModelResponse;
      switch (sanitizedRequest.type) {
        case 'generate':
          if (typeof sanitizedRequest.input !== 'string') {
            return { success: false, error: sanitizeError('Invalid input type for generate request. Expected string.') };
          }
          if (!provider.generate) {
            return { success: false, error: sanitizeError(`Provider ${provider.providerName} does not support 'generate'.`) };
          }
          response = await provider.generate(sanitizedRequest.input, sanitizedRequest.options as GenerationOptions, modelId);
          break;
        case 'chat':
          if (!Array.isArray(sanitizedRequest.input)) {
            return { success: false, error: sanitizeError('Invalid input type for chat request. Expected ChatMessage[].') };
          }
           if (!provider.chat) {
            return { success: false, error: sanitizeError(`Provider ${provider.providerName} does not support 'chat'.`) };
          }
          response = await provider.chat(sanitizedRequest.input as ChatMessage[], sanitizedRequest.options as CompletionOptions, modelId);
          break;
        case 'embed':
          // TODO: Implement embedding support
          return { success: false, error: sanitizeError('Embedding not yet implemented.') };
        default:
          return { success: false, error: sanitizeError(`Unsupported request type: ${(sanitizedRequest as any).type}`) };
      }
      // Sanitize response
      if (response.content) {
        response.content = sanitizeOutput(response.content);
      }
      if (response.error) {
        response.error = sanitizeError(response.error, 'LLM provider error');
      }
      if (response.messages) {
        response.messages = response.messages.map(msg => ({ ...msg, content: sanitizeOutput(msg.content)}));
      }
      return response;

    } catch (error: any) {
      logger.error(`Error processing LLM request with ${provider.providerName} for model ${modelId}: ${error.message}`, {
        // Avoid logging potentially sensitive full request in production if not already redacted by provider
        requestType: request.type,
        modelIdUsed: modelId,
        providerName: provider.providerName,
      });
      return { success: false, error: sanitizeError(error.message, 'LLM processing error'), modelId };
    }
  }

  public async * streamResponse(request: LLMRequest): AsyncIterableIterator<string | ChatMessage | ModelResponse> {
    // Rate Limiting
    const clientId = 'global_client_stream'; // Or derive from request
    if (!this.rateLimiter.isAllowed(clientId)) {
        logger.warn(`Rate limit exceeded for stream request. Client ID: ${clientId}`);
        yield { success: false, error: 'Rate limit exceeded. Please try again later.' } as ModelResponse;
        return;
    }

    const provider = this.determineProvider(request.provider);
    if (!provider) {
      yield { success: false, error: sanitizeError('No suitable LLM provider available for streaming.') } as ModelResponse;
      return;
    }

    const modelId = request.model || this.llmConfig.model;
    const health = await provider.checkHealth();
    if (!health.available) {
        const errorMessage = `Provider ${provider.providerName} is not available for streaming. Health: ${health.error}`;
        logger.warn(errorMessage);
        yield { success: false, error: sanitizeError(errorMessage, 'Provider unavailable for streaming') } as ModelResponse;
        return;
    }

    // Sanitize input for streaming
    let sanitizedInput = request.input;
    if (typeof request.input === 'string') {
      sanitizedInput = sanitizeInput(request.input);
    } else if (Array.isArray(request.input)) {
      sanitizedInput = request.input.map(msg => ({
        ...msg,
        content: sanitizeInput(msg.content),
      }));
    }
    const sanitizedRequest = { ...request, input: sanitizedInput };


    try {
      let streamIterator: AsyncIterableIterator<string | ChatMessage | ModelResponse>;

      switch (sanitizedRequest.type) {
        case 'generate':
          if (typeof sanitizedRequest.input !== 'string') {
            yield { success: false, error: sanitizeError('Invalid input type for stream generate request.') } as ModelResponse; return;
          }
          if (!provider.streamGenerate) {
            yield { success: false, error: sanitizeError(`Provider ${provider.providerName} does not support 'streamGenerate'.`) } as ModelResponse; return;
          }
          streamIterator = provider.streamGenerate(sanitizedRequest.input, sanitizedRequest.options as GenerationOptions, modelId);
          break;
        case 'chat':
          if (!Array.isArray(sanitizedRequest.input)) {
            yield { success: false, error: sanitizeError('Invalid input type for stream chat request.') } as ModelResponse; return;
          }
          if (!provider.streamChat) {
            yield { success: false, error: sanitizeError(`Provider ${provider.providerName} does not support 'streamChat'.`) } as ModelResponse; return;
          }
          streamIterator = provider.streamChat(sanitizedRequest.input as ChatMessage[], sanitizedRequest.options as CompletionOptions, modelId);
          break;
        default:
          yield { success: false, error: sanitizeError(`Unsupported stream request type: ${(sanitizedRequest as any).type}`) } as ModelResponse;
          return;
      }

      for await (const chunk of streamIterator) {
        if (typeof chunk === 'string') {
          yield sanitizeOutput(chunk);
        } else if ('role' in chunk && 'content' in chunk) { // ChatMessage
          yield { ...chunk, content: chunk.content ? sanitizeOutput(chunk.content) : '' } as ChatMessage;
        } else { // ModelResponse (likely the final one or an error)
          const modelResponseChunk = chunk as ModelResponse;
          if (modelResponseChunk.content) {
            modelResponseChunk.content = sanitizeOutput(modelResponseChunk.content);
          }
          if (modelResponseChunk.error) {
            modelResponseChunk.error = sanitizeError(modelResponseChunk.error, 'LLM stream provider error');
          }
          if (modelResponseChunk.messages) {
            modelResponseChunk.messages = modelResponseChunk.messages.map(msg => ({ ...msg, content: sanitizeOutput(msg.content)}));
          }
          yield modelResponseChunk;
        }
      }

    } catch (error: any) {
      logger.error(`Error streaming LLM response with ${provider.providerName} for model ${modelId}: ${error.message}`, {
         requestType: request.type,
         modelIdUsed: modelId,
         providerName: provider.providerName,
      });
      yield { success: false, error: sanitizeError(error.message, 'LLM streaming error'), modelId } as ModelResponse;
    }
  }

  // Delegated to ModelManager or directly to provider if ModelManager is not used
  public async listModels(providerName?: string): Promise<LLMModel[]> {
    // if (this.modelManager) return this.modelManager.listAvailableModels(providerName);
    const provider = providerName ? this.providers.get(providerName) : this.getActiveProvider();
    if (provider) {
      return provider.listModels();
    }
    logger.warn(`No active or specified provider to list models from. Provider: ${providerName}`);
    return [];
  }

  public async getModel(modelIdWithProvider: string): Promise<LLMModel | undefined> {
    // if (this.modelManager) return this.modelManager.getModelMetadata(modelIdWithProvider);
    const [providerName, modelId] = modelIdWithProvider.includes('/')
      ? modelIdWithProvider.split('/') as [string, string]
      : [this.activeProviderName || '', modelIdWithProvider];

    const provider = this.providers.get(providerName);
    if (provider) {
      return provider.getModel(modelId);
    }
    logger.warn(`Provider ${providerName} not found for model ${modelId}.`);
    return undefined;
  }

   public async getActiveProviderHealth(): Promise<HealthStatus | null> {
    const provider = this.getActiveProvider();
    if (provider) {
        return provider.checkHealth();
    }
    return null;
  }

  public async getProviderHealth(providerName: string): Promise<HealthStatus | null> {
    const provider = this.providers.get(providerName);
    if (provider) {
        return provider.checkHealth();
    }
    logger.warn(`Provider ${providerName} not found for health check.`);
    return null;
  }
}

// Singleton instance
let llmServiceInstance: LlmService | null = null;

export function getLlmService(): LlmService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LlmService();
  }
  return llmServiceInstance;
}
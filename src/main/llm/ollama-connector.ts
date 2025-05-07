import {
  LLMProvider,
  LLMModel,
  ChatMessage,
  CompletionOptions,
  ModelResponse,
  GenerationOptions,
  HealthStatus,
  ModelMetadata,
} from '../../shared/types/llm';
import { configManager } from '../services/config-manager';
import logger from '../services/logger';
import { LLMConfig } from '../../shared/types/config';
// Using global AbortController, available in Node.js v15+
// import { AbortController } from 'node-abort-controller'; // For request timeout

const PROVIDER_NAME = 'ollama';
const DEFAULT_OLLAMA_HOST = 'https://localhost:11434';
const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

interface OllamaTag {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  };
}

// For streaming responses
interface OllamaStreamResponseChunk {
  model: string;
  created_at: string;
  response?: string; // For /api/generate
  message?: ChatMessage; // For /api/chat
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  context?: number[];
}


export class OllamaConnector implements LLMProvider {
  readonly providerName = PROVIDER_NAME;
  private host: string;
  private currentLlmConfig: LLMConfig;
  private requestTimeout: number;
  private maxRetries: number;
  private retryDelay: number;

  private lastHealthStatus: HealthStatus = { available: false };
  private healthCheckIntervalId: NodeJS.Timeout | null = null;
  private isInitializing = false;


  constructor() {
    this.currentLlmConfig = configManager.get<LLMConfig>('llm');
    this.host = this.ensureHttps(this.currentLlmConfig.ollamaHost || DEFAULT_OLLAMA_HOST);
    this.requestTimeout = this.currentLlmConfig.ollamaRequestTimeout || DEFAULT_REQUEST_TIMEOUT;
    this.maxRetries = this.currentLlmConfig.ollamaMaxRetries || DEFAULT_MAX_RETRIES;
    this.retryDelay = this.currentLlmConfig.ollamaRetryDelay || DEFAULT_RETRY_DELAY;

    this.initialize();

    configManager.onChange('llm', (change) => {
      const newLlmConfig = change.newValue as LLMConfig;
      if (newLlmConfig.provider === this.providerName) {
        let configChanged = false;
        const newHostRaw = newLlmConfig.ollamaHost || DEFAULT_OLLAMA_HOST;
        const newHost = this.ensureHttps(newHostRaw);
        if (this.host !== newHost) {
          this.host = newHost;
          logger.info(`OllamaConnector host updated to: ${this.host}`);
          configChanged = true;
        }
        if (this.currentLlmConfig.model !== newLlmConfig.model) {
          logger.info(`OllamaConnector default model updated to: ${newLlmConfig.model}`);
          // No need to re-initialize for model change, but good to log
        }
        if (this.requestTimeout !== (newLlmConfig.ollamaRequestTimeout || DEFAULT_REQUEST_TIMEOUT)) {
            this.requestTimeout = newLlmConfig.ollamaRequestTimeout || DEFAULT_REQUEST_TIMEOUT;
            logger.info(`OllamaConnector requestTimeout updated to: ${this.requestTimeout}ms`);
            configChanged = true;
        }
        if (this.maxRetries !== (newLlmConfig.ollamaMaxRetries || DEFAULT_MAX_RETRIES)) {
            this.maxRetries = newLlmConfig.ollamaMaxRetries || DEFAULT_MAX_RETRIES;
            logger.info(`OllamaConnector maxRetries updated to: ${this.maxRetries}`);
            configChanged = true;
        }
        if (this.retryDelay !== (newLlmConfig.ollamaRetryDelay || DEFAULT_RETRY_DELAY)) {
            this.retryDelay = newLlmConfig.ollamaRetryDelay || DEFAULT_RETRY_DELAY;
            logger.info(`OllamaConnector retryDelay updated to: ${this.retryDelay}ms`);
            configChanged = true;
        }

        this.currentLlmConfig = newLlmConfig;
        if (configChanged && !this.isInitializing) {
          logger.info('OllamaConnector configuration changed, re-initializing...');
          this.initialize(); // Re-initialize if host or connection params change
        }
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitializing) {
        logger.debug('OllamaConnector initialization already in progress.');
        return;
    }
    this.isInitializing = true;
    logger.info(`OllamaConnector initializing. Host: ${this.host}, Default Model: ${this.currentLlmConfig.model}`);

    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }

    await this.checkHealth(); // Perform initial health check

    this.healthCheckIntervalId = setInterval(async () => {
      await this.checkHealth();
    }, HEALTH_CHECK_INTERVAL);
    this.isInitializing = false;
  }

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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private sanitizeError(error: any, context?: string): Error {
    const defaultMessage = `An error occurred with the Ollama provider${context ? ` during ${context}` : ''}.`;
    if (process.env.NODE_ENV === 'production') {
        logger.error(`Ollama Error (Prod): ${context || 'General'} - ${error.message}`, { stack: error.stack });
        return new Error(defaultMessage);
    }
    // In development, pass through more details but still log
    logger.error(`Ollama Error (Dev): ${context || 'General'} - ${error.message}`, { originalError: error });
    return new Error(error.message || defaultMessage);
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    stream = false,
    attempt = 1
  ): Promise<T> {
    const url = `${this.host}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    // Basic input validation for body
    if (body) {
        if (typeof body.prompt === 'string' && body.prompt.length > (this.currentLlmConfig.maxInputLength || 100000)) {
            logger.error('Ollama request prompt exceeds maximum length.');
            throw this.sanitizeError(new Error('Input prompt too long.'), 'request validation');
        }
        if (Array.isArray(body.messages)) {
            for (const msg of body.messages) {
                if (typeof msg.content === 'string' && msg.content.length > (this.currentLlmConfig.maxInputLength || 100000)) {
                    logger.error('Ollama request message content exceeds maximum length.');
                    throw this.sanitizeError(new Error('Input message content too long.'), 'request validation');
                }
            }
        }
    }


    logger.debug(`Ollama request (Attempt ${attempt}/${this.maxRetries}): ${method} ${url}`, body ? { ...body, model: body.model ? '***' : undefined, prompt: body.prompt ? '***' : undefined, messages: body.messages ? '[***]' : undefined } : undefined);

    try {
      const { default: fetch } = await import('node-fetch');
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal as any, // Type assertion for AbortSignal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        // Log detailed error internally
        logger.error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
        // Throw a sanitized error for the caller
        throw new Error(`Ollama API request failed with status ${response.status}`);
      }
      if (stream) {
        return response.body as unknown as T; // Return the stream body directly
      }
      return response.json() as Promise<T>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      logger.error(`Failed to connect to Ollama at ${url} (Attempt ${attempt}/${this.maxRetries}): ${error.message}`);
      if (attempt < this.maxRetries && error.name !== 'AbortError' /* Don't retry on explicit timeout/abort */) {
        await this.sleep(this.retryDelay * Math.pow(2, attempt -1)); // Exponential backoff
        return this.makeRequest(endpoint, method, body, stream, attempt + 1);
      }
      this.lastHealthStatus = { available: false, error: error.message }; // Log original error for health status
      throw this.sanitizeError(error, `making request to ${endpoint}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    // Prefer using the more detailed health status if available
    if (this.lastHealthStatus && this.lastHealthStatus.timestamp && Date.now() - this.lastHealthStatus.timestamp < HEALTH_CHECK_INTERVAL / 2) {
        return this.lastHealthStatus.available;
    }
    // Fallback to a quick check if health status is stale or unavailable
    const status = await this.checkHealth();
    return status.available;
  }

  async checkHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    try {
      // A lightweight endpoint like / should be quick. /api/tags also works.
      // Using GET / to check basic connectivity and latency.
      const { default: fetch } = await import('node-fetch');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), (this.requestTimeout || DEFAULT_REQUEST_TIMEOUT) / 2); // Shorter timeout for health check

      const response = await fetch(this.host, { signal: controller.signal as any });
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      if (response.ok) {
        // Optionally, get model count if a lightweight way exists or combine with listModels
        let modelCount = this.lastHealthStatus.modelCount; // Keep previous if current check doesn't get it
        try {
            const models = await this.makeRequest<{ models: OllamaTag[] }>('/api/tags', 'GET', undefined, false, 1); // Use makeRequest for retries
            modelCount = models.models.length;
        } catch (modelError: any) {
            logger.warn('Could not fetch model count during health check:', modelError.message);
        }

        this.lastHealthStatus = { available: true, latency, modelCount, timestamp: Date.now() };
        logger.info(`Ollama health check OK: Latency ${latency}ms, Models: ${modelCount ?? 'N/A'}`);
      } else {
        const errorText = await response.text();
        this.lastHealthStatus = { available: false, error: `Health check failed: ${response.status} ${errorText}`, latency, timestamp: Date.now() };
        logger.warn(`Ollama health check FAILED: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.lastHealthStatus = { available: false, error: error.message, latency, timestamp: Date.now() };
      logger.warn(`Ollama health check FAILED: ${error.message}`);
    }
    return this.lastHealthStatus;
  }

  async reconnect(): Promise<boolean> {
    logger.info('Attempting to reconnect to Ollama...');
    await this.initialize(); // Re-run initialization which includes a health check
    return this.lastHealthStatus.available;
  }


  private mapOllamaTagToLLMModel(tag: OllamaTag): LLMModel {
    return {
      id: tag.name,
      name: tag.name, // User-friendly name, same as ID for Ollama
      provider: this.providerName,
      description: `Family: ${tag.details.family}, Format: ${tag.details.format}, Params: ${tag.details.parameter_size}, Quant: ${tag.details.quantization_level}`,
      type: 'chat', // Assuming all Ollama models can be used for chat by default
      capabilities: ['chat', 'generate'], // Common capabilities
      parameters: tag.details.parameter_size,
      contextSize: this.currentLlmConfig.contextSize, // Default, Ollama API doesn't expose this per model easily
      quantization: tag.details.quantization_level,
      format: tag.details.format,
      family: tag.details.family,
    };
  }

  async listModels(): Promise<LLMModel[]> {
    if (!await this.isAvailable()) return [];
    try {
      const response = await this.makeRequest<{ models: OllamaTag[] }>('/api/tags');
      return response.models.map(tag => this.mapOllamaTagToLLMModel(tag));
    } catch (error) {
      logger.error('Failed to list Ollama models:', (error as Error).message);
      return [];
    }
  }

  async getModel(modelId: string): Promise<LLMModel | undefined> {
    if (!await this.isAvailable()) return undefined;
    try {
      const response = await this.makeRequest<OllamaTag>(`/api/show`, 'POST', { name: modelId });
      if (response && response.details) {
        return this.mapOllamaTagToLLMModel(response);
      }
      logger.warn(`Model ${modelId} not found or details incomplete via Ollama API.`);
      return undefined;
    } catch (error: any) {
      logger.error(`Failed to get model ${modelId} from Ollama:`, error.message);
      return undefined;
    }
  }

  private mapOptionsToOllama(options?: GenerationOptions | CompletionOptions): any {
    const ollamaOptions: any = {};
    if (!options) return ollamaOptions;

    if (options.temperature !== undefined) ollamaOptions.temperature = options.temperature;
    if (options.maxTokens !== undefined) ollamaOptions.num_predict = options.maxTokens;
    if (options.stopSequences !== undefined) ollamaOptions.stop = options.stopSequences;
    if (options.topK !== undefined) ollamaOptions.top_k = options.topK;
    if (options.topP !== undefined) ollamaOptions.top_p = options.topP;
    // Add other common mappings:
    // Mirostat, MirostatEta, MirostatTau, NumCtx, NumGQA, NumGPU, RepeatLastN, RepeatPenalty, Seed, TfsZ, TypicalP
    if (options.customProviderOptions) {
        Object.assign(ollamaOptions, options.customProviderOptions);
    }
    return ollamaOptions;
  }

  async generate(prompt: string, options?: GenerationOptions, modelId?: string): Promise<ModelResponse> {
    if (!await this.isAvailable()) {
      return { success: false, error: "Ollama provider not available." };
    }
    // Input validation
    if (typeof prompt !== 'string' || prompt.trim() === '') {
        logger.error('Invalid prompt provided for Ollama generation.');
        return { success: false, error: "Invalid input: Prompt cannot be empty." };
    }
    if (prompt.length > (this.currentLlmConfig.maxInputLength || 100000)) {
        logger.error('Prompt exceeds maximum length for Ollama generation.');
        return { success: false, error: `Invalid input: Prompt exceeds maximum length of ${this.currentLlmConfig.maxInputLength || 100000} characters.` };
    }

    const modelToUse = modelId || this.currentLlmConfig.model;
    logger.info(`Generating text with Ollama model: ${modelToUse}`);

    try {
      const requestBody: any = {
        model: modelToUse,
        prompt,
        stream: false,
        options: this.mapOptionsToOllama(options)
      };

      const data = await this.makeRequest<OllamaStreamResponseChunk>('/api/generate', 'POST', requestBody);
      return {
        success: true,
        content: data.response,
        modelId: data.model,
        usage: {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        }
      };
    } catch (error: any) {
      // Error is already sanitized by makeRequest
      logger.error(`Error during Ollama generation: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions, modelId?: string): Promise<ModelResponse> {
    if (!await this.isAvailable()) {
      return { success: false, error: "Ollama provider not available." };
    }
    // Input validation
    if (!Array.isArray(messages) || messages.length === 0) {
        logger.error('Invalid messages array provided for Ollama chat.');
        return { success: false, error: "Invalid input: Messages array cannot be empty." };
    }
    for (const message of messages) {
        if (typeof message.role !== 'string' || !['system', 'user', 'assistant'].includes(message.role)) {
            logger.error(`Invalid message role: ${message.role}`);
            return { success: false, error: `Invalid input: Message role must be 'system', 'user', or 'assistant'.` };
        }
        if (typeof message.content !== 'string' || message.content.trim() === '') {
            logger.error('Invalid message content: cannot be empty.');
            return { success: false, error: "Invalid input: Message content cannot be empty." };
        }
        if (message.content.length > (this.currentLlmConfig.maxInputLength || 100000)) {
            logger.error('Message content exceeds maximum length for Ollama chat.');
            return { success: false, error: `Invalid input: Message content exceeds maximum length of ${this.currentLlmConfig.maxInputLength || 100000} characters.` };
        }
    }

    const modelToUse = modelId || this.currentLlmConfig.model;
    logger.info(`Initiating chat with Ollama model: ${modelToUse}`);

    try {
      const requestBody: any = {
        model: modelToUse,
        messages,
        stream: false,
        options: this.mapOptionsToOllama(options)
      };

      const data = await this.makeRequest<OllamaStreamResponseChunk>('/api/chat', 'POST', requestBody);
      return {
        success: true,
        content: data.message?.content,
        role: data.message?.role,
        modelId: data.model,
        usage: {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        }
      };
    } catch (error: any) {
      // Error is already sanitized by makeRequest
      logger.error(`Error during Ollama chat: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async * streamGenerate(prompt: string, options?: GenerationOptions, modelId?: string): AsyncIterableIterator<string | ModelResponse> {
    if (!await this.isAvailable()) {
      yield { success: false, error: "Ollama provider not available." } as ModelResponse;
      return;
    }
     // Input validation
    if (typeof prompt !== 'string' || prompt.trim() === '') {
        logger.error('Invalid prompt provided for Ollama stream generation.');
        yield { success: false, error: "Invalid input: Prompt cannot be empty." } as ModelResponse;
        return;
    }
    if (prompt.length > (this.currentLlmConfig.maxInputLength || 100000)) {
        logger.error('Prompt exceeds maximum length for Ollama stream generation.');
        yield { success: false, error: `Invalid input: Prompt exceeds maximum length of ${this.currentLlmConfig.maxInputLength || 100000} characters.` } as ModelResponse;
        return;
    }

    const modelToUse = modelId || this.currentLlmConfig.model;
    logger.info(`Streaming generation with Ollama model: ${modelToUse}`);

    const requestBody: any = {
      model: modelToUse,
      prompt,
      stream: true,
      options: this.mapOptionsToOllama(options)
    };

    let stream;
    try {
      stream = await this.makeRequest<NodeJS.ReadableStream>('/api/generate', 'POST', requestBody, true);
    } catch (error: any) {
      // Error is already sanitized by makeRequest
      logger.error(`Error starting Ollama stream generation: ${error.message}`);
      yield { success: false, error: error.message } as ModelResponse;
      return;
    }

    let accumulatedResponse = '';
    let finalChunk: OllamaStreamResponseChunk | null = null;

    try {
      for await (const chunk of stream) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as OllamaStreamResponseChunk;
            if (parsed.response) {
              yield parsed.response;
              accumulatedResponse += parsed.response;
            }
            if (parsed.done) {
              finalChunk = parsed;
              break; // Exit inner loop once done
            }
          } catch (parseError: any) {
            logger.warn(`Error parsing Ollama stream chunk: ${parseError.message}. Chunk: "${line}"`);
            // Potentially yield an error object or skip, depending on desired strictness
          }
        }
        if (finalChunk?.done) break; // Exit outer loop if done
      }

      if (finalChunk) {
        yield {
          success: true,
          content: accumulatedResponse, // Full accumulated content
          modelId: finalChunk.model,
          usage: {
            promptTokens: finalChunk.prompt_eval_count,
            completionTokens: finalChunk.eval_count,
            totalTokens: (finalChunk.prompt_eval_count || 0) + (finalChunk.eval_count || 0),
          },
          // Include other final metrics if needed
        } as ModelResponse;
      } else {
         // Should not happen if stream ends correctly, but as a fallback
        logger.warn('Ollama stream ended without a final "done" event.');
        yield { success: false, error: 'Stream ended prematurely or without a final status.' } as ModelResponse;
      }
    } catch (streamError: any) {
      logger.error(`Error during Ollama stream generation: ${streamError.message}`);
      yield { success: false, error: this.sanitizeError(streamError, 'streaming generation').message } as ModelResponse;
    }
  }

  async * streamChat(messages: ChatMessage[], options?: CompletionOptions, modelId?: string): AsyncIterableIterator<ChatMessage | ModelResponse> {
    if (!await this.isAvailable()) {
      yield { success: false, error: "Ollama provider not available." } as ModelResponse;
      return;
    }
    // Input validation
    if (!Array.isArray(messages) || messages.length === 0) {
        logger.error('Invalid messages array provided for Ollama stream chat.');
        yield { success: false, error: "Invalid input: Messages array cannot be empty." } as ModelResponse;
        return;
    }
    for (const message of messages) {
        if (typeof message.role !== 'string' || !['system', 'user', 'assistant'].includes(message.role)) {
            logger.error(`Invalid message role: ${message.role}`);
            yield { success: false, error: `Invalid input: Message role must be 'system', 'user', or 'assistant'.` } as ModelResponse;
            return;
        }
        if (typeof message.content !== 'string' || message.content.trim() === '') {
            logger.error('Invalid message content: cannot be empty for stream chat.');
            yield { success: false, error: "Invalid input: Message content cannot be empty." } as ModelResponse;
            return;
        }
         if (message.content.length > (this.currentLlmConfig.maxInputLength || 100000)) {
            logger.error('Message content exceeds maximum length for Ollama stream chat.');
            yield { success: false, error: `Invalid input: Message content exceeds maximum length of ${this.currentLlmConfig.maxInputLength || 100000} characters.` } as ModelResponse;
            return;
        }
    }

    const modelToUse = modelId || this.currentLlmConfig.model;
    logger.info(`Streaming chat with Ollama model: ${modelToUse}`);

    const requestBody: any = {
      model: modelToUse,
      messages,
      stream: true,
      options: this.mapOptionsToOllama(options)
    };

    let stream;
    try {
      stream = await this.makeRequest<NodeJS.ReadableStream>('/api/chat', 'POST', requestBody, true);
    } catch (error: any) {
      // Error is already sanitized by makeRequest
      logger.error(`Error starting Ollama stream chat: ${error.message}`);
      yield { success: false, error: error.message } as ModelResponse;
      return;
    }

    let finalChunk: OllamaStreamResponseChunk | null = null;
    let fullResponseMessage: ChatMessage = { role: 'assistant', content: '' };


    try {
      for await (const chunk of stream) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as OllamaStreamResponseChunk;
            if (parsed.message && parsed.message.content) {
              yield parsed.message; // Yield the partial message
              fullResponseMessage.content += parsed.message.content;
              if (parsed.message.role) fullResponseMessage.role = parsed.message.role;
            }
            if (parsed.done) {
              finalChunk = parsed;
              break;
            }
          } catch (parseError: any) {
            logger.warn(`Error parsing Ollama stream chunk: ${parseError.message}. Chunk: "${line}"`);
            // Potentially yield an error object or skip
          }
        }
         if (finalChunk?.done) break;
      }

      if (finalChunk) {
        yield {
          success: true,
          messages: [fullResponseMessage], // Full accumulated message
          content: fullResponseMessage.content, // For convenience if only one message
          role: fullResponseMessage.role,
          modelId: finalChunk.model,
          usage: {
            promptTokens: finalChunk.prompt_eval_count,
            completionTokens: finalChunk.eval_count,
            totalTokens: (finalChunk.prompt_eval_count || 0) + (finalChunk.eval_count || 0),
          }
        } as ModelResponse;
      } else {
        logger.warn('Ollama chat stream ended without a final "done" event.');
        yield { success: false, error: 'Chat stream ended prematurely or without a final status.' } as ModelResponse;
      }
    } catch (streamError: any) {
      logger.error(`Error during Ollama stream chat: ${streamError.message}`);
      yield { success: false, error: streamError.message } as ModelResponse;
    }
  }
}
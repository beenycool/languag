export interface HealthStatus {
  available: boolean;
  latency?: number; // in milliseconds
  modelCount?: number;
  error?: string;
  timestamp?: number; // Added to track freshness of health status
}

export interface LLMProvider {
  readonly providerName: string;
  initialize?(): Promise<void>; // Optional initialization
  isAvailable(): Promise<boolean>; // Basic availability check
  checkHealth(): Promise<HealthStatus>; // Detailed health check
  listModels(): Promise<LLMModel[]>;
  getModel(modelId: string): Promise<LLMModel | undefined>;
  generate(prompt: string, options?: GenerationOptions, modelId?: string): Promise<ModelResponse>;
  chat(messages: ChatMessage[], options?: CompletionOptions, modelId?: string): Promise<ModelResponse>;
  streamGenerate?(prompt: string, options?: GenerationOptions, modelId?: string): AsyncIterableIterator<string | ModelResponse>; // Stream partial content or final response
  streamChat?(messages: ChatMessage[], options?: CompletionOptions, modelId?: string): AsyncIterableIterator<ChatMessage | ModelResponse>; // Stream partial messages or final response
  reconnect?(): Promise<boolean>; // Optional reconnect logic
  // Add methods for embedding etc. as needed
}

export interface ModelMetadata {
  id: string;
  provider: string;
  name?: string; // User-friendly name
  capabilities?: string[]; // e.g., "chat", "generate", "embed"
  parameters?: string; // e.g., "7B", "13B"
  contextSize?: number;
  quantization?: string;
  format?: string; // e.g. "gguf"
  family?: string;
  customOptions?: Record<string, any>;
}

export interface LLMModel extends ModelMetadata {
  // id, provider, name are from ModelMetadata
  description?: string; // Potentially richer than metadata.family + metadata.parameters
  type: 'chat' | 'completion' | 'embedding'; // Or more granular types
  // Other fields from ModelMetadata are already included
}

export interface RequestOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  // Provider-specific options can be added here or in a nested object
  customProviderOptions?: Record<string, any>;
}

export interface LLMRequest {
  type: 'generate' | 'chat' | 'embed';
  input: string | ChatMessage[];
  options?: RequestOptions & GenerationOptions & CompletionOptions; // Combined options
  provider?: string; // Preferred provider
  model?: string; // Preferred model
  stream?: boolean;
  userId?: string; // For tracking/logging/billing
  sessionId?: string; // For conversational context
}


// Duplicate LLMModel interface removed. The one extending ModelMetadata is kept.

export interface CompletionOptions extends RequestOptions {
  // Completion-specific options can be added here
  // For now, it inherits all from RequestOptions
}

export interface GenerationOptions extends RequestOptions {
  // Generation-specific options can be added here
  // For now, it inherits all from RequestOptions
  stream?: boolean; // Common for generation tasks
}

// ModelResponse can be used as a more specific LLMResponse
// For streaming, individual chunks might be strings or partial ChatMessages,
// with a final ModelResponse object indicating completion and full usage stats.
export interface ModelUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ModelResponse {
  success: boolean;
  content?: string; // For text generation or single message chat response
  messages?: ChatMessage[]; // For multi-message chat responses
  role?: 'system' | 'user' | 'assistant'; // If the response is a single message with a role
  modelId?: string; // ID of the model that generated the response
  usage?: ModelUsage;
  error?: string; // Error message if success is false
  // Add any other relevant fields from LLM responses
}


// You might also want a more specific interface for chat messages
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  // Optional: Add name, tool_calls, tool_call_id for more advanced scenarios
}

// For LLM Caching
export interface CacheKey {
  inputHash: string; // Hash of the input (prompt or messages)
  options: Partial<RequestOptions>; // Relevant request options
  model: string; // Model ID
  provider: string; // Provider name
  // Potentially add userId or other context if cache is user-specific
}

export interface CachedResponse {
  response: ModelResponse; // The cached LLM response
  createdAt: number; // Timestamp of when the cache entry was created
  lastAccessed: number; // Timestamp of last access
  ttl: number; // TTL for this specific entry
  // Semantic information if used
  embedding?: number[]; // Embedding of the input for semantic search
}
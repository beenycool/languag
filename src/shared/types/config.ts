// Based on specs/core/configuration.md

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  filePath?: string; // Optional, logs to console if not set
}

export interface EngineConfig {
  maxConcurrentTasks: number;
  streamingEnabled: boolean;
  // logLevel moved to LoggingConfig
  // Add other engine-specific settings as needed
}

export interface LLMConfig {
  provider: string; // e.g., "ollama", "openai"
  model: string;
  contextSize: number;
  temperature: number;
  ollamaHost?: string; // Added for ollama-connector
  ollamaRequestTimeout?: number; // in milliseconds
  ollamaMaxRetries?: number;
  ollamaRetryDelay?: number; // in milliseconds
  maxInputLength?: number; // Max input length for prompts/messages
  rateLimit?: { // Added for LlmService rate limiting
    maxRequests: number;
    intervalMs: number;
  };
  // Add other LLM-specific settings as needed
}

export interface PipelineConfig {
  stages: string[];
  batchSize: number;
  timeout: number; // in milliseconds
  // Add other pipeline-specific settings as needed
}

export interface ResourceConfig {
  memory: {
    maxHeapMB: number;
    gcThresholdMB: number;
    modelMemoryMB: number;
  };
  compute: {
    maxThreads: number;
    priorityLevels: number[];
  };
  storage: {
    cacheDirPath: string;
    maxCacheSizeMB: number;
    retentionDays: number;
  };
}

export interface PersistenceConfig {
  storageType: 'file' | 'sqlite';
  location: string; // file path or database connection string
  backupEnabled: boolean;
  autoSaveIntervalMs: number;
}

export interface AnalysisEngineSpecificConfig {
  enabled: boolean;
  // Add any engine-specific config options here, e.g.:
  // sensitivity?: 'low' | 'medium' | 'high';
}

export interface AnalysisConfig {
  engines?: {
    grammar?: AnalysisEngineSpecificConfig;
    style?: AnalysisEngineSpecificConfig;
    // Add other engines here, e.g.:
    // sentiment?: AnalysisEngineSpecificConfig;
  };
  textProcessor?: {
    maxInputSize?: number;
  };
  featureExtractor?: {
    maxSegmentSize?: number;
    maxKeywordsInputLength?: number;
    sanitizeKeywords?: boolean;
  };
  maxSegmentsToProcess?: number;
  // Add other global analysis settings if needed
}

export interface AppConfig { // Renamed from SystemConfig
  version: string;
  logging: LoggingConfig; // Added logging config
  engine: EngineConfig;
  llm: LLMConfig;
  pipeline: PipelineConfig;
  resources: ResourceConfig;
  persistence: PersistenceConfig;
  analysis?: AnalysisConfig; // Added AnalysisConfig
  llmCache?: LLMCacheConfig; // Added for LLM-specific caching
  // Add other system-wide settings as needed
}

export interface LLMCacheConfig {
  maxSizeMB: number; // Max size of the cache in megabytes
  defaultTTL: number; // Default time-to-live for cache entries in milliseconds
  maxTTLMs?: number; // Optional: Maximum allowable TTL for an entry
  semanticThreshold: number; // Similarity threshold for semantic deduplication (0-1)
  encryption?: {
    enabled: boolean;
    key: string; // IMPORTANT: In a real app, this should be from a secure source (env var, secrets manager)
    algorithm?: string; // e.g., 'aes-256-gcm'
    ivLength?: number; // For algorithms like GCM
    authTagLength?: number; // For GCM
  };
  semanticIndexMaxSize?: number; // Optional: Max number of entries in the semantic index
  // Add other cache-specific settings as needed
}

export interface UserPreferences {
  language: string; // e.g., 'en-US', 'fr-FR'
  theme: 'light' | 'dark' | 'system';
  analysis: {
    grammarChecking: boolean;
    spellingChecking: boolean;
    style: 'formal' | 'casual' | 'technical' | 'creative'; // Expanded from spec
  };
  performance: {
    modelQuality: 'fast' | 'balanced' | 'accurate';
    offlineMode: boolean;
  };
  // Add other user-specific preferences as needed
}

// For ConfigurationManager.batch updates
export interface ConfigUpdate {
  key: string;
  value: any;
}

// For ConfigurationManager.validate
export interface ValidationResult {
  path: string;
  isValid: boolean;
  message?: string;
}

// For ConfigurationManager.onChange
export interface ConfigChange {
  path: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

export type ChangeCallback = (change: ConfigChange) => void;

export const DEFAULT_CONFIG: AppConfig = {
  version: "0.1.0", // Initial project version
  logging: {
    level: "info",
    filePath: "logs/app.log" // Default log file path
  },
  engine: {
    maxConcurrentTasks: 3,
    streamingEnabled: true
    // logLevel moved
  },
  llm: {
    provider: "ollama",
    model: "llama2", // Default model, ensure it's available or configurable
    ollamaHost: "http://localhost:11434", // Default Ollama host
    contextSize: 4096,
    temperature: 0.7,
    ollamaRequestTimeout: 30000, // 30 seconds
    ollamaMaxRetries: 3,
    ollamaRetryDelay: 1000, // 1 second
    maxInputLength: 100000, // Default max input length
    rateLimit: { // Default rate limit settings
        maxRequests: 100,
        intervalMs: 60000 // 100 requests per minute
    }
  },
  pipeline: {
    stages: ["tokenize", "pos", "parse", "check"], // Example stages
    batchSize: 100,
    timeout: 5000 // 5 seconds
  },
  resources: {
    memory: {
      maxHeapMB: 8192,
      gcThresholdMB: 6144,
      modelMemoryMB: 4096
    },
    compute: {
      maxThreads: 4, // Adjust based on typical core counts
      priorityLevels: [1, 2, 3]
    },
    storage: {
      cacheDirPath: "./.cache", // App-relative cache path
      maxCacheSizeMB: 1024, // General storage cache size
      retentionDays: 7 // General storage retention
    }
  },
  llmCache: { // Default LLM Cache settings
    maxSizeMB: 256,
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
    maxTTLMs: 7 * 24 * 60 * 60 * 1000, // 7 days max TTL
    semanticThreshold: 0.9,
    encryption: {
      enabled: false, // Default to false for ease of setup, recommend true in production
      key: "default-encryption-key- بایدعوضشود", // Placeholder: MUST BE CHANGED and kept secure
      algorithm: "aes-256-gcm",
      ivLength: 12, // Standard for GCM
      authTagLength: 16 // Standard for GCM
    },
    semanticIndexMaxSize: 10000 // Default max size for semantic index
  },
  analysis: { // Default analysis configuration
    engines: {
      grammar: {
        enabled: true,
      },
      style: {
        enabled: true,
      },
    },
    textProcessor: {
      maxInputSize: 1000000, // Default 1MB
    },
    featureExtractor: {
      maxSegmentSize: 10000, // Default 10k chars
      maxKeywordsInputLength: 5000, // Default 5k chars
      sanitizeKeywords: true,
    },
    maxSegmentsToProcess: 100, // Default 100 segments
  },
  persistence: {
    storageType: "file",
    location: "./app-config.json", // App-relative config file
    backupEnabled: true,
    autoSaveIntervalMs: 60000 // 1 minute
  }
};
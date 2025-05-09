// src/main/analysis/orchestrator.ts

import { AnalysisPipeline } from './pipeline';
import { AnalysisResult, AnalysisPipelineConfig, IAnalysisEngine } from './types';
import { GrammarEngine } from './engines/grammar-engine';
import { StyleEngine } from './engines/style-engine';
// Import other engines as they are created
import { LlmService, getLlmService } from '../services/llm-service';
import appLogger from '../services/logger';
import { ConfigurationManager, configManager } from '../services/config-manager';
import { AppConfig, AnalysisConfig, ConfigChange } from '../../shared/types/config';
import { sanitizeError } from '../../shared/utils/sanitization';
import { RateLimiter } from '../../shared/utils/rate-limiter';

/**
 * The AnalysisOrchestrator is a high-level manager for the analysis process.
 * It initializes the AnalysisPipeline with configured engines and handles
 * requests for text analysis. It can also manage different pipeline configurations.
 */
export class AnalysisOrchestrator {
  private pipeline: AnalysisPipeline;
  private llmService: LlmService;
  private configManager: ConfigurationManager;
  private logger = appLogger.child({ service: 'AnalysisOrchestrator' });
  private configChangeRateLimiter: RateLimiter;
  private unsubscribeConfigChangeListener?: () => void;

  constructor(customLlmService?: LlmService, customConfigManager?: ConfigurationManager) {
    this.llmService = customLlmService || getLlmService();
    this.configManager = customConfigManager || configManager;
    this.configChangeRateLimiter = new RateLimiter(1, 5000); // Allow 1 call per 5 seconds

    const pipelineConfig = this.buildPipelineConfig();
    // Pass logger to AnalysisPipeline constructor
    this.pipeline = new AnalysisPipeline(pipelineConfig, this.logger.child({ component: 'AnalysisPipeline' }));

    this.logger.info('AnalysisOrchestrator initialized.');

    // Listen for changes in analysis configuration
    // Store the unsubscribe function returned by onChange
    this.unsubscribeConfigChangeListener = this.configManager.onChange('analysis', this.handleConfigChange.bind(this));
  }

  /**
   * Builds the AnalysisPipelineConfig based on the current application configuration.
   */
  private buildPipelineConfig(): AnalysisPipelineConfig {
    const appCfg = this.configManager.getFullConfig();
    const analysisCfg = appCfg.analysis || {} as AnalysisConfig; // Get analysis config or default

    const engines: IAnalysisEngine[] = [];

    // Dynamically add engines based on configuration
    // Example: if (analysisCfg.enableGrammarEngine) { ... }
    // For now, let's assume GrammarEngine and StyleEngine are always enabled if available.

    if (analysisCfg.engines?.grammar?.enabled !== false) {
        engines.push(new GrammarEngine(this.llmService, this.logger.child({ engine: 'GrammarEngine' })));
    }
    if (analysisCfg.engines?.style?.enabled !== false) {
        engines.push(new StyleEngine(this.llmService, this.logger.child({ engine: 'StyleEngine' })));
    }
    // Add other engines here based on their configuration
    // e.g., new SentimentEngine(this.llmService, this.logger.child({ engine: 'SentimentEngine' }))

    this.logger.info(`Building pipeline with engines: ${engines.map(e => e.name).join(', ')}`, {
      numEngines: engines.length
    });
    const textProcessorConfig = appCfg.analysis?.textProcessor;
    const featureExtractorConfig = appCfg.analysis?.featureExtractor;
    
    return {
      engines,
      textProcessorConfig: textProcessorConfig ? { maxInputSize: textProcessorConfig.maxInputSize } : undefined,
      featureExtractorConfig: featureExtractorConfig ? {
        maxSegmentSize: featureExtractorConfig.maxSegmentSize,
        maxKeywordsInputLength: featureExtractorConfig.maxKeywordsInputLength,
        sanitizeKeywords: featureExtractorConfig.sanitizeKeywords,
      } : undefined,
      maxSegmentsToProcess: appCfg.analysis?.maxSegmentsToProcess,
    };
  }

  /**
   * Analyzes a given text using the configured AnalysisPipeline.
   *
   * @param rawText The raw text to analyze.
   * @param documentId A unique identifier for the document or text source.
   * @returns A promise that resolves to an array of AnalysisResult objects.
   */
  async analyze(rawText: string, documentId: string): Promise<AnalysisResult[]> {
    this.logger.info(`Orchestrating analysis for document: ${documentId}`);
    try {
      const results = await this.pipeline.analyzeText(rawText, documentId);
      this.logger.info(`Analysis completed for document ${documentId}. ${results.length} results generated.`);
      return results;
    } catch (error: any) {
      const sanitizedErrorMessage = sanitizeError(error.message, `analysis for document ${documentId}`);
      this.logger.error(`Error during analysis orchestration for document ${documentId}: ${error.message}`, { error, documentId });
      // Return an explicit error indication
      return [{
        segmentId: 'orchestration-error',
        engine: 'AnalysisOrchestrator',
        findings: [],
        error: sanitizedErrorMessage,
      }];
    }
  }

  /**
   * Provides access to the underlying pipeline if needed for dynamic management.
   */
  getPipeline(): AnalysisPipeline {
    return this.pipeline;
  }

  /**
   * Gracefully shuts down the orchestrator and its pipeline.
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing AnalysisOrchestrator...');
    if (this.pipeline) {
      await this.pipeline.dispose();
    }
    // Clear any listeners or timers if necessary
    if (this.unsubscribeConfigChangeListener) {
      this.unsubscribeConfigChangeListener(); // Call the stored unsubscribe function
      this.unsubscribeConfigChangeListener = undefined; // Clear it after calling
    }
    this.logger.info('AnalysisOrchestrator disposed.');
  }

  // Bound instance method for the event listener
  private async handleConfigChange(change: ConfigChange): Promise<void> {
    // Use !isAllowed for the check, as isAllowed returns true if the action *is* permitted
    if (!this.configChangeRateLimiter.isAllowed('configUpdate')) {
      this.logger.warn('Pipeline re-initialization skipped due to rate limiting on config changes.');
      return;
    }
    this.logger.info('Analysis configuration changed. Re-initializing pipeline.', { change });

    const oldPipeline = this.pipeline;
    try {
      const newPipelineConfig = this.buildPipelineConfig();
      // Pass logger to AnalysisPipeline constructor
      this.pipeline = new AnalysisPipeline(newPipelineConfig, this.logger.child({ component: 'AnalysisPipeline' }));
      this.logger.info('AnalysisPipeline re-initialized with new configuration.');
      if (oldPipeline) {
        await oldPipeline.dispose();
        this.logger.info('Old pipeline disposed.');
      }
    } catch (error: any) {
      this.logger.error('Failed to re-initialize pipeline after config change:', { error: sanitizeError(error.message), originalError: error });
      if (oldPipeline) {
        this.pipeline = oldPipeline; // Restore old pipeline on failure
        this.logger.info('Restored old pipeline due to re-initialization error.');
      }
    }
  }
}

// Singleton instance for easy access
// Consider if singleton is truly necessary or if dependency injection is preferred.
let orchestratorInstance: AnalysisOrchestrator | null = null;

export function getAnalysisOrchestrator(
  llmService?: LlmService,
  configMgr?: ConfigurationManager
): AnalysisOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AnalysisOrchestrator(llmService, configMgr);
  }
  return orchestratorInstance;
}

export async function disposeAnalysisOrchestrator(): Promise<void> {
  if (orchestratorInstance) {
    await orchestratorInstance.dispose();
    orchestratorInstance = null;
  }
}
// src/main/analysis/utils/metrics.ts

import { AnalysisResult, Finding } from '../types';
import appLogger from '../../services/logger';
import { sanitizeInput } from '../../../shared/utils/sanitization'; // For sanitizing finding types
import * as winston from 'winston';

const logger: winston.Logger = appLogger.child({ utility: 'MetricsCollector' });

export interface EngineMetrics {
  engineName: string;
  totalSegmentsProcessed: number;
  totalFindings: number;
  averageFindingsPerSegment: number;
  errorCount: number;
  // Future: Add timing metrics, e.g., averageProcessingTimeMs
}

export interface OverallMetrics {
  totalDocumentsAnalyzed: number;
  totalSegmentsAnalyzed: number;
  totalResultsGenerated: number;
  totalErrorsAcrossEngines: number;
  findingsByType: Record<string, number>; // e.g., { grammar: 10, style: 5 }
  findingsBySeverity: Record<Finding['severity'], number>; // e.g., { error: 5, warning: 8, info: 2 }
  engineSpecificMetrics: EngineMetrics[];
}

/**
 * A utility class for collecting and calculating metrics from analysis results.
 */
export class MetricsCollector {
  // Store aggregated data instead of full results to manage memory
  private aggregatedFindingsByType: Record<string, number> = {};
  private aggregatedFindingsBySeverity: Record<Finding['severity'], number> = { error: 0, warning: 0, info: 0 };
  private aggregatedTotalErrorsAcrossEngines: number = 0;
  private aggregatedSegmentsProcessed: Set<string> = new Set();
  private aggregatedResultsByEngine: Record<string, {
    segmentIds: Set<string>;
    totalFindings: number;
    errorCount: number;
  }> = {};
  
  private documentCount: number = 0;
  private resultsCount: number = 0; // Keep track of total results added for some metrics

  // Define a predefined set of allowed finding types for security
  private allowedFindingTypes: Set<string>;
  private resetInterval: number | null = null; // Optional interval for automatic reset
  private resetTimer: NodeJS.Timeout | null = null;


  constructor(allowedFindingTypes: string[] = ['grammar', 'style', 'spelling', 'unknown'], autoResetIntervalMs?: number) {
    this.allowedFindingTypes = new Set(allowedFindingTypes);
    logger.info('MetricsCollector initialized.', { allowedFindingTypes: Array.from(this.allowedFindingTypes) });
    if (autoResetIntervalMs && autoResetIntervalMs > 0) {
      this.resetInterval = autoResetIntervalMs;
      this.scheduleAutoReset();
    }
  }

  private scheduleAutoReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    if (this.resetInterval) {
      this.resetTimer = setTimeout(() => {
        logger.info(`Auto-resetting metrics collector after ${this.resetInterval}ms.`);
        this.reset();
        this.scheduleAutoReset(); // Reschedule for next interval
      }, this.resetInterval);
      // Prevent Node.js from exiting if this is the only active timer (for long-running services)
      // this.resetTimer.unref(); // Uncomment if this behavior is desired
    }
  }

  /**
   * Adds a batch of analysis results to the collector, processing them incrementally.
   * @param resultsArray An array of AnalysisResult objects.
   * @param analyzedDocumentIncrement Number of documents these results pertain to (usually 1).
   */
  addResults(resultsArray: AnalysisResult[], analyzedDocumentIncrement: number = 1): void {
    this.documentCount += analyzedDocumentIncrement;
    this.resultsCount += resultsArray.length;

    resultsArray.forEach(result => {
      // Anonymize/strip sensitive data from segmentId if it contains it.
      // For now, assuming segmentId is safe or anonymized upstream.
      // e.g., const sanitizedSegmentId = sanitizeInput(result.segmentId.split('/').pop() || result.segmentId);
      const sanitizedSegmentId = result.segmentId; // Placeholder
      this.aggregatedSegmentsProcessed.add(sanitizedSegmentId);

      if (result.error) {
        this.aggregatedTotalErrorsAcrossEngines++;
      }

      result.findings.forEach(finding => {
        // Sanitize finding.type to ensure it's from a predefined set
        const sanitizedType = this.allowedFindingTypes.has(finding.type) ? finding.type : 'unknown';
        this.aggregatedFindingsByType[sanitizedType] = (this.aggregatedFindingsByType[sanitizedType] || 0) + 1;
        this.aggregatedFindingsBySeverity[finding.severity] = (this.aggregatedFindingsBySeverity[finding.severity] || 0) + 1;
      });

      if (!this.aggregatedResultsByEngine[result.engine]) {
        this.aggregatedResultsByEngine[result.engine] = {
          segmentIds: new Set(),
          totalFindings: 0,
          errorCount: 0,
        };
      }
      const engineMetrics = this.aggregatedResultsByEngine[result.engine];
      engineMetrics.segmentIds.add(sanitizedSegmentId);
      engineMetrics.totalFindings += result.findings.length;
      if (result.error) {
        engineMetrics.errorCount++;
      }
    });
    logger.debug(`Incrementally processed ${resultsArray.length} results. Total results count: ${this.resultsCount}. Document count: ${this.documentCount}`);
  }

  /**
   * Clears all collected aggregated data and resets metrics.
   */
  reset(): void {
    this.aggregatedFindingsByType = {};
    this.aggregatedFindingsBySeverity = { error: 0, warning: 0, info: 0 };
    this.aggregatedTotalErrorsAcrossEngines = 0;
    this.aggregatedSegmentsProcessed = new Set();
    this.aggregatedResultsByEngine = {};
    this.documentCount = 0;
    this.resultsCount = 0;
    logger.info('MetricsCollector reset.');
    // If auto-reset is enabled, it will be rescheduled by the calling context or constructor
  }

  /**
   * Calculates and returns overall metrics based on the collected results.
   */
  calculateMetrics(): OverallMetrics {
    if (this.resultsCount === 0) {
      logger.warn('No results have been added to calculate metrics.');
      return {
        totalDocumentsAnalyzed: this.documentCount,
        totalSegmentsAnalyzed: 0,
        totalResultsGenerated: 0,
        totalErrorsAcrossEngines: 0,
        findingsByType: {},
        findingsBySeverity: { error: 0, warning: 0, info: 0 },
        engineSpecificMetrics: [],
      };
    }

    const engineSpecificMetrics: EngineMetrics[] = Object.entries(this.aggregatedResultsByEngine).map(([engineName, data]) => {
      return {
        engineName,
        totalSegmentsProcessed: data.segmentIds.size,
        totalFindings: data.totalFindings,
        averageFindingsPerSegment: data.segmentIds.size > 0 ? data.totalFindings / data.segmentIds.size : 0,
        errorCount: data.errorCount,
      };
    });

    const metrics: OverallMetrics = {
      totalDocumentsAnalyzed: this.documentCount,
      totalSegmentsAnalyzed: this.aggregatedSegmentsProcessed.size,
      totalResultsGenerated: this.resultsCount,
      totalErrorsAcrossEngines: this.aggregatedTotalErrorsAcrossEngines,
      findingsByType: { ...this.aggregatedFindingsByType }, // Return a copy
      findingsBySeverity: { ...this.aggregatedFindingsBySeverity }, // Return a copy
      engineSpecificMetrics,
    };

    logger.info('Metrics calculated successfully.', {
      documents: metrics.totalDocumentsAnalyzed,
      segments: metrics.totalSegmentsAnalyzed,
      results: metrics.totalResultsGenerated
    });
    return metrics;
  }

  /**
   * Stops any scheduled auto-reset timers.
   * Call this when the MetricsCollector is no longer needed, to allow Node.js to exit if it's the only timer.
   */
  dispose(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
      logger.info('MetricsCollector auto-reset timer cleared.');
    }
  }
}
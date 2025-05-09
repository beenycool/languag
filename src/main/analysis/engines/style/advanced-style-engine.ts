// src/main/analysis/engines/style/advanced-style-engine.ts

/**
 * @file Advanced style analysis engine.
 */

import { ContextAwareEngine } from '../context-aware-engine';
import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { AnalysisResult, ExtractedFeatures, Finding } from '../../types';
import { LlmService } from '../../../services/llm-service';
import * as winston from 'winston';
import appLogger from '../../../services/logger';
import { sanitizeError } from '../../../../shared/utils/sanitization';

import { StyleClassifier, StyleClassification } from './style-classifier';
import { ConsistencyChecker } from './consistency-checker';
import { ReadabilityScorer, ReadabilityScores } from './readability-scorer';

export class AdvancedStyleEngine extends ContextAwareEngine {
  public readonly name = 'AdvancedStyleEngine';
  private static readonly MAX_SEGMENT_LENGTH = 10000; // Max characters for a segment

  private styleClassifier: StyleClassifier;
  private consistencyChecker: ConsistencyChecker;
  private readabilityScorer: ReadabilityScorer;

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    const engineNameForLogger = 'AdvancedStyleEngine'; // Use explicit name for logger before super()
    const engineLogger = logger || appLogger.child({ engineName: engineNameForLogger });
    super(llmService, engineLogger);

    // Initialize support modules
    this.styleClassifier = new StyleClassifier(llmService, this.logger); // Pass the engine's logger
    this.consistencyChecker = new ConsistencyChecker(llmService, this.logger);
    this.readabilityScorer = new ReadabilityScorer(this.logger);
    this.logger.info(`[${this.name}] initialized with support modules.`);
  }

  /**
   * Analyzes a document segment for style aspects.
   * - Style detection and classification
   * - Consistency checking (across segments, potentially using documentContext)
   * - Readability scoring
   *
   * @param segment - The document segment to analyze.
   * @param documentContext - Optional context of the entire document.
   * @param features - Optional pre-extracted features for this segment.
   * @returns A promise that resolves to an AnalysisResult.
   */
  public async analyze(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
    features?: ExtractedFeatures,
  ): Promise<AnalysisResult> {
    this.logger.info(`[${this.name}] Analyzing segment: ${segment.id}`, { segmentId: segment.id, documentUri: documentContext?.uri });

    if (segment.text.length > AdvancedStyleEngine.MAX_SEGMENT_LENGTH) {
      const errorMsg = `Segment text exceeds maximum length of ${AdvancedStyleEngine.MAX_SEGMENT_LENGTH} characters.`;
      this.logger.warn(`[${this.name}] ${errorMsg}`, { segmentId: segment.id, length: segment.text.length });
      return this.createErrorResult(segment.id, errorMsg);
    }

    const findings: Finding[] = [];
    let errorMessages: string = '';

    try {
      // 1. Style Detection and Classification
      const styleClassification: StyleClassification = await this.styleClassifier.classify(segment, documentContext);
      if (styleClassification.primaryStyle !== 'unknown') {
        findings.push({
          type: 'StyleClassification',
          message: `Detected style: ${styleClassification.primaryStyle} (Confidence: ${styleClassification.confidence.toFixed(2)})`,
          severity: 'info',
          offset: 0, // Applies to the whole segment
          length: segment.text.length,
          // suggestion: styleClassification.details?.reason // Optional: provide reason as suggestion
        });
      }

      // 2. Consistency Checking
      if (documentContext) { // Consistency checking needs document context
        const consistencyIssues: Finding[] = await this.consistencyChecker.check(segment, documentContext, features);
        findings.push(...consistencyIssues);
      }

      // 3. Readability Scoring
      const readabilityScores: ReadabilityScores = this.readabilityScorer.score(segment.text, features);
      if (readabilityScores.fleschReadingEase !== undefined) {
        findings.push({
          type: 'ReadabilityScore',
          message: `Flesch Reading Ease: ${readabilityScores.fleschReadingEase.toFixed(2)}`,
          severity: 'info',
          offset: 0,
          length: segment.text.length,
          suggestion: readabilityScores.fleschReadingEase < 30 ? 'Text is very difficult to read. Consider simplifying.' : (readabilityScores.fleschReadingEase < 60 ? 'Text is fairly difficult to read.' : undefined),
        });
      }
      if (readabilityScores.fleschKincaidGradeLevel !== undefined) {
         findings.push({
          type: 'ReadabilityScore',
          message: `Flesch-Kincaid Grade Level: ${readabilityScores.fleschKincaidGradeLevel.toFixed(2)}`,
          severity: 'info',
          offset: 0,
          length: segment.text.length,
          suggestion: readabilityScores.fleschKincaidGradeLevel > 12 ? 'Text may be too complex for a general audience (suited for college graduates).' : undefined,
        });
      }

      // Example additional style rule (can be expanded or moved to a dedicated rule system)
      if (segment.text.toLowerCase().includes('utilize') && documentContext?.metadata?.audience === 'general') {
        const offset = segment.text.toLowerCase().indexOf('utilize');
        findings.push({
          type: 'StyleSuggestion',
          message: "Consider using 'use' instead of 'utilize' for a general audience.",
          severity: 'info',
          offset: offset,
          length: 'utilize'.length,
          suggestion: "Replace 'utilize' with 'use'.",
        });
      }
      
      // Deduplicate findings (e.g. if multiple components report the same thing, though less likely here)
      const uniqueFindings = findings.filter((finding, index, self) =>
        index === self.findIndex((f) => (
            f.offset === finding.offset && f.length === finding.length && f.type === finding.type && f.message === finding.message
        ))
      );


      if (uniqueFindings.length > 0) {
        return this.createSuccessResult(segment.id, uniqueFindings);
      }
      return this.createSuccessResult(segment.id, []);

    } catch (error) {
      const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error during style analysis';
      this.logger.error(`[${this.name}] Raw error during analysis for segment ${segment.id} (doc: ${documentContext?.uri}): ${rawErrorMessage}`, { error, segmentId: segment.id, documentUri: documentContext?.uri });
      
      const sanitizedErrorMessage = sanitizeError(rawErrorMessage, `${this.name} analysis`);
      errorMessages = sanitizedErrorMessage;
      return this.createErrorResult(segment.id, sanitizedErrorMessage, error);
    }
  }

  /**
   * Clears any document-specific cached data, e.g., for consistency checking.
   * @param docUri The URI of the document whose cached data should be cleared.
   */
  public clearCacheForDocument(docUri: string): void {
    this.consistencyChecker.clearDocumentProfile(docUri);
    this.logger.info(`[${this.name}] Cleared cached style data for document: ${docUri}`);
  }

  // Override dispose if support modules have cleanup that needs to be explicitly called.
  // For now, assuming their loggers are children and don't need explicit dispose.
  // public async dispose(): Promise<void> {
  //   await super.dispose();
  //   // if (this.styleClassifier.dispose) await this.styleClassifier.dispose();
  //   // if (this.consistencyChecker.dispose) await this.consistencyChecker.dispose();
  //   // if (this.readabilityScorer.dispose) await this.readabilityScorer.dispose();
  //   this.logger.info(`[${this.name}] disposed.`);
  // }
}
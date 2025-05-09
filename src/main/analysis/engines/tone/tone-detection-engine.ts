// src/main/analysis/engines/tone/tone-detection-engine.ts

/**
 * @file Tone detection analysis engine.
 */

import { ContextAwareEngine } from '../context-aware-engine';
import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { AnalysisResult, ExtractedFeatures, Finding } from '../../types';
import { LlmService } from '../../../services/llm-service';
import * as winston from 'winston';
import appLogger from '../../../services/logger';
import { sanitizeError } from '../../../../shared/utils/sanitization';

import { EmotionalAnalyzer, EmotionalProfile } from './emotional-analyzer';
import { FormalityDetector, FormalityLevel } from './formality-detector';
import { CulturalChecker } from './cultural-checker';

export class ToneDetectionEngine extends ContextAwareEngine {
  public readonly name = 'ToneDetectionEngine';
  private static readonly MAX_SEGMENT_LENGTH = 10000; // Max characters for a segment

  private emotionalAnalyzer: EmotionalAnalyzer;
  private formalityDetector: FormalityDetector;
  private culturalChecker: CulturalChecker;

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    const engineNameForLogger = 'ToneDetectionEngine';
    const engineLogger = logger || appLogger.child({ engineName: engineNameForLogger });
    super(llmService, engineLogger);

    // Initialize support modules
    this.emotionalAnalyzer = new EmotionalAnalyzer(llmService, this.logger);
    this.formalityDetector = new FormalityDetector(llmService, this.logger);
    this.culturalChecker = new CulturalChecker(llmService, this.logger);
    this.logger.info(`[${this.name}] initialized with support modules.`);
  }

  /**
   * Analyzes a document segment for tone aspects.
   * - Emotional tone analysis
   * - Formality detection
   * - Cultural sensitivity checking
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

    if (segment.text.length > ToneDetectionEngine.MAX_SEGMENT_LENGTH) {
      const errorMsg = `Segment text exceeds maximum length of ${ToneDetectionEngine.MAX_SEGMENT_LENGTH} characters.`;
      this.logger.warn(`[${this.name}] ${errorMsg}`, { segmentId: segment.id, length: segment.text.length });
      return this.createErrorResult(segment.id, errorMsg);
    }

    const findings: Finding[] = [];
    let errorMessages: string = '';

    try {
      // 1. Emotional Tone Analysis
      const emotions: EmotionalProfile = await this.emotionalAnalyzer.analyze(segment, documentContext);
      if (emotions.primaryEmotion && emotions.primaryEmotion !== 'neutral') { // Report non-neutral primary emotions
        let emotionMessage = `Primary emotion: ${emotions.primaryEmotion}`;
        if (emotions.primaryEmotionScore) {
          emotionMessage += ` (Score: ${emotions.primaryEmotionScore.toFixed(2)})`;
        }
        if (emotions.secondaryEmotions && emotions.secondaryEmotions.length > 0) {
          emotionMessage += `. Secondary: ${emotions.secondaryEmotions.join(', ')}`;
        }
        if (emotions.sentiment) {
            emotionMessage += `. Overall sentiment: ${emotions.sentiment.label} (${emotions.sentiment.score.toFixed(2)})`;
        }
        findings.push({
          type: 'EmotionalTone',
          message: emotionMessage,
          severity: 'info', // Or 'warning' for strong negative emotions
          offset: 0, length: segment.text.length,
        });
      }

      // 2. Formality Detection
      const formality: FormalityLevel = await this.formalityDetector.detect(segment, documentContext);
      if (formality.level !== 'neutral' || formality.confidence > 0.6) { // Report non-neutral or high-confidence neutral
         findings.push({
          type: 'FormalityLevel',
          message: `Detected formality: ${formality.level} (Confidence: ${formality.confidence.toFixed(2)})`,
          severity: 'info',
          offset: 0, length: segment.text.length,
          suggestion: formality.details?.reason,
        });
      }

      // 3. Cultural Sensitivity Checking
      const culturalIssues: Finding[] = await this.culturalChecker.check(segment, documentContext);
      findings.push(...culturalIssues);
      
      // Deduplicate findings
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
      const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error during tone analysis';
      this.logger.error(`[${this.name}] Raw error during analysis for segment ${segment.id} (doc: ${documentContext?.uri}): ${rawErrorMessage}`, { error, segmentId: segment.id, documentUri: documentContext?.uri });
      
      const sanitizedErrorMessage = sanitizeError(rawErrorMessage, `${this.name} analysis`);
      errorMessages = sanitizedErrorMessage;
      return this.createErrorResult(segment.id, sanitizedErrorMessage, error);
    }
  }

  // public async dispose(): Promise<void> {
  //   await super.dispose();
  //   // if (this.emotionalAnalyzer.dispose) await this.emotionalAnalyzer.dispose();
  //   // if (this.formalityDetector.dispose) await this.formalityDetector.dispose();
  //   // if (this.culturalChecker.dispose) await this.culturalChecker.dispose();
  //   this.logger.info(`[${this.name}] disposed.`);
  // }
}
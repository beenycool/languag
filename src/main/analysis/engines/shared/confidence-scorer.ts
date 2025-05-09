// src/main/analysis/engines/shared/confidence-scorer.ts

/**
 * @file Calculates confidence scores for analysis results or findings.
 */

import { Finding, AnalysisResult } from '../../types';
import { IDocumentContext } from '../../context/document-context'; // For context-aware scoring
import * as winston from 'winston';
import appLogger from '../../../services/logger';

export interface ScoreFactors {
  ruleCertainty?: number; // 0-1, how reliable is the rule/method that produced the finding?
  textualEvidenceStrength?: number; // 0-1, how strong is the evidence in the text?
  contextualAlignment?: number; // 0-1, does the finding align with document context? (e.g., genre, formality)
  llmConfidence?: number; // 0-1, if an LLM was used, its own confidence
  // Add other relevant factors
}

export class ConfidenceScorer {
  private logger: winston.Logger;

  constructor(logger?: winston.Logger) {
    this.logger = logger || appLogger.child({ module: 'ConfidenceScorer' });
    this.logger.info('ConfidenceScorer initialized.');
  }

  /**
   * Calculates a confidence score for a single finding.
   * @param finding - The finding to score.
   * @param factors - Optional ScoreFactors providing more input to the scoring logic.
   * @param documentContext - Optional document context for context-aware scoring.
   * @returns A confidence score between 0 and 1.
   */
  public scoreFinding(
    finding: Finding,
    factors?: ScoreFactors,
    documentContext?: IDocumentContext,
  ): number {
    this.logger.debug(`Scoring confidence for finding: ${finding.message.substring(0, 50)}...`);

    let baseScore = finding.confidence || 0.5; // Start with finding's own confidence or a default

    if (factors) {
      // Weighted average or more complex model could be used here.
      // Example: Simple averaging of available factors, giving more weight to some.
      let scoreSum = baseScore * 2; // Give baseScore double weight initially
      let weightSum = 2;

      if (factors.ruleCertainty !== undefined) {
        scoreSum += factors.ruleCertainty * 1.5; // Rule certainty is important
        weightSum += 1.5;
      }
      if (factors.textualEvidenceStrength !== undefined) {
        scoreSum += factors.textualEvidenceStrength;
        weightSum += 1;
      }
      if (factors.contextualAlignment !== undefined && documentContext) {
        // Example: if finding is about informality in a formal doc, alignment is low.
        // This factor might need to be pre-calculated based on finding type and context.
        scoreSum += factors.contextualAlignment;
        weightSum += 1;
      }
      if (factors.llmConfidence !== undefined) {
        scoreSum += factors.llmConfidence * 1.2; // LLM confidence can be influential
        weightSum += 1.2;
      }
      
      if (weightSum > 0) {
        baseScore = scoreSum / weightSum;
      }
    }

    // Adjust score based on finding severity (e.g., errors might be inherently more confident)
    switch (finding.severity) {
      case 'error':
        baseScore = Math.min(1.0, baseScore + 0.1); // Boost confidence for errors
        break;
      case 'warning':
        // No change or slight boost
        break;
      case 'info':
        baseScore = Math.max(0.1, baseScore - 0.05); // Slightly lower confidence for info unless factors are strong
        break;
    }
    
    // Ensure score is within [0, 1]
    const finalScore = Math.max(0, Math.min(1, baseScore));
    this.logger.debug(`Final confidence for finding: ${finalScore.toFixed(3)}`);
    return finalScore;
  }

  /**
   * Calculates an overall confidence score for an AnalysisResult (e.g., average of its findings).
   * @param analysisResult - The AnalysisResult to score.
   * @param documentContext - Optional document context.
   * @returns An overall confidence score between 0 and 1.
   */
  public scoreAnalysisResult(
    analysisResult: AnalysisResult,
    documentContext?: IDocumentContext,
  ): number {
    if (analysisResult.error) {
      return 0; // No confidence if there was an error processing
    }
    if (!analysisResult.findings || analysisResult.findings.length === 0) {
      return 1; // Full confidence if no issues were found (or 0 if that's preferred interpretation)
    }

    let totalConfidence = 0;
    analysisResult.findings.forEach(finding => {
      // For simplicity, using the finding's inherent confidence or a default.
      // A more advanced approach would re-score each finding using scoreFinding with proper factors.
      totalConfidence += finding.confidence !== undefined ? finding.confidence : this.scoreFinding(finding, undefined, documentContext);
    });

    const averageConfidence = totalConfidence / analysisResult.findings.length;
    this.logger.debug(`Overall confidence for AnalysisResult (engine: ${analysisResult.engine}, segment: ${analysisResult.segmentId}): ${averageConfidence.toFixed(3)}`);
    return Math.max(0, Math.min(1, averageConfidence));
  }

  // public dispose(): Promise<void> {
  //   this.logger.info('ConfidenceScorer disposed.');
  //   return Promise.resolve();
  // }
}
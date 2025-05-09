// src/main/analysis/engines/shared/__tests__/confidence-scorer.spec.ts

import { ConfidenceScorer, ScoreFactors } from '../confidence-scorer';
import { Finding, AnalysisResult } from '../../../types';
import { IDocumentContext } from '../../../context/document-context';
import appLogger from '../../../../services/logger';

describe('ConfidenceScorer', () => {
  let scorer: ConfidenceScorer;
  const logger = appLogger.child({ module: 'ConfidenceScorer-Test' });

  beforeEach(() => {
    scorer = new ConfidenceScorer(logger);
  });

  const createMockFinding = (
    severity: Finding['severity'],
    initialConfidence?: number
  ): Finding => ({
    message: 'Test finding',
    type: 'TestType',
    severity,
    confidence: initialConfidence,
    offset: 0,
    length: 10,
  });

  const mockDocContext: IDocumentContext = { uri: 'test-doc' };

  describe('scoreFinding', () => {
    it('should use finding.confidence as base if no factors provided', () => {
      const finding = createMockFinding('info', 0.7);
      // Info severity gets a -0.05 penalty if no other factors, so 0.7 - 0.05 = 0.65
      expect(scorer.scoreFinding(finding)).toBeCloseTo(0.65);
    });

    it('should use 0.5 as base if finding.confidence is undefined and no factors', () => {
      const finding = createMockFinding('warning'); // No initial confidence
      // Warning severity has no penalty/bonus by default, so base is 0.5
      expect(scorer.scoreFinding(finding)).toBe(0.5);
    });

    it('should apply score factors correctly', () => {
      const finding = createMockFinding('warning', 0.6);
      const factors: ScoreFactors = {
        ruleCertainty: 0.9, // weight 1.5
        textualEvidenceStrength: 0.8, // weight 1
        llmConfidence: 0.7, // weight 1.2
      };
      // Base score (0.6) * 2 = 1.2
      // ruleCertainty (0.9) * 1.5 = 1.35
      // textualEvidence (0.8) * 1 = 0.8
      // llmConfidence (0.7) * 1.2 = 0.84
      // Sum of scores = 1.2 + 1.35 + 0.8 + 0.84 = 4.19
      // Sum of weights = 2 + 1.5 + 1 + 1.2 = 5.7
      // Calculated score = 4.19 / 5.7 = 0.7350...
      // No severity adjustment for 'warning'
      expect(scorer.scoreFinding(finding, factors, mockDocContext)).toBeCloseTo(0.73508);
    });

    it('should boost confidence for "error" severity', () => {
      const finding = createMockFinding('error', 0.7); // Base 0.7
      // Error boost +0.1 -> 0.8
      expect(scorer.scoreFinding(finding)).toBeCloseTo(0.8);
    });

    it('should slightly lower confidence for "info" severity if factors are not strong', () => {
      const finding = createMockFinding('info', 0.5); // Base 0.5
      // Info penalty -0.05 -> 0.45
      expect(scorer.scoreFinding(finding)).toBeCloseTo(0.45);
    });

    it('should clamp scores between 0 and 1', () => {
      let finding = createMockFinding('error', 0.95); // Base 0.95, error boost +0.1 -> 1.05, clamped to 1.0
      expect(scorer.scoreFinding(finding)).toBe(1.0);

      finding = createMockFinding('info', 0.02); // Base 0.02, info penalty -0.05 -> -0.03, clamped to 0
      expect(scorer.scoreFinding(finding)).toBe(0.0);
    });
    
    it('should handle contextualAlignment factor', () => {
        const finding = createMockFinding('warning', 0.6);
        const factors: ScoreFactors = {
          contextualAlignment: 0.2, // Low alignment, weight 1
        };
        // Base (0.6)*2 = 1.2
        // Alignment (0.2)*1 = 0.2
        // Sum scores = 1.4
        // Sum weights = 2 + 1 = 3
        // Score = 1.4 / 3 = 0.4666...
        expect(scorer.scoreFinding(finding, factors, mockDocContext)).toBeCloseTo(0.46666);
      });
  });

  describe('scoreAnalysisResult', () => {
    it('should return 0 if AnalysisResult has an error', () => {
      const result: AnalysisResult = {
        segmentId: 's1',
        engine: 'testEngine',
        findings: [],
        error: 'Processing failed',
      };
      expect(scorer.scoreAnalysisResult(result)).toBe(0);
    });

    it('should return 1 if AnalysisResult has no findings and no error', () => {
      const result: AnalysisResult = {
        segmentId: 's1',
        engine: 'testEngine',
        findings: [],
      };
      expect(scorer.scoreAnalysisResult(result)).toBe(1);
    });

    it('should average the confidence of findings', () => {
      const finding1 = createMockFinding('info', 0.8); // scored: 0.8 - 0.05 = 0.75
      const finding2 = createMockFinding('warning', 0.6); // scored: 0.6
      const finding3 = createMockFinding('error', 0.7); // scored: 0.7 + 0.1 = 0.8
      const result: AnalysisResult = {
        segmentId: 's1',
        engine: 'testEngine',
        findings: [finding1, finding2, finding3],
      };
      // Average of (0.75 + 0.6 + 0.8) / 3 = 2.15 / 3 = 0.71666...
      expect(scorer.scoreAnalysisResult(result, mockDocContext)).toBeCloseTo(0.71666);
    });
    
    it('should use default scoring for findings if their confidence is undefined in scoreAnalysisResult', () => {
        const finding1 = createMockFinding('info'); // Default 0.5, scored: 0.5 - 0.05 = 0.45
        const finding2 = createMockFinding('error'); // Default 0.5, scored: 0.5 + 0.1 = 0.6
        const result: AnalysisResult = {
          segmentId: 's1',
          engine: 'testEngine',
          findings: [finding1, finding2],
        };
        // Average of (0.45 + 0.6) / 2 = 1.05 / 2 = 0.525
        expect(scorer.scoreAnalysisResult(result, mockDocContext)).toBeCloseTo(0.525);
      });
  });
});
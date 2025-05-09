// src/main/analysis/engines/tone/__tests__/tone-detection-engine.spec.ts

import { ToneDetectionEngine } from '../tone-detection-engine';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { LlmService } from '../../../../services/llm-service';
import { Finding, ExtractedFeatures } from '../../../types';
import appLogger from '../../../../services/logger';

// Mock support modules
import { EmotionalAnalyzer, EmotionalProfile, Emotion } from '../emotional-analyzer';
import { FormalityDetector, FormalityLevel, Formality } from '../formality-detector';
import { CulturalChecker } from '../cultural-checker';

jest.mock('../emotional-analyzer');
jest.mock('../formality-detector');
jest.mock('../cultural-checker');

describe('ToneDetectionEngine', () => {
  let engine: ToneDetectionEngine;
  const mockLogger = appLogger.child({ module: 'ToneDetectionEngine-Test' });

  let mockEmotionalAnalyzerInstance: jest.Mocked<EmotionalAnalyzer>;
  let mockFormalityDetectorInstance: jest.Mocked<FormalityDetector>;
  let mockCulturalCheckerInstance: jest.Mocked<CulturalChecker>;

  beforeEach(() => {
    mockEmotionalAnalyzerInstance = new (EmotionalAnalyzer as jest.Mock<EmotionalAnalyzer>)() as jest.Mocked<EmotionalAnalyzer>;
    mockFormalityDetectorInstance = new (FormalityDetector as jest.Mock<FormalityDetector>)() as jest.Mocked<FormalityDetector>;
    mockCulturalCheckerInstance = new (CulturalChecker as jest.Mock<CulturalChecker>)() as jest.Mocked<CulturalChecker>;

    mockEmotionalAnalyzerInstance.analyze = jest.fn();
    mockFormalityDetectorInstance.detect = jest.fn();
    mockCulturalCheckerInstance.check = jest.fn();

    (EmotionalAnalyzer as jest.Mock<EmotionalAnalyzer>).mockImplementation(() => mockEmotionalAnalyzerInstance);
    (FormalityDetector as jest.Mock<FormalityDetector>).mockImplementation(() => mockFormalityDetectorInstance);
    (CulturalChecker as jest.Mock<CulturalChecker>).mockImplementation(() => mockCulturalCheckerInstance);

    engine = new ToneDetectionEngine(undefined, mockLogger);
  });

  const createMockSegment = (id: string, text: string): IDocumentSegment => ({
    id,
    text,
    range: { start: 0, end: text.length },
  });

  const createMockContext = (uri: string, language?: string, metadata?: Record<string, any>): IDocumentContext => ({
    uri,
    language,
    metadata,
  });
  
  const mockFeatures: ExtractedFeatures = { wordCount: 30, sentenceCount: 2, keywords: ['tone', 'test'] };

  it('should have the correct name', () => {
    expect(engine.name).toBe('ToneDetectionEngine');
  });

  it('should call emotional analyzer, formality detector, and cultural checker', async () => {
    const segment = createMockSegment('seg1', "This is a test segment. You guys are doing great! It's quite formal, I believe.");
    const context = createMockContext('doc1', 'en', { audience: 'global' });

    const mockEmotions: EmotionalProfile = { primaryEmotion: 'joy', primaryEmotionScore: 0.8, sentiment: {score: 0.7, label: 'positive'} };
    const mockFormality: FormalityLevel = { level: 'neutral', confidence: 0.7, details: {reason: "mixed signals"} };
    const mockCulturalFindings: Finding[] = [{ type: 'CulturalSensitivity', message: "'You guys' issue", severity: 'warning', offset: 28, length: 8, suggestion: "use 'everyone'" }];

    mockEmotionalAnalyzerInstance.analyze.mockResolvedValue(mockEmotions);
    mockFormalityDetectorInstance.detect.mockResolvedValue(mockFormality);
    mockCulturalCheckerInstance.check.mockResolvedValue(mockCulturalFindings);

    const result = await engine.analyze(segment, context, mockFeatures);

    expect(mockEmotionalAnalyzerInstance.analyze).toHaveBeenCalledWith(segment, context);
    expect(mockFormalityDetectorInstance.detect).toHaveBeenCalledWith(segment, context);
    expect(mockCulturalCheckerInstance.check).toHaveBeenCalledWith(segment, context);

    expect(result.findings.length).toBe(3); // Emotion + Formality + Cultural
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'EmotionalTone', message: expect.stringContaining('Primary emotion: joy') }),
      expect.objectContaining({ type: 'FormalityLevel', message: expect.stringContaining('Detected formality: neutral'), suggestion: "mixed signals" }),
      ...mockCulturalFindings,
    ]));
    expect(result.error).toBeUndefined();
  });

  it('should not add emotion finding if primary emotion is neutral', async () => {
    const segment = createMockSegment('seg1', "This is neutral.");
    const context = createMockContext('doc1');
    mockEmotionalAnalyzerInstance.analyze.mockResolvedValue({ primaryEmotion: 'neutral', primaryEmotionScore: 0.9, sentiment: {score: 0.1, label: 'neutral'} });
    mockFormalityDetectorInstance.detect.mockResolvedValue({ level: 'neutral', confidence: 0.5 });
    mockCulturalCheckerInstance.check.mockResolvedValue([]);

    const result = await engine.analyze(segment, context, mockFeatures);
    const emotionFinding = result.findings.find(f => f.type === 'EmotionalTone');
    expect(emotionFinding).toBeUndefined();
    // Formality might still be reported if confidence is high enough or level is not neutral
    const formalityFinding = result.findings.find(f => f.type === 'FormalityLevel');
    expect(formalityFinding).toBeDefined(); // Neutral with 0.5 confidence might not be reported by default logic
                                          // Current logic: (formality.level !== 'neutral' || formality.confidence > 0.6)
                                          // So, neutral with 0.5 confidence will NOT be reported.
    expect(formalityFinding).toBeUndefined();


  });
  
  it('should report neutral formality if confidence is high', async () => {
    const segment = createMockSegment('seg1', "This is neutral.");
    const context = createMockContext('doc1');
    mockEmotionalAnalyzerInstance.analyze.mockResolvedValue({ primaryEmotion: 'neutral', primaryEmotionScore: 0.9, sentiment: {score: 0.1, label: 'neutral'} });
    mockFormalityDetectorInstance.detect.mockResolvedValue({ level: 'neutral', confidence: 0.7 }); // High confidence neutral
    mockCulturalCheckerInstance.check.mockResolvedValue([]);

    const result = await engine.analyze(segment, context, mockFeatures);
    const formalityFinding = result.findings.find(f => f.type === 'FormalityLevel');
    expect(formalityFinding).toBeDefined();
    expect(formalityFinding?.message).toContain('Detected formality: neutral (Confidence: 0.70)');
  });


  it('should handle errors from sub-modules gracefully', async () => {
    const segment = createMockSegment('seg1', "Error segment.");
    const context = createMockContext('doc1');
    const errorMessage = "Analyzer failed";

    mockEmotionalAnalyzerInstance.analyze.mockRejectedValue(new Error(errorMessage));
    mockFormalityDetectorInstance.detect.mockResolvedValue({ level: 'neutral', confidence: 0.5 });
    mockCulturalCheckerInstance.check.mockResolvedValue([]);

    const result = await engine.analyze(segment, context, mockFeatures);

    expect(result.error).toBe(errorMessage);
    expect(result.findings).toEqual([]);
  });
});
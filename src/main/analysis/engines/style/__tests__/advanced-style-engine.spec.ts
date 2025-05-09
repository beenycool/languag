// src/main/analysis/engines/style/__tests__/advanced-style-engine.spec.ts

import { AdvancedStyleEngine } from '../advanced-style-engine';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { LlmService } from '../../../../services/llm-service';
import { Finding, ExtractedFeatures } from '../../../types';
import appLogger from '../../../../services/logger';

// Mock support modules
import { StyleClassifier, StyleClassification } from '../style-classifier';
import { ConsistencyChecker } from '../consistency-checker';
import { ReadabilityScorer, ReadabilityScores } from '../readability-scorer';

jest.mock('../style-classifier');
jest.mock('../consistency-checker');
jest.mock('../readability-scorer');

describe('AdvancedStyleEngine', () => {
  let engine: AdvancedStyleEngine;
  let mockLlmService: jest.Mocked<LlmService>;
  const mockLogger = appLogger.child({ module: 'AdvancedStyleEngine-Test' });

  // Mock instances of the support modules
  let mockStyleClassifierInstance: jest.Mocked<StyleClassifier>;
  let mockConsistencyCheckerInstance: jest.Mocked<ConsistencyChecker>;
  let mockReadabilityScorerInstance: jest.Mocked<ReadabilityScorer>;

  beforeEach(() => {
    // Create new mock instances for each test
    // For classes, we mock the constructor to return our mock instance.
    // The instances themselves will have their methods mocked.
    mockStyleClassifierInstance = new (StyleClassifier as jest.MockedClass<typeof StyleClassifier>)(undefined, undefined) as jest.Mocked<StyleClassifier>;
    mockConsistencyCheckerInstance = new (ConsistencyChecker as jest.MockedClass<typeof ConsistencyChecker>)(undefined, undefined) as jest.Mocked<ConsistencyChecker>;
    mockReadabilityScorerInstance = new (ReadabilityScorer as jest.MockedClass<typeof ReadabilityScorer>)(undefined) as jest.Mocked<ReadabilityScorer>;
    
    // Setup mock implementations
    mockStyleClassifierInstance.classify = jest.fn();
    mockConsistencyCheckerInstance.check = jest.fn();
    mockConsistencyCheckerInstance.clearDocumentProfile = jest.fn();
    mockReadabilityScorerInstance.score = jest.fn();

    // engine = new AdvancedStyleEngine(undefined, mockLogger);
    // To inject the mocked instances, we need to modify how AdvancedStyleEngine instantiates them,
    // or use jest's ability to control the constructor of mocked classes.
    // The easiest way is to ensure the mocked constructors return our instances.
    (StyleClassifier as jest.MockedClass<typeof StyleClassifier>).mockImplementation(() => mockStyleClassifierInstance);
    (ConsistencyChecker as jest.MockedClass<typeof ConsistencyChecker>).mockImplementation(() => mockConsistencyCheckerInstance);
    (ReadabilityScorer as jest.MockedClass<typeof ReadabilityScorer>).mockImplementation(() => mockReadabilityScorerInstance);
    
    engine = new AdvancedStyleEngine(undefined, mockLogger);
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
  
  const mockFeatures: ExtractedFeatures = { wordCount: 50, sentenceCount: 3, keywords: ['test', 'style'] };

  it('should have the correct name', () => {
    expect(engine.name).toBe('AdvancedStyleEngine');
  });

  it('should call style classifier, consistency checker, and readability scorer', async () => {
    const segment = createMockSegment('seg1', "This is a test segment. We shall utilize advanced techniques.");
    const context = createMockContext('doc1', 'en', { audience: 'technical' });

    const mockClassification: StyleClassification = { primaryStyle: 'technical', confidence: 0.9 };
    const mockConsistencyFindings: Finding[] = [{ type: 'StyleConsistency', message: 'Consistent', severity: 'info', offset: 0, length: 10 }];
    const mockReadabilityScores: ReadabilityScores = { fleschReadingEase: 65, fleschKincaidGradeLevel: 8 };

    mockStyleClassifierInstance.classify.mockResolvedValue(mockClassification);
    mockConsistencyCheckerInstance.check.mockResolvedValue(mockConsistencyFindings);
    mockReadabilityScorerInstance.score.mockReturnValue(mockReadabilityScores);

    const result = await engine.analyze(segment, context, mockFeatures);

    expect(mockStyleClassifierInstance.classify).toHaveBeenCalledWith(segment, context);
    expect(mockConsistencyCheckerInstance.check).toHaveBeenCalledWith(segment, context, mockFeatures);
    expect(mockReadabilityScorerInstance.score).toHaveBeenCalledWith(segment.text, mockFeatures);

    expect(result.findings.length).toBeGreaterThanOrEqual(3); // Classification + Consistency + 2 Readability scores
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'StyleClassification', message: expect.stringContaining('technical') }),
      ...mockConsistencyFindings,
      expect.objectContaining({ type: 'ReadabilityScore', message: expect.stringContaining('Flesch Reading Ease: 65.00') }),
      expect.objectContaining({ type: 'ReadabilityScore', message: expect.stringContaining('Flesch-Kincaid Grade Level: 8.00') }),
    ]));
    expect(result.error).toBeUndefined();
  });

  it('should include specific style suggestions like "utilize" vs "use"', async () => {
    const segment = createMockSegment('seg1', "We will utilize this method.");
    const context = createMockContext('doc1', 'en', { audience: 'general' });

    mockStyleClassifierInstance.classify.mockResolvedValue({ primaryStyle: 'formal', confidence: 0.7 });
    mockConsistencyCheckerInstance.check.mockResolvedValue([]);
    mockReadabilityScorerInstance.score.mockReturnValue({ fleschReadingEase: 70, fleschKincaidGradeLevel: 7 });

    const result = await engine.analyze(segment, context, mockFeatures);
    
    const utilizeFinding = result.findings.find(f => f.message.includes("utilize"));
    expect(utilizeFinding).toBeDefined();
    expect(utilizeFinding?.suggestion).toBe("Replace 'utilize' with 'use'.");
  });

  it('should handle errors from sub-modules gracefully', async () => {
    const segment = createMockSegment('seg1', "Error segment.");
    const context = createMockContext('doc1');
    const errorMessage = "Classifier failed";

    mockStyleClassifierInstance.classify.mockRejectedValue(new Error(errorMessage)); // Simulate error
    mockConsistencyCheckerInstance.check.mockResolvedValue([]);
    mockReadabilityScorerInstance.score.mockReturnValue({});

    const result = await engine.analyze(segment, context, mockFeatures);

    // The engine itself should not throw but return an error result
    expect(result.error).toBe(errorMessage);
    expect(result.findings).toEqual([]);
  });
  
  it('should not add style classification finding if style is "unknown"', async () => {
    const segment = createMockSegment('seg1', "A very generic segment of text.");
    const context = createMockContext('doc1');

    mockStyleClassifierInstance.classify.mockResolvedValue({ primaryStyle: 'unknown', confidence: 0.2 });
    mockConsistencyCheckerInstance.check.mockResolvedValue([]);
    mockReadabilityScorerInstance.score.mockReturnValue({ fleschReadingEase: 80 });

    const result = await engine.analyze(segment, context, mockFeatures);

    const styleClassificationFinding = result.findings.find(f => f.type === 'StyleClassification');
    expect(styleClassificationFinding).toBeUndefined();
    expect(result.findings.some(f => f.type === 'ReadabilityScore')).toBe(true);
  });

  it('clearCacheForDocument should call consistencyChecker.clearDocumentProfile', () => {
    const docUri = 'test-doc-uri';
    engine.clearCacheForDocument(docUri);
    expect(mockConsistencyCheckerInstance.clearDocumentProfile).toHaveBeenCalledWith(docUri);
  });
});
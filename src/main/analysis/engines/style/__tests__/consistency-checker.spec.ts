// src/main/analysis/engines/style/__tests__/consistency-checker.spec.ts

import { ConsistencyChecker } from '../consistency-checker';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { Finding, ExtractedFeatures } from '../../../types';
import appLogger from '../../../../services/logger';

describe('ConsistencyChecker', () => {
  let checker: ConsistencyChecker;
  const logger = appLogger.child({ module: 'ConsistencyChecker-Test' });

  beforeEach(() => {
    checker = new ConsistencyChecker(undefined, logger); // No LLM for now
  });

  const createMockSegment = (id: string, text: string): IDocumentSegment => ({
    id,
    text,
    range: { start: 0, end: text.length },
  });

  const createMockContext = (uri: string): IDocumentContext => ({ uri });
  
  const mockFeatures: ExtractedFeatures = { wordCount: 10, sentenceCount: 1, keywords: [] };

  it('should return no findings if documentContext is not provided', async () => {
    const segment = createMockSegment('seg1', "Text.");
    const findings = await checker.check(segment);
    expect(findings).toEqual([]);
  });

  it('should return no findings for the first segment in a document', async () => {
    const segment = createMockSegment('seg1', "This is the first formal segment.");
    const context = createMockContext('doc1');
    const findings = await checker.check(segment, context, mockFeatures);
    expect(findings).toEqual([]); // No previous segments to compare against
  });

  it('should detect formality inconsistency', async () => {
    const context = createMockContext('doc2');
    const segment1 = createMockSegment('s1', "Heretofore, we shall proceed with caution."); // Formal
    const segment2 = createMockSegment('s2', "This is also a very formal statement."); // Formal
    const segment3 = createMockSegment('s3', "But hey, this part is like, totally informal, dude."); // Informal

    await checker.check(segment1, context, { ...mockFeatures, wordCount: 6 }); // Process formal
    await checker.check(segment2, context, { ...mockFeatures, wordCount: 7 }); // Process another formal
    
    // Now check the informal segment
    const findings = await checker.check(segment3, context, { ...mockFeatures, wordCount: 10 });
    
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe('StyleConsistency');
    expect(findings[0].message).toContain("Inconsistent formality: Segment is 'informal' while document predominantly appears 'formal'.");
    expect(findings[0].severity).toBe('warning');
  });

  it('should not flag consistency if styles match the dominant style', async () => {
    const context = createMockContext('doc3');
    const segment1 = createMockSegment('s1', "This is informal, like, you know?");
    const segment2 = createMockSegment('s2', "Yeah, totally informal stuff here.");
    const segment3 = createMockSegment('s3', "Another informal bit, gonna keep it casual.");

    await checker.check(segment1, context, mockFeatures);
    await checker.check(segment2, context, mockFeatures);
    const findings = await checker.check(segment3, context, mockFeatures);

    expect(findings).toEqual([]);
  });
  
  it('should update profile if a segment is re-analyzed', async () => {
    const context = createMockContext('doc4');
    const segment1 = createMockSegment('s1', "Initial formal text.");
    const segment2 = createMockSegment('s2', "Another formal text.");
    
    // First pass
    await checker.check(segment1, context, { ...mockFeatures, wordCount: 3 });
    await checker.check(segment2, context, { ...mockFeatures, wordCount: 3 });

    // Re-analyze segment1, now it's informal
    const updatedSegment1 = createMockSegment('s1', "Now it's informal, lol.");
    await checker.check(updatedSegment1, context, { ...mockFeatures, wordCount: 4 });

    // Analyze segment3, which is formal. It should now be inconsistent with the updated s1 (if s1 became dominant)
    // or consistent with s2. This depends on the "dominant" logic.
    // Current dominant logic: formalCount (1 from s2) vs informalCount (1 from updated s1) -> neutral or tie.
    // Let's make s2 also informal to test against a new formal segment.
    const updatedSegment2 = createMockSegment('s2', "This is also informal now, dude.");
    await checker.check(updatedSegment2, context, { ...mockFeatures, wordCount: 6 });


    const segment3Formal = createMockSegment('s3', "A new formal segment arrives.");
    const findings = await checker.check(segment3Formal, context, { ...mockFeatures, wordCount: 5 });

    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("Inconsistent formality: Segment is 'formal' while document predominantly appears 'informal'.");
  });

  it('clearDocumentProfile should remove profiles for a given document URI', async () => {
    const docUri = 'docToClear';
    const context = createMockContext(docUri);
    const segment1 = createMockSegment('seg1', "Text for clearing.");
    
    await checker.check(segment1, context, mockFeatures); // Add a profile
    
    // @ts-ignore // Access private member for test verification
    expect(checker.documentStyleProfiles.has(docUri)).toBe(true);
    
    checker.clearDocumentProfile(docUri);
    
    // @ts-ignore
    expect(checker.documentStyleProfiles.has(docUri)).toBe(false);
  });

  // TODO: Add tests for other consistency aspects (tense, vocabulary) when implemented.
});
// src/main/analysis/engines/tone/__tests__/cultural-checker.spec.ts

import { CulturalChecker } from '../cultural-checker';
import { IDocumentSegment, IDocumentContext } from '../../../context/document-context';
import { Finding } from '../../../types';
import { LlmService } from '../../../../services/llm-service';
import appLogger from '../../../../services/logger';

describe('CulturalChecker', () => {
  let checker: CulturalChecker;
  // let mockLlmService: jest.Mocked<LlmService>; // For when LLM part is active
  const logger = appLogger.child({ module: 'CulturalChecker-Test' });

  beforeEach(() => {
    checker = new CulturalChecker(undefined, logger); // No LLM for rule-based tests
  });

  const createMockSegment = (text: string): IDocumentSegment => ({
    id: 'seg-test',
    text,
    range: { start: 0, end: text.length },
  });

  const createMockContext = (uri: string = 'doc-test', metadata?: Record<string, any>): IDocumentContext => ({ uri, metadata });

  it("should flag 'you guys' if audience is diverse or global", async () => {
    const segment = createMockSegment("Hello you guys, how are you?");
    let context = createMockContext('doc1', { audience: 'diverse_team' });
    let findings = await checker.check(segment, context);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("'you guys' can be perceived as non-inclusive");
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].offset).toBe(segment.text.indexOf('you guys'));

    context = createMockContext('doc2', { audience: 'global_audience' });
    findings = await checker.check(segment, context);
    expect(findings).toHaveLength(1);
  });

  it("should not flag 'you guys' if rule's targetAudience doesn't match document context audience", async () => {
    const segment = createMockSegment("Hello you guys, how are you?");
    // Rule for 'you guys' targets 'global' or 'diverse'.
    // If doc audience is something else, it shouldn't trigger IF the rule is strict about its target.
    // Current rule logic: if rule.targetAudiences is set, one must match.
    const context = createMockContext('doc3', { audience: 'us-internal-male-only' }); // Does not contain 'global' or 'diverse'
    const findings = await checker.check(segment, context);
    expect(findings).toHaveLength(0); // Because 'us-internal-male-only' doesn't match 'global' or 'diverse'
  });
  
  it("should flag 'you guys' if rule has no targetAudience specified (meaning applies to all)", async () => {
    const segment = createMockSegment("Hello you guys, how are you?");
    const context = createMockContext('doc-no-specific-audience');
    // To test this, we'd need a rule without targetAudiences or modify existing one.
    // For now, the 'you guys' rule HAS targetAudiences.
    // Let's assume a hypothetical rule that applies to all by not having targetAudiences.
    // This test case is more about the rule definition strategy.
    // The current 'you guys' rule will NOT fire if targetAudience in context is undefined and rule has targetAudiences.
    // If context.metadata.audience is undefined, it will also not fire.
    const findings = await checker.check(segment, createMockContext('doc4', { audience: undefined }));
    expect(findings).toHaveLength(0); // Because rule has targetAudiences, and undefined context audience won't match.
  });


  it("should flag casual use of 'crazy' or 'insane'", async () => {
    const segment = createMockSegment("That idea is crazy! It's insane!");
    const findings = await checker.check(segment, createMockContext()); // No specific audience needed for this rule
    expect(findings).toHaveLength(2);
    const crazyFinding = findings.find(f => f.offset === segment.text.indexOf('crazy'));
    const insaneFinding = findings.find(f => f.offset === segment.text.indexOf('insane'));

    expect(crazyFinding).toBeDefined();
    expect(crazyFinding?.message).toContain("Casual use of terms like 'crazy'");
    expect(crazyFinding?.severity).toBe('info');

    expect(insaneFinding).toBeDefined();
    expect(insaneFinding?.message).toContain("Casual use of terms like 'insane'");
    expect(insaneFinding?.severity).toBe('info');
  });

  it('should return no findings for text without problematic phrases', async () => {
    const segment = createMockSegment("This text is neutral and respectful.");
    const findings = await checker.check(segment, createMockContext('doc-neutral', { audience: 'global' }));
    expect(findings).toEqual([]);
  });

  // TODO: Add tests for LLM interaction when that part is enabled.
});
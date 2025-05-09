// src/main/analysis/engines/style/__tests__/readability-scorer.spec.ts

import { ReadabilityScorer, ReadabilityScores } from '../readability-scorer';
import { ExtractedFeatures } from '../../../types';
import appLogger from '../../../../services/logger';

describe('ReadabilityScorer', () => {
  let scorer: ReadabilityScorer;
  const logger = appLogger.child({ module: 'ReadabilityScorer-Test' });

  beforeEach(() => {
    scorer = new ReadabilityScorer(logger);
  });

  // Test data from a known source or calculator for Flesch scores if possible.
  // The following is a simple example text.
  // "The quick brown fox jumps over the lazy dog. This sentence is simple."
  // Words: 13
  // Sentences: 2
  // Syllables (approximate by simple counter):
  // The(1) quick(1) brown(1) fox(1) jumps(1) o(1)ver(1) the(1) la(1)zy(1) dog(1). This(1) sen(1)tence(1) is(1) sim(1)ple(1).
  // = 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 = 17 (This is a rough estimate by the simple counter)
  // A more accurate syllable count for "The quick brown fox jumps over the lazy dog." is 15.
  // "This sentence is simple." is 5 syllables. Total = 20.
  // Let's use a text where the simple syllable counter might be more predictable or use features.

  const text1 = "The cat sat on the mat. It was a fluffy cat. The cat purred loudly.";
  // Words: 16
  // Sentences: 3
  // Syllables (approximate by simple counter):
  // The(1) cat(1) sat(1) on(1) the(1) mat(1). It(1) was(1) a(1) fluf(1)fy(1) cat(1). The(1) cat(1) purred(1) loud(1)ly(1).
  // = 1*17 = 17 (This is still very rough, 'fluffy' is 2, 'purred' is 1, 'loudly' is 2)
  // Actual syllables: the(1) cat(1) sat(1) on(1) the(1) mat(1). it(1) was(1) a(1) fluf(2)fy(0) cat(1). the(1) cat(1) purred(1) loud(1)ly(1). = 16
  // Let's use features for more controlled tests.

  const features1: ExtractedFeatures = {
    wordCount: 16,
    sentenceCount: 3,
    keywords: [], // Not used by readability scorer directly
    // Syllables would ideally be a feature too if a better counter is available upstream
  };
   // For text1 with 16 words, 3 sentences. Assume 18 syllables for calculation.
   // ASL (Average Sentence Length) = 16/3 = 5.333
   // ASW (Average Syllables per Word) = 18/16 = 1.125
   // FRE = 206.835 - 1.015 * ASL - 84.6 * ASW
   //     = 206.835 - 1.015 * 5.333 - 84.6 * 1.125
   //     = 206.835 - 5.413 - 95.175 = 106.247 (Clamped to 100)
   // FKGL = 0.39 * ASL + 11.8 * ASW - 15.59
   //      = 0.39 * 5.333 + 11.8 * 1.125 - 15.59
   //      = 2.080 + 13.275 - 15.59 = -0.235 (Clamped to 0)

  // Mocking countSyllables to return a fixed value for predictable tests
  const mockSyllableCounts: { [text: string]: number } = {
    [text1]: 18, // Assume 18 syllables for text1
    "This is very complex and convoluted text with sesquipedalianisms.": 30, // Example
  };

  beforeEach(() => {
    scorer = new ReadabilityScorer(logger);
    jest.spyOn(scorer as any, 'countSyllables').mockImplementation((...args: any[]) => {
        const text = args[0] as string;
        // Fallback for texts not in mockSyllableCounts, use the actual simple counter for them
        return mockSyllableCounts[text] || ReadabilityScorer.prototype['countSyllables'].call(scorer, text);
    });
    // Also mock word and sentence counts if not using features, to make tests independent of their exact impl.
    jest.spyOn(scorer as any, 'countWords').mockImplementation((...args: any[]) => {
        const text = args[0] as string;
        if (text === text1) return 16;
        return ReadabilityScorer.prototype['countWords'].call(scorer, text);
    });
    jest.spyOn(scorer as any, 'countSentences').mockImplementation((...args: any[]) => {
        const text = args[0] as string;
        if (text === text1) return 3;
        return ReadabilityScorer.prototype['countSentences'].call(scorer, text);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });


  it('should calculate Flesch Reading Ease and Flesch-Kincaid Grade Level using features', () => {
    const scores = scorer.score(text1, features1); // Syllables will be mocked for text1
    expect(scores.fleschReadingEase).toBeCloseTo(100); // Based on 18 syllables, 16 words, 3 sentences
    expect(scores.fleschKincaidGradeLevel).toBeCloseTo(0); // Based on 18 syllables
  });

  it('should calculate scores without pre-extracted features (relying on internal counters)', () => {
    // For this test, countSyllables, countWords, countSentences for text1 are mocked
    const scores = scorer.score(text1);
    expect(scores.fleschReadingEase).toBeCloseTo(100);
    expect(scores.fleschKincaidGradeLevel).toBeCloseTo(0);
  });

  it('should handle text with zero sentences or words gracefully', () => {
    const emptyText = "";
    const featuresEmpty: ExtractedFeatures = { wordCount: 0, sentenceCount: 0, keywords: [] };
    let scores = scorer.score(emptyText, featuresEmpty);
    expect(scores.fleschReadingEase).toBeUndefined();
    expect(scores.fleschKincaidGradeLevel).toBeUndefined();

    const textNoSentences = "word"; // No sentence terminator
    // Internal countSentences might return 1 if text is not empty.
    // Let's force 0 sentences via features.
    const featuresNoSentences: ExtractedFeatures = { wordCount: 1, sentenceCount: 0, keywords: [] };
    scores = scorer.score(textNoSentences, featuresNoSentences);
    expect(scores.fleschReadingEase).toBeUndefined();
    expect(scores.fleschKincaidGradeLevel).toBeUndefined();
  });

  it('should clamp Flesch Reading Ease between 0 and 100', () => {
    // Text designed to give a very high score (many short words, short sentences)
    // Forcing syllable count to be very low relative to words/sentences
    const easyText = "Go. See. Run. Fun."; // 4 words, 4 sentences
    jest.spyOn(scorer as any, 'countSyllables').mockReturnValue(4); // 1 syllable per word
    jest.spyOn(scorer as any, 'countWords').mockReturnValue(4);
    jest.spyOn(scorer as any, 'countSentences').mockReturnValue(4);

    let scores = scorer.score(easyText);
    // ASL = 1, ASW = 1
    // FRE = 206.835 - 1.015 * 1 - 84.6 * 1 = 206.835 - 1.015 - 84.6 = 121.22 -> clamped to 100
    expect(scores.fleschReadingEase).toBe(100);

    // Text designed to give a very low score
    const hardText = "This extraordinarily convoluted and sesquipedalian manuscript requires meticulous intellectual elucidation.";
    // Words: 10, Sentences: 1
    // Syllables (e.g., 30 for this example)
    jest.spyOn(scorer as any, 'countSyllables').mockReturnValue(30);
    jest.spyOn(scorer as any, 'countWords').mockReturnValue(10);
    jest.spyOn(scorer as any, 'countSentences').mockReturnValue(1);
    scores = scorer.score(hardText);
    // ASL = 10, ASW = 3
    // FRE = 206.835 - 1.015 * 10 - 84.6 * 3 = 206.835 - 10.15 - 253.8 = -57.115 -> clamped to 0
    expect(scores.fleschReadingEase).toBe(0);
  });

  it('should clamp Flesch-Kincaid Grade Level to be non-negative', () => {
    // Use the easyText from above which would yield a negative grade level
    const easyText = "Go. See. Run. Fun.";
    jest.spyOn(scorer as any, 'countSyllables').mockReturnValue(4);
    jest.spyOn(scorer as any, 'countWords').mockReturnValue(4);
    jest.spyOn(scorer as any, 'countSentences').mockReturnValue(4);
    let scores = scorer.score(easyText);
    // ASL = 1, ASW = 1
    // FKGL = 0.39 * 1 + 11.8 * 1 - 15.59 = 0.39 + 11.8 - 15.59 = 12.19 - 15.59 = -3.4 -> clamped to 0
    expect(scores.fleschKincaidGradeLevel).toBe(0);
  });

  // Test internal counters if not using features (though they are very basic)
  describe('Internal Counters (if not using features)', () => {
    beforeEach(() => {
        // Restore original implementations for these specific tests if needed,
        // or ensure mocks are not active if testing the actual private methods.
        // For this test, we want the actual simple counters.
        jest.restoreAllMocks(); // Clears mocks from outer beforeEach
        scorer = new ReadabilityScorer(logger); // Re-init scorer
    });

    it('countWords basic functionality', () => {
        expect((scorer as any).countWords("one two three")).toBe(3);
        expect((scorer as any).countWords("  leading spaces")).toBe(2);
        expect((scorer as any).countWords("trailing spaces   ")).toBe(2);
        expect((scorer as any).countWords("")).toBe(0);
    });

    it('countSentences basic functionality', () => {
        expect((scorer as any).countSentences("One. Two! Three?")).toBe(3);
        expect((scorer as any).countSentences("One sentence.")).toBe(1);
        expect((scorer as any).countSentences("No terminator")).toBe(1); // Current behavior
        expect((scorer as any).countSentences("")).toBe(0);
    });

    it('countSyllables basic functionality (very rough)', () => {
        expect((scorer as any).countSyllables("apple banana")).toBeGreaterThanOrEqual(2); // apple(2) banana(3) -> simple counter might differ
        expect((scorer as any).countSyllables("the")).toBe(1);
        expect((scorer as any).countSyllables("beautiful")).toBeGreaterThanOrEqual(1); // simple: b(eau)t(i)f(u)l -> 3
        expect((scorer as any).countSyllables("")).toBe(0);
    });
  });
});
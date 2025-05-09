// src/main/analysis/engines/style/consistency-checker.ts

/**
 * @file Module for checking style consistency.
 */

import { IDocumentSegment, IDocumentContext } from '../../context/document-context';
import { Finding, ExtractedFeatures } from '../../types';
import { LlmService } from '../../../services/llm-service';
import * as winston from 'winston';
import appLogger from '../../../services/logger';
import { sanitizePrompts, addInstructionFencing, sanitizeLlmOutput } from '../../../../shared/utils/llm-security';
import { sanitizeError } from '../../../../shared/utils/sanitization';

// This is a very simplified representation.
// A real system might store more detailed style profiles per segment.
interface SegmentStyleProfile {
  segmentId: string;
  formality?: 'formal' | 'informal' | 'neutral';
  tense?: 'past' | 'present' | 'future' | 'mixed';
  vocabularyLevel?: 'simple' | 'intermediate' | 'advanced';
  timestamp: number; // For expiration
  // Add other relevant style features
}

const MAX_PROFILES_PER_DOCUMENT = 100; // Max number of segment profiles to keep per document
const PROFILE_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

export class ConsistencyChecker {
  private llmService?: LlmService;
  private logger: winston.Logger;
  // Store an object containing profiles and last access time for LRU-like eviction for the map itself
  private documentStyleProfiles: Map<string, { profiles: SegmentStyleProfile[], lastAccess: number }> = new Map();
  private static readonly MAX_CACHED_DOCUMENTS = 50; // Max number of documents to keep profiles for

  constructor(llmService?: LlmService, logger?: winston.Logger) {
    this.llmService = llmService;
    this.logger = logger || appLogger.child({ module: 'ConsistencyChecker' });
    this.logger.info('ConsistencyChecker initialized.');
  }

  /**
   * Checks the style consistency of the current segment against others in the document.
   * This is a placeholder and would require more sophisticated state management and comparison logic.
   * @param segment - The current document segment.
   * @param documentContext - Context of the entire document.
   * @param features - Optional pre-extracted features for this segment.
   * @returns A promise that resolves to an array of Findings.
   */
  public async check(
    segment: IDocumentSegment,
    documentContext?: IDocumentContext,
    features?: ExtractedFeatures,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];
    if (!documentContext) {
      return findings; // Cannot check consistency without document context
    }

    this.logger.debug(`Checking style consistency for segment: ${segment.id} in doc: ${documentContext.uri}`);

    // 1. Extract/determine style profile for the current segment
    const currentProfile = await this.extractSegmentProfile(segment, features);

    // 2. Retrieve or build profiles for other segments in the document
    this.manageDocumentCache(); // Evict oldest document profiles if overall cache is too large
    let docProfileData = this.documentStyleProfiles.get(documentContext.uri);

    if (!docProfileData) {
      docProfileData = { profiles: [], lastAccess: Date.now() };
      this.documentStyleProfiles.set(documentContext.uri, docProfileData);
    } else {
      docProfileData.lastAccess = Date.now();
    }

    let existingProfiles = docProfileData.profiles;

    // Remove expired profiles
    const now = Date.now();
    existingProfiles = existingProfiles.filter(p => (now - p.timestamp) < PROFILE_EXPIRATION_MS);
    docProfileData.profiles = existingProfiles;


    // 3. Compare current profile with the dominant or average profile of the document
    if (existingProfiles.length > 0) {
      // Example: Check formality consistency
      const formalCount = existingProfiles.filter(p => p.formality === 'formal').length;
      const informalCount = existingProfiles.filter(p => p.formality === 'informal').length;
      const dominantFormality = formalCount > informalCount ? 'formal' : (informalCount > formalCount ? 'informal' : 'neutral');

      if (currentProfile.formality && currentProfile.formality !== 'neutral' && dominantFormality !== 'neutral' && currentProfile.formality !== dominantFormality) {
        findings.push({
          type: 'StyleConsistency',
          message: `Inconsistent formality: Segment is '${currentProfile.formality}' while document predominantly appears '${dominantFormality}'.`,
          severity: 'warning',
          offset: 0,
          length: segment.text.length,
          suggestion: 'Ensure consistent formality throughout the document or section.',
        });
      }
      // Add more checks for tense, vocabulary, etc.
    }

    // Add/update current profile
    const profileIndex = existingProfiles.findIndex(p => p.segmentId === segment.id);
    if (profileIndex > -1) {
      existingProfiles[profileIndex] = currentProfile;
    } else {
      existingProfiles.push(currentProfile);
    }

    // Enforce max profiles per document (evict oldest if necessary)
    if (existingProfiles.length > MAX_PROFILES_PER_DOCUMENT) {
      existingProfiles.sort((a, b) => a.timestamp - b.timestamp); // Sort by oldest first
      existingProfiles.splice(0, existingProfiles.length - MAX_PROFILES_PER_DOCUMENT);
    }
    docProfileData.profiles = existingProfiles;


    return findings;
  }

  /**
   * Placeholder for extracting a style profile from a segment.
   */
  private async extractSegmentProfile(segment: IDocumentSegment, features?: ExtractedFeatures): Promise<SegmentStyleProfile> {
    // Simplified rule-based logic first
    let formality: SegmentStyleProfile['formality'] = 'neutral';
    if (segment.text.match(/\b(gonna|dude|lol)\b/i)) formality = 'informal';
    else if (segment.text.match(/\b(heretofore|shall|endeavor)\b/i)) formality = 'formal';

    let tense: SegmentStyleProfile['tense'] = 'mixed';
    // Example: if (features?.keywords?.includes('past tense indicator')) tense = 'past';

    let vocabularyLevel: SegmentStyleProfile['vocabularyLevel'] =
      (features?.wordCount && features.wordCount > 0 && segment.text.length / features.wordCount > 7)
      ? 'advanced'
      : 'intermediate';

    // Potential LLM call for more nuanced profile extraction if simple rules are insufficient
    if (this.llmService && (formality === 'neutral' || tense === 'mixed')) { // Example condition to use LLM
      try {
        const instructions = `Analyze the following text segment and provide its style profile. Focus on formality (formal, informal, neutral), primary tense (past, present, future, mixed), and vocabulary level (simple, intermediate, advanced). Format: FORMALITY: [formality], TENSE: [tense], VOCABULARY: [level]`;
        const userData = segment.text;
        const fencedPrompt = addInstructionFencing(instructions, userData);
        
        this.logger.debug(`[ConsistencyChecker] LLM prompt for profile (fenced, first 100): ${fencedPrompt.substring(0,100)}...`);
        
        // const rawLlmResponse = await this.llmService.process({ type: 'generate', input: fencedPrompt });
        // Simulate response for now
        const simulatedRawResponse = `FORMALITY: ${formality === 'neutral' ? 'formal' : formality}, TENSE: present, VOCABULARY: intermediate`; // Simulate
        const sanitizedLlmResponse = sanitizeLlmOutput(simulatedRawResponse);

        if (sanitizedLlmResponse) {
          this.logger.debug(`[ConsistencyChecker] Sanitized LLM Profile Response: ${sanitizedLlmResponse}`);
          const formalityMatch = sanitizedLlmResponse.match(/FORMALITY:\s*(\w+)/i);
          const tenseMatch = sanitizedLlmResponse.match(/TENSE:\s*(\w+)/i);
          const vocabMatch = sanitizedLlmResponse.match(/VOCABULARY:\s*(\w+)/i);

          if (formalityMatch) formality = formalityMatch[1].toLowerCase() as SegmentStyleProfile['formality'];
          if (tenseMatch) tense = tenseMatch[1].toLowerCase() as SegmentStyleProfile['tense'];
          if (vocabMatch) vocabularyLevel = vocabMatch[1].toLowerCase() as SegmentStyleProfile['vocabularyLevel'];
        } else {
          this.logger.warn(`[ConsistencyChecker] LLM profile response for segment ${segment.id} was empty after sanitization.`);
        }
      } catch (error) {
        const rawErrorMessage = error instanceof Error ? error.message : String(error);
        const sanitizedErrorMessage = sanitizeError(rawErrorMessage, 'LLM style profile extraction');
        this.logger.error(`[ConsistencyChecker] Error during LLM style profile extraction for segment ${segment.id}: ${sanitizedErrorMessage}`, { originalError: rawErrorMessage, segmentId: segment.id });
      }
    }

    return {
      segmentId: segment.id,
      formality,
      tense,
      vocabularyLevel,
      timestamp: Date.now(),
    };
  }

  private manageDocumentCache(): void {
    if (this.documentStyleProfiles.size > ConsistencyChecker.MAX_CACHED_DOCUMENTS) {
      let oldestDocUri: string | undefined;
      let oldestAccessTime = Infinity;

      for (const [uri, data] of this.documentStyleProfiles.entries()) {
        if (data.lastAccess < oldestAccessTime) {
          oldestAccessTime = data.lastAccess;
          oldestDocUri = uri;
        }
      }

      if (oldestDocUri) {
        this.documentStyleProfiles.delete(oldestDocUri);
        this.logger.info(`[ConsistencyChecker] Evicted profiles for document ${oldestDocUri} due to cache size limit.`);
      }
    }
  }

  public clearDocumentProfile(docUri: string): void {
    this.documentStyleProfiles.delete(docUri);
    this.logger.info(`Cleared style profiles for document: ${docUri}`);
  }

  // public async dispose(): Promise<void> {
  //   // Cleanup if necessary
  //   this.documentStyleProfiles.clear();
  //   this.logger.info('ConsistencyChecker disposed.');
  // }
}
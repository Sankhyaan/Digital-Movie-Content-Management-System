// =============================================================================
// CINEVERSE — COMMON USER PREFERENCE PROFILE BUILDER
// =============================================================================
// Transforms either Guided Quiz answers or Custom Requests into the canonical
// UserPreferenceProfile structure required by the recommendation engine.
// =============================================================================

import {
  GuidedQuizAnswers,
  UserPreferenceProfile,
  CANONICAL_GENRES,
  CANONICAL_LANGUAGES,
  CANONICAL_PLATFORMS
} from '../models/preferenceProfile';
import { parseCustomPrompt, parseCustomPromptSync } from './customPromptParser';
import {
  isLlmAvailable,
  parsePromptWithGemini,
  mergeProfileWithLlmDelta,
} from './llmPromptParser';

export class PreferenceProfileBuilder {
  /**
   * Constructs a UserPreferenceProfile from Guided Quiz answers.
   * Does NOT assign premature genre mappings for mood/experience options.
   */
  static buildFromGuided(answers: GuidedQuizAnswers): UserPreferenceProfile {
    return {
      source: 'guided',
      experience: answers.experience ? [answers.experience] : [],
      type: answers.type ?? null,
      genres: [],
      genre_sources: {},
      languages: [],
      platforms: [],
      runtime_preference: answers.runtime_preference ?? null,
      runtime_relation: null,
      era_preference: answers.era_preference ?? null,
      quality_preference: answers.quality_preference ?? null,
      themes: [],
      reference_titles: [],
      free_text: null,
      negative_themes: [],
      negative_genres: [],
      negative_keywords: [],
      max_runtime_minutes: null,
      min_runtime_minutes: null,
      runtime_is_hard_constraint: false,
      min_release_year: null,
      max_release_year: null,
      year_range_is_hard: false,
      actors: [],
      directors: [],
      actor_match_mode: 'all',
      negative_titles: [],
      negative_persons: [],
      negative_franchises: [],
      unresolved_references: [],
      unresolved_persons: [],
    };
  }

  /**
   * Constructs a UserPreferenceProfile by parsing a Custom Request prompt.
   * Resolves reference titles against the CineVerse MySQL database.
   * Uses Gemini LLM fallback when deterministic confidence is low.
   */
  static async buildFromCustom(
    prompt: string,
    titleResolver?: (candidate: string) => Promise<string | null> | string | null,
    enableLlmFallback: boolean = true
  ): Promise<UserPreferenceProfile> {
    const deterministicProfile = await parseCustomPrompt(prompt, titleResolver);

    // If deterministic parser determined clarification is needed, return immediately (do not guess)
    if (deterministicProfile.clarification_needed) {
      return deterministicProfile;
    }

    // Pure surprise me requests don't need LLM
    const isSurprise = Boolean(
      deterministicProfile.free_text &&
      /\b(surprise(\s+me)?|random|pick\s+for\s+me)\b/i.test(deterministicProfile.free_text) &&
      !deterministicProfile.low_confidence
    );
    if (isSurprise) {
      return deterministicProfile;
    }

    // Fast-path: only invoke LLM if available and assistance is warranted
    if (enableLlmFallback && isLlmAvailable()) {
      const hasAvoidanceOrNegation = /\b(where\s+nobody|where\s+no\s+one|where\s+nothing|where\s+none|nobody|no\s+one|nothing|without|avoid|avoiding|never|no|not|except|excluding|don't\s+want|do\s+not\s+want)\b/i.test(prompt);

      // Pure explicit director/actor requests without exclusions or nuance bypass LLM for sub-10ms response
      const isExplicitSingleEntity =
        !hasAvoidanceOrNegation &&
        (deterministicProfile.directors.length > 0 || deterministicProfile.actors.length > 0) &&
        deterministicProfile.unresolved_persons.length === 0 &&
        deterministicProfile.unresolved_references.length === 0 &&
        !deterministicProfile.low_confidence &&
        !/\b(like|similar|shorter|longer|vibe|mood|cozy|recommend|something|instead|rather)\b/i.test(prompt);

      const needsLlmAssistance =
        !isExplicitSingleEntity &&
        (
          hasAvoidanceOrNegation ||
          deterministicProfile.low_confidence ||
          deterministicProfile.unresolved_references.length > 0 ||
          deterministicProfile.unresolved_persons.length > 0 ||
          (
            deterministicProfile.genres.length === 0 &&
            deterministicProfile.actors.length === 0 &&
            deterministicProfile.directors.length === 0 &&
            deterministicProfile.reference_titles.length === 0 &&
            deterministicProfile.themes.length === 0
          ) ||
          /\b(like|similar|shorter|longer|vibe|mood|cozy|feel|tone|narrative|reveal|ending)\b/i.test(prompt)
        );

      if (needsLlmAssistance) {
        try {
          const llmDelta = await parsePromptWithGemini(prompt, 4000);
          if (llmDelta) {
            return mergeProfileWithLlmDelta(deterministicProfile, llmDelta);
          }
        } catch (e: any) {
          console.warn('[PreferenceProfileBuilder] LLM fallback bypassed:', e.message);
        }
      }
    }

    return deterministicProfile;
  }

  /**
   * Synchronous variant for offline or unit test execution with optional mock resolver.
   */
  static buildFromCustomSync(
    prompt: string,
    syncResolver?: (candidate: string) => string | null
  ): UserPreferenceProfile {
    return parseCustomPromptSync(prompt, syncResolver);
  }

  /**
   * Validates that a UserPreferenceProfile adheres to canonical taxonomy constraints.
   */
  static validate(profile: UserPreferenceProfile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (profile.source !== 'guided' && profile.source !== 'custom') {
      errors.push(`Invalid source: "${profile.source}"`);
    }

    if (profile.type !== 'Movie' && profile.type !== 'Series' && profile.type !== null) {
      errors.push(`Invalid type: "${profile.type}"`);
    }

    // Verify all genres exist in the 25-genre canonical taxonomy
    const validGenreSet = new Set<string>(CANONICAL_GENRES);
    for (const g of profile.genres) {
      if (!validGenreSet.has(g)) {
        errors.push(`Non-canonical genre detected: "${g}"`);
      }
    }

    // Verify all platforms exist in the 12-platform canonical taxonomy
    const validPlatSet = new Set<string>(CANONICAL_PLATFORMS);
    for (const p of profile.platforms) {
      if (!validPlatSet.has(p)) {
        errors.push(`Non-canonical platform detected: "${p}"`);
      }
    }

    // Verify all languages exist in the 38-language canonical taxonomy
    const validLangSet = new Set<string>(CANONICAL_LANGUAGES);
    for (const l of profile.languages) {
      if (!validLangSet.has(l)) {
        errors.push(`Non-canonical language detected: "${l}"`);
      }
    }

    // Verify runtime_relation
    if (
      profile.runtime_relation !== 'shorter_than_reference' &&
      profile.runtime_relation !== 'longer_than_reference' &&
      profile.runtime_relation !== null
    ) {
      errors.push(`Invalid runtime_relation: "${profile.runtime_relation}"`);
    }

    // Verify reference_titles
    if (!Array.isArray(profile.reference_titles)) {
      errors.push('reference_titles must be an array');
    }

    if (!Array.isArray(profile.negative_titles)) profile.negative_titles = [];
    if (!Array.isArray(profile.negative_persons)) profile.negative_persons = [];
    if (!Array.isArray(profile.negative_franchises)) profile.negative_franchises = [];
    if (!Array.isArray(profile.unresolved_references)) profile.unresolved_references = [];
    if (!Array.isArray(profile.unresolved_persons)) profile.unresolved_persons = [];

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

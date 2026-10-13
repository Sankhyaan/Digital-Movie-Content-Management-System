// =============================================================================
// CINEVERSE RECOMMENDATION ENGINE — HYBRID SCORER & ACTIVE-WEIGHT RENORMALIZATION
// =============================================================================
// Combines independent feature scores into a unified composite hybrid score.
// Dynamically renormalizes active weights so inactive dimensions never penalize
// candidates. Implements controlled discovery for minimal / surprise-me profiles.
// =============================================================================

import { MovieDNA } from '../../models/interfaces';
import { UserPreferenceProfile } from '../../models/preferenceProfile';
import { INITIAL_WEIGHTS } from './weights';
import { RecommendationWeights, ScoreBreakdown, ScoredCandidate } from './types';
import { FeatureScorer } from './featureScorer';
import { EmbeddingStore } from './embeddingStore';

export class HybridScorer {
  /**
   * Computes dynamic active weights renormalized to 100% (1.0).
   */
  public static computeActiveWeights(profile: UserPreferenceProfile): RecommendationWeights {
    const rawWeights: RecommendationWeights = {
      semantic:   INITIAL_WEIGHTS.semantic, // Always active
      experience: (profile.experience && profile.experience.length > 0) ? INITIAL_WEIGHTS.experience : 0,
      genre:      (profile.genres && profile.genres.length > 0) ? INITIAL_WEIGHTS.genre : 0,
      reference:  (profile.reference_titles && profile.reference_titles.length > 0) ? INITIAL_WEIGHTS.reference : 0,
      runtime:    (profile.runtime_preference || profile.runtime_relation || profile.max_runtime_minutes !== null || profile.min_runtime_minutes !== null) ? INITIAL_WEIGHTS.runtime : 0,
      era:        ((profile.era_preference && profile.era_preference !== 'any') || profile.min_release_year !== null || profile.max_release_year !== null) ? INITIAL_WEIGHTS.era : 0,
      quality:    (profile.quality_preference !== null) ? INITIAL_WEIGHTS.quality : 0,
      language:   (profile.languages && profile.languages.length > 0) ? INITIAL_WEIGHTS.language : 0,
      platform:   (profile.platforms && profile.platforms.length > 0) ? INITIAL_WEIGHTS.platform : 0,
    };

    const sum = Object.values(rawWeights).reduce((acc, w) => acc + w, 0);

    if (sum === 0) {
      return { ...INITIAL_WEIGHTS };
    }

    // Renormalize so active weights sum strictly to 1.0
    return {
      semantic:   rawWeights.semantic / sum,
      experience: rawWeights.experience / sum,
      genre:      rawWeights.genre / sum,
      reference:  rawWeights.reference / sum,
      runtime:    rawWeights.runtime / sum,
      era:        rawWeights.era / sum,
      quality:    rawWeights.quality / sum,
      language:   rawWeights.language / sum,
      platform:   rawWeights.platform / sum,
    };
  }

  /**
   * Checks if the profile is essentially a minimal / surprise-me profile with no explicit constraints.
   */
  public static isSurpriseMe(profile: UserPreferenceProfile): boolean {
    // 1. Strict guard: If ANY explicit entity or constraint exists, it is NEVER Surprise Me!
    if (
      (profile.directors && profile.directors.length > 0) ||
      (profile.actors && profile.actors.length > 0) ||
      (profile.reference_titles && profile.reference_titles.length > 0) ||
      (profile.genres && profile.genres.length > 0) ||
      (profile.themes && profile.themes.length > 0) ||
      (profile.languages && profile.languages.length > 0) ||
      (profile.platforms && profile.platforms.length > 0) ||
      (profile.experience && profile.experience.length > 0) ||
      (profile.negative_persons && profile.negative_persons.length > 0) ||
      (profile.negative_titles && profile.negative_titles.length > 0) ||
      (profile.negative_franchises && profile.negative_franchises.length > 0) ||
      (profile.negative_genres && profile.negative_genres.length > 0) ||
      (profile.negative_themes && profile.negative_themes.length > 0) ||
      (profile.negative_keywords && profile.negative_keywords.length > 0) ||
      (profile.type !== null && profile.type !== undefined) ||
      profile.runtime_preference !== null ||
      profile.runtime_relation !== null ||
      profile.max_runtime_minutes !== null ||
      profile.min_runtime_minutes !== null ||
      profile.min_release_year !== null ||
      profile.max_release_year !== null ||
      (profile.era_preference && profile.era_preference !== 'any') ||
      profile.quality_preference !== null
    ) {
      return false;
    }

    const text = (profile.free_text || '').toLowerCase().trim();
    if (!text) {
      return true;
    }
    return /\b(surprise(\s+me)?|random|pick\s+for\s+me)\b/i.test(text);
  }

  /**
   * Scores a candidate across all features and calculates the composite hybrid score.
   */
  public static scoreCandidate(
    dna: MovieDNA,
    profile: UserPreferenceProfile,
    queryVector: number[] | null,
    refProfiles: import('./types').ReferenceProfile[],
    refDuration: number | null,
    weights: RecommendationWeights,
    store: EmbeddingStore,
    negativeQueryVector: number[] | null = null
  ): ScoredCandidate {
    // 1. Calculate individual feature scores
    const semantic_score   = FeatureScorer.scoreSemantic(dna.content_id, queryVector, store);
    const experience_score = FeatureScorer.scoreExperience(dna, profile, semantic_score);
    const genre_score      = FeatureScorer.scoreGenre(dna, profile);
    const refResult        = FeatureScorer.scoreReference(dna, refProfiles, store);
    const reference_score  = refResult.combined_score;
    const runtime_score    = FeatureScorer.scoreRuntime(dna, profile, refDuration);
    const era_score        = FeatureScorer.scoreEra(dna, profile);
    const quality_score    = FeatureScorer.scoreQuality(dna, profile);
    const language_score   = FeatureScorer.scoreLanguage(dna, profile);
    const platform_score   = FeatureScorer.scorePlatform(dna, profile);
    const actor_bonus      = FeatureScorer.scoreActorBonus(dna, profile);
    const director_bonus   = FeatureScorer.scoreDirectorBonus(dna, profile);

    // Negative semantic penalty (soft ranking penalty against negative themes/keywords)
    let negative_penalty = 0;
    let negative_match = 0;
    if (negativeQueryVector) {
      negative_match = FeatureScorer.scoreSemantic(dna.content_id, negativeQueryVector, store);
      if (negative_match > 0.55) {
        negative_penalty = Math.min(0.25, Math.max(0, (negative_match - 0.50) * 0.50));
      }
    }

    // General negative penalty: penalize candidates containing any genre or theme the user asked to avoid
    const avoidedThemesAndKeywords = [
      ...(profile.negative_themes || []),
      ...(profile.negative_keywords || [])
    ].map((t) => t.toLowerCase().trim()).filter(Boolean);

    if (avoidedThemesAndKeywords.length > 0) {
      const candidateGenres = (dna.genres || []).map((g) => g.toLowerCase());
      const candidateDesc = (dna.description || '').toLowerCase();
      const candidateTitle = (dna.title || '').toLowerCase();
      const hasConflict = avoidedThemesAndKeywords.some((term) => {
        const inGenre = candidateGenres.some((cg) => cg.includes(term) || term.includes(cg));
        const termEscaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Word boundary matching prevents false positives (e.g. 'skill' matching 'kill', 'soldier' matching 'die')
        const inTitle = term.length <= 3
          ? new RegExp(`\\b${termEscaped}\\b`, 'i').test(candidateTitle)
          : new RegExp(`\\b${termEscaped}`, 'i').test(candidateTitle);
        const inDesc = term.length <= 3
          ? new RegExp(`\\b${termEscaped}\\b`, 'i').test(candidateDesc)
          : new RegExp(`\\b${termEscaped}`, 'i').test(candidateDesc);
        const thematicGenreConflict =
          /trauma|traumatic|violent|violence|scary|horror|disturbing|gore|nightmare|murder|kill|death|abuse/i.test(term) &&
          candidateGenres.some((cg) => ['horror', 'thriller', 'crime', 'war', 'war & politics'].includes(cg)) &&
          (inDesc || inTitle || /murder|killer|killing|victim|death|abuse|violent|violence|corpse|slay/i.test(candidateDesc));
        return inGenre || inTitle || inDesc || thematicGenreConflict;
      });
      if (hasConflict) {
        negative_penalty = Math.max(negative_penalty, 0.75);
      }
    }

    const breakdown: ScoreBreakdown = {
      semantic:   Number(semantic_score.toFixed(3)),
      experience: Number(experience_score.toFixed(3)),
      genre:      Number(genre_score.toFixed(3)),
      reference:  Number(reference_score.toFixed(3)),
      runtime:    Number(runtime_score.toFixed(3)),
      era:        Number(era_score.toFixed(3)),
      quality:    Number(quality_score.toFixed(3)),
      language:   Number(language_score.toFixed(3)),
      platform:   Number(platform_score.toFixed(3)),
      negative_penalty: negative_penalty > 0 ? Number(negative_penalty.toFixed(3)) : undefined,
      negative_match: negative_match > 0 ? Number(negative_match.toFixed(3)) : undefined,
      reference_details: refResult.breakdown,
    };

    // 2. Linear combination using normalized active weights
    let composite =
      weights.semantic   * semantic_score +
      weights.experience * experience_score +
      weights.genre      * genre_score +
      weights.reference  * reference_score +
      weights.runtime    * runtime_score +
      weights.era        * era_score +
      weights.quality    * quality_score +
      weights.language   * language_score +
      weights.platform   * platform_score +
      actor_bonus +
      director_bonus;

    // Apply negative penalty
    composite = Math.max(0, Math.min(1, composite - negative_penalty));

    return {
      content_id: dna.content_id,
      dna,
      semantic_score,
      experience_score,
      genre_score,
      reference_score,
      runtime_score,
      era_score,
      quality_score,
      language_score,
      platform_score,
      actor_bonus,
      director_bonus,
      raw_score: composite,
      hybrid_score: Number(composite.toFixed(4)),
      score_breakdown: breakdown,
      reference_details: refResult.breakdown,
      active_weights: weights,
      match_reasons: [], // Will be populated by ExplanationGenerator
    };
  }
}

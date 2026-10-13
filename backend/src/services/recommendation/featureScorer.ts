// =============================================================================
// CINEVERSE RECOMMENDATION ENGINE — FEATURE SCORER
// =============================================================================
// Calculates individual, normalized [0.0, 1.0] feature scores across every
// independent signal (semantic, experience, genre, reference, runtime, era,
// quality, language, platform, and actor bonus).
//
// Adheres strictly to missing data handling and smooth curve constraints.
// =============================================================================

import { MovieDNA } from '../../models/interfaces';
import { UserPreferenceProfile } from '../../models/preferenceProfile';
import { EmbeddingStore } from './embeddingStore';

// Weak positive genre priors for experiences (NOT 1-to-1 hardcoded mappings)
const EXPERIENCE_GENRE_PRIORS: Record<string, string[]> = {
  thought_provoking: ['Sci-Fi & Fantasy', 'Mystery', 'Documentary', 'Drama', 'Thriller', 'History'],
  funny:             ['Comedy', 'Animation', 'Family'],
  thrilling:         ['Thriller', 'Action', 'Mystery', 'Crime', 'Horror'],
  emotional:         ['Drama', 'Romance', 'Family', 'Animation', 'Documentary', 'War'],
  escapist:          ['Adventure', 'Fantasy', 'Sci-Fi & Fantasy', 'Animation'],
};

export class FeatureScorer {
  /**
   * 1. Semantic Content Score:
   * Cosine similarity between user query vector and movie embedding.
   */
  public static scoreSemantic(
    contentId: number,
    queryVector: number[] | null,
    store: EmbeddingStore
  ): number {
    if (!queryVector || queryVector.length === 0) {
      return 0.5; // neutral fallback
    }
    return store.getSimilarity(contentId, queryVector);
  }

  /**
   * 2. Experience Intent Score:
   * Combines semantic content score with weak genre priors.
   */
  public static scoreExperience(
    dna: MovieDNA,
    profile: UserPreferenceProfile,
    semanticScore: number
  ): number {
    if (!profile.experience || profile.experience.length === 0) {
      return 0.5;
    }

    // Check for prior overlap
    let priorMatches = 0;
    let totalPriors = 0;

    for (const exp of profile.experience) {
      const priors = EXPERIENCE_GENRE_PRIORS[exp] || [];
      totalPriors += priors.length;
      for (const g of dna.genres) {
        if (priors.includes(g)) {
          priorMatches++;
        }
      }
    }

    const priorRatio = totalPriors > 0 ? Math.min(1.0, priorMatches / 2) : 0;
    // Semantic evidence accounts for 80%, weak prior accounts for 20%
    const score = 0.80 * semanticScore + 0.20 * priorRatio;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 3. Explicit Genre Score:
   * Measures overlap with user's explicitly requested canonical genres.
   */
  public static scoreGenre(dna: MovieDNA, profile: UserPreferenceProfile): number {
    if (!profile.genres || profile.genres.length === 0) {
      return 0.5; // Neutral when no explicit genre requested
    }

    if (!dna.genres || dna.genres.length === 0) {
      return 0.2; // Minor penalty only because user explicitly wanted a genre
    }

    const matchCount = profile.genres.filter((g) => dna.genres.includes(g)).length;
    return matchCount / profile.genres.length;
  }

  /**
   * 4. Reference Title Affinity Score:
   * Combines reference embedding similarity (75%) + reference genre overlap (25%)
   * with soft format alignment (10% adjustment when format differs).
   */
  public static scoreReference(
    candidate: MovieDNA,
    refProfiles: import('./types').ReferenceProfile[],
    store: EmbeddingStore
  ): {
    combined_score: number;
    breakdown?: import('./types').ReferenceAffinityBreakdown;
  } {
    if (!refProfiles || refProfiles.length === 0) {
      return { combined_score: 0.5 };
    }

    // Exclude reference title itself from competing with its own recommendations
    if (refProfiles.some((r) => r.content_id === candidate.content_id)) {
      return { combined_score: 0.0 };
    }

    let bestScore = -1;
    let bestBreakdown: import('./types').ReferenceAffinityBreakdown | undefined = undefined;

    for (const ref of refProfiles) {
      // 4a. Reference Semantic Similarity
      const rawSim = store.getInterItemSimilarity(candidate.content_id, ref.content_id);
      const semanticSim = Math.max(0, Math.min(1, rawSim));

      // 4b. Reference-Aware Genre Prior
      // Uses Jaccard-like normalization: overlap / union of both genre sets.
      // This prevents multi-genre reference titles from deflating affinity unfairly
      // vs. single-genre references (old denominator-only division was asymmetric).
      let genreAffinity = 0.5;
      if (ref.genres && ref.genres.length > 0 && candidate.genres) {
        if (candidate.genres.length === 0) {
          genreAffinity = 0.5; // Missing candidate genre data is neutral
        } else {
          const matchCount = ref.genres.filter((g) => candidate.genres.includes(g)).length;
          // Jaccard: intersection / union — fair across all genre set sizes
          const unionCount = new Set([...ref.genres, ...candidate.genres]).size;
          genreAffinity = unionCount > 0 ? Math.min(1.0, matchCount / unionCount) : 0.5;
        }
      }

      // 4c. Soft Reference Type / Format Alignment (Movie vs Series)
      const formatAlignment = candidate.type === ref.type ? 1.0 : 0.90;

      // 4d. Combined Reference Affinity
      const baseAffinity = 0.75 * semanticSim + 0.25 * genreAffinity;
      const combinedAffinity = Math.max(0, Math.min(1, baseAffinity * formatAlignment));

      if (combinedAffinity > bestScore) {
        bestScore = combinedAffinity;
        bestBreakdown = {
          reference_title: ref.title,
          semantic_similarity: Number(semanticSim.toFixed(3)),
          genre_affinity: Number(genreAffinity.toFixed(3)),
          format_alignment: Number(formatAlignment.toFixed(3)),
          combined_affinity: Number(combinedAffinity.toFixed(3)),
        };
      }
    }

    return {
      combined_score: bestScore >= 0 ? bestScore : 0.5,
      breakdown: bestBreakdown,
    };
  }

  /**
   * 5. Runtime Fit Score (Movies & Series + Reference Relation):
   */
  public static scoreRuntime(
    dna: MovieDNA,
    profile: UserPreferenceProfile,
    refDuration: number | null
  ): number {
    // 5a. Relative Runtime Relation to Reference Title
    if (profile.runtime_relation) {
      if (refDuration === null || refDuration <= 0) {
        return 0.5; // Missing reference runtime is neutral (Edge Case F)
      }

      const candDuration = dna.type === 'Movie' ? dna.runtime : dna.series_metadata?.avg_episode_duration;
      if (candDuration === null || candDuration === undefined || candDuration <= 0) {
        return 0.5; // Missing data neutral
      }

      if (profile.runtime_relation === 'shorter_than_reference') {
        if (candDuration < refDuration) {
          // Strong fit for being shorter than reference (e.g. < 169m for Interstellar)
          const diff = refDuration - candDuration;
          return Math.min(1.0, 0.85 + Math.min(0.15, diff / 60));
        } else {
          // Smooth decay if longer than reference
          const penalty = (candDuration - refDuration) / 60;
          return Math.max(0.1, 0.7 - penalty * 0.4);
        }
      } else if (profile.runtime_relation === 'longer_than_reference') {
        if (candDuration > refDuration) {
          return 1.0;
        } else {
          const penalty = (refDuration - candDuration) / 60;
          return Math.max(0.1, 0.7 - penalty * 0.4);
        }
      }
    }

    // 5b. Absolute Movie Runtime
    if (dna.type === 'Movie') {
      const runtime = dna.runtime;
      if (!runtime || runtime <= 0) {
        return 0.5; // Missing duration neutral
      }

      // Exact numeric runtime constraints take highest precedence if provided
      if (profile.max_runtime_minutes !== null) {
        if (runtime <= profile.max_runtime_minutes) {
          const headroom = profile.max_runtime_minutes - runtime;
          return Math.min(1.0, 0.90 + Math.min(0.10, headroom / 30));
        } else {
          const excess = runtime - profile.max_runtime_minutes;
          return Math.max(0.1, 0.85 - excess / 30);
        }
      }

      switch (profile.runtime_preference) {
        case 'under_2_hours':
          if (runtime <= 115) return 1.0;
          if (runtime <= 125) return 0.85;
          return Math.max(0.1, 1.0 - (runtime - 115) / 60);

        case 'around_2_hours': {
          const diff = Math.abs(runtime - 120);
          if (diff <= 10) return 1.0;
          if (diff <= 25) return 0.90;
          return Math.max(0.2, 1.0 - (diff / 70));
        }

        case 'long_movie_ok':
          if (runtime >= 120) return 1.0;
          return 0.85; // No penalty for shorter, but long is rewarded

        case 'binge_series':
          return 0.4; // User wanted a series binge

        case 'no_preference':
        default:
          return 1.0;
      }
    }

    // 5c. Series Runtime / Structure
    if (dna.type === 'Series') {
      const meta = dna.series_metadata;

      switch (profile.runtime_preference) {
        case 'binge_series': {
          if (!meta) return 0.7; // Unindexed episodes still acceptable
          const seasons = meta.total_seasons || 1;
          const episodes = meta.total_episodes || 0;
          if (seasons >= 3 || episodes >= 25) return 1.0;
          if (seasons >= 2 || episodes >= 12) return 0.85;
          return 0.70;
        }

        case 'under_2_hours':
          // Short episodic comedies / miniseries
          if (meta?.avg_episode_duration && meta.avg_episode_duration <= 35) return 0.9;
          return 0.6;

        case 'no_preference':
        default:
          return 1.0;
      }
    }

    return 1.0;
  }

  /**
   * 6. Era Score:
   * Smooth preference curve for temporal periods, with exact year range support.
   */
  public static scoreEra(dna: MovieDNA, profile: UserPreferenceProfile): number {
    const year = dna.release_year;
    if (!year) {
      return 1.0;
    }

    // Exact numeric release year bounds take precedence when provided
    if (profile.min_release_year !== null || profile.max_release_year !== null) {
      const min = profile.min_release_year ?? 0;
      const max = profile.max_release_year ?? 9999;
      if (year >= min && year <= max) {
        return 1.0;
      }
      const dist = year < min ? min - year : year - max;
      return Math.max(0.1, 1.0 - dist * 0.15);
    }

    if (!profile.era_preference || profile.era_preference === 'any') {
      return 1.0;
    }

    switch (profile.era_preference) {
      case 'recent': // 2020+
        if (year >= 2020) return 1.0;
        if (year === 2019) return 0.90;
        if (year >= 2015) return 0.75;
        if (year >= 2000) return 0.50;
        return 0.25;

      case 'modern': // 2000-2019
        if (year >= 2000 && year <= 2019) return 1.0;
        if (year >= 2020) return 0.80; // Contemporary still decent
        if (year >= 1990) return 0.70;
        return 0.40;

      case 'classic': // Pre-2000
        if (year < 1995) return 1.0;
        if (year < 2000) return 0.90;
        if (year < 2010) return 0.50;
        return 0.20;

      default:
        return 1.0;
    }
  }

  /**
   * 7. Quality Score:
   * Scales rating by user's quality preference / weight.
   * Unreleased titles are explicitly protected via quality_flags.is_unreleased.
   */
  public static scoreQuality(dna: MovieDNA, profile: UserPreferenceProfile): number {
    // Protect unreleased titles with rating = 0
    if (dna.quality_flags?.is_unreleased || (dna.rating === 0 && dna.release_year && dna.release_year >= 2026)) {
      return 0.80; // High default expectation for anticipated unreleased titles
    }

    const rawRating = dna.rating !== null && dna.rating !== undefined ? dna.rating : 6.5;
    const baseScore = Math.max(0, Math.min(1, rawRating / 10));

    switch (profile.quality_preference) {
      case 'high':
        // High importance: rewards ratings >= 8.0 heavily
        return Math.min(1.0, Math.pow(baseScore, 1.4) * 1.25);

      case 'medium':
        // Moderate importance
        return baseScore;

      case 'low':
      default:
        // Rating has low importance (NEVER prefer low rated; provides high neutral baseline)
        return 0.70 + 0.30 * baseScore;
    }
  }

  /**
   * 8. Explicit Language Score:
   */
  public static scoreLanguage(dna: MovieDNA, profile: UserPreferenceProfile): number {
    if (!profile.languages || profile.languages.length === 0) {
      return 0.5; // Inactive
    }
    const matches = profile.languages.some((l) => dna.languages.includes(l));
    return matches ? 1.0 : 0.0;
  }

  /**
   * 9. Explicit Platform Score:
   */
  public static scorePlatform(dna: MovieDNA, profile: UserPreferenceProfile): number {
    if (!profile.platforms || profile.platforms.length === 0) {
      return 0.5; // Inactive
    }
    const matches = profile.platforms.some((p) => dna.platforms.includes(p));
    return matches ? 1.0 : 0.0;
  }

  /**
   * 10. Actor Bonus:
   * Provides a small tie-breaking bonus when an explicit actor request matches.
   * If no actors were requested, returns 0.0 unconditionally so unrequested
   * metadata does not distort rankings.
   */
  public static scoreActorBonus(dna: MovieDNA, profile: UserPreferenceProfile): number {
    if (!profile.actors || profile.actors.length === 0) {
      return 0.0;
    }
    if (!dna.actors || dna.actors.length === 0) {
      return 0.0;
    }
    const mode = profile.actor_match_mode || 'all';
    if (mode === 'any') {
      const match = profile.actors.some((reqActor) =>
        dna.actors.some((a) => a.toLowerCase() === reqActor.toLowerCase())
      );
      return match ? 0.02 : 0.0;
    } else {
      const match = profile.actors.every((reqActor) =>
        dna.actors.some((a) => a.toLowerCase() === reqActor.toLowerCase())
      );
      return match ? 0.02 : 0.0;
    }
  }

  /**
   * 11. Director Bonus:
   * Provides a tie-breaking bonus when an explicit director request matches.
   */
  public static scoreDirectorBonus(dna: MovieDNA, profile: UserPreferenceProfile): number {
    if (!profile.directors || profile.directors.length === 0) {
      return 0.0;
    }
    if (!dna.directors || dna.directors.length === 0) {
      return 0.0;
    }
    const match = profile.directors.some((reqDir) =>
      dna.directors.some((d) => d.toLowerCase() === reqDir.toLowerCase())
    );
    return match ? 0.02 : 0.0;
  }
}

// =============================================================================
// CINEVERSE — COMMON USER PREFERENCE PROFILE
// =============================================================================
// Defines the unified representation produced by both the Guided Quiz mode
// and the Custom Request mode for consumption by the recommendation engine.
// =============================================================================

export type ExperiencePreference =
  | 'thought_provoking'
  | 'funny'
  | 'thrilling'
  | 'emotional'
  | 'escapist';

export type RuntimePreference =
  | 'under_2_hours'
  | 'around_2_hours'
  | 'long_movie_ok'
  | 'binge_series'
  | 'no_preference';

export type RuntimeRelation =
  | 'shorter_than_reference'
  | 'longer_than_reference'
  | null;

export type EraPreference =
  | 'recent'
  | 'modern'
  | 'classic'
  | 'any';

/**
 * Quality Preference defines the importance / weighting of ratings:
 * - 'high'   = rating has high importance (prioritizes highest-rated / acclaimed titles)
 * - 'medium' = rating has medium importance (prioritizes well-reviewed / solid titles)
 * - 'low'    = rating has low importance (ratings don't matter much / open to any rating)
 *
 * CRITICAL: 'low' NEVER means prefer low-rated movies. It signifies low rating importance.
 */
export type QualityPreference =
  | 'high'
  | 'medium'
  | 'low';

/** Optional alias representing quality weighting */
export type QualityWeight = QualityPreference;

export interface UserPreferenceProfile {
  source: 'guided' | 'custom';
  experience: string[];
  type: 'Movie' | 'Series' | null;
  genres: string[];
  genre_sources?: Record<string, 'user' | 'quiz' | 'llm'>;
  languages: string[];
  platforms: string[];
  runtime_preference: RuntimePreference | null;
  runtime_relation: RuntimeRelation;
  era_preference: EraPreference | null;
  quality_preference: QualityPreference | null;
  themes: string[];
  reference_titles: string[];
  free_text: string | null;

  // Quality Tuning Phase 2 Extensions:
  negative_themes: string[];
  negative_genres: string[];
  negative_keywords: string[];

  // Exact runtime constraints:
  max_runtime_minutes: number | null;
  min_runtime_minutes: number | null;
  runtime_is_hard_constraint: boolean;

  // Exact release year ranges:
  min_release_year: number | null;
  max_release_year: number | null;
  year_range_is_hard: boolean;

  // Actor & Director Support
  actors: string[];
  directors: string[];
  actor_match_mode?: 'all' | 'any';

  // Negative Entity Fields (Phase 1 Extensions)
  negative_titles: string[];
  negative_persons: string[];
  negative_franchises: string[];

  // Unresolved Entity Diagnostics (Phase 1 Extensions)
  unresolved_references: string[];
  unresolved_persons: string[];

  // Diagnostic flags
  is_degraded?: boolean;
  low_confidence?: boolean;

  // Explicit polarity item representation (Phase 1)
  extracted_items?: ExtractedItem[];

  // Entity Resolution & Disambiguation (Phase 3)
  resolved_entities?: ResolvedEntity[];
  ambiguous_entities?: AmbiguousEntity[];
  clarification_needed?: boolean;
  clarification_message?: string;
  franchise_unverified_note?: string;
}

export interface ResolvedEntity {
  entity_type: 'title' | 'director' | 'actor' | 'franchise';
  matched_id: number | null;
  name: string;
  match_method: 'exact' | 'normalized' | 'surname' | 'fuzzy' | 'disambiguated';
  confidence: number;
}

export interface AmbiguousEntity {
  entity_type: 'title' | 'person';
  raw_query: string;
  candidates: Array<{
    id: number;
    name: string;
    release_year?: number;
    type?: string;
  }>;
  message: string;
}

export type ItemPolarity = 'positive' | 'negative' | 'unresolved';

export interface ExtractedItem {
  raw: string;
  normalized: string;
  category:
    | 'genre'
    | 'theme'
    | 'person'
    | 'title'
    | 'franchise'
    | 'language'
    | 'platform'
    | 'era'
    | 'runtime'
    | 'experience'
    | 'other';
  polarity: ItemPolarity;
  evidence?: string;
  confidence?: number;
}

export interface GuidedQuizAnswers {
  experience: ExperiencePreference | null;
  type: 'Movie' | 'Series' | null;
  runtime_preference: RuntimePreference | null;
  era_preference: EraPreference | null;
  quality_preference: QualityPreference | null;
}

// Canonical Database Vocabularies
export const CANONICAL_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History',
  'Horror', 'Kids', 'Music', 'Mystery', 'News',
  'Reality', 'Romance', 'Sci-Fi & Fantasy', 'Soap', 'Talk',
  'Thriller', 'TV Movie', 'War', 'War & Politics', 'Western'
] as const;

export const CANONICAL_PLATFORMS = [
  'Apple TV+', 'Amazon Prime Video', 'Disney+', 'Netflix',
  'Max', 'Paramount+', 'Google Play Movies', 'JioHotstar',
  'YouTube', 'Crunchyroll', 'Sony Liv', 'Zee5'
] as const;

export const CANONICAL_LANGUAGES = [
  'Arabic', 'Bengali', 'Catalan', 'Chinese', 'Czech', 'Danish', 'Dutch', 'English',
  'Filipino', 'Finnish', 'French', 'German', 'Greek', 'Hebrew', 'Hindi', 'Hungarian',
  'Indonesian', 'Italian', 'Japanese', 'Javanese', 'Kannada', 'Korean', 'Latvian',
  'Mongolian', 'Norwegian', 'Persian', 'Polish', 'Portuguese', 'Punjabi', 'Russian',
  'Serbian', 'Spanish', 'Swedish', 'Tamil', 'Telugu', 'Thai', 'Turkish', 'Zulu'
] as const;

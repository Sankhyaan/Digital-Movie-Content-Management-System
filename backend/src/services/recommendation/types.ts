// =============================================================================
// CINEVERSE RECOMMENDATION ENGINE — TYPES & INTERFACES
// =============================================================================

import { MovieDNA } from '../../models/interfaces';
import { UserPreferenceProfile } from '../../models/preferenceProfile';

export interface ReferenceProfile {
  content_id: number;
  title: string;
  type: 'Movie' | 'Series';
  genres: string[];
  runtime: number | null;
  description: string | null;
}

export interface ReferenceAffinityBreakdown {
  reference_title: string;
  semantic_similarity: number;
  genre_affinity: number;
  format_alignment: number;
  combined_affinity: number;
}

export interface ScoreBreakdown {
  semantic: number;
  experience: number;
  genre: number;
  reference: number;
  runtime: number;
  era: number;
  quality: number;
  language: number;
  platform: number;
  negative_penalty?: number;
  negative_match?: number;
  reference_details?: ReferenceAffinityBreakdown;
}

export interface RecommendationWeights {
  semantic: number;
  experience: number;
  genre: number;
  reference: number;
  runtime: number;
  era: number;
  quality: number;
  language: number;
  platform: number;
}

export interface ScoredCandidate {
  content_id: number;
  dna: MovieDNA;
  semantic_score: number;
  experience_score: number;
  genre_score: number;
  reference_score: number;
  runtime_score: number;
  era_score: number;
  quality_score: number;
  language_score: number;
  platform_score: number;
  actor_bonus: number;
  director_bonus?: number;
  raw_score: number;
  hybrid_score: number;
  score_breakdown: ScoreBreakdown;
  reference_details?: ReferenceAffinityBreakdown;
  active_weights: RecommendationWeights;
  match_reasons: string[];
}

export interface RecommendationResult {
  content_id: number;
  title: string;
  type: 'Movie' | 'Series';
  poster_path: string | null;
  rating: number | null;
  release_year: number | null;
  genres?: string[];
  directors?: string[];
  actors?: string[];
  recommendation_score: number; // 0.0 to 1.0
  match_percentage: number;     // 0 to 100 integer
  score_breakdown: ScoreBreakdown;
  reference_details?: ReferenceAffinityBreakdown;
  match_reasons: string[];
}

export interface RecommendationResponse {
  success: boolean;
  count: number;
  recommendations: RecommendationResult[];
  clarification_needed?: boolean;
  message?: string;
  debug?: RecommendationDebugInfo;
}

export interface RecommendationDebugInfo {
  candidate_pool_size: number;
  top_candidates?: Array<{
    content_id: number;
    title: string;
    hybrid_score: number;
  }>;
  active_weights: RecommendationWeights;
  execution_time_ms: {
    query_embedding_ms: number;
    candidate_retrieval_ms: number;
    feature_scoring_ms: number;
    total_ms: number;
  };
}

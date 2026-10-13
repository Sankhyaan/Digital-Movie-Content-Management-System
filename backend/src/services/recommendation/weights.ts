// =============================================================================
// CINEVERSE RECOMMENDATION ENGINE — INITIAL HEURISTIC WEIGHTS
// =============================================================================
// Baseline weights defining initial importance of each independent signal.
//
// IMPORTANT: These weights are initial heuristic weights and hypotheses.
// Unused/inactive dimensions are automatically renormalized dynamically
// by the Active-Weight Renormalization layer.
// =============================================================================

import { RecommendationWeights } from './types';

export const INITIAL_WEIGHTS: RecommendationWeights = {
  semantic:   0.25, // Semantic content / story embedding similarity
  experience: 0.10, // Emotional & experience intent (weak prior + semantic intent)
  genre:      0.15, // Explicit canonical genre taxonomy overlap
  reference:  0.20, // Similarity to explicit reference titles (e.g. Interstellar) — raised from 0.10
  runtime:    0.10, // Absolute or relative runtime duration fit
  era:        0.07, // Release period temporal fit (recent / modern / classic)
  quality:    0.07, // TMDB rating weighted by user quality tolerance
  language:   0.03, // Canonical language match
  platform:   0.03, // Streaming provider availability match
};

/**
 * Recommendation ranking configuration
 */
export const RECOMMENDATION_CONFIG = {
  topKSelection: 20,   // Final Top 20 recommendations returned to user
};

/**
 * Controlled discovery configuration for "Surprise Me" / Minimal profiles
 */
export const SURPRISE_ME_CONFIG = {
  minRatingThreshold: 7.5, // Minimum quality bar for discovery (raised from 7.0)
};

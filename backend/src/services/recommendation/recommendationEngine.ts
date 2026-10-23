// =============================================================================
// CINEVERSE RECOMMENDATION ENGINE — MAIN ORCHESTRATOR
// =============================================================================
// Hybrid Content-Based Recommendation Architecture:
//
// UserPreferenceProfile
//         ↓
// Preference Normalization & Semantic Query Construction
//         ↓
// Query Vector Embedding (Local all-MiniLM-L6-v2)
//         ↓
// Candidate Retrieval (Hard constraints: Type, Platform, Language, Runtime, Era)
//         ↓
// Feature Scoring (Semantic, Experience, Genre, Reference, Runtime, Era, Quality)
//         ↓
// Hybrid Score (Active-weight dynamic renormalization)
//         ↓
// Top 20 Recommendations with Deterministic Explanations
// =============================================================================

import { UserPreferenceProfile } from '../../models/preferenceProfile';
import {
  RecommendationResponse,
  RecommendationResult,
  RecommendationDebugInfo,
  ScoredCandidate,
} from './types';
import { EmbeddingStore } from './embeddingStore';
import { EmbeddingClient } from './embeddingClient';
import { CandidateRetriever } from './candidateRetriever';
import { HybridScorer } from './hybridScorer';
import { ExplanationGenerator } from './explanationGenerator';
import { RECOMMENDATION_CONFIG } from './weights';

export class RecommendationEngine {
  private static instance: RecommendationEngine | null = null;
  private embeddingStore = EmbeddingStore.getInstance();
  private retriever = CandidateRetriever.getInstance();
  private initialized = false;

  private constructor() {}

  public static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  /**
   * Initializes the engine by loading binary vector embeddings and MovieDNA cache.
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    console.log('[RecommendationEngine] Initializing recommendation engine...');
    const t0 = Date.now();
    await Promise.all([
      this.embeddingStore.load(),
      this.retriever.init(),
    ]);
    this.initialized = true;
    console.log(`[RecommendationEngine] Engine initialized in ${Date.now() - t0}ms.`);
  }

  /**
   * Main recommendation pipeline consuming UserPreferenceProfile.
   * Both Guided and Custom modes use this exact same engine.
   */
  public async recommend(
    profile: UserPreferenceProfile,
    includeDebug: boolean = false
  ): Promise<RecommendationResponse> {
    if (!this.initialized) {
      await this.init();
    }

    const tStart = Date.now();

    // 1. Reference title resolution & profile extraction
    const refProfiles: import('./types').ReferenceProfile[] = [];
    let refDuration: number | null = null;

    if (profile.reference_titles && profile.reference_titles.length > 0) {
      for (const title of profile.reference_titles) {
        const item = this.retriever.findMovieByName(title);
        if (item) {
          refProfiles.push({
            content_id: item.content_id,
            title: item.title,
            type: item.type,
            genres: item.genres || [],
            runtime: item.type === 'Movie' ? (item.runtime || null) : (item.series_metadata?.avg_episode_duration || null),
            description: item.description || null,
          });
          if (refDuration === null) {
            if (item.type === 'Movie' && item.runtime) {
              refDuration = item.runtime;
            } else if (item.type === 'Series' && item.series_metadata?.avg_episode_duration) {
              refDuration = item.series_metadata.avg_episode_duration;
            }
          }
        }
      }
    }

    // 2. Semantic Query Construction & Embedding (Enriched with reference title concepts)
    const tEmbedStart = Date.now();
    const queryText = EmbeddingClient.buildSemanticQuery(profile, refProfiles);
    const queryVector = await EmbeddingClient.embedText(queryText);

    // 2b. Negative Query Embedding (Only when negative preferences exist)
    const negativeQueryText = EmbeddingClient.buildNegativeQuery(profile);
    const negativeQueryVector = negativeQueryText ? await EmbeddingClient.embedText(negativeQueryText) : null;
    const queryEmbeddingMs = Date.now() - tEmbedStart;

    // 3. Active-weight renormalization
    const activeWeights = HybridScorer.computeActiveWeights(profile);
    const isSurpriseMe = HybridScorer.isSurpriseMe(profile);

    // 4. Candidate Retrieval (Hard structural filtering)
    const tRetrieveStart = Date.now();
    let candidateDnas = await this.retriever.retrieveCandidates(profile);
    const candidateRetrievalMs = Date.now() - tRetrieveStart;

    if (candidateDnas.length === 0 && this.retriever.getAllDnas().length > 0) {
      console.warn('[RecommendationEngine] Candidate pool was 0; falling back to catalog pool');
      candidateDnas = this.retriever.getAllDnas();
    }

    // 5. Feature Scoring & Hybrid Ranking
    const tScoreStart = Date.now();
    const scoredCandidates: ScoredCandidate[] = [];

    for (const dna of candidateDnas) {
      const scored = HybridScorer.scoreCandidate(
        dna,
        profile,
        queryVector,
        refProfiles,
        refDuration,
        activeWeights,
        this.embeddingStore,
        negativeQueryVector
      );
      scoredCandidates.push(scored);
    }

    // Deterministic ranking comparator:
    // 1. Hybrid score DESC
    // 2. Rating DESC
    // 3. Content ID ASC
    const deterministicCandidateSort = (a: ScoredCandidate, b: ScoredCandidate) => {
      if (Math.abs(b.hybrid_score - a.hybrid_score) > 0.0001) {
        return b.hybrid_score - a.hybrid_score;
      }
      const ratingA = a.dna.rating ?? 0;
      const ratingB = b.dna.rating ?? 0;
      if (Math.abs(ratingB - ratingA) > 0.0001) {
        return ratingB - ratingA;
      }
      return a.content_id - b.content_id;
    };

    const featureScoringMs = Date.now() - tScoreStart;

    // 6. Final Top 20 Ranking (Pure Hybrid Scoring — Zero MMR / Diversification)
    let finalRanked: ScoredCandidate[] = [];

    if (isSurpriseMe) {
      // Controlled Discovery Strategy for Surprise Me:
      // Filter candidates with rating >= 7.5 (quality gate), fallback to all candidates if fewer than 20.
      // 7.5 threshold ensures curated, genuinely acclaimed titles surface in surprise mode.
      const discoveryPool = scoredCandidates.filter((c) => (c.dna.rating || 0) >= 7.5);
      const pool = discoveryPool.length >= RECOMMENDATION_CONFIG.topKSelection ? discoveryPool : scoredCandidates;

      pool.sort(deterministicCandidateSort);
      finalRanked = pool.slice(0, RECOMMENDATION_CONFIG.topKSelection);
    } else {
      // Normal Guided & Custom recommendations: strictly ranked by HybridScore
      scoredCandidates.sort(deterministicCandidateSort);
      finalRanked = scoredCandidates.slice(0, RECOMMENDATION_CONFIG.topKSelection);
    }

    // 7. Generate Explanations & Build Final Result Object
    const recommendations: RecommendationResult[] = finalRanked.map((c) => {
      const reasons = ExplanationGenerator.generateMatchReasons(c, profile, isSurpriseMe, refProfiles);
      const matchPercentage = Math.round(c.hybrid_score * 100);

      return {
        content_id: c.content_id,
        title: c.dna.title,
        type: c.dna.type,
        poster_path: (c.dna as any).poster_path || null,
        rating: c.dna.rating,
        release_year: c.dna.release_year,
        genres: c.dna.genres || [],
        directors: c.dna.directors || [],
        actors: c.dna.actors || [],
        recommendation_score: c.hybrid_score,
        match_percentage: Math.max(1, Math.min(99, matchPercentage)), // 1-99% match
        score_breakdown: c.score_breakdown,
        reference_details: c.reference_details,
        match_reasons: reasons,
      };
    });

    const totalMs = Date.now() - tStart;

    const response: RecommendationResponse = {
      success: true,
      count: recommendations.length,
      recommendations,
    };

    if (recommendations.length < RECOMMENDATION_CONFIG.topKSelection) {
      response.message = recommendations.length === 0
        ? "No titles matched all your specified constraints. Try broadening your criteria."
        : `Only ${recommendations.length} title${recommendations.length === 1 ? '' : 's'} matched all your specified constraints in our catalog.`;
    }

    if (includeDebug) {
      response.debug = {
        candidate_pool_size: candidateDnas.length,
        missing_metadata_filtered: {
          directors: this.retriever.lastMissingDirectorCount,
          actors: this.retriever.lastMissingActorCount,
        },
        top_candidates: finalRanked.map((c) => ({
          content_id: c.content_id,
          title: c.dna.title,
          hybrid_score: c.hybrid_score,
        })),
        active_weights: activeWeights,
        execution_time_ms: {
          query_embedding_ms: queryEmbeddingMs,
          candidate_retrieval_ms: candidateRetrievalMs,
          feature_scoring_ms: featureScoringMs,
          total_ms: totalMs,
        },
      };
    }

    return response;
  }
}

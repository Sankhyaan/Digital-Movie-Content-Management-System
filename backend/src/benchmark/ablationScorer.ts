// =============================================================================
// CINEVERSE RECOMMENDATION QUALITY BENCHMARK — ABLATION SCORER
// =============================================================================
// Evaluation-only ablation runner that isolates each scoring component to
// evaluate individual signal contributions without modifying production code.
//
// 5 Configurations:
// 1. semantic_only: Pure cosine similarity (FeatureScorer.scoreSemantic)
// 2. metadata_only: Explicit genre, platform, language, era, runtime, quality overlap without embeddings
// 3. reference_only: Reference profile affinity alone (FeatureScorer.scoreReference)
// 4. hybrid_no_hard_constraints: Hybrid scorer across all 10,000 catalog records without structural candidate pruning
// 5. full_production_system: Production pipeline with active-weight renormalization and candidate retrieval filtering
// =============================================================================

import { MovieDNA } from '../models/interfaces';
import { UserPreferenceProfile } from '../models/preferenceProfile';
import { CandidateRetriever } from '../services/recommendation/candidateRetriever';
import { EmbeddingStore } from '../services/recommendation/embeddingStore';
import { FeatureScorer } from '../services/recommendation/featureScorer';
import { HybridScorer } from '../services/recommendation/hybridScorer';
import { ReferenceProfile, ScoredCandidate } from '../services/recommendation/types';
import { BenchmarkCase, AblationRunResult } from './types';
import { calculateNDCGAtK, calculatePrecisionAtK, calculateMRR, calculateHardConstraintViolationRate } from './metricCalculators';

export type AblationConfigName =
  | 'semantic_only'
  | 'metadata_only'
  | 'reference_only'
  | 'hybrid_no_hard_constraints'
  | 'full_production_system';

export interface AblationCaseResult {
  config: AblationConfigName;
  caseId: string;
  top10: Array<{ content_id: number; title: string; score: number; relevance: number; isViolation: boolean }>;
  ndcg10: number;
  p10: number;
  mrr: number;
  hardViolationRate: number;
  candidatePoolSize: number;
}

export class AblationScorer {
  private retriever: CandidateRetriever;
  private store: EmbeddingStore;

  constructor() {
    this.retriever = CandidateRetriever.getInstance();
    this.store = EmbeddingStore.getInstance();
  }

  /**
   * Deterministic comparator preserving the production invariant:
   * 1. Score DESC (diff > 0.0001)
   * 2. Rating DESC (diff > 0.0001)
   * 3. Content ID ASC
   */
  private static deterministicSort(
    a: { content_id: number; score: number; rating: number },
    b: { content_id: number; score: number; rating: number }
  ): number {
    if (Math.abs(b.score - a.score) > 0.0001) {
      return b.score - a.score;
    }
    const ratA = a.rating ?? 0;
    const ratB = b.rating ?? 0;
    if (Math.abs(ratB - ratA) > 0.0001) {
      return ratB - ratA;
    }
    return a.content_id - b.content_id;
  }

  /**
   * Evaluates a single benchmark case under a specific ablation configuration.
   */
  public evaluateCase(
    config: AblationConfigName,
    benchCase: BenchmarkCase,
    profile: UserPreferenceProfile,
    queryVector: number[] | null,
    refProfiles: ReferenceProfile[],
    refDuration: number | null,
    negativeQueryVector: number[] | null = null,
    retrievedCandidates: MovieDNA[]
  ): AblationCaseResult {
    const allDnas = this.retriever.getAllDnas();
    let candidatesToScore: MovieDNA[];

    if (config === 'full_production_system') {
      candidatesToScore = retrievedCandidates;
    } else {
      // In standalone baselines and unconstrained hybrid, all catalog items are candidates
      candidatesToScore = allDnas;
    }

    const scoredItems: Array<{ dna: MovieDNA; score: number }> = [];

    switch (config) {
      case 'semantic_only': {
        for (const dna of candidatesToScore) {
          const score = FeatureScorer.scoreSemantic(dna.content_id, queryVector, this.store);
          scoredItems.push({ dna, score });
        }
        break;
      }

      case 'metadata_only': {
        // Linear combination of explicit metadata features with 0 embedding contribution
        for (const dna of candidatesToScore) {
          const genreScore = FeatureScorer.scoreGenre(dna, profile);
          const runtimeScore = FeatureScorer.scoreRuntime(dna, profile, refDuration);
          const eraScore = FeatureScorer.scoreEra(dna, profile);
          const qualityScore = FeatureScorer.scoreQuality(dna, profile);
          const langScore = FeatureScorer.scoreLanguage(dna, profile);
          const platScore = FeatureScorer.scorePlatform(dna, profile);
          const actBonus = FeatureScorer.scoreActorBonus(dna, profile);
          const dirBonus = FeatureScorer.scoreDirectorBonus(dna, profile);

          const raw =
            0.35 * genreScore +
            0.15 * runtimeScore +
            0.15 * eraScore +
            0.15 * qualityScore +
            0.10 * langScore +
            0.10 * platScore +
            actBonus +
            dirBonus;

          scoredItems.push({ dna, score: Math.max(0, Math.min(1, raw)) });
        }
        break;
      }

      case 'reference_only': {
        for (const dna of candidatesToScore) {
          const refResult = FeatureScorer.scoreReference(dna, refProfiles, this.store);
          scoredItems.push({ dna, score: refResult.combined_score });
        }
        break;
      }

      case 'hybrid_no_hard_constraints': {
        const activeWeights = HybridScorer.computeActiveWeights(profile);
        for (const dna of candidatesToScore) {
          const scored = HybridScorer.scoreCandidate(
            dna,
            profile,
            queryVector,
            refProfiles,
            refDuration,
            activeWeights,
            this.store,
            negativeQueryVector
          );
          scoredItems.push({ dna, score: scored.hybrid_score });
        }
        break;
      }

      case 'full_production_system': {
        const activeWeights = HybridScorer.computeActiveWeights(profile);
        for (const dna of candidatesToScore) {
          const scored = HybridScorer.scoreCandidate(
            dna,
            profile,
            queryVector,
            refProfiles,
            refDuration,
            activeWeights,
            this.store,
            negativeQueryVector
          );
          scoredItems.push({ dna, score: scored.hybrid_score });
        }
        break;
      }
    }

    // Sort deterministically
    scoredItems.sort((a, b) =>
      AblationScorer.deterministicSort(
        { content_id: a.dna.content_id, score: a.score, rating: a.dna.rating || 0 },
        { content_id: b.dna.content_id, score: b.score, rating: b.dna.rating || 0 }
      )
    );

    const top10Items = scoredItems.slice(0, 10);
    const top10 = top10Items.map((item) => {
      const isMandatory = benchCase.relevance_criteria.mandatory_condition(item.dna);
      const relevance = benchCase.relevance_criteria.graded_relevance(item.dna);
      return {
        content_id: item.dna.content_id,
        title: item.dna.title,
        score: item.score,
        relevance,
        isViolation: !isMandatory,
      };
    });

    const relevanceGrades = top10.map((t) => t.relevance);
    const violationFlags = top10.map((t) => t.isViolation);

    const ndcg10 = calculateNDCGAtK(relevanceGrades, 10);
    const p10 = calculatePrecisionAtK(relevanceGrades, 2, 10);
    const mrr = calculateMRR(relevanceGrades, 2);
    const hardViolationRate = calculateHardConstraintViolationRate(violationFlags);

    return {
      config,
      caseId: benchCase.id,
      top10,
      ndcg10,
      p10,
      mrr,
      hardViolationRate,
      candidatePoolSize: candidatesToScore.length,
    };
  }

  /**
   * Aggregates results across all cases for a single ablation configuration.
   */
  public aggregateConfigResults(
    config: AblationConfigName,
    caseResults: AblationCaseResult[]
  ): AblationRunResult {
    const n = caseResults.length || 1;
    let sumNdcg = 0;
    let sumP10 = 0;
    let sumMrr = 0;
    let sumViolations = 0;
    let sumPool = 0;
    let sumCount = 0;

    const perCaseNdcg: Record<string, number> = {};
    const perCasePrecision: Record<string, number> = {};

    for (const r of caseResults) {
      sumNdcg += r.ndcg10;
      sumP10 += r.p10;
      sumMrr += r.mrr;
      sumViolations += r.hardViolationRate;
      sumPool += r.candidatePoolSize;
      sumCount += r.top10.length;

      perCaseNdcg[r.caseId] = Number(r.ndcg10.toFixed(4));
      perCasePrecision[r.caseId] = Number(r.p10.toFixed(4));
    }

    return {
      configuration: config,
      ndcg_at_10_mean: Number((sumNdcg / n).toFixed(4)),
      precision_at_10_mean: Number((sumP10 / n).toFixed(4)),
      mrr_mean: Number((sumMrr / n).toFixed(4)),
      hard_violation_rate_mean: Number((sumViolations / n).toFixed(4)),
      average_pool_size: Math.round(sumPool / n),
      average_result_count: Number((sumCount / n).toFixed(1)),
      per_case_ndcg: perCaseNdcg,
      per_case_precision: perCasePrecision,
    };
  }
}

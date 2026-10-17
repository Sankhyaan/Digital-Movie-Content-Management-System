// =============================================================================
// CINEVERSE RECOMMENDATION QUALITY BENCHMARK — TYPES & SCHEMAS
// =============================================================================

import { MovieDNA } from '../models/interfaces';
import { UserPreferenceProfile } from '../models/preferenceProfile';
import { RecommendationResult, ScoreBreakdown } from '../services/recommendation/types';

export type BenchmarkCategory =
  | 'genre_subgenre'
  | 'format_movie_vs_series'
  | 'reference_similarity'
  | 'actor_director'
  | 'language_platform'
  | 'runtime_year_bounds'
  | 'tone_mood_theme'
  | 'negative_exclusions'
  | 'multi_constraint_complex'
  | 'indirect_unfamiliar_phrasing'
  | 'ambiguous_contradictory'
  | 'scarcity_under_20'
  | 'unsupported_metadata';

export interface ExpectedInterpretation {
  type?: 'Movie' | 'Series' | null;
  genres?: string[];
  languages?: string[];
  platforms?: string[];
  directors?: string[];
  actors?: string[];
  actor_match_mode?: 'all' | 'any';
  reference_titles?: string[];
  min_year?: number | null;
  max_year?: number | null;
  min_runtime?: number | null;
  max_runtime?: number | null;
  runtime_is_hard_constraint?: boolean;
  year_range_is_hard?: boolean;
  negative_genres?: string[];
  negative_themes?: string[];
  negative_keywords?: string[];
  negative_titles?: string[];
  negative_franchises?: string[];
  negative_persons?: string[];
  expected_clarification?: boolean;
}

export interface RelevanceCriteria {
  mandatory_condition: (dna: MovieDNA) => boolean;
  mandatory_description: string;
  graded_relevance: (dna: MovieDNA) => number; // 3 = Perfect, 2 = Good, 1 = Marginal, 0 = Irrelevant / Violation
  target_attributes: string[];
  known_relevant_titles?: string[];
  known_irrelevant_titles?: string[];
}

export interface BenchmarkCase {
  id: string; // e.g. BENCH-001
  category: BenchmarkCategory;
  prompt: string;
  mode: 'custom' | 'guided';
  expected_interpretation: ExpectedInterpretation;
  expected_hard_constraints: string[];
  soft_preferences: string[];
  expected_evaluation_method: 'deterministic' | 'llm_assisted' | 'scarcity' | 'unsupported_metadata' | 'contradiction';
  relevance_criteria: RelevanceCriteria;
  review_annotation: string;
}

export interface FieldEvaluationResult {
  expected: any;
  actual: any;
  precision: number;
  recall: number;
  f1: number;
  passed: boolean;
}

export interface CaseInterpretationResult {
  passed: boolean;
  precision: number;
  recall: number;
  f1: number;
  field_results: Record<string, FieldEvaluationResult>;
  interpretation_path: 'deterministic' | 'gemini_llm' | 'mocked_llm' | 'degraded';
}

export interface CaseRetrievalResult {
  candidate_pool_size: number;
  known_relevant_total: number;
  known_relevant_recalled: number;
  candidate_recall: number;
  hard_violations_in_pool: number;
  retrieval_passed: boolean;
}

export interface CaseRankingResult {
  result_count: number;
  precision_at_10: number;
  ndcg_at_10: number;
  mrr: number;
  recall_at_10: number;
  hard_violations_count: number;
  hard_violation_rate: number;
  top_10_titles: string[];
  top_10_scores: number[];
  top_10_relevance_grades: number[];
}

export interface CaseExplanationResult {
  total_claims: number;
  verified_claims: number;
  unsupported_claims: string[];
  truthfulness_rate: number;
}

export type FailureCategory =
  | 'interpretation_error'
  | 'entity_resolution_error'
  | 'candidate_retrieval_failure'
  | 'missing_catalog_metadata'
  | 'semantic_mismatch'
  | 'scoring_weight_imbalance'
  | 'hard_constraint_defect'
  | 'unsupported_explanation_claim'
  | 'insufficient_catalog_coverage'
  | 'ambiguous_unanswerable_request';

export interface CaseEvaluationResult {
  case_id: string;
  category: BenchmarkCategory;
  prompt: string;
  parsed_profile: UserPreferenceProfile;
  interpretation: CaseInterpretationResult;
  retrieval: CaseRetrievalResult;
  ranking: CaseRankingResult;
  explanation: CaseExplanationResult;
  diagnosed_errors: FailureCategory[];
  passed_overall: boolean;
  execution_ms: number;
}

export interface AblationRunResult {
  configuration: 'semantic_only' | 'metadata_only' | 'reference_only' | 'hybrid_no_hard_constraints' | 'full_production_system';
  ndcg_at_10_mean: number;
  precision_at_10_mean: number;
  mrr_mean: number;
  hard_violation_rate_mean: number;
  average_pool_size: number;
  average_result_count: number;
  per_case_ndcg: Record<string, number>;
  per_case_precision: Record<string, number>;
}

export interface AggregateBenchmarkSummary {
  benchmark_version: string;
  catalog_snapshot_id: string;
  model_version: string;
  evaluation_date: string;
  total_cases: number;
  execution_time_total_ms: number;
  interpretation_metrics: {
    overall_precision: number;
    overall_recall: number;
    overall_f1: number;
    field_f1_scores: Record<string, number>;
  };
  retrieval_metrics: {
    average_candidate_pool_size: number;
    candidate_recall_mean: number;
    zero_candidate_cases_count: number;
  };
  ranking_metrics: {
    ndcg_at_10_mean: number;
    precision_at_10_mean: number;
    recall_at_10_mean: number;
    mrr_mean: number;
    hard_violation_rate_mean: number;
    total_hard_violations_in_top10: number;
    average_recommendations_count: number;
  };
  explanation_metrics: {
    overall_truthfulness_rate: number;
    total_claims_checked: number;
    total_unsupported_claims: number;
  };
  ablation_comparison: AblationRunResult[];
  error_taxonomy_breakdown: Array<{
    category: FailureCategory;
    count: number;
    percentage: number;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    estimated_impact: string;
    representative_case_ids: string[];
  }>;
}

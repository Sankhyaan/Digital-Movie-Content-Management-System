// =============================================================================
// CINEVERSE RECOMMENDATION QUALITY BENCHMARK — ERROR CLASSIFIER
// =============================================================================
// Automated diagnosis and root-cause classifier that maps failed benchmark cases
// into 10 structured failure categories based on empirical pipeline artifacts.
// =============================================================================

import { BenchmarkCase, FailureCategory, CaseInterpretationResult, CaseRetrievalResult, CaseRankingResult, CaseExplanationResult } from './types';
import { UserPreferenceProfile } from '../models/preferenceProfile';
import { MovieDNA } from '../models/interfaces';

export interface ErrorClassificationContext {
  benchCase: BenchmarkCase;
  profile: UserPreferenceProfile;
  interpretation: CaseInterpretationResult;
  retrieval: CaseRetrievalResult;
  ranking: CaseRankingResult;
  explanation: CaseExplanationResult;
  allCatalogDnas: MovieDNA[];
}

export class ErrorClassifier {
  /**
   * Diagnoses root causes for a single benchmark case.
   * Multiple contributing causes are returned when justified by evidence.
   */
  public static diagnose(ctx: ErrorClassificationContext): FailureCategory[] {
    const errors: FailureCategory[] = [];
    const { benchCase, profile, interpretation, retrieval, ranking, explanation, allCatalogDnas } = ctx;

    // 1. Ambiguous or Unanswerable Request
    if (
      benchCase.category === 'ambiguous_contradictory' ||
      benchCase.category === 'unsupported_metadata'
    ) {
      errors.push('ambiguous_unanswerable_request');
    }

    // 2. Insufficient Catalog Coverage (Scarcity)
    if (benchCase.category === 'scarcity_under_20') {
      errors.push('insufficient_catalog_coverage');
    } else {
      // Check if catalog naturally has fewer than 10 items matching the mandatory condition
      const totalEligibleInCatalog = allCatalogDnas.filter((d) =>
        benchCase.relevance_criteria.mandatory_condition(d)
      ).length;
      if (totalEligibleInCatalog < 10) {
        errors.push('insufficient_catalog_coverage');
      }
    }

    // 3. Interpretation Error
    if (
      !interpretation.passed ||
      interpretation.f1 < 0.70 ||
      (benchCase.expected_interpretation.genres &&
        benchCase.expected_interpretation.genres.length > 0 &&
        (!profile.genres || profile.genres.length === 0)) ||
      (benchCase.expected_interpretation.type &&
        profile.type !== benchCase.expected_interpretation.type) ||
      (benchCase.expected_interpretation.negative_genres &&
        benchCase.expected_interpretation.negative_genres.length > 0 &&
        (!profile.negative_genres || profile.negative_genres.length === 0))
    ) {
      errors.push('interpretation_error');
    }

    // 4. Entity Resolution Error
    const expectedRefs = benchCase.expected_interpretation.reference_titles || [];
    const expectedDirs = benchCase.expected_interpretation.directors || [];
    const expectedActors = benchCase.expected_interpretation.actors || [];

    const missingRefs = expectedRefs.filter((r) =>
      !(profile.reference_titles || []).some((pr) => pr.toLowerCase() === r.toLowerCase())
    );
    const missingDirs = expectedDirs.filter((d) =>
      !(profile.directors || []).some((pd) => pd.toLowerCase() === d.toLowerCase())
    );
    const missingActors = expectedActors.filter((a) =>
      !(profile.actors || []).some((pa) => pa.toLowerCase() === a.toLowerCase())
    );

    if (missingRefs.length > 0 || missingDirs.length > 0 || missingActors.length > 0) {
      errors.push('entity_resolution_error');
    }

    // 5. Hard Constraint Defect
    if (ranking.hard_violations_count > 0 || ranking.hard_violation_rate > 0) {
      errors.push('hard_constraint_defect');
    }

    // 6. Candidate Retrieval Failure
    if (
      retrieval.candidate_pool_size === 0 ||
      (retrieval.known_relevant_total > 0 && retrieval.candidate_recall < 0.5) ||
      (!retrieval.retrieval_passed && retrieval.known_relevant_total > 0)
    ) {
      errors.push('candidate_retrieval_failure');
    }

    // 7. Unsupported Explanation Claim
    if (explanation.unsupported_claims.length > 0 || explanation.truthfulness_rate < 1.0) {
      errors.push('unsupported_explanation_claim');
    }

    // 8. Missing Catalog Metadata
    // If user asked for streaming platform or runtime or director, and candidate retrieval returned items with missing fields
    const hasPlatformReq = (profile.platforms || []).length > 0;
    if (hasPlatformReq && ranking.result_count > 0) {
      // Check if top results lack platform metadata
      // (MovieDNA has no native streaming platforms in catalog, so platform queries highlight metadata sparsity)
      errors.push('missing_catalog_metadata');
    }

    // 9. Semantic Mismatch vs Scoring Weight Imbalance
    // If ranking quality is low (NDCG@10 < 0.60 or P@10 < 0.50) while retrieval had candidates
    if (ranking.ndcg_at_10 < 0.60 || ranking.precision_at_10 < 0.50) {
      if (benchCase.category === 'tone_mood_theme' || benchCase.category === 'indirect_unfamiliar_phrasing') {
        errors.push('semantic_mismatch');
      } else if (benchCase.category === 'reference_similarity' || benchCase.category === 'genre_subgenre') {
        errors.push('scoring_weight_imbalance');
      }
    }

    // Remove duplicates
    return Array.from(new Set(errors));
  }
}

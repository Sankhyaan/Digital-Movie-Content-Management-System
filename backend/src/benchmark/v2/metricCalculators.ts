// =============================================================================
// CINEVERSE BENCHMARK V2 — METRIC CALCULATORS
// =============================================================================
// Implements:
//  1. Precision@K using V2 judge specs (not keyword heuristics)
//  2. Recall@K relative to ALL relevant items in the full catalog
//     (not just the candidate pool)
//  3. NDCG@K using an ideal ranking built from all relevant catalog titles
//  4. Hard-violation rate with BOTH denominators
//  5. Parse-status flag per case
//
// Unit-testable: all functions are pure and accept pre-built parameters.
// =============================================================================

import { MovieDNA } from '../../models/interfaces';
import { V2JudgeSpec } from './judgeSpecs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParseStatus = 'constrained' | 'unconstrained' | 'empty';

export interface V2CaseResult {
  case_id: string;
  category: string;
  judge_type: string;
  parse_status: ParseStatus;

  // Metric fields (null = NOT_MEASURED for LLM/contradiction/unsupported cases)
  precision_at_10: number | null;          // using v2 judge
  recall_at_10: number | null;             // recall over full catalog
  ndcg_at_10: number | null;              // ideal built from full catalog
  hard_violations_in_top10: number | null; // count of mandatory failures in top-10
  hard_violation_rate_per_slot: number | null; // violations / top-10 slots
  hard_violation_rate_per_case: number | null; // 1 if any violation else 0

  // Pass/fail
  passed: boolean;
  failure_reason: string | null;

  // Gemini code path (read from actual implementation; set by runner)
  used_gemini: boolean;

  // LLM judge outcome (for llm_required cases)
  llm_judge_scores: number[] | null;       // 0-3 per top-10 result
  llm_judge_avg: number | null;

  // V1 outcome comparison
  v1_passed: boolean | null;
  outcome_changed: boolean | null;
  outcome_change_reason: string | null;

  // Audit/held-out flags
  is_audit_overlap: boolean;
  is_held_out: boolean;
}

export interface V2SummaryMetrics {
  total_cases: number;
  constrained_cases: number;
  unconstrained_cases: number;
  empty_parse_cases: number;

  pass_rate_overall: number;
  pass_rate_constrained: number;
  pass_rate_unconstrained: number;
  pass_rate_empty: number;

  mean_precision_at_10: number | null;
  mean_recall_at_10: number | null;
  mean_ndcg_at_10: number | null;

  // Hard-violation totals
  total_top10_slots_checked: number;
  total_hard_violations: number;
  hard_violation_rate_per_slot: number;    // violations / total_top10_slots
  hard_violation_rate_per_case_mean: number; // mean of per-case rates

  // By category
  by_category: Record<string, CategorySummary>;

  // Held-out subset
  held_out: SubsetSummary;
}

export interface CategorySummary {
  category: string;
  total: number;
  passed: number;
  pass_rate: number;
  mean_precision_at_10: number | null;
  mean_recall_at_10: number | null;
}

export interface SubsetSummary {
  case_ids: string[];
  total: number;
  passed: number;
  pass_rate: number;
  mean_precision_at_10: number | null;
  mean_recall_at_10: number | null;
  mean_ndcg_at_10: number | null;
  hard_violation_rate_per_slot: number;
}

// ---------------------------------------------------------------------------
// Core metric functions (all pure, no side effects)
// ---------------------------------------------------------------------------

/**
 * DCG for a relevance vector.
 * @param grades  0-3 relevance per rank position (position 1-indexed)
 */
export function dcg(grades: number[]): number {
  return grades.reduce((acc, rel, i) => {
    const rank = i + 1;
    return acc + rel / Math.log2(rank + 1);
  }, 0);
}

/**
 * NDCG@K relative to all relevant items in the FULL CATALOG (not the pool).
 *
 * @param top10Grades     Relevance grades [0..3] for the K returned items
 * @param allCatalogGrades All relevance grades from the full catalog (for ideal ranking)
 * @param k               Cutoff (default 10)
 */
export function ndcgAtK(
  top10Grades: number[],
  allCatalogGrades: number[],
  k: number = 10
): number {
  const truncated = top10Grades.slice(0, k);

  // Build ideal DCG: take the k highest grades from the FULL catalog
  const idealGrades = [...allCatalogGrades]
    .sort((a, b) => b - a)
    .slice(0, k);

  const idealDCG = dcg(idealGrades);
  if (idealDCG === 0) return 1.0; // Nothing is relevant, so any ranking is perfect

  const actualDCG = dcg(truncated);
  return Math.min(1.0, actualDCG / idealDCG);
}

/**
 * Precision@K: fraction of top-K results that pass the mandatory judge.
 *
 * @param top10Results   The K returned candidates
 * @param judgeSpec      V2 judge spec for the case
 * @param k              Cutoff (default 10)
 */
export function precisionAtK(
  top10Results: MovieDNA[],
  judgeSpec: V2JudgeSpec,
  k: number = 10
): number {
  if (top10Results.length === 0) return 0;
  const truncated = top10Results.slice(0, k);
  const relevant = truncated.filter((r) => judgeSpec.is_mandatory(r));
  return relevant.length / truncated.length;
}

/**
 * Recall@K: number of relevant items in top-K divided by ALL relevant items
 * in the FULL CATALOG (not just the retrieved pool).
 *
 * @param top10Results   The K returned candidates
 * @param fullCatalog    The complete MovieDNA array (~10,000 items)
 * @param judgeSpec      V2 judge spec for the case
 * @param k              Cutoff (default 10)
 */
export function recallAtK(
  top10Results: MovieDNA[],
  catalogOrJudge: MovieDNA[] | V2JudgeSpec,
  judgeOrCatalog: V2JudgeSpec | MovieDNA[],
  k: number = 10
): number {
  const fullCatalog = Array.isArray(catalogOrJudge) ? catalogOrJudge : (judgeOrCatalog as MovieDNA[]);
  const judgeSpec = Array.isArray(catalogOrJudge) ? (judgeOrCatalog as V2JudgeSpec) : (catalogOrJudge as V2JudgeSpec);

  // Count all relevant items in the full catalog
  const totalRelevant = fullCatalog.filter((item) => judgeSpec.is_mandatory(item)).length;
  if (totalRelevant === 0) return 1.0; // Nothing is mandatory-relevant, so recall = perfect

  const truncated = top10Results.slice(0, k);
  const relevantInTop = truncated.filter((r) => judgeSpec.is_mandatory(r)).length;
  return Math.min(1.0, relevantInTop / totalRelevant);
}

/**
 * Count hard violations: items in top-K that fail the mandatory judge.
 *
 * @returns { count: number, rate: number } where rate = count / truncated.length
 */
export function hardViolations(
  top10Results: MovieDNA[],
  judgeSpec: V2JudgeSpec,
  k: number = 10
): { count: number; rate: number } {
  if (top10Results.length === 0) return { count: 0, rate: 0 };
  const truncated = top10Results.slice(0, k);
  const violations = truncated.filter((r) => !judgeSpec.is_mandatory(r));
  return {
    count: violations.length,
    rate: violations.length / truncated.length,
  };
}

/**
 * Graded precision: average graded relevance score across top-K positions.
 * Returns null if judgeSpec.graded_relevance is null (LLM cases).
 */
export function gradedPrecision(
  top10Results: MovieDNA[],
  judgeSpec: V2JudgeSpec,
  k: number = 10
): number | null {
  if (!judgeSpec.graded_relevance) return null;
  const truncated = top10Results.slice(0, k);
  if (truncated.length === 0) return null;
  const totalScore = truncated.reduce((acc, r) => acc + judgeSpec.graded_relevance!(r), 0);
  return totalScore / truncated.length;
}

/**
 * Derive parse_status from the recommendation's returned profile fields.
 * 'constrained'   = at least one hard constraint extracted (genre, director, actor, etc.)
 * 'unconstrained' = only soft preferences, no hard constraints
 * 'empty'         = nothing extracted at all (empty profile)
 *
 * NOTE: This reads the runtime profile, not the expected_interpretation.
 */
export function inferParseStatus(
  extractedConstraints: {
    hasGenres: boolean;
    hasType: boolean;
    hasDirectors: boolean;
    hasActors: boolean;
    hasLanguages: boolean;
    hasPlatforms: boolean;
    hasRuntimeBound: boolean;
    hasYearBound: boolean;
    hasNegatives: boolean;
  }
): ParseStatus {
  const {
    hasGenres, hasType, hasDirectors, hasActors,
    hasLanguages, hasPlatforms, hasRuntimeBound, hasYearBound, hasNegatives,
  } = extractedConstraints;

  const hasAnyConstraint =
    hasGenres || hasType || hasDirectors || hasActors ||
    hasLanguages || hasPlatforms || hasRuntimeBound || hasYearBound || hasNegatives;

  if (!hasAnyConstraint) return 'empty';

  // If only soft preferences present without hard structural filters:
  if (!hasType && !hasDirectors && !hasActors && !hasLanguages && !hasPlatforms
      && !hasRuntimeBound && !hasYearBound && !hasNegatives && hasGenres) {
    // Genres alone are ambiguous: treat as 'constrained' if explicitly user-stated
    return 'constrained';
  }

  return 'constrained';
}

// ---------------------------------------------------------------------------
// Aggregate computation
// ---------------------------------------------------------------------------

/**
 * Aggregate V2CaseResult[] into V2SummaryMetrics.
 */
export function aggregateMetrics(
  results: V2CaseResult[],
  heldOutIds: Set<string>
): V2SummaryMetrics {
  const total = results.length;

  // Parse status counts
  const constrained = results.filter((r) => r.parse_status === 'constrained').length;
  const unconstrained = results.filter((r) => r.parse_status === 'unconstrained').length;
  const empty = results.filter((r) => r.parse_status === 'empty').length;

  // Pass rates by parse status
  const passRate = (subset: V2CaseResult[]) =>
    subset.length === 0 ? 0 : subset.filter((r) => r.passed).length / subset.length;

  const passRateOverall = passRate(results);
  const passRateConstrained = passRate(results.filter((r) => r.parse_status === 'constrained'));
  const passRateUnconstrained = passRate(results.filter((r) => r.parse_status === 'unconstrained'));
  const passRateEmpty = passRate(results.filter((r) => r.parse_status === 'empty'));

  // Mean of non-null metrics
  const meanOf = (values: (number | null)[]): number | null => {
    const valid = values.filter((v): v is number => v !== null);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  const meanP10 = meanOf(results.map((r) => r.precision_at_10));
  const meanR10 = meanOf(results.map((r) => r.recall_at_10));
  const meanNDCG = meanOf(results.map((r) => r.ndcg_at_10));

  // Hard violation totals
  const measurableResults = results.filter((r) => r.hard_violations_in_top10 !== null);
  const totalSlots = measurableResults.length * 10;
  const totalViolations = measurableResults.reduce((acc, r) => acc + (r.hard_violations_in_top10 ?? 0), 0);
  const violationRatePerSlot = totalSlots > 0 ? totalViolations / totalSlots : 0;
  const violationRatePerCaseMean = meanOf(measurableResults.map((r) => r.hard_violation_rate_per_case)) ?? 0;

  // By category
  const categoryMap: Record<string, V2CaseResult[]> = {};
  for (const r of results) {
    if (!categoryMap[r.category]) categoryMap[r.category] = [];
    categoryMap[r.category].push(r);
  }
  const byCategory: Record<string, CategorySummary> = {};
  for (const [cat, catResults] of Object.entries(categoryMap)) {
    byCategory[cat] = {
      category: cat,
      total: catResults.length,
      passed: catResults.filter((r) => r.passed).length,
      pass_rate: passRate(catResults),
      mean_precision_at_10: meanOf(catResults.map((r) => r.precision_at_10)),
      mean_recall_at_10: meanOf(catResults.map((r) => r.recall_at_10)),
    };
  }

  // Held-out subset
  const heldOutResults = results.filter((r) => heldOutIds.has(r.case_id));
  const hoMeasurableSlots = heldOutResults.filter((r) => r.hard_violations_in_top10 !== null);
  const hoViolations = hoMeasurableSlots.reduce((acc, r) => acc + (r.hard_violations_in_top10 ?? 0), 0);
  const heldOut: SubsetSummary = {
    case_ids: heldOutResults.map((r) => r.case_id),
    total: heldOutResults.length,
    passed: heldOutResults.filter((r) => r.passed).length,
    pass_rate: passRate(heldOutResults),
    mean_precision_at_10: meanOf(heldOutResults.map((r) => r.precision_at_10)),
    mean_recall_at_10: meanOf(heldOutResults.map((r) => r.recall_at_10)),
    mean_ndcg_at_10: meanOf(heldOutResults.map((r) => r.ndcg_at_10)),
    hard_violation_rate_per_slot: hoMeasurableSlots.length > 0
      ? hoViolations / (hoMeasurableSlots.length * 10) : 0,
  };

  return {
    total_cases: total,
    constrained_cases: constrained,
    unconstrained_cases: unconstrained,
    empty_parse_cases: empty,
    pass_rate_overall: passRateOverall,
    pass_rate_constrained: passRateConstrained,
    pass_rate_unconstrained: passRateUnconstrained,
    pass_rate_empty: passRateEmpty,
    mean_precision_at_10: meanP10,
    mean_recall_at_10: meanR10,
    mean_ndcg_at_10: meanNDCG,
    total_top10_slots_checked: totalSlots,
    total_hard_violations: totalViolations,
    hard_violation_rate_per_slot: violationRatePerSlot,
    hard_violation_rate_per_case_mean: violationRatePerCaseMean,
    by_category: byCategory,
    held_out: heldOut,
  };
}

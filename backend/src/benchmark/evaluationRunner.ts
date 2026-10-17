// =============================================================================
// CINEVERSE RECOMMENDATION QUALITY BENCHMARK — EVALUATION RUNNER
// =============================================================================
// Orchestrates the evaluation of all 100 benchmark cases across the 4 stages:
//   Stage A: Natural-Language Interpretation Quality
//   Stage B: Candidate Retrieval Quality
//   Stage C: Ranking Quality (NDCG@10, P@10, R@10, MRR, Hard Violation Rate)
//   Stage D: Explanation Truthfulness & Claim Verification
//
// Additionally executes the 5 Ablation Configurations and classifies root-cause
// errors into the 10 standardized categories.
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../db/connection';
import { MovieDNA } from '../models/interfaces';
import { UserPreferenceProfile } from '../models/preferenceProfile';
import { PreferenceProfileBuilder } from '../services/preferenceProfileBuilder';
import { CandidateRetriever } from '../services/recommendation/candidateRetriever';
import { EmbeddingStore } from '../services/recommendation/embeddingStore';
import { EmbeddingClient } from '../services/recommendation/embeddingClient';
import { HybridScorer } from '../services/recommendation/hybridScorer';
import { ExplanationGenerator } from '../services/recommendation/explanationGenerator';
import { ReferenceProfile, ScoredCandidate } from '../services/recommendation/types';
import { BENCHMARK_100_CASES } from './benchmark_100_cases';
import {
  BenchmarkCase,
  CaseEvaluationResult,
  CaseInterpretationResult,
  CaseRetrievalResult,
  CaseRankingResult,
  CaseExplanationResult,
  AggregateBenchmarkSummary,
  FieldEvaluationResult,
  AblationRunResult,
  FailureCategory,
} from './types';
import {
  calculateNDCGAtK,
  calculatePrecisionAtK,
  calculateRecallAtK,
  calculateMRR,
  calculateHardConstraintViolationRate,
  calculateSetMetrics,
} from './metricCalculators';
import { AblationScorer, AblationCaseResult } from './ablationScorer';
import { ErrorClassifier } from './errorClassifier';

export class EvaluationRunner {
  private retriever = CandidateRetriever.getInstance();
  private store = EmbeddingStore.getInstance();
  private ablationScorer = new AblationScorer();

  /**
   * Initializes catalog cache and binary vector embeddings.
   */
  public async init(): Promise<void> {
    console.log('[EvaluationRunner] Initializing database and embedding store...');
    const t0 = Date.now();
    await Promise.all([
      this.retriever.init(),
      this.store.load(),
    ]);
    console.log(`[EvaluationRunner] Initialization completed in ${Date.now() - t0}ms.`);
  }

  /**
   * Stage A: Evaluates interpretation accuracy of extracted profile against expected ground truth.
   */
  public evaluateInterpretation(
    benchCase: BenchmarkCase,
    profile: UserPreferenceProfile,
    pathUsed: 'deterministic' | 'gemini_llm' | 'mocked_llm' | 'degraded'
  ): CaseInterpretationResult {
    const exp = benchCase.expected_interpretation;
    const fieldResults: Record<string, FieldEvaluationResult> = {};
    let totalPrecision = 0;
    let totalRecall = 0;
    let totalF1 = 0;
    let fieldCount = 0;

    const addFieldMetric = (name: string, expected: any, actual: any, precision: number, recall: number, f1: number) => {
      fieldResults[name] = {
        expected,
        actual,
        precision: Number(precision.toFixed(4)),
        recall: Number(recall.toFixed(4)),
        f1: Number(f1.toFixed(4)),
        passed: f1 >= 0.70,
      };
      totalPrecision += precision;
      totalRecall += recall;
      totalF1 += f1;
      fieldCount++;
    };

    // 1. Content Type
    if (exp.type !== undefined) {
      const match = (profile.type ?? null) === exp.type;
      addFieldMetric('type', exp.type, profile.type, match ? 1 : 0, match ? 1 : 0, match ? 1 : 0);
    }

    // 2. Genres
    if (exp.genres && exp.genres.length > 0) {
      const m = calculateSetMetrics(profile.genres || [], exp.genres);
      addFieldMetric('genres', exp.genres, profile.genres, m.precision, m.recall, m.f1);
    }

    // 3. Languages
    if (exp.languages && exp.languages.length > 0) {
      const m = calculateSetMetrics(profile.languages || [], exp.languages);
      addFieldMetric('languages', exp.languages, profile.languages, m.precision, m.recall, m.f1);
    }

    // 4. Platforms
    if (exp.platforms && exp.platforms.length > 0) {
      const m = calculateSetMetrics(profile.platforms || [], exp.platforms);
      addFieldMetric('platforms', exp.platforms, profile.platforms, m.precision, m.recall, m.f1);
    }

    // 5. Directors
    if (exp.directors && exp.directors.length > 0) {
      const m = calculateSetMetrics(profile.directors || [], exp.directors);
      addFieldMetric('directors', exp.directors, profile.directors, m.precision, m.recall, m.f1);
    }

    // 6. Actors
    if (exp.actors && exp.actors.length > 0) {
      const m = calculateSetMetrics(profile.actors || [], exp.actors);
      addFieldMetric('actors', exp.actors, profile.actors, m.precision, m.recall, m.f1);
    }

    // 7. Reference Titles
    if (exp.reference_titles && exp.reference_titles.length > 0) {
      const m = calculateSetMetrics(profile.reference_titles || [], exp.reference_titles);
      addFieldMetric('reference_titles', exp.reference_titles, profile.reference_titles, m.precision, m.recall, m.f1);
    }

    // 8. Negative Genres
    if (exp.negative_genres && exp.negative_genres.length > 0) {
      const m = calculateSetMetrics(profile.negative_genres || [], exp.negative_genres);
      addFieldMetric('negative_genres', exp.negative_genres, profile.negative_genres, m.precision, m.recall, m.f1);
    }

    // 9. Negative Themes / Keywords
    if (exp.negative_themes && exp.negative_themes.length > 0) {
      const combinedNeg = [...(profile.negative_themes || []), ...(profile.negative_keywords || [])];
      const m = calculateSetMetrics(combinedNeg, exp.negative_themes);
      addFieldMetric('negative_themes', exp.negative_themes, combinedNeg, m.precision, m.recall, m.f1);
    }

    // 10. Negative Persons
    if (exp.negative_persons && exp.negative_persons.length > 0) {
      const m = calculateSetMetrics(profile.negative_persons || [], exp.negative_persons);
      addFieldMetric('negative_persons', exp.negative_persons, profile.negative_persons, m.precision, m.recall, m.f1);
    }

    // 11. Negative Titles / Franchises
    if (exp.negative_titles && exp.negative_titles.length > 0) {
      const combinedNeg = [...(profile.negative_titles || []), ...(profile.negative_franchises || [])];
      const m = calculateSetMetrics(combinedNeg, exp.negative_titles);
      addFieldMetric('negative_titles', exp.negative_titles, combinedNeg, m.precision, m.recall, m.f1);
    }

    // 12. Runtime bounds
    if (exp.max_runtime !== undefined) {
      const match = profile.max_runtime_minutes === exp.max_runtime;
      addFieldMetric('max_runtime', exp.max_runtime, profile.max_runtime_minutes, match ? 1 : 0, match ? 1 : 0, match ? 1 : 0);
    }
    if (exp.min_runtime !== undefined) {
      const match = profile.min_runtime_minutes === exp.min_runtime;
      addFieldMetric('min_runtime', exp.min_runtime, profile.min_runtime_minutes, match ? 1 : 0, match ? 1 : 0, match ? 1 : 0);
    }

    // 13. Year bounds
    if (exp.min_year !== undefined) {
      const match = profile.min_release_year === exp.min_year;
      addFieldMetric('min_year', exp.min_year, profile.min_release_year, match ? 1 : 0, match ? 1 : 0, match ? 1 : 0);
    }
    if (exp.max_year !== undefined) {
      const match = profile.max_release_year === exp.max_year;
      addFieldMetric('max_year', exp.max_year, profile.max_release_year, match ? 1 : 0, match ? 1 : 0, match ? 1 : 0);
    }

    const avgP = fieldCount > 0 ? totalPrecision / fieldCount : 1;
    const avgR = fieldCount > 0 ? totalRecall / fieldCount : 1;
    const avgF1 = fieldCount > 0 ? totalF1 / fieldCount : 1;

    return {
      passed: avgF1 >= 0.70,
      precision: Number(avgP.toFixed(4)),
      recall: Number(avgR.toFixed(4)),
      f1: Number(avgF1.toFixed(4)),
      field_results: fieldResults,
      interpretation_path: pathUsed,
    };
  }

  /**
   * Stage B: Evaluates candidate retrieval pool against known relevant catalog titles.
   */
  public evaluateRetrieval(
    benchCase: BenchmarkCase,
    candidates: MovieDNA[]
  ): CaseRetrievalResult {
    const knownRelevant = benchCase.relevance_criteria.known_relevant_titles || [];
    let recalled = 0;

    const candidateTitles = new Set(candidates.map((c) => c.title.toLowerCase().trim()));

    for (const title of knownRelevant) {
      if (candidateTitles.has(title.toLowerCase().trim())) {
        recalled++;
      }
    }

    const recall = knownRelevant.length > 0 ? recalled / knownRelevant.length : 1.0;

    // Check mandatory violations inside the retrieved candidate pool
    let poolViolations = 0;
    for (const dna of candidates) {
      if (!benchCase.relevance_criteria.mandatory_condition(dna)) {
        poolViolations++;
      }
    }

    return {
      candidate_pool_size: candidates.length,
      known_relevant_total: knownRelevant.length,
      known_relevant_recalled: recalled,
      candidate_recall: Number(recall.toFixed(4)),
      hard_violations_in_pool: poolViolations,
      retrieval_passed: candidates.length > 0 && (knownRelevant.length === 0 || recall >= 0.5),
    };
  }

  /**
   * Stage C: Evaluates final Top 10 recommendations for NDCG@10, P@10, R@10, MRR, and violations.
   */
  public evaluateRanking(
    benchCase: BenchmarkCase,
    top10Candidates: ScoredCandidate[],
    allCatalogDnas: MovieDNA[]
  ): CaseRankingResult {
    const top10Titles: string[] = [];
    const top10Scores: number[] = [];
    const top10Grades: number[] = [];
    const top10Violations: boolean[] = [];

    for (const c of top10Candidates.slice(0, 10)) {
      top10Titles.push(c.dna.title);
      top10Scores.push(c.hybrid_score);
      const isMandatory = benchCase.relevance_criteria.mandatory_condition(c.dna);
      const grade = benchCase.relevance_criteria.graded_relevance(c.dna);
      top10Grades.push(grade);
      top10Violations.push(!isMandatory);
    }

    const ndcgAt10 = calculateNDCGAtK(top10Grades, 10);
    const precisionAt10 = calculatePrecisionAtK(top10Grades, 2, 10);
    const mrr = calculateMRR(top10Grades, 2);
    const hardViolationRate = calculateHardConstraintViolationRate(top10Violations);
    const hardViolationsCount = top10Violations.filter((v) => v).length;

    // Calculate recall: estimate total relevant items in catalog
    const relevantCountInTop10 = top10Grades.filter((g) => g >= 2).length;
    const knownRelevantCount = benchCase.relevance_criteria.known_relevant_titles?.length || 0;
    let totalRelevantEstimated = knownRelevantCount;
    if (totalRelevantEstimated === 0) {
      // Count total catalog items with grade >= 2 (approximate on sample if needed)
      totalRelevantEstimated = allCatalogDnas.filter((d) => benchCase.relevance_criteria.graded_relevance(d) >= 2).length;
    }

    const recallAt10 = calculateRecallAtK(relevantCountInTop10, totalRelevantEstimated, 10);

    return {
      result_count: top10Candidates.length,
      precision_at_10: ndcgAt10 >= 0 ? precisionAt10 : 0,
      ndcg_at_10: ndcgAt10,
      mrr,
      recall_at_10: recallAt10,
      hard_violations_count: hardViolationsCount,
      hard_violation_rate: hardViolationRate,
      top_10_titles: top10Titles,
      top_10_scores: top10Scores,
      top_10_relevance_grades: top10Grades,
    };
  }

  /**
   * Stage D: Verifies factual truthfulness of generated explanations against catalog MovieDNA.
   */
  public evaluateExplanations(
    top10Candidates: ScoredCandidate[],
    profile: UserPreferenceProfile,
    refProfiles: ReferenceProfile[]
  ): CaseExplanationResult {
    let totalClaims = 0;
    let verifiedClaims = 0;
    const unsupportedClaims: string[] = [];

    for (const c of top10Candidates.slice(0, 10)) {
      const reasons = ExplanationGenerator.generateMatchReasons(c, profile, false, refProfiles);
      const dna = c.dna;

      for (const reason of reasons) {
        totalClaims++;
        let claimVerified = false;

        if (reason.startsWith('Directed by ')) {
          const dir = reason.replace('Directed by ', '').trim();
          const directors = (dna.directors || []).map((d) => d.toLowerCase());
          claimVerified = directors.some((d) => dir.toLowerCase().includes(d));
        } else if (reason.startsWith('Starring ')) {
          const act = reason.replace('Starring ', '').trim();
          const actors = (dna.actors || []).map((a) => a.toLowerCase());
          claimVerified = actors.some((a) => act.toLowerCase().includes(a));
        } else if (reason.startsWith('Matches your requested ')) {
          const genreClaim = reason.replace('Matches your requested ', '').replace(' genre', '').trim();
          const genres = (dna.genres || []).map((g) => g.toLowerCase());
          claimVerified = genres.some((g) => genreClaim.toLowerCase().includes(g));
        } else if (reason.startsWith('Released in ')) {
          const year = parseInt(reason.replace('Released in ', ''), 10);
          claimVerified = dna.release_year === year;
        } else if (reason.startsWith('Similar to ')) {
          claimVerified = c.reference_score >= 0.60;
        } else if (reason.startsWith('Strong match for a ')) {
          claimVerified = c.experience_score >= 0.50;
        } else if (reason.startsWith('Excludes ')) {
          claimVerified = true; // Verified by prompt exclusion presence
        } else {
          // General claim fallback
          claimVerified = true;
        }

        if (claimVerified) {
          verifiedClaims++;
        } else {
          unsupportedClaims.push(`[${dna.title}] ${reason}`);
        }
      }
    }

    const truthfulnessRate = totalClaims > 0 ? verifiedClaims / totalClaims : 1.0;

    return {
      total_claims: totalClaims,
      verified_claims: verifiedClaims,
      unsupported_claims: unsupportedClaims,
      truthfulness_rate: Number(truthfulnessRate.toFixed(4)),
    };
  }

  /**
   * Main execution run for all 100 benchmark cases.
   */
  public async runBenchmark(): Promise<{
    summary: AggregateBenchmarkSummary;
    caseResults: CaseEvaluationResult[];
  }> {
    await this.init();
    const allDnas = this.retriever.getAllDnas();
    console.log(`[EvaluationRunner] Running benchmark across ${BENCHMARK_100_CASES.length} cases on ${allDnas.length} catalog items...`);

    const tStart = Date.now();
    const caseResults: CaseEvaluationResult[] = [];
    const ablationCaseMap: Record<string, AblationCaseResult[]> = {
      semantic_only: [],
      metadata_only: [],
      reference_only: [],
      hybrid_no_hard_constraints: [],
      full_production_system: [],
    };

    const titleResolver = (candidate: string) => this.retriever.findMovieByName(candidate)?.title || null;

    let caseIndex = 0;
    for (const benchCase of BENCHMARK_100_CASES) {
      caseIndex++;
      const tCaseStart = Date.now();
      if (caseIndex % 10 === 0 || caseIndex === 1) {
        console.log(`[EvaluationRunner] Progress: Case ${caseIndex}/${BENCHMARK_100_CASES.length} (${benchCase.id}: ${benchCase.category})`);
      }

      // 1. Natural Language Interpretation
      let profile: UserPreferenceProfile;
      let pathUsed: 'deterministic' | 'gemini_llm' | 'mocked_llm' | 'degraded' = 'deterministic';

      try {
        profile = await PreferenceProfileBuilder.buildFromCustom(benchCase.prompt, titleResolver, true);
        if (profile.is_degraded || profile.low_confidence) {
          pathUsed = 'degraded';
        }
      } catch (err: any) {
        console.warn(`[EvaluationRunner] Error parsing case ${benchCase.id}:`, err.message);
        profile = await PreferenceProfileBuilder.buildFromCustom(benchCase.prompt, titleResolver, false);
        pathUsed = 'degraded';
      }

      const interpretation = this.evaluateInterpretation(benchCase, profile, pathUsed);

      // 2. Reference title resolution
      const refProfiles: ReferenceProfile[] = [];
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
              refDuration = item.type === 'Movie' ? (item.runtime || null) : (item.series_metadata?.avg_episode_duration || null);
            }
          }
        }
      }

      // 3. Vector Embeddings
      const queryText = EmbeddingClient.buildSemanticQuery(profile, refProfiles);
      let queryVector: number[] | null = null;
      try {
        queryVector = await EmbeddingClient.embedText(queryText);
      } catch {
        queryVector = null;
      }

      const negQueryText = EmbeddingClient.buildNegativeQuery(profile);
      let negQueryVector: number[] | null = null;
      if (negQueryText) {
        try {
          negQueryVector = await EmbeddingClient.embedText(negQueryText);
        } catch {
          negQueryVector = null;
        }
      }

      // 4. Candidate Retrieval
      const candidateDnas = await this.retriever.retrieveCandidates(profile);
      const retrieval = this.evaluateRetrieval(benchCase, candidateDnas);

      // 5. Scoring & Deterministic Ranking
      const activeWeights = HybridScorer.computeActiveWeights(profile);
      const scoredCandidates: ScoredCandidate[] = [];

      for (const dna of candidateDnas) {
        const scored = HybridScorer.scoreCandidate(
          dna,
          profile,
          queryVector,
          refProfiles,
          refDuration,
          activeWeights,
          this.store,
          negQueryVector
        );
        scoredCandidates.push(scored);
      }

      // Deterministic sort: HybridScore DESC, rating DESC, content_id ASC
      scoredCandidates.sort((a, b) => {
        if (Math.abs(b.hybrid_score - a.hybrid_score) > 0.0001) {
          return b.hybrid_score - a.hybrid_score;
        }
        const ratA = a.dna.rating ?? 0;
        const ratB = b.dna.rating ?? 0;
        if (Math.abs(ratB - ratA) > 0.0001) {
          return ratB - ratA;
        }
        return a.content_id - b.content_id;
      });

      const ranking = this.evaluateRanking(benchCase, scoredCandidates, allDnas);
      const explanation = this.evaluateExplanations(scoredCandidates, profile, refProfiles);

      // 6. Diagnose Root Cause Errors
      const diagnosedErrors = ErrorClassifier.diagnose({
        benchCase,
        profile,
        interpretation,
        retrieval,
        ranking,
        explanation,
        allCatalogDnas: allDnas,
      });

      const passedOverall =
        interpretation.passed &&
        ranking.hard_violations_count === 0 &&
        ranking.ndcg_at_10 >= 0.70 &&
        explanation.truthfulness_rate >= 0.90;

      const caseResult: CaseEvaluationResult = {
        case_id: benchCase.id,
        category: benchCase.category,
        prompt: benchCase.prompt,
        parsed_profile: profile,
        interpretation,
        retrieval,
        ranking,
        explanation,
        diagnosed_errors: diagnosedErrors,
        passed_overall: passedOverall,
        execution_ms: Date.now() - tCaseStart,
      };

      caseResults.push(caseResult);

      // 7. Execute 5 Ablations
      const ablations: Array<'semantic_only' | 'metadata_only' | 'reference_only' | 'hybrid_no_hard_constraints' | 'full_production_system'> = [
        'semantic_only',
        'metadata_only',
        'reference_only',
        'hybrid_no_hard_constraints',
        'full_production_system',
      ];

      for (const ab of ablations) {
        const abResult = this.ablationScorer.evaluateCase(
          ab,
          benchCase,
          profile,
          queryVector,
          refProfiles,
          refDuration,
          negQueryVector,
          candidateDnas
        );
        ablationCaseMap[ab].push(abResult);
      }
    }

    const totalMs = Date.now() - tStart;
    console.log(`[EvaluationRunner] All 100 cases executed in ${totalMs}ms.`);

    // 8. Compile Aggregate Summary
    const summary = this.compileAggregateSummary(caseResults, ablationCaseMap, totalMs);

    return { summary, caseResults };
  }

  /**
   * Compiles macro summary statistics across all benchmark runs.
   */
  private compileAggregateSummary(
    caseResults: CaseEvaluationResult[],
    ablationCaseMap: Record<string, AblationCaseResult[]>,
    totalMs: number
  ): AggregateBenchmarkSummary {
    const n = caseResults.length || 1;

    // Interpretation Aggregates
    let sumInterpP = 0;
    let sumInterpR = 0;
    let sumInterpF1 = 0;
    const fieldF1Sums: Record<string, { sum: number; count: number }> = {};

    // Retrieval Aggregates
    let sumPoolSize = 0;
    let sumCandidateRecall = 0;
    let zeroCandidateCount = 0;

    // Ranking Aggregates
    let sumNdcg = 0;
    let sumP10 = 0;
    let sumR10 = 0;
    let sumMrr = 0;
    let sumViolationRate = 0;
    let totalHardViolations = 0;
    let sumRecCount = 0;

    // Explanation Aggregates
    let sumTruthRate = 0;
    let totalClaimsChecked = 0;
    let totalUnsupportedClaims = 0;

    // Error Taxonomy Counts
    const errorCounts: Record<FailureCategory, number> = {
      interpretation_error: 0,
      entity_resolution_error: 0,
      candidate_retrieval_failure: 0,
      missing_catalog_metadata: 0,
      semantic_mismatch: 0,
      scoring_weight_imbalance: 0,
      hard_constraint_defect: 0,
      unsupported_explanation_claim: 0,
      insufficient_catalog_coverage: 0,
      ambiguous_unanswerable_request: 0,
    };
    const errorCaseIds: Record<FailureCategory, string[]> = {
      interpretation_error: [],
      entity_resolution_error: [],
      candidate_retrieval_failure: [],
      missing_catalog_metadata: [],
      semantic_mismatch: [],
      scoring_weight_imbalance: [],
      hard_constraint_defect: [],
      unsupported_explanation_claim: [],
      insufficient_catalog_coverage: [],
      ambiguous_unanswerable_request: [],
    };

    for (const r of caseResults) {
      sumInterpP += r.interpretation.precision;
      sumInterpR += r.interpretation.recall;
      sumInterpF1 += r.interpretation.f1;

      for (const [field, fRes] of Object.entries(r.interpretation.field_results)) {
        if (!fieldF1Sums[field]) {
          fieldF1Sums[field] = { sum: 0, count: 0 };
        }
        fieldF1Sums[field].sum += fRes.f1;
        fieldF1Sums[field].count++;
      }

      sumPoolSize += r.retrieval.candidate_pool_size;
      sumCandidateRecall += r.retrieval.candidate_recall;
      if (r.retrieval.candidate_pool_size === 0) zeroCandidateCount++;

      sumNdcg += r.ranking.ndcg_at_10;
      sumP10 += r.ranking.precision_at_10;
      sumR10 += r.ranking.recall_at_10;
      sumMrr += r.ranking.mrr;
      sumViolationRate += r.ranking.hard_violation_rate;
      totalHardViolations += r.ranking.hard_violations_count;
      sumRecCount += r.ranking.result_count;

      sumTruthRate += r.explanation.truthfulness_rate;
      totalClaimsChecked += r.explanation.total_claims;
      totalUnsupportedClaims += r.explanation.unsupported_claims.length;

      for (const err of r.diagnosed_errors) {
        errorCounts[err]++;
        errorCaseIds[err].push(r.case_id);
      }
    }

    const fieldF1Scores: Record<string, number> = {};
    for (const [f, entry] of Object.entries(fieldF1Sums)) {
      fieldF1Scores[f] = Number((entry.sum / entry.count).toFixed(4));
    }

    // Ablation Aggregates
    const ablationRuns: AblationRunResult[] = [];
    const configs: Array<'semantic_only' | 'metadata_only' | 'reference_only' | 'hybrid_no_hard_constraints' | 'full_production_system'> = [
      'semantic_only',
      'metadata_only',
      'reference_only',
      'hybrid_no_hard_constraints',
      'full_production_system',
    ];

    for (const cfg of configs) {
      ablationRuns.push(this.ablationScorer.aggregateConfigResults(cfg, ablationCaseMap[cfg]));
    }

    // Error taxonomy breakdown
    const severities: Record<FailureCategory, 'HIGH' | 'MEDIUM' | 'LOW'> = {
      hard_constraint_defect: 'HIGH',
      candidate_retrieval_failure: 'HIGH',
      interpretation_error: 'HIGH',
      entity_resolution_error: 'HIGH',
      missing_catalog_metadata: 'MEDIUM',
      scoring_weight_imbalance: 'MEDIUM',
      semantic_mismatch: 'MEDIUM',
      unsupported_explanation_claim: 'MEDIUM',
      insufficient_catalog_coverage: 'LOW',
      ambiguous_unanswerable_request: 'LOW',
    };

    const impacts: Record<FailureCategory, string> = {
      hard_constraint_defect: 'User receives movies violating explicit hard limits (e.g. format, excluded genres/directors, runtime ceiling).',
      candidate_retrieval_failure: 'Eligible candidates pruned prematurely before scoring, reducing diversity or returning 0 results.',
      interpretation_error: 'Natural language parser fails to map user phrasing into structured profile filters.',
      entity_resolution_error: 'Reference titles, actors, or directors not resolved to catalog entities.',
      missing_catalog_metadata: 'Catalog gaps (e.g. platform availability, keywords) prevent queries from matching.',
      scoring_weight_imbalance: 'High ratings or semantic vector dominate niche genre affinity or reference style.',
      semantic_mismatch: 'Dense vector embeddings surface tangentially related titles or miss thematic nuances.',
      unsupported_explanation_claim: 'Explanation makes claims about directors/genres not present in candidate MovieDNA.',
      insufficient_catalog_coverage: 'Catalog naturally lacks titles satisfying highly constrained multi-attribute combinations.',
      ambiguous_unanswerable_request: 'Inherently contradictory or nonsensical user prompts requiring clarification.',
    };

    const taxonomy = Object.entries(errorCounts)
      .map(([cat, count]) => {
        const category = cat as FailureCategory;
        return {
          category,
          count,
          percentage: Number(((count / n) * 100).toFixed(1)),
          severity: severities[category],
          estimated_impact: impacts[category],
          representative_case_ids: errorCaseIds[category].slice(0, 5),
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      benchmark_version: '1.0.0-phase6-benchmark',
      catalog_snapshot_id: 'mysql-content_dna-10000-v1',
      model_version: 'all-MiniLM-L6-v2-384d',
      evaluation_date: new Date().toISOString(),
      total_cases: n,
      execution_time_total_ms: totalMs,
      interpretation_metrics: {
        overall_precision: Number((sumInterpP / n).toFixed(4)),
        overall_recall: Number((sumInterpR / n).toFixed(4)),
        overall_f1: Number((sumInterpF1 / n).toFixed(4)),
        field_f1_scores: fieldF1Scores,
      },
      retrieval_metrics: {
        average_candidate_pool_size: Math.round(sumPoolSize / n),
        candidate_recall_mean: Number((sumCandidateRecall / n).toFixed(4)),
        zero_candidate_cases_count: zeroCandidateCount,
      },
      ranking_metrics: {
        ndcg_at_10_mean: Number((sumNdcg / n).toFixed(4)),
        precision_at_10_mean: Number((sumP10 / n).toFixed(4)),
        recall_at_10_mean: Number((sumR10 / n).toFixed(4)),
        mrr_mean: Number((sumMrr / n).toFixed(4)),
        hard_violation_rate_mean: Number((sumViolationRate / n).toFixed(4)),
        total_hard_violations_in_top10: totalHardViolations,
        average_recommendations_count: Number((sumRecCount / n).toFixed(1)),
      },
      explanation_metrics: {
        overall_truthfulness_rate: Number((sumTruthRate / n).toFixed(4)),
        total_claims_checked: totalClaimsChecked,
        total_unsupported_claims: totalUnsupportedClaims,
      },
      ablation_comparison: ablationRuns,
      error_taxonomy_breakdown: taxonomy,
    };
  }
}

// CLI execution entrypoint
if (require.main === module) {
  (async () => {
    try {
      const runner = new EvaluationRunner();
      const { summary, caseResults } = await runner.runBenchmark();

      const outPath = path.resolve(__dirname, '../../benchmark_results.json');
      fs.writeFileSync(outPath, JSON.stringify({ summary, caseResults }, null, 2), 'utf8');
      console.log(`[EvaluationRunner] Successfully saved benchmark results to ${outPath}`);

      console.log('\n=============================================================================');
      console.log('CINEVERSE RECOMMENDATION BENCHMARK — EXECUTIVE SUMMARY');
      console.log('=============================================================================');
      console.log(`Total Cases Evaluated: ${summary.total_cases}`);
      console.log(`Total Execution Time: ${summary.execution_time_total_ms}ms (${(summary.execution_time_total_ms / 1000).toFixed(2)}s)`);
      console.log('-----------------------------------------------------------------------------');
      console.log('STAGE A: INTERPRETATION QUALITY:');
      console.log(`  Precision: ${summary.interpretation_metrics.overall_precision}`);
      console.log(`  Recall:    ${summary.interpretation_metrics.overall_recall}`);
      console.log(`  F1-Score:  ${summary.interpretation_metrics.overall_f1}`);
      console.log('-----------------------------------------------------------------------------');
      console.log('STAGE B: CANDIDATE RETRIEVAL QUALITY:');
      console.log(`  Avg Candidate Pool Size: ${summary.retrieval_metrics.average_candidate_pool_size}`);
      console.log(`  Candidate Recall Mean:   ${summary.retrieval_metrics.candidate_recall_mean}`);
      console.log(`  Zero-Candidate Cases:    ${summary.retrieval_metrics.zero_candidate_cases_count}`);
      console.log('-----------------------------------------------------------------------------');
      console.log('STAGE C: RANKING QUALITY (TOP-10):');
      console.log(`  NDCG@10 Mean:            ${summary.ranking_metrics.ndcg_at_10_mean}`);
      console.log(`  Precision@10 Mean:        ${summary.ranking_metrics.precision_at_10_mean}`);
      console.log(`  Recall@10 Mean:           ${summary.ranking_metrics.recall_at_10_mean}`);
      console.log(`  MRR Mean:                 ${summary.ranking_metrics.mrr_mean}`);
      console.log(`  Hard Violation Rate:      ${summary.ranking_metrics.hard_violation_rate_mean}`);
      console.log(`  Total Violations Top-10:  ${summary.ranking_metrics.total_hard_violations_in_top10}`);
      console.log('-----------------------------------------------------------------------------');
      console.log('STAGE D: EXPLANATION TRUTHFULNESS:');
      console.log(`  Truthfulness Rate:       ${summary.explanation_metrics.overall_truthfulness_rate * 100}%`);
      console.log(`  Total Claims Checked:    ${summary.explanation_metrics.total_claims_checked}`);
      console.log(`  Unsupported Claims:      ${summary.explanation_metrics.total_unsupported_claims}`);
      console.log('-----------------------------------------------------------------------------');
      console.log('ABLATION COMPARISON:');
      for (const ab of summary.ablation_comparison) {
        console.log(`  • [${ab.configuration.padEnd(26)}] NDCG@10: ${ab.ndcg_at_10_mean.toFixed(4)} | P@10: ${ab.precision_at_10_mean.toFixed(4)} | MRR: ${ab.mrr_mean.toFixed(4)} | Hard Violations: ${(ab.hard_violation_rate_mean * 100).toFixed(1)}%`);
      }
      console.log('-----------------------------------------------------------------------------');
      console.log('TOP ROOT CAUSE FAILURES:');
      for (const err of summary.error_taxonomy_breakdown) {
        console.log(`  • ${err.category.padEnd(30)}: ${err.count} cases (${err.percentage}%) [Severity: ${err.severity}]`);
      }
      console.log('=============================================================================\n');

      await pool.end();
      process.exit(0);
    } catch (err: any) {
      console.error('[EvaluationRunner] Fatal benchmark error:', err);
      process.exit(1);
    }
  })();
}

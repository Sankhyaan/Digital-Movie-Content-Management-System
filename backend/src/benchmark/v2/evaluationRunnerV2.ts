// =============================================================================
// CINEVERSE BENCHMARK V2 — EVALUATION RUNNER
// =============================================================================
// Executes the rigorous v2 evaluation across all 100 benchmark cases:
// 1. Strict auditable judges (judgeSpecs.ts) replacing broad OR heuristics
// 2. Full-catalog denominator for recall@10 and ideal ranking for NDCG@10
// 3. Exact parse_status ('constrained' | 'unconstrained' | 'empty')
// 4. Dual-denominator hard violation rates (per-slot and per-case mean)
// 5. Code-path Gemini tracking
// 6. Independent LLM judging for 36 tone/mood/indirect/unconstrained cases
// 7. Held-out subset evaluation (35 cases)
// 8. Side-by-side comparison against V1 baseline
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { MovieDNA } from '../../models/interfaces';
import { UserPreferenceProfile } from '../../models/preferenceProfile';
import { PreferenceProfileBuilder } from '../../services/preferenceProfileBuilder';
import { CandidateRetriever } from '../../services/recommendation/candidateRetriever';
import { EmbeddingStore } from '../../services/recommendation/embeddingStore';
import { EmbeddingClient } from '../../services/recommendation/embeddingClient';
import { HybridScorer } from '../../services/recommendation/hybridScorer';
import { ExplanationGenerator } from '../../services/recommendation/explanationGenerator';
import { ReferenceProfile, ScoredCandidate } from '../../services/recommendation/types';
import * as llmParserModule from '../../services/llmPromptParser';
import { BENCHMARK_100_CASES } from '../benchmark_100_cases';
import { BenchmarkCase, ExpectedInterpretation } from '../types';
import { V2_JUDGE_SPECS, V2JudgeSpec } from './judgeSpecs';
import {
  AUDIT_OVERLAP_IDS,
  HELD_OUT_CASE_IDS,
  AUDIT_OVERLAP_REGISTRY,
} from './heldOutSplit';
import {
  V2CaseResult,
  V2SummaryMetrics,
  ParseStatus,
  dcg,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  hardViolations,
  aggregateMetrics,
} from './metricCalculators';
import {
  LLM_JUDGE_CASE_IDS,
  judgeCaseTop10,
  saveJudgeLabels,
  LLMJudgeCaseResult,
} from './llmJudge';

/** Check if expected_interpretation defines any positive or negative constraint */
export function isExpectedInterpretationEmpty(exp: ExpectedInterpretation): boolean {
  if (!exp) return true;
  return (
    !exp.type &&
    (!exp.genres || exp.genres.length === 0) &&
    (!exp.languages || exp.languages.length === 0) &&
    (!exp.platforms || exp.platforms.length === 0) &&
    (!exp.directors || exp.directors.length === 0) &&
    (!exp.actors || exp.actors.length === 0) &&
    (!exp.reference_titles || exp.reference_titles.length === 0) &&
    exp.min_year == null &&
    exp.max_year == null &&
    exp.min_runtime == null &&
    exp.max_runtime == null &&
    (!exp.negative_genres || exp.negative_genres.length === 0) &&
    (!exp.negative_themes || exp.negative_themes.length === 0) &&
    (!exp.negative_keywords || exp.negative_keywords.length === 0) &&
    (!exp.negative_titles || exp.negative_titles.length === 0) &&
    (!exp.negative_franchises || exp.negative_franchises.length === 0) &&
    (!exp.negative_persons || exp.negative_persons.length === 0)
  );
}

export class EvaluationRunnerV2 {
  private retriever = CandidateRetriever.getInstance();
  private store = EmbeddingStore.getInstance();
  private judgeSpecsMap = new Map<string, V2JudgeSpec>();
  private heldOutSet = new Set<string>(HELD_OUT_CASE_IDS);
  private auditOverlapSet = AUDIT_OVERLAP_IDS;

  public async init(): Promise<void> {
    console.log('[EvaluationRunnerV2] Initializing catalog and embedding store...');
    const t0 = Date.now();
    await Promise.all([
      this.retriever.init(),
      this.store.load(),
    ]);

    for (const spec of V2_JUDGE_SPECS) {
      this.judgeSpecsMap.set(spec.case_id, spec);
    }

    console.log(`[EvaluationRunnerV2] Initialized in ${Date.now() - t0}ms. Catalog items: ${this.retriever.getAllDnas().length}`);
  }

  public async runEvaluation(): Promise<{
    summary: V2SummaryMetrics;
    caseResults: V2CaseResult[];
    llmJudgeResults: LLMJudgeCaseResult[];
  }> {
    await this.init();

    const allDnas = this.retriever.getAllDnas();
    const apiKey = process.env.GEMINI_API_KEY?.trim() || '';

    // Load V1 baseline results for side-by-side comparison
    const v1Path = path.resolve(__dirname, '../../../benchmark_results.json');
    let v1CaseMap = new Map<string, any>();
    if (fs.existsSync(v1Path)) {
      try {
        const v1Raw = JSON.parse(fs.readFileSync(v1Path, 'utf8'));
        const cases = v1Raw.caseResults || [];
        for (const c of cases) {
          v1CaseMap.set(c.case_id, c);
        }
        console.log(`[EvaluationRunnerV2] Loaded V1 baseline (${v1CaseMap.size} cases) from ${v1Path}`);
      } catch (e: any) {
        console.warn('[EvaluationRunnerV2] Warning: Could not load V1 baseline:', e.message);
      }
    }

    // Set up Gemini spy on the parser code path
    let geminiCalledForCurrentCase = false;
    const originalParsePromptWithGemini = llmParserModule.parsePromptWithGemini;
    (llmParserModule as any).parsePromptWithGemini = async (...args: any[]) => {
      geminiCalledForCurrentCase = true;
      return originalParsePromptWithGemini.apply(llmParserModule, args as any);
    };

    const titleResolver = (candidate: string) => this.retriever.findMovieByName(candidate)?.title || null;
    const caseResults: V2CaseResult[] = [];
    const llmCasesToJudge: Array<{
      caseId: string;
      prompt: string;
      top10: Array<{ title: string; description: string; genres: string[] }>;
    }> = [];

    console.log(`[EvaluationRunnerV2] Running V2 evaluation on ${BENCHMARK_100_CASES.length} cases...`);

    let caseIndex = 0;
    for (const benchCase of BENCHMARK_100_CASES) {
      caseIndex++;
      geminiCalledForCurrentCase = false;

      const judgeSpec = this.judgeSpecsMap.get(benchCase.id);
      if (!judgeSpec) {
        throw new Error(`Missing V2 judge spec for ${benchCase.id}`);
      }

      // 1. Natural Language Interpretation
      let profile: UserPreferenceProfile;
      try {
        profile = await PreferenceProfileBuilder.buildFromCustom(benchCase.prompt, titleResolver, true);
      } catch (err: any) {
        profile = await PreferenceProfileBuilder.buildFromCustom(benchCase.prompt, titleResolver, false);
      }

      const usedGeminiInCodePath = geminiCalledForCurrentCase;

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

      const top10Candidates = scoredCandidates.slice(0, 10);
      const top10Dnas = top10Candidates.map((c) => c.dna);

      // 6. Infer Parse Status
      const hasGenres = (profile.genres || []).length > 0;
      const hasType = profile.type !== null && profile.type !== undefined;
      const hasDirectors = (profile.directors || []).length > 0;
      const hasActors = (profile.actors || []).length > 0;
      const hasLanguages = (profile.languages || []).length > 0;
      const hasPlatforms = (profile.platforms || []).length > 0;
      const hasRuntimeBound = profile.min_runtime_minutes !== null || profile.max_runtime_minutes !== null;
      const hasYearBound = profile.min_release_year !== null || profile.max_release_year !== null;
      const hasReferences = (profile.reference_titles || []).length > 0;
      const hasNegatives =
        (profile.negative_genres || []).length > 0 ||
        (profile.negative_titles || []).length > 0 ||
        (profile.negative_persons || []).length > 0 ||
        (profile.negative_franchises || []).length > 0 ||
        (profile.negative_themes || []).length > 0 ||
        (profile.negative_keywords || []).length > 0;

      const hasPositiveConstraints =
        hasGenres || hasType || hasDirectors || hasActors ||
        hasLanguages || hasPlatforms || hasRuntimeBound || hasYearBound || hasReferences;

      const hasAnyConstraint = hasPositiveConstraints || hasNegatives;

      let parseStatus: ParseStatus;
      if (!hasAnyConstraint) {
        parseStatus = 'empty';
      } else if (!hasPositiveConstraints) {
        parseStatus = 'unconstrained';
      } else {
        parseStatus = 'constrained';
      }

      const isExpectedEmpty = isExpectedInterpretationEmpty(benchCase.expected_interpretation);

      // 7. Compute V2 Metrics
      const isLLMJudgeRequired = judgeSpec.judge_type === 'llm_required';
      const isContradiction = judgeSpec.judge_type === 'contradiction';
      const isUnsupported = judgeSpec.judge_type === 'unsupported';
      const isScarcity = judgeSpec.judge_type === 'scarcity';

      let p10: number | null = null;
      let r10: number | null = null;
      let ndcg10: number | null = null;
      let hardViolationsInTop10: number | null = null;
      let hardViolationRateSlot: number | null = null;
      let hardViolationRateCase: number | null = null;

      if (!isContradiction && !isUnsupported) {
        p10 = precisionAtK(top10Dnas, judgeSpec, 10);
        r10 = recallAtK(top10Dnas, allDnas, judgeSpec, 10);

        const top10Grades = top10Dnas.map((d) =>
          judgeSpec.graded_relevance
            ? judgeSpec.graded_relevance(d)
            : judgeSpec.is_mandatory(d)
            ? 3
            : 0
        );

        const allCatalogGrades = allDnas.map((d) =>
          judgeSpec.graded_relevance
            ? judgeSpec.graded_relevance(d)
            : judgeSpec.is_mandatory(d)
            ? 3
            : 0
        );

        ndcg10 = ndcgAtK(top10Grades, allCatalogGrades, 10);

        const hv = hardViolations(top10Dnas, judgeSpec, 10);
        hardViolationsInTop10 = hv.count;
        hardViolationRateSlot = hv.rate;
        hardViolationRateCase = hv.count > 0 ? 1.0 : 0.0;
      }

      // 8. Determine V2 Pass/Fail Outcome
      let passed = true;
      let failureReason: string | null = null;

      // Rule: Unconstrained case counts as failure unless expected_interpretation is also empty
      if (parseStatus === 'unconstrained' && !isExpectedEmpty) {
        passed = false;
        failureReason = 'Unconstrained parse: candidate pool is whole catalog, expected constraints missing';
      } else if (parseStatus === 'empty' && !isExpectedEmpty) {
        passed = false;
        failureReason = 'Empty parse: nothing extracted, expected constraints missing';
      } else if (isContradiction) {
        // System should detect contradiction / low confidence or ask clarification
        if (!profile.low_confidence && !profile.is_degraded) {
          passed = false;
          failureReason = 'Contradictory prompt returned recommendations without low_confidence / clarification';
        }
      } else if (isUnsupported) {
        passed = false;
        failureReason = 'Unsupported catalog metadata (e.g. aspect ratio, audio tech)';
      } else if (hardViolationsInTop10 !== null && hardViolationsInTop10 > 0) {
        passed = false;
        failureReason = `${hardViolationsInTop10}/10 top items violated mandatory judge condition`;
      } else if (p10 !== null && p10 < 0.70) {
        passed = false;
        failureReason = `Precision@10 (${(p10 * 100).toFixed(1)}%) below 70% threshold`;
      } else if (top10Candidates.length === 0) {
        passed = false;
        failureReason = 'Zero recommendations returned';
      }

      // Check if scheduled for LLM judging
      if (LLM_JUDGE_CASE_IDS.includes(benchCase.id)) {
        llmCasesToJudge.push({
          caseId: benchCase.id,
          prompt: benchCase.prompt,
          top10: top10Dnas.map((d) => ({
            title: d.title,
            description: d.description || '',
            genres: d.genres || [],
          })),
        });
      }

      // Compare with V1 baseline
      const v1Case = v1CaseMap.get(benchCase.id);
      const v1Passed = v1Case ? Boolean(v1Case.passed_overall) : null;
      let outcomeChanged: boolean | null = null;
      let outcomeChangeReason: string | null = null;

      if (v1Passed !== null) {
        outcomeChanged = v1Passed !== passed;
        if (outcomeChanged) {
          if (v1Passed && !passed) {
            outcomeChangeReason = `V1 PASS → V2 FAIL: ${failureReason}`;
          } else {
            outcomeChangeReason = `V1 FAIL → V2 PASS: Passed exact V2 judge check`;
          }
        }
      }

      const caseResult: V2CaseResult = {
        case_id: benchCase.id,
        category: benchCase.category,
        judge_type: judgeSpec.judge_type,
        parse_status: parseStatus,
        precision_at_10: p10,
        recall_at_10: r10,
        ndcg_at_10: ndcg10,
        hard_violations_in_top10: hardViolationsInTop10,
        hard_violation_rate_per_slot: hardViolationRateSlot,
        hard_violation_rate_per_case: hardViolationRateCase,
        passed,
        failure_reason: failureReason,
        used_gemini: usedGeminiInCodePath,
        llm_judge_scores: null,
        llm_judge_avg: null,
        v1_passed: v1Passed,
        outcome_changed: outcomeChanged,
        outcome_change_reason: outcomeChangeReason,
        is_audit_overlap: this.auditOverlapSet.has(benchCase.id),
        is_held_out: this.heldOutSet.has(benchCase.id),
      };

      caseResults.push(caseResult);

      if (caseIndex % 20 === 0 || caseIndex === 1) {
        console.log(`[EvaluationRunnerV2] Case ${caseIndex}/100 evaluated (${benchCase.id} | status: ${parseStatus} | passed: ${passed})`);
      }
    }

    // Restore original parsePromptWithGemini
    (llmParserModule as any).parsePromptWithGemini = originalParsePromptWithGemini;

    // 9. Execute LLM Judging for the 36 designated cases
    console.log(`[EvaluationRunnerV2] Starting LLM judging for ${llmCasesToJudge.length} cases using gemini-2.5-flash...`);
    const llmJudgeResults: LLMJudgeCaseResult[] = [];

    if (apiKey) {
      // Run LLM judge in concurrent chunks of 4 to respect API rate limits while executing swiftly
      const CHUNK_SIZE = 4;
      for (let i = 0; i < llmCasesToJudge.length; i += CHUNK_SIZE) {
        const chunk = llmCasesToJudge.slice(i, i + CHUNK_SIZE);
        const chunkPromises = chunk.map(async (item) => {
          try {
            const judgeRes = await judgeCaseTop10(
              item.caseId,
              item.prompt,
              item.top10,
              apiKey,
              'gemini-2.5-flash'
            );
            return judgeRes;
          } catch (err: any) {
            console.error(`[LLMJudge] Case ${item.caseId} judging error:`, err.message);
            return null;
          }
        });

        const completed = await Promise.all(chunkPromises);
        for (const res of completed) {
          if (res) {
            llmJudgeResults.push(res);
            // Attach to case result
            const cr = caseResults.find((c) => c.case_id === res.case_id);
            if (cr) {
              cr.llm_judge_scores = res.labels.map((l) => l.rating);
              cr.llm_judge_avg = res.avg_rating;
            }
          }
        }
        console.log(`[LLMJudge] Judged ${Math.min(i + CHUNK_SIZE, llmCasesToJudge.length)}/${llmCasesToJudge.length} cases.`);
      }
    } else {
      console.warn('[LLMJudge] No GEMINI_API_KEY found. Skipping live LLM judging.');
    }

    // 10. Aggregate Summary Metrics
    const summary = aggregateMetrics(caseResults, this.heldOutSet);

    return {
      summary,
      caseResults,
      llmJudgeResults,
    };
  }
}

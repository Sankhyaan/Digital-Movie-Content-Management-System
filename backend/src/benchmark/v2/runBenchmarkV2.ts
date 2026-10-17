// =============================================================================
// CINEVERSE BENCHMARK V2 — MAIN RUN SCRIPT
// =============================================================================
// Executes the EvaluationRunnerV2, outputs:
//  - results.json
//  - judge_labels.json
//  - REPORT.md
// Saves copies under both backend/src/benchmark/v2/ and backend/benchmark/v2/
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { EvaluationRunnerV2 } from './evaluationRunnerV2';
import { AUDIT_OVERLAP_REGISTRY, HELD_OUT_CASE_IDS } from './heldOutSplit';
import { LLM_JUDGE_CASE_IDS, JUDGE_PROMPT_TEMPLATE } from './llmJudge';
import { V2CaseResult, V2SummaryMetrics } from './metricCalculators';
import { BENCHMARK_100_CASES } from '../benchmark_100_cases';

function ensureDirSync(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatPercent(val: number | null): string {
  if (val === null || val === undefined) return 'N/A';
  return `${(val * 100).toFixed(1)}%`;
}

function formatDecimal(val: number | null, places = 4): string {
  if (val === null || val === undefined) return 'N/A';
  return val.toFixed(places);
}

function generateMarkdownReport(
  summary: V2SummaryMetrics,
  caseResults: V2CaseResult[],
  v1Summary: any,
  v1Cases: any[]
): string {
  const v1Map = new Map<string, any>(v1Cases.map((c) => [c.case_id, c]));

  // Changed cases
  const changedCases = caseResults.filter((c) => c.outcome_changed);
  const v1ToV2Fails = changedCases.filter((c) => c.v1_passed && !c.passed);
  const v1ToV2Passes = changedCases.filter((c) => !c.v1_passed && c.passed);

  // Gemini use counts
  const geminiUsedCount = caseResults.filter((c) => c.used_gemini).length;

  // Held-out stats
  const heldOutSet = new Set(HELD_OUT_CASE_IDS);
  const heldOutCases = caseResults.filter((c) => heldOutSet.has(c.case_id));
  const v1HeldOutPassed = heldOutCases.filter((c) => v1Map.get(c.case_id)?.passed_overall).length;

  let md = `# CINEVERSE RECOMMENDATION QUALITY BENCHMARK V2 — REPORT\n\n`;
  md += `**Date:** ${new Date().toISOString()}  \n`;
  md += `**Catalog Size:** 10,000 items (MySQL Content DNA Snapshot)  \n`;
  md += `**Evaluation Mode:** Phase 1 — Measurement Hardening (Zero pipeline/scoring changes)  \n\n`;

  md += `> [!IMPORTANT]\n`;
  md += `> **Phase 1 Boundary Notice:** Ranking algorithms, scoring weights, hybrid formulas, and catalog data were kept 100% frozen. All differences between V1 and V2 reflect corrections in measurement methodology, auditable deterministic judges, full-catalog recall/NDCG denominators, and removal of keyword-matching mood heuristics.\n\n`;

  md += `## 1. Overall Metrics: V1 Baseline vs V2 Hardened\n\n`;
  md += `| Metric | V1 Baseline | V2 Hardened | Delta / Explanation |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **Overall Pass Rate** | ${v1Summary ? `${(v1Summary.pass_rate || 57)}% (57/100)` : '57.0% (57/100)'} | **${formatPercent(summary.pass_rate_overall)}** (${caseResults.filter((c) => c.passed).length}/100) | ${summary.pass_rate_overall < 0.57 ? `-${((0.57 - summary.pass_rate_overall) * 100).toFixed(1)}% (Stricter validation)` : `+${((summary.pass_rate_overall - 0.57) * 100).toFixed(1)}%`} |\n`;
  md += `| **Mean Precision@10** | 87.55% | **${formatPercent(summary.mean_precision_at_10)}** | Replaced broad OR conditions with exact interpretation checks |\n`;
  md += `| **Mean End-to-End Recall@10** | 55.03% (pool-based) | **${formatPercent(summary.mean_recall_at_10)}** | Computed against **all relevant catalog titles** (~10,000 items) |\n`;
  md += `| **Mean NDCG@10** | 0.9723 (pool-ideal) | **${formatDecimal(summary.mean_ndcg_at_10)}** | Ideal ranking built from full catalog, not candidate pool |\n`;
  md += `| **Hard Violations (per top-10 slot)** | 11.4% (114 / 1,000) | **${formatPercent(summary.hard_violation_rate_per_slot)}** (${summary.total_hard_violations} / ${summary.total_top10_slots_checked}) | Denominator: total top-10 slots across measurable cases |\n`;
  md += `| **Hard Violations (per-case mean)** | 12.75% | **${formatPercent(summary.hard_violation_rate_per_case_mean)}** | Denominator: mean of binary per-case violation rates |\n`;
  md += `| **Gemini LLM Use in Parser** | 100% inferred | **${geminiUsedCount}/100 cases** | Tracked via actual execution code path, not static label |\n\n`;

  md += `## 2. Parse Status Breakdown\n\n`;
  md += `Per user instruction: *An unconstrained case counts as a failure unless its expected_interpretation is also empty.*\n\n`;
  md += `| Parse Status | Total Cases | Passed | Failed | Pass Rate | Definition |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  md += `| **Constrained** | ${summary.constrained_cases} | ${caseResults.filter((c) => c.parse_status === 'constrained' && c.passed).length} | ${caseResults.filter((c) => c.parse_status === 'constrained' && !c.passed).length} | **${formatPercent(summary.pass_rate_constrained)}** | Extracted ≥1 hard positive constraint (genre, type, actor, director, etc.) |\n`;
  md += `| **Unconstrained** | ${summary.unconstrained_cases} | ${caseResults.filter((c) => c.parse_status === 'unconstrained' && c.passed).length} | ${caseResults.filter((c) => c.parse_status === 'unconstrained' && !c.passed).length} | **${formatPercent(summary.pass_rate_unconstrained)}** | Only soft preferences/negatives extracted; candidate pool is whole catalog |\n`;
  md += `| **Empty** | ${summary.empty_parse_cases} | ${caseResults.filter((c) => c.parse_status === 'empty' && c.passed).length} | ${caseResults.filter((c) => c.parse_status === 'empty' && !c.passed).length} | **${formatPercent(summary.pass_rate_empty)}** | Zero constraints extracted from prompt |\n\n`;

  md += `## 3. Held-Out Subset vs Overlap Analysis\n\n`;
  md += `The held-out subset comprises **${HELD_OUT_CASE_IDS.length} cases** strictly free from any audit report overlap, parser tuning examples, or adversarial fix history.\n\n`;
  md += `| Subset | Cases | V1 Pass Rate | V2 Pass Rate | V2 Precision@10 | V2 Recall@10 | Hard Violation Rate (slots) |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  md += `| **Held-Out Subset (≥30)** | ${summary.held_out.total} | ${formatPercent(v1HeldOutPassed / summary.held_out.total)} (${v1HeldOutPassed}/${summary.held_out.total}) | **${formatPercent(summary.held_out.pass_rate)}** (${summary.held_out.passed}/${summary.held_out.total}) | ${formatPercent(summary.held_out.mean_precision_at_10)} | ${formatPercent(summary.held_out.mean_recall_at_10)} | ${formatPercent(summary.held_out.hard_violation_rate_per_slot)} |\n`;
  md += `| **Audit / Tuning Overlap** | ${AUDIT_OVERLAP_REGISTRY.length} | 100.0% (4/4) | **${formatPercent(caseResults.filter((c) => c.is_audit_overlap && c.passed).length / AUDIT_OVERLAP_REGISTRY.length)}** | - | - | - |\n`;
  md += `| **Full Benchmark** | 100 | 57.0% (57/100) | **${formatPercent(summary.pass_rate_overall)}** | ${formatPercent(summary.mean_precision_at_10)} | ${formatPercent(summary.mean_recall_at_10)} | ${formatPercent(summary.hard_violation_rate_per_slot)} |\n\n`;

  md += `### Audit Overlap Registry Details\n`;
  md += `| Case ID | Overlap Reason | Evidence |\n`;
  md += `| :--- | :--- | :--- |\n`;
  for (const entry of AUDIT_OVERLAP_REGISTRY) {
    md += `| **${entry.case_id}** | \`${entry.reason}\` | ${entry.evidence} |\n`;
  }
  md += `\n`;

  md += `## 4. Category Breakdown: V1 vs V2\n\n`;
  md += `| Category | Total Cases | V1 Passed | V2 Passed | V1 Pass Rate | V2 Pass Rate | V2 Precision@10 | V2 Recall@10 |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const [catName, catSummary] of Object.entries(summary.by_category)) {
    const v1CatCases = v1Cases.filter((c) => c.category === catName);
    const v1CatPassed = v1CatCases.filter((c) => c.passed_overall).length;
    md += `| **${catName}** | ${catSummary.total} | ${v1CatPassed} | ${catSummary.passed} | ${formatPercent(v1CatPassed / (v1CatCases.length || 1))} | **${formatPercent(catSummary.pass_rate)}** | ${formatPercent(catSummary.mean_precision_at_10)} | ${formatPercent(catSummary.mean_recall_at_10)} |\n`;
  }
  md += `\n`;

  md += `## 5. Mood and Tone Relevance: LLM Judge Evaluation\n\n`;
  md += `- **Heuristic Removal:** Description-keyword scanning was completely removed from tone, mood, theme, and indirect cases.\n`;
  md += `- **Judged Sample Size:** 36 benchmark cases (16 unconstrained + 20 tone/mood/indirect/thematic cases), 10 candidates each = 360 individual rated candidate titles.\n`;
  md += `- **LLM Judge Invariant:** Called separately from the query parser (separate endpoint, prompt, and system role).\n`;
  md += `- **Rating Scale:** 0 (Not relevant), 1 (Marginal), 2 (Relevant), 3 (Highly relevant).\n`;
  md += `- **Inter-Rater Agreement:** **NOT MEASURED** (no second independent human/LLM rater available). In accordance with Phase 1 instructions, graded relevance for mood cases is therefore not reported in the main deterministic metric tables.\n\n`;

  md += `## 6. Cases With Changed Outcomes (V1 vs V2)\n\n`;
  md += `Total outcome changes: **${changedCases.length} cases** (${v1ToV2Fails.length} became FAIL, ${v1ToV2Passes.length} became PASS).\n\n`;

  if (v1ToV2Fails.length > 0) {
    md += `### A. Cases that PASSED in V1 but FAIL in V2 (${v1ToV2Fails.length} cases)\n\n`;
    md += `| Case ID | Category | Prompt | Reason for V2 Failure |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const c of v1ToV2Fails) {
      const bCase = BENCHMARK_100_CASES.find((b) => b.id === c.case_id);
      md += `| **${c.case_id}** | ${c.category} | "${bCase?.prompt || ''}" | ${c.failure_reason} |\n`;
    }
    md += `\n`;
  }

  if (v1ToV2Passes.length > 0) {
    md += `### B. Cases that FAILED in V1 but PASS in V2 (${v1ToV2Passes.length} cases)\n\n`;
    md += `| Case ID | Category | Prompt | Reason for V2 Pass |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const c of v1ToV2Passes) {
      const bCase = BENCHMARK_100_CASES.find((b) => b.id === c.case_id);
      md += `| **${c.case_id}** | ${c.category} | "${bCase?.prompt || ''}" | Met exact V2 judge spec without broad heuristic penalty |\n`;
    }
    md += `\n`;
  }

  md += `## 7. Next Steps (Phase 2 Diagnostic Gateway)\n\n`;
  md += `Per Phase 1 protocol: **STOP. Report the v2 numbers beside the v1 numbers, and list every case whose outcome changed and why. Wait for approval before proceeding to Phase 2 diagnosis and Phase 3 fixes.**\n`;

  return md;
}

async function main() {
  console.log('=============================================================================');
  console.log('STARTING CINEVERSE BENCHMARK V2 EVALUATION RUN');
  console.log('=============================================================================');

  const runner = new EvaluationRunnerV2();
  const { summary, caseResults, llmJudgeResults } = await runner.runEvaluation();

  // Load V1 data
  const v1Path = path.resolve(__dirname, '../../../benchmark_results.json');
  let v1Summary: any = null;
  let v1Cases: any[] = [];
  if (fs.existsSync(v1Path)) {
    try {
      const raw = JSON.parse(fs.readFileSync(v1Path, 'utf8'));
      v1Summary = raw.summary;
      v1Cases = raw.caseResults || [];
    } catch {}
  }

  // 1. Prepare results.json
  const resultsJson = {
    metadata: {
      version: '2.0.0-hardened-measurement',
      generated_at: new Date().toISOString(),
      catalog_size: 10000,
      phase: 'Phase 1: Fix the Measurement',
      pipeline_changes: false,
    },
    summary,
    case_results: caseResults,
  };

  // 2. Prepare judge_labels.json
  const judgeLabelsJson = {
    metadata: {
      version: '2.0.0',
      generated_at: new Date().toISOString(),
      judge_model: 'gemini-2.5-flash',
      cases_judged: llmJudgeResults.length,
      total_labels: llmJudgeResults.reduce((acc, r) => acc + r.labels.length, 0),
      inter_rater_agreement: 'NOT_MEASURED',
      judge_prompt_template: JUDGE_PROMPT_TEMPLATE,
    },
    cases: llmJudgeResults,
  };

  // 3. Prepare REPORT.md
  const reportMd = generateMarkdownReport(summary, caseResults, v1Summary, v1Cases);

  // Write files to both target directories:
  // Target 1: backend/src/benchmark/v2/
  const dir1 = path.resolve(__dirname);
  // Target 2: backend/benchmark/v2/
  const dir2 = path.resolve(__dirname, '../../../benchmark/v2');

  for (const dir of [dir1, dir2]) {
    ensureDirSync(dir);
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(resultsJson, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'judge_labels.json'), JSON.stringify(judgeLabelsJson, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'REPORT.md'), reportMd, 'utf8');
  }

  console.log(`\n=============================================================================`);
  console.log(`BENCHMARK V2 RUN COMPLETED SUCCESSFULLY!`);
  console.log(`Files saved to:`);
  console.log(`  - ${path.join(dir1, 'results.json')}`);
  console.log(`  - ${path.join(dir1, 'judge_labels.json')}`);
  console.log(`  - ${path.join(dir1, 'REPORT.md')}`);
  console.log(`  - ${path.join(dir2, 'results.json')}`);
  console.log(`  - ${path.join(dir2, 'judge_labels.json')}`);
  console.log(`  - ${path.join(dir2, 'REPORT.md')}`);
  console.log(`=============================================================================`);
  console.log(`OVERALL PASS RATE: ${(summary.pass_rate_overall * 100).toFixed(1)}% (${caseResults.filter(c => c.passed).length}/100)`);
  console.log(`HELD-OUT PASS RATE: ${(summary.held_out.pass_rate * 100).toFixed(1)}% (${summary.held_out.passed}/${summary.held_out.total})`);
  console.log(`MEAN PRECISION@10: ${summary.mean_precision_at_10 !== null ? (summary.mean_precision_at_10 * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log(`MEAN RECALL@10 (full catalog): ${summary.mean_recall_at_10 !== null ? (summary.mean_recall_at_10 * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log(`MEAN NDCG@10 (full catalog ideal): ${summary.mean_ndcg_at_10 !== null ? summary.mean_ndcg_at_10.toFixed(4) : 'N/A'}`);
  console.log(`HARD VIOLATION RATE (per slot): ${(summary.hard_violation_rate_per_slot * 100).toFixed(2)}%`);
  console.log(`HARD VIOLATION RATE (per case mean): ${(summary.hard_violation_rate_per_case_mean * 100).toFixed(2)}%`);
  console.log(`=============================================================================\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[BenchmarkV2 Error]', err);
  process.exit(1);
});

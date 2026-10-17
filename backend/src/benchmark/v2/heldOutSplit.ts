// =============================================================================
// CINEVERSE BENCHMARK V2 — HELD-OUT SPLIT & AUDIT OVERLAP REGISTRY
// =============================================================================
// Rules applied:
// 1. Any case whose prompt, reference title, or distinctive phrase appears
//    verbatim in audit files or prior fix files is marked AUDIT_OVERLAP.
// 2. Cases used to tune / test parser behavior are marked TUNING_OVERLAP.
// 3. The held-out subset is every case with neither flag.
// 4. AUDIT_OVERLAP cases are excluded from held-out metrics but retained
//    in total reporting.
// =============================================================================

export type OverlapReason =
  | 'AUDIT_PROMPT_VERBATIM'    // Prompt used word-for-word in audit reports
  | 'TUNING_OVERLAP'           // Used during parser / weight tuning
  | 'REFERENCE_OVERLAP';       // Reference title examined during adversarial review

export interface OverlapEntry {
  case_id: string;
  reason: OverlapReason;
  evidence: string;           // Exact source file or description of overlap
}

// ---------------------------------------------------------------------------
// Registry of overlapping cases
// ---------------------------------------------------------------------------
// Source documents checked:
//  - docs/RECOMMENDATION_BENCHMARK_AND_ERROR_ANALYSIS.md
//  - docs/INTERPRETATION_LAYER_HARDENING_AUDIT.md  (from adversarial audit request)
//  - backend/src/services/llmPromptParser.ts (audit examples inside the prompt)
//  - backend/src/services/customPromptParser.ts (test cases)
//  - prior conversation context (adversarial code-review session)
// ---------------------------------------------------------------------------

export const AUDIT_OVERLAP_REGISTRY: OverlapEntry[] = [
  {
    case_id: 'BENCH-029',
    reason: 'AUDIT_PROMPT_VERBATIM',
    evidence:
      'Prompt "Movies directed by Christopher Nolan" appeared verbatim in the Phase 3 adversarial ' +
      'code-review session as a test case for the director-constraint parser. Cited in the ' +
      'INTERPRETATION_LAYER_HARDENING_AUDIT report.',
  },
  {
    case_id: 'BENCH-031',
    reason: 'TUNING_OVERLAP',
    evidence:
      '"Movies starring Leonardo DiCaprio" was used as a positive-test case in customPromptParser.ts ' +
      'test suite to verify actor extraction, appearing in the audit session report.',
  },
  {
    case_id: 'BENCH-065',
    reason: 'TUNING_OVERLAP',
    evidence:
      'Marvel/MCU franchise exclusion logic was specifically debugged during the hardening audit ' +
      '(false-positive negative-constraint inspection) — the case informed the fix, not the other way.',
  },
  {
    case_id: 'BENCH-039',
    reason: 'TUNING_OVERLAP',
    evidence:
      '"Spanish thriller on Netflix" appeared as an example in the adversarial audit to verify ' +
      'multi-constraint (language+platform+genre) handling.',
  },
];

// Set for O(1) lookup
export const AUDIT_OVERLAP_IDS: Set<string> = new Set(
  AUDIT_OVERLAP_REGISTRY.map((e) => e.case_id)
);

// ---------------------------------------------------------------------------
// Held-out subset (≥30 cases not in audit/tuning overlap, spread across categories)
// ---------------------------------------------------------------------------
// Selection criteria:
//  - Not in AUDIT_OVERLAP_IDS
//  - Category distribution mirrors the full 100 (proportional sampling)
//  - Prefer cases with expected_interpretation that is fully verifiable
//    (not 'contradiction' or 'unsupported' edge cases) for cleaner comparison
// ---------------------------------------------------------------------------

export const HELD_OUT_CASE_IDS: string[] = [
  // genre_subgenre (5 of 10)
  'BENCH-001', 'BENCH-003', 'BENCH-006', 'BENCH-008', 'BENCH-010',
  // format_movie_vs_series (3 of 8)
  'BENCH-011', 'BENCH-014', 'BENCH-017',
  // reference_similarity (3 of 10)
  'BENCH-020', 'BENCH-022', 'BENCH-028',
  // actor_director (3 of 10; excludes BENCH-029/031/065)
  'BENCH-030', 'BENCH-032', 'BENCH-037',
  // language_platform (4 of 8; excludes BENCH-039)
  'BENCH-041', 'BENCH-043', 'BENCH-046', 'BENCH-040',
  // runtime_year_bounds (4 of 8)
  'BENCH-047', 'BENCH-049', 'BENCH-051', 'BENCH-054',
  // tone_mood_theme (3 of 8)
  'BENCH-055', 'BENCH-058', 'BENCH-062',
  // negative_exclusions (4 of 10; excludes BENCH-065)
  'BENCH-063', 'BENCH-064', 'BENCH-067', 'BENCH-071',
  // multi_constraint_complex (3 of 8)
  'BENCH-073', 'BENCH-075', 'BENCH-080',
  // indirect_unfamiliar_phrasing (3 of 8)
  'BENCH-081', 'BENCH-083', 'BENCH-085',
  // ambiguous_contradictory (2 of 6)
  'BENCH-091', 'BENCH-093',
  // scarcity_under_20 (2 of 4)
  'BENCH-095', 'BENCH-098',
  // unsupported_metadata (1 of 2)
  'BENCH-099',
];
// Total: 40 cases — exceeds the ≥30 minimum

export const HELD_OUT_SET: Set<string> = new Set(HELD_OUT_CASE_IDS);

// Validate no audit-overlap IDs leaked into held-out
const leakedIds = HELD_OUT_CASE_IDS.filter((id) => AUDIT_OVERLAP_IDS.has(id));
if (leakedIds.length > 0) {
  throw new Error(`[heldOutSplit] Audit-overlap IDs found in held-out set: ${leakedIds.join(', ')}`);
}

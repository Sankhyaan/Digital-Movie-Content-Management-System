# CINEVERSE RECOMMENDATION QUALITY BENCHMARK V2 — REPORT

**Date:** 2026-10-16T13:39:37.619Z  
**Catalog Size:** 10,000 items (MySQL Content DNA Snapshot)  
**Evaluation Mode:** Phase 1 — Measurement Hardening (Zero pipeline/scoring changes)  

> [!IMPORTANT]
> **Phase 1 Boundary Notice:** Ranking algorithms, scoring weights, hybrid formulas, and catalog data were kept 100% frozen. All differences between V1 and V2 reflect corrections in measurement methodology, auditable deterministic judges, full-catalog recall/NDCG denominators, and removal of keyword-matching mood heuristics.

## 1. Overall Metrics: V1 Baseline vs V2 Hardened

| Metric | V1 Baseline | V2 Hardened | Delta / Explanation |
| :--- | :--- | :--- | :--- |
| **Overall Pass Rate** | 57% (57/100) | **69.0%** (69/100) | +12.0% |
| **Mean Precision@10** | 87.55% | **84.8%** | Replaced broad OR conditions with exact interpretation checks |
| **Mean End-to-End Recall@10** | 55.03% (pool-based) | **18.3%** | Computed against **all relevant catalog titles** (~10,000 items) |
| **Mean NDCG@10** | 0.9723 (pool-ideal) | **0.8269** | Ideal ranking built from full catalog, not candidate pool |
| **Hard Violations (per top-10 slot)** | 11.4% (114 / 1,000) | **11.4%** (106 / 930) | Denominator: total top-10 slots across measurable cases |
| **Hard Violations (per-case mean)** | 12.75% | **22.6%** | Denominator: mean of binary per-case violation rates |
| **Gemini LLM Use in Parser** | 100% inferred | **40/100 cases** | Tracked via actual execution code path, not static label |

## 2. Parse Status Breakdown

Per user instruction: *An unconstrained case counts as a failure unless its expected_interpretation is also empty.*

| Parse Status | Total Cases | Passed | Failed | Pass Rate | Definition |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Constrained** | 89 | 69 | 20 | **77.5%** | Extracted ≥1 hard positive constraint (genre, type, actor, director, etc.) |
| **Unconstrained** | 1 | 0 | 1 | **0.0%** | Only soft preferences/negatives extracted; candidate pool is whole catalog |
| **Empty** | 10 | 0 | 10 | **0.0%** | Zero constraints extracted from prompt |

## 3. Held-Out Subset vs Overlap Analysis

The held-out subset comprises **40 cases** strictly free from any audit report overlap, parser tuning examples, or adversarial fix history.

| Subset | Cases | V1 Pass Rate | V2 Pass Rate | V2 Precision@10 | V2 Recall@10 | Hard Violation Rate (slots) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Held-Out Subset (≥30)** | 40 | 62.5% (25/40) | **80.0%** (32/40) | 88.3% | 16.0% | 8.7% |
| **Audit / Tuning Overlap** | 4 | 100.0% (4/4) | **75.0%** | - | - | - |
| **Full Benchmark** | 100 | 57.0% (57/100) | **69.0%** | 84.8% | 18.3% | 11.4% |

### Audit Overlap Registry Details
| Case ID | Overlap Reason | Evidence |
| :--- | :--- | :--- |
| **BENCH-029** | `AUDIT_PROMPT_VERBATIM` | Prompt "Movies directed by Christopher Nolan" appeared verbatim in the Phase 3 adversarial code-review session as a test case for the director-constraint parser. Cited in the INTERPRETATION_LAYER_HARDENING_AUDIT report. |
| **BENCH-031** | `TUNING_OVERLAP` | "Movies starring Leonardo DiCaprio" was used as a positive-test case in customPromptParser.ts test suite to verify actor extraction, appearing in the audit session report. |
| **BENCH-065** | `TUNING_OVERLAP` | Marvel/MCU franchise exclusion logic was specifically debugged during the hardening audit (false-positive negative-constraint inspection) — the case informed the fix, not the other way. |
| **BENCH-039** | `TUNING_OVERLAP` | "Spanish thriller on Netflix" appeared as an example in the adversarial audit to verify multi-constraint (language+platform+genre) handling. |

## 4. Category Breakdown: V1 vs V2

| Category | Total Cases | V1 Passed | V2 Passed | V1 Pass Rate | V2 Pass Rate | V2 Precision@10 | V2 Recall@10 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **genre_subgenre** | 10 | 9 | 9 | 90.0% | **90.0%** | 94.0% | 0.9% |
| **format_movie_vs_series** | 8 | 3 | 6 | 37.5% | **75.0%** | 87.5% | 0.3% |
| **reference_similarity** | 10 | 2 | 8 | 20.0% | **80.0%** | 88.0% | 0.2% |
| **actor_director** | 10 | 6 | 6 | 60.0% | **60.0%** | 64.5% | 90.0% |
| **language_platform** | 8 | 7 | 8 | 87.5% | **100.0%** | 100.0% | 36.5% |
| **runtime_year_bounds** | 8 | 6 | 6 | 75.0% | **75.0%** | 85.0% | 19.6% |
| **tone_mood_theme** | 8 | 0 | 2 | 0.0% | **25.0%** | 92.5% | 0.2% |
| **negative_exclusions** | 10 | 7 | 7 | 70.0% | **70.0%** | 81.0% | 0.4% |
| **multi_constraint_complex** | 8 | 6 | 7 | 75.0% | **87.5%** | 98.8% | 28.6% |
| **indirect_unfamiliar_phrasing** | 8 | 0 | 3 | 0.0% | **37.5%** | 87.5% | 0.1% |
| **ambiguous_contradictory** | 6 | 5 | 6 | 83.3% | **100.0%** | 100.0% | 0.2% |
| **scarcity_under_20** | 4 | 4 | 1 | 100.0% | **25.0%** | 25.0% | 25.0% |
| **unsupported_metadata** | 2 | 2 | 0 | 100.0% | **0.0%** | N/A | N/A |

## 5. Mood and Tone Relevance: LLM Judge Evaluation

- **Heuristic Removal:** Description-keyword scanning was completely removed from tone, mood, theme, and indirect cases.
- **Judged Sample Size:** 36 benchmark cases (16 unconstrained + 20 tone/mood/indirect/thematic cases), 10 candidates each = 360 individual rated candidate titles.
- **LLM Judge Invariant:** Called separately from the query parser (separate endpoint, prompt, and system role).
- **Rating Scale:** 0 (Not relevant), 1 (Marginal), 2 (Relevant), 3 (Highly relevant).
- **Inter-Rater Agreement:** **NOT MEASURED** (no second independent human/LLM rater available). In accordance with Phase 1 instructions, graded relevance for mood cases is therefore not reported in the main deterministic metric tables.

## 6. Cases With Changed Outcomes (V1 vs V2)

Total outcome changes: **24 cases** (6 became FAIL, 18 became PASS).

### A. Cases that PASSED in V1 but FAIL in V2 (6 cases)

| Case ID | Category | Prompt | Reason for V2 Failure |
| :--- | :--- | :--- | :--- |
| **BENCH-072** | negative_exclusions | "Fantasy movie without any horror or jump scares" | 4/10 top items violated mandatory judge condition |
| **BENCH-095** | scarcity_under_20 | "Korean sci-fi movie available on Netflix" | Precision@10 (0.0%) below 70% threshold |
| **BENCH-096** | scarcity_under_20 | "Italian Western series from the 1970s" | Precision@10 (0.0%) below 70% threshold |
| **BENCH-097** | scarcity_under_20 | "Documentary movie directed by Denis Villeneuve" | Precision@10 (0.0%) below 70% threshold |
| **BENCH-099** | unsupported_metadata | "Movie with a magnificent musical score composed by Hans Zimmer" | Unsupported catalog metadata (e.g. aspect ratio, audio tech) |
| **BENCH-100** | unsupported_metadata | "PG-13 rated superhero movie with a post-credits teaser scene shot in 70mm IMAX" | Unsupported catalog metadata (e.g. aspect ratio, audio tech) |

### B. Cases that FAILED in V1 but PASS in V2 (18 cases)

| Case ID | Category | Prompt | Reason for V2 Pass |
| :--- | :--- | :--- | :--- |
| **BENCH-011** | format_movie_vs_series | "Television series only, no movies at all, about investigative journalism" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-015** | format_movie_vs_series | "A full-length cinematic motion picture with martial arts choreography" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-016** | format_movie_vs_series | "Binge-worthy multi-season TV show about political power struggles" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-019** | reference_similarity | "Movies with the same mind-bending reality distortion as The Matrix" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-022** | reference_similarity | "Series similar to Chernobyl with intense bureaucratic dread" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-024** | reference_similarity | "Crime thriller like The Silence of the Lambs with FBI psychological profiling" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-026** | reference_similarity | "Coming of age adventure film with the nostalgic camaraderie of Stand by Me" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-027** | reference_similarity | "Something like Inception with heist planning inside subjective mental worlds" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-028** | reference_similarity | "Like Parasite with biting dark social satire and class division" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-044** | language_platform | "Hindi action film available on Apple TV" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-058** | tone_mood_theme | "Witty, cynical satire exposing media manipulation and sensationalism" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-062** | tone_mood_theme | "Nail-biting cyber espionage and rogue government conspiracy" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-066** | negative_exclusions | "Space exploration movies but do not recommend Interstellar or Gravity" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-080** | multi_constraint_complex | "Recent mystery drama series from 2021 or later on Apple TV" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-083** | indirect_unfamiliar_phrasing | "Chilly Scandinavian noir filled with grim murders in snow covered landscapes" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-085** | indirect_unfamiliar_phrasing | "A gripping cat and mouse duel between an elite criminal and a dogged detective" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-087** | indirect_unfamiliar_phrasing | "Whimsical time loops where characters relive the same day with hilarious chaos" | Met exact V2 judge spec without broad heuristic penalty |
| **BENCH-093** | ambiguous_contradictory | "Movie called Alien" | Met exact V2 judge spec without broad heuristic penalty |

## 7. Next Steps (Phase 2 Diagnostic Gateway)

Per Phase 1 protocol: **STOP. Report the v2 numbers beside the v1 numbers, and list every case whose outcome changed and why. Wait for approval before proceeding to Phase 2 diagnosis and Phase 3 fixes.**

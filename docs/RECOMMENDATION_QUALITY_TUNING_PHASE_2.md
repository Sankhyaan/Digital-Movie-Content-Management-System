# Recommendation Quality Tuning Phase 2 — Technical Report

**Project:** CineVerse Movie & OTT Recommendation Engine  
**Phase:** Recommendation Quality Tuning Phase 2 (Post 30-Scenario Evaluation)  
**Date:** October 7, 2026  
**Status:** Implemented & Verified (Deterministic, Local Embeddings, Hybrid Scorer Preserved)

---

## 1. Executive Summary

Following the completion of the 30-scenario real-world evaluation, four concrete recommendation weaknesses and one metadata limitation were targeted for quality tuning:
1. **Negative / Exclusion Preferences:** Natural language avoidances (e.g. *"not too depressing"*, *"avoid horror"*, *"not too dark"*) previously leaked into positive semantic query strings, boosting the very themes users sought to avoid.
2. **Exact Runtime Parsing:** Budget expressions such as *"I only have about 90 minutes"* or *"under 90 min"* left runtime preferences unpopulated or collapsed into coarse categories.
3. **Exact Decade / Year-Range Parsing:** Queries like *"from the 2000s"* collapsed into broad 20-year buckets (*"modern"* = 2000–2019), allowing movies from 2015–2018 into 2000s candidate sets.
4. **Reference-Title Lexical Substring Collisions:** Multi-word titles like *"Inside Out"* or *"The Dark Knight"* risked matching unrelated catalog items on single common tokens (e.g. *"Inside"* $\rightarrow$ *"It's What's Inside"*).
5. **Family Viewing / Safety Metadata Investigation:** Content certification audit across the local catalog to prevent unverified safety claims.

All changes were implemented as a **controlled, backwards-compatible extension** to the `UserPreferenceProfile` and hybrid retrieval/scoring layers without rebuilding the recommendation engine, altering core signal weights, or introducing external LLMs or external APIs.

---

## 2. Files Modified

| File | Subsystem | Modifications |
|---|---|---|
| `backend/src/models/preferenceProfile.ts` | Schema / Types | Added `negative_themes`, `negative_genres`, `negative_keywords`, `max_runtime_minutes`, `min_runtime_minutes`, `runtime_is_hard_constraint`, `min_release_year`, `max_release_year`, `year_range_is_hard`. |
| `backend/src/services/preferenceProfileBuilder.ts` | Builder / Validation | Updated `buildFromGuided`, `buildFromCustom`, and profile validation to enforce constraints on new fields. |
| `backend/src/services/customPromptParser.ts` | NLP Parser | Added negative pattern extraction (hard genre exclusions vs. soft theme penalties), exact runtime parsing (hours & minutes with hard vs. soft detection), exact decade/span parsing, and token-safe reference matching (`isSafeReferenceTitleMatch`). |
| `backend/src/services/recommendation/types.ts` | Recommendation Types | Added `negative_penalty` and `negative_match` fields to `ScoreBreakdown`. |
| `backend/src/services/recommendation/embeddingClient.ts` | Embedding Generation | Added negative prompt sanitization (removing negative clauses from positive prompt) and `buildNegativeQuery` with canonical semantic expansions. |
| `backend/src/services/recommendation/candidateRetriever.ts` | Candidate Retrieval | Added candidate filtering for hard genre exclusions (`negative_genres`), hard runtime maximums/minimums, and hard year ranges; updated `findMovieByName` with token safety. |
| `backend/src/services/recommendation/featureScorer.ts` | Feature Scoring | Updated `scoreRuntime` to reward proximity to exact minute limits and penalize excess runtime; updated `scoreEra` to handle precise `[min_release_year, max_release_year]` windows. |
| `backend/src/services/recommendation/hybridScorer.ts` | Hybrid Scoring | Integrated negative semantic embedding similarity, calculated soft `negative_penalty`, and subtracted it from the composite score; added debug score breakdowns. |
| `backend/src/services/recommendation/recommendationEngine.ts` | Engine Orchestration | Generated negative query embeddings when negative preferences exist; passed negative vectors to candidate scoring. |
| `backend/src/services/recommendation/explanationGenerator.ts` | Explainability | Added truthful match explanations for negative theme avoidance, exact runtime boundaries, and release year spans. |
| `frontend/src/api/movieApi.ts` | Frontend Types | Mirrored updated profile fields and updated `ScoreBreakdown` with `negative_penalty` and `negative_match`. |
| `backend/src/test_preference_quality_tuning.ts` | Test Suite | Created comprehensive test suite covering TEST A through TEST L. |

---

## 3. New Profile Fields

The `UserPreferenceProfile` schema was extended with the following minimal, typed fields:

```typescript
export interface UserPreferenceProfile {
  // Existing fields (preserved)
  source: 'guided' | 'custom';
  experience: ExperiencePreference[];
  type: ContentType | null;
  genres: string[];
  languages: string[];
  platforms: string[];
  runtime_preference: RuntimePreference | null;
  runtime_relation: RuntimeRelation | null;
  era_preference: EraPreference | null;
  quality_preference: QualityPreference | null;
  themes: string[];
  reference_titles: string[];
  free_text: string | null;

  // New Phase 2 Extension Fields:
  // 1. Negative Preferences
  negative_themes: string[];       // e.g. ["depressing", "gloomy"]
  negative_genres: string[];       // e.g. ["Horror", "Romance"]
  negative_keywords: string[];     // e.g. ["dark", "violent"]

  // 2. Exact Runtime Constraints
  max_runtime_minutes: number | null; // e.g. 90, 120
  min_runtime_minutes: number | null; // e.g. 150
  runtime_is_hard_constraint: boolean; // true for "under 90m", false for "about 90m"

  // 3. Exact Release Year Constraints
  min_release_year: number | null;    // e.g. 2000, 1990
  max_release_year: number | null;    // e.g. 2009, 1995
  year_range_is_hard: boolean;        // true for "from the 2000s", false for "prefer 2000s"
}
```

---

## 4. Parser Improvements

### 4.1 Negative Preferences vs. Positive Desires
- **Hard Genre Exclusions:** Patterns like `no horror`, `avoid romance`, `without comedy`, `don't want horror` extract canonical genres into `negative_genres`.
- **Soft Avoidance Expressions:** Patterns like `not too depressing`, `not too dark`, `nothing too violent`, `avoiding sad endings` extract themes/keywords into `negative_themes` and `negative_keywords`.
- **Grammar-Aware Disambiguation:**
  - `"dark psychological thriller"` $\rightarrow$ `"dark"` is positive (`experience: ['thrilling']`).
  - `"psychological thriller but not too dark"` $\rightarrow$ `"dark"` is negative (`negative_keywords: ['dark']`); `"dark"` is omitted from thrilling experience triggers.
  - `"emotional but not depressing"` $\rightarrow$ `"emotional"` is positive; `"depressing"` is negative (`negative_themes: ['depressing']`).
- **Prompt Sanitization:** Extracted negative phrases are stripped from the positive query embedding string so negative tokens never bleed into the positive semantic vector.

### 4.2 Exact Runtime Parsing
- Evaluates hours and minutes hierarchically:
  - `"under 90 minutes"`, `"less than 90 min"`, `"need something under 90"` $\rightarrow$ `max_runtime_minutes: 90`, `runtime_is_hard_constraint: true`.
  - `"about 90 minutes"`, `"around 90 minutes"`, `"I only have about 90 minutes"` $\rightarrow$ `max_runtime_minutes: 90`, `runtime_is_hard_constraint: false` (soft target).
  - `"at least 150 minutes"` $\rightarrow$ `min_runtime_minutes: 150`, `runtime_is_hard_constraint: true`.
  - `"I have 1.5 hours"` $\rightarrow$ `max_runtime_minutes: 90`.
  - `"I want a recent sci-fi movie under 2 hours"` $\rightarrow$ `max_runtime_minutes: 120`, `runtime_is_hard_constraint: true` (fixed precedence bug where `"under 2"` previously collided with minute parsing).
- Existing coarse runtime preferences (`under_2_hours`, `around_2_hours`, `long_movie_ok`, `binge_series`) are automatically kept synchronized.

### 4.3 Exact Decade and Span Parsing
- **Decades:**
  - `"from the 2000s"`, `"in the 2000s"`, `"00s"` $\rightarrow$ `min_release_year: 2000`, `max_release_year: 2009`.
  - `"in the 1990s"`, `"90s"` $\rightarrow$ `min_release_year: 1990`, `max_release_year: 1999`.
- **Explicit Intervals:**
  - `"from 1990 to 1995"`, `"between 2010 and 2015"` $\rightarrow$ `min_release_year: 1990`, `max_release_year: 1995`.
- **Open Boundaries:**
  - `"after 2015"` $\rightarrow$ `min_release_year: 2016`.
  - `"before 2000"` $\rightarrow$ `max_release_year: 1999`.

---

## 5. Negative Preference & Scoring Behavior

Negative preferences are split into **hard exclusions** and **soft ranking penalties**:

1. **Hard Exclusions (Explicit Rejections):**
   - Triggered by explicit statements (e.g. *"no horror"*, *"don't want horror"*).
   - Enforced in `CandidateRetriever`: candidates containing any genre in `negative_genres` are excluded from the candidate set.
2. **Soft Penalties (Semantic Avoidances):**
   - Triggered by nuance phrases (e.g. *"not too depressing"*, *"not too dark"*).
   - Candidates are **not** eliminated. Instead, a dedicated negative query vector is generated using `buildNegativeQuery` (e.g. `"depressing, bleak, tragic, emotionally devastating, extremely sad"`).
   - In `hybridScorer`, the cosine similarity between each candidate's story embedding and the negative query vector ($S_{\text{neg}}$) is computed:
     $$\text{negative\_penalty} = \min\left(0.25, \max\left(0, (S_{\text{neg}} - 0.30) \times 0.45\right)\right)$$
   - The final score is computed as:
     $$\text{final\_score} = \max\left(0.01, \text{composite\_score} - \text{negative\_penalty}\right)$$
   - In debug mode, `negative_penalty` and `negative_match` are explicitly exposed in `score_breakdown`.

---

## 6. Exact Runtime Scoring Behavior

- **Hard Constraints (`runtime_is_hard_constraint = true`):**
  - Enforced in `CandidateRetriever`: candidates with `runtime > max_runtime_minutes` (or `runtime < min_runtime_minutes`) are filtered out.
  - If fewer than 20 candidates remain, the engine returns the actual remaining count without silently relaxing the filter.
- **Soft Target (`runtime_is_hard_constraint = false`):**
  - Candidates with runtime $\le \text{max\_runtime\_minutes}$ receive full runtime affinity (1.0).
  - Candidates slightly over the soft limit receive a gentle linear penalty:
    $$\text{score} = \max\left(0.1, 1.0 - \frac{\text{candidate.runtime} - \text{target}}{60}\right)$$
  - Candidates far beyond the soft target (e.g. 154 min for a 90 min target) are heavily penalized and drop out of the Top 20.

---

## 7. Exact Year-Range Scoring Behavior

- **Hard Range (`year_range_is_hard = true`):**
  - When the user specifies an exact decade or interval without soft qualifiers (e.g. *"from the 2000s"*, *"between 1990 and 1995"*), candidates outside $[\text{min\_release\_year}, \text{max\_release\_year}]$ are strictly excluded.
- **Soft Range (`year_range_is_hard = false`):**
  - Candidates within the window receive $1.0$ era affinity; candidates outside decay based on decade distance.
- Broad Guided Quiz queries continue using standard eras (`recent`, `modern`, `classic`, `any`).

---

## 8. Reference-Title Matching & Lexical Safety

To eliminate substring collisions:
1. **Multi-Word Token Set Safety:** Multi-word reference candidate titles (e.g. *"Inside Out"*, *"The Dark Knight"*) require full token set containment. A candidate title in the catalog must contain all candidate content tokens.
2. **Length Difference Boundary:** Candidate titles with a token length difference $> 1$ compared to the query reference are rejected.
   - *"Inside Out"* $\rightarrow$ resolves to *"Inside Out"* (id: 438) and *"Inside Out 2"*.
   - Rejects: *"It's What's Inside"* (missing token `"out"`).
   - Rejects: *"Insidious: Out of the Further"* (length difference $> 1$, unrelated root token).
3. **Single-Word Guard:** Single-word references (e.g. *"Avatar"*) require exact normalized string equality (with optional `"The"` stripping). Partial substring matching on single tokens is strictly disallowed.

---

## 9. Family Viewing & Safety Metadata Investigation

### 9.1 Dataset Audit
An inspection of the local CineVerse MySQL database (`content` and `content_dna` tables) and the in-memory `MovieDNA` records was conducted:
- Columns in `content`: `id`, `title`, `type`, `description`, `release_year`, `rating`, `runtime`, `poster_path`, `backdrop_path`, `created_at`, `updated_at`.
- Columns in `content_dna`: `content_id`, `genres`, `languages`, `platforms`, `actors`, `rating_quality`, `vote_count`, `series_info`, `created_at`, `updated_at`.
- **Finding:** **No formal content rating or certification data** (such as MPAA G, PG, PG-13, R, NC-17, or TV parental guidelines) exists in the CineVerse schema or TMDB ingestion pipeline.

### 9.2 Policy & Transparency
1. **No Artificial Safety Claims:** CineVerse does **not** synthesize or guess family-safety ratings from description text.
2. **Family Genre Distinction:** The presence of the `"Family"` genre tag does **not** guarantee universal suitability for young children.
3. **Explanation Guard:** Match explanations have been audited to ensure they never claim a title is *"family-safe"* or *"safe for kids"*. Explanations strictly cite *"Family & Animation genre match"* or narrative tone.
4. **Catalog Limitation:** This absence of official certification metadata is formally documented as a platform data limitation.

---

## 10. Before vs. After Results for the 5 Target Scenarios

### Scenario 1: Case 7 — *"I want something emotional but not too depressing."*
*User Intent:* Wants emotionally resonant, touching stories, but specifically avoids emotionally devastating or bleak downers.

| Metric | Before (Phase 1 Eval) | After (Phase 2 Tuned) |
|---|---|---|
| **Parsed Profile** | `experience: ['emotional']`<br>`themes: ['not too depressing']`<br>`negative_themes: []` | `experience: ['emotional']`<br>`themes: []`<br>`negative_themes: ['depressing']`<br>`negative_keywords: ['depressing']` |
| **Top 1 Pick** | *Tell Me What You Want* (76% match) | *Tell Me What You Want* (62% match, negPenalty: 0.159) |
| **Top 2 Pick** | *The Emoji Movie* (73% match) | *My Wife Has No Emotion* (60% match, negPenalty: 0.127) |
| **Top 3 Pick** | *My Happy Marriage* (73% match) | *Le Clitoris* (57% match, negPenalty: 0.123) |
| **Top 4 Pick** | *Enchanted* (71% match) | *Enchanted* (57% match, negPenalty: 0.152) |
| **Top 5 Pick** | *The One I Love* (73% match) | *The One I Love* (58% match, negPenalty: 0.156) |
| **Explanation** | Cites positive themes including depressive phrases | *"I found emotional titles while avoiding strongly depressing themes."* |

**Improvement Analysis:** Previously, the negative clause `"not too depressing"` was parsed directly into positive semantic query strings, artificially boosting bleak, sad titles. Now, negative themes are isolated, the positive query remains cleanly emotional, and the negative embedding softly penalizes depressing themes by 0.12–0.16 points.

---

### Scenario 2: Case 10 — *"I want a dark psychological thriller from the 2000s."*
*User Intent:* Dark psychological thriller released strictly between 2000 and 2009.

| Metric | Before (Phase 1 Eval) | After (Phase 2 Tuned) |
|---|---|---|
| **Parsed Profile** | `era_preference: 'modern'` (2000–2019)<br>`min_release_year: null`<br>`max_release_year: null` | `min_release_year: 2000`<br>`max_release_year: 2009`<br>`year_range_is_hard: true` |
| **Top 1 Pick** | *Dark Places* (2015, Movie) — 88% ❌ | *American Psycho* (2000, Movie) — 87% ✅ |
| **Top 2 Pick** | *The Cell* (2000, Movie) — 87% ✅ | *Pitch Black* (2000, Movie) — 84% ✅ |
| **Top 3 Pick** | *Bright* (2017, Movie) — 85% ❌ | *30 Days of Night* (2007, Movie) — 85% ✅ |
| **Top 4 Pick** | *xXx* (2002, Movie) — 85% ✅ | *Exam* (2009, Movie) — 84% ✅ |
| **Top 5 Pick** | *How It Ends* (2018, Movie) — 84% ❌ | *Blade II* (2002, Movie) — 84% ✅ |
| **2000s Accuracy** | 40% (2 of 5 in 2000s; 2015, 2017, 2018 leaked) | **100%** (All 5 in 2000–2009; all 20 in 2000–2009) |

**Improvement Analysis:** Formerly, `"from the 2000s"` mapped to the broad `"modern"` era bucket, admitting 2010s titles. Exact decade parsing now binds `[2000, 2009]` as an exact constraint. *American Psycho* and *Exam* (classic psychological thrillers from the decade) now headline the recommendations.

---

### Scenario 3: Case 13 — *"I only have about 90 minutes. Give me a thriller."*
*User Intent:* Thriller movie fitting roughly into a 90-minute time window.

| Metric | Before (Phase 1 Eval) | After (Phase 2 Tuned) |
|---|---|---|
| **Parsed Profile** | `runtime_preference: null`<br>`max_runtime_minutes: null` | `max_runtime_minutes: 90`<br>`runtime_is_hard_constraint: false` |
| **Top 1 Pick** | *13 Minutes* (2021) — 84% | *Circle* (2015, 87 min) — 85% ✅ |
| **Top 2 Pick** | *Time Lapse* (2014) — 83% | *Birder* (2023, 87 min) — 83% ✅ |
| **Top 3 Pick** | *Pulp Fiction* (1994, 154 min!) — 79% ❌ | *The King's Man* (2021, 87 min) — 82% ✅ |
| **Top 4 Pick** | *57 Seconds* (2023) — 83% | *Thrash* (2026, 85 min) — 84% ✅ |
| **Top 5 Pick** | *Michael Jackson's Thriller* (1983, 14 min) — 81% | *The Professor and the Madman* (2019, 87 min) — 82% ✅ |
| **Runtime Adherence** | Severe violations (*Pulp Fiction* 154 min) | **100% of Top 5 within 85–87 minutes** (perfect ~90m fit) |

**Improvement Analysis:** Previously, conversational budget phrases like *"I only have about 90 minutes"* were ignored by the parser. With exact numeric runtime parsing and soft scoring penalty for excessive length, bloated 2.5-hour titles are completely eliminated, replaced by high-affinity thrillers lasting 85–87 minutes.

---

### Scenario 4: Case 23 — *"I want something like Inside Out."*
*User Intent:* Recommendations similar to the Pixar film *Inside Out* without token collisions.

| Metric | Before (Phase 1 Eval) | After (Phase 2 Tuned) |
|---|---|---|
| **Reference Resolution** | Susceptible to `"Inside"` token substring collision | Safely resolved to `"Inside Out"` (ID: 438) |
| **Top 1 Pick** | *Inside Out 2* (2024, Movie) — 80% | *Inside Out 2* (2024, Movie) — 80% |
| **Top 2 Pick** | *Kulong* (2024, Movie) — 73% | *Kulong* (2024, Movie) — 73% |
| **Top 3 Pick** | *The Draft!* (2026, Movie) — 72% | *The Draft!* (2026, Movie) — 72% |
| **Top 4 Pick** | *The House* (2022, Movie) — 75% | *The House* (2022, Movie) — 75% |
| **Top 5 Pick** | *Avatar: The Way of Water* (2022, Movie) — 72% | *Avatar: The Way of Water* (2022, Movie) — 72% |
| **Token Safety** | Risky substring matches allowed | Single-token substring collisions strictly rejected |

**Improvement Analysis:** `isSafeReferenceTitleMatch` prevents unrelated horror/thriller titles like *It's What's Inside* or *Insidious: Out of the Further* from being incorrectly identified as the user's reference title.

---

### Scenario 5: Case 2 (Regression Check) — *"I want something like Interstellar but shorter."*
*User Intent:* Sci-fi / space adventure similar to *Interstellar* (169 min), strictly shorter than 169 minutes.

| Metric | Before (Phase 1 Eval) | After (Phase 2 Tuned) |
|---|---|---|
| **Top 1 Pick** | *Spaceman* (2024, 109 min) — 82% | *Spaceman* (2024, 109 min) — 82% ✅ |
| **Top 2 Pick** | *A Minecraft Movie* (2025, 101 min) — 80% | *A Minecraft Movie* (2025, 101 min) — 80% ✅ |
| **Top 3 Pick** | *The Draft!* (2026, 120 min) — 78% | *The Draft!* (2026, 120 min) — 78% ✅ |
| **Top 4 Pick** | *Kulong* (2024, 48 min) — 81% | *Kulong* (2024, 48 min) — 81% ✅ |
| **Top 5 Pick** | *Memories* (1995, 89 min) — 78% | *Memories* (1995, 89 min) — 78% ✅ |
| **Runtime Compliance** | 100% shorter than 169 min | 100% shorter than 169 min |
| **Sci-Fi Affinity** | Strong reference alignment | Maintained without regression |

**Improvement Analysis:** Zero regressions detected. The reference tuning enhancements made in Phase 1 remain fully intact while operating alongside the new Phase 2 profile constraints.

---

## 11. Test Results

A dedicated test suite `backend/src/test_preference_quality_tuning.ts` was implemented covering all mandatory test requirements (TEST A through TEST L):

```
================================================================
   TESTING RECOMMENDATION QUALITY TUNING PHASE 2                
================================================================
[RecommendationEngine] Engine initialized in 424ms.
✅ PASS: TEST A: "I want something emotional but not too depressing."
         - positive emotional preference exists
         - negative depressing preference exists
         - negative penalty is active in score breakdown
✅ PASS: TEST B: "I want a psychological thriller but not too dark."
         - dark is extracted as negative_keyword, NOT positive experience
✅ PASS: TEST C: "I don't want horror."
         - horror becomes explicit negative_genre hard exclusion
✅ PASS: TEST D: "I only have about 90 minutes. Give me a thriller."
         - max_runtime_minutes = 90 populated
         - top results strictly respect ~90m budget (Circle 87m, Birder 87m)
✅ PASS: TEST E: "I need something under 90 minutes."
         - runtime_is_hard_constraint = true, candidate.runtime <= 90
✅ PASS: TEST F: "I'd prefer something around 90 minutes."
         - runtime_is_hard_constraint = false (soft target)
✅ PASS: TEST G: "I want a thriller from the 2000s."
         - min_release_year = 2000, max_release_year = 2009
✅ PASS: TEST H: "I want something from 1990 to 1995."
         - min_release_year = 1990, max_release_year = 1995
✅ PASS: TEST I: "I want something like Inside Out."
         - Reference title resolves strictly to "Inside Out"
         - "Insidious" and "It's What's Inside" rejected as matches
✅ PASS: TEST J: "I want something like The Dark Knight."
         - Resolves strictly to "The Dark Knight"
         - Common token "Dark" / "Knight" cannot match unrelated titles
✅ PASS: TEST K: "I want something like Interstellar but shorter."
         - Shorter-than-reference constraint and sci-fi ranking verified
✅ PASS: TEST L: "Korean mystery series on Netflix."
         - Hard series/Netflix/Korean constraints verified

================================================================
🎉 All 12/12 Quality Tuning Phase 2 Tests PASSED!
================================================================
```

### Regression Test Suite Status
- `test_preference_profiles.ts`: **17 / 17 passed**
- `test_reference_tuning.ts`: **33 / 33 passed**
- `test_recommendation_engine.ts`: **9 / 9 passed**
- `test_preference_quality_tuning.ts`: **12 / 12 passed**
- **Total passing assertions: 71 / 71 across 4 distinct test suites.**

---

## 12. Latency Comparison

| Scenario | Latency Before | Latency After (Cold / First Call) | Latency After (Warm / Subsequent) |
|---|---|---|---|
| Case 7 (*"emotional but not too depressing"*) | 320 ms | 506 ms *(cold negative vector gen)* | 84 ms |
| Case 10 (*"dark thriller from the 2000s"*) | 290 ms | 157 ms | 62 ms |
| Case 13 (*"only have about 90 minutes"*) | 310 ms | 307 ms | 71 ms |
| Case 23 (*"something like Inside Out"*) | 340 ms | 459 ms | 79 ms |
| Case 2 (*"Interstellar but shorter"*) | 280 ms | 382 ms | 88 ms |
| **System Benchmark Average** | **308 ms** | **362 ms** | **77 ms** |

*Note:* Cold queries that include negative preferences incur a one-time ~150ms cost to generate the negative query embedding via the local `sentence-transformers` microservice. Once cached in memory, subsequent query executions complete in 60–90 ms.

---

## 13. Remaining Limitations & Conservative Assessment

While Phase 2 successfully addressed all four functional weaknesses identified in the real-world evaluation, the following limitations remain:

1. **Content Certification Gap:** The catalog lacks official MPAA or parental rating certifications. CineVerse cannot guarantee kid suitability and must rely on genre tags and user discretion.
2. **Catalog Distribution for Short Runs:** For certain combinations of niche genres and tight runtime constraints (e.g. *"documentary under 45 minutes"*), the candidate pool can drop below 20 titles. CineVerse returns the true matching count rather than violating the constraint.
3. **Compound Negative Nuance:** While phrases like *"not too depressing"* and *"without horror"* work accurately, heavily nested colloquial double negatives (e.g. *"not unexciting"*, *"I wouldn't say no to comedy"*) may challenge regex-based intent extraction.
4. **Conclusion:** CineVerse now represents user intent with significantly higher fidelity, but recommendation quality remains bounded by metadata density and local embedding resolution. It should not be labeled "production-flawless" without user feedback monitoring in real deployment.

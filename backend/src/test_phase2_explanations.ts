// =============================================================================
// CINEVERSE PHASE 2 EVALUATION SUITE — HYBRID SCORER & EVIDENCE-BASED EXPLANATIONS
// =============================================================================
// Validates:
// 1. F4: isSurpriseMe() strict guards (never true when actors/directors/negatives exist)
// 2. F3: ExplanationGenerator evidence truthfulness:
//    - Mentions "Directed by <Name>" for explicit director matches
//    - Mentions "Starring <Name>" for explicit actor matches
//    - Mentions "Excludes <Entity>" for negative exclusions
//    - NEVER claims "Matches your requested X genre" when user never requested genres
// 3. Output structure: additive 'directors' and 'actors' fields populated on results
// =============================================================================

import assert from 'assert';
import { HybridScorer } from './services/recommendation/hybridScorer';
import { ExplanationGenerator } from './services/recommendation/explanationGenerator';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { UserPreferenceProfile } from './models/preferenceProfile';
import { ScoredCandidate } from './services/recommendation/types';
import { pool } from './db/connection';

console.log('================================================================');
console.log('    TESTING PHASE 2: SCORER & EVIDENCE-BASED EXPLANATIONS       ');
console.log('================================================================\n');

async function runPhase2Tests() {
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res.then(() => {
          console.log(`✅ PASS: ${name}`);
          passed++;
        }).catch((err) => {
          console.error(`❌ FAIL: ${name}`);
          console.error(err);
          process.exit(1);
        });
      }
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  // ── TEST 1: isSurpriseMe() strict guards ──────────────────────────────────
  test('F4: isSurpriseMe() returns false when explicit directors/actors exist', () => {
    const baseProfile: UserPreferenceProfile = {
      source: 'custom',
      experience: [],
      type: null,
      genres: [],
      languages: [],
      platforms: [],
      runtime_preference: null,
      runtime_relation: null,
      era_preference: null,
      quality_preference: null,
      themes: [],
      reference_titles: [],
      free_text: '',
      negative_themes: [],
      negative_genres: [],
      negative_keywords: [],
      negative_titles: [],
      negative_persons: [],
      negative_franchises: [],
      unresolved_references: [],
      unresolved_persons: [],
      max_runtime_minutes: null,
      min_runtime_minutes: null,
      runtime_is_hard_constraint: false,
      min_release_year: null,
      max_release_year: null,
      year_range_is_hard: false,
      actors: [],
      directors: [],
    };

    // Director present -> NEVER surprise me
    assert.strictEqual(
      HybridScorer.isSurpriseMe({ ...baseProfile, directors: ['Christopher Nolan'] }),
      false,
      'isSurpriseMe must be false when directors are present'
    );

    // Actor present -> NEVER surprise me
    assert.strictEqual(
      HybridScorer.isSurpriseMe({ ...baseProfile, actors: ['Tom Holland'] }),
      false,
      'isSurpriseMe must be false when actors are present'
    );

    // Negative franchise present -> NEVER surprise me
    assert.strictEqual(
      HybridScorer.isSurpriseMe({ ...baseProfile, negative_franchises: ['Spider-Man'] }),
      false,
      'isSurpriseMe must be false when negative franchises are present'
    );

    // Negative person present -> NEVER surprise me
    assert.strictEqual(
      HybridScorer.isSurpriseMe({ ...baseProfile, negative_persons: ['Tom Cruise'] }),
      false,
      'isSurpriseMe must be false when negative persons are present'
    );

    // Reference title present -> NEVER surprise me
    assert.strictEqual(
      HybridScorer.isSurpriseMe({ ...baseProfile, reference_titles: ['Interstellar'] }),
      false,
      'isSurpriseMe must be false when reference titles are present'
    );

    // Truly minimal profile -> IS surprise me
    assert.strictEqual(
      HybridScorer.isSurpriseMe({ ...baseProfile, free_text: 'Surprise me with something good' }),
      true,
      'isSurpriseMe should be true for pure surprise me prompt'
    );
  });

  // ── TEST 2: Truthful Explanations for Directors ───────────────────────────
  test('F3: generateMatchReasons generates "Directed by <Name>" and NO fake genres', () => {
    const profile: UserPreferenceProfile = {
      source: 'custom',
      experience: [],
      type: 'Movie',
      genres: [], // User NEVER requested genres!
      languages: [],
      platforms: [],
      runtime_preference: null,
      runtime_relation: null,
      era_preference: null,
      quality_preference: null,
      themes: [],
      reference_titles: [],
      free_text: 'movies directed by Christopher Nolan',
      negative_themes: [],
      negative_genres: [],
      negative_keywords: [],
      negative_titles: [],
      negative_persons: [],
      negative_franchises: [],
      unresolved_references: [],
      unresolved_persons: [],
      max_runtime_minutes: null,
      min_runtime_minutes: null,
      runtime_is_hard_constraint: false,
      min_release_year: null,
      max_release_year: null,
      year_range_is_hard: false,
      actors: [],
      directors: ['Christopher Nolan'],
    };

    const mockCandidate: ScoredCandidate = {
      content_id: 315,
      dna: {
        content_id: 315,
        title: 'The Dark Knight',
        type: 'Movie',
        genres: ['Action', 'Crime', 'Drama'],
        rating: 8.5,
        release_year: 2008,
        runtime: 152,
        directors: ['Christopher Nolan'],
        actors: ['Christian Bale', 'Heath Ledger'],
        languages: ['English'],
        platforms: ['Netflix'],
      } as any,
      semantic_score: 0.5,
      experience_score: 0.5,
      genre_score: 0.5,
      reference_score: 0.5,
      runtime_score: 1.0,
      era_score: 1.0,
      quality_score: 0.95,
      language_score: 0.5,
      platform_score: 0.5,
      actor_bonus: 0,
      director_bonus: 0.02,
      raw_score: 0.52,
      hybrid_score: 0.52,
      score_breakdown: {
        semantic: 0.5,
        experience: 0.5,
        genre: 0.5,
        reference: 0.5,
        runtime: 1,
        era: 1,
        quality: 0.95,
        language: 0.5,
        platform: 0.5,
      },
      active_weights: {
        semantic: 1,
        experience: 0,
        genre: 0,
        reference: 0,
        runtime: 0,
        era: 0,
        quality: 0,
        language: 0,
        platform: 0,
      },
      match_reasons: [],
    };

    const reasons = ExplanationGenerator.generateMatchReasons(mockCandidate, profile, false);

    assert.ok(
      reasons.includes('Directed by Christopher Nolan'),
      `Must include 'Directed by Christopher Nolan' (got: ${JSON.stringify(reasons)})`
    );

    // Critical F3 check: Must NOT claim "Matches your requested Action genre" or similar!
    for (const r of reasons) {
      assert.ok(
        !r.includes('Matches your requested'),
        `Forbidden to claim unrequested genres (got: ${r})`
      );
    }
  });

  // ── TEST 3: Truthful Explanations for Actors & Negative Franchises ────────
  test('F3: generateMatchReasons generates "Starring <Name>" and "Excludes <Franchise>"', () => {
    const profile: UserPreferenceProfile = {
      source: 'custom',
      experience: [],
      type: 'Movie',
      genres: [], // No genres requested
      languages: [],
      platforms: [],
      runtime_preference: null,
      runtime_relation: null,
      era_preference: null,
      quality_preference: null,
      themes: [],
      reference_titles: [],
      free_text: 'I want movies starring Tom Holland but not his Spider-Man movies',
      negative_themes: [],
      negative_genres: [],
      negative_keywords: [],
      negative_titles: ['Spider-Man'],
      negative_persons: [],
      negative_franchises: ['Spider-Man'],
      unresolved_references: [],
      unresolved_persons: [],
      max_runtime_minutes: null,
      min_runtime_minutes: null,
      runtime_is_hard_constraint: false,
      min_release_year: null,
      max_release_year: null,
      year_range_is_hard: false,
      actors: ['Tom Holland'],
      directors: [],
    };

    const mockCandidate: ScoredCandidate = {
      content_id: 299536,
      dna: {
        content_id: 299536,
        title: 'Avengers: Infinity War',
        type: 'Movie',
        genres: ['Action', 'Adventure', 'Sci-Fi & Fantasy'],
        rating: 8.2,
        release_year: 2018,
        runtime: 149,
        directors: ['Anthony Russo', 'Joe Russo'],
        actors: ['Robert Downey Jr.', 'Chris Hemsworth', 'Tom Holland'],
        languages: ['English'],
        platforms: ['Disney+'],
      } as any,
      semantic_score: 0.5,
      experience_score: 0.5,
      genre_score: 0.5,
      reference_score: 0.5,
      runtime_score: 1.0,
      era_score: 1.0,
      quality_score: 0.9,
      language_score: 0.5,
      platform_score: 0.5,
      actor_bonus: 0.02,
      raw_score: 0.52,
      hybrid_score: 0.52,
      score_breakdown: {
        semantic: 0.5,
        experience: 0.5,
        genre: 0.5,
        reference: 0.5,
        runtime: 1,
        era: 1,
        quality: 0.9,
        language: 0.5,
        platform: 0.5,
      },
      active_weights: {
        semantic: 1,
        experience: 0,
        genre: 0,
        reference: 0,
        runtime: 0,
        era: 0,
        quality: 0,
        language: 0,
        platform: 0,
      },
      match_reasons: [],
    };

    const reasons = ExplanationGenerator.generateMatchReasons(mockCandidate, profile, false);

    assert.ok(
      reasons.includes('Starring Tom Holland'),
      `Must include 'Starring Tom Holland' (got: ${JSON.stringify(reasons)})`
    );
    assert.ok(
      reasons.includes('Excludes Spider-Man movies'),
      `Must include 'Excludes Spider-Man movies' (got: ${JSON.stringify(reasons)})`
    );
    // Must NOT claim Action genre match
    for (const r of reasons) {
      assert.ok(
        !r.includes('Matches your requested Action'),
        `Forbidden to claim unrequested Action genre (got: ${r})`
      );
    }
  });

  // ── TEST 4: End-to-End Engine recommendation test with additive fields ────
  await test('E2E: Engine output includes additive directors and actors', async () => {
    const engine = RecommendationEngine.getInstance();
    await engine.init();

    const profile = await PreferenceProfileBuilder.buildFromCustom('movies directed by Christopher Nolan');
    const res = await engine.recommend(profile, true);

    assert.strictEqual(res.success, true);
    assert.ok(res.recommendations.length > 0);

    const topPick = res.recommendations[0];
    assert.ok(Array.isArray(topPick.directors), 'directors field must be an array');
    assert.ok(topPick.directors.includes('Christopher Nolan'), 'top pick must be directed by Christopher Nolan');
    assert.ok(Array.isArray(topPick.actors), 'actors field must be an array');
    assert.ok(topPick.actors.length > 0, 'actors array must not be empty');

    // Reasons must include director
    assert.ok(
      topPick.match_reasons.some((r) => r.includes('Directed by Christopher Nolan')),
      `match_reasons must reflect director evidence: ${JSON.stringify(topPick.match_reasons)}`
    );
  });

  console.log(`\n🎉 All ${passed}/${total} Phase 2 tests passed successfully!\n`);
  await pool.end();
}

runPhase2Tests().catch((err) => {
  console.error('Fatal Phase 2 test runner error:', err);
  process.exit(1);
});

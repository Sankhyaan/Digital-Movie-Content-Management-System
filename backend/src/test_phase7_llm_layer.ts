// =============================================================================
// CINEVERSE PHASE 7: GEMINI LLM INTERPRETATION LAYER VERIFICATION SUITE
// =============================================================================
// Validates:
// 1. Strict schema validation (rejects invalid roots, unknown properties, bad enums, bad bounds).
// 2. Catalog entity grounding and sanitization (hallucinated entities dropped or quarantined).
// 3. Genre provenance tracking ('user' vs 'llm') and soft-filtering behavior.
// 4. Non-weakening invariants (LLM never drops or weakens deterministic user constraints).
// 5. Clarification preservation (ambiguous/unresolved entities never guessed by LLM).
// 6. Resilient circuit breaker & timeout (fails safely to deterministic profile without throwing).
// 7. Guided Quiz bit-for-bit baseline regression check.
// =============================================================================

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  validateGeminiDeltaSchema,
  sanitizeAndValidateGeminiDelta,
  mergeProfileWithLlmDelta,
  isLlmAvailable,
  parsePromptWithGemini,
} from './services/llmPromptParser';
import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { parseCustomPrompt, initPersonCatalogFromDatabase } from './services/customPromptParser';
import { CandidateRetriever } from './services/recommendation/candidateRetriever';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { UserPreferenceProfile } from './models/preferenceProfile';
import { pool } from './db/connection';

console.log('================================================================');
console.log('   CINEVERSE PHASE 7: GEMINI LLM LAYER VERIFICATION SUITE       ');
console.log('================================================================\n');

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
  } catch (err: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

function createBaseProfile(): UserPreferenceProfile {
  return {
    source: 'custom',
    experience: [],
    type: null,
    genres: [],
    genre_sources: {},
    languages: [],
    platforms: [],
    runtime_preference: null,
    runtime_relation: null,
    era_preference: null,
    quality_preference: null,
    themes: [],
    reference_titles: [],
    free_text: 'test prompt',
    negative_themes: [],
    negative_genres: [],
    negative_keywords: [],
    max_runtime_minutes: null,
    min_runtime_minutes: null,
    runtime_is_hard_constraint: false,
    min_release_year: null,
    max_release_year: null,
    year_range_is_hard: false,
    actors: [],
    directors: [],
    actor_match_mode: 'all',
    negative_titles: [],
    negative_persons: [],
    negative_franchises: [],
    unresolved_references: [],
    unresolved_persons: [],
  };
}

async function runPhase7Tests() {
  await initPersonCatalogFromDatabase();
  const retriever = CandidateRetriever.getInstance();
  await retriever.init();
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  // Test 7.1: Strict Schema Validation
  await test('TEST 7.1: Strict schema validation rejecting invalid roots, properties, and bounds', async () => {
    // 1. Invalid roots
    for (const invalidRoot of [null, undefined, 'raw string', 42, true, [1, 2]]) {
      const res = validateGeminiDeltaSchema(invalidRoot);
      assert.strictEqual(res.isValid, false, `Root ${typeof invalidRoot} must be rejected`);
      assert.ok(res.errors.length > 0);
    }

    // 2. Disallowed / injected properties
    const injected = {
      type: 'Movie',
      sql_injection: 'DROP TABLE content',
      __proto__: { admin: true },
    };
    const resInjected = validateGeminiDeltaSchema(injected);
    assert.strictEqual(resInjected.isValid, false, 'Injected property must be rejected');
    assert.ok(resInjected.errors.some((e) => e.includes('Unexpected property')));

    // 3. Invalid enums
    assert.strictEqual(validateGeminiDeltaSchema({ type: 'Film' }).isValid, false);
    assert.strictEqual(validateGeminiDeltaSchema({ runtime_preference: 'super_long' }).isValid, false);
    assert.strictEqual(validateGeminiDeltaSchema({ runtime_relation: 'longer' }).isValid, false);

    // 4. Invalid bounds
    assert.strictEqual(validateGeminiDeltaSchema({ min_release_year: 1850 }).isValid, false);
    assert.strictEqual(validateGeminiDeltaSchema({ max_release_year: 2099 }).isValid, false);
    assert.strictEqual(validateGeminiDeltaSchema({ min_runtime_minutes: 0 }).isValid, false);
    assert.strictEqual(validateGeminiDeltaSchema({ max_runtime_minutes: 9999 }).isValid, false);

    // 5. Valid schema acceptance
    const validDelta = {
      type: 'Movie' as const,
      genres: ['Action', 'Thriller'],
      negative_genres: ['Horror'],
      languages: ['Korean'],
      platforms: ['Netflix'],
      actors: ['Christian Bale'],
      directors: ['Christopher Nolan'],
      reference_titles: ['Inception'],
      themes: ['mind-bending', 'heist'],
      negative_themes: ['depressing'],
      negative_keywords: ['depressing', 'gory'],
      negative_franchises: ['Marvel'],
      min_release_year: 2000,
      max_release_year: 2024,
      min_runtime_minutes: 90,
      max_runtime_minutes: 180,
      runtime_preference: 'around_2_hours',
      runtime_relation: 'shorter_than_reference' as const,
      is_meaningful: true,
    };
    const resValid = validateGeminiDeltaSchema(validDelta);
    assert.strictEqual(resValid.isValid, true);
    assert.strictEqual(resValid.errors.length, 0);
  });

  // Test 7.2: Catalog Entity Grounding & Sanitization
  await test('TEST 7.2: Catalog entity grounding and hallucination quarantine', async () => {
    const rawDelta = {
      type: 'Movie' as const,
      genres: ['NonexistentGenre', 'Sci-Fi & Fantasy'],
      negative_genres: ['MadeUpNegGenre', 'Horror'],
      languages: ['Klingon', 'Korean'],
      platforms: ['FakeStream', 'Netflix'],
      actors: ['Nonexistent Actor 999', 'Leonardo DiCaprio'],
      directors: ['Fake Director 888', 'Christopher Nolan'],
      reference_titles: ['MovieThatDoesNotExist9999', 'Inception'],
    };

    const sanitized = sanitizeAndValidateGeminiDelta(rawDelta);
    assert.deepStrictEqual(sanitized.genres, ['Sci-Fi & Fantasy']);
    assert.deepStrictEqual(sanitized.negative_genres, ['Horror']);
    assert.deepStrictEqual(sanitized.languages, ['Korean']);
    assert.deepStrictEqual(sanitized.platforms, ['Netflix']);
    assert.deepStrictEqual(sanitized.actors, ['Leonardo DiCaprio']);
    assert.deepStrictEqual(sanitized.directors, ['Christopher Nolan']);
    assert.deepStrictEqual(sanitized.reference_titles, ['Inception']);
    assert.deepStrictEqual(sanitized.unresolved_references, ['MovieThatDoesNotExist9999']);
  });

  // Test 7.3: Genre Provenance and Soft vs Hard Filtering
  await test('TEST 7.3: LLM genre provenance tracking and soft-filter candidate retrieval', async () => {
    const baseProfile = createBaseProfile();
    baseProfile.type = 'Series';
    baseProfile.genres = ['Mystery'];
    baseProfile.genre_sources = { Mystery: 'user' };
    baseProfile.languages = ['Korean'];
    baseProfile.platforms = ['Netflix'];

    const llmDelta = {
      genres: ['Mystery', 'Action'],
    };

    const merged = mergeProfileWithLlmDelta(baseProfile, llmDelta);
    assert.strictEqual(merged.genre_sources?.['Mystery'], 'user', 'Mystery must remain user source');
    assert.strictEqual(merged.genre_sources?.['Action'], 'llm', 'Action must be marked llm source');

    const candidates = await retriever.retrieveCandidates(merged);
    // Candidates without Action must still be retrieved because Action is a soft LLM preference
    const withoutAction = candidates.filter((c) => !c.genres.includes('Action'));
    assert.ok(withoutAction.length > 0, 'Titles without Action must be retained as soft preference');
    // But all candidates MUST have the hard user genre Mystery
    for (const c of candidates) {
      assert.ok(c.genres.includes('Mystery'), `Candidate ${c.title} must have user genre Mystery`);
    }
  });

  // Test 7.4: Non-Weakening Invariants (Deterministic Constraints Never Dropped)
  await test('TEST 7.4: LLM delta never drops or weakens deterministic user constraints', async () => {
    const baseProfile = createBaseProfile();
    baseProfile.genres = ['Action'];
    baseProfile.genre_sources = { Action: 'user' };
    baseProfile.directors = ['Christopher Nolan'];
    baseProfile.actors = ['Christian Bale'];
    baseProfile.min_runtime_minutes = 100;
    baseProfile.max_runtime_minutes = 150;
    baseProfile.negative_genres = ['Horror'];

    // Hostile LLM delta attempting to drop Action, replace director, and weaken runtime
    const hostileDelta = {
      genres: ['Romance'],
      negative_genres: ['Action'], // Should NOT drop explicit user genre Action
      directors: ['Quentin Tarantino'],
      min_runtime_minutes: 60,
    };

    const merged = mergeProfileWithLlmDelta(baseProfile, hostileDelta);
    assert.ok(merged.genres.includes('Action'), 'Explicit user genre Action must NOT be dropped');
    assert.ok(merged.directors.includes('Christopher Nolan'), 'Deterministic director Nolan must NOT be dropped');
    assert.ok(merged.actors.includes('Christian Bale'), 'Deterministic actor Bale must NOT be dropped');
    assert.strictEqual(merged.min_runtime_minutes, 100, 'Deterministic min runtime 100 must NOT be weakened');
    assert.strictEqual(merged.max_runtime_minutes, 150, 'Deterministic max runtime 150 must NOT be weakened');
    assert.ok(!merged.negative_genres.includes('Action'), 'Hostile negative Action must not be added');
  });

  // Test 7.5: Clarification Preservation
  await test('TEST 7.5: Ambiguous/unresolved entities preserve clarification without LLM guessing', async () => {
    // Ambiguous surname prompt
    const ambiguousProfile = await PreferenceProfileBuilder.buildFromCustom('movies directed by Miller');
    assert.strictEqual(ambiguousProfile.clarification_needed, true, 'Clarification must be needed');
    assert.ok(ambiguousProfile.clarification_message?.includes('Miller'), 'Clarification message must mention Miller');
    assert.ok(ambiguousProfile.ambiguous_entities && ambiguousProfile.ambiguous_entities.length > 0);

    // Unresolved unknown person prompt
    const unknownProfile = await PreferenceProfileBuilder.buildFromCustom('movies starring NonexistentPersonXYZ12345');
    assert.strictEqual(unknownProfile.clarification_needed, true, 'Clarification must be needed for unknown person');
  });

  // Test 7.6: Resilient Circuit Breaker & Timeout Fallback
  await test('TEST 7.6: Timeout circuit breaker falls back transparently without throwing', async () => {
    // Fast path: high confidence single entity prompt completes deterministically
    const fastProfile = await PreferenceProfileBuilder.buildFromCustom('movies directed by Christopher Nolan');
    assert.ok(fastProfile.directors.includes('Christopher Nolan'));
    assert.ok(!fastProfile.low_confidence, 'High confidence request should not have low_confidence set');

    // Direct timeout call with 1ms timeout simulates timeout abort
    const timeoutResult = await parsePromptWithGemini('a very long poetic prompt about space and stars', 1);
    // Timeout should return null gracefully without throwing an exception
    assert.strictEqual(timeoutResult, null, 'Timed out request must return null safely');
  });

  // Test 7.7: Guided Quiz bit-for-bit baseline regression check
  await test('TEST 7.7: Guided Quiz baseline 100% bit-for-bit regression check', async () => {
    const baselinePath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_baseline_20_results.json');
    const answersPath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_20_answers.json');

    const expectedBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const answersList = JSON.parse(fs.readFileSync(answersPath, 'utf8'));

    for (let i = 0; i < answersList.length; i++) {
      const ans = answersList[i];
      const expectedQuiz = expectedBaseline.results[i];
      const prof = PreferenceProfileBuilder.buildFromGuided(ans);
      const res = await engine.recommend(prof);

      assert.strictEqual(res.recommendations.length, expectedQuiz.top20.length, `Quiz #${i + 1} count mismatch`);
      for (let j = 0; j < expectedQuiz.top20.length; j++) {
        const actualRec = res.recommendations[j];
        const expRec = expectedQuiz.top20[j];
        assert.strictEqual(
          actualRec.content_id,
          expRec.content_id,
          `Quiz #${i + 1} rank ${j + 1} content_id mismatch`
        );
        assert.strictEqual(
          actualRec.title,
          expRec.title,
          `Quiz #${i + 1} rank ${j + 1} title mismatch`
        );
        assert.strictEqual(
          actualRec.recommendation_score,
          expRec.hybrid_score,
          `Quiz #${i + 1} rank ${j + 1} score mismatch`
        );
      }
    }
  });

  console.log('\n================================================================');
  console.log('   ALL PHASE 7 GEMINI LLM LAYER VERIFICATIONS PASSED            ');
  console.log('================================================================');
  await pool.end();
  process.exit(0);
}

runPhase7Tests().catch(async (err) => {
  console.error('Fatal test error:', err);
  await pool.end();
  process.exit(1);
});

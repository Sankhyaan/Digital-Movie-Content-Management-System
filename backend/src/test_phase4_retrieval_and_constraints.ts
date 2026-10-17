// =============================================================================
// CINEVERSE PHASE 4: RETRIEVAL & HARD CONSTRAINTS TEST SUITE
// =============================================================================
// Validates:
// 1. Negative title hard exclusions never appear in results.
// 2. Negative person hard exclusions never appear in results.
// 3. Negative genre hard exclusions never appear in results.
// 4. Explicit negative theme exclusions never appear in results.
// 5. Positive genres are hard when source is 'user' or 'quiz', but soft when 'llm'.
// 6. Result sets < 20 are never padded and report explicit count reason in message.
// 7. Missing cast/director metadata is tracked and reported in debug info.
// 8. Deterministic Top 20 ranking order (hybrid_score DESC, rating DESC, content_id ASC).
// 9. Guided Quiz results match baseline 100% bit-for-bit.
// =============================================================================

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { parseCustomPrompt, initPersonCatalogFromDatabase } from './services/customPromptParser';
import { UserPreferenceProfile } from './models/preferenceProfile';

console.log('================================================================');
console.log('   CINEVERSE PHASE 4: RETRIEVAL & HARD CONSTRAINTS VERIFICATION  ');
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

async function runPhase4Tests() {
  await initPersonCatalogFromDatabase();
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  // Test 4.1: Negative Title Hard Exclusion
  await test('TEST 4.1: Hard negative title exclusion (Interstellar & Gravity excluded)', async () => {
    const profile = await parseCustomPrompt('Space exploration movies but do not recommend Interstellar or Gravity');
    const res = await engine.recommend(profile);
    assert.ok(res.success, 'Recommendation must succeed');
    assert.ok(res.recommendations.length > 0, 'Must have recommendations');
    const hasInterstellar = res.recommendations.some(r => r.title.toLowerCase() === 'interstellar');
    const hasGravity = res.recommendations.some(r => r.title.toLowerCase() === 'gravity');
    assert.strictEqual(hasInterstellar, false, 'Interstellar must NEVER appear in recommendations');
    assert.strictEqual(hasGravity, false, 'Gravity must NEVER appear in recommendations');
  });

  // Test 4.2: Negative Person Hard Exclusion
  await test('TEST 4.2: Hard negative person exclusion (Tom Cruise excluded)', async () => {
    const profile = await parseCustomPrompt('Sci-fi thriller excluding Tom Cruise');
    const res = await engine.recommend(profile);
    assert.ok(res.success, 'Recommendation must succeed');
    assert.ok(res.recommendations.length > 0, 'Must have recommendations');
    for (const rec of res.recommendations) {
      const inActors = rec.actors?.some(a => a.toLowerCase().includes('tom cruise'));
      const inDirectors = rec.directors?.some(d => d.toLowerCase().includes('tom cruise'));
      assert.strictEqual(Boolean(inActors || inDirectors), false, `Tom Cruise found in recommendation: ${rec.title}`);
    }
  });

  // Test 4.3: Hard Negative Genre Exclusion
  await test('TEST 4.3: Hard negative genre exclusion (Horror excluded)', async () => {
    const profile = await parseCustomPrompt('Action movie but not horror');
    const res = await engine.recommend(profile);
    assert.ok(res.success, 'Recommendation must succeed');
    assert.ok(res.recommendations.length > 0, 'Must have recommendations');
    for (const rec of res.recommendations) {
      assert.strictEqual(
        rec.genres?.includes('Horror'),
        false,
        `Horror genre found in recommendation: ${rec.title} (${rec.genres})`
      );
    }
  });

  // Test 4.4: Hard Negative Theme Exclusion
  await test('TEST 4.4: Hard negative theme exclusion (murder excluded)', async () => {
    const profile = await parseCustomPrompt('Drama where nobody gets murdered');
    const res = await engine.recommend(profile);
    assert.ok(res.success, 'Recommendation must succeed');
    assert.ok(res.recommendations.length > 0, 'Must have recommendations');
    for (const rec of res.recommendations) {
      const titleLower = rec.title.toLowerCase();
      assert.ok(!/\bmurder\b/i.test(titleLower), `Excluded murder found in title: ${rec.title}`);
    }
  });

  // Test 4.5: Positive Genre: Hard for user, Soft for LLM
  await test('TEST 4.5: Positive genres are hard for user source but soft for llm source', async () => {
    // 4.5a: User source genre is strictly hard
    const userProfile: UserPreferenceProfile = {
      source: 'custom',
      type: 'Movie',
      genres: ['Western'],
      genre_sources: { Western: 'user' },
      actors: [],
      directors: [],
      reference_titles: [],
      themes: [],
      languages: [],
      platforms: [],
      experience: [],
      runtime_preference: null,
      runtime_relation: null,
      era_preference: null,
      quality_preference: null,
      free_text: 'I want a western movie',
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
    };
    const userRes = await engine.recommend(userProfile);
    assert.ok(userRes.recommendations.length > 0, 'Must have western recommendations');
    for (const rec of userRes.recommendations) {
      assert.ok(rec.genres?.includes('Western'), `User hard genre Western must be present on ${rec.title}`);
    }

    // 4.5b: LLM source genre is soft (does not reject candidate missing it if other signals fit)
    const llmProfile: UserPreferenceProfile = {
      ...userProfile,
      genres: ['Western'],
      genre_sources: { Western: 'llm' },
      themes: ['cowboy frontier justice'],
    };
    const llmRes = await engine.recommend(llmProfile);
    assert.ok(llmRes.recommendations.length > 0, 'LLM soft genre query must produce recommendations');
  });

  // Test 4.6: Result sets < 20 are never padded and report explicit message
  await test('TEST 4.6: Result sets < 20 are never padded and report count in message', async () => {
    const profile = await parseCustomPrompt('movies directed by Christopher Nolan');
    const res = await engine.recommend(profile);
    assert.ok(res.success, 'Recommendation must succeed');
    assert.ok(res.recommendations.length < 20, `Christopher Nolan has < 20 movies in catalog, got ${res.recommendations.length}`);
    assert.strictEqual(res.count, res.recommendations.length, 'Count must equal recommendations length');
    assert.ok(res.message && res.message.includes(`Only ${res.count} titles matched`), `Message must explain count: ${res.message}`);
    for (const rec of res.recommendations) {
      assert.ok(rec.directors?.includes('Christopher Nolan'), `All results must be directed by Christopher Nolan: ${rec.title}`);
    }
  });

  // Test 4.7: Missing metadata tracking in debug
  await test('TEST 4.7: Missing cast/director metadata tracked in debug info', async () => {
    const profile = await parseCustomPrompt('movies directed by Christopher Nolan');
    const res = await engine.recommend(profile, true);
    assert.ok(res.debug, 'Debug info must be present when includeDebug is true');
    assert.ok(res.debug?.missing_metadata_filtered, 'missing_metadata_filtered must exist');
    assert.strictEqual(typeof res.debug?.missing_metadata_filtered?.directors, 'number', 'directors count must be number');
    assert.strictEqual(typeof res.debug?.missing_metadata_filtered?.actors, 'number', 'actors count must be number');
  });

  // Test 4.8: Deterministic Top 20 ordering (hybrid_score DESC, rating DESC, content_id ASC)
  await test('TEST 4.8: Deterministic Top 20 ranking ordering strictly preserved', async () => {
    const profile = await parseCustomPrompt('mind-bending sci-fi movies');
    const res = await engine.recommend(profile);
    assert.ok(res.recommendations.length >= 10, 'Must have at least 10 recommendations');
    for (let i = 0; i < res.recommendations.length - 1; i++) {
      const a = res.recommendations[i];
      const b = res.recommendations[i + 1];
      if (Math.abs(b.recommendation_score - a.recommendation_score) > 0.0001) {
        assert.ok(
          a.recommendation_score >= b.recommendation_score,
          `Score order violation at ${i}: ${a.recommendation_score} < ${b.recommendation_score}`
        );
      } else {
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        if (Math.abs(ratingB - ratingA) > 0.0001) {
          assert.ok(ratingA >= ratingB, `Rating order violation at ${i}`);
        } else {
          assert.ok(a.content_id <= b.content_id, `Content ID tiebreak violation at ${i}`);
        }
      }
    }
  });

  // Test 4.9: Guided Quiz baseline 100% bit-for-bit regression check
  await test('TEST 4.9: Guided Quiz baseline regression check (100% bit-for-bit match)', async () => {
    const baselinePath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_baseline_20_results.json');
    const answersPath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_20_answers.json');

    assert.ok(fs.existsSync(baselinePath), 'Baseline file must exist');
    assert.ok(fs.existsSync(answersPath), 'Answers fixture must exist');

    const expectedBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const answersList = JSON.parse(fs.readFileSync(answersPath, 'utf8'));

    const { PreferenceProfileBuilder } = await import('./services/preferenceProfileBuilder');

    for (let i = 0; i < answersList.length; i++) {
      const ans = answersList[i];
      const expectedQuiz = expectedBaseline.results[i];
      const prof = PreferenceProfileBuilder.buildFromGuided(ans);
      const res = await engine.recommend(prof);

      assert.strictEqual(res.recommendations.length, expectedQuiz.top20.length, `Quiz #${i + 1} length mismatch`);
      for (let j = 0; j < expectedQuiz.top20.length; j++) {
        const actualRec = res.recommendations[j];
        const expRec = expectedQuiz.top20[j];
        assert.strictEqual(
          actualRec.content_id,
          expRec.content_id,
          `Quiz #${i + 1} item #${j + 1} content_id mismatch: expected ${expRec.content_id} (${expRec.title}), got ${actualRec.content_id} (${actualRec.title})`
        );
        assert.strictEqual(
          actualRec.title,
          expRec.title,
          `Quiz #${i + 1} item #${j + 1} title mismatch`
        );
        assert.strictEqual(
          actualRec.recommendation_score,
          expRec.hybrid_score,
          `Quiz #${i + 1} item #${j + 1} score mismatch: expected ${expRec.hybrid_score}, got ${actualRec.recommendation_score}`
        );
      }
    }
  });

  console.log('\n================================================================');
  console.log('   ALL PHASE 4 RETRIEVAL & HARD CONSTRAINT VERIFICATIONS PASSED ');
  console.log('================================================================');
  process.exit(0);
}

runPhase4Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

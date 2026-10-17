// =============================================================================
// CINEVERSE PHASE 5: SURPRISE ME SEMANTICS VERIFICATION SUITE
// =============================================================================
// Validates:
// 1. isSurpriseMe returns true ONLY when no explicit constraint or preference exists.
// 2. isSurpriseMe returns false if ANY constraint (genre, director, actor, runtime, era, etc.) exists.
// 3. isSurpriseMe returns false if unresolved references or unresolved persons exist.
// 4. isSurpriseMe returns false if ambiguous entities or clarification_needed exist.
// 5. isSurpriseMe returns false if negative exclusions exist.
// 6. Quality gate (rating >= 7.5) surfaces curated discovery pool.
// 7. Deterministic Top 20 ordering is strictly maintained in surprise mode.
// =============================================================================

import assert from 'assert';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { HybridScorer } from './services/recommendation/hybridScorer';
import { parseCustomPrompt, initPersonCatalogFromDatabase } from './services/customPromptParser';
import { UserPreferenceProfile } from './models/preferenceProfile';

console.log('================================================================');
console.log('   CINEVERSE PHASE 5: SURPRISE ME VERIFICATION SUITE            ');
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

async function runPhase5Tests() {
  await initPersonCatalogFromDatabase();
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  // Test 5.1: Pure Surprise Me prompt
  await test('TEST 5.1: Pure surprise me prompt triggers isSurpriseMe === true', async () => {
    const profile = await parseCustomPrompt('surprise me');
    assert.strictEqual(HybridScorer.isSurpriseMe(profile), true, 'isSurpriseMe must be true');
    const res = await engine.recommend(profile);
    assert.ok(res.success, 'Recommendation must succeed');
    assert.strictEqual(res.recommendations.length, 20, 'Must return 20 recommendations');
    // Verify quality gate: rating >= 7.5
    for (const rec of res.recommendations) {
      assert.ok(
        (rec.rating || 0) >= 7.5,
        `Surprise Me title must pass 7.5 quality threshold: ${rec.title} (${rec.rating})`
      );
    }
  });

  // Test 5.2: Any positive constraint disables Surprise Me
  await test('TEST 5.2: Explicit positive preferences return isSurpriseMe === false', async () => {
    const genreProf = await parseCustomPrompt('surprise me with a comedy');
    assert.strictEqual(HybridScorer.isSurpriseMe(genreProf), false, 'Genre must disable surprise me');

    const dirProf = await parseCustomPrompt('surprise me with Christopher Nolan');
    assert.strictEqual(HybridScorer.isSurpriseMe(dirProf), false, 'Director must disable surprise me');

    const runtimeProf = await parseCustomPrompt('surprise me under 90 minutes');
    assert.strictEqual(HybridScorer.isSurpriseMe(runtimeProf), false, 'Runtime limit must disable surprise me');

    const formatProf = await parseCustomPrompt('surprise me with a series');
    assert.strictEqual(HybridScorer.isSurpriseMe(formatProf), false, 'Format type must disable surprise me');
  });

  // Test 5.3: Unresolved entities disable Surprise Me
  await test('TEST 5.3: Unresolved entities return isSurpriseMe === false', async () => {
    const unknownActorProf = await parseCustomPrompt('surprise me starring Completely Unknown 99999');
    assert.strictEqual(HybridScorer.isSurpriseMe(unknownActorProf), false, 'Unresolved person must disable surprise me');

    const unknownRefProf = await parseCustomPrompt('surprise me like Nonexistent Movie 99999');
    assert.strictEqual(HybridScorer.isSurpriseMe(unknownRefProf), false, 'Unresolved title reference must disable surprise me');
  });

  // Test 5.4: Ambiguous entities disable Surprise Me
  await test('TEST 5.4: Ambiguous entities return isSurpriseMe === false', async () => {
    const ambTitleProf = await parseCustomPrompt('surprise me like One Piece');
    assert.strictEqual(HybridScorer.isSurpriseMe(ambTitleProf), false, 'Ambiguous title must disable surprise me');

    const ambPersonProf = await parseCustomPrompt('surprise me directed by Miller');
    assert.strictEqual(HybridScorer.isSurpriseMe(ambPersonProf), false, 'Ambiguous director must disable surprise me');
  });

  // Test 5.5: Negative exclusions disable Surprise Me
  await test('TEST 5.5: Negative exclusions return isSurpriseMe === false', async () => {
    const negGenreProf = await parseCustomPrompt('surprise me, no horror');
    assert.strictEqual(HybridScorer.isSurpriseMe(negGenreProf), false, 'Negative genre must disable surprise me');

    const negPersonProf = await parseCustomPrompt('surprise me without Tom Cruise');
    assert.strictEqual(HybridScorer.isSurpriseMe(negPersonProf), false, 'Negative person must disable surprise me');

    const negFranchiseProf = await parseCustomPrompt('surprise me, no Marvel movies');
    assert.strictEqual(HybridScorer.isSurpriseMe(negFranchiseProf), false, 'Negative franchise must disable surprise me');
  });

  // Test 5.6: Deterministic ordering in Surprise Me mode
  await test('TEST 5.6: Deterministic Top 20 ranking preserved in Surprise Me mode', async () => {
    const profile = await parseCustomPrompt('pick for me');
    const res = await engine.recommend(profile);
    assert.strictEqual(res.recommendations.length, 20, 'Must return 20 results');

    for (let i = 0; i < res.recommendations.length - 1; i++) {
      const a = res.recommendations[i];
      const b = res.recommendations[i + 1];
      if (Math.abs(b.recommendation_score - a.recommendation_score) > 0.0001) {
        assert.ok(
          a.recommendation_score >= b.recommendation_score,
          `Score order violation: ${a.recommendation_score} < ${b.recommendation_score}`
        );
      } else {
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        if (Math.abs(ratingB - ratingA) > 0.0001) {
          assert.ok(ratingA >= ratingB, 'Rating order violation');
        } else {
          assert.ok(a.content_id <= b.content_id, 'Content ID tiebreak violation');
        }
      }
    }
  });

  console.log('\n================================================================');
  console.log('   ALL PHASE 5 SURPRISE ME VERIFICATIONS PASSED                 ');
  console.log('================================================================');
  process.exit(0);
}

runPhase5Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

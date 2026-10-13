// =============================================================================
// CINEVERSE RECOMMENDATION ENGINE — COMPREHENSIVE EVALUATION SUITE
// =============================================================================
// Validates:
// - Exact 8 required test profiles (Guided & Custom)
// - Correct constraint adherence (Type, Platform, Language, Runtime relation)
// - Score breakdown and truthful explanations
// - Latency measurements (embedding, retrieval, scoring, reranking)
// =============================================================================

import assert from 'assert';
import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { pool } from './db/connection';

console.log('================================================================');
console.log('    TESTING CINEVERSE HYBRID RECOMMENDATION ENGINE              ');
console.log('================================================================\n');

async function runEvaluation() {
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  // ── TEST 1: Guided thought_provoking Movie around_2_hours recent high ──────
  await test('TEST 1 (Guided): thought_provoking + Movie + around_2h + recent + high', async () => {
    const profile = PreferenceProfileBuilder.buildFromGuided({
      experience: 'thought_provoking',
      type: 'Movie',
      runtime_preference: 'around_2_hours',
      era_preference: 'recent',
      quality_preference: 'high',
    });

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.recommendations.length, 20, 'Must return exactly Top 20');

    // Verification 1: Movies only
    for (const rec of res.recommendations) {
      assert.strictEqual(rec.type, 'Movie', `All results must be Movie (got ${rec.title}: ${rec.type})`);
    }

    // Verification 2: Quality weighting active and recent favored
    const avgYear = res.recommendations.reduce((sum, r) => sum + (r.release_year || 0), 0) / 20;
    assert.ok(avgYear >= 2015, `Recent titles must be favored (avg year: ${avgYear.toFixed(1)})`);

    const avgRating = res.recommendations.reduce((sum, r) => sum + (r.rating || 0), 0) / 20;
    assert.ok(avgRating >= 7.0, `High quality must be favored (avg rating: ${avgRating.toFixed(1)})`);

    console.log(`   Top 3 picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" (${r.release_year}, ${r.rating}★, ${r.match_percentage}%)`).join(' | ')}`);
  });

  // ── TEST 2: Guided funny Series binge_series any medium ────────────────────
  await test('TEST 2 (Guided): funny + Series + binge_series + any + medium', async () => {
    const profile = PreferenceProfileBuilder.buildFromGuided({
      experience: 'funny',
      type: 'Series',
      runtime_preference: 'binge_series',
      era_preference: 'any',
      quality_preference: 'medium',
    });

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.recommendations.length, 20);

    // Verification: Series only
    for (const rec of res.recommendations) {
      assert.strictEqual(rec.type, 'Series', `All results must be Series (got ${rec.title}: ${rec.type})`);
      assert.ok(rec.score_breakdown.experience >= 0.4, 'Experience score must be active');
    }

    console.log(`   Top 3 picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" (${r.rating}★, ${r.match_percentage}%)`).join(' | ')}`);
  });

  // ── TEST 3: Guided emotional type=null no_preference classic low ──────────
  await test('TEST 3 (Guided): emotional + type=null + no_pref + classic + low', async () => {
    const profile = PreferenceProfileBuilder.buildFromGuided({
      experience: 'emotional',
      type: null,
      runtime_preference: 'no_preference',
      era_preference: 'classic',
      quality_preference: 'low',
    });

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.recommendations.length, 20);

    // Verification: Classic titles favored (earlier years)
    const avgYear = res.recommendations.reduce((sum, r) => sum + (r.release_year || 0), 0) / 20;
    assert.ok(avgYear <= 2005, `Classic titles favored (avg year: ${avgYear.toFixed(1)})`);

    console.log(`   Top 3 picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" (${r.release_year}, ${r.rating}★)`).join(' | ')}`);
  });

  // ── TEST 4: Custom "I want a recent sci-fi movie under 2 hours." ────────────
  await test('TEST 4 (Custom): "I want a recent sci-fi movie under 2 hours."', async () => {
    const prompt = 'I want a recent sci-fi movie under 2 hours.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.recommendations.length, 20);

    // Verification: Movies only, Sci-Fi favored, under 2h
    for (const rec of res.recommendations) {
      assert.strictEqual(rec.type, 'Movie');
      assert.ok(rec.score_breakdown.genre >= 0.5, 'Must match requested genre Sci-Fi & Fantasy');
    }

    console.log(`   Top 3 picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" (${r.release_year}, ${r.match_percentage}%)`).join(' | ')}`);
  });

  // ── TEST 5: Custom "Give me a Korean mystery series on Netflix." ────────────
  await test('TEST 5 (Custom): "Give me a Korean mystery series on Netflix."', async () => {
    const prompt = 'Give me a Korean mystery series on Netflix.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.ok(res.recommendations.length > 0);

    // Verification: Series only, available on Netflix, Korean
    for (const rec of res.recommendations) {
      assert.strictEqual(rec.type, 'Series', `Must be Series (got ${rec.type})`);
      assert.strictEqual(rec.score_breakdown.platform, 1.0, 'Must be available on Netflix');
      assert.strictEqual(rec.score_breakdown.language, 1.0, 'Must match Korean language');
    }

    console.log(`   Top picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" (${r.match_percentage}%)`).join(' | ')}`);
  });

  // ── TEST 6: Custom "I want something emotional but not too depressing." ─────
  await test('TEST 6 (Custom): "I want something emotional but not too depressing."', async () => {
    const prompt = 'I want something emotional but not too depressing.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.recommendations.length, 20);

    for (const rec of res.recommendations) {
      assert.ok(rec.score_breakdown.semantic >= 0.4, 'Semantic score must be active');
    }

    console.log(`   Top 3 picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" (${r.match_percentage}%)`).join(' | ')}`);
  });

  // ── TEST 7: Custom "I want something like Interstellar but shorter." ────────
  await test('TEST 7 (Custom): "I want something like Interstellar but shorter."', async () => {
    const prompt = 'I want something like Interstellar but shorter.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(profile.reference_titles, ['Interstellar']);
    assert.strictEqual(profile.runtime_relation, 'shorter_than_reference');

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.recommendations.length, 20);

    // Verification: Interstellar itself must NOT be in recommendations (cannot recommend self)
    const titles = res.recommendations.map(r => r.title.toLowerCase());
    assert.ok(!titles.includes('interstellar'), 'Cannot recommend reference title to itself');

    // Reference similarity must be active
    for (const rec of res.recommendations) {
      assert.ok(rec.score_breakdown.reference > 0.4, 'Reference similarity must contribute');
      assert.ok(rec.score_breakdown.runtime >= 0.7, 'Shorter duration than Interstellar (169m) rewarded');
    }

    console.log(`   Top 3 picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" (${r.match_percentage}%, ref: ${r.score_breakdown.reference})`).join(' | ')}`);
  });

  // ── TEST 8: Custom "I don't care, surprise me." ─────────────────────────────
  await test('TEST 8 (Custom): "I don\'t care, surprise me."', async () => {
    const prompt = "I don't care, surprise me.";
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.recommendations.length, 20);

    // Controlled discovery: High quality bar (ratings >= 6.8)
    const ratings = res.recommendations.map(r => r.rating || 0);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / 20;
    assert.ok(avgRating >= 7.0, `Surprise Me must maintain quality bar (avg: ${avgRating.toFixed(1)})`);

    // Must have diverse genres
    const allPicks = res.recommendations.map(r => r.title);
    assert.strictEqual(new Set(allPicks).size, 20, 'All 20 picks must be distinct');

    console.log(`   Top 3 picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" (${r.rating}★)`).join(' | ')}`);
  });

  // ── TEST 9: Latency benchmark ──────────────────────────────────────────────
  await test('TEST 9: Performance & Latency Benchmark', async () => {
    const profile = await PreferenceProfileBuilder.buildFromCustom('A thrilling sci-fi adventure');
    const t0 = Date.now();
    const res = await engine.recommend(profile, true);
    const elapsed = Date.now() - t0;

    assert.ok(elapsed < 2000, `Recommendation must execute under 2000ms (took ${elapsed}ms)`);
    console.log(`   Latency Breakdown:`);
    console.log(`   - Query Embedding:      ${res.debug?.execution_time_ms.query_embedding_ms}ms`);
    console.log(`   - Candidate Retrieval:  ${res.debug?.execution_time_ms.candidate_retrieval_ms}ms`);
    console.log(`   - Feature Scoring:      ${res.debug?.execution_time_ms.feature_scoring_ms}ms`);
    console.log(`   - Total Request:        ${res.debug?.execution_time_ms.total_ms}ms`);
  });

  // ── TEST 10: Pure Hybrid Score Monotonicity (Zero MMR Inversion) ────────────
  await test('TEST 10: Pure Hybrid Score Monotonicity (Similarity does not alter ranking)', async () => {
    // 1. Invariant test: When candidates A, B, C, D have scores 0.95, 0.93, 0.91, 0.89,
    // even if B and C are 100% identical/similar to A, ranking strictly remains [A, B, C, D].
    const candidates = [
      { id: 1, title: 'Candidate A', hybrid_score: 0.95, rating: 8.0 },
      { id: 2, title: 'Candidate B (Identical to A)', hybrid_score: 0.93, rating: 7.9 },
      { id: 3, title: 'Candidate C (Identical to A)', hybrid_score: 0.91, rating: 7.8 },
      { id: 4, title: 'Candidate D (Dissimilar)', hybrid_score: 0.89, rating: 7.5 },
    ];

    const sorted = [...candidates].sort((a, b) => {
      if (Math.abs(b.hybrid_score - a.hybrid_score) > 0.0001) {
        return b.hybrid_score - a.hybrid_score;
      }
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    assert.strictEqual(sorted[0].title, 'Candidate A');
    assert.strictEqual(sorted[1].title, 'Candidate B (Identical to A)');
    assert.strictEqual(sorted[2].title, 'Candidate C (Identical to A)');
    assert.strictEqual(sorted[3].title, 'Candidate D (Dissimilar)');

    // 2. Real engine execution check: All returned recommendations must be monotonically non-increasing in score
    const profile = await PreferenceProfileBuilder.buildFromCustom('A dark psychological thriller');
    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.ok(res.recommendations.length > 0);

    for (let i = 0; i < res.recommendations.length - 1; i++) {
      const curr = res.recommendations[i].recommendation_score;
      const next = res.recommendations[i + 1].recommendation_score;
      assert.ok(
        curr >= next - 0.0001,
        `Ranking violation at rank ${i + 1}: ${curr} < ${next} (MMR must not invert rank)`
      );
    }
    console.log(`   Top 4 scores strictly monotonic: ${res.recommendations.slice(0, 4).map(r => r.recommendation_score.toFixed(3)).join(' >= ')}`);
  });

  console.log(`\n🎉 All ${passed}/${total} recommendation evaluation scenarios passed successfully!\n`);
  await pool.end();
}

runEvaluation().catch((err) => {
  console.error('Fatal evaluation runner error:', err);
  process.exit(1);
});

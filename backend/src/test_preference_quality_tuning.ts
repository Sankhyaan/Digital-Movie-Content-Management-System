// =============================================================================
// CINEVERSE — RECOMMENDATION QUALITY TUNING PHASE 2 TEST SUITE
// =============================================================================
// Validates:
// 1. Negative / exclusion preferences (soft penalties & hard exclusions)
// 2. Exact runtime parsing (hard vs soft targets)
// 3. Exact decade / year ranges
// 4. Token-safe reference-title resolution
// 5. Preserved behavior for previous core scenarios
// =============================================================================

import assert from 'assert';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { CandidateRetriever } from './services/recommendation/candidateRetriever';
import { isSafeReferenceTitleMatch } from './services/customPromptParser';

async function runQualityTuningTests() {
  console.log('================================================================');
  console.log('   TESTING RECOMMENDATION QUALITY TUNING PHASE 2                ');
  console.log('================================================================\n');

  const engine = RecommendationEngine.getInstance();
  await engine.init();
  const retriever = CandidateRetriever.getInstance();

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

  // ── TEST A: "I want something emotional but not too depressing." ───────────
  await test('TEST A: "I want something emotional but not too depressing."', async () => {
    const prompt = 'I want something emotional but not too depressing.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    // 1. Verify positive emotional preference exists
    assert.ok(
      profile.experience.includes('emotional'),
      'Must contain positive emotional experience'
    );

    // 2. Verify negative depressing preference exists
    assert.ok(
      profile.negative_themes.some((t) => t.includes('depressing')) ||
        profile.negative_keywords.includes('depressing'),
      'Must extract depressing into negative preferences'
    );
    assert.ok(
      !profile.themes.includes('not too depressing'),
      'Must NOT treat "not too depressing" as positive theme text'
    );

    // 3. Run recommendation engine and verify negative penalty is active
    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.ok(res.recommendations.length > 0);

    // Verify negative penalty exists in debug / score breakdown where applicable
    const candidatesWithNegativeMatch = res.recommendations.filter(
      (r) => r.score_breakdown.negative_match !== undefined || r.score_breakdown.negative_penalty !== undefined
    );
    assert.ok(
      candidatesWithNegativeMatch.length > 0,
      'Negative embedding evaluation must be active on candidate pool'
    );

    console.log(
      `   Top 3 picks: ${res.recommendations
        .slice(0, 3)
        .map((r) => `"${r.title}" (${r.match_percentage}%, negPenalty: ${r.score_breakdown.negative_penalty ?? 0})`)
        .join(' | ')}`
    );
  });

  // ── TEST B: "I want a psychological thriller but not too dark." ────────────
  await test('TEST B: "I want a psychological thriller but not too dark."', async () => {
    const prompt = 'I want a psychological thriller but not too dark.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    // Verify dark is negative, not positive
    assert.ok(
      profile.negative_keywords.includes('dark'),
      'Dark must be extracted as negative keyword'
    );
    assert.ok(
      profile.genres.includes('Thriller'),
      'Thriller must remain active as positive genre'
    );
    assert.ok(
      !profile.themes.includes('dark'),
      'Dark must NOT be a positive theme'
    );
  });

  // ── TEST C: "I don't want horror." ─────────────────────────────────────────
  await test('TEST C: "I don\'t want horror."', async () => {
    const prompt = "I don't want horror.";
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    // Verify horror becomes an explicit exclusion
    assert.ok(
      profile.negative_genres.includes('Horror'),
      'Horror must be extracted into negative_genres'
    );
    assert.ok(
      !profile.genres.includes('Horror'),
      'Horror must NOT be in positive genres'
    );

    // Retrieve candidates and verify NO horror titles exist
    const candidates = await retriever.retrieveCandidates(profile);
    const hasHorror = candidates.some((c) => c.genres.includes('Horror'));
    assert.strictEqual(hasHorror, false, 'Candidate pool must strictly exclude all Horror titles');
  });

  // ── TEST D: "I only have about 90 minutes. Give me a thriller." ───────────
  await test('TEST D: "I only have about 90 minutes. Give me a thriller."', async () => {
    const prompt = 'I only have about 90 minutes. Give me a thriller.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    // Verify max_runtime_minutes is populated
    assert.strictEqual(profile.max_runtime_minutes, 90, 'max_runtime_minutes must equal 90');
    assert.ok(profile.genres.includes('Thriller'), 'Genre must be Thriller');

    // Run engine and verify top results respect it appropriately
    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    const top5 = res.recommendations.slice(0, 5);
    for (const r of top5) {
      const dna = retriever.getMovieDNA(r.content_id);
      if (dna && dna.type === 'Movie' && dna.runtime) {
        assert.ok(
          dna.runtime <= 110,
          `Top picks must closely respect ~90 min budget (got ${dna.title}: ${dna.runtime}m)`
        );
      }
    }
    console.log(
      `   Top 3 picks: ${top5
        .slice(0, 3)
        .map((r) => `"${r.title}" (${retriever.getMovieDNA(r.content_id)?.runtime}m, ${r.match_percentage}%)`)
        .join(' | ')}`
    );
  });

  // ── TEST E: "I need something under 90 minutes." ───────────────────────────
  await test('TEST E: "I need something under 90 minutes."', async () => {
    const prompt = 'I need something under 90 minutes.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    // Verify hard max runtime
    assert.strictEqual(profile.max_runtime_minutes, 90, 'max_runtime_minutes must equal 90');
    assert.strictEqual(profile.runtime_is_hard_constraint, true, 'Must be hard runtime constraint');

    const candidates = await retriever.retrieveCandidates(profile);
    for (const c of candidates) {
      if (c.type === 'Movie' && c.runtime) {
        assert.ok(
          c.runtime <= 90,
          `Candidate runtime must be strictly <= 90 min (got ${c.title}: ${c.runtime}m)`
        );
      }
    }
  });

  // ── TEST F: "I'd prefer something around 90 minutes." ──────────────────────
  await test('TEST F: "I\'d prefer something around 90 minutes."', async () => {
    const prompt = "I'd prefer something around 90 minutes.";
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    // Verify soft runtime target
    assert.strictEqual(profile.max_runtime_minutes, 90, 'max_runtime_minutes must equal 90');
    assert.strictEqual(
      profile.runtime_is_hard_constraint,
      false,
      'runtime_is_hard_constraint must be false for soft preference'
    );
  });

  // ── TEST G: "I want a thriller from the 2000s." ────────────────────────────
  await test('TEST G: "I want a thriller from the 2000s."', async () => {
    const prompt = 'I want a thriller from the 2000s.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    // Verify min_release_year = 2000, max_release_year = 2009
    assert.strictEqual(profile.min_release_year, 2000, 'min_release_year must be 2000');
    assert.strictEqual(profile.max_release_year, 2009, 'max_release_year must be 2009');
    assert.strictEqual(profile.year_range_is_hard, true, 'Decade must be hard constraint when specified directly');

    const candidates = await retriever.retrieveCandidates(profile);
    for (const c of candidates) {
      if (c.release_year) {
        assert.ok(
          c.release_year >= 2000 && c.release_year <= 2009,
          `Candidate year must be in 2000-2009 (got ${c.title}: ${c.release_year})`
        );
      }
    }
  });

  // ── TEST H: "I want something from 1990 to 1995." ──────────────────────────
  await test('TEST H: "I want something from 1990 to 1995."', async () => {
    const prompt = 'I want something from 1990 to 1995.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    // Verify exact range
    assert.strictEqual(profile.min_release_year, 1990, 'min_release_year must be 1990');
    assert.strictEqual(profile.max_release_year, 1995, 'max_release_year must be 1995');
    assert.strictEqual(profile.year_range_is_hard, true, 'Year range must be hard constraint');

    const candidates = await retriever.retrieveCandidates(profile);
    for (const c of candidates) {
      if (c.release_year) {
        assert.ok(
          c.release_year >= 1990 && c.release_year <= 1995,
          `Candidate year must be in 1990-1995 (got ${c.title}: ${c.release_year})`
        );
      }
    }
  });

  // ── TEST I: "I want something like Inside Out." ─────────────────────────────
  await test('TEST I: "I want something like Inside Out."', async () => {
    const prompt = 'I want something like Inside Out.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    // 1. Verify reference resolution is exactly Inside Out
    assert.deepStrictEqual(
      profile.reference_titles,
      ['Inside Out'],
      'Reference title must resolve exactly to "Inside Out"'
    );

    // 2. Verify token safety matching
    assert.strictEqual(
      isSafeReferenceTitleMatch('Inside Out', 'Inside Out'),
      true,
      '"Inside Out" matches "Inside Out"'
    );
    assert.strictEqual(
      isSafeReferenceTitleMatch('Inside Out', 'Insidious: Out of the Further'),
      false,
      '"Insidious: Out of the Further" must NOT match "Inside Out"'
    );
    assert.strictEqual(
      isSafeReferenceTitleMatch('Inside Out', "It's What's Inside"),
      false,
      '"It\'s What\'s Inside" must NOT match "Inside Out"'
    );
  });

  // ── TEST J: "I want something like The Dark Knight." ───────────────────────
  await test('TEST J: "I want something like The Dark Knight."', async () => {
    const prompt = 'I want something like The Dark Knight.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(
      profile.reference_titles,
      ['The Dark Knight'],
      'Must resolve exactly to "The Dark Knight"'
    );
    assert.strictEqual(
      isSafeReferenceTitleMatch('The Dark Knight', 'Dark'),
      false,
      '"Dark" must not match "The Dark Knight"'
    );
  });

  // ── TEST K: "I want something like Interstellar but shorter." ──────────────
  await test('TEST K: "I want something like Interstellar but shorter."', async () => {
    const prompt = 'I want something like Interstellar but shorter.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(profile.reference_titles, ['Interstellar']);
    assert.strictEqual(profile.runtime_relation, 'shorter_than_reference');

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.recommendations.length, 20);

    // Top recommendations must be strictly shorter than 169m
    for (const r of res.recommendations) {
      const dna = retriever.getMovieDNA(r.content_id);
      if (dna && dna.type === 'Movie' && dna.runtime) {
        assert.ok(
          dna.runtime < 169,
          `Candidate "${r.title}" (${dna.runtime}m) must be shorter than Interstellar (169m)`
        );
      }
    }
  });

  // ── TEST L: "Korean mystery series on Netflix." ────────────────────────────
  await test('TEST L: "Korean mystery series on Netflix."', async () => {
    const prompt = 'Give me a Korean mystery series on Netflix.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.strictEqual(profile.type, 'Series');
    assert.deepStrictEqual(profile.languages, ['Korean']);
    assert.deepStrictEqual(profile.platforms, ['Netflix']);
    assert.ok(profile.genres.includes('Mystery'));

    const res = await engine.recommend(profile, true);
    assert.strictEqual(res.success, true);
    assert.ok(res.recommendations.length > 0);

    for (const r of res.recommendations) {
      assert.strictEqual(r.type, 'Series');
      assert.strictEqual(r.score_breakdown.platform, 1.0);
      assert.strictEqual(r.score_breakdown.language, 1.0);
    }
  });

  console.log(`\n================================================================`);
  console.log(`🎉 All ${passed}/${total} Quality Tuning Phase 2 Tests PASSED!`);
  console.log(`================================================================\n`);

  process.exit(0);
}

runQualityTuningTests().catch((err) => {
  console.error('Fatal quality tuning test error:', err);
  process.exit(1);
});

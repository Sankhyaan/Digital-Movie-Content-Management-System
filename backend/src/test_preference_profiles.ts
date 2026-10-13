// =============================================================================
// CINEVERSE — USER PREFERENCE PROFILE VALIDATION TEST SUITE
// =============================================================================
// Validates:
// 1. Guided Quiz scenarios produce expected UserPreferenceProfile objects.
// 2. Custom Request scenarios produce expected UserPreferenceProfile objects.
// 3. Reference titles resolved from database ("Interstellar", "Inception", etc.).
// 4. Runtime relation ("shorter_than_reference", "longer_than_reference").
// 5. Unresolved reference titles are preserved in themes, NOT invented.
// 6. Over-parsing guards: "I like funny movies" or "movies I like" NOT treated as titles.
// 7. Quality preference correctly modeled as rating importance weights.
// =============================================================================

import assert from 'assert';
import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { pool } from './db/connection';

console.log('================================================================');
console.log('    TESTING USER PREFERENCE PROFILE BUILDER & CUSTOM PARSER     ');
console.log('================================================================\n');

let passed = 0;
let total = 0;

async function test(name: string, fn: () => Promise<void> | void) {
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

async function runAllTests() {
  // ── GUIDED TESTS ───────────────────────────────────────────────────────────

  await test('Guided Test 1: thought_provoking + Movie + around_2_hours + recent + high', () => {
    const profile = PreferenceProfileBuilder.buildFromGuided({
      experience: 'thought_provoking',
      type: 'Movie',
      runtime_preference: 'around_2_hours',
      era_preference: 'recent',
      quality_preference: 'high'
    });

    assert.strictEqual(profile.source, 'guided');
    assert.deepStrictEqual(profile.experience, ['thought_provoking']);
    assert.strictEqual(profile.type, 'Movie');
    assert.deepStrictEqual(profile.genres, [], 'Genres must NOT be prematurely assigned');
    assert.deepStrictEqual(profile.languages, []);
    assert.deepStrictEqual(profile.platforms, []);
    assert.strictEqual(profile.runtime_preference, 'around_2_hours');
    assert.strictEqual(profile.runtime_relation, null);
    assert.strictEqual(profile.era_preference, 'recent');
    assert.strictEqual(profile.quality_preference, 'high');
    assert.deepStrictEqual(profile.themes, []);
    assert.deepStrictEqual(profile.reference_titles, []);
    assert.strictEqual(profile.free_text, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('Guided Test 2: funny + Series + binge_series + any + medium', () => {
    const profile = PreferenceProfileBuilder.buildFromGuided({
      experience: 'funny',
      type: 'Series',
      runtime_preference: 'binge_series',
      era_preference: 'any',
      quality_preference: 'medium'
    });

    assert.strictEqual(profile.source, 'guided');
    assert.deepStrictEqual(profile.experience, ['funny']);
    assert.strictEqual(profile.type, 'Series');
    assert.deepStrictEqual(profile.genres, []);
    assert.strictEqual(profile.runtime_preference, 'binge_series');
    assert.strictEqual(profile.runtime_relation, null);
    assert.strictEqual(profile.era_preference, 'any');
    assert.strictEqual(profile.quality_preference, 'medium');
    assert.deepStrictEqual(profile.reference_titles, []);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('Guided Test 3: emotional + no type + no_preference + classic + low (low rating importance)', () => {
    const profile = PreferenceProfileBuilder.buildFromGuided({
      experience: 'emotional',
      type: null,
      runtime_preference: 'no_preference',
      era_preference: 'classic',
      quality_preference: 'low'
    });

    assert.strictEqual(profile.source, 'guided');
    assert.deepStrictEqual(profile.experience, ['emotional']);
    assert.strictEqual(profile.type, null, 'No type forced');
    assert.strictEqual(profile.runtime_preference, 'no_preference');
    assert.strictEqual(profile.runtime_relation, null);
    assert.strictEqual(profile.era_preference, 'classic');
    assert.strictEqual(profile.quality_preference, 'low');
    assert.deepStrictEqual(profile.reference_titles, []);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  // ── CUSTOM TESTS SPECIFIED IN SECTION 7 ────────────────────────────────────

  await test('TEST 1: "I want something like Interstellar."', async () => {
    const prompt = 'I want something like Interstellar.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.strictEqual(profile.source, 'custom');
    assert.deepStrictEqual(profile.reference_titles, ['Interstellar'], 'Must resolve Interstellar from CineVerse DB');
    assert.strictEqual(profile.runtime_relation, null, 'Runtime relation must be null');
    assert.strictEqual(profile.runtime_preference, null, 'Runtime preference must be null');
    assert.deepStrictEqual(profile.genres, []);
    assert.strictEqual(profile.type, null);
    assert.deepStrictEqual(profile.themes, [], 'Resolved reference title must NOT be in themes');
    assert.strictEqual(profile.free_text, prompt);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 2: "I want something like Interstellar but shorter."', async () => {
    const prompt = 'I want something like Interstellar but shorter.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.strictEqual(profile.source, 'custom');
    assert.deepStrictEqual(profile.reference_titles, ['Interstellar']);
    assert.strictEqual(profile.runtime_relation, 'shorter_than_reference', 'Must detect shorter_than_reference relation');
    assert.strictEqual(profile.runtime_preference, null, 'Must NOT convert relative shorter into generic under_2_hours');
    assert.deepStrictEqual(profile.genres, []);
    assert.deepStrictEqual(profile.themes, []);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 3: "I want something like Interstellar but longer."', async () => {
    const prompt = 'I want something like Interstellar but longer.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.strictEqual(profile.source, 'custom');
    assert.deepStrictEqual(profile.reference_titles, ['Interstellar']);
    assert.strictEqual(profile.runtime_relation, 'longer_than_reference', 'Must detect longer_than_reference relation');
    assert.strictEqual(profile.runtime_preference, null, 'Runtime preference must be null');
    assert.deepStrictEqual(profile.genres, []);
    assert.deepStrictEqual(profile.themes, []);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 4: "I want a sci-fi movie under 2 hours."', async () => {
    const prompt = 'I want a sci-fi movie under 2 hours.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.strictEqual(profile.source, 'custom');
    assert.deepStrictEqual(profile.genres, ['Sci-Fi & Fantasy']);
    assert.strictEqual(profile.type, 'Movie');
    assert.strictEqual(profile.runtime_preference, 'under_2_hours');
    assert.deepStrictEqual(profile.reference_titles, []);
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 5: "I want a recent sci-fi movie under 2 hours on Netflix."', async () => {
    const prompt = 'I want a recent sci-fi movie under 2 hours on Netflix.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.strictEqual(profile.source, 'custom');
    assert.deepStrictEqual(profile.genres, ['Sci-Fi & Fantasy']);
    assert.deepStrictEqual(profile.platforms, ['Netflix']);
    assert.strictEqual(profile.runtime_preference, 'under_2_hours');
    assert.strictEqual(profile.era_preference, 'recent');
    assert.strictEqual(profile.type, 'Movie');
    assert.deepStrictEqual(profile.reference_titles, []);
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 6: "I don\'t care, surprise me."', async () => {
    const prompt = "I don't care, surprise me.";
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.strictEqual(profile.source, 'custom');
    assert.deepStrictEqual(profile.experience, []);
    assert.strictEqual(profile.type, null);
    assert.deepStrictEqual(profile.genres, []);
    assert.deepStrictEqual(profile.languages, []);
    assert.deepStrictEqual(profile.platforms, []);
    assert.strictEqual(profile.runtime_preference, null);
    assert.strictEqual(profile.runtime_relation, null);
    assert.strictEqual(profile.era_preference, null);
    assert.strictEqual(profile.quality_preference, null);
    assert.deepStrictEqual(profile.themes, []);
    assert.deepStrictEqual(profile.reference_titles, []);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  // ── ADDITIONAL REFERENCE TITLE RESOLUTION & OVER-PARSING TESTS ─────────────

  await test('TEST 7: "I want movies similar to Inception."', async () => {
    const prompt = 'I want movies similar to Inception.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(profile.reference_titles, ['Inception']);
    assert.strictEqual(profile.type, 'Movie');
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 8: "Give me something like The Dark Knight."', async () => {
    const prompt = 'Give me something like The Dark Knight.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(profile.reference_titles, ['The Dark Knight']);
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 9: "movies similar to Avatar"', async () => {
    const prompt = 'movies similar to Avatar';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(profile.reference_titles, ['Avatar']);
    assert.strictEqual(profile.type, 'Movie');
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 10: "I want something like The Really Unknown Movie" (Unresolved title preserved in unresolved_references)', async () => {
    const prompt = 'I want something like The Really Unknown Movie';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(profile.reference_titles, [], 'Must NOT invent or guess unknown reference titles');
    assert.ok(
      profile.unresolved_references.some(t => t.toLowerCase().includes('the really unknown movie')),
      'Must preserve unresolvable reference phrase in unresolved_references'
    );
    assert.deepStrictEqual(profile.themes, [], 'Unresolved reference must NOT be pushed into themes');
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 11: "I like funny movies." (Over-parsing guard: "I like" must NOT be a reference title)', async () => {
    const prompt = 'I like funny movies.';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(profile.reference_titles, [], '"I like" must not trigger reference_titles');
    assert.deepStrictEqual(profile.genres, ['Comedy']);
    assert.strictEqual(profile.type, 'Movie');
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 12: "movies I like" (Over-parsing guard)', async () => {
    const prompt = 'movies I like';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(profile.reference_titles, []);
    assert.strictEqual(profile.type, 'Movie');
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 13: "Give me a Korean mystery series on Netflix"', async () => {
    const prompt = 'Give me a Korean mystery series on Netflix';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.strictEqual(profile.type, 'Series');
    assert.deepStrictEqual(profile.genres, ['Mystery']);
    assert.deepStrictEqual(profile.languages, ['Korean']);
    assert.deepStrictEqual(profile.platforms, ['Netflix']);
    assert.deepStrictEqual(profile.reference_titles, []);
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  await test('TEST 14: "I want something emotional but not too depressing"', async () => {
    const prompt = 'I want something emotional but not too depressing';
    const profile = await PreferenceProfileBuilder.buildFromCustom(prompt);

    assert.deepStrictEqual(profile.experience, ['emotional']);
    assert.ok(profile.negative_themes.some((t: string) => t.includes('depressing')));
    assert.deepStrictEqual(profile.reference_titles, []);
    assert.strictEqual(profile.runtime_relation, null);

    const val = PreferenceProfileBuilder.validate(profile);
    assert.strictEqual(val.valid, true);
  });

  console.log(`\n🎉 All ${passed}/${total} test scenarios passed successfully!\n`);
  await pool.end();
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

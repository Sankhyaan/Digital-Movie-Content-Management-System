// =============================================================================
// CINEVERSE: FORMAL STRICT SCHEMA VALIDATION & ENTITY RESOLUTION TEST SUITE
// =============================================================================

import assert from 'assert';
import {
  validateGeminiDeltaSchema,
  sanitizeAndValidateGeminiDelta,
  mergeProfileWithLlmDelta,
  ALLOWED_DELTA_KEYS
} from './services/llmPromptParser';
import { UserPreferenceProfile } from './models/preferenceProfile';

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

import { CandidateRetriever } from './services/recommendation/candidateRetriever';
import { initPersonCatalogFromDatabase } from './services/customPromptParser';
import { pool } from './db/connection';

async function runSchemaTests() {
  await initPersonCatalogFromDatabase();
  await CandidateRetriever.getInstance().init();
  console.log('================================================================');
  console.log('   RUNNING FORMAL SCHEMA VALIDATION & ENTITY RESOLUTION TESTS   ');
  console.log('================================================================\n');

  // Test 1: Non-object roots
  console.log('1. Testing Non-Object Root Rejection...');
  const nonObjectInputs = [
    null,
    undefined,
    '{"type": "Movie"}', // raw string
    [1, 2, 3], // array
    12345, // number
    true // boolean
  ];
  for (const input of nonObjectInputs) {
    const res = validateGeminiDeltaSchema(input);
    assert.strictEqual(res.isValid, false, `Expected rejection for input: ${typeof input}`);
    assert.ok(res.errors.length > 0);
  }
  console.log('   ✅ PASS: Primitive and array roots rejected.\n');

  // Test 2: Unexpected / Disallowed Properties
  console.log('2. Testing Unexpected Property Injection...');
  const unexpectedInputs = [
    { type: 'Movie', sql_query: 'SELECT * FROM content' },
    { type: 'Movie', evil_flag: true, genres: ['Action'] },
    JSON.parse('{"type": "Movie", "__proto__": {"admin": true}}'),
    { type: 'Movie', prompt_injection: 'Ignore previous instructions' },
  ];
  for (const input of unexpectedInputs) {
    const res = validateGeminiDeltaSchema(input);
    assert.strictEqual(res.isValid, false, `Expected rejection of unexpected property in: ${JSON.stringify(input)}`);
    assert.ok(res.errors.some(e => e.includes('Unexpected property')));
  }
  console.log('   ✅ PASS: Unexpected/injected properties strictly rejected.\n');

  // Test 3: Incorrect Field Types
  console.log('3. Testing Incorrect Field Types...');
  const badTypeInputs = [
    { type: 'Movie', genres: 'Action' }, // genres must be array
    { type: 'Movie', genres: [123, 456] }, // array elements must be strings
    { type: 'Movie', actors: { name: 'Tom Holland' } }, // actors must be array
    { type: 'Movie', min_release_year: '2010' }, // year must be number
    { type: 'Movie', min_runtime_minutes: '90' }, // runtime must be number
    { type: 'Movie', is_meaningful: 'true' }, // must be boolean
  ];
  for (const input of badTypeInputs) {
    const res = validateGeminiDeltaSchema(input);
    assert.strictEqual(res.isValid, false, `Expected rejection for bad types in: ${JSON.stringify(input)}`);
    assert.ok(res.errors.length > 0);
  }
  console.log('   ✅ PASS: Incorrect field types rejected.\n');

  // Test 4: Unsupported Enum Values
  console.log('4. Testing Unsupported Enum Values...');
  const badEnumInputs = [
    { type: 'Film' }, // must be Movie or Series
    { type: 'TV Show' },
    { runtime_preference: 'short_movie' }, // must be canonical enum
    { runtime_preference: 'epic' },
    { runtime_relation: 'shorter' }, // must be shorter_than_reference
  ];
  for (const input of badEnumInputs) {
    const res = validateGeminiDeltaSchema(input);
    assert.strictEqual(res.isValid, false, `Expected rejection for bad enum in: ${JSON.stringify(input)}`);
    assert.ok(res.errors.length > 0);
  }
  console.log('   ✅ PASS: Unsupported enum values rejected.\n');

  // Test 5: Invalid Numeric Bounds
  console.log('5. Testing Invalid Numeric Bounds...');
  const badBoundsInputs = [
    { min_release_year: 1800 }, // < 1900
    { max_release_year: 2050 }, // > 2035
    { min_runtime_minutes: 0 }, // < 1
    { max_runtime_minutes: 9999 }, // > 600
    { min_release_year: NaN },
    { max_runtime_minutes: Infinity },
  ];
  for (const input of badBoundsInputs) {
    const res = validateGeminiDeltaSchema(input);
    assert.strictEqual(res.isValid, false, `Expected rejection for bad bounds: ${JSON.stringify(input)}`);
    assert.ok(res.errors.length > 0);
  }
  console.log('   ✅ PASS: Out-of-bound years and runtimes rejected.\n');

  // Test 6: Valid Delta Schema Acceptance
  console.log('6. Testing Valid Structured Delta Acceptance...');
  const validDelta = {
    type: 'Movie' as const,
    genres: ['Action', 'Thriller'],
    negative_genres: ['Horror'],
    languages: ['Korean'],
    platforms: ['Netflix'],
    actors: ['Karl Urban'],
    directors: ['Christopher Nolan'],
    reference_titles: ['Interstellar'],
    themes: ['intellectually challenging', 'scientific discovery'],
    negative_themes: ['depressing', 'violent'],
    negative_keywords: ['depressing', 'violent', 'blood'],
    negative_franchises: ['Spider-Man'],
    min_release_year: 2010,
    max_release_year: 2024,
    min_runtime_minutes: 90,
    max_runtime_minutes: 150,
    runtime_preference: 'around_2_hours',
    runtime_relation: 'shorter_than_reference' as const,
    is_meaningful: true,
  };
  const valResult = validateGeminiDeltaSchema(validDelta);
  assert.strictEqual(valResult.isValid, true);
  assert.strictEqual(valResult.errors.length, 0);
  assert.deepStrictEqual(valResult.validatedDelta, validDelta);
  console.log('   ✅ PASS: Fully specified valid delta accepted.\n');

  // Test 7: Catalog-Grounded Entity Resolution
  console.log('7. Testing Catalog Entity Grounding (Sanitization)...');
  const hallucinatedDelta = {
    type: 'Movie' as const,
    genres: ['NonexistentGenreX', 'Sci-Fi & Fantasy', 'CyberpunkSpaceOpera'],
    languages: ['Elvish', 'Korean', 'Klingon'],
    platforms: ['FakeFlix', 'Netflix', 'PirateBay'],
    actors: ['Totally Fake Actor 12345', 'Christian Bale'],
    directors: ['Fake Director 99999', 'Christopher Nolan'],
    reference_titles: ['MovieThatDefinitelyDoesNotExistInCatalog2099', 'Inception'],
    negative_genres: ['MadeUpHorrorSubgenre', 'Horror'],
  };
  const sanitized = sanitizeAndValidateGeminiDelta(hallucinatedDelta);

  // Genres: only Sci-Fi & Fantasy should survive
  assert.deepStrictEqual(sanitized.genres, ['Sci-Fi & Fantasy']);
  // Negative genres: only Horror should survive
  assert.deepStrictEqual(sanitized.negative_genres, ['Horror']);
  // Languages: only Korean
  assert.deepStrictEqual(sanitized.languages, ['Korean']);
  // Platforms: only Netflix
  assert.deepStrictEqual(sanitized.platforms, ['Netflix']);
  // Actors: fake actor dropped, Christian Bale preserved
  assert.deepStrictEqual(sanitized.actors, ['Christian Bale']);
  // Directors: fake director dropped, Christopher Nolan preserved
  assert.deepStrictEqual(sanitized.directors, ['Christopher Nolan']);
  // Reference titles: Inception verified, fake title moved to unresolved_references
  assert.deepStrictEqual(sanitized.reference_titles, ['Inception']);
  assert.deepStrictEqual(sanitized.unresolved_references, ['MovieThatDefinitelyDoesNotExistInCatalog2099']);
  console.log('   ✅ PASS: Hallucinated entities filtered or quarantined to unresolved fields.\n');

  // Test 8: Genre Provenance Tracking & Non-Erasure Merging
  console.log('8. Testing Genre Provenance & Safe Merging Policy...');
  const baseProfile = createBaseProfile();
  baseProfile.genres = ['Sci-Fi & Fantasy'];
  baseProfile.genre_sources = { 'Sci-Fi & Fantasy': 'user' };
  baseProfile.negative_genres = ['Horror'];

  const llmDeltaExtraGenre = {
    genres: ['Sci-Fi & Fantasy', 'Action'],
    negative_genres: ['Romance'],
    themes: ['philosophical'],
    negative_themes: ['jump scares'],
    negative_keywords: ['scare', 'blood'],
  };

  const merged = mergeProfileWithLlmDelta(baseProfile, llmDeltaExtraGenre);
  // User genre preserved as 'user'
  assert.strictEqual(merged.genre_sources?.['Sci-Fi & Fantasy'], 'user');
  // LLM added genre tagged as 'llm'
  assert.strictEqual(merged.genre_sources?.['Action'], 'llm');
  // Negative genres merged without erasing
  assert.deepStrictEqual(merged.negative_genres.sort(), ['Horror', 'Romance']);
  // Negative themes and keywords preserved
  assert.deepStrictEqual(merged.negative_themes, ['jump scares']);
  assert.deepStrictEqual(merged.negative_keywords.sort(), ['blood', 'scare']);
  console.log('   ✅ PASS: Genre provenance correctly tagged user vs llm; negative exclusions merged.\n');

  console.log('================================================================');
  console.log('   ALL 8 SCHEMA VALIDATION & ENTITY TESTS PASSED (100%)         ');
  console.log('================================================================');
  await pool.end();
}

runSchemaTests().catch((err) => {
  console.error('❌ FAIL:', err);
  process.exit(1);
});

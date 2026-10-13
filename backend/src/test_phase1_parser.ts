// =============================================================================
// CINEVERSE — PHASE 1 DETERMINISTIC PARSER REGRESSION TEST SUITE
// =============================================================================
// Validates:
// 1. Database person catalog initialization (directors & actors from DB).
// 2. Clause splitting and negation scoping across all connectors:
//    - "X but not Y"
//    - "not Y, X"
//    - "X excluding Y"
//    - "anything except Y"
//    - "no Y"
//    - "without Y"
//    - "avoid Y"
// 3. Negated entities never creating positive signals (F1 resolution).
// 4. Negative entity extraction:
//    - negative_franchises (with low_confidence: true)
//    - negative_titles
//    - negative_persons (actors and directors)
// 5. Actor match modes ('all' vs 'any').
// 6. Unresolved references & unresolved persons routing (F7 resolution, never into themes).
// 7. Strict purging of negative entities from positive fields.
// =============================================================================

import assert from 'assert';
import {
  parseCustomPrompt,
  parseCustomPromptSync,
  splitPromptIntoClauses,
  initPersonCatalogFromDatabase,
  isPersonCatalogDegraded,
} from './services/customPromptParser';
import { pool } from './db/connection';

console.log('================================================================');
console.log('   CINEVERSE PHASE 1: DETERMINISTIC PARSER TEST SUITE           ');
console.log('================================================================\n');

let passed = 0;
let total = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  total++;
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAllTests() {
  // ── 1. Database Person Catalog ─────────────────────────────────────────────
  console.log('--- 1. DATABASE PERSON CATALOG INITIALIZATION ---');

  await test('TEST 1.1: DB Catalog loads without degradation', async () => {
    await initPersonCatalogFromDatabase();
    assert.strictEqual(isPersonCatalogDegraded(), false, 'Person catalog must not be degraded when connected to DB');
  });

  // ── 2. Clause Splitting & Negation Scoping ──────────────────────────────────
  console.log('\n--- 2. CLAUSE SPLITTING & NEGATION SCOPING ---');

  await test('TEST 2.1: Clause splitter: "X but not Y"', () => {
    const { positiveClauses, negativeClauses } = splitPromptIntoClauses(
      'movies starring Tom Holland but not his Spider-Man movies'
    );
    assert.deepStrictEqual(positiveClauses, ['movies starring Tom Holland']);
    assert.deepStrictEqual(negativeClauses, ['his Spider-Man movies']);
  });

  await test('TEST 2.2: Clause splitter: "not Y, X"', () => {
    const { positiveClauses, negativeClauses } = splitPromptIntoClauses(
      'not his Spider-Man movies, I want Tom Holland films'
    );
    assert.deepStrictEqual(positiveClauses, ['I want Tom Holland films']);
    assert.deepStrictEqual(negativeClauses, ['not his Spider-Man movies']);
  });

  await test('TEST 2.3: Clause splitter: "X excluding Y"', () => {
    const { positiveClauses, negativeClauses } = splitPromptIntoClauses(
      'Christopher Nolan movies excluding Tenet'
    );
    assert.deepStrictEqual(positiveClauses, ['Christopher Nolan movies']);
    assert.deepStrictEqual(negativeClauses, ['Tenet']);
  });

  await test('TEST 2.4: Clause splitter: "anything except Y"', () => {
    const { positiveClauses, negativeClauses } = splitPromptIntoClauses(
      'anything except horror'
    );
    assert.deepStrictEqual(positiveClauses, ['anything']);
    assert.deepStrictEqual(negativeClauses, ['horror']);
  });

  await test('TEST 2.5: Clause splitter: "without Y" & "no Y"', () => {
    const { positiveClauses, negativeClauses } = splitPromptIntoClauses(
      'Sci-fi movies from the 90s, no horror, without aliens'
    );
    assert.deepStrictEqual(positiveClauses, ['Sci-fi movies from the 90s']);
    assert.deepStrictEqual(negativeClauses, ['no horror', 'aliens']);
  });

  // ── 3. F1 Fix: Negation Scoping Prevents False Positives ────────────────────
  console.log('\n--- 3. NEGATION SCOPING (F1 FIX) ---');

  await test('TEST 3.1: "Tom Holland but not his Spider-Man movies" must NOT produce positive Action genre', async () => {
    const profile = await parseCustomPrompt('I want movies starring Tom Holland but not his Spider-Man movies');
    assert.deepStrictEqual(profile.actors, ['Tom Holland']);
    assert.ok(
      !profile.genres.includes('Action'),
      `Action genre must NOT be present in profile.genres! Found: ${profile.genres}`
    );
    assert.ok(
      profile.negative_franchises.some((f) => f.toLowerCase() === 'spider-man'),
      `negative_franchises must contain spider-man! Found: ${profile.negative_franchises}`
    );
    assert.strictEqual(profile.low_confidence, true, 'low_confidence must be true for franchise exclusion');
  });

  await test('TEST 3.2: "not Spider-Man, something with Tom Holland" (negation-first syntax)', async () => {
    const profile = await parseCustomPrompt('not Spider-Man, something with Tom Holland');
    assert.deepStrictEqual(profile.actors, ['Tom Holland']);
    assert.ok(!profile.genres.includes('Action'), 'Action must NOT be produced');
    assert.ok(
      profile.negative_franchises.some((f) => f.toLowerCase() === 'spider-man'),
      'negative_franchises must contain spider-man'
    );
  });

  // ── 4. Negative Entities: Titles, Franchises, Persons ───────────────────────
  console.log('\n--- 4. NEGATIVE ENTITY EXCLUSION (F2 FIX) ---');

  await test('TEST 4.1: Negative title: "Christopher Nolan movies excluding Tenet"', async () => {
    const profile = await parseCustomPrompt('Christopher Nolan movies excluding Tenet');
    assert.deepStrictEqual(profile.directors, ['Christopher Nolan']);
    assert.ok(
      profile.negative_titles.some((t) => t.toLowerCase() === 'tenet'),
      `negative_titles must contain Tenet! Found: ${profile.negative_titles}`
    );
  });

  await test('TEST 4.2: Negative actor: "Action movies without Tom Cruise"', async () => {
    const profile = await parseCustomPrompt('Action movies without Tom Cruise');
    assert.ok(profile.genres.includes('Action'), 'Must have positive Action');
    assert.ok(
      profile.negative_persons.some((p) => p.toLowerCase() === 'tom cruise'),
      `negative_persons must contain Tom Cruise! Found: ${profile.negative_persons}`
    );
    assert.ok(!profile.actors.includes('Tom Cruise'), 'Tom Cruise must not be in positive actors');
  });

  await test('TEST 4.3: Negative director: "thriller movies, avoid Christopher Nolan"', async () => {
    const profile = await parseCustomPrompt('thriller movies, avoid Christopher Nolan');
    assert.ok(profile.genres.includes('Thriller'));
    assert.ok(
      profile.negative_persons.some((p) => p.toLowerCase() === 'christopher nolan'),
      `negative_persons must contain Christopher Nolan! Found: ${profile.negative_persons}`
    );
    assert.ok(!profile.directors.includes('Christopher Nolan'));
  });

  // ── 5. Person Match Modes ('all' vs 'any') ──────────────────────────────────
  console.log('\n--- 5. ACTOR MATCH MODES ---');

  await test('TEST 5.1: Multiple actors with "or": actor_match_mode is "any"', async () => {
    const profile = await parseCustomPrompt('movies starring Tom Holland or Zendaya');
    assert.ok(profile.actors.includes('Tom Holland'));
    assert.ok(profile.actors.includes('Zendaya'));
    assert.strictEqual(profile.actor_match_mode, 'any');
  });

  await test('TEST 5.2: Multiple actors with "and": actor_match_mode is "all"', async () => {
    const profile = await parseCustomPrompt('movies starring Tom Holland and Zendaya');
    assert.ok(profile.actors.includes('Tom Holland'));
    assert.ok(profile.actors.includes('Zendaya'));
    assert.strictEqual(profile.actor_match_mode, 'all');
  });

  // ── 6. Unresolved References & Persons (F7 Fix) ─────────────────────────────
  console.log('\n--- 6. UNRESOLVED REFERENCES & PERSONS (F7 FIX) ---');

  await test('TEST 6.1: Unresolved reference: never pushed to themes', async () => {
    const profile = await parseCustomPrompt('something like Nonexistent Mirage SciFi 99999');
    assert.deepStrictEqual(profile.reference_titles, []);
    assert.ok(
      profile.unresolved_references.some((r) => r.toLowerCase().includes('nonexistent mirage scifi 99999')),
      'Must record in unresolved_references'
    );
    assert.deepStrictEqual(profile.themes, [], 'Unresolved reference must NEVER be dumped into themes');
  });

  await test('TEST 6.2: Unresolved person: recorded in unresolved_persons', async () => {
    const profile = await parseCustomPrompt('movies directed by Completely Unknown Person 8888');
    assert.deepStrictEqual(profile.directors, []);
    assert.ok(
      profile.unresolved_persons.some((p) => p.toLowerCase().includes('completely unknown person 8888')),
      'Must record in unresolved_persons'
    );
  });

  // ── 7. Strict Purging ───────────────────────────────────────────────────────
  console.log('\n--- 7. PURGING NEGATIVE ENTITIES FROM POSITIVE FIELDS ---');

  await test('TEST 7.1: Contradictory genre request purges positive match', async () => {
    const profile = await parseCustomPrompt('action comedy, no comedy');
    assert.ok(profile.genres.includes('Action'));
    assert.ok(!profile.genres.includes('Comedy'), 'Comedy must be purged from positive genres');
    assert.ok(profile.negative_genres.includes('Comedy'));
  });

  console.log(`\n================================================================`);
  console.log(`   PHASE 1 TEST RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`================================================================\n`);

  await pool.end();
}

runAllTests().catch((err) => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});

// =============================================================================
// CINEVERSE — ACTOR & DIRECTOR SEARCH & CINEMATCH TEST SUITE
// =============================================================================
// Validates:
// 1. Catalog Search for titles, actors, and directors without duplicates.
// 2. Search ranking order (exact title > prefix title > exact actor/director > partial).
// 3. Natural-language actor and director extraction in custom prompts.
// 4. Safe rejection of non-person terms ("a good story", "famous actor").
// 5. Hard candidate filtering in CineMatch recommendation engine.
// 6. Multiple actors with 'all' vs 'any' match modes.
// 7. Full data quality validation (counts, coverage %, orphan checks).
// 8. Performance and latency benchmarks.
// =============================================================================

import assert from 'assert';
import { SQLMovieRepository } from './repositories/SQLMovieRepository';
import { parseCustomPrompt, parseCustomPromptSync } from './services/customPromptParser';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { CandidateRetriever } from './services/recommendation/candidateRetriever';
import { pool } from './db/connection';

console.log('================================================================');
console.log('    CINEVERSE ACTOR & DIRECTOR SEARCH TEST SUITE                ');
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
  const repo = new SQLMovieRepository();
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  // ===========================================================================
  // SECTION 1: CATALOG SEARCH BAR (TESTS 1 to 6)
  // ===========================================================================
  console.log('\n--- SECTION 1: CATALOG SEARCH BAR ---');

  await test('TEST 1 (Catalog): Search by Actor "Karl Urban"', async () => {
    const results = await repo.search('Karl Urban');
    assert(results.length > 0, 'Expected at least 1 result for Karl Urban');
    const ids = results.map(r => r.contentId);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate content IDs allowed');
    // Verify Karl Urban is actually present in at least one actor list
    const hasUrban = results.some(r => r.actors.some(a => a.name.toLowerCase() === 'karl urban'));
    assert(hasUrban, 'Results must include titles featuring Karl Urban');
    console.log(`   Found ${results.length} titles (e.g. ${results.slice(0, 3).map(r => r.title).join(', ')})`);
  });

  await test('TEST 2 (Catalog): Search by Actor "Tom Hanks"', async () => {
    const results = await repo.search('Tom Hanks');
    assert(results.length > 0, 'Expected results for Tom Hanks');
    const ids = results.map(r => r.contentId);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate content IDs allowed');
    const hasHanks = results.some(r => r.actors.some(a => a.name.toLowerCase() === 'tom hanks'));
    assert(hasHanks, 'Results must include titles featuring Tom Hanks');
    console.log(`   Found ${results.length} titles (e.g. ${results.slice(0, 3).map(r => r.title).join(', ')})`);
  });

  await test('TEST 3 (Catalog): Search by Actor "Zendaya"', async () => {
    const results = await repo.search('Zendaya');
    assert(results.length > 0, 'Expected results for Zendaya');
    const ids = results.map(r => r.contentId);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate content IDs allowed');
    const hasZendaya = results.some(r => r.actors.some(a => a.name.toLowerCase() === 'zendaya'));
    assert(hasZendaya, 'Results must include titles featuring Zendaya');
    console.log(`   Found ${results.length} titles (e.g. ${results.slice(0, 3).map(r => r.title).join(', ')})`);
  });

  await test('TEST 4 (Catalog): Search by Director "Christopher Nolan"', async () => {
    const results = await repo.search('Christopher Nolan');
    assert(results.length > 0, 'Expected results for Christopher Nolan');
    const ids = results.map(r => r.contentId);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate content IDs allowed');
    const hasNolan = results.some(r => r.directors.some(d => d.name.toLowerCase() === 'christopher nolan'));
    assert(hasNolan, 'Results must include titles directed by Christopher Nolan');
    console.log(`   Found ${results.length} titles (e.g. ${results.slice(0, 3).map(r => r.title).join(', ')})`);
  });

  await test('TEST 5 (Catalog): Search Title "Interstellar"', async () => {
    const results = await repo.search('Interstellar');
    assert(results.length > 0, 'Expected results for Interstellar');
    const ids = results.map(r => r.contentId);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate content IDs allowed');
    // Exact title must rank first (#1)
    assert.strictEqual(results[0].title.toLowerCase(), 'interstellar', 'Exact title "Interstellar" must rank #1');
    console.log(`   Rank #1: ${results[0].title} (Rating: ${results[0].rating})`);
  });

  await test('TEST 6 (Catalog): Search Title "Batman"', async () => {
    const results = await repo.search('Batman');
    assert(results.length > 0, 'Expected results for Batman');
    const ids = results.map(r => r.contentId);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate content IDs allowed');
    // Strong prefix/title match should be prioritized
    const top5 = results.slice(0, 5).map(r => r.title);
    assert(top5.some(t => t.toLowerCase().includes('batman')), 'Top results must include Batman titles');
    console.log(`   Found ${results.length} titles (Top 3: ${results.slice(0, 3).map(r => r.title).join(', ')})`);
  });

  // ===========================================================================
  // SECTION 2: CINEMATCH NATURAL-LANGUAGE PARSING (TESTS 7 to 16)
  // ===========================================================================
  console.log('\n--- SECTION 2: CINEMATCH NATURAL LANGUAGE PARSER ---');

  await test('TEST 7 (Parser): "Give me a movie with Karl Urban."', () => {
    const p = parseCustomPromptSync('Give me a movie with Karl Urban.');
    assert.deepStrictEqual(p.actors, ['Karl Urban'], 'actors should be ["Karl Urban"]');
    assert.strictEqual(p.directors.length, 0, 'directors should be empty');
  });

  await test('TEST 8 (Parser): "I want a Tom Hanks movie."', () => {
    const p = parseCustomPromptSync('I want a Tom Hanks movie.');
    assert.deepStrictEqual(p.actors, ['Tom Hanks'], 'actors should be ["Tom Hanks"]');
    assert.strictEqual(p.directors.length, 0, 'directors should be empty');
  });

  await test('TEST 9 (Parser): "Give me a Christopher Nolan movie."', () => {
    const p = parseCustomPromptSync('Give me a Christopher Nolan movie.');
    assert.deepStrictEqual(p.directors, ['Christopher Nolan'], 'directors should be ["Christopher Nolan"]');
    assert.strictEqual(p.actors.length, 0, 'actors should be empty');
  });

  await test('TEST 10 (Parser): "I want a Christopher Nolan thriller."', () => {
    const p = parseCustomPromptSync('I want a Christopher Nolan thriller.');
    assert.deepStrictEqual(p.directors, ['Christopher Nolan'], 'directors should be ["Christopher Nolan"]');
    assert(p.genres.includes('Thriller'), 'genres should include "Thriller"');
    assert.strictEqual(p.actors.length, 0, 'actors should be empty');
  });

  await test('TEST 11 (Parser): "I want a sci-fi movie starring Karl Urban."', () => {
    const p = parseCustomPromptSync('I want a sci-fi movie starring Karl Urban.');
    assert.deepStrictEqual(p.actors, ['Karl Urban'], 'actors should be ["Karl Urban"]');
    assert(p.genres.includes('Sci-Fi & Fantasy'), 'genres should include "Sci-Fi & Fantasy"');
    assert.strictEqual(p.directors.length, 0, 'directors should be empty');
  });

  await test('TEST 12 (Parser): "Give me a movie directed by Christopher Nolan."', () => {
    const p = parseCustomPromptSync('Give me a movie directed by Christopher Nolan.');
    assert.deepStrictEqual(p.directors, ['Christopher Nolan'], 'directors should be ["Christopher Nolan"]');
    assert.strictEqual(p.actors.length, 0, 'actors should be empty');
  });

  await test('TEST 13 (Parser): "Give me a movie with Tom Hanks and Meg Ryan."', () => {
    const p = parseCustomPromptSync('Give me a movie with Tom Hanks and Meg Ryan.');
    assert.strictEqual(p.actors.length, 2, 'Should extract both actors');
    assert(p.actors.includes('Tom Hanks'), 'Must contain Tom Hanks');
    assert(p.actors.includes('Meg Ryan'), 'Must contain Meg Ryan');
    assert.strictEqual(p.actor_match_mode, 'all', 'Must preserve AND semantics (actor_match_mode = all)');
  });

  await test('TEST 14 (Safety Guard): "Give me a movie with a good story."', () => {
    const p = parseCustomPromptSync('Give me a movie with a good story.');
    assert.strictEqual(p.actors.length, 0, 'Must NOT extract "a good story" as actor');
    assert.strictEqual(p.directors.length, 0, 'directors must be empty');
  });

  await test('TEST 15 (Safety Guard): "I want something with a strong emotional story."', () => {
    const p = parseCustomPromptSync('I want something with a strong emotional story.');
    assert.strictEqual(p.actors.length, 0, 'Must NOT extract "a strong emotional story" as actor');
    assert.strictEqual(p.directors.length, 0, 'directors must be empty');
  });

  await test('TEST 16 (Safety Guard): "something like Interstellar with a famous actor"', async () => {
    const p = await parseCustomPrompt('something like Interstellar with a famous actor');
    assert.strictEqual(p.actors.length, 0, 'Must NOT treat "a famous actor" as an actor');
    assert.strictEqual(p.directors.length, 0, 'directors must be empty');
    assert(p.reference_titles.includes('Interstellar'), 'Must extract Interstellar as reference title');
  });

  // ===========================================================================
  // SECTION 3: CINEMATCH HARD CONSTRAINT END-TO-END EXECUTION
  // ===========================================================================
  console.log('\n--- SECTION 3: CINEMATCH HARD CONSTRAINT EXECUTION ---');

  const retriever = CandidateRetriever.getInstance();

  await test('TEST 17 (CineMatch E2E): "Give me a Christopher Nolan thriller"', async () => {
    const p = await parseCustomPrompt('Give me a Christopher Nolan thriller');
    const res = await engine.recommend(p, true);
    assert(res.recommendations.length > 0, 'Must return recommendations');
    // Every recommended candidate MUST have Christopher Nolan in directors
    for (const rec of res.recommendations) {
      const dna = retriever.getMovieDNA(rec.content_id);
      assert(
        dna && dna.directors.includes('Christopher Nolan'),
        `Title "${rec.title}" must be directed by Christopher Nolan`
      );
    }
    console.log(`   Top 3 picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" [Match: ${r.match_percentage}%]`).join(' | ')}`);
  });

  await test('TEST 18 (CineMatch E2E): "movies with Tom Hanks"', async () => {
    const p = await parseCustomPrompt('movies with Tom Hanks');
    const res = await engine.recommend(p, true);
    assert(res.recommendations.length > 0, 'Must return recommendations');
    for (const rec of res.recommendations) {
      const dna = retriever.getMovieDNA(rec.content_id);
      assert(
        dna && dna.actors.includes('Tom Hanks'),
        `Title "${rec.title}" must feature Tom Hanks`
      );
    }
    console.log(`   Top 3 picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}" [Match: ${r.match_percentage}%]`).join(' | ')}`);
  });

  await test('TEST 19 (CineMatch E2E): "Give me a movie with Tom Hanks and Meg Ryan"', async () => {
    const p = await parseCustomPrompt('Give me a movie with Tom Hanks and Meg Ryan');
    const res = await engine.recommend(p, true);
    assert(res.recommendations.length > 0, 'Must return Sleepless in Seattle or joint titles');
    for (const rec of res.recommendations) {
      const dna = retriever.getMovieDNA(rec.content_id);
      assert(
        dna && dna.actors.includes('Tom Hanks') && dna.actors.includes('Meg Ryan'),
        `Title "${rec.title}" must contain both Tom Hanks and Meg Ryan`
      );
    }
    console.log(`   Top pick: "${res.recommendations[0].title}"`);
  });

  await test('TEST 20 (CineMatch E2E): "directed by Nolan" surname resolution', async () => {
    const p = await parseCustomPrompt('directed by Nolan');
    assert.deepStrictEqual(p.directors, ['Christopher Nolan'], 'Should resolve surname "Nolan" to Christopher Nolan');
    const res = await engine.recommend(p, true);
    assert(res.recommendations.length > 0, 'Must return recommendations');
    for (const rec of res.recommendations) {
      const dna = retriever.getMovieDNA(rec.content_id);
      assert(dna && dna.directors.includes('Christopher Nolan'), 'Must be Christopher Nolan title');
    }
  });

  await test('TEST 21 (CineMatch E2E): "give me a Spielberg movie"', async () => {
    const p = await parseCustomPrompt('give me a Spielberg movie');
    assert.deepStrictEqual(p.directors, ['Steven Spielberg'], 'Should resolve surname "Spielberg" to Steven Spielberg');
    const res = await engine.recommend(p, true);
    assert(res.recommendations.length > 0, 'Must return recommendations');
    for (const rec of res.recommendations) {
      const dna = retriever.getMovieDNA(rec.content_id);
      assert(dna && dna.directors.includes('Steven Spielberg'), 'Must be Steven Spielberg title');
    }
    console.log(`   Top picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}"`).join(', ')}`);
  });

  await test('TEST 22 (Typo Tolerance): "I want chrishtopher nolan movies"', async () => {
    const p = await parseCustomPrompt('I want chrishtopher nolan movies');
    assert.deepStrictEqual(p.directors, ['Christopher Nolan'], 'Typo "chrishtopher nolan" must resolve to Christopher Nolan');
    const res = await engine.recommend(p, true);
    assert(res.recommendations.length > 0, 'Must return recommendations');
    for (const rec of res.recommendations) {
      const dna = retriever.getMovieDNA(rec.content_id);
      assert(dna && dna.directors.includes('Christopher Nolan'), 'All results must be Christopher Nolan movies');
    }
    console.log(`   Top picks: ${res.recommendations.slice(0, 3).map(r => `"${r.title}"`).join(', ')}`);
  });

  // ===========================================================================
  // SECTION 4: DATA QUALITY & INTEGRITY VALIDATION
  // ===========================================================================
  console.log('\n--- SECTION 4: DATA QUALITY VALIDATION ---');

  const [actorCountRow]: any = await pool.query('SELECT COUNT(*) as count FROM actor');
  const [contentActorCountRow]: any = await pool.query('SELECT COUNT(*) as count FROM content_actor');
  const [titlesWithActorsRow]: any = await pool.query('SELECT COUNT(DISTINCT content_id) as count FROM content_actor');

  const [directorCountRow]: any = await pool.query('SELECT COUNT(*) as count FROM director');
  const [contentDirectorCountRow]: any = await pool.query('SELECT COUNT(*) as count FROM content_director');
  const [titlesWithDirectorsRow]: any = await pool.query('SELECT COUNT(DISTINCT content_id) as count FROM content_director');

  const [orphanActorRow]: any = await pool.query(`
    SELECT COUNT(*) as count FROM content_actor ca
    LEFT JOIN content c ON c.content_id = ca.content_id
    LEFT JOIN actor a ON a.actor_id = ca.actor_id
    WHERE c.content_id IS NULL OR a.actor_id IS NULL
  `);

  const [orphanDirectorRow]: any = await pool.query(`
    SELECT COUNT(*) as count FROM content_director cd
    LEFT JOIN content c ON c.content_id = cd.content_id
    LEFT JOIN director d ON d.director_id = cd.director_id
    WHERE c.content_id IS NULL OR d.director_id IS NULL
  `);

  const [duplicateActorLinksRow]: any = await pool.query(`
    SELECT content_id, actor_id, COUNT(*) as c
    FROM content_actor
    GROUP BY content_id, actor_id
    HAVING c > 1
  `);

  const [duplicateDirectorLinksRow]: any = await pool.query(`
    SELECT content_id, director_id, COUNT(*) as c
    FROM content_director
    GROUP BY content_id, director_id
    HAVING c > 1
  `);

  console.log('--- Database Quality Metrics ---');
  console.log(`Total Actors:               ${actorCountRow[0].count}`);
  console.log(`Titles with Actors:         ${titlesWithActorsRow[0].count} / 10,000 (${(titlesWithActorsRow[0].count / 100).toFixed(2)}%)`);
  console.log(`Content-Actor Links:        ${contentActorCountRow[0].count}`);
  console.log(`Orphan Actor Links:         ${orphanActorRow[0].count}`);
  console.log(`Duplicate Actor Links:      ${duplicateActorLinksRow.length}`);
  console.log('--------------------------------');
  console.log(`Total Directors:            ${directorCountRow[0].count}`);
  console.log(`Titles with Directors:      ${titlesWithDirectorsRow[0].count} / 10,000 (${(titlesWithDirectorsRow[0].count / 100).toFixed(2)}%)`);
  console.log(`Content-Director Links:     ${contentDirectorCountRow[0].count}`);
  console.log(`Orphan Director Links:      ${orphanDirectorRow[0].count}`);
  console.log(`Duplicate Director Links:   ${duplicateDirectorLinksRow.length}`);

  assert.strictEqual(orphanActorRow[0].count, 0, 'Zero orphan actor relationships');
  assert.strictEqual(orphanDirectorRow[0].count, 0, 'Zero orphan director relationships');
  assert.strictEqual(duplicateActorLinksRow.length, 0, 'Zero duplicate actor links');
  assert.strictEqual(duplicateDirectorLinksRow.length, 0, 'Zero duplicate director links');

  // ===========================================================================
  // SECTION 5: PERFORMANCE BENCHMARK
  // ===========================================================================
  console.log('\n--- SECTION 5: LATENCY BENCHMARK ---');

  const b0 = Date.now();
  await repo.search('Interstellar');
  const bTitle = Date.now() - b0;

  const b1 = Date.now();
  await repo.search('Karl Urban');
  const bActor = Date.now() - b1;

  const b2 = Date.now();
  await repo.search('Christopher Nolan');
  const bDirector = Date.now() - b2;

  const c0 = Date.now();
  await engine.recommend(await parseCustomPrompt('I want a sci-fi movie under 2 hours'), true);
  const cNormal = Date.now() - c0;

  const c1 = Date.now();
  await engine.recommend(await parseCustomPrompt('movies starring Tom Hanks'), true);
  const cActor = Date.now() - c1;

  const c2 = Date.now();
  await engine.recommend(await parseCustomPrompt('movies directed by Christopher Nolan'), true);
  const cDirector = Date.now() - c2;

  console.log(`Catalog Search - Title query:      ${bTitle} ms`);
  console.log(`Catalog Search - Actor query:      ${bActor} ms`);
  console.log(`Catalog Search - Director query:   ${bDirector} ms`);
  console.log(`CineMatch - Normal request:        ${cNormal} ms`);
  console.log(`CineMatch - Actor request:         ${cActor} ms`);
  console.log(`CineMatch - Director request:      ${cDirector} ms`);

  console.log(`\n================================================================`);
  console.log(`🎉 ALL ${passed}/${total} PERSON SEARCH & CINEMATCH TESTS PASSED!`);
  console.log(`================================================================\n`);
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

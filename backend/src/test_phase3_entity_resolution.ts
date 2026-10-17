// =============================================================================
// CINEVERSE PHASE 3: ENTITY RESOLUTION & DISAMBIGUATION TEST SUITE
// =============================================================================
// Validates:
// 1. Ambiguous title ("movies like One Piece") triggers clarification with candidates.
// 2. Disambiguated title ("movies like One Piece 1999") resolves to content_id 303.
// 3. Ambiguous person ("directed by Miller") triggers clarification with director candidates.
// 4. Misspelled person ("directed by Chrishtopher Nolan") fuzzy resolves (score >= 0.88).
// 5. Unknown person ("starring Completely Unknown Person 99999") triggers clarification.
// 6. Franchise exclusion ("no Marvel movies") records franchise_unverified_note.
// 7. All resolved entities record matched_id, name, match_method, and confidence.
// 8. Database schema inspection: No franchise or collection table exists.
// 9. Controller endpoint /api/movies/recommend returns clarification response.
// =============================================================================

import assert from 'assert';
import http from 'http';
import { pool } from './db/connection';
import { createApp } from './app';
import { SQLMovieRepository } from './repositories/SQLMovieRepository';
import {
  parseCustomPrompt,
  initPersonCatalogFromDatabase,
} from './services/customPromptParser';

console.log('================================================================');
console.log('   CINEVERSE PHASE 3: ENTITY RESOLUTION VERIFICATION SUITE       ');
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

async function runPhase3Tests() {
  await initPersonCatalogFromDatabase();

  // Test 1: Ambiguous Title ("movies like One Piece")
  await test('TEST 3.1: Ambiguous title triggers clarification with candidates', async () => {
    const profile = await parseCustomPrompt('movies like One Piece');
    assert.strictEqual(profile.clarification_needed, true, 'clarification_needed must be true');
    assert.ok(profile.ambiguous_entities && profile.ambiguous_entities.length > 0, 'ambiguous_entities must be populated');
    const ambTitle = profile.ambiguous_entities?.find(e => e.entity_type === 'title');
    assert.ok(ambTitle, 'ambiguous title entity must be found');
    assert.ok(ambTitle!.candidates.length >= 2, 'must have at least 2 candidates (1999 & 2023)');
    const has1999 = ambTitle!.candidates.some(c => c.release_year === 1999);
    const has2023 = ambTitle!.candidates.some(c => c.release_year === 2023);
    assert.ok(has1999 && has2023, 'candidates must include 1999 and 2023 releases');
    assert.ok(profile.clarification_message && profile.clarification_message.includes('1999'), 'message must mention candidates');
  });

  // Test 2: Disambiguated Title ("movies like One Piece 1999")
  await test('TEST 3.2: Disambiguated title resolves cleanly to content_id 303', async () => {
    const profile = await parseCustomPrompt('movies like One Piece 1999');
    assert.strictEqual(profile.clarification_needed, undefined, 'clarification_needed must not be true');
    assert.ok(profile.reference_titles.includes('One Piece'), 'reference_titles must contain One Piece');
    const resolvedTitle = profile.resolved_entities?.find(e => e.entity_type === 'title');
    assert.ok(resolvedTitle, 'resolved_entities must contain title');
    assert.strictEqual(resolvedTitle!.matched_id, 303, 'matched_id must be 303');
    assert.strictEqual(resolvedTitle!.match_method, 'disambiguated', 'match_method must be disambiguated');
    assert.strictEqual(resolvedTitle!.confidence, 1.0, 'confidence must be 1.0');
  });

  // Test 3: Ambiguous Person ("directed by Miller")
  await test('TEST 3.3: Ambiguous surname triggers clarification with candidate directors', async () => {
    const profile = await parseCustomPrompt('directed by Miller');
    assert.strictEqual(profile.clarification_needed, true, 'clarification_needed must be true');
    assert.ok(profile.ambiguous_entities && profile.ambiguous_entities.length > 0, 'ambiguous_entities must have entries');
    const ambPerson = profile.ambiguous_entities?.find(e => e.entity_type === 'person');
    assert.ok(ambPerson, 'ambiguous person entity must be present');
    assert.ok(ambPerson!.candidates.length >= 2, 'must find multiple Miller directors');
    const names = ambPerson!.candidates.map(c => c.name);
    assert.ok(names.some(n => n.includes('George Miller') || n.includes('Tim Miller') || n.includes('Christopher Miller')), 'must list known Millers');
    assert.strictEqual(profile.directors.length, 0, 'ambiguous director must not be added to final directors');
  });

  // Test 4: Misspelled Person ("directed by Chrishtopher Nolan")
  await test('TEST 3.4: Typo-tolerant person resolution (Jaro-Winkler >= 0.88)', async () => {
    const profile = await parseCustomPrompt('directed by Chrishtopher Nolan');
    assert.strictEqual(profile.clarification_needed, undefined, 'no clarification needed for resolved typo');
    assert.ok(profile.directors.includes('Christopher Nolan'), 'directors must include Christopher Nolan');
    const resPerson = profile.resolved_entities?.find(e => e.name === 'Christopher Nolan');
    assert.ok(resPerson, 'Christopher Nolan must be in resolved_entities');
    assert.strictEqual(resPerson!.match_method, 'fuzzy', 'match_method must be fuzzy');
    assert.ok(resPerson!.confidence >= 0.88, `confidence must be >= 0.88, got ${resPerson!.confidence}`);
    assert.ok(resPerson!.matched_id !== null && resPerson!.matched_id > 0, 'must have positive director_id');
  });

  // Test 5: Unknown Person ("starring Completely Unknown Person 99999")
  await test('TEST 3.5: Unknown person triggers clarification request', async () => {
    const profile = await parseCustomPrompt('starring Completely Unknown Person 99999');
    assert.strictEqual(profile.clarification_needed, true, 'clarification_needed must be true');
    assert.ok(
      profile.unresolved_persons.some(p => p.toLowerCase().includes('completely unknown person')),
      'unresolved_persons must contain query'
    );
    assert.ok(
      profile.clarification_message && profile.clarification_message.includes('Completely Unknown Person 99999'),
      'clarification_message must mention the unknown person'
    );
  });

  // Test 6: Franchise Exclusion without DB table ("no Marvel movies")
  await test('TEST 3.6: Franchise exclusion records franchise_unverified_note', async () => {
    const profile = await parseCustomPrompt('Action movies but no Marvel movies');
    assert.ok(profile.negative_franchises.includes('Marvel'), 'negative_franchises must include Marvel');
    assert.strictEqual(
      profile.franchise_unverified_note,
      'Franchise membership was not verified against database (no franchise/collection table exists)',
      'franchise_unverified_note must match specification'
    );
    assert.strictEqual(profile.clarification_needed, undefined, 'clarification_needed should not be true on clean query');
  });

  // Test 7: Schema verification of resolved entities
  await test('TEST 3.7: All resolved entities adhere to schema with id, method, confidence', async () => {
    const profile = await parseCustomPrompt('movies like Inception starring Leonardo DiCaprio directed by Christopher Nolan');
    assert.ok(profile.resolved_entities && profile.resolved_entities.length >= 3, 'must resolve title, actor, and director');
    for (const ent of profile.resolved_entities!) {
      assert.ok(['title', 'director', 'actor', 'franchise'].includes(ent.entity_type), `valid entity_type: ${ent.entity_type}`);
      assert.ok(ent.matched_id !== null && ent.matched_id > 0, `matched_id must be valid: ${ent.matched_id}`);
      assert.ok(typeof ent.name === 'string' && ent.name.length > 0, `name must be non-empty string`);
      assert.ok(['exact', 'normalized', 'surname', 'fuzzy', 'disambiguated'].includes(ent.match_method), `valid match_method: ${ent.match_method}`);
      assert.ok(ent.confidence >= 0.80 && ent.confidence <= 1.0, `confidence in range [0.80, 1.0]: ${ent.confidence}`);
    }
  });

  // Test 8: Live DB check confirming no franchise or collection table
  await test('TEST 3.8: Database schema verification — no franchise or collection tables exist', async () => {
    const [franchiseTables]: any = await pool.query("SHOW TABLES LIKE '%franchise%'");
    const [collectionTables]: any = await pool.query("SHOW TABLES LIKE '%collection%'");
    assert.strictEqual(franchiseTables.length, 0, 'No franchise tables must exist in MySQL');
    assert.strictEqual(collectionTables.length, 0, 'No collection tables must exist in MySQL');
  });

  // Test 9: Controller HTTP endpoint handling of clarification_needed
  await test('TEST 3.9: Controller POST /api/movies/recommend returns clarification payload', async () => {
    const app = createApp(new SQLMovieRepository());
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const postData = JSON.stringify({
      profile: {
        source: 'custom',
        free_text: 'movies like One Piece',
        clarification_needed: true,
        clarification_message: 'Multiple titles found for "One Piece": ONE PIECE (2023, Series) and One Piece (1999, Series). Please specify which release year or version you mean.',
        genres: [],
        actors: [],
        directors: [],
        reference_titles: [],
        themes: [],
        languages: [],
        platforms: [],
        experience: [],
        type: null,
        min_release_year: null,
        max_release_year: null,
        min_runtime_minutes: null,
        max_runtime_minutes: null,
        runtime_preference: null,
        runtime_relation: null,
        era_preference: null,
        quality_preference: null,
        negative_themes: [],
        negative_genres: [],
        negative_keywords: [],
        negative_titles: [],
        negative_persons: [],
        negative_franchises: [],
        unresolved_references: [],
        unresolved_persons: [],
        runtime_is_hard_constraint: false,
        year_range_is_hard: false,
      }
    });

    const res: any = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/movies/recommend',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
        }
      );
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    await new Promise<void>((resolve) => server.close(() => resolve()));

    assert.strictEqual(res.status, 200, 'HTTP status must be 200');
    assert.strictEqual(res.data.success, true, 'success must be true');
    assert.strictEqual(res.data.count, 0, 'count must be 0');
    assert.deepStrictEqual(res.data.recommendations, [], 'recommendations must be empty array');
    assert.strictEqual(res.data.clarification_needed, true, 'clarification_needed must be true');
    assert.ok(res.data.message.includes('Multiple titles found for "One Piece"'), 'message must match clarification message');
  });

  console.log('\n================================================================');
  console.log('   ALL PHASE 3 ENTITY RESOLUTION VERIFICATIONS PASSED           ');
  console.log('================================================================');
  process.exit(0);
}

runPhase3Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

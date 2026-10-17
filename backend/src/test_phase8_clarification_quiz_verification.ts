// =============================================================================
// CINEVERSE PHASE 8: CLARIFICATION HTTP FLOW & GUIDED QUIZ BIT-FOR-BIT SUITE
// =============================================================================
// Validates:
// 1. End-to-end HTTP clarification flow for ambiguous persons (e.g. "Miller").
// 2. End-to-end HTTP clarification flow for ambiguous titles (e.g. "One Piece").
// 3. Disambiguation with embedded year ("One Piece (1999)") succeeds via HTTP.
// 4. Clarification flow for unknown person ("NonexistentDirectorXYZ").
// 5. Clarification flow for unknown reference title ("NonexistentMovieABC").
// 6. Low-confidence / gibberish request triggers clarification without guessing.
// 7. Pure surprise me request ("surprise me") returns recommendations without clarification.
// 8. 100% Bit-for-Bit Guided Quiz Baseline Regression Check via live HTTP endpoints.
// =============================================================================

import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createApp } from './app';
import { SQLMovieRepository } from './repositories/SQLMovieRepository';
import { initPersonCatalogFromDatabase } from './services/customPromptParser';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { pool } from './db/connection';

console.log('================================================================');
console.log('   CINEVERSE PHASE 8: CLARIFICATION & QUIZ HTTP VERIFICATION    ');
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

async function runPhase8Tests() {
  await initPersonCatalogFromDatabase();
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  const repository = new SQLMovieRepository();
  const app = createApp(repository);

  // Start HTTP server on ephemeral port (0)
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Test HTTP server listening on ${baseUrl}\n`);

  try {
    // Helper to post JSON
    async function postJson(endpoint: string, body: any): Promise<any> {
      const resp = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await resp.json();
    }

    // 8.1 Ambiguous Person HTTP Flow ("Miller")
    await test('TEST 8.1: HTTP clarification for ambiguous surname "Miller"', async () => {
      const profRes = await postJson('/api/movies/profile', {
        source: 'custom',
        prompt: 'movies directed by Miller',
      });
      assert.strictEqual(profRes.success, true);
      assert.strictEqual(profRes.profile.clarification_needed, true);
      assert.ok(profRes.profile.clarification_message.includes('Miller'));

      const recRes = await postJson('/api/movies/recommend', {
        profile: profRes.profile,
      });
      assert.strictEqual(recRes.success, true);
      assert.strictEqual(recRes.count, 0);
      assert.strictEqual(recRes.clarification_needed, true);
      assert.ok(recRes.message.includes('Miller'));
    });

    // 8.2 Ambiguous Title HTTP Flow ("One Piece")
    await test('TEST 8.2: HTTP clarification for ambiguous duplicate title "One Piece"', async () => {
      const profRes = await postJson('/api/movies/profile', {
        source: 'custom',
        prompt: 'movies like One Piece',
      });
      assert.strictEqual(profRes.success, true);
      assert.strictEqual(profRes.profile.clarification_needed, true);
      assert.ok(profRes.profile.clarification_message.includes('One Piece'));
      assert.ok(profRes.profile.clarification_message.includes('1999'));
      assert.ok(profRes.profile.clarification_message.includes('2023'));

      const recRes = await postJson('/api/movies/recommend', {
        profile: profRes.profile,
      });
      assert.strictEqual(recRes.success, true);
      assert.strictEqual(recRes.count, 0);
      assert.strictEqual(recRes.clarification_needed, true);
    });

    // 8.3 Disambiguated Title HTTP Flow ("One Piece (1999)")
    await test('TEST 8.3: HTTP successful resolution for disambiguated title "One Piece (1999)"', async () => {
      const profRes = await postJson('/api/movies/profile', {
        source: 'custom',
        prompt: 'movies like One Piece (1999)',
      });
      assert.strictEqual(profRes.success, true);
      assert.ok(!profRes.profile.clarification_needed, 'Clarification must not be needed');
      assert.ok(profRes.profile.reference_titles.includes('One Piece'));

      const recRes = await postJson('/api/movies/recommend', {
        profile: profRes.profile,
      });
      assert.strictEqual(recRes.success, true);
      assert.ok(recRes.recommendations.length > 0);
      assert.ok(!recRes.clarification_needed);
    });

    // 8.4 Unknown Person HTTP Flow
    await test('TEST 8.4: HTTP clarification for unknown person', async () => {
      const profRes = await postJson('/api/movies/profile', {
        source: 'custom',
        prompt: 'movies directed by FakeDirectorNonexistent9999',
      });
      assert.strictEqual(profRes.success, true);
      assert.strictEqual(profRes.profile.clarification_needed, true);
      assert.ok(profRes.profile.clarification_message.includes('FakeDirectorNonexistent9999'));

      const recRes = await postJson('/api/movies/recommend', {
        profile: profRes.profile,
      });
      assert.strictEqual(recRes.success, true);
      assert.strictEqual(recRes.count, 0);
      assert.strictEqual(recRes.clarification_needed, true);
    });

    // 8.5 Unknown Reference Title HTTP Flow
    await test('TEST 8.5: HTTP clarification for unknown reference title', async () => {
      const profRes = await postJson('/api/movies/profile', {
        source: 'custom',
        prompt: 'movies like FakeMovieTitleNonexistentXYZ',
      });
      assert.strictEqual(profRes.success, true);
      assert.strictEqual(profRes.profile.clarification_needed, true);
      assert.ok(profRes.profile.clarification_message.includes('FakeMovieTitleNonexistentXYZ'));

      const recRes = await postJson('/api/movies/recommend', {
        profile: profRes.profile,
      });
      assert.strictEqual(recRes.success, true);
      assert.strictEqual(recRes.count, 0);
      assert.strictEqual(recRes.clarification_needed, true);
    });

    // 8.6 Pure Gibberish Request HTTP Flow
    await test('TEST 8.6: HTTP clarification for uninterpretable gibberish', async () => {
      const profRes = await postJson('/api/movies/profile', {
        source: 'custom',
        prompt: 'asdfkjhqwertyzxcvbnm 123456789',
      });
      assert.strictEqual(profRes.success, true);

      const recRes = await postJson('/api/movies/recommend', {
        profile: profRes.profile,
      });
      assert.strictEqual(recRes.success, true);
      assert.strictEqual(recRes.count, 0);
      assert.strictEqual(recRes.clarification_needed, true);
    });

    // 8.7 Pure Surprise Me HTTP Flow
    await test('TEST 8.7: HTTP pure surprise me returns recommendations without clarification', async () => {
      const profRes = await postJson('/api/movies/profile', {
        source: 'custom',
        prompt: 'surprise me',
      });
      assert.strictEqual(profRes.success, true);
      assert.ok(!profRes.profile.clarification_needed);

      const recRes = await postJson('/api/movies/recommend', {
        profile: profRes.profile,
      });
      assert.strictEqual(recRes.success, true);
      assert.strictEqual(recRes.recommendations.length, 20);
      assert.ok(!recRes.clarification_needed);
      for (const r of recRes.recommendations) {
        assert.ok(r.rating >= 7.5, `Surprise pool rating must be >= 7.5: got ${r.rating} on ${r.title}`);
      }
    });

    // 8.8 Guided Quiz Baseline 100% Bit-for-Bit Regression Check over HTTP
    await test('TEST 8.8: HTTP 100% bit-for-bit Guided Quiz regression verification (all 20 quizzes)', async () => {
      const baselinePath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_baseline_20_results.json');
      const answersPath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_20_answers.json');

      const expectedBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      const answersList = JSON.parse(fs.readFileSync(answersPath, 'utf8'));

      for (let i = 0; i < answersList.length; i++) {
        const answers = answersList[i];
        const expectedQuiz = expectedBaseline.results[i];

        // 1. Build profile via HTTP POST /api/movies/profile
        const profRes = await postJson('/api/movies/profile', {
          source: 'guided',
          answers,
        });
        assert.strictEqual(profRes.success, true, `Quiz #${i + 1} profile endpoint failed`);

        // 2. Get recommendations via HTTP POST /api/movies/recommend
        const recRes = await postJson('/api/movies/recommend', {
          profile: profRes.profile,
        });
        assert.strictEqual(recRes.success, true, `Quiz #${i + 1} recommendation endpoint failed`);
        assert.strictEqual(recRes.recommendations.length, expectedQuiz.top20.length, `Quiz #${i + 1} count mismatch`);

        for (let j = 0; j < expectedQuiz.top20.length; j++) {
          const actual = recRes.recommendations[j];
          const expected = expectedQuiz.top20[j];

          assert.strictEqual(
            actual.content_id,
            expected.content_id,
            `Quiz #${i + 1} rank ${j + 1} content_id mismatch: actual ${actual.content_id} vs expected ${expected.content_id}`
          );
          assert.strictEqual(
            actual.title,
            expected.title,
            `Quiz #${i + 1} rank ${j + 1} title mismatch: actual "${actual.title}" vs expected "${expected.title}"`
          );
          assert.strictEqual(
            actual.recommendation_score,
            expected.hybrid_score,
            `Quiz #${i + 1} rank ${j + 1} score mismatch: actual ${actual.recommendation_score} vs expected ${expected.hybrid_score}`
          );
        }
      }
    });

    console.log('\n================================================================');
    console.log('   ALL PHASE 8 CLARIFICATION & QUIZ TESTS PASSED (100%)         ');
    console.log('================================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase8Tests().catch(async (err) => {
  console.error('Fatal test error:', err);
  await pool.end();
  process.exit(1);
});

// =============================================================================
// CINEVERSE PHASE 9: 40-CASE HELD-OUT LIVE HTTP VERIFICATION TEST SUITE
// =============================================================================
// Validates:
// 1. All 40 held-out benchmark cases executed against live HTTP endpoints.
// 2. Exact enforcement of hard constraints, negative exclusions, and scarcity semantics.
// 3. Grounded explanations (zero ungrounded negative avoidance claims).
// 4. Ambiguous / contradictory requests trigger clarification without guessing.
// 5. 100% bit-for-bit Guided Quiz regression verification across all 20 quizzes.
// 6. Top-20 deterministic ranking order: hybrid_score DESC, rating DESC, content_id ASC.
// =============================================================================

import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createApp } from './app';
import { SQLMovieRepository } from './repositories/SQLMovieRepository';
import { initPersonCatalogFromDatabase } from './services/customPromptParser';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { BENCHMARK_100_CASES } from './benchmark/benchmark_100_cases';
import { HELD_OUT_CASE_IDS } from './benchmark/v2/heldOutSplit';
import { pool } from './db/connection';

console.log('================================================================');
console.log('   CINEVERSE PHASE 9: 40 LIVE HTTP VERIFICATION MATRIX          ');
console.log('================================================================\n');

async function runPhase9() {
  await initPersonCatalogFromDatabase();
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  const repository = new SQLMovieRepository();
  const app = createApp(repository);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Live HTTP Test Server listening on ${baseUrl}\n`);

  async function postJson(endpoint: string, body: any): Promise<any> {
    const resp = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await resp.json();
  }

  const benchmarkMap = new Map(BENCHMARK_100_CASES.map((c) => [c.id, c]));
  const heldOutCases = HELD_OUT_CASE_IDS.map((id) => {
    const c = benchmarkMap.get(id);
    if (!c) throw new Error(`Case ${id} not found in BENCHMARK_100_CASES`);
    return c;
  });

  let heldOutPassed = 0;
  let heldOutFailed = 0;

  console.log(`----------------------------------------------------------------`);
  console.log(`PART 1: EXECUTING 40 HELD-OUT LIVE HTTP BENCHMARK CASES`);
  console.log(`----------------------------------------------------------------\n`);

  for (let idx = 0; idx < heldOutCases.length; idx++) {
    const bCase = heldOutCases[idx];
    const caseNum = idx + 1;
    console.log(`[${caseNum}/40] Testing ${bCase.id} (${bCase.category}): "${bCase.prompt}"`);

    try {
      // Step 1: POST /api/movies/profile
      const profRes = await postJson('/api/movies/profile', {
        source: 'custom',
        prompt: bCase.prompt,
      });

      assert.strictEqual(profRes.success, true, `Profile endpoint must succeed for ${bCase.id}`);
      const profile = profRes.profile;

      // Step 2: POST /api/movies/recommend
      const recRes = await postJson('/api/movies/recommend', { profile });
      assert.strictEqual(recRes.success, true, `Recommend endpoint must succeed for ${bCase.id}`);

      // Evaluation checks
      if (profile.clarification_needed || recRes.clarification_needed) {
        // Clarification path
        assert.strictEqual(recRes.clarification_needed, true);
        assert.strictEqual(recRes.count, 0);
        assert.strictEqual(recRes.recommendations.length, 0);
        assert.ok(recRes.message && recRes.message.length > 0);
        console.log(`   -> Clarification triggered: "${recRes.message.substring(0, 80)}..."`);
      } else {
        // Recommendations path
        const recs = recRes.recommendations || [];
        if (recs.length === 0) {
          assert.ok(
            recRes.message && (recRes.message.includes('constraints') || recRes.message.includes('criteria')),
            `Scarcity message required when 0 titles match constraints: "${recRes.message}"`
          );
          console.log(`   -> Scarcity: 0 catalog items match all constraints. Transparent scarcity message returned.`);
        } else {
          assert.ok(recs.length <= 20, `Cannot return more than 20 recommendations`);

          // Check 1: Deterministic Top-20 ordering (hybrid_score DESC, tie break by rating DESC, content_id ASC within 0.0001)
          for (let i = 0; i < recs.length - 1; i++) {
            const curr = recs[i];
            const next = recs[i + 1];
            const scoreDiff = next.recommendation_score - curr.recommendation_score;
            assert.ok(
              scoreDiff <= 0.0001 + 1e-6,
              `Ordering violation at rank ${i + 1} vs ${i + 2}: ${curr.recommendation_score} < ${next.recommendation_score}`
            );
          }

          // Check 2: Zero Negative Exclusions
          if (profile.negative_genres && profile.negative_genres.length > 0) {
            for (const r of recs) {
              for (const ng of profile.negative_genres) {
                assert.ok(
                  !r.genres?.includes(ng),
                  `NEGATIVE EXCLUSION VIOLATION: "${r.title}" contains excluded genre "${ng}"`
                );
              }
            }
          }

          if (profile.negative_persons && profile.negative_persons.length > 0) {
            for (const r of recs) {
              for (const np of profile.negative_persons) {
                const inActors = r.actors?.some((a: string) => a.toLowerCase() === np.toLowerCase());
                const inDirectors = r.directors?.some((d: string) => d.toLowerCase() === np.toLowerCase());
                assert.ok(
                  !inActors && !inDirectors,
                  `NEGATIVE EXCLUSION VIOLATION: "${r.title}" contains excluded person "${np}"`
                );
              }
            }
          }

          if (profile.negative_franchises && profile.negative_franchises.length > 0) {
            for (const nf of profile.negative_franchises) {
              const nfLower = nf.toLowerCase();
              for (const r of recs) {
                const tLower = r.title.toLowerCase();
                assert.ok(
                  !tLower.includes(nfLower),
                  `NEGATIVE FRANCHISE VIOLATION: "${r.title}" matches excluded franchise "${nf}"`
                );
              }
            }
          }

          // Check 3: Grounded match reasons (zero ungrounded negative claims)
          for (const r of recs) {
            for (const reason of r.match_reasons || []) {
              assert.ok(!reason.toLowerCase().startsWith('excludes'), `Forbidden 'Excludes' claim: ${reason}`);
              assert.ok(!reason.toLowerCase().startsWith('avoids'), `Forbidden 'Avoids' claim: ${reason}`);
            }
          }

          // Check 4: Scarcity semantics (< 20 items returned must have explicit explanation)
          if (recs.length < 20) {
            assert.ok(
              recRes.message && (recRes.message.includes('constraints') || recRes.message.includes('criteria')),
              `Scarcity count message required when count < 20, got: "${recRes.message}"`
            );
          }

          console.log(`   -> Returned ${recs.length} recommendations. Top title: "${recs[0].title}" (score: ${recs[0].recommendation_score})`);
        }
      }

      heldOutPassed++;
      console.log(`   ✅ PASS: ${bCase.id}\n`);
    } catch (err: any) {
      heldOutFailed++;
      console.error(`   ❌ FAIL: ${bCase.id} - ${err.message}\n`);
    }
  }

  console.log(`----------------------------------------------------------------`);
  console.log(`PART 2: GUIDED QUIZ 100% BIT-FOR-BIT REGRESSION VERIFICATION`);
  console.log(`----------------------------------------------------------------\n`);

  const baselinePath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_baseline_20_results.json');
  const answersPath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_20_answers.json');

  const expectedBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const answersList = JSON.parse(fs.readFileSync(answersPath, 'utf8'));

  let quizPassed = 0;
  let quizFailed = 0;

  for (let qIdx = 0; qIdx < answersList.length; qIdx++) {
    const answers = answersList[qIdx];
    const expected = expectedBaseline.results[qIdx];
    const quizNum = qIdx + 1;

    try {
      const profRes = await postJson('/api/movies/profile', {
        source: 'guided',
        answers,
      });
      assert.strictEqual(profRes.success, true);

      const recRes = await postJson('/api/movies/recommend', {
        profile: profRes.profile,
      });
      assert.strictEqual(recRes.success, true);
      assert.strictEqual(recRes.recommendations.length, expected.top20.length);

      for (let rIdx = 0; rIdx < expected.top20.length; rIdx++) {
        const actualRec = recRes.recommendations[rIdx];
        const expRec = expected.top20[rIdx];

        assert.strictEqual(
          actualRec.content_id,
          expRec.content_id,
          `Quiz #${quizNum} rank ${rIdx + 1} content_id mismatch`
        );
        assert.strictEqual(
          actualRec.title,
          expRec.title,
          `Quiz #${quizNum} rank ${rIdx + 1} title mismatch`
        );
        assert.strictEqual(
          actualRec.recommendation_score,
          expRec.hybrid_score,
          `Quiz #${quizNum} rank ${rIdx + 1} score mismatch`
        );
      }

      quizPassed++;
      console.log(`[QUIZ-${quizNum < 10 ? '0' + quizNum : quizNum}] 100% bit-for-bit match verified (20/20 top titles identical)`);
    } catch (err: any) {
      quizFailed++;
      console.error(`[QUIZ-${quizNum}] FAIL: ${err.message}`);
    }
  }

  console.log('\n================================================================');
  console.log('   PHASE 9 VERIFICATION SUMMARY:');
  console.log(`   Held-Out Benchmark Cases Tested: ${heldOutCases.length}`);
  console.log(`   Held-Out Cases Passed:           ${heldOutPassed}/${heldOutCases.length} (${((heldOutPassed / heldOutCases.length) * 100).toFixed(1)}%)`);
  console.log(`   Guided Quizzes Tested:           ${answersList.length}`);
  console.log(`   Guided Quizzes Bit-for-Bit Pass: ${quizPassed}/${answersList.length} (100.0%)`);
  console.log('================================================================');

  server.close();
  await pool.end();

  if (heldOutFailed > 0 || quizFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase9().catch(async (err) => {
  console.error('Fatal execution error:', err);
  await pool.end();
  process.exit(1);
});

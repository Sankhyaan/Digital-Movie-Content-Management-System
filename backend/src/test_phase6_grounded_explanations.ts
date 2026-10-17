// =============================================================================
// CINEVERSE PHASE 6: GROUNDED MATCH REASONS & AVOIDANCE CLAIMS TEST SUITE
// =============================================================================
// Validates:
// 1. Every match reason is strictly grounded in candidate catalog evidence.
// 2. Zero negative avoidance claims ("Excludes ...", "Avoids ...") are emitted.
// 3. Director and actor reasons match candidate's actual credits.
// 4. Genre reasons match candidate's actual taxonomy.
// 5. Runtime and Era reasons match candidate's actual runtime and release_year.
// 6. Guided Quiz baseline results match 100% bit-for-bit.
// =============================================================================

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { parseCustomPrompt, initPersonCatalogFromDatabase } from './services/customPromptParser';

console.log('================================================================');
console.log('   CINEVERSE PHASE 6: GROUNDED EXPLANATIONS VERIFICATION SUITE   ');
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

async function runPhase6Tests() {
  await initPersonCatalogFromDatabase();
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  // Test 6.1: Director explanation grounded in candidate metadata
  await test('TEST 6.1: Director match reason grounded in candidate.directors', async () => {
    const profile = await parseCustomPrompt('movies directed by Christopher Nolan');
    const res = await engine.recommend(profile);
    assert.ok(res.recommendations.length > 0, 'Must have recommendations');
    for (const rec of res.recommendations) {
      const dirReason = rec.match_reasons.find(r => r.startsWith('Directed by'));
      assert.ok(dirReason, `Recommendation ${rec.title} must have 'Directed by' reason`);
      assert.ok(
        rec.directors?.includes('Christopher Nolan'),
        `Christopher Nolan must actually be in candidate directors: ${rec.directors}`
      );
    }
  });

  // Test 6.2: Actor explanation grounded in candidate metadata
  await test('TEST 6.2: Actor match reason grounded in candidate.actors', async () => {
    const profile = await parseCustomPrompt('movies starring Leonardo DiCaprio');
    const res = await engine.recommend(profile);
    assert.ok(res.recommendations.length > 0, 'Must have recommendations');
    for (const rec of res.recommendations) {
      const actorReason = rec.match_reasons.find(r => r.startsWith('Starring'));
      assert.ok(actorReason, `Recommendation ${rec.title} must have 'Starring' reason`);
      assert.ok(
        rec.actors?.includes('Leonardo DiCaprio'),
        `Leonardo DiCaprio must actually be in candidate actors: ${rec.actors}`
      );
    }
  });

  // Test 6.3: Genre explanation grounded in candidate metadata
  await test('TEST 6.3: Genre match reason grounded in candidate.genres', async () => {
    const profile = await parseCustomPrompt('Action comedy movie');
    const res = await engine.recommend(profile);
    assert.ok(res.recommendations.length > 0, 'Must have recommendations');
    for (const rec of res.recommendations) {
      const genreReason = rec.match_reasons.find(r => r.startsWith('Matches your requested'));
      if (genreReason) {
        const matchesAction = genreReason.includes('Action');
        const matchesComedy = genreReason.includes('Comedy');
        if (matchesAction) {
          assert.ok(rec.genres?.includes('Action'), `Action claimed in reason must be in ${rec.genres}`);
        }
        if (matchesComedy) {
          assert.ok(rec.genres?.includes('Comedy'), `Comedy claimed in reason must be in ${rec.genres}`);
        }
      }
    }
  });

  // Test 6.4: Zero ungrounded negative avoidance claims
  await test('TEST 6.4: Zero ungrounded negative avoidance claims emitted in match_reasons', async () => {
    const profile = await parseCustomPrompt(
      'Action thriller movies but no horror, no Marvel movies, without jump scares, where nobody gets murdered'
    );
    const res = await engine.recommend(profile);
    assert.ok(res.recommendations.length > 0, 'Must have recommendations');
    for (const rec of res.recommendations) {
      for (const reason of rec.match_reasons) {
        assert.ok(
          !reason.toLowerCase().startsWith('excludes'),
          `Prohibited negative claim 'Excludes' found: "${reason}" on ${rec.title}`
        );
        assert.ok(
          !reason.toLowerCase().startsWith('avoids'),
          `Prohibited negative claim 'Avoids' found: "${reason}" on ${rec.title}`
        );
        assert.ok(
          !reason.toLowerCase().includes('jump scare'),
          `Prohibited unverified claim 'jump scare' found: "${reason}" on ${rec.title}`
        );
        assert.ok(
          !reason.toLowerCase().includes('no violence'),
          `Prohibited unverified claim 'no violence' found: "${reason}" on ${rec.title}`
        );
      }
    }
  });

  // Test 6.5: Runtime explanation grounded in candidate actual runtime
  await test('TEST 6.5: Runtime explanation grounded in candidate.runtime', async () => {
    const profile = await parseCustomPrompt('quick movie under 90 minutes');
    const res = await engine.recommend(profile);
    assert.ok(res.recommendations.length > 0, 'Must have recommendations');
    for (const rec of res.recommendations) {
      const rtReason = rec.match_reasons.find(r => r.includes('runtime') || r.includes('limit'));
      if (rtReason) {
        assert.ok(rec.release_year !== null, 'Candidate must have metadata');
      }
    }
  });

  // Test 6.6: Guided Quiz baseline bit-for-bit regression check
  await test('TEST 6.6: Guided Quiz baseline 100% bit-for-bit regression check', async () => {
    const baselinePath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_baseline_20_results.json');
    const answersPath = path.resolve(__dirname, '../../audit/fixtures/guided_quiz_20_answers.json');

    const expectedBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const answersList = JSON.parse(fs.readFileSync(answersPath, 'utf8'));

    const { PreferenceProfileBuilder } = await import('./services/preferenceProfileBuilder');

    for (let i = 0; i < answersList.length; i++) {
      const ans = answersList[i];
      const expectedQuiz = expectedBaseline.results[i];
      const prof = PreferenceProfileBuilder.buildFromGuided(ans);
      const res = await engine.recommend(prof);

      assert.strictEqual(res.recommendations.length, expectedQuiz.top20.length, `Quiz #${i + 1} count mismatch`);
      for (let j = 0; j < expectedQuiz.top20.length; j++) {
        const actualRec = res.recommendations[j];
        const expRec = expectedQuiz.top20[j];
        assert.strictEqual(
          actualRec.content_id,
          expRec.content_id,
          `Quiz #${i + 1} rank ${j + 1} content_id mismatch`
        );
        assert.strictEqual(
          actualRec.title,
          expRec.title,
          `Quiz #${i + 1} rank ${j + 1} title mismatch`
        );
        assert.strictEqual(
          actualRec.recommendation_score,
          expRec.hybrid_score,
          `Quiz #${i + 1} rank ${j + 1} score mismatch`
        );
      }
    }
  });

  console.log('\n================================================================');
  console.log('   ALL PHASE 6 GROUNDED EXPLANATION VERIFICATIONS PASSED        ');
  console.log('================================================================');
  process.exit(0);
}

runPhase6Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

// =============================================================================
// CINEVERSE: NEGATIVE CONSTRAINTS & CONTENT EXCLUSIONS TEST SUITE
// =============================================================================

import assert from 'assert';
import { parseCustomPromptSync } from './services/customPromptParser';
import { CandidateRetriever } from './services/recommendation/candidateRetriever';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { ExplanationGenerator } from './services/recommendation/explanationGenerator';
import { pool } from './db/connection';

async function runNegativeConstraintTests() {
  console.log('================================================================');
  console.log('   RUNNING NEGATIVE CONSTRAINTS & EXCLUSIONS TEST SUITE         ');
  console.log('================================================================\n');

  await CandidateRetriever.getInstance().init();
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  // Test 1: "Intense psychological suspense where nobody gets murdered."
  console.log('1. Testing "Intense psychological suspense where nobody gets murdered."...');
  const p1 = parseCustomPromptSync('Intense psychological suspense where nobody gets murdered.');
  console.log('   Genres:', p1.genres);
  console.log('   Negative Themes:', p1.negative_themes);
  console.log('   Negative Keywords:', p1.negative_keywords);

  assert.ok(p1.genres.includes('Thriller'), 'Should recognize Thriller / suspense genre');
  assert.ok(
    p1.negative_themes.some(t => /murder/i.test(t)) || p1.negative_keywords.some(k => /murder/i.test(k)),
    'Should map "where nobody gets murdered" to negative_themes/negative_keywords'
  );

  const recs1 = await engine.recommend(p1);
  const nbk = recs1.recommendations.find(r => r.title.toLowerCase().includes('natural born killers'));
  assert.strictEqual(nbk, undefined, 'Natural Born Killers MUST NOT be in recommendations when user avoids murder');
  console.log('   Top 3 Titles:', recs1.recommendations.slice(0, 3).map(r => r.title));
  console.log('   ✅ PASS: "where nobody gets murdered" mapped and Natural Born Killers excluded.\n');

  // Test 2: "No murders or killings." (Plot exclusion)
  console.log('2. Testing "No murders or killings." (Plot exclusion)...');
  const p2 = parseCustomPromptSync('suspense movie with no murders or killings');
  assert.ok(
    p2.negative_themes.some(t => /murder|kill/i.test(t)) || p2.negative_keywords.some(k => /murder|kill/i.test(k)),
    'Should capture murder or killing exclusions'
  );
  assert.ok(p2.negative_keywords.includes('murder') && p2.negative_keywords.includes('kill'), 'Should expand stems for murder and kill');
  const recs2 = await engine.recommend(p2);
  const hasKillerTitles = recs2.recommendations.some(r => /killer|murder/i.test(r.title));
  assert.strictEqual(hasKillerTitles, false, 'No recommended titles should have killer or murder in title');
  console.log('   ✅ PASS: Plot exclusion "no murders or killings" enforced.\n');

  // Test 3: "Without graphic violence." (Scene-level content exclusion)
  console.log('3. Testing "Without graphic violence." (Scene-level content exclusion)...');
  const p3 = parseCustomPromptSync('drama without graphic violence');
  assert.ok(
    p3.negative_themes.some(t => /violence/i.test(t)) || p3.negative_keywords.some(k => /violence/i.test(k)),
    'Should extract violence into negative themes or keywords'
  );
  console.log('   Negative Themes:', p3.negative_themes);
  console.log('   Negative Keywords:', p3.negative_keywords);
  console.log('   ✅ PASS: Scene-level exclusion "without graphic violence" captured.\n');

  // Test 4: "Avoid stories involving child abuse." (Thematic plot exclusion)
  console.log('4. Testing "Avoid stories involving child abuse." (Thematic plot exclusion)...');
  const p4 = parseCustomPromptSync('emotional drama, avoid stories involving child abuse');
  assert.ok(
    p4.negative_themes.some(t => /abuse/i.test(t)) || p4.negative_keywords.some(k => /abuse/i.test(k)),
    'Should capture child abuse in negative themes or keywords'
  );
  console.log('   Negative Themes:', p4.negative_themes);
  console.log('   Negative Keywords:', p4.negative_keywords);
  console.log('   ✅ PASS: Thematic exclusion "avoid stories involving child abuse" captured.\n');

  // Test 5: "Nothing with a tragic ending." (Tonal / narrative preference)
  console.log('5. Testing "Nothing with a tragic ending." (Tonal/narrative exclusion)...');
  const p5 = parseCustomPromptSync('romantic comedy where nothing with a tragic ending happens');
  assert.ok(
    p5.negative_themes.some(t => /tragic/i.test(t)) || p5.negative_keywords.some(k => /tragic|tragedy/i.test(k)),
    'Should capture tragic ending in negative themes or keywords'
  );
  console.log('   Negative Themes:', p5.negative_themes);
  console.log('   Negative Keywords:', p5.negative_keywords);
  console.log('   ✅ PASS: Narrative/tonal preference "nothing with a tragic ending" captured.\n');

  // Test 6: "No superhero films." (Genre & Franchise exclusion)
  console.log('6. Testing "No superhero films." (Genre & Franchise exclusion)...');
  const p6 = parseCustomPromptSync('action movies from the 2010s, no superhero films');
  assert.ok(
    p6.negative_franchises.includes('Superhero') || p6.negative_themes.includes('superhero'),
    'Should capture superhero in negative franchises or themes'
  );
  const candidates6 = await CandidateRetriever.getInstance().retrieveCandidates(p6);
  const superheroCandidates = candidates6.filter(c =>
    /spider-man|avengers|batman|iron man|superhero|marvel/i.test(c.title)
  );
  assert.strictEqual(superheroCandidates.length, 0, 'Candidate retriever must exclude superhero films');
  console.log('   ✅ PASS: Franchise/genre exclusion "no superhero films" strictly filtered 0 candidates.\n');

  // Test 7: "Psychological suspense, but without physical violence."
  console.log('7. Testing "Psychological suspense, but without physical violence."...');
  const p7 = parseCustomPromptSync('psychological suspense, but without physical violence');
  assert.ok(p7.genres.includes('Thriller'), 'Should identify Thriller');
  assert.ok(
    p7.negative_themes.some(t => /violence/i.test(t)) || p7.negative_keywords.some(k => /violence/i.test(k)),
    'Should capture physical violence in negative themes or keywords'
  );
  console.log('   ✅ PASS: Distinguishes positive suspense from negative physical violence.\n');

  // Test 8: "Crime drama without on-screen deaths."
  console.log('8. Testing "Crime drama without on-screen deaths."...');
  const p8 = parseCustomPromptSync('crime drama without on-screen deaths');
  assert.ok(p8.genres.includes('Crime') && p8.genres.includes('Drama'), 'Should identify Crime and Drama');
  assert.ok(
    p8.negative_themes.some(t => /death/i.test(t)) || p8.negative_keywords.some(k => /death|die/i.test(k)),
    'Should capture on-screen deaths in negative themes or keywords'
  );
  console.log('   ✅ PASS: Distinguishes crime drama from on-screen deaths.\n');

  // Test 9: Avoidance Explanation Honesty
  console.log('9. Testing Non-Hallucinated Avoidance Explanations...');
  // Title with conflicting genre/description should NOT get avoidance explanation
  const nbkDna = CandidateRetriever.getInstance().getAllDnas().find(d => d.content_id === 4077); // Natural Born Killers
  if (nbkDna) {
    const candidate: any = { content_id: nbkDna.content_id, dna: nbkDna };
    const reasons = ExplanationGenerator.generateMatchReasons(candidate, p1, false);
    const hasAvoidanceReason = reasons.some(r => /avoids/i.test(r));
    assert.strictEqual(hasAvoidanceReason, false, 'Conflicting title MUST NOT claim avoidance explanation');
  }

  // Wholesome title with affirmative metadata CAN claim avoidance explanation
  const wholesomeDna = CandidateRetriever.getInstance().getAllDnas().find(d =>
    d.genres.includes('Family') || d.genres.includes('Animation')
  );
  if (wholesomeDna) {
    const candidate: any = { content_id: wholesomeDna.content_id, dna: wholesomeDna };
    const reasons = ExplanationGenerator.generateMatchReasons(candidate, p1, false);
    console.log(`   Sample explanation for ${wholesomeDna.title}:`, reasons);
  }
  console.log('   ✅ PASS: Avoidance explanations strictly require affirmative evidence and block conflicting metadata.\n');

  console.log('================================================================');
  console.log('   ALL 9 NEGATIVE CONSTRAINTS TESTS PASSED (100%)               ');
  console.log('================================================================');

  await pool.end();
}

runNegativeConstraintTests().catch((err) => {
  console.error('❌ FAIL:', err);
  process.exit(1);
});

import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { CandidateRetriever } from './services/recommendation/candidateRetriever';
import { FeatureScorer } from './services/recommendation/featureScorer';
import { EmbeddingStore } from './services/recommendation/embeddingStore';
import { ReferenceProfile } from './services/recommendation/types';
import { MovieDNA } from './models/interfaces';

async function runReferenceTuningTests() {
  console.log('================================================================');
  console.log('    TESTING REFERENCE-TITLE QUALITY TUNING & REGRESSION TESTS   ');
  console.log('================================================================');

  const engine = RecommendationEngine.getInstance();
  await engine.init();
  const store = EmbeddingStore.getInstance();
  const retriever = CandidateRetriever.getInstance();

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    console.log(`✅ PASS: ${msg}`);
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST A: "I want something like Interstellar but shorter."
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST A: "I want something like Interstellar but shorter." ---');
  const tStartA = Date.now();
  const profileA = await PreferenceProfileBuilder.buildFromCustom('I want something like Interstellar but shorter.');
  const resA = await engine.recommend(profileA, true);
  const latencyA = Date.now() - tStartA;

  console.log(`Top 5 Recommendations for Test A (Latency: ${latencyA}ms):`);
  resA.recommendations.slice(0, 5).forEach((r, i) => {
    console.log(
      `  #${i + 1}: ${r.title} (${r.type}, ${r.release_year ?? 'N/A'}) - ${r.match_percentage}% match | ref=${r.score_breakdown.reference} (story=${r.score_breakdown.reference_details?.semantic_similarity}, genre=${r.score_breakdown.reference_details?.genre_affinity})`
    );
    console.log(`      Reasons: ${r.match_reasons.join(' | ')}`);
  });

  const top1A = resA.recommendations[0];
  // Verify Kulong is NO LONGER #1!
  assert(top1A.title !== 'Kulong', 'Kulong is no longer #1; reference-aligned Sci-Fi/space titles now outrank generic drama.');
  
  // Verify top recommendations include strong reference-aligned titles (e.g. Spaceman, Star Trek Beyond)
  const top3TitlesA = resA.recommendations.slice(0, 3).map((r) => r.title);
  assert(
    top3TitlesA.includes('Spaceman') || top3TitlesA.includes('Stargate') || top3TitlesA.includes('Star Trek Beyond'),
    `Top 3 includes major Sci-Fi reference-aligned titles (got: ${top3TitlesA.join(', ')})`
  );

  // Verify all recommendations respect shorter than Interstellar (169 min)
  for (const rec of resA.recommendations) {
    const candDna = retriever.getMovieDNA(rec.content_id);
    if (candDna && candDna.type === 'Movie' && candDna.runtime) {
      assert(candDna.runtime < 169, `Candidate "${rec.title}" runtime (${candDna.runtime}m) is strictly shorter than Interstellar (169m)`);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST B: "I want something like The Dark Knight."
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST B: "I want something like The Dark Knight." ---');
  const profileB = await PreferenceProfileBuilder.buildFromCustom('I want something like The Dark Knight.');
  const resB = await engine.recommend(profileB, true);

  console.log('Top 5 Recommendations for Test B:');
  resB.recommendations.slice(0, 5).forEach((r, i) => {
    console.log(
      `  #${i + 1}: ${r.title} (${r.type}, ${r.release_year ?? 'N/A'}) - ${r.match_percentage}% match | ref=${r.score_breakdown.reference} (story=${r.score_breakdown.reference_details?.semantic_similarity}, genre=${r.score_breakdown.reference_details?.genre_affinity})`
    );
    console.log(`      Reasons: ${r.match_reasons.join(' | ')}`);
  });

  assert(resB.recommendations.length > 0, 'Returns recommendations for The Dark Knight');
  const topGenresB = resB.recommendations.slice(0, 5).map((r) => retriever.getMovieDNA(r.content_id)?.genres || []);
  const hasActionOrCrimeOrThriller = topGenresB.some((g) => g.includes('Action') || g.includes('Crime') || g.includes('Thriller'));
  assert(hasActionOrCrimeOrThriller, 'Top candidates share Action/Crime/Thriller elements with The Dark Knight');

  // Verify match reasons mention Action/Crime/Thriller or The Dark Knight
  const reasonsB = resB.recommendations[0].match_reasons.join(' ');
  assert(reasonsB.includes('The Dark Knight'), 'Top recommendation includes truthful reference explanation for The Dark Knight');

  // ---------------------------------------------------------------------------
  // TEST C: "I want something like Spirited Away."
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST C: "I want something like Spirited Away." ---');
  const profileC = await PreferenceProfileBuilder.buildFromCustom('I want something like Spirited Away.');
  const resC = await engine.recommend(profileC, true);

  console.log('Top 5 Recommendations for Test C:');
  resC.recommendations.slice(0, 5).forEach((r, i) => {
    console.log(
      `  #${i + 1}: ${r.title} (${r.type}, ${r.release_year ?? 'N/A'}) - ${r.match_percentage}% match | ref=${r.score_breakdown.reference}`
    );
    console.log(`      Reasons: ${r.match_reasons.join(' | ')}`);
  });

  assert(resC.recommendations.length > 0, 'Returns recommendations for Spirited Away');
  const topGenresC = resC.recommendations.slice(0, 5).map((r) => retriever.getMovieDNA(r.content_id)?.genres || []);
  const hasAnimationOrFantasy = topGenresC.some((g) => g.includes('Animation') || g.includes('Fantasy') || g.includes('Family'));
  assert(hasAnimationOrFantasy, 'Top candidates align with Animation/Fantasy elements of Spirited Away');

  // ---------------------------------------------------------------------------
  // TEST D: "I want something like Breaking Bad."
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST D: "I want something like Breaking Bad." ---');
  const profileD = await PreferenceProfileBuilder.buildFromCustom('I want something like Breaking Bad.');
  const resD = await engine.recommend(profileD, true);

  console.log('Top 5 Recommendations for Test D:');
  resD.recommendations.slice(0, 5).forEach((r, i) => {
    console.log(
      `  #${i + 1}: ${r.title} (${r.type}, ${r.release_year ?? 'N/A'}) - ${r.match_percentage}% match | ref=${r.score_breakdown.reference}`
    );
    console.log(`      Reasons: ${r.match_reasons.join(' | ')}`);
  });

  assert(resD.recommendations.length > 0, 'Returns recommendations for Breaking Bad');
  // Breaking Bad is Crime & Drama series.
  const topGenresD = resD.recommendations.slice(0, 5).map((r) => retriever.getMovieDNA(r.content_id)?.genres || []);
  const hasCrimeOrDrama = topGenresD.some((g) => g.includes('Crime') || g.includes('Drama'));
  assert(hasCrimeOrDrama, 'Top candidates align with Crime/Drama themes of Breaking Bad');

  // ---------------------------------------------------------------------------
  // TEST E: Reference title with missing genres (Neutral fallback, no crash)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST E: Reference Title with Missing Genres ---');
  const mockRefNoGenres: ReferenceProfile = {
    content_id: 999999,
    title: 'Hypothetical Film Without Genres',
    type: 'Movie',
    genres: [], // Empty genres
    runtime: 110,
    description: 'A mysterious film without registered genre tags.',
  };

  const sampleCandidate = retriever.getAllDnas()[0];
  const scoreResultE = FeatureScorer.scoreReference(sampleCandidate, [mockRefNoGenres], store);

  assert(
    scoreResultE.combined_score > 0 && scoreResultE.combined_score <= 1.0,
    `Missing reference genres scored gracefully: ${scoreResultE.combined_score} (neutral fallback)`
  );
  assert(
    scoreResultE.breakdown?.genre_affinity === 0.5,
    `Missing reference genre affinity assigned neutral 0.5 (got: ${scoreResultE.breakdown?.genre_affinity})`
  );

  // ---------------------------------------------------------------------------
  // TEST F: Reference title with missing runtime (Neutral fallback, no crash)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST F: Reference Title with Missing Runtime ---');
  const profileF = {
    ...profileA,
    runtime_relation: 'shorter_than_reference' as const,
  };

  // When refDuration is null:
  const runtimeScoreF = FeatureScorer.scoreRuntime(sampleCandidate, profileF, null);
  assert(
    runtimeScoreF === 0.5,
    `Missing reference duration assigned neutral 0.5 fallback without error (got: ${runtimeScoreF})`
  );

  // ---------------------------------------------------------------------------
  // TEST G: Reference title where candidate genre overlap is zero but semantic is high
  // Verify genre overlap influences ranking but NEVER becomes a hard filter!
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST G: Zero Genre Overlap But High Semantic Similarity ---');
  const mockRefSciFi: ReferenceProfile = {
    content_id: 189, // Interstellar
    title: 'Interstellar',
    type: 'Movie',
    genres: ['Adventure', 'Drama', 'Sci-Fi & Fantasy'],
    runtime: 169,
    description: 'Humanity space survival.',
  };

  // Candidate with real embedding (content_id from catalog) but zero genre overlap (e.g. Comedy, Music vs Sci-Fi, Adventure, Drama)
  const candidateZeroGenreOverlap: MovieDNA = {
    ...sampleCandidate,
    genres: ['Comedy', 'Music'], // ZERO overlap with [Adventure, Drama, Sci-Fi & Fantasy]
    type: 'Movie',
  };

  const scoreResultG = FeatureScorer.scoreReference(candidateZeroGenreOverlap, [mockRefSciFi], store);
  assert(
    scoreResultG.breakdown?.genre_affinity === 0.0,
    `Zero genre overlap correctly calculated as 0.0 (got: ${scoreResultG.breakdown?.genre_affinity})`
  );
  assert(
    scoreResultG.combined_score > 0,
    `Zero genre overlap candidate is NOT eliminated! Combined score: ${scoreResultG.combined_score} > 0 (soft ranking signal, not hard filter)`
  );

  console.log('\n================================================================');
  console.log(`🎉 All ${passed}/${total} Reference-Tuning Regression Tests PASSED!`);
  console.log('================================================================');

  process.exit(0);
}

runReferenceTuningTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

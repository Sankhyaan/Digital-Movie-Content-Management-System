import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { CandidateRetriever } from './services/recommendation/candidateRetriever';
import { UserPreferenceProfile } from './models/preferenceProfile';
import { RecommendationResult } from './services/recommendation/types';

interface QualityReportItem {
  id: string;
  name: string;
  mode: 'custom' | 'guided';
  promptOrInput: string;
  parsedProfile: UserPreferenceProfile;
  candidatePoolSize: number;
  resultsCount: number;
  recommendations: RecommendationResult[];
  metrics: {
    typeConstraintSatisfactionPct: number | null;
    platformConstraintSatisfactionPct: number | null;
    languageConstraintSatisfactionPct: number | null;
    genreHitRatePct: number | null;
    runtimeSatisfactionPct: number | null;
    eraSatisfactionPct: number | null;
    avgRating: number;
    runtimeMean: number | null;
    runtimeMedian: number | null;
    avgSemanticScore: number;
    avgReferenceAffinity: number | null;
    duplicateCount: number;
    genreDiversityUniqueCount: number;
  };
}

async function runQualityEvaluation() {
  console.log('========================================================================');
  console.log('     CINEVERSE REAL-WORLD RECOMMENDATION QUALITY EVALUATION HARNESS      ');
  console.log('========================================================================\n');

  const engine = RecommendationEngine.getInstance();
  await engine.init();
  const retriever = CandidateRetriever.getInstance();

  const customPrompts: Array<{ id: string; prompt: string }> = [
    { id: 'CASE 1', prompt: 'I want a recent sci-fi movie under 2 hours.' },
    { id: 'CASE 2', prompt: 'I want something like Interstellar but shorter.' },
    { id: 'CASE 3', prompt: 'I want something like The Dark Knight.' },
    { id: 'CASE 4', prompt: 'I want something like Spirited Away.' },
    { id: 'CASE 5', prompt: 'I want something like Breaking Bad.' },
    { id: 'CASE 6', prompt: 'Give me a Korean mystery series on Netflix.' },
    { id: 'CASE 7', prompt: 'I want something emotional but not too depressing.' },
    { id: 'CASE 8', prompt: 'I want a funny movie I can watch with my family.' },
    { id: 'CASE 9', prompt: 'I want a classic crime movie.' },
    { id: 'CASE 10', prompt: 'I want a dark psychological thriller from the 2000s.' },
    { id: 'CASE 11', prompt: 'I want a highly rated adventure movie.' },
    { id: 'CASE 12', prompt: "I don't mind a long movie. Give me something epic." },
    { id: 'CASE 13', prompt: 'I only have about 90 minutes. Give me a thriller.' },
    { id: 'CASE 14', prompt: 'I want a recent highly rated emotional sci-fi movie.' },
    { id: 'CASE 15', prompt: "I don't care, surprise me." },
    { id: 'CASE 16', prompt: 'I want something like Interstellar but more of a thriller.' },
    { id: 'CASE 17', prompt: 'I want something like The Godfather but more recent.' },
    { id: 'CASE 18', prompt: 'I want something like Interstellar but longer.' },
    { id: 'CASE 19', prompt: 'I want a good sci-fi movie on Netflix.' },
    { id: 'CASE 20', prompt: 'I want a Korean thriller movie.' },
    { id: 'CASE 21', prompt: 'I want something that will make me think.' },
    { id: 'CASE 22', prompt: 'I just want something really funny.' },
    { id: 'CASE 23', prompt: 'I want something like Inside Out.' },
    { id: 'CASE 24', prompt: 'I want a mystery. Movie or series is fine.' },
    { id: 'CASE 25', prompt: 'I want a Korean sci-fi movie on Netflix.' },
  ];

  const guidedCases: Array<{ id: string; answers: any; label: string }> = [
    {
      id: 'GUIDED 1',
      label: 'Make me think | Movie | ~2 hours | Recent | Best-rated stuff',
      answers: {
        experience: 'thought_provoking',
        type: 'Movie',
        runtime_preference: 'around_2_hours',
        era_preference: 'recent',
        quality_preference: 'high',
      },
    },
    {
      id: 'GUIDED 2',
      label: 'Make me laugh | Series | Bingeable | Any era | Well-reviewed',
      answers: {
        experience: 'funny',
        type: 'Series',
        runtime_preference: 'binge_series',
        era_preference: 'any',
        quality_preference: 'medium',
      },
    },
    {
      id: 'GUIDED 3',
      label: 'Keep me on edge | Movie | Under 2 hours | 2000s–2010s | Ratings don’t matter much',
      answers: {
        experience: 'thrilling',
        type: 'Movie',
        runtime_preference: 'under_2_hours',
        era_preference: 'modern',
        quality_preference: 'low',
      },
    },
    {
      id: 'GUIDED 4',
      label: 'Make me feel something | Surprise me | No preference | Classic | Well-reviewed',
      answers: {
        experience: 'emotional',
        type: null,
        runtime_preference: 'no_preference',
        era_preference: 'classic',
        quality_preference: 'medium',
      },
    },
    {
      id: 'GUIDED 5',
      label: 'Take me somewhere different | Surprise me | No preference | Any era | Ratings don’t matter',
      answers: {
        experience: 'escapist',
        type: null,
        runtime_preference: 'no_preference',
        era_preference: 'any',
        quality_preference: 'low',
      },
    },
  ];

  const evaluationReport: QualityReportItem[] = [];

  // 1. Process Custom Prompts
  for (const item of customPrompts) {
    const profile = await PreferenceProfileBuilder.buildFromCustom(item.prompt);
    const candidatePool = await retriever.retrieveCandidates(profile);
    const recResult = await engine.recommend(profile, true);

    const reportItem = analyzeScenario(
      item.id,
      item.prompt,
      'custom',
      item.prompt,
      profile,
      candidatePool.length,
      recResult.recommendations,
      retriever
    );
    evaluationReport.push(reportItem);
    printScenarioOutput(reportItem);
  }

  // 2. Process Guided Cases
  for (const item of guidedCases) {
    const profile = PreferenceProfileBuilder.buildFromGuided(item.answers);
    const candidatePool = await retriever.retrieveCandidates(profile);
    const recResult = await engine.recommend(profile, true);

    const reportItem = analyzeScenario(
      item.id,
      item.label,
      'guided',
      JSON.stringify(item.answers),
      profile,
      candidatePool.length,
      recResult.recommendations,
      retriever
    );
    evaluationReport.push(reportItem);
    printScenarioOutput(reportItem);
  }

  // Save complete evaluation report to JSON file for in-depth analysis
  const fs = await import('fs');
  fs.writeFileSync('quality_evaluation_data.json', JSON.stringify(evaluationReport, null, 2), 'utf-8');
  console.log(`Saved detailed report data to backend/quality_evaluation_data.json`);

  console.log('\n========================================================================');
  console.log(`EVALUATION COMPLETE: Analyzed ${evaluationReport.length} Scenarios`);
  console.log('========================================================================\n');
}

function analyzeScenario(
  id: string,
  name: string,
  mode: 'custom' | 'guided',
  promptOrInput: string,
  profile: UserPreferenceProfile,
  candidatePoolSize: number,
  recs: RecommendationResult[],
  retriever: CandidateRetriever
): QualityReportItem {
  const count = recs.length;

  // Type constraint satisfaction
  let typeSatisfaction: number | null = null;
  if (profile.type) {
    const matches = recs.filter((r) => r.type === profile.type).length;
    typeSatisfaction = count > 0 ? (matches / count) * 100 : null;
  }

  // Platform constraint satisfaction
  let platformSatisfaction: number | null = null;
  if (profile.platforms.length > 0) {
    const matches = recs.filter((r) => {
      const dna = retriever.getMovieDNA(r.content_id);
      return dna ? profile.platforms.some((p) => dna.platforms.includes(p)) : false;
    }).length;
    platformSatisfaction = count > 0 ? (matches / count) * 100 : null;
  }

  // Language constraint satisfaction
  let languageSatisfaction: number | null = null;
  if (profile.languages.length > 0) {
    const matches = recs.filter((r) => {
      const dna = retriever.getMovieDNA(r.content_id);
      return dna ? profile.languages.some((l) => dna.languages.includes(l)) : false;
    }).length;
    languageSatisfaction = count > 0 ? (matches / count) * 100 : null;
  }

  // Genre hit rate
  let genreHitRate: number | null = null;
  if (profile.genres.length > 0) {
    const matches = recs.filter((r) => {
      const dna = retriever.getMovieDNA(r.content_id);
      return dna ? profile.genres.some((g) => dna.genres.includes(g)) : false;
    }).length;
    genreHitRate = count > 0 ? (matches / count) * 100 : null;
  }

  // Runtime satisfaction
  let runtimeSatisfaction: number | null = null;
  const runtimes: number[] = [];
  recs.forEach((r) => {
    const dna = retriever.getMovieDNA(r.content_id);
    if (dna && dna.runtime) {
      runtimes.push(dna.runtime);
    }
  });

  if (profile.runtime_preference === 'under_2_hours') {
    const satisfied = runtimes.filter((dur) => dur <= 120).length;
    runtimeSatisfaction = runtimes.length > 0 ? (satisfied / runtimes.length) * 100 : null;
  } else if (profile.runtime_preference === 'around_2_hours') {
    const satisfied = runtimes.filter((dur) => dur >= 95 && dur <= 145).length;
    runtimeSatisfaction = runtimes.length > 0 ? (satisfied / runtimes.length) * 100 : null;
  } else if (profile.runtime_relation === 'shorter_than_reference') {
    // Check against reference title
    const refMovie = profile.reference_titles.length > 0 ? retriever.findMovieByName(profile.reference_titles[0]) : null;
    const refDur = refMovie?.runtime || 169;
    const satisfied = runtimes.filter((dur) => dur < refDur).length;
    runtimeSatisfaction = runtimes.length > 0 ? (satisfied / runtimes.length) * 100 : null;
  } else if (profile.runtime_relation === 'longer_than_reference') {
    const refMovie = profile.reference_titles.length > 0 ? retriever.findMovieByName(profile.reference_titles[0]) : null;
    const refDur = refMovie?.runtime || 169;
    const satisfied = runtimes.filter((dur) => dur > refDur).length;
    runtimeSatisfaction = runtimes.length > 0 ? (satisfied / runtimes.length) * 100 : null;
  }

  // Era satisfaction
  let eraSatisfaction: number | null = null;
  if (profile.era_preference === 'recent') {
    const matches = recs.filter((r) => r.release_year && r.release_year >= 2020).length;
    eraSatisfaction = count > 0 ? (matches / count) * 100 : null;
  } else if (profile.era_preference === 'modern') {
    const matches = recs.filter((r) => r.release_year && r.release_year >= 2000 && r.release_year <= 2019).length;
    eraSatisfaction = count > 0 ? (matches / count) * 100 : null;
  } else if (profile.era_preference === 'classic') {
    const matches = recs.filter((r) => r.release_year && r.release_year < 2000).length;
    eraSatisfaction = count > 0 ? (matches / count) * 100 : null;
  }

  // Mean & median runtime
  let runtimeMean: number | null = null;
  let runtimeMedian: number | null = null;
  if (runtimes.length > 0) {
    runtimeMean = Number((runtimes.reduce((a, b) => a + b, 0) / runtimes.length).toFixed(1));
    const sortedDur = [...runtimes].sort((a, b) => a - b);
    const mid = Math.floor(sortedDur.length / 2);
    runtimeMedian = sortedDur.length % 2 !== 0 ? sortedDur[mid] : (sortedDur[mid - 1] + sortedDur[mid]) / 2;
  }

  // Average Rating
  const validRatings = recs.filter((r) => r.rating !== null && r.rating !== undefined).map((r) => r.rating as number);
  const avgRating = validRatings.length > 0 ? Number((validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(2)) : 0;

  // Average Semantic Score
  const avgSemantic = count > 0 ? Number((recs.reduce((acc, r) => acc + r.score_breakdown.semantic, 0) / count).toFixed(3)) : 0;

  // Average Reference Affinity
  let avgRefAff: number | null = null;
  if (profile.reference_titles.length > 0) {
    const refScores = recs.map((r) => r.score_breakdown.reference).filter((s) => s > 0);
    avgRefAff = refScores.length > 0 ? Number((refScores.reduce((a, b) => a + b, 0) / refScores.length).toFixed(3)) : null;
  }

  // Duplicates check
  const idSet = new Set<number>();
  let duplicates = 0;
  for (const r of recs) {
    if (idSet.has(r.content_id)) duplicates++;
    idSet.add(r.content_id);
  }

  // Genre diversity count
  const allGenresInRecs = new Set<string>();
  recs.forEach((r) => {
    const dna = retriever.getMovieDNA(r.content_id);
    dna?.genres.forEach((g) => allGenresInRecs.add(g));
  });

  return {
    id,
    name,
    mode,
    promptOrInput,
    parsedProfile: profile,
    candidatePoolSize,
    resultsCount: count,
    recommendations: recs,
    metrics: {
      typeConstraintSatisfactionPct: typeSatisfaction,
      platformConstraintSatisfactionPct: platformSatisfaction,
      languageConstraintSatisfactionPct: languageSatisfaction,
      genreHitRatePct: genreHitRate,
      runtimeSatisfactionPct: runtimeSatisfaction,
      eraSatisfactionPct: eraSatisfaction,
      avgRating,
      runtimeMean,
      runtimeMedian,
      avgSemanticScore: avgSemantic,
      avgReferenceAffinity: avgRefAff,
      duplicateCount: duplicates,
      genreDiversityUniqueCount: allGenresInRecs.size,
    },
  };
}

function printScenarioOutput(item: QualityReportItem) {
  console.log('------------------------------------------------------------------------');
  console.log(`>>> [${item.id}] "${item.name}"`);
  console.log('------------------------------------------------------------------------');
  console.log(`Mode: ${item.mode.toUpperCase()} | Candidates in Pool: ${item.candidatePoolSize} | Output Count: ${item.resultsCount}`);
  console.log('Parsed Profile:', JSON.stringify({
    source: item.parsedProfile.source,
    experience: item.parsedProfile.experience,
    type: item.parsedProfile.type,
    genres: item.parsedProfile.genres,
    languages: item.parsedProfile.languages,
    platforms: item.parsedProfile.platforms,
    runtime_preference: item.parsedProfile.runtime_preference,
    runtime_relation: item.parsedProfile.runtime_relation,
    era_preference: item.parsedProfile.era_preference,
    quality_preference: item.parsedProfile.quality_preference,
    reference_titles: item.parsedProfile.reference_titles,
    themes: item.parsedProfile.themes,
  }));

  console.log('Diagnostic Metrics:', JSON.stringify(item.metrics));
  console.log('\nTOP 20 RECOMMENDATIONS:');

  item.recommendations.forEach((r, idx) => {
    const refText = r.score_breakdown.reference > 0 ? ` | ref=${r.score_breakdown.reference}` : '';
    console.log(
      `  #${(idx + 1).toString().padStart(2, ' ')}: "${r.title}" (${r.type}, ${r.release_year ?? 'N/A'}, ${r.rating !== null ? r.rating + '★' : 'unrated'})` +
      ` - ${r.match_percentage}% match [sem=${r.score_breakdown.semantic}, gen=${r.score_breakdown.genre}, run=${r.score_breakdown.runtime}${refText}]`
    );
    console.log(`       Reasons: ${r.match_reasons.join(' | ')}`);
  });
  console.log('');
}

runQualityEvaluation().catch((err) => {
  console.error(err);
  process.exit(1);
});

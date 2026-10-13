import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { UserPreferenceProfile } from './models/preferenceProfile';
import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';

async function runProfiles() {
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  const testCases: Array<{ name: string; profile: UserPreferenceProfile }> = [
    {
      name: 'PROFILE 1: Guided - Thought-Provoking Recent Movie (~2 hrs, High Quality)',
      profile: PreferenceProfileBuilder.buildFromGuided({
        experience: 'thought_provoking',
        type: 'Movie',
        runtime_preference: 'around_2_hours',
        era_preference: 'recent',
        quality_preference: 'high',
      }),
    },
    {
      name: 'PROFILE 2: Guided - Funny Bingeable Series (Medium Quality)',
      profile: PreferenceProfileBuilder.buildFromGuided({
        experience: 'funny',
        type: 'Series',
        runtime_preference: 'binge_series',
        era_preference: 'any',
        quality_preference: 'medium',
      }),
    },
    {
      name: 'PROFILE 3: Custom - "I want a recent sci-fi movie under 2 hours."',
      profile: await PreferenceProfileBuilder.buildFromCustom('I want a recent sci-fi movie under 2 hours.'),
    },
    {
      name: 'PROFILE 4: Custom - "Give me a Korean mystery series on Netflix."',
      profile: await PreferenceProfileBuilder.buildFromCustom('Give me a Korean mystery series on Netflix.'),
    },
    {
      name: 'PROFILE 5: Custom - "I want something like Interstellar but shorter."',
      profile: await PreferenceProfileBuilder.buildFromCustom('I want something like Interstellar but shorter.'),
    },
  ];

  for (const tc of testCases) {
    console.log('\n================================================================================');
    console.log(`>>> ${tc.name}`);
    console.log('================================================================================');
    const res = await engine.recommend(tc.profile, true);
    console.log(`Found ${res.count} recommendations (Pool: ${res.debug?.candidate_pool_size}, Latency: ${res.debug?.execution_time_ms.total_ms}ms)`);
    console.log('Active weights:', JSON.stringify(res.debug?.active_weights));

    res.recommendations.forEach((rec, idx) => {
      console.log(`\n#${idx + 1}: ${rec.title} (${rec.type}, ${rec.release_year ?? 'N/A'}, ${rec.rating != null ? rec.rating + '★' : 'unrated'})`);
      console.log(`    Match: ${rec.match_percentage}% (raw score: ${rec.recommendation_score.toFixed(3)})`);
      console.log(`    Reasons: ${rec.match_reasons.join(' | ')}`);
      console.log(`    Breakdown: sem=${rec.score_breakdown.semantic.toFixed(2)}, exp=${rec.score_breakdown.experience.toFixed(2)}, gen=${rec.score_breakdown.genre.toFixed(2)}, run=${rec.score_breakdown.runtime.toFixed(2)}, era=${rec.score_breakdown.era.toFixed(2)}, qua=${rec.score_breakdown.quality.toFixed(2)}, ref=${rec.score_breakdown.reference.toFixed(2)}`);
    });
  }

  process.exit(0);
}

runProfiles().catch((err) => {
  console.error(err);
  process.exit(1);
});

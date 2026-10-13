import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import * as fs from 'fs';
import * as path from 'path';

interface RerunResult {
  scenarioId: string;
  name: string;
  prompt: string;
  before: {
    top5: Array<{
      title: string;
      year: number;
      type: string;
      matchPercentage: number;
    }>;
  };
  after: {
    parsedProfile: any;
    latencyMs: number;
    top5: Array<{
      title: string;
      year: number;
      type: string;
      runtime: number | null;
      genres: string[];
      matchPercentage: number;
      scoreBreakdown: any;
      explanation: string;
    }>;
  };
}

async function runRerunEvaluation() {
  console.log('Initializing RecommendationEngine for Phase 2 Rerun Evaluation...');
  const engine = RecommendationEngine.getInstance();
  await engine.init();

  const cases = [
    {
      id: 'CASE 7',
      prompt: 'I want something emotional but not too depressing.',
      before: [
        { title: 'Tell Me What You Want', year: 2024, type: 'Movie', matchPercentage: 76 },
        { title: 'The Emoji Movie', year: 2017, type: 'Movie', matchPercentage: 73 },
        { title: 'My Happy Marriage', year: 2023, type: 'Series', matchPercentage: 73 },
        { title: 'Enchanted', year: 2007, type: 'Movie', matchPercentage: 71 },
        { title: 'The One I Love', year: 2026, type: 'Series', matchPercentage: 73 }
      ]
    },
    {
      id: 'CASE 10',
      prompt: 'I want a dark psychological thriller from the 2000s.',
      before: [
        { title: 'Dark Places', year: 2015, type: 'Movie', matchPercentage: 88 },
        { title: 'The Cell', year: 2000, type: 'Movie', matchPercentage: 87 },
        { title: 'Bright', year: 2017, type: 'Movie', matchPercentage: 85 },
        { title: 'xXx', year: 2002, type: 'Movie', matchPercentage: 85 },
        { title: 'How It Ends', year: 2018, type: 'Movie', matchPercentage: 84 }
      ]
    },
    {
      id: 'CASE 13',
      prompt: 'I only have about 90 minutes. Give me a thriller.',
      before: [
        { title: '13 Minutes', year: 2021, type: 'Movie', matchPercentage: 84 },
        { title: 'Time Lapse', year: 2014, type: 'Movie', matchPercentage: 83 },
        { title: 'Pulp Fiction', year: 1994, type: 'Movie', matchPercentage: 79 },
        { title: '57 Seconds', year: 2023, type: 'Movie', matchPercentage: 83 },
        { title: "Michael Jackson's Thriller", year: 1983, type: 'Movie', matchPercentage: 81 }
      ]
    },
    {
      id: 'CASE 23',
      prompt: 'I want something like Inside Out.',
      before: [
        { title: 'Inside Out 2', year: 2024, type: 'Movie', matchPercentage: 80 },
        { title: 'Kulong', year: 2024, type: 'Movie', matchPercentage: 73 },
        { title: 'The Draft!', year: 2026, type: 'Movie', matchPercentage: 72 },
        { title: 'The House', year: 2022, type: 'Movie', matchPercentage: 75 },
        { title: 'Avatar: The Way of Water', year: 2022, type: 'Movie', matchPercentage: 72 }
      ]
    },
    {
      id: 'CASE 2',
      prompt: 'I want something like Interstellar but shorter.',
      before: [
        { title: 'Spaceman', year: 2024, type: 'Movie', matchPercentage: 82 },
        { title: 'A Minecraft Movie', year: 2025, type: 'Movie', matchPercentage: 80 },
        { title: 'The Draft!', year: 2026, type: 'Movie', matchPercentage: 78 },
        { title: 'Kulong', year: 2024, type: 'Movie', matchPercentage: 81 },
        { title: 'Memories', year: 1995, type: 'Movie', matchPercentage: 78 }
      ]
    }
  ];

  const results: RerunResult[] = [];

  for (const c of cases) {
    console.log(`\n==================================================`);
    console.log(`Evaluating ${c.id}: "${c.prompt}"...`);
    const startParse = Date.now();
    const profile = await PreferenceProfileBuilder.buildFromCustom(c.prompt);
    const startRec = Date.now();
    const recRes = await engine.recommend(profile, true);
    const totalLatency = Date.now() - startParse;

    const top5 = recRes.recommendations.slice(0, 5).map((r: any) => ({
      title: r.title,
      year: r.release_year,
      type: r.type,
      runtime: r.runtime,
      genres: r.genres,
      matchPercentage: r.match_percentage,
      scoreBreakdown: r.score_breakdown,
      explanation: r.primary_reason + (r.secondary_reasons && r.secondary_reasons.length ? ' | ' + r.secondary_reasons.join(' | ') : '')
    }));

    console.log(`Latency: ${totalLatency}ms (engine: ${Date.now() - startRec}ms)`);
    console.log('Top 5 After:');
    top5.forEach((r: any, idx: number) => {
      console.log(`  #${idx + 1}: ${r.title} (${r.year}, ${r.type}, ${r.runtime}m) - ${r.matchPercentage}% match`);
      console.log(`      Reason: ${r.explanation}`);
      console.log(`      Scores: genre=${r.scoreBreakdown.genre?.toFixed(2)} era=${r.scoreBreakdown.era?.toFixed(2)} runtime=${r.scoreBreakdown.runtime?.toFixed(2)} sem=${r.scoreBreakdown.semantic?.toFixed(2)} negPenalty=${r.scoreBreakdown.negative_penalty?.toFixed(3) || '0'} ref=${r.scoreBreakdown.reference_title_affinity?.toFixed(2) || '0'}`);
    });

    results.push({
      scenarioId: c.id,
      name: c.prompt,
      prompt: c.prompt,
      before: { top5: c.before },
      after: {
        parsedProfile: profile,
        latencyMs: totalLatency,
        top5
      }
    });
  }

  const outPath = path.join(__dirname, '..', 'phase2_rerun_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nWrote rerun results to ${outPath}`);

  process.exit(0);
}

runRerunEvaluation().catch((err) => {
  console.error('Fatal error running evaluation:', err);
  process.exit(1);
});

import { pool } from './src/db/connection';

async function test() {
  try {
    const { SQLMovieRepository } = await import('./src/repositories/SQLMovieRepository');
    const repo = new SQLMovieRepository();
    const result = await repo.getRecommendations('Action', 'Movie', 120, null, null);
    console.log("Hydrated results count:", result.length);
    console.log("Titles:", result.map(r => r.title));

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

test();

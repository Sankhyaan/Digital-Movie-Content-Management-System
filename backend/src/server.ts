// =============================================================================
// SERVER ENTRY POINT — Dependency Injection Root
// =============================================================================
// This is where the entire application is wired together.
// =============================================================================

import dotenv from 'dotenv';
dotenv.config();  // ← Must be first, before any other imports that read env vars

import { createApp } from './app';
import { SQLMovieRepository } from './repositories/SQLMovieRepository';
import { testConnection, ensureDatabaseSchema } from './db/connection';

// ── Configuration ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// ── Boot sequence ─────────────────────────────────────────────────────────────
async function bootstrap() {
  // 1. Verify DB connection and ensure required schema tables exist
  await testConnection();
  await ensureDatabaseSchema();

  // 2. Wire up the real MySQL repository
  const repository = new SQLMovieRepository();

  // 3. Load person catalog from database BEFORE server starts listening
  // If the database is unavailable at startup, the server must refuse to start.
  console.log('📦 Loading person catalog from database...');
  const { initPersonCatalogFromDatabase } = await import('./services/customPromptParser');
  await initPersonCatalogFromDatabase();
  console.log('✅ Person catalog loaded successfully from database.');

  // 4. Pre-warm recommendation engine (load binary embeddings & cache)
  const { RecommendationEngine } = await import('./services/recommendation/recommendationEngine');
  await RecommendationEngine.getInstance().init();
  console.log('✅ Recommendation engine initialized.');

  // 5. Create & start Express ONLY after catalog load completes
  const app = createApp(repository);

  app.listen(PORT, () => {
    console.log(`\n🎬 CineVerse API Server running at http://localhost:${PORT}`);
    console.log(`📋 API Endpoints:`);
    console.log(`   GET  /api/movies              - List all movies (filterable)`);
    console.log(`   GET  /api/movies/featured     - Featured movies`);
    console.log(`   GET  /api/movies/trending     - Trending movies`);
    console.log(`   GET  /api/movies/genres       - All genres`);
    console.log(`   GET  /api/movies/search?q=    - Search movies`);
    console.log(`   GET  /api/movies/:id          - Movie details`);
    console.log(`   GET  /api/health              - Health check\n`);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

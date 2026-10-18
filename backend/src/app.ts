// =============================================================================
// EXPRESS APP CONFIGURATION
// =============================================================================

import express, { Application } from 'express';
import cors from 'cors';
import { createMovieRoutes } from './routes/movieRoutes';
import { MovieController } from './controllers/movieController';
import { MovieService } from './services/MovieService';
import { IMovieRepository } from './repositories/IMovieRepository';

/**
 * Creates and configures the Express application.
 * 
 * @param repository - The movie repository to use (injected dependency).
 *                     Pass MockMovieRepository for development, or your
 *                     own DB repository for production.
 */
export function createApp(repository: IMovieRepository): Application {
  const app = express();

  // ── Middleware ──────────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json());

  // ── Dependency Injection Wiring ────────────────────────────────────────
  const movieService = new MovieService(repository);
  const movieController = new MovieController(movieService);

  // ── Routes ─────────────────────────────────────────────────────────────
  app.use('/api/movies', createMovieRoutes(movieController));

  // ── Health Check ───────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    let gitCommit = process.env.GIT_COMMIT || 'unknown';
    if (gitCommit === 'unknown') {
      try {
        const { execSync } = require('child_process');
        gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 1000 }).trim();
      } catch {
        gitCommit = 'local-dev';
      }
    }

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      commit: gitCommit,
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // ── 404 Fallback for Unmatched API Endpoints ────────────────────────────
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
  });

  // ── Global Error Handler Middleware ─────────────────────────────────────
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  return app;
}

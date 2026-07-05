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
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  return app;
}

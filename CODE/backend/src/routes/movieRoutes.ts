// =============================================================================
// MOVIE ROUTES — Express Route Definitions
// =============================================================================
// Maps URL patterns to controller methods.
// 
// IMPORTANT: Static routes (featured, trending, genres, search) MUST be
// defined BEFORE the dynamic :id route, otherwise Express will try to match
// "featured" as an ID.
// =============================================================================

import { Router } from 'express';
import { MovieController } from '../controllers/movieController';

export function createMovieRoutes(controller: MovieController): Router {
  const router = Router();

  // Static routes first
  router.get('/featured', controller.getFeaturedMovies);
  router.get('/trending', controller.getTrendingMovies);
  router.get('/genres', controller.getGenres);
  router.get('/search', controller.searchMovies);
  router.get('/recommend', controller.getRecommendations);

  // Parameterized routes
  router.get('/:id', controller.getMovieById);

  // Root — list all (with optional query filters)
  router.get('/', controller.getAllMovies);

  return router;
}

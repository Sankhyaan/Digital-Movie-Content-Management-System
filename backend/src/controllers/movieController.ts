// =============================================================================
// MOVIE CONTROLLER — Route Handlers
// =============================================================================

import { Request, Response } from 'express';
import { MovieService } from '../services/MovieService';
import { ContentFilters } from '../models/interfaces';

export class MovieController {
  private service: MovieService;

  constructor(service: MovieService) {
    this.service = service;
  }

  /**
   * GET /api/movies
   * Query params: ?genre=  ?year=  ?search=  ?language=  ?type=Movie|Series
   */
  getAllMovies = async (req: Request, res: Response): Promise<void> => {
    try {
      const typeParam = req.query.type as string | undefined;
      const filters: ContentFilters = {
        genre:    req.query.genre    as string | undefined,
        year:     req.query.year     as string | undefined,
        search:   req.query.search   as string | undefined,
        language: req.query.language as string | undefined,
        type:     typeParam === 'Movie' || typeParam === 'Series' ? typeParam : undefined,
        limit:    req.query.limit    ? parseInt(req.query.limit as string, 10) : undefined,
        offset:   req.query.offset   ? parseInt(req.query.offset as string, 10) : undefined,
      };
      const [items, total] = await Promise.all([
        this.service.getAllMovies(filters),
        this.service.getCount(filters),
      ]);
      res.json({ success: true, count: items.length, total, data: items });
    } catch (error) {
      console.error('Error fetching content:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /** GET /api/movies/featured */
  getFeaturedMovies = async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.service.getFeaturedMovies();
      res.json({ success: true, count: items.length, data: items });
    } catch (error) {
      console.error('Error fetching featured content:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /** GET /api/movies/trending */
  getTrendingMovies = async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.service.getTrendingMovies();
      res.json({ success: true, count: items.length, data: items });
    } catch (error) {
      console.error('Error fetching trending content:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /** GET /api/movies/genres */
  getGenres = async (_req: Request, res: Response): Promise<void> => {
    try {
      const genres = await this.service.getAvailableGenres();
      res.json({ success: true, data: genres });
    } catch (error) {
      console.error('Error fetching genres:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /** GET /api/movies/search?q= */
  searchMovies = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query.q as string;
      if (!query) {
        res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
        return;
      }
      const items = await this.service.searchMovies(query);
      res.json({ success: true, count: items.length, data: items });
    } catch (error) {
      console.error('Error searching content:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /** GET /api/movies/recommend */
  getRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const vibe = req.query.vibe as string || null;
      const type = req.query.type as string || null;
      const maxDuration = req.query.maxDuration ? parseInt(req.query.maxDuration as string) : null;
      const minYear = req.query.minYear ? parseInt(req.query.minYear as string) : null;
      const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : null;

      const items = await this.service.getRecommendations(vibe, type, maxDuration, minYear, minRating);
      res.json({ success: true, count: items.length, data: items });
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /** GET /api/movies/:id */
  getMovieById = async (req: Request, res: Response): Promise<void> => {
    try {
      const item = await this.service.getMovieById(req.params.id);
      if (!item) {
        res.status(404).json({ success: false, error: 'Content not found' });
        return;
      }
      res.json({ success: true, data: item });
    } catch (error) {
      console.error('Error fetching content by id:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /** POST /api/movies/profile — Build common user preference profile from guided or custom input */
  buildPreferenceProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { source, answers, prompt } = req.body;
      const { PreferenceProfileBuilder } = await import('../services/preferenceProfileBuilder');

      let profile;
      if (source === 'guided') {
        profile = PreferenceProfileBuilder.buildFromGuided(answers || {});
      } else if (source === 'custom') {
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
          res.status(400).json({ success: false, error: 'Custom prompt must be a non-empty string.' });
          return;
        }
        profile = await PreferenceProfileBuilder.buildFromCustom(prompt.trim());
      } else {
        res.status(400).json({ success: false, error: 'Invalid source. Must be "guided" or "custom".' });
        return;
      }

      const validation = PreferenceProfileBuilder.validate(profile);
      res.json({ success: true, profile, validation });
    } catch (error) {
      console.error('Error building preference profile:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /** POST /api/movies/recommend — Hybrid Content-Based Recommendation from UserPreferenceProfile */
  getRecommendationsByProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { profile, debug } = req.body;
      if (!profile) {
        res.status(400).json({ success: false, error: 'Missing profile object in request body.' });
        return;
      }

      if (profile.source === 'custom') {
        if (!profile.free_text || typeof profile.free_text !== 'string' || profile.free_text.trim().length === 0) {
          res.status(400).json({ success: false, error: 'Custom profile must contain a non-empty prompt.' });
          return;
        }
      }

      const hasMeaningfulPreferences =
        (profile.genres && profile.genres.length > 0) ||
        (profile.actors && profile.actors.length > 0) ||
        (profile.directors && profile.directors.length > 0) ||
        (profile.reference_titles && profile.reference_titles.length > 0) ||
        (profile.themes && profile.themes.length > 0) ||
        (profile.experience && profile.experience.length > 0) ||
        (profile.languages && profile.languages.length > 0) ||
        (profile.platforms && profile.platforms.length > 0) ||
        (profile.type !== null && profile.type !== undefined) ||
        (profile.min_release_year !== null && profile.min_release_year !== undefined) ||
        (profile.max_release_year !== null && profile.max_release_year !== undefined) ||
        (profile.min_runtime_minutes !== null && profile.min_runtime_minutes !== undefined) ||
        (profile.max_runtime_minutes !== null && profile.max_runtime_minutes !== undefined) ||
        (profile.negative_genres && profile.negative_genres.length > 0) ||
        (profile.negative_themes && profile.negative_themes.length > 0) ||
        (profile.negative_titles && profile.negative_titles.length > 0) ||
        (profile.negative_persons && profile.negative_persons.length > 0) ||
        (profile.negative_franchises && profile.negative_franchises.length > 0);

      if (!hasMeaningfulPreferences || profile.low_confidence) {
        res.json({
          success: true,
          count: 0,
          recommendations: [],
          clarification_needed: true,
          message: "We couldn't identify any clear movie preferences or recognizable entities in your request. Please try describing specific genres, moods, actors, or movie titles you enjoy."
        });
        return;
      }

      const { RecommendationEngine } = await import('../services/recommendation/recommendationEngine');
      const engine = RecommendationEngine.getInstance();
      const result = await engine.recommend(profile, Boolean(debug));

      res.json(result);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      res.status(500).json({ success: false, error: 'Internal server error while generating recommendations' });
    }
  };
}

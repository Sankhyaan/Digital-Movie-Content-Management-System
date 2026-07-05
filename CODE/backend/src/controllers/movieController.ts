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
      };
      const items = await this.service.getAllMovies(filters);
      res.json({ success: true, count: items.length, data: items });
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
}

// =============================================================================
// MOVIE SERVICE — Business Logic Layer
// =============================================================================

import { Content, ContentFilters } from '../models/interfaces';
import { IMovieRepository } from '../repositories/IMovieRepository';

export class MovieService {
  private repository: IMovieRepository;

  constructor(repository: IMovieRepository) {
    this.repository = repository;
  }

  async getAllMovies(filters?: ContentFilters): Promise<Content[]> {
    return this.repository.getAll(filters);
  }

  async getMovieById(id: string): Promise<Content | null> {
    return this.repository.getById(id);
  }

  async getFeaturedMovies(): Promise<Content[]> {
    return this.repository.getFeatured();
  }

  async getTrendingMovies(): Promise<Content[]> {
    return this.repository.getTrending();
  }

  async getAvailableGenres(): Promise<string[]> {
    return this.repository.getGenres();
  }

  async searchMovies(query: string): Promise<Content[]> {
    if (!query || query.trim().length === 0) {
      return this.repository.getAll();
    }
    return this.repository.search(query.trim());
  }

  async getRecommendations(
    vibe: string | null,
    type: string | null,
    maxDuration: number | null,
    minYear: number | null,
    minRating: number | null
  ): Promise<Content[]> {
    return this.repository.getRecommendations(vibe, type, maxDuration, minYear, minRating);
  }
}

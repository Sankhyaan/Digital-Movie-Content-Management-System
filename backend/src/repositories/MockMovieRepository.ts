// @ts-nocheck — Legacy mock, no longer used in production (SQLMovieRepository is active)
// =============================================================================
// MOCK MOVIE REPOSITORY — In-Memory Implementation
// =============================================================================
// This class implements IMovieRepository using hardcoded JSON data.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  THIS IS THE FILE YOU REPLACE when connecting a real database.          │
// │                                                                        │
// │  Create a new class (e.g., SQLMovieRepository) that implements         │
// │  IMovieRepository, then replace each method body with your DB query.   │
// │                                                                        │
// │  Example for PostgreSQL:                                               │
// │    async getAll(filters?: MovieFilters): Promise<Movie[]> {            │
// │      const result = await pool.query('SELECT * FROM movies');          │
// │      return result.rows;                                               │
// │    }                                                                   │
// └─────────────────────────────────────────────────────────────────────────┘
// =============================================================================

import { Movie, MovieFilters } from '../models/interfaces';
import { IMovieRepository } from './IMovieRepository';
import { mockMovies } from '../data/mockData';

export class MockMovieRepository implements IMovieRepository {
  private movies: Movie[] = mockMovies;

  /**
   * Get all movies with optional filtering.
   * TODO: Replace with actual DB query, e.g.:
   *   SELECT * FROM movies WHERE genre = $1 AND EXTRACT(YEAR FROM release_date) = $2
   */
  async getAll(filters?: MovieFilters): Promise<Movie[]> {
    let result = [...this.movies];

    if (filters?.genre) {
      result = result.filter((m) =>
        m.genres.some((g) => g.toLowerCase() === filters.genre!.toLowerCase())
      );
    }

    if (filters?.year) {
      result = result.filter(
        (m) => new Date(m.releaseDate).getFullYear().toString() === filters.year
      );
    }

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(term) ||
          m.synopsis.toLowerCase().includes(term)
      );
    }

    if (filters?.language) {
      result = result.filter(
        (m) => m.language.toLowerCase() === filters.language!.toLowerCase()
      );
    }

    return result;
  }

  /**
   * Get a single movie by ID.
   * TODO: Replace with actual DB query, e.g.:
   *   SELECT * FROM movies WHERE id = $1
   */
  async getById(id: string): Promise<Movie | null> {
    return this.movies.find((m) => m.id === id) || null;
  }

  /**
   * Get featured movies.
   * TODO: Replace with actual DB query, e.g.:
   *   SELECT * FROM movies WHERE is_featured = true
   */
  async getFeatured(): Promise<Movie[]> {
    return this.movies.filter((m) => m.isFeatured);
  }

  /**
   * Get trending movies.
   * TODO: Replace with actual DB query, e.g.:
   *   SELECT * FROM movies WHERE is_trending = true
   */
  async getTrending(): Promise<Movie[]> {
    return this.movies.filter((m) => m.isTrending);
  }

  /**
   * Get all unique genres across all movies.
   * TODO: Replace with actual DB query, e.g.:
   *   SELECT DISTINCT genre FROM movie_genres
   */
  async getGenres(): Promise<string[]> {
    const genreSet = new Set<string>();
    this.movies.forEach((m) => m.genres.forEach((g) => genreSet.add(g)));
    return Array.from(genreSet).sort();
  }

  /**
   * Search movies by title.
   * TODO: Replace with actual DB query, e.g.:
   *   SELECT * FROM movies WHERE title ILIKE '%' || $1 || '%'
   */
  async search(query: string): Promise<Movie[]> {
    const term = query.toLowerCase();
    return this.movies.filter(
      (m) =>
        m.title.toLowerCase().includes(term) ||
        m.synopsis.toLowerCase().includes(term) ||
        m.genres.some((g) => g.toLowerCase().includes(term))
    );
  }

  async getRecommendations(
    vibe: string | null,
    type: string | null,
    maxDuration: number | null,
    minYear: number | null,
    minRating: number | null
  ): Promise<Movie[]> {
    // Basic mock implementation for testing without DB
    return this.movies.slice(0, 3);
  }
}

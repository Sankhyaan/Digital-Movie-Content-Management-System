// =============================================================================
// REPOSITORY INTERFACE — IMovieRepository
// =============================================================================
// Defines the contract every data source must satisfy.
// The name "Movie" is kept for backward compatibility; it now covers both
// Movie and Series content (typed as Content in interfaces.ts).
// =============================================================================

import { Content, ContentFilters } from '../models/interfaces';

export interface IMovieRepository {
  /** Get all content, optionally filtered. */
  getAll(filters?: ContentFilters): Promise<Content[]>;

  /** Get a single content item by its content_id. Returns null if not found. */
  getById(id: string): Promise<Content | null>;

  /** Get top-rated content (rating >= 8.0) for the featured carousel. */
  getFeatured(): Promise<Content[]>;

  /** Get the most recently released content as "trending". */
  getTrending(): Promise<Content[]>;

  /** Get all distinct genre names. */
  getGenres(): Promise<string[]>;

  /** Full-text search by title. */
  search(query: string): Promise<Content[]>;

  /** CineMatch Recommendation Engine - Calls Stored Procedure */
  getRecommendations(
    vibe: string | null,
    type: string | null,
    maxDuration: number | null,
    minYear: number | null,
    minRating: number | null
  ): Promise<Content[]>;
}

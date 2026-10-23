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

  async getCount(filters?: ContentFilters): Promise<number> {
    return this.repository.count(filters);
  }

  async getMovieById(id: string): Promise<Content | null> {
    const item = await this.repository.getById(id);
    if (item) return item;

    // Fallback: look up in CandidateRetriever MovieDNA catalog
    try {
      const { CandidateRetriever } = await import('./recommendation/candidateRetriever');
      const dna = CandidateRetriever.getInstance().getMovieDNA(Number(id));
      if (dna) {
        return {
          contentId: dna.content_id,
          title: dna.title,
          releaseYear: dna.release_year ?? null,
          type: dna.type,
          tmdbId: (dna as any).tmdb_id ?? null,
          posterPath: (dna as any).poster_path ?? null,
          rating: dna.rating ?? null,
          description: dna.description ?? null,
          backdropPath: (dna as any).backdrop_path ?? null,
          trailerKey: (dna as any).trailer_key ?? null,
          duration: dna.runtime ?? null,
          totalSeasons: dna.series_metadata?.total_seasons ?? null,
          seasons: [],
          genres: dna.genres || [],
          actors: (dna.actors || []).map((name, i) => ({ actorId: i + 1, name, profilePath: null, roleName: null })),
          directors: (dna.directors || []).map((name, i) => ({ directorId: i + 1, name, profilePath: null })),
          languages: (dna.languages || []).map((name, i) => ({ languageId: i + 1, languageName: name, type: 'Original' as const })),
          platforms: (dna.platforms || []).map((name, i) => ({ platformId: i + 1, name, availableFrom: '2020-01-01', availableTill: null, region: 'GLOBAL' })),
        };
      }
    } catch {
      // Fallback gracefully
    }

    return null;
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

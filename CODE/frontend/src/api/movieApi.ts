// =============================================================================
// API CLIENT — All content data from your MySQL database (project)
// Poster images use TMDB image CDN since poster_path stores TMDB relative paths
// =============================================================================

import axios from 'axios';

const API_BASE = '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ── Image resolver ────────────────────────────────────────────────────────────
// Your database's poster_path column stores TMDB relative paths e.g. "/abc.jpg"
// We prefix the TMDB image CDN to turn them into loadable URLs.
// No content data is ever fetched from TMDB — only static image files.
const TMDB_CDN = 'https://image.tmdb.org/t/p';

export const posterUrl = (path: string | null | undefined, title = ''): string => {
  if (!path) return placeholder(title);
  if (path.startsWith('http')) return path;
  return `${TMDB_CDN}/w342${path.startsWith('/') ? path : '/' + path}`;
};

export const backdropUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_CDN}/w1280${path.startsWith('/') ? path : '/' + path}`;
};

const placeholder = (title = ''): string =>
  `https://placehold.co/300x450/060609/10b981?text=${encodeURIComponent(title || 'No Image')}`;

// ── Shared filter / preference shapes ────────────────────────────────────────

export interface MovieFilters {
  genre?: string;
  year?: string;
  search?: string;
  language?: string;
  type?: string;
}

export interface RecommendationPreferences {
  vibe?: string | null;
  type?: string | null;
  maxDuration?: number | null;
  minYear?: number | null;
  minRating?: number | null;
}

// ── API methods (all hit your Express backend → your MySQL database) ───────────

export async function fetchMovies(filters: MovieFilters = {}): Promise<Movie[]> {
  const params: Record<string, string> = {};
  if (filters.genre)    params.genre    = filters.genre;
  if (filters.year)     params.year     = filters.year;
  if (filters.search)   params.search   = filters.search;
  if (filters.language) params.language = filters.language;
  if (filters.type)     params.type     = filters.type;
  const { data } = await api.get('/movies', { params });
  return data.data;
}

export async function fetchFeaturedMovies(): Promise<Movie[]> {
  const { data } = await api.get('/movies/featured');
  return data.data;
}

export async function fetchTrendingMovies(): Promise<Movie[]> {
  const { data } = await api.get('/movies/trending');
  return data.data;
}

export async function fetchGenres(): Promise<string[]> {
  const { data } = await api.get('/movies/genres');
  return data.data;
}

export async function searchMovies(query: string): Promise<Movie[]> {
  const { data } = await api.get('/movies/search', { params: { q: query } });
  return data.data;
}

export async function fetchMovieById(id: string | undefined): Promise<MovieDetail> {
  const { data } = await api.get(`/movies/${id}`);
  return data.data;
}

export async function fetchRecommendations(preferences: RecommendationPreferences): Promise<Movie[]> {
  const params: Record<string, string> = {};
  if (preferences.vibe != null)        params.vibe = preferences.vibe;
  if (preferences.type != null)        params.type = preferences.type;
  if (preferences.maxDuration != null) params.maxDuration = String(preferences.maxDuration);
  if (preferences.minYear != null)     params.minYear = String(preferences.minYear);
  if (preferences.minRating != null)   params.minRating = String(preferences.minRating);

  const { data } = await api.get('/movies/recommend', { params });
  return data.data;
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface Platform {
  platformId: number;
  name: string;
  region?: string;
  availableFrom?: string;
  availableTill?: string;
}

export interface Language {
  languageId: number;
  languageName: string;
  type: string;
}

export interface Movie {
  contentId: number;
  title: string;
  type: 'Movie' | 'Series';
  posterPath?: string;
  rating?: number | null;
  releaseYear?: number;
  duration?: number;
  totalSeasons?: number;
  genres?: string[];
  platforms?: Platform[];
  languages?: Language[];
}

export interface Actor {
  actorId: number;
  name: string;
  roleName?: string;
}

export interface Episode {
  episodeId: number;
  episodeNumber?: number;
  title?: string;
  duration?: number;
}

export interface Season {
  seasonId: number;
  seasonNumber: number;
  episodes: Episode[];
}

export interface MovieDetail extends Movie {
  description?: string | null;
  actors?: Actor[];
  seasons?: Season[];
}

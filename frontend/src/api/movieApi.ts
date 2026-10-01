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

export const actorProfileUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_CDN}/w185${path.startsWith('/') ? path : '/' + path}`;
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
  limit?: number | string;
  offset?: number | string;
}

export interface RecommendationPreferences {
  vibe?: string | null;
  type?: string | null;
  maxDuration?: number | null;
  minYear?: number | null;
  minRating?: number | null;
}

// ── Ultra-fast Client-side Cache ─────────────────────────────────────────────
// Keeps fetched data in memory and sessionStorage so page transitions and
// reloads/navigating back are 100% INSTANT with zero network delay.

const apiMemoryCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache validity

export function getCachedData<T>(key: string): T | null {
  const mem = apiMemoryCache.get(key);
  if (mem && mem.expiry > Date.now()) {
    return mem.data as T;
  }
  try {
    const raw = sessionStorage.getItem('cv_cache_' + key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.expiry > Date.now()) {
        apiMemoryCache.set(key, parsed);
        return parsed.data as T;
      }
    }
  } catch {}
  return null;
}

export function setCachedData<T>(key: string, data: T, ttl = CACHE_TTL): void {
  const item = { data, expiry: Date.now() + ttl };
  apiMemoryCache.set(key, item);
  try {
    sessionStorage.setItem('cv_cache_' + key, JSON.stringify(item));
  } catch {}
}

// ── API methods (all hit your Express backend → your MySQL database) ───────────

export async function fetchMovies(filters: MovieFilters = {}, forceFresh = false): Promise<Movie[]> {
  const cacheKey = 'movies_' + JSON.stringify(filters);
  if (!forceFresh) {
    const cached = getCachedData<Movie[]>(cacheKey);
    if (cached) return cached;
  }

  const params: Record<string, string> = {};
  if (filters.genre)    params.genre    = filters.genre;
  if (filters.year)     params.year     = filters.year;
  if (filters.search)   params.search   = filters.search;
  if (filters.language) params.language = filters.language;
  if (filters.type)     params.type     = filters.type;
  if (filters.limit)    params.limit    = String(filters.limit);
  if (filters.offset)   params.offset   = String(filters.offset);

  const { data } = await api.get('/movies', { params });
  setCachedData(cacheKey, data.data);
  return data.data;
}

export async function fetchFeaturedMovies(forceFresh = false): Promise<Movie[]> {
  const cacheKey = 'movies_featured';
  if (!forceFresh) {
    const cached = getCachedData<Movie[]>(cacheKey);
    if (cached) return cached;
  }
  const { data } = await api.get('/movies/featured');
  setCachedData(cacheKey, data.data);
  return data.data;
}

export async function fetchTrendingMovies(forceFresh = false): Promise<Movie[]> {
  const cacheKey = 'movies_trending';
  if (!forceFresh) {
    const cached = getCachedData<Movie[]>(cacheKey);
    if (cached) return cached;
  }
  const { data } = await api.get('/movies/trending');
  setCachedData(cacheKey, data.data);
  return data.data;
}

export async function fetchGenres(forceFresh = false): Promise<string[]> {
  const cacheKey = 'genres_all';
  if (!forceFresh) {
    const cached = getCachedData<string[]>(cacheKey);
    if (cached) return cached;
  }
  const { data } = await api.get('/movies/genres');
  setCachedData(cacheKey, data.data);
  return data.data;
}

export async function searchMovies(query: string): Promise<Movie[]> {
  const cacheKey = 'search_' + query.trim().toLowerCase();
  const cached = getCachedData<Movie[]>(cacheKey);
  if (cached) return cached;

  const { data } = await api.get('/movies/search', { params: { q: query } });
  setCachedData(cacheKey, data.data, 2 * 60 * 1000); // 2 min cache for searches
  return data.data;
}

export async function fetchMovieById(id: string | undefined, forceFresh = false): Promise<MovieDetail> {
  if (!id) throw new Error('No id provided');
  const cacheKey = 'movie_detail_' + id;
  if (!forceFresh) {
    const cached = getCachedData<MovieDetail>(cacheKey);
    if (cached) return cached;
  }
  const { data } = await api.get(`/movies/${id}`);
  setCachedData(cacheKey, data.data);
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
  backdropPath?: string | null;
  trailerKey?: string | null;
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
  profilePath?: string | null;
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

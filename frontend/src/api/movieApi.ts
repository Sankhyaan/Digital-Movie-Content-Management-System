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
    const serialized = JSON.stringify(item);
    if (serialized.length < 500000) {
      sessionStorage.setItem('cv_cache_' + key, serialized);
    }
  } catch {}
}

// ── API methods (all hit your Express backend → your MySQL database) ───────────

export interface FetchMoviesResult {
  movies: Movie[];
  total: number;
}

export async function fetchMoviesWithCount(
  filters: MovieFilters = {},
  forceFresh = false
): Promise<FetchMoviesResult> {
  const cacheKey = 'movies_cnt_' + JSON.stringify(filters);
  if (!forceFresh) {
    const cached = getCachedData<FetchMoviesResult>(cacheKey);
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
  const result: FetchMoviesResult = {
    movies: data.data || [],
    total: data.total ?? data.count ?? (data.data || []).length,
  };
  setCachedData(cacheKey, result);
  return result;
}

export async function fetchMovies(filters: MovieFilters = {}, forceFresh = false): Promise<Movie[]> {
  const res = await fetchMoviesWithCount(filters, forceFresh);
  return res.movies;
}

export async function fetchFeaturedMovies(_forceFresh = true): Promise<Movie[]> {
  const { data } = await api.get('/movies/featured', {
    params: { _t: Date.now() },
  });
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
  description?: string | null;
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

// ── Common User Preference Profile ───────────────────────────────────────────
export interface UserPreferenceProfile {
  source: 'guided' | 'custom';
  experience: string[];
  type: 'Movie' | 'Series' | null;
  genres: string[];
  languages: string[];
  platforms: string[];
  runtime_preference:
    | 'under_2_hours'
    | 'around_2_hours'
    | 'long_movie_ok'
    | 'binge_series'
    | 'no_preference'
    | null;
  runtime_relation:
    | 'shorter_than_reference'
    | 'longer_than_reference'
    | null;
  era_preference:
    | 'recent'
    | 'modern'
    | 'classic'
    | 'any'
    | null;
  quality_preference:
    | 'high'
    | 'medium'
    | 'low'
    | null;
  themes: string[];
  reference_titles: string[];
  free_text: string | null;

  // Quality Tuning Phase 2 Extensions:
  negative_themes: string[];
  negative_genres: string[];
  negative_keywords: string[];

  // Exact runtime constraints:
  max_runtime_minutes: number | null;
  min_runtime_minutes: number | null;
  runtime_is_hard_constraint: boolean;

  // Exact release year ranges:
  min_release_year: number | null;
  max_release_year: number | null;
  year_range_is_hard: boolean;

  // Actor & Director Support
  actors: string[];
  directors: string[];
  actor_match_mode?: 'all' | 'any';

  // Negative Entity Fields (Phase 1 Extensions)
  negative_titles: string[];
  negative_persons: string[];
  negative_franchises: string[];

  // Unresolved Entity Diagnostics (Phase 1 Extensions)
  unresolved_references: string[];
  unresolved_persons: string[];

  // Diagnostic flags
  is_degraded?: boolean;
  low_confidence?: boolean;
}

export async function buildPreferenceProfile(
  payload: { source: 'guided'; answers: any } | { source: 'custom'; prompt: string }
): Promise<{ profile: UserPreferenceProfile; validation: { valid: boolean; errors: string[] } }> {
  const res = await api.post('/movies/profile', payload);
  return res.data;
}

// ── Hybrid Recommendation Engine Response Types ────────────────────────────

export interface ReferenceAffinityBreakdown {
  reference_title: string;
  semantic_similarity: number;
  genre_affinity: number;
  format_alignment: number;
  combined_affinity: number;
}

export interface ScoreBreakdown {
  semantic: number;
  experience: number;
  genre: number;
  reference: number;
  runtime: number;
  era: number;
  quality: number;
  language: number;
  platform: number;
  negative_penalty?: number;
  negative_match?: number;
  reference_details?: ReferenceAffinityBreakdown;
}

export interface RecommendationResult {
  content_id: number;
  title: string;
  type: 'Movie' | 'Series';
  poster_path: string | null;
  rating: number | null;
  release_year: number | null;
  genres?: string[];
  recommendation_score: number;
  match_percentage: number;
  score_breakdown: ScoreBreakdown;
  reference_details?: ReferenceAffinityBreakdown;
  match_reasons: string[];
}

export interface RecommendationDebugInfo {
  candidate_pool_size: number;
  top_candidates?: Array<{
    content_id: number;
    title: string;
    hybrid_score: number;
  }>;
  active_weights: Record<string, number>;
  execution_time_ms: {
    query_embedding_ms: number;
    candidate_retrieval_ms: number;
    feature_scoring_ms: number;
    total_ms: number;
  };
}

export interface RecommendationResponse {
  success: boolean;
  count: number;
  recommendations: RecommendationResult[];
  clarification_needed?: boolean;
  message?: string;
  debug?: RecommendationDebugInfo;
}

export async function getRecommendations(
  profile: UserPreferenceProfile,
  debug = false
): Promise<RecommendationResponse> {
  const { data } = await api.post('/movies/recommend', { profile, debug });
  return data;
}


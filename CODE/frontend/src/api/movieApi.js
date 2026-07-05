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

export const posterUrl = (path, title = '') => {
  if (!path) return placeholder(title);
  if (path.startsWith('http')) return path;
  return `${TMDB_CDN}/w342${path.startsWith('/') ? path : '/' + path}`;
};

export const backdropUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_CDN}/w1280${path.startsWith('/') ? path : '/' + path}`;
};

const placeholder = (title = '') =>
  `https://placehold.co/300x450/060609/10b981?text=${encodeURIComponent(title || 'No Image')}`;

// ── API methods (all hit your Express backend → your MySQL database) ───────────

export async function fetchMovies(filters = {}) {
  const params = {};
  if (filters.genre)    params.genre    = filters.genre;
  if (filters.year)     params.year     = filters.year;
  if (filters.search)   params.search   = filters.search;
  if (filters.language) params.language = filters.language;
  if (filters.type)     params.type     = filters.type;
  const { data } = await api.get('/movies', { params });
  return data.data;
}

export async function fetchFeaturedMovies() {
  const { data } = await api.get('/movies/featured');
  return data.data;
}

export async function fetchTrendingMovies() {
  const { data } = await api.get('/movies/trending');
  return data.data;
}

export async function fetchGenres() {
  const { data } = await api.get('/movies/genres');
  return data.data;
}

export async function searchMovies(query) {
  const { data } = await api.get('/movies/search', { params: { q: query } });
  return data.data;
}

export async function fetchMovieById(id) {
  const { data } = await api.get(`/movies/${id}`);
  return data.data;
}

export async function fetchRecommendations(preferences) {
  const params = {};
  if (preferences.vibe)        params.vibe = preferences.vibe;
  if (preferences.type)        params.type = preferences.type;
  if (preferences.maxDuration) params.maxDuration = preferences.maxDuration;
  if (preferences.minYear)     params.minYear = preferences.minYear;
  if (preferences.minRating)   params.minRating = preferences.minRating;
  
  const { data } = await api.get('/movies/recommend', { params });
  return data.data;
}

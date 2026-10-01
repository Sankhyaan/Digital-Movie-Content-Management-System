// =============================================================================
// WATCHLIST CONTEXT — Client-side State Management
// =============================================================================
// Uses React Context + useReducer for watchlist operations.
// Persists to localStorage so the watchlist survives page refreshes.
// =============================================================================

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { Movie } from '../api/movieApi';

// ── Context shape ─────────────────────────────────────────────────────────

interface WatchlistContextValue {
  watchlist: Movie[];
  addToWatchlist: (movie: Movie) => void;
  removeFromWatchlist: (movieId: number) => void;
  isInWatchlist: (movieId: number) => boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

const STORAGE_KEY = 'cineverse_watchlist';

// ── Actions ───────────────────────────────────────────────────────────────

type Action =
  | { type: 'ADD_TO_WATCHLIST'; payload: Movie }
  | { type: 'REMOVE_FROM_WATCHLIST'; payload: number };

const ACTIONS = {
  ADD: 'ADD_TO_WATCHLIST' as const,
  REMOVE: 'REMOVE_FROM_WATCHLIST' as const,
};

// ── Reducer ───────────────────────────────────────────────────────────────

function watchlistReducer(state: Movie[], action: Action): Movie[] {
  switch (action.type) {
    case ACTIONS.ADD: {
      if (state.some((m) => m.contentId === action.payload.contentId)) return state;
      return [...state, action.payload];
    }
    case ACTIONS.REMOVE:
      return state.filter((m) => m.contentId !== action.payload);
    default:
      return state;
  }
}

// ── Initializer ───────────────────────────────────────────────────────────

function initWatchlist(): Movie[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as Movie[];
  } catch (err) {
    console.error('Failed to load watchlist:', err);
  }
  return [];
}

// ── Provider Component ────────────────────────────────────────────────────

interface WatchlistProviderProps {
  children: ReactNode;
}

export function WatchlistProvider({ children }: WatchlistProviderProps) {
  const [watchlist, dispatch] = useReducer(watchlistReducer, [], initWatchlist);

  // Save to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch (err) {
      console.error('Failed to save watchlist:', err);
    }
  }, [watchlist]);

  const addToWatchlist = (movie: Movie) => {
    dispatch({ type: ACTIONS.ADD, payload: movie });
  };

  const removeFromWatchlist = (movieId: number) => {
    dispatch({ type: ACTIONS.REMOVE, payload: movieId });
  };

  const isInWatchlist = (movieId: number): boolean => {
    return watchlist.some((m) => m.contentId === movieId);
  };

  return (
    <WatchlistContext.Provider
      value={{ watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

// ── Custom Hook ───────────────────────────────────────────────────────────

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
}

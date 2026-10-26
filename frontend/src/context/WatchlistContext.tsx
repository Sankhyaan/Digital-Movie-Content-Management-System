// =============================================================================
// WATCHLIST CONTEXT — Client-side State Management
// =============================================================================
// Uses React Context + useReducer for watchlist operations.
// Persists to localStorage so the watchlist survives page refreshes.
// =============================================================================

import { createContext, useContext, useReducer, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type { Movie } from '../api/movieApi';

// ── Context shape ─────────────────────────────────────────────────────────

interface WatchlistContextValue {
  watchlist: Movie[];
  addToWatchlist: (movie: Movie) => void;
  removeFromWatchlist: (movieId: number) => void;
  clearWatchlist: () => void;
  isInWatchlist: (movieId: number) => boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

const STORAGE_KEY = 'cineverse_watchlist';

// ── Actions ───────────────────────────────────────────────────────────────

type Action =
  | { type: 'ADD_TO_WATCHLIST'; payload: Movie }
  | { type: 'REMOVE_FROM_WATCHLIST'; payload: number }
  | { type: 'CLEAR_WATCHLIST' };

const ACTIONS = {
  ADD: 'ADD_TO_WATCHLIST' as const,
  REMOVE: 'REMOVE_FROM_WATCHLIST' as const,
  CLEAR: 'CLEAR_WATCHLIST' as const,
};

// ── Reducer ───────────────────────────────────────────────────────────────

function watchlistReducer(state: Movie[], action: Action): Movie[] {
  const currentList = Array.isArray(state) ? state : [];
  switch (action.type) {
    case ACTIONS.ADD: {
      if (!action.payload || action.payload.contentId == null) return currentList;
      if (currentList.some((m) => m && m.contentId === action.payload.contentId)) return currentList;
      return [...currentList, action.payload];
    }
    case ACTIONS.REMOVE:
      if (action.payload == null) return currentList;
      return currentList.filter((m) => m && m.contentId !== action.payload);
    case ACTIONS.CLEAR:
      return [];
    default:
      return currentList;
  }
}

// ── Initializer ───────────────────────────────────────────────────────────

function initWatchlist(): Movie[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (m): m is Movie => Boolean(m && typeof m === 'object' && m.contentId != null)
        );
      }
    }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist || []));
    } catch (err) {
      console.error('Failed to save watchlist:', err);
    }
  }, [watchlist]);

  const watchlistIdSet = useMemo(() => {
    const set = new Set<number>();
    if (Array.isArray(watchlist)) {
      for (const m of watchlist) {
        if (m && m.contentId != null) set.add(m.contentId);
      }
    }
    return set;
  }, [watchlist]);

  const addToWatchlist = useCallback((movie: Movie) => {
    if (!movie || movie.contentId == null) return;
    dispatch({ type: ACTIONS.ADD, payload: movie });
  }, []);

  const removeFromWatchlist = useCallback((movieId: number) => {
    if (movieId == null) return;
    dispatch({ type: ACTIONS.REMOVE, payload: movieId });
  }, []);

  const clearWatchlist = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR });
  }, []);

  const isInWatchlist = useCallback(
    (movieId: number): boolean => {
      if (movieId == null) return false;
      return watchlistIdSet.has(movieId);
    },
    [watchlistIdSet]
  );

  const contextValue = useMemo(
    () => ({
      watchlist: watchlist || [],
      addToWatchlist,
      removeFromWatchlist,
      clearWatchlist,
      isInWatchlist,
    }),
    [watchlist, addToWatchlist, removeFromWatchlist, clearWatchlist, isInWatchlist]
  );

  return (
    <WatchlistContext.Provider value={contextValue}>
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

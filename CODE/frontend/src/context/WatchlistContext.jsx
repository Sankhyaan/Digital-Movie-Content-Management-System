// =============================================================================
// WATCHLIST CONTEXT — Client-side State Management
// =============================================================================
// Uses React Context + useReducer for watchlist operations.
// Persists to localStorage so the watchlist survives page refreshes.
// =============================================================================

import { createContext, useContext, useReducer, useEffect } from 'react';

const WatchlistContext = createContext(null);

const STORAGE_KEY = 'cineverse_watchlist';

// ── Actions ──────────────────────────────────────────────────────────────
const ACTIONS = {
  ADD: 'ADD_TO_WATCHLIST',
  REMOVE: 'REMOVE_FROM_WATCHLIST',
};

// ── Reducer ──────────────────────────────────────────────────────────────
function watchlistReducer(state, action) {
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

// ── Initializer ──────────────────────────────────────────────────────────
function initWatchlist() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.error('Failed to load watchlist:', err);
  }
  return [];
}

// ── Provider Component ───────────────────────────────────────────────────
export function WatchlistProvider({ children }) {
  const [watchlist, dispatch] = useReducer(watchlistReducer, [], initWatchlist);

  // Save to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch (err) {
      console.error('Failed to save watchlist:', err);
    }
  }, [watchlist]);

  const addToWatchlist = (movie) => {
    dispatch({ type: ACTIONS.ADD, payload: movie });
  };

  const removeFromWatchlist = (movieId) => {
    dispatch({ type: ACTIONS.REMOVE, payload: movieId });
  };

  const isInWatchlist = (movieId) => {
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

// ── Custom Hook ──────────────────────────────────────────────────────────
export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWatchlist } from '../context/WatchlistContext';
import MovieCard from '../components/MovieCard';

export default function WatchlistPage() {
  const { watchlist } = useWatchlist();
  const [filterType, setFilterType] = useState<'All' | 'Movie' | 'Series'>('All');
  const items = Array.isArray(watchlist) ? watchlist : [];
  const count = items.length;

  useEffect(() => {
    document.title = count > 0 ? `My Watchlist (${count}) | CineVerse` : 'My Watchlist | CineVerse';
  }, [count]);

  const filteredItems = items.filter((m) => {
    if (filterType === 'All') return true;
    return m.type === filterType;
  });

  return (
    <div id="watchlist-page" style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1450px', width: '100%', margin: '0 auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 className="font-outfit font-black text-3xl sm:text-4xl text-white tracking-tight">
            My <span className="text-sky-400">Watchlist</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {count} {count === 1 ? 'title' : 'titles'} saved
          </p>
        </div>

        {count > 0 && (
          <div className="flex items-center gap-2">
            {(['All', 'Movie', 'Series'] as const).map((t) => {
              const label = t === 'All' ? 'All' : t === 'Movie' ? 'Movies' : 'TV Shows';
              const isSelected = filterType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-400/35 shadow-sm shadow-sky-500/15'
                      : 'bg-white/[0.04] text-neutral-400 hover:text-white border border-white/[0.08]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {count > 0 ? (
        filteredItems.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '22px' }}>
            {filteredItems.map((movie, index) => (
              <MovieCard key={movie.contentId || index} movie={movie} index={index} />
            ))}
          </div>
        ) : (
          <div style={{ minHeight: '30vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
            <p style={{ fontSize: '0.95rem' }}>No {filterType === 'Movie' ? 'movies' : 'TV shows'} found in your watchlist.</p>
          </div>
        )
      ) : (
        <div style={{ minHeight: '52vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px', flex: 1 }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(14, 165, 233, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
            className="shadow-lg shadow-sky-500/10"
          >
            <span style={{ fontSize: '26px' }}>🎬</span>
          </div>
          <h3 className="font-outfit font-bold text-xl text-white" style={{ marginBottom: '8px' }}>
            Your watchlist is empty
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '420px', lineHeight: 1.6, marginBottom: '28px' }}>
            Browse titles and click the bookmark button on any movie or show to save it here.
          </p>
          <Link
            to="/search"
            style={{
              padding: '12px 28px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(14, 165, 233, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-sky-500/30"
          >
            Explore Titles
          </Link>
        </div>
      )}
    </div>
  );
}

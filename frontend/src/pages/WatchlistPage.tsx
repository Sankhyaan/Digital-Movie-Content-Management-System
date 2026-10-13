import React from 'react';
import { Link } from 'react-router-dom';
import { useWatchlist } from '../context/WatchlistContext';
import MovieCard from '../components/MovieCard';

export default function WatchlistPage() {
  const { watchlist } = useWatchlist();

  return (
    <div id="watchlist-page" style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1450px', width: '100%', margin: '0 auto', flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h1 className="font-outfit font-black text-3xl sm:text-4xl text-white tracking-tight">
          My <span className="text-sky-400">Watchlist</span>
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          {watchlist.length} titles saved
        </p>
      </div>

      {watchlist.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '22px' }}>
          {watchlist.map((movie, index) => (
            <MovieCard key={movie.contentId} movie={movie} index={index} />
          ))}
        </div>
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
          >
            <span style={{ fontSize: '26px' }}>🎬</span>
          </div>
          <h3 className="font-outfit font-bold text-xl text-white" style={{ marginBottom: '8px' }}>
            Your watchlist is empty
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '420px', lineHeight: 1.6, marginBottom: '28px' }}>
            Browse titles and hit the + button on any movie or show to save it here.
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
              transition: 'all 0.2s',
            }}
            className="hover:scale-105 transition-transform"
          >
            Explore Titles
          </Link>
        </div>
      )}
    </div>
  );
}

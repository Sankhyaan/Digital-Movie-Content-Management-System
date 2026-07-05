import { Link } from 'react-router-dom';
import { useWatchlist } from '../context/WatchlistContext';
import { posterUrl } from '../api/movieApi';

export default function MovieCard({ movie, index = 0 }) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const inWatchlist = isInWatchlist(movie.contentId);

  const toggle = (e) => {
    e.preventDefault(); e.stopPropagation();
    inWatchlist ? removeFromWatchlist(movie.contentId) : addToWatchlist(movie);
  };

  const src    = posterUrl(movie.posterPath, movie.title);
  const rating = movie.rating != null ? Number(movie.rating).toFixed(1) : null;
  const year   = movie.releaseYear ?? '';
  const genre  = movie.genres?.[0] ?? '';

  return (
    <Link to={`/movie/${movie.contentId}`} id={`movie-card-${movie.contentId}`}
      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      {/* Poster */}
      <div style={{
        position: 'relative', borderRadius: '10px', overflow: 'hidden',
        aspectRatio: '2 / 3', background: '#0d140d',
        boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), box-shadow 0.28s',
        border: '1px solid rgba(16,185,129,0.08)',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.055) translateY(-6px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(16,185,129,0.22)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.28)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.55)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.08)'; }}
      >
        <img src={src} alt={movie.title} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => { e.target.src = `https://placehold.co/300x450/060609/10b981?text=${encodeURIComponent(movie.title)}`; }}
        />
        {/* Bottom gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,6,9,0.92) 0%, rgba(6,6,9,0.08) 45%, transparent 100%)', pointerEvents: 'none' }} />
        {/* Type icon */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '0.85rem' }}>{movie.type === 'Series' ? '📺' : '🎬'}</div>
        {/* Rating */}
        {rating && <div className="rating-badge" style={{ position: 'absolute', bottom: '8px', left: '8px', fontSize: '0.7rem', padding: '2px 7px' }}>★ {rating}</div>}
        {/* Watchlist */}
        <button onClick={toggle}
          style={{
            position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: inWatchlist ? 'var(--accent-primary)' : 'rgba(0,0,0,0.6)',
            border: `1px solid ${inWatchlist ? 'var(--accent-primary)' : 'rgba(16,185,129,0.25)'}`,
            color: '#fff', cursor: 'pointer', fontSize: '0.78rem', backdropFilter: 'blur(8px)',
            transition: 'background 0.18s',
          }}
          onMouseEnter={(e) => { if (!inWatchlist) e.currentTarget.style.background = 'rgba(16,185,129,0.3)'; }}
          onMouseLeave={(e) => { if (!inWatchlist) e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}
        >{inWatchlist ? '✓' : '+'}</button>
      </div>
      {/* Title + meta */}
      <div style={{ marginTop: '12px', padding: '0 2px' }}>
        <p style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f0fdf4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px', lineHeight: 1.3 }}>
          {movie.title}
        </p>
        <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>{year}</span>
          {genre && <><span style={{ color: 'rgba(16,185,129,0.45)' }}>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{genre}</span></>}
        </p>
      </div>
    </Link>
  );
}

import { Link } from 'react-router-dom';
import { useWatchlist } from '../context/WatchlistContext';
import MovieCard from '../components/MovieCard';

const CONTAINER: React.CSSProperties = {
  maxWidth: 'var(--container-max)',
  margin: '0 auto',
  padding: 'calc(var(--navbar-height) + 32px) 32px 64px',
};

export default function WatchlistPage() {
  const { watchlist } = useWatchlist();

  return (
    <div id="watchlist-page" style={CONTAINER}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
          fontWeight: 800,
          marginBottom: '6px',
        }}>
          My <span className="gradient-text">Watchlist</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {watchlist.length} title{watchlist.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {watchlist.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
          gap: '20px',
        }}>
          {watchlist.map((movie, index) => (
            <MovieCard key={movie.contentId} movie={movie} index={index} />
          ))}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            marginBottom: '20px',
          }}>
            📑
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
            Your watchlist is empty
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '380px', marginBottom: '24px' }}>
            Click the + button on any title to save it here for later.
          </p>
          <Link
            to="/"
            className="btn-primary"
          >
            Explore Titles
          </Link>
        </div>
      )}
    </div>
  );
}

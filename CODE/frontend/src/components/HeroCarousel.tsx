import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { posterUrl, backdropUrl } from '../api/movieApi';
import type { Movie } from '../api/movieApi';

interface HeroCarouselProps {
  movies?: Movie[];
}

export default function HeroCarousel({ movies = [] }: HeroCarouselProps) {
  const [current, setCurrent]  = useState(0);
  const [fading, setFading]    = useState(false);

  const goTo = useCallback((idx: number) => {
    if (fading || movies.length === 0) return;
    setFading(true);
    setTimeout(() => { setCurrent(idx); setFading(false); }, 400);
  }, [fading, movies.length]);

  const next = useCallback(() => goTo((current + 1) % movies.length), [current, movies.length, goTo]);

  useEffect(() => {
    if (movies.length <= 1) return;
    const t = setInterval(next, 7000);
    return () => clearInterval(t);
  }, [next, movies.length]);

  if (movies.length === 0) return <div className="skeleton" style={{ width: '100%', height: '520px', borderRadius: '20px' }} />;

  const movie   = movies[current];
  const poster  = posterUrl(movie.posterPath, movie.title);
  const bd      = backdropUrl(movie.posterPath) || poster;
  const rating  = movie.rating != null ? Number(movie.rating).toFixed(1) : null;
  const year    = movie.releaseYear ?? '';
  const dur     = movie.type === 'Movie' && movie.duration ? `${movie.duration} min` : null;
  const sea     = movie.type === 'Series' && movie.totalSeasons ? `${movie.totalSeasons} Season${movie.totalSeasons > 1 ? 's' : ''}` : null;
  const lang    = movie.languages?.find(l => l.type === 'Original')?.languageName ?? null;

  return (
    <div id="hero-carousel" style={{
      position: 'relative', width: '100%', borderRadius: '20px', overflow: 'hidden',
      height: '520px', background: '#060d08',
      boxShadow: '0 20px 80px rgba(0,0,0,0.8)',
      border: '1px solid rgba(16,185,129,0.12)',
    }}>
      {/* Backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${bd})`,
        backgroundSize: 'cover', backgroundPosition: 'center top',
        filter: 'brightness(0.28) blur(2px)', transform: 'scale(1.04)',
        opacity: fading ? 0 : 1, transition: 'opacity 0.4s ease',
      }} />
      {/* Gradients */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(6,6,9,0.97) 0%, rgba(6,6,9,0.55) 55%, rgba(6,6,9,0.15) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,6,9,1) 0%, rgba(6,6,9,0) 45%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(16,185,129,0.07) 0%, transparent 65%)' }} />

      {/* Content */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        gap: '44px', padding: '0 56px',
        opacity: fading ? 0 : 1, transition: 'opacity 0.3s ease',
      }}>
        {/* Poster thumbnail */}
        <div style={{
          flexShrink: 0, width: '165px', aspectRatio: '2/3', borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 16px 50px rgba(0,0,0,0.75), 0 0 0 1px rgba(16,185,129,0.20)',
        }}>
          <img src={poster} alt={movie.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/300x450/060609/10b981?text=${encodeURIComponent(movie.title)}`; }}
          />
        </div>

        {/* Text */}
        <div style={{ maxWidth: '580px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            <span className="accent-badge" style={{ background: 'rgba(16,185,129,0.18)', borderColor: 'rgba(16,185,129,0.35)' }}>{movie.type}</span>
            {(movie.genres ?? []).slice(0, 3).map(g => <span key={g} className="accent-badge">{g}</span>)}
          </div>

          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(2rem, 4.5vw, 3.4rem)',
            fontWeight: 900, lineHeight: 1.08, color: '#f0fdf4', marginBottom: '16px', letterSpacing: '-0.02em',
          }}>{movie.title}</h1>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' }}>
            {rating && <span className="rating-badge">★ {rating}</span>}
            {(dur || sea) && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{dur ?? sea}</span>}
            {year && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{year}</span>}
            {lang && <span className="accent-badge">{lang}</span>}
          </div>

          {(movie.platforms ?? []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '28px' }}>
              {movie.platforms!.map(p => (
                <span key={p.platformId} style={{
                  padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)',
                }}>{p.name}</span>
              ))}
            </div>
          )}

          <Link to={`/movie/${movie.contentId}`} className="btn-primary" style={{ width: 'fit-content' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            View Details
          </Link>
        </div>
      </div>

      {/* Dots */}
      {movies.length > 1 && (
        <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px' }}>
          {movies.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} style={{
              height: '4px', width: i === current ? '28px' : '8px', borderRadius: '99px',
              background: i === current ? 'var(--accent-primary)' : 'rgba(255,255,255,0.20)',
              border: 'none', cursor: 'pointer', transition: 'width 0.3s, background 0.3s', padding: 0,
            }} />
          ))}
        </div>
      )}

      {/* Arrows */}
      {movies.length > 1 && ([
        { dir: 'left',  label: '‹', fn: () => goTo((current - 1 + movies.length) % movies.length) },
        { dir: 'right', label: '›', fn: next },
      ] as const).map(({ dir, label, fn }) => (
        <button key={dir} onClick={fn} style={{
          position: 'absolute', [dir]: '20px', top: '50%', transform: 'translateY(-50%)',
          width: '40px', height: '40px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,6,9,0.6)', border: '1px solid rgba(16,185,129,0.20)',
          color: '#f0fdf4', cursor: 'pointer', fontSize: '1.4rem', backdropFilter: 'blur(8px)',
          transition: 'background 0.18s, border-color 0.18s', lineHeight: 1,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.18)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.50)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(6,6,9,0.6)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.20)'; }}
        >{label}</button>
      ))}
    </div>
  );
}

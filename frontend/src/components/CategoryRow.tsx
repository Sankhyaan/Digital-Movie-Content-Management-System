import { useRef } from 'react';
import MovieCard from './MovieCard';
import type { Movie } from '../api/movieApi';

interface CategoryRowProps {
  title: string;
  movies?: Movie[];
  icon?: string;
}

export default function CategoryRow({ title, movies = [], icon = '🎬' }: CategoryRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') =>
    ref.current?.scrollBy({ left: dir === 'left' ? -580 : 580, behavior: 'smooth' });

  if (movies.length === 0) return null;

  return (
    <section style={{ marginBottom: '52px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.3rem' }}>{icon}</span>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.2rem', fontWeight: 700, color: '#f0fdf4', letterSpacing: '-0.01em' }}>
            {title}
          </h2>
          <div style={{ height: '3px', width: '36px', borderRadius: '99px', background: 'linear-gradient(135deg, #10b981, #065f46)' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['left', 'right'] as const).map((d) => (
            <button key={d} onClick={() => scroll(d)} style={{
              width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(13,20,13,0.7)', border: '1px solid rgba(16,185,129,0.15)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.18s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'; e.currentTarget.style.color = '#34d399'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.15)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >{d === 'left' ? '‹' : '›'}</button>
          ))}
        </div>
      </div>

      <div ref={ref} style={{
        display: 'flex', gap: '18px', overflowX: 'auto', paddingBottom: '10px',
        scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory',
      }}>
        {movies.map((movie, i) => (
          <div key={movie.contentId} style={{ width: '158px', flexShrink: 0, scrollSnapAlign: 'start' }}>
            <MovieCard movie={movie} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}

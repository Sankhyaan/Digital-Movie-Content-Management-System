import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchMovies, fetchGenres } from '../api/movieApi';
import type { Movie } from '../api/movieApi';
import MovieCard from '../components/MovieCard';

// ── inline SearchBar so it lives inside this page's state ──────────────────

interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

function SearchInput({ value, onChange, onSubmit }: SearchInputProps) {
  return (
    <form onSubmit={onSubmit} style={{ width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <svg
          style={{
            position: 'absolute',
            left: '18px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '20px',
            height: '20px',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="Search for movies, genres, actors..."
          id="explore-search-input"
          style={{
            width: '100%',
            padding: '16px 50px 16px 52px',
            fontSize: '1rem',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'inherit',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'var(--bg-tertiary)',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </form>
  );
}

const YEARS = Array.from({ length: 35 }, (_, i) => (2025 - i).toString());

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies]     = useState<Movie[]>([]);
  const [genres, setGenres]     = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [inputQuery, setInputQuery] = useState('');

  const query = searchParams.get('q')     || '';
  const genre = searchParams.get('genre') || '';
  const year  = searchParams.get('year')  || '';
  const type  = searchParams.get('type')  || '';

  // Keep input in sync when URL changes (e.g. browser back)
  useEffect(() => { setInputQuery(query); }, [query]);

  // Fetch genres once
  useEffect(() => {
    fetchGenres().then(setGenres).catch(console.error);
  }, []);

  // Fetch content whenever filters change
  useEffect(() => {
    async function loadMovies() {
      setLoading(true);
      try {
        const filters: Record<string, string> = {};
        if (query) filters.search = query;
        if (genre) filters.genre  = genre;
        if (year)  filters.year   = year;
        if (type)  filters.type   = type;
        const data = await fetchMovies(filters);
        setMovies(data);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }
    loadMovies();
  }, [query, genre, year, type]);

  // ── URL helpers ────────────────────────────────────────────────────────────
  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  };

  const clearAll = () => {
    setSearchParams({});
    setInputQuery('');
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFilter('q', inputQuery.trim());
  };

  const hasFilters = query || genre || year || type;

  // ── Styles ────────────────────────────────────────────────────────────────
  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 600,
    border: `1px solid ${active ? 'var(--accent-primary)' : 'rgba(220,38,38,0.15)'}`,
    background: active ? 'var(--gradient-accent)' : 'rgba(22,4,4,0.6)',
    color: active ? '#fff' : 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.18s',
    whiteSpace: 'nowrap',
    boxShadow: active ? '0 2px 10px rgba(220,38,38,0.3)' : 'none',
  });

  return (
    <div
      id="search-page"
      style={{
        maxWidth: 'var(--container-max)',
        margin: '0 auto',
        padding: 'calc(var(--navbar-height) + 32px) 32px 64px',
      }}
    >
      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            fontWeight: 800,
            marginBottom: '6px',
            lineHeight: 1.2,
          }}
        >
          {query
            ? <>Results for &quot;<span className="gradient-text">{query}</span>&quot;</>
            : genre
              ? <><span className="gradient-text">{genre}</span> Movies</>
              : 'Explore Movies'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {loading
            ? 'Searching…'
            : `${movies.length} title${movies.length !== 1 ? 's' : ''} found`}
        </p>
      </div>

      {/* ── Search Bar ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <SearchInput
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onSubmit={handleSearchSubmit}
        />
      </div>

      {/* ── Filters bar ────────────────────────────────────────────── */}
      <div
        style={{
          background: 'rgba(22,4,4,0.65)',
          border: '1px solid rgba(220,38,38,0.12)',
          borderRadius: '14px',
          padding: '24px 28px',
          marginBottom: '36px',
        }}
      >
        {/* Type toggle */}
        <div style={{ marginBottom: '18px' }}>
          <p style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--text-muted)',
            marginBottom: '10px',
          }}>
            Type
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['', 'Movie', 'Series'].map((t) => (
              <button
                key={t || 'all'}
                onClick={() => setFilter('type', t)}
                style={filterBtnStyle(type === t)}
              >
                {t || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Genre chips */}
        <div style={{ marginBottom: '18px' }}>
          <p style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--text-muted)',
            marginBottom: '10px',
          }}>
            Genre
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setFilter('genre', '')} style={filterBtnStyle(!genre)}>
              All
            </button>
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => setFilter('genre', g === genre ? '' : g)}
                style={filterBtnStyle(genre === g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Year dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--text-muted)',
              marginBottom: '10px',
            }}>
              Release Year
            </p>
            <select
              value={year}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilter('year', e.target.value)}
              id="year-filter-select"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            >
              <option value="">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Clear all */}
          {hasFilters && (
            <button
              onClick={clearAll}
              style={{
                marginTop: '20px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--border-hover)',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✕ Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── Results Grid ──────────────────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '20px',
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ aspectRatio: '2/3', borderRadius: '10px' }}
            />
          ))}
        </div>
      ) : movies.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '20px',
          }}
        >
          {movies.map((movie, index) => (
            <MovieCard key={movie.contentId} movie={movie} index={index} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '4rem', marginBottom: '16px' }}>🎬</span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
            No titles found
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Try adjusting your search or filters
          </p>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="btn-primary"
              style={{ marginTop: '20px' }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

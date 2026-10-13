import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchMoviesWithCount, fetchGenres } from '../api/movieApi';
import type { Movie } from '../api/movieApi';
import MovieCard from '../components/MovieCard';
import {
  IconSearch,
  IconClose,
  IconFilter,
  IconChevronDown,
  IconFilm,
} from '../components/Icons';

interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

function SearchInput({ value, onChange, onSubmit }: SearchInputProps) {
  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="relative flex items-center w-full">
        <div
          className="absolute text-neutral-400 pointer-events-none flex items-center justify-center"
          style={{ left: '18px', top: '50%', transform: 'translateY(-50%)' }}
        >
          <IconSearch size={18} />
        </div>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="Search movies & content titles..."
          id="explore-search-input"
          style={{
            width: '100%',
            height: '52px',
            paddingLeft: '52px',
            paddingRight: '48px',
            borderRadius: '16px',
            background: '#0b101c',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.92rem',
            color: '#fff',
            outline: 'none',
          }}
          className="placeholder-neutral-400 focus:border-sky-500/60 focus:bg-[#0f172a] transition-all"
        />
        {value && (
          <button
            type="button"
            onClick={() =>
              onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)
            }
            className="absolute right-4 p-1.5 rounded-full text-neutral-400 hover:text-white"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            <IconClose size={18} />
          </button>
        )}
      </div>
    </form>
  );
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 35 }, (_, i) => (currentYear - i).toString());

interface FilterPanelProps {
  hasFilters: boolean;
  activeFilterCount: number;
  clearAll: () => void;
  type: string;
  genre: string;
  year: string;
  genres: string[];
  setFilter: (key: string, value: string) => void;
}

function FilterPanel({
  hasFilters,
  activeFilterCount,
  clearAll,
  type,
  genre,
  year,
  genres,
  setFilter,
}: FilterPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ borderRadius: '18px', background: '#0b101c', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      {/* Panel header: Clickable accordion toggle */}
      <div
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: open ? '1px solid rgba(255,255,255,0.05)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        className="hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-neutral-400">
          <IconFilter size={13} className="text-sky-400" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span style={{ marginLeft: '6px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: '0.65rem', fontWeight: 700, border: '1px solid rgba(56,189,248,0.3)' }}>
              {activeFilterCount} Active
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {hasFilters && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="text-[0.74rem] font-semibold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <IconClose size={12} />
              <span>Reset</span>
            </button>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#94a3b8',
              fontSize: '0.74rem',
              fontWeight: 600,
            }}
            className="hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <span>{open ? 'Hide' : 'Show'}</span>
            <div style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', display: 'flex', alignItems: 'center' }}>
              <IconChevronDown size={13} />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Body with display toggle for zero re-mount lag */}
      <div style={{ display: open ? 'flex' : 'none', padding: '28px 24px', flexDirection: 'column', gap: '28px' }}>
        {/* TYPE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#737373', margin: 0 }}>
            Type
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {[
              { val: '', label: 'All' },
              { val: 'Movie', label: 'Movie' },
              { val: 'Series', label: 'Series' },
            ].map((item) => {
              const active = type === item.val;
              return (
                <button
                  key={item.val}
                  onClick={() => setFilter('type', item.val)}
                  style={{
                    padding: '10px 22px',
                    fontSize: '0.84rem',
                    borderRadius: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    background: active ? 'linear-gradient(to right, #22d3ee, #2563eb)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#fff' : '#d4d4d4',
                    transition: 'all 0.15s',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* GENRE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#737373', margin: 0 }}>
            Genre
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button
              onClick={() => setFilter('genre', '')}
              style={{
                padding: '10px 22px',
                fontSize: '0.84rem',
                borderRadius: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: !genre ? 'none' : '1px solid rgba(255,255,255,0.08)',
                background: !genre ? 'linear-gradient(to right, #22d3ee, #2563eb)' : 'rgba(255,255,255,0.04)',
                color: !genre ? '#fff' : '#d4d4d4',
                transition: 'all 0.15s',
              }}
            >
              All
            </button>
            {genres.map((g) => {
              const active = genre === g;
              return (
                <button
                  key={g}
                  onClick={() => setFilter('genre', active ? '' : g)}
                  style={{
                    padding: '10px 22px',
                    fontSize: '0.84rem',
                    borderRadius: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    background: active ? 'linear-gradient(to right, #22d3ee, #2563eb)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#fff' : '#d4d4d4',
                    transition: 'all 0.15s',
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* RELEASE YEAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#737373', margin: 0 }}>
            Release Year
          </p>
          <div className="relative inline-block" style={{ width: 'fit-content' }}>
            <select
              value={year}
              onChange={(e) => setFilter('year', e.target.value)}
              id="year-filter-select"
              style={{
                appearance: 'none',
                height: '44px',
                paddingLeft: '18px',
                paddingRight: '40px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#e5e5e5',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="" className="bg-[#0b101c]">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y} className="bg-[#0b101c]">{y}</option>
              ))}
            </select>
            <div
              className="absolute text-neutral-400 pointer-events-none"
              style={{ right: '14px', top: '50%', transform: 'translateY(-50%)' }}
            >
              <IconChevronDown size={14} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inputQuery, setInputQuery] = useState('');

  const query = searchParams.get('q') || '';
  const genre = searchParams.get('genre') || '';
  const year = searchParams.get('year') || '';
  const type = searchParams.get('type') || '';
  const activeFilterCount = [genre, year, type].filter(Boolean).length;

  useEffect(() => {
    setInputQuery(query);
  }, [query]);

  useEffect(() => {
    fetchGenres().then(setGenres).catch(console.error);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadMovies() {
      setLoading(true);
      try {
        const filters: Record<string, string> = { limit: '60' };
        if (query) filters.search = query;
        if (genre) filters.genre = genre;
        if (year) filters.year = year;
        if (type) filters.type = type;
        const res = await fetchMoviesWithCount(filters);
        if (active) {
          setMovies(res.movies);
          setTotalCount(res.total);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadMovies();
    return () => {
      active = false;
    };
  }, [query, genre, year, type]);

  const handleLoadMore = async () => {
    if (loadingMore || movies.length >= totalCount) return;
    setLoadingMore(true);
    try {
      const filters: Record<string, string> = {
        limit: '60',
        offset: String(movies.length),
      };
      if (query) filters.search = query;
      if (genre) filters.genre = genre;
      if (year) filters.year = year;
      if (type) filters.type = type;
      const res = await fetchMoviesWithCount(filters, true);
      setMovies((prev) => [...prev, ...res.movies]);
    } catch (e) {
      console.error('Failed to load more:', e);
    } finally {
      setLoadingMore(false);
    }
  };

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

  const hasFilters = Boolean(query || genre || year || type);

  return (
    <div id="search-page" style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1450px', width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-cyan-400 to-blue-600 shadow-sm shadow-sky-500" />
          <h1 className="font-outfit font-extrabold text-2xl text-white tracking-tight">
            {query ? (
              <>
                Search Results for &quot;
                <span className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">
                  {query}
                </span>
                &quot;
              </>
            ) : genre ? (
              <>
                <span className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">
                  {genre}
                </span>{' '}
                Catalog
              </>
            ) : (
              'Explore Catalog'
            )}
          </h1>
        </div>
        <p className="text-xs text-neutral-400" style={{ paddingLeft: '16px' }}>
          {loading ? 'Searching...' : `${totalCount.toLocaleString()} titles found`}
        </p>
      </div>

      <div>
        <SearchInput
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onSubmit={handleSearchSubmit}
        />
      </div>

      <FilterPanel
        hasFilters={hasFilters}
        activeFilterCount={activeFilterCount}
        clearAll={clearAll}
        type={type}
        genre={genre}
        year={year}
        genres={genres}
        setFilter={setFilter}
      />

      {/* Grid */}
      <div style={{ marginTop: '8px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '22px' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl skeleton" />
            ))}
          </div>
        ) : movies.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '22px' }}>
              {movies.map((movie, index) => (
                <MovieCard key={movie.contentId} movie={movie} index={index} />
              ))}
            </div>

            {movies.length < totalCount && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '36px', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  style={{
                    padding: '12px 32px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    borderRadius: '14px',
                    background: 'linear-gradient(to right, #0ea5e9, #2563eb)',
                    color: '#fff',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: loadingMore ? 0.7 : 1,
                  }}
                >
                  {loadingMore ? 'Loading More Titles...' : `Load More (${movies.length} of ${totalCount.toLocaleString()})`}
                </button>
              </div>
            )}
          </>
        ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
            <IconFilm size={30} />
          </div>
          <h3 className="font-outfit font-bold text-lg text-white mb-1">
            No Titles Found
          </h3>
          <p className="text-xs text-neutral-400 mb-4">
            Try adjusting your search query or filters.
          </p>
          {hasFilters && (
            <button onClick={clearAll} className="btn-primary py-2 px-4 text-xs">
              Clear Filters
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

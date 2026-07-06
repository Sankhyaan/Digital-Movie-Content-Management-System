import React from 'react';

interface FilterPanelProps {
  genres?: string[];
  selectedGenre?: string;
  selectedYear?: string;
  onGenreChange: (genre: string) => void;
  onYearChange: (year: string) => void;
}

export default function FilterPanel({
  genres = [],
  selectedGenre = '',
  selectedYear = '',
  onGenreChange,
  onYearChange,
}: FilterPanelProps) {
  const years: string[] = [];
  for (let y = 2024; y >= 1990; y--) {
    years.push(y.toString());
  }

  return (
    <aside
      className="glass-card p-5"
      style={{ minWidth: '240px' }}
      id="filter-panel"
    >
      <h3
        className="text-base font-bold mb-5 flex items-center gap-2"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <svg className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filters
      </h3>

      {/* Genre Filter */}
      <div className="mb-6">
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Genre
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onGenreChange('')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: !selectedGenre ? 'var(--accent-primary)' : 'var(--bg-glass)',
              color: !selectedGenre ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${!selectedGenre ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => onGenreChange(genre === selectedGenre ? '' : genre)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: selectedGenre === genre ? 'var(--accent-primary)' : 'var(--bg-glass)',
                color: selectedGenre === genre ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${selectedGenre === genre ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                cursor: 'pointer',
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Year Filter */}
      <div>
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Release Year
        </label>
        <select
          value={selectedYear}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onYearChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
          id="year-filter-select"
        >
          <option value="">All Years</option>
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {(selectedGenre || selectedYear) && (
        <button
          onClick={() => {
            onGenreChange('');
            onYearChange('');
          }}
          className="mt-5 w-full py-2 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-hover)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          ✕ Clear All Filters
        </button>
      )}
    </aside>
  );
}

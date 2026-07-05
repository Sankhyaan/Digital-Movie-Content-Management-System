import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchBar({ initialQuery = '', large = false }) {
  const [query, setQuery] = useState(initialQuery);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" id="search-bar-form">
      <div className="relative">
        <svg
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ left: large ? '20px' : '16px', color: 'var(--text-muted)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for movies, genres, actors..."
          className="w-full outline-none transition-all"
          style={{
            padding: large ? '18px 20px 18px 52px' : '14px 16px 14px 44px',
            fontSize: large ? '1.1rem' : '0.95rem',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            borderRadius: large ? '16px' : '12px',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--border-accent)';
            e.target.style.boxShadow = 'var(--shadow-glow)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-subtle)';
            e.target.style.boxShadow = 'none';
          }}
          id="search-input"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </form>
  );
}

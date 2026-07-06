import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWatchlist } from '../context/WatchlistContext';

export default function Navbar() {
  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const { watchlist } = useWatchlist();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  return (
    <nav id="main-navbar" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 'var(--navbar-height)',
      background: 'rgba(6,6,9,0.95)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(16,185,129,0.14)',
      boxShadow: '0 1px 30px rgba(0,0,0,0.5)',
    }}>
      <div style={{
        maxWidth: 'var(--container-max)', margin: '0 auto',
        height: '100%', padding: '0 36px',
        display: 'flex', alignItems: 'center', gap: '28px',
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981, #065f46)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '0.9rem', color: '#fff',
            boxShadow: '0 2px 12px rgba(16,185,129,0.35)', flexShrink: 0,
          }}>CV</div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.25rem', fontWeight: 800, color: '#f0fdf4', letterSpacing: '-0.02em' }}>
            Cine<span className="gradient-text">Verse</span>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexShrink: 0 }}>
          {[{ to: '/', label: 'Home' }, { to: '/search', label: 'Explore' },
            { to: '/watchlist', label: watchlist.length > 0 ? `Watchlist (${watchlist.length})` : 'Watchlist' },
            { to: '/cinematch', label: 'Surprise Me! 🎲', special: true }]
            .map(({ to, label, special }) => (
              <Link key={to} to={to}
                style={{
                  color: special ? '#10b981' : 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  fontWeight: special ? 700 : 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  background: special ? 'rgba(16,185,129,0.1)' : 'transparent',
                  padding: special ? '6px 14px' : '0',
                  borderRadius: special ? '10px' : '0',
                  border: special ? '1px solid rgba(16,185,129,0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#34d399';
                  if (special) e.currentTarget.style.background = 'rgba(16,185,129,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = special ? '#10b981' : 'var(--text-secondary)';
                  if (special) e.currentTarget.style.background = 'rgba(16,185,129,0.1)';
                }}
              >{label}</Link>
            ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <form onSubmit={handleSearch} style={{ flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', lineHeight: 0, zIndex: 1 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={focused ? '#34d399' : '#64748b'} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              placeholder="Search movies..." id="nav-search-input" autoComplete="off"
              style={{
                width: focused ? '260px' : '220px', height: '38px',
                paddingLeft: '36px', paddingRight: query ? '34px' : '14px',
                paddingTop: 0, paddingBottom: 0,
                fontSize: '0.84rem', fontFamily: 'inherit',
                background: focused ? 'rgba(6,20,13,0.90)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${focused ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.09)'}`,
                borderRadius: '10px', color: '#f0fdf4', outline: 'none',
                transition: 'width 0.2s, border-color 0.2s, background 0.2s',
                boxShadow: focused ? '0 0 0 3px rgba(16,185,129,0.10)' : 'none',
              }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} style={{
                position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(16,185,129,0.12)', border: 'none', color: '#6ee7b7',
                cursor: 'pointer', borderRadius: '50%', width: '18px', height: '18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', padding: 0,
              }}>✕</button>
            )}
          </div>
        </form>
      </div>
    </nav>
  );
}

import { Link } from 'react-router-dom';

interface NavLink {
  label: string;
  to: string;
}

const LINKS: NavLink[] = [
  { label: 'Home',      to: '/' },
  { label: 'Explore',   to: '/search' },
  { label: 'Watchlist', to: '/watchlist' },
];

const GENRES: string[] = ['Action', 'Drama', 'Sci-Fi & Fantasy', 'Animation', 'Thriller', 'Comedy'];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      id="main-footer"
      style={{
        background: 'rgba(6, 6, 9, 0.98)',
        borderTop: '1px solid rgba(16, 185, 129, 0.12)',
        marginTop: 'auto',
      }}
    >
      {/* Top green glow line */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(to right, transparent, rgba(16,185,129,0.45), transparent)',
      }} />

      {/* Main content */}
      <div style={{
        maxWidth: 'var(--container-max)',
        margin: '0 auto',
        padding: '56px 36px 36px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '48px',
          marginBottom: '52px',
        }}>

          {/* Brand column */}
          <div style={{ gridColumn: 'span 1' }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '18px', textDecoration: 'none' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #065f46)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 800,
                fontSize: '0.95rem',
                color: '#fff',
                boxShadow: '0 2px 12px rgba(16,185,129,0.35)',
              }}>
                CV
              </div>
              <span style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.3rem',
                fontWeight: 800,
                color: '#f0fdf4',
              }}>
                Cine<span className="gradient-text">Verse</span>
              </span>
            </Link>
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.75,
              maxWidth: '260px',
            }}>
              Your ultimate destination for movie information, reviews, and curated watchlists. Discover cinema like never before.
            </p>
          </div>

          {/* Navigate column */}
          <div>
            <h4 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--accent-primary)',
              marginBottom: '20px',
            }}>
              Navigate
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {LINKS.map(({ label, to }) => (
                <li key={to}>
                  <Link
                    to={to}
                    style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', transition: 'color 0.18s', textDecoration: 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-bright)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Popular Genres column */}
          <div>
            <h4 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--accent-primary)',
              marginBottom: '20px',
            }}>
              Popular Genres
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {GENRES.map((g) => (
                <li key={g}>
                  <Link
                    to={`/search?genre=${encodeURIComponent(g)}`}
                    style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', transition: 'color 0.18s', textDecoration: 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-bright)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  >
                    {g}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Project Info column */}
          <div>
            <h4 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--accent-primary)',
              marginBottom: '20px',
            }}>
              Project Info
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                'DBMS Course Project',
                'Shiv Nadar University',
                'Built with React + Express',
                'MySQL Database Backend',
              ].map((item) => (
                <li key={item} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(16,185,129,0.18), transparent)',
          marginBottom: '28px',
        }} />

        {/* Bottom row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          {/* Copyright */}
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            © {year} CineVerse. All rights reserved.
          </p>

          {/* Team credit — centred */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 22px',
            borderRadius: '99px',
            background: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.16)',
          }}>
            <span style={{ fontSize: '1rem' }}>✦</span>
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-accent)',
              letterSpacing: '0.04em',
            }}>
              Done by&nbsp;
              <strong style={{ color: 'var(--accent-bright)' }}>Sankhyaan</strong>
              <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>·</span>
              <strong style={{ color: 'var(--accent-bright)' }}>Saketh</strong>
              <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>·</span>
              <strong style={{ color: 'var(--accent-bright)' }}>Priya</strong>
              <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>·</span>
              <strong style={{ color: 'var(--accent-bright)' }}>Abhinay</strong>
            </span>
            <span style={{ fontSize: '1rem' }}>✦</span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            DBMS Project {year}
          </p>
        </div>
      </div>
    </footer>
  );
}

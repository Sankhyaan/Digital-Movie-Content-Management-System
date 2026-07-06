import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchMovieById, posterUrl, backdropUrl } from '../api/movieApi';
import type { MovieDetail } from '../api/movieApi';
import { useWatchlist } from '../context/WatchlistContext';
import React from 'react';

// ── Language code → full name map ─────────────────────────────────────────────
const LANG_MAP: Record<string, string> = {
  en: 'English',   hi: 'Hindi',     ru: 'Russian',   fr: 'French',
  de: 'German',    es: 'Spanish',   it: 'Italian',   ja: 'Japanese',
  ko: 'Korean',    zh: 'Chinese',   pt: 'Portuguese',ar: 'Arabic',
  tr: 'Turkish',   nl: 'Dutch',     sv: 'Swedish',   pl: 'Polish',
  da: 'Danish',    fi: 'Finnish',   no: 'Norwegian', cs: 'Czech',
  th: 'Thai',      vi: 'Vietnamese',id: 'Indonesian',ms: 'Malay',
  fa: 'Persian',   he: 'Hebrew',    uk: 'Ukrainian', ro: 'Romanian',
  hu: 'Hungarian', bn: 'Bengali',   ta: 'Tamil',     te: 'Telugu',
  ml: 'Malayalam', pa: 'Punjabi',   ur: 'Urdu',      sw: 'Swahili',
  el: 'Greek',     bg: 'Bulgarian', hr: 'Croatian',  sk: 'Slovak',
  ca: 'Catalan',   sr: 'Serbian',   lt: 'Lithuanian',lv: 'Latvian',
  et: 'Estonian',  sl: 'Slovenian', tl: 'Filipino',  cn: 'Cantonese',
};

/** Convert a language code (e.g. "ru") or raw name to a full display name. */
const langName = (raw = ''): string => {
  if (!raw) return raw;
  const lower = raw.trim().toLowerCase();
  // If it's a short ISO code in our map, return full name
  if (LANG_MAP[lower]) return LANG_MAP[lower];
  // If it looks like a short code (≤3 chars) not in map, return uppercased
  if (lower.length <= 3) return raw.toUpperCase();
  // Otherwise it's already a full name (e.g. stored as "English")
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

// ── tiny helpers ──────────────────────────────────────────────────────────────

interface InfoTileProps {
  label: string;
  value?: string | number | null;
}

function InfoTile({ label, value }: InfoTileProps) {
  return (
    <div style={{
      background: 'rgba(13,20,13,0.70)',
      border: '1px solid rgba(16,185,129,0.10)',
      borderRadius: '10px',
      padding: '18px 20px',
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(16,185,129,0.28)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(16,185,129,0.10)')}
    >
      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
        {value ?? '—'}
      </p>
    </div>
  );
}

interface SectionLabelProps {
  children: React.ReactNode;
}

function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
      <div style={{ width: '3px', height: '22px', borderRadius: '2px', background: 'var(--gradient-accent)', flexShrink: 0 }} />
      <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1rem', fontWeight: 700, color: 'var(--text-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </h3>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie]       = useState<MovieDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActive]  = useState('overview');
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setActive('overview');
      try {
        const data = await fetchMovieById(id);
        setMovie(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    window.scrollTo(0, 0);
  }, [id]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: 'calc(var(--navbar-height) + 32px) 36px 64px' }}>
        <div className="skeleton" style={{ width: '100%', height: '400px', borderRadius: '18px', marginBottom: '40px' }} />
        <div style={{ display: 'flex', gap: '36px' }}>
          <div className="skeleton" style={{ width: '240px', flexShrink: 0, aspectRatio: '2/3', borderRadius: '12px' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="skeleton" style={{ width: '65%', height: '42px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ width: '45%', height: '24px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ width: '100%', height: '120px', borderRadius: '8px' }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (!movie) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <span style={{ fontSize: '3rem' }}>🎬</span>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.6rem' }}>Content Not Found</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>The title you're looking for doesn't exist.</p>
        <Link to="/" className="btn-primary" style={{ marginTop: '8px' }}>← Back to Home</Link>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const inWatchlist = isInWatchlist(movie.contentId);
  const poster      = posterUrl(movie.posterPath, movie.title);
  const backdrop    = backdropUrl(movie.posterPath) || poster;
  const rating      = movie.rating != null ? Number(movie.rating) : null;
  const year        = movie.releaseYear ?? '—';
  const duration    = movie.type === 'Movie' && movie.duration ? `${movie.duration} min` : null;
  const seasons     = movie.type === 'Series' && movie.totalSeasons ? `${movie.totalSeasons} Season${movie.totalSeasons > 1 ? 's' : ''}` : null;
  const origLangRaw = movie.languages?.find(l => l.type === 'Original')?.languageName ?? movie.languages?.[0]?.languageName ?? null;
  const origLang    = origLangRaw ? langName(origLangRaw) : null;
  // Description — from content.description column (added via ALTER TABLE content ADD COLUMN description TEXT)
  const description = movie.description ?? null;

  const tabs = [
    { id: 'overview',  label: 'Overview' },
    { id: 'cast',      label: 'Cast' },
    { id: 'platforms', label: 'Platforms' },
    ...(movie.type === 'Series' ? [{ id: 'episodes', label: 'Episodes' }] : []),
  ];

  return (
    <div id="movie-detail-page">

      {/* ── Backdrop hero ───────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: '100%', height: '480px', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${backdrop})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 20%',
          filter: 'brightness(0.22) blur(5px)',
          transform: 'scale(1.06)',
        }} />
        {/* bottom fade to page bg */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-primary) 0%, rgba(6,6,9,0.0) 55%)' }} />
        {/* left fade */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(6,6,9,0.95) 0%, transparent 65%)' }} />
        {/* green glow vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 25% 60%, rgba(16,185,129,0.06) 0%, transparent 55%)' }} />
      </div>

      {/* ── Content panel (pulled up over backdrop) ──────────────────────── */}
      <div style={{
        position: 'relative',
        maxWidth: 'var(--container-max)',
        margin: '-340px auto 0',
        padding: '0 36px 80px',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', gap: '44px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── Left: Poster + Watchlist ───────────────────────────────── */}
          <div style={{ flexShrink: 0, width: '245px' }}>
            {/* Poster */}
            <div style={{
              borderRadius: '14px',
              overflow: 'hidden',
              aspectRatio: '2/3',
              boxShadow: '0 20px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(16,185,129,0.14)',
            }}>
              <img
                src={poster}
                alt={movie.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/300x450/060609/10b981?text=${encodeURIComponent(movie.title)}`; }}
              />
            </div>

            {/* Watchlist button */}
            <button
              onClick={() => inWatchlist ? removeFromWatchlist(movie.contentId) : addToWatchlist(movie)}
              id="watchlist-toggle-btn"
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '13px',
                borderRadius: '10px',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: inWatchlist ? 'transparent' : 'linear-gradient(135deg, #10b981, #065f46)',
                color: inWatchlist ? 'var(--accent-bright)' : '#fff',
                border: inWatchlist ? '2px solid var(--accent-primary)' : 'none',
                cursor: 'pointer',
                boxShadow: inWatchlist ? 'none' : '0 4px 20px rgba(16,185,129,0.28)',
                transition: 'opacity 0.18s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              {inWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist'}
            </button>

            {/* Quick platform chips */}
            {(movie.platforms ?? []).length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>
                  Streaming On
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {movie.platforms!.slice(0, 4).map(p => (
                    <div key={p.platformId} style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(16,185,129,0.06)',
                      border: '1px solid rgba(16,185,129,0.14)',
                      fontSize: '0.8rem',
                      color: 'var(--text-accent)',
                      fontWeight: 500,
                    }}>
                      📺 {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Info panel ─────────────────────────────────────── */}
          <div style={{ flex: 1, paddingTop: '24px', minWidth: 0 }}>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              <span className="accent-badge" style={{ background: 'rgba(16,185,129,0.18)', borderColor: 'rgba(16,185,129,0.35)' }}>
                {movie.type}
              </span>
              {(movie.genres ?? []).map(g => (
                <Link
                  key={g}
                  to={`/search?genre=${encodeURIComponent(g)}`}
                  className="accent-badge"
                  style={{ textDecoration: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(16,185,129,0.55)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(16,185,129,0.22)')}
                >
                  {g}
                </Link>
              ))}
            </div>

            {/* Title */}
            <h1 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(1.8rem, 4vw, 3rem)',
              fontWeight: 900,
              lineHeight: 1.1,
              color: '#f0fdf4',
              marginBottom: '18px',
              letterSpacing: '-0.02em',
            }}>
              {movie.title}
            </h1>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '32px' }}>
              {rating != null && (
                <span className="rating-badge" style={{ fontSize: '0.92rem', padding: '5px 13px' }}>
                  ★ {rating.toFixed(1)} / 10
                </span>
              )}
              {(duration || seasons) && (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{duration ?? seasons}</span>
              )}
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{year}</span>
              {origLang && <span className="accent-badge">🌐 {origLang}</span>}
            </div>

            {/* ── Tab navigation ─────────────────────────────────────── */}
            <div className="tab-nav-wrap">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab content ────────────────────────────────────────── */}
            <div key={activeTab} className="animate-fade-in">

              {/* Overview */}
              {activeTab === 'overview' && (
                <div>

                  {/* ── Description / Synopsis ──────────────────────── */}
                  <div style={{
                    background: 'rgba(13,20,13,0.55)',
                    border: '1px solid rgba(16,185,129,0.10)',
                    borderRadius: '12px',
                    padding: '22px 24px',
                    marginBottom: '20px',
                  }}>
                    <p style={{
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--accent-primary)',
                      marginBottom: '12px',
                      fontWeight: 700,
                    }}>
                      Description
                    </p>
                    {description ? (
                      <p style={{
                        fontSize: '0.925rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.75,
                        margin: 0,
                      }}>
                        {description}
                      </p>
                    ) : (
                      <p style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                        margin: 0,
                        lineHeight: 1.6,
                      }}>
                        Description field is empty for this title. Add data directly to the
                        <code style={{ background: 'rgba(16,185,129,0.10)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.8rem', margin: '0 4px' }}>description</code>
                        column in the <code style={{ background: 'rgba(16,185,129,0.10)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.8rem', margin: '0 4px' }}>content</code> table to display it here.
                      </p>
                    )}
                  </div>

                  {/* ── Info tiles grid ─────────────────────────────── */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                    gap: '14px',
                    marginBottom: '20px',
                  }}>
                    <InfoTile label="Type"     value={movie.type} />
                    <InfoTile label="Year"     value={year} />
                    <InfoTile label="Rating"   value={rating != null ? `${rating.toFixed(1)} / 10` : 'N/A'} />
                    <InfoTile label="Duration" value={duration ?? seasons} />
                    <InfoTile label="Language" value={origLang} />
                  </div>

                  {/* ── Available Languages ─────────────────────────── */}
                  {(movie.languages ?? []).length > 0 && (
                    <div style={{
                      background: 'rgba(13,20,13,0.70)',
                      border: '1px solid rgba(16,185,129,0.10)',
                      borderRadius: '10px',
                      padding: '20px',
                    }}>
                      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '14px', fontWeight: 600 }}>
                        Available Languages
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {movie.languages!.map(l => (
                          <span key={`${l.languageId}-${l.type}`} className="accent-badge">
                            {langName(l.languageName)}
                            <span style={{ opacity: 0.6, marginLeft: '5px', fontWeight: 400 }}>({l.type})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cast */}
              {activeTab === 'cast' && (
                <div>
                  {(movie.actors ?? []).length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🎭</span>
                      No cast information available.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '16px',
                    }}>
                      {movie.actors!.map(actor => (
                        <div key={actor.actorId} style={{
                          background: 'rgba(13,20,13,0.70)',
                          border: '1px solid rgba(16,185,129,0.10)',
                          borderRadius: '12px',
                          padding: '20px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          gap: '10px',
                          transition: 'border-color 0.2s',
                        }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(16,185,129,0.28)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(16,185,129,0.10)')}
                        >
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'rgba(16,185,129,0.10)',
                            border: '2px solid rgba(16,185,129,0.20)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                          }}>
                            🎭
                          </div>
                          <div>
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                              {actor.name}
                            </p>
                            {actor.roleName && (
                              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {actor.roleName}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Platforms */}
              {activeTab === 'platforms' && (
                <div>
                  {(movie.platforms ?? []).length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>📺</span>
                      No platform information available.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: '16px',
                    }}>
                      {movie.platforms!.map(p => (
                        <div key={p.platformId} style={{
                          background: 'rgba(13,20,13,0.70)',
                          border: '1px solid rgba(16,185,129,0.10)',
                          borderRadius: '12px',
                          padding: '20px 22px',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.30)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(16,185,129,0.10)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: p.region || p.availableFrom ? '14px' : 0 }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: 'rgba(16,185,129,0.10)',
                              border: '1px solid rgba(16,185,129,0.20)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem',
                              flexShrink: 0,
                            }}>
                              📺
                            </div>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {p.name}
                            </span>
                          </div>
                          {(p.region || p.availableFrom || p.availableTill) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {p.region && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Region</span>
                                  <span style={{ color: 'var(--text-accent)', fontWeight: 500 }}>{p.region}</span>
                                </div>
                              )}
                              {p.availableFrom && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>From</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(p.availableFrom).toLocaleDateString()}</span>
                                </div>
                              )}
                              {p.availableTill && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Till</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(p.availableTill).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Episodes */}
              {activeTab === 'episodes' && movie.type === 'Series' && (
                <div>
                  {(movie.seasons ?? []).length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No episode data available.
                    </div>
                  ) : (
                    movie.seasons!.map(season => (
                      <div key={season.seasonId} style={{ marginBottom: '36px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                          <div style={{ width: '3px', height: '22px', borderRadius: '2px', background: 'var(--gradient-accent)', flexShrink: 0 }} />
                          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: 700 }}>
                            Season {season.seasonNumber}
                          </h3>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                            {season.episodes.length} episode{season.episodes.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {season.episodes.map(ep => (
                            <div key={ep.episodeId} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '16px',
                              padding: '14px 18px',
                              background: 'rgba(13,20,13,0.65)',
                              border: '1px solid rgba(16,185,129,0.09)',
                              borderRadius: '10px',
                              transition: 'border-color 0.2s, background 0.2s',
                            }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)'; e.currentTarget.style.background = 'rgba(16,185,129,0.05)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.09)'; e.currentTarget.style.background = 'rgba(13,20,13,0.65)'; }}
                            >
                              <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '9px',
                                background: 'linear-gradient(135deg, #10b981, #065f46)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                color: '#fff',
                                flexShrink: 0,
                                boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
                              }}>
                                {ep.episodeNumber ?? '?'}
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: ep.duration ? '3px' : 0 }}>
                                  {ep.title ?? `Episode ${ep.episodeNumber}`}
                                </p>
                                {ep.duration && (
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ep.duration} min</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>{/* end tab content */}
          </div>{/* end info panel */}
        </div>{/* end flex row */}
      </div>{/* end content panel */}

      {/* SectionLabel used for future sections */}
      {false && <SectionLabel>placeholder</SectionLabel>}
    </div>
  );
}

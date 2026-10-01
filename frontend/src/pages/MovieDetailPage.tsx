import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchMovieById, posterUrl, backdropUrl, actorProfileUrl, getCachedData } from '../api/movieApi';
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

// ── Platform branding helper ──────────────────────────────────────────────────
const getPlatformMeta = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('netflix'))  return { bg: 'rgba(229, 9, 20, 0.12)', border: 'rgba(229, 9, 20, 0.35)', icon: '🔴', accent: '#ff4d4d', brand: 'Netflix' };
  if (n.includes('prime') || n.includes('amazon')) return { bg: 'rgba(0, 168, 225, 0.12)', border: 'rgba(0, 168, 225, 0.35)', icon: '🔵', accent: '#00a8e1', brand: 'Prime Video' };
  if (n.includes('apple'))    return { bg: 'rgba(255, 255, 255, 0.10)', border: 'rgba(255, 255, 255, 0.25)', icon: '🍎', accent: '#f5f5f7', brand: 'Apple TV+' };
  if (n.includes('hotstar') || n.includes('jiohotstar')) return { bg: 'rgba(17, 60, 207, 0.15)', border: 'rgba(17, 60, 207, 0.40)', icon: '🌟', accent: '#4a90e2', brand: 'Disney+ Hotstar' };
  if (n.includes('disney'))   return { bg: 'rgba(17, 60, 207, 0.15)', border: 'rgba(17, 60, 207, 0.40)', icon: '🌟', accent: '#4a90e2', brand: 'Disney+' };
  if (n.includes('hbo') || n.includes('max')) return { bg: 'rgba(153, 51, 204, 0.15)', border: 'rgba(153, 51, 204, 0.40)', icon: '🟣', accent: '#b968f0', brand: 'Max' };
  if (n.includes('paramount')) return { bg: 'rgba(0, 100, 210, 0.14)', border: 'rgba(0, 100, 210, 0.35)', icon: '⭐', accent: '#0064d2', brand: 'Paramount+' };
  if (n.includes('crunchyroll')) return { bg: 'rgba(255, 106, 0, 0.14)', border: 'rgba(255, 106, 0, 0.35)', icon: '🟠', accent: '#ff6a00', brand: 'Crunchyroll' };
  if (n.includes('sony') || n.includes('sonyliv')) return { bg: 'rgba(255, 120, 0, 0.14)', border: 'rgba(255, 120, 0, 0.35)', icon: '📺', accent: '#ff7800', brand: 'Sony LIV' };
  if (n.includes('zee') || n.includes('zee5')) return { bg: 'rgba(140, 29, 219, 0.14)', border: 'rgba(140, 29, 219, 0.35)', icon: '📺', accent: '#b24bf3', brand: 'Zee5' };
  if (n.includes('google')) return { bg: 'rgba(66, 133, 244, 0.14)', border: 'rgba(66, 133, 244, 0.35)', icon: '▶️', accent: '#4285f4', brand: 'Google Play Movies' };
  if (n.includes('youtube')) return { bg: 'rgba(255, 0, 0, 0.14)', border: 'rgba(255, 0, 0, 0.35)', icon: '▶️', accent: '#ff3333', brand: 'YouTube' };
  return { bg: 'rgba(16, 185, 129, 0.10)', border: 'rgba(16, 185, 129, 0.25)', icon: '📺', accent: 'var(--accent-bright)', brand: name };
};

// ── Direct Streaming Service Content Redirect URL ─────────────────────────────
const getDirectPlatformUrl = (platformName = '', title = '') => {
  const n = platformName.toLowerCase();
  const q = encodeURIComponent(title);
  if (n.includes('netflix'))  return `https://www.netflix.com/search?q=${q}`;
  if (n.includes('prime') || n.includes('amazon')) return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`;
  if (n.includes('apple'))    return `https://tv.apple.com/search?term=${q}`;
  if (n.includes('hotstar') || n.includes('jiohotstar')) return `https://www.hotstar.com/in/explore?search_query=${q}`;
  if (n.includes('disney'))   return `https://www.disneyplus.com/search?q=${q}`;
  if (n.includes('hbo') || n.includes('max')) return `https://play.max.com/search?q=${q}`;
  if (n.includes('paramount')) return `https://www.paramountplus.com/search/?query=${q}`;
  if (n.includes('peacock'))  return `https://www.peacocktv.com/search?q=${q}`;
  if (n.includes('crunchyroll')) return `https://www.crunchyroll.com/search?q=${q}`;
  if (n.includes('sony') || n.includes('sonyliv')) return `https://www.sonyliv.com/search/${q}`;
  if (n.includes('zee') || n.includes('zee5')) return `https://www.zee5.com/search?q=${q}`;
  if (n.includes('google'))   return `https://play.google.com/store/search?q=${q}&c=movies`;
  if (n.includes('youtube'))  return `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' movie')}`;
  return `https://www.justwatch.com/search?q=${q}`;
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
  const initialMovie = id ? getCachedData<MovieDetail>('movie_detail_' + id) : null;
  const [movie, setMovie]       = useState<MovieDetail | null>(initialMovie);
  const [loading, setLoading]   = useState(!initialMovie);
  const [activeTab, setActive]  = useState('overview');
  const [showTrailer, setShowTrailer] = useState(false);
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();

  useEffect(() => {
    let isMounted = true;
    const cached = id ? getCachedData<MovieDetail>('movie_detail_' + id) : null;
    if (cached) {
      setMovie(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setActive('overview');

    async function load() {
      try {
        const data = await fetchMovieById(id);
        if (isMounted) {
          setMovie(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    window.scrollTo(0, 0);

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Escape key closes trailer modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTrailer(false);
    };
    if (showTrailer) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTrailer]);

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
  const backdrop    = backdropUrl(movie.backdropPath) || backdropUrl(movie.posterPath) || poster;
  const rating      = movie.rating != null ? Number(movie.rating) : null;
  const year        = movie.releaseYear ?? '—';
  const duration    = movie.type === 'Movie' && movie.duration ? `${movie.duration} min` : null;
  const seasons     = movie.type === 'Series' && movie.totalSeasons ? `${movie.totalSeasons} Season${movie.totalSeasons > 1 ? 's' : ''}` : null;

  // Deduplicate and normalize languages
  const uniqueLanguages = (() => {
    const seen = new Set<string>();
    const list: NonNullable<typeof movie.languages> = [];
    for (const l of (movie.languages ?? [])) {
      const clean = langName(l.languageName);
      const key = `${clean.toLowerCase()}_${l.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ ...l, languageName: clean });
      }
    }
    return list;
  })();

  // Strictly filter to verified global streaming platforms only (reject Hulu & unverified channels)
  const uniquePlatforms = (() => {
    const isVerifiedPlatform = (raw = '') => {
      const n = raw.trim().toLowerCase();
      if (n.includes('hulu')) return false; // Hulu causes geoblock redirects outside US
      return (
        n.includes('netflix') ||
        n.includes('prime') ||
        n.includes('amazon') ||
        n.includes('apple') ||
        n.includes('hotstar') ||
        n.includes('jiohotstar') ||
        n.includes('disney') ||
        n.includes('max') ||
        n.includes('paramount') ||
        n.includes('sony') ||
        n.includes('zee') ||
        n.includes('crunchyroll') ||
        n.includes('google play') ||
        n.includes('youtube')
      );
    };

    const seen = new Set<string>();
    const list: NonNullable<typeof movie.platforms> = [];
    for (const p of (movie.platforms ?? [])) {
      const clean = p.name.trim();
      if (!isVerifiedPlatform(clean)) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ ...p, name: clean });
      }
    }
    return list;
  })();

  const origLangRaw = uniqueLanguages.find(l => l.type === 'Original')?.languageName ?? uniqueLanguages[0]?.languageName ?? null;
  const origLang    = origLangRaw ? langName(origLangRaw) : null;
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

            {/* Watch Trailer button (available on 100% of titles) */}
            <button
              onClick={() => setShowTrailer(true)}
              id="watch-trailer-btn"
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '12px',
                borderRadius: '10px',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(16,185,129,0.12)',
                color: 'var(--accent-bright)',
                border: '1px solid rgba(16,185,129,0.3)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.22)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; }}
            >
              ▶ Watch Official Trailer
            </button>

            {/* Quick platform chips */}
            {uniquePlatforms.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>
                  Streaming On
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {uniquePlatforms.slice(0, 4).map(p => {
                    const directUrl = getDirectPlatformUrl(p.name, movie.title);
                    return (
                      <a
                        key={p.platformId}
                        href={directUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(16,185,129,0.06)',
                          border: '1px solid rgba(16,185,129,0.14)',
                          fontSize: '0.8rem',
                          color: 'var(--text-accent)',
                          fontWeight: 500,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.18s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(16,185,129,0.14)';
                          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.35)';
                          e.currentTarget.style.color = 'var(--accent-bright)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(16,185,129,0.06)';
                          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.14)';
                          e.currentTarget.style.color = 'var(--text-accent)';
                        }}
                      >
                        <span>📺 {p.name}</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>↗</span>
                      </a>
                    );
                  })}
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
                        No description available for this title.
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
                  {uniqueLanguages.length > 0 && (
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
                        {uniqueLanguages.map(l => (
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
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: 'rgba(16,185,129,0.10)',
                            border: '2px solid rgba(16,185,129,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          }}>
                            {actor.profilePath ? (
                              <img
                                src={actorProfileUrl(actor.profilePath)!}
                                alt={actor.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: '1.4rem' }}>🎭</span>
                            )}
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
                  {uniquePlatforms.length === 0 ? (
                    <div style={{
                      padding: '36px 24px',
                      textAlign: 'center',
                      background: 'rgba(13,20,13,0.5)',
                      borderRadius: '14px',
                      border: '1px solid rgba(16,185,129,0.12)',
                    }}>
                      <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>🎬</span>
                      <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        Not Currently on Subscription Streaming
                      </h4>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                        This title may currently be in theatrical release or available via digital purchase. You can verify real-time global availability:
                      </p>
                      <a
                        href={`https://www.justwatch.com/search?q=${encodeURIComponent(movie.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 20px',
                          borderRadius: '10px',
                          background: 'rgba(16,185,129,0.10)',
                          border: '1px solid rgba(16,185,129,0.25)',
                          color: 'var(--accent-bright)',
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          transition: 'all 0.18s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(16,185,129,0.18)';
                          e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(16,185,129,0.10)';
                          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)';
                        }}
                      >
                        <span>Check Live Availability on JustWatch</span>
                        <span>↗</span>
                      </a>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '16px',
                    }}>
                      {uniquePlatforms.map(p => {
                        const meta = getPlatformMeta(p.name);
                        const directUrl = getDirectPlatformUrl(p.name, movie.title);
                        return (
                          <div key={p.platformId} style={{
                            background: 'rgba(13,20,13,0.70)',
                            border: `1px solid ${meta.border}`,
                            borderRadius: '14px',
                            padding: '18px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '16px',
                            transition: 'all 0.2s ease',
                          }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = meta.accent;
                              e.currentTarget.style.boxShadow = `0 6px 24px ${meta.bg}`;
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = meta.border;
                              e.currentTarget.style.boxShadow = 'none';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <div style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '12px',
                                background: meta.bg,
                                border: `1px solid ${meta.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.35rem',
                                flexShrink: 0,
                              }}>
                                {meta.icon}
                              </div>
                              <h4 style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '1.05rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                margin: 0,
                              }}>
                                {p.name}
                              </h4>
                            </div>

                            <a
                              href={directUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                borderRadius: '10px',
                                background: meta.bg,
                                border: `1px solid ${meta.border}`,
                                color: meta.accent,
                                textDecoration: 'none',
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                transition: 'all 0.18s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.filter = 'brightness(1.25)';
                                e.currentTarget.style.transform = 'scale(1.02)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.filter = 'none';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              <span>Watch on {p.name}</span>
                              <span style={{ fontSize: '0.9rem' }}>↗</span>
                            </a>
                          </div>
                        );
                      })}
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
                    movie.seasons!
                      .filter(season => season.seasonNumber > 0 && season.episodes.length > 0)
                      .map(season => (
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

      {/* ── Trailer modal (Universal: Works for 100% of titles) ──────────── */}
      {showTrailer && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }} onClick={() => setShowTrailer(false)}>
          <div style={{
            position: 'relative', width: '100%', maxWidth: '960px', aspectRatio: '16/9',
            background: '#000', borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 25px 70px rgba(0,0,0,0.9), 0 0 0 1px rgba(16,185,129,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              position: 'absolute', top: '14px', right: '14px', zIndex: 10,
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <a
                href={movie.trailerKey
                  ? `https://www.youtube.com/watch?v=${movie.trailerKey}`
                  : `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' ' + (movie.releaseYear || '') + ' official trailer')}`
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(0,0,0,0.75)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '20px',
                  padding: '6px 14px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backdropFilter: 'blur(8px)',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.9)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.75)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                <span>▶</span> Open on YouTube ↗
              </a>
              <button
                onClick={() => setShowTrailer(false)}
                aria-label="Close trailer modal"
                style={{
                  background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', fontSize: '1.2rem',
                  borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(8px)',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(16,185,129,0.85)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.75)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >✕</button>
            </div>
            <iframe
              src={movie.trailerKey
                ? `https://www.youtube-nocookie.com/embed/${movie.trailerKey}?autoplay=1&rel=0`
                : `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(movie.title + ' ' + (movie.releaseYear || '') + ' official trailer')}&autoplay=1&rel=0`
              }
              title={`${movie.title} Official Trailer`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}

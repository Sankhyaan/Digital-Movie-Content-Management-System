import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  fetchMovieById,
  posterUrl,
  backdropUrl,
  actorProfileUrl,
  getCachedData,
} from '../api/movieApi';
import type { Movie, MovieDetail } from '../api/movieApi';
import { useWatchlist } from '../context/WatchlistContext';
import {
  IconPlay,
  IconStar,
  IconClose,
  IconFilm,
  IconUser,
  IconCheck,
  IconChevronLeft,
} from '../components/Icons';

const LANG_MAP: Record<string, string> = {
  en: 'English',   hi: 'Hindi',     ru: 'Russian',   fr: 'French',
  de: 'German',    es: 'Spanish',   it: 'Italian',   ja: 'Japanese',
  ko: 'Korean',    zh: 'Chinese',   pt: 'Portuguese',ar: 'Arabic',
  tr: 'Turkish',   nl: 'Dutch',     sv: 'Swedish',   pl: 'Polish',
  da: 'Danish',    fi: 'Finnish',   no: 'Norwegian', cs: 'Czech',
  th: 'Thai',      vi: 'Vietnamese',id: 'Indonesian',ms: 'Malay',
  fa: 'Persian',   he: 'Hebrew',    uk: 'Ukrainian', ro: 'Romanian',
  hu: 'Hungarian', bn: 'Bengali',   ta: 'Tamil',     te: 'Telugu',
};

const langName = (raw = ''): string => {
  if (!raw) return raw;
  const lower = raw.trim().toLowerCase();
  if (LANG_MAP[lower]) return LANG_MAP[lower];
  if (lower.length <= 3) return raw.toUpperCase();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export default function MovieDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const stateMovie = location.state?.movie as Movie | undefined;
  const isMatchingState = Boolean(stateMovie && String(stateMovie.contentId) === String(id));
  const cachedMovie = id ? getCachedData<MovieDetail>('movie_detail_' + id) : null;
  const initialMovie = cachedMovie || (isMatchingState ? (stateMovie as MovieDetail) : null);

  const [movie, setMovie] = useState<MovieDetail | null>(initialMovie);
  const [loading, setLoading] = useState(!initialMovie);
  const [activeTab, setActive] = useState<'overview' | 'cast' | 'episodes'>('overview');
  const [showTrailer, setShowTrailer] = useState(false);
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  useEffect(() => {
    let isMounted = true;
    const cached = id ? getCachedData<MovieDetail>('movie_detail_' + id) : null;
    if (cached) {
      setMovie(cached);
      setLoading(false);
    } else if (isMatchingState && stateMovie) {
      setMovie(stateMovie as MovieDetail);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setActive('overview');

    async function load() {
      if (!id) {
        if (isMounted) setLoading(false);
        return;
      }
      try {
        const data = await fetchMovieById(id);
        if (isMounted) {
          setMovie(data);
        }
      } catch (e) {
        console.error('Failed to load movie details:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTrailer(false);
    };
    if (showTrailer) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showTrailer]);

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#06080e',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-400 rounded-full animate-spin" />
          <p className="text-xs text-neutral-400 font-medium">Loading content...</p>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div
        style={{
          height: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '24px',
          gap: '14px',
          background: '#06080e',
        }}
      >
        <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <IconFilm size={30} />
        </div>
        <h2 className="font-outfit font-bold text-xl text-white">Title Not Found</h2>
        <Link
          to="/home"
          style={{
            padding: '10px 24px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.84rem',
            textDecoration: 'none',
          }}
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const inWatchlist = isInWatchlist(movie.contentId);
  const poster = posterUrl(movie.posterPath, movie.title);
  const backdrop = backdropUrl(movie.backdropPath) || backdropUrl(movie.posterPath) || poster;
  const rating = movie.rating != null ? Number(movie.rating).toFixed(1) : '—';
  const year = movie.releaseYear ?? '—';
  const duration = movie.type === 'Movie' && movie.duration ? `${movie.duration} min` : null;
  const seasons =
    movie.type === 'Series' && movie.totalSeasons
      ? `${movie.totalSeasons} Season${movie.totalSeasons > 1 ? 's' : ''}`
      : null;

  const uniqueLanguages = (() => {
    const seen = new Set<string>();
    const list: NonNullable<typeof movie.languages> = [];
    for (const l of movie.languages ?? []) {
      const clean = langName(l.languageName);
      const key = `${clean.toLowerCase()}_${l.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ ...l, languageName: clean });
      }
    }
    return list;
  })();

  const origLangRaw =
    uniqueLanguages.find((l) => l.type === 'Original')?.languageName ??
    uniqueLanguages[0]?.languageName ??
    null;
  const origLang = origLangRaw ? langName(origLangRaw) : '—';
  const description = movie.description || 'No description available for this title.';

  const tabs: { id: 'overview' | 'cast' | 'episodes'; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'cast', label: 'Cast' },
    ...(movie.type === 'Series' ? [{ id: 'episodes' as const, label: 'Episodes' }] : []),
  ];

  return (
    <>
      {/* ── Fixed Page Container (No Outer Scroll Down) ────────────────── */}
      <div
        id="movie-detail-page"
        style={{
          height: '100%',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#06080e',
        }}
      >
        {/* Full-bleed Content Image as Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${backdrop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.42)',
            transform: 'scale(1.02)',
          }}
        />

        {/* Ambient Dark Gradient Overlays for High Legibility */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to right, rgba(6, 8, 14, 0.96) 0%, rgba(6, 8, 14, 0.88) 36%, rgba(6, 8, 14, 0.65) 70%, rgba(6, 8, 14, 0.45) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(6, 8, 14, 0.95) 0%, rgba(6, 8, 14, 0.25) 50%, rgba(6, 8, 14, 0.75) 100%)',
          }}
        />

        {/* ── Floating Back Navigation Button ────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '24px',
            left: 'clamp(28px, 4vw, 56px)',
            zIndex: 40,
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            id="movie-detail-back-btn"
            className="group flex items-center gap-2 rounded-xl text-neutral-300 hover:text-white transition-all cursor-pointer select-none"
            style={{
              background: 'rgba(11, 16, 28, 0.82)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              padding: '9px 18px 9px 13px',
              boxShadow: '0 4px 22px rgba(0, 0, 0, 0.55)',
            }}
            title="Go back"
            aria-label="Go back"
          >
            <IconChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform text-sky-400" />
            <span className="font-outfit font-semibold text-xs tracking-wide">Back</span>
          </button>
        </div>

        {/* ── Main Content Grid (Poster to Left + Content to Right) ───────── */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            paddingLeft: 'clamp(28px, 4vw, 56px)',
            paddingRight: 'clamp(28px, 4vw, 56px)',
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(32px, 4vw, 54px)',
          }}
        >
          {/* ── Left Column: Main Poster + Action Buttons ─────────────────── */}
          <div
            style={{
              width: '260px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Poster Card */}
            <div
              style={{
                width: '260px',
                height: '380px',
                borderRadius: '20px',
                overflow: 'hidden',
                background: '#090d16',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 24px 50px rgba(0, 0, 0, 0.75)',
              }}
            >
              <img
                src={poster}
                alt={movie.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://placehold.co/300x450/06080e/0ea5e9?text=${encodeURIComponent(
                    movie.title
                  )}`;
                }}
              />
            </div>

            {/* Button 1: + Add to Watchlist (Vibrant Electric Sky Blue) */}
            <button
              type="button"
              onClick={() =>
                inWatchlist ? removeFromWatchlist(movie.contentId) : addToWatchlist(movie)
              }
              id="detail-watchlist-btn"
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '12px',
                background: inWatchlist
                  ? 'rgba(14, 165, 233, 0.18)'
                  : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                color: inWatchlist ? '#38bdf8' : '#ffffff',
                border: inWatchlist
                  ? '1px solid rgba(56, 189, 248, 0.5)'
                  : 'none',
                fontWeight: 700,
                fontSize: '0.88rem',
                fontFamily: 'Outfit, Inter, sans-serif',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: inWatchlist
                  ? 'none'
                  : '0 4px 18px rgba(14, 165, 233, 0.35)',
                transition: 'all 0.2s ease',
              }}
              className="hover:scale-[1.02] active:scale-[0.98]"
            >
              {inWatchlist ? (
                <>
                  <IconCheck size={16} />
                  <span>In Watchlist</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span>
                  <span>Add to Watchlist</span>
                </>
              )}
            </button>

            {/* Button 2: ▶ Watch Official Trailer (Dark with Sky Blue border) */}
            <button
              type="button"
              onClick={() => setShowTrailer(true)}
              id="detail-watch-trailer-btn"
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(2, 132, 199, 0.2)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                fontWeight: 700,
                fontSize: '0.86rem',
                fontFamily: 'Outfit, Inter, sans-serif',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              className="hover:bg-sky-500/25 hover:border-sky-400 hover:text-white hover:scale-[1.02] active:scale-[0.98]"
            >
              <IconPlay size={14} />
              <span>Watch Official Trailer</span>
            </button>
          </div>

          {/* ── Right Column: Info, Tabs, Description & Bottom Tiles ───────── */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Top Genre Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span
                style={{
                  padding: '4px 14px',
                  borderRadius: '999px',
                  background: 'rgba(2, 132, 199, 0.2)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#7dd3fc',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                {movie.type}
              </span>
              {(movie.genres ?? []).slice(0, 3).map((g) => (
                <span
                  key={g}
                  style={{
                    padding: '4px 14px',
                    borderRadius: '999px',
                    background: 'rgba(2, 132, 199, 0.2)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#7dd3fc',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1
              className="font-outfit font-black text-white tracking-tight leading-none drop-shadow-xl"
              style={{
                fontSize: 'clamp(2.4rem, 4.2vw, 3.8rem)',
                margin: 0,
                lineHeight: 1.08,
                letterSpacing: '-0.025em',
              }}
            >
              {movie.title}
            </h1>

            {/* Metadata Row: Rating, Length, Year, Language */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
              {/* Rating Pill */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  background: 'rgba(2, 132, 199, 0.2)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                }}
              >
                <IconStar size={13} className="text-amber-400" />
                <span>{rating} / 10</span>
              </div>

              {/* Length */}
              {(duration || seasons) && (
                <span style={{ color: '#94a3b8', fontSize: '0.86rem', fontWeight: 600 }}>
                  {duration ?? seasons}
                </span>
              )}

              {/* Year */}
              <span style={{ color: '#94a3b8', fontSize: '0.86rem', fontWeight: 600 }}>
                {year}
              </span>

              {/* Audio / Language */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  background: 'rgba(2, 132, 199, 0.2)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#7dd3fc',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
              >
                <span>🌐 {origLang}</span>
              </div>
            </div>

            {/* Tab Navigation (Overview | Cast | Platforms) */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '4px 0',
              }}
            >
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActive(tab.id)}
                    style={{
                      padding: '8px 22px',
                      borderRadius: '12px',
                      background: active
                        ? 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
                        : 'transparent',
                      color: active ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      fontWeight: active ? 700 : 600,
                      fontSize: '0.88rem',
                      fontFamily: 'Outfit, Inter, sans-serif',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: active ? '0 4px 14px rgba(14, 165, 233, 0.35)' : 'none',
                    }}
                    className={!active ? 'hover:text-white hover:bg-white/[0.04]' : ''}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Body: Overview (Default) */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Description */}
                <div>
                  <p
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#38bdf8',
                      margin: '0 0 6px 0',
                    }}
                  >
                    Description
                  </p>
                  <p
                    style={{
                      fontSize: '0.94rem',
                      lineHeight: 1.65,
                      color: '#cbd5e1',
                      margin: 0,
                      maxWidth: '780px',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {description}
                  </p>
                </div>

                {/* 5 Bottom Metadata Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '14px',
                    maxWidth: '820px',
                  }}
                >
                  {/* Card 1: TYPE */}
                  <div
                    style={{
                      background: 'rgba(11, 16, 28, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 6px 0' }}>
                      Type
                    </p>
                    <p style={{ fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', margin: 0 }} className="truncate">
                      {movie.type}
                    </p>
                  </div>

                  {/* Card 2: YEAR */}
                  <div
                    style={{
                      background: 'rgba(11, 16, 28, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 6px 0' }}>
                      Year
                    </p>
                    <p style={{ fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', margin: 0 }} className="truncate">
                      {year}
                    </p>
                  </div>

                  {/* Card 3: RATING */}
                  <div
                    style={{
                      background: 'rgba(11, 16, 28, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 6px 0' }}>
                      Rating
                    </p>
                    <p style={{ fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', margin: 0 }} className="truncate">
                      {rating} / 10
                    </p>
                  </div>

                  {/* Card 4: DURATION */}
                  <div
                    style={{
                      background: 'rgba(11, 16, 28, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 6px 0' }}>
                      Duration
                    </p>
                    <p style={{ fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', margin: 0 }} className="truncate">
                      {duration ?? seasons ?? '—'}
                    </p>
                  </div>

                  {/* Card 5: LANGUAGE */}
                  <div
                    style={{
                      background: 'rgba(11, 16, 28, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 6px 0' }}>
                      Language
                    </p>
                    <p style={{ fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', margin: 0 }} className="truncate">
                      {origLang}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Body: Cast */}
            {activeTab === 'cast' && (
              <div
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  paddingRight: '12px',
                }}
                className="no-scrollbar"
              >
                {(movie.actors ?? []).length === 0 ? (
                  <div className="py-6 text-neutral-400 text-xs">No cast listed.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                    {movie.actors!.map((actor) => (
                      <div
                        key={actor.actorId}
                        style={{
                          padding: '12px',
                          borderRadius: '14px',
                          background: 'rgba(11, 16, 28, 0.75)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: '#090d16',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          {actor.profilePath ? (
                            <img
                              src={actorProfileUrl(actor.profilePath)!}
                              alt={actor.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-400">
                              <IconUser size={18} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }} className="truncate">
                            {actor.name}
                          </p>
                          {actor.roleName && (
                            <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: 0 }} className="truncate">
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


            {/* Tab Body: Episodes (Series only) */}
            {activeTab === 'episodes' && movie.type === 'Series' && (
              <div
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  paddingRight: '12px',
                }}
                className="no-scrollbar"
              >
                {movie.seasons
                  ?.filter((s) => s.seasonNumber > 0 && s.episodes.length > 0)
                  .map((season) => (
                    <div key={season.seasonId} style={{ marginBottom: '14px' }}>
                      <h3 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#38bdf8', margin: '0 0 8px 0' }}>
                        Season {season.seasonNumber}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {season.episodes.map((ep) => (
                          <div
                            key={ep.episodeId}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: 'rgba(11, 16, 28, 0.75)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                            }}
                          >
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8' }}>
                              EP {ep.episodeNumber ?? '1'}
                            </span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#fff', flex: 1 }} className="truncate">
                              {ep.title ?? `Episode ${ep.episodeNumber}`}
                            </span>
                            {ep.duration && (
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                {ep.duration}m
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Official YouTube Trailer Modal ─────────────────────────────── */}
      {showTrailer && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowTrailer(false)}
        >
          <div
            className="relative w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden border border-sky-500/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setShowTrailer(false)}
                className="w-9 h-9 rounded-full bg-black/70 hover:bg-sky-500 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            <iframe
              src={
                movie.trailerKey
                  ? `https://www.youtube-nocookie.com/embed/${movie.trailerKey}?autoplay=1&rel=0`
                  : `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(
                      movie.title + ' ' + (movie.releaseYear || '') + ' official trailer'
                    )}&autoplay=1&rel=0`
              }
              title={`${movie.title} Trailer`}
              className="w-full h-full border-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
}

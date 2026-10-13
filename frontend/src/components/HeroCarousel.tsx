import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { posterUrl, backdropUrl } from '../api/movieApi';
import type { Movie } from '../api/movieApi';
import {
  IconPlay,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconFilm,
} from './Icons';

interface HeroCarouselProps {
  movies?: Movie[];
}

export default function HeroCarousel({ movies = [] }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  const goTo = useCallback(
    (idx: number) => {
      if (fading || movies.length === 0) return;
      setFading(true);
      setTimeout(() => {
        setCurrent(idx);
        setFading(false);
      }, 350);
    },
    [fading, movies.length]
  );

  const next = useCallback(() => {
    if (movies.length === 0) return;
    goTo((current + 1) % movies.length);
  }, [current, movies.length, goTo]);

  const prev = useCallback(() => {
    if (movies.length === 0) return;
    goTo((current - 1 + movies.length) % movies.length);
  }, [current, movies.length, goTo]);

  useEffect(() => {
    if (movies.length <= 1 || showTrailer) return;
    const t = setInterval(next, 7000);
    return () => clearInterval(t);
  }, [next, movies.length, showTrailer]);

  // Handle escape key to close trailer modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTrailer(false);
    };
    if (showTrailer) {
      window.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [showTrailer]);

  // Reset to first slide whenever movies list changes (e.g. fresh random 10)
  useEffect(() => {
    setCurrent(0);
  }, [movies]);

  if (movies.length === 0) {
    return (
      <div className="w-full h-[450px] md:h-[510px] rounded-3xl skeleton" />
    );
  }

  const movie = movies[current] || movies[0];
  if (!movie) {
    return (
      <div className="w-full h-[450px] md:h-[510px] rounded-3xl skeleton" />
    );
  }
  const poster = posterUrl(movie.posterPath, movie.title);
  const bd = backdropUrl(movie.backdropPath) || backdropUrl(movie.posterPath) || poster;

  return (
    <>
      <div
        id="hero-carousel"
        className="relative w-full h-[460px] md:h-[520px] rounded-[28px] overflow-hidden bg-[#0a0e17] border border-white/[0.08] shadow-2xl group select-none"
      >
        {/* High-res Backdrop with increased brightness so image is clearly visible */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 ease-out transform"
          style={{
            backgroundImage: `url(${bd})`,
            filter: 'brightness(0.85)',
            opacity: fading ? 0 : 1,
            transform: fading ? 'scale(1.04)' : 'scale(1)',
          }}
        />

        {/* Cinematic Gradient Overlays: Text protection on left, clear on right */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(6, 8, 14, 0.94) 0%, rgba(6, 8, 14, 0.65) 38%, rgba(6, 8, 14, 0.18) 65%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(6, 8, 14, 0.85) 0%, rgba(6, 8, 14, 0.15) 35%, transparent 60%)',
          }}
        />

        {/* Clickable backdrop link to movie details */}
        <Link
          to={`/movie/${movie.contentId}`}
          className="absolute inset-0 z-10 cursor-pointer"
          aria-label={`View ${movie.title} details`}
          title={`View ${movie.title} details`}
        />

        {/* Hero Content: Padded from left edge with comfortable vertical spacing */}
        <div
          className={`relative z-20 h-full flex flex-col justify-center pointer-events-none transition-opacity duration-300 ${
            fading ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            paddingLeft: 'clamp(36px, 5.5vw, 72px)',
            paddingRight: '32px',
            paddingTop: '44px',
            paddingBottom: '44px',
            maxWidth: '700px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          {/* 1. Title & Release Year */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} className="pointer-events-auto">
            <Link
              to={`/movie/${movie.contentId}`}
              className="group/title inline-block no-underline"
              title={`View ${movie.title} details`}
            >
              <h1
                className="font-outfit font-black text-white tracking-tight drop-shadow-xl group-hover/title:text-sky-300 transition-colors"
                style={{
                  fontSize: 'clamp(2.2rem, 3.8vw, 3.5rem)',
                  lineHeight: 1.15,
                  margin: 0,
                  maxWidth: '620px',
                }}
              >
                {movie.title}
              </h1>
            </Link>

            {movie.releaseYear && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    color: '#e2e8f0',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    width: 'fit-content',
                  }}
                >
                  {movie.releaseYear}
                </span>
              </div>
            )}
          </div>

          {/* 2. Description */}
          {movie.description && (
            <p
              className="text-neutral-200 drop-shadow pointer-events-auto"
              style={{
                fontSize: 'clamp(0.95rem, 1.15vw, 1.05rem)',
                lineHeight: 1.65,
                margin: 0,
                maxWidth: '560px',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                opacity: 0.92,
              }}
            >
              {movie.description}
            </p>
          )}

          {/* 3. Action Buttons */}
          <div
            style={{
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap',
            }}
            className="pointer-events-auto"
          >
            <Link
              to={`/movie/${movie.contentId}`}
              id="hero-movie-details-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '16px 32px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: '1.02rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                textDecoration: 'none',
                boxShadow: '0 8px 24px rgba(14, 165, 233, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              className="hover:scale-[1.03] active:scale-[0.98] hover:shadow-sky-500/50"
            >
              <IconFilm size={20} />
              <span>Movie Details</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowTrailer(true)}
              id="hero-watch-trailer-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '16px 28px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: '1.02rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              className="hover:scale-[1.03] active:scale-[0.98] hover:bg-white/20"
            >
              <IconPlay size={20} />
              <span>Watch Trailer</span>
            </button>
          </div>
        </div>

        {/* Nav Controls (Previous / Next) on hover */}
        <button
          onClick={prev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/75 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          aria-label="Previous slide"
        >
          <IconChevronLeft size={18} />
        </button>

        <button
          onClick={next}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/75 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          aria-label="Next slide"
        >
          <IconChevronRight size={18} />
        </button>
      </div>

      {/* Official Trailer Modal */}
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
                aria-label="Close trailer"
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

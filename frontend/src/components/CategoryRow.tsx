import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import MovieCard from './MovieCard';
import type { Movie } from '../api/movieApi';
import { IconChevronLeft, IconChevronRight } from './Icons';

interface CategoryRowProps {
  title: string;
  movies?: Movie[];
  icon?: React.ReactNode;
  seeAllLink?: string;
}

export default function CategoryRow({
  title,
  movies = [],
  icon,
  seeAllLink,
}: CategoryRowProps) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    ref.current?.scrollBy({
      left: dir === 'left' ? -620 : 620,
      behavior: 'smooth',
    });
  };

  if (movies.length === 0) return null;

  return (
    <section
      className="category-shelf"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        paddingLeft: '4px',
        paddingRight: '4px',
      }}
    >
      {/* Shelf Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '6px',
          paddingRight: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '5px',
              height: '24px',
              borderRadius: '999px',
              background: 'linear-gradient(to bottom, #38bdf8, #2563eb)',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.45)',
            }}
          />
          {icon && <div className="text-sky-400 shrink-0 flex items-center">{icon}</div>}
          <h2 className="font-outfit font-extrabold text-xl md:text-2xl text-white tracking-tight">
            {title}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {seeAllLink && (
            <Link
              to={seeAllLink}
              className="text-xs font-semibold text-neutral-400 hover:text-sky-300 transition-colors"
              style={{ textDecoration: 'none' }}
            >
              See All
            </Link>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.12] border border-white/[0.08] text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              aria-label={`Scroll ${title} left`}
            >
              <IconChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.12] border border-white/[0.08] text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              aria-label={`Scroll ${title} right`}
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Shelf Slider — scrollbar completely hidden, ample padding so cards and hover shadows are never clipped */}
      <div
        ref={ref}
        className="no-scrollbar scroll-smooth snap-x snap-mandatory"
        style={{
          display: 'flex',
          gap: '22px',
          overflowX: 'auto',
          paddingTop: '8px',
          paddingBottom: '16px',
          paddingLeft: '6px',
          paddingRight: '24px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {movies.map((movie, i) => (
          <div
            key={movie.contentId}
            className="shrink-0 snap-start"
            style={{ width: '190px', flexShrink: 0 }}
          >
            <MovieCard movie={movie} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}

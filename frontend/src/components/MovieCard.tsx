import React from 'react';
import { Link } from 'react-router-dom';
import { useWatchlist } from '../context/WatchlistContext';
import { posterUrl } from '../api/movieApi';
import type { Movie } from '../api/movieApi';
import { IconBookmark, IconBookmarkFilled, IconStar, IconPlay } from './Icons';

interface MovieCardProps {
  movie: Movie;
  index?: number;
}

const MovieCard = React.memo(function MovieCard({ movie, index = 0 }: MovieCardProps) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const inWatchlist = isInWatchlist(movie.contentId);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    inWatchlist ? removeFromWatchlist(movie.contentId) : addToWatchlist(movie);
  };

  const src = posterUrl(movie.posterPath, movie.title);
  const rating = movie.rating != null ? Number(movie.rating).toFixed(1) : null;
  const year = movie.releaseYear ?? '';
  const genre = movie.genres?.[0] ?? '';

  void index;

  return (
    <Link
      to={`/movie/${movie.contentId}`}
      id={`movie-card-${movie.contentId}`}
      className="group block text-decoration-none select-none"
    >
      <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-[#0a0e17] border border-white/[0.07] group-hover:border-sky-500/50 group-hover:shadow-2xl group-hover:shadow-sky-500/20 group-hover:-translate-y-1.5 transition-all duration-300 ease-out before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/10 before:via-transparent before:to-transparent before:opacity-0 group-hover:before:opacity-100 before:transition-opacity before:duration-300 before:pointer-events-none before:z-10">
        <img
          src={src}
          alt={movie.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/300x450/06080e/0ea5e9?text=${encodeURIComponent(
              movie.title
            )}`;
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#06080e] via-transparent to-black/20 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
          <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[0.68rem] font-semibold text-neutral-300 shadow-sm">
            {movie.type === 'Series' ? 'TV' : '4K'}
          </span>

          <button
            onClick={toggle}
            className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md border transition-all active:scale-90 ${
              inWatchlist
                ? 'bg-sky-500 border-sky-400 text-white shadow-md shadow-sky-500/30'
                : 'bg-black/50 border-white/15 text-neutral-300 hover:text-sky-300 hover:border-sky-400/50 hover:bg-black/70'
            }`}
            title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            aria-label="Toggle Watchlist"
          >
            {inWatchlist ? <IconBookmarkFilled size={13} /> : <IconBookmark size={13} />}
          </button>
        </div>

        {/* Hover Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/40 transform scale-75 group-hover:scale-100 transition-transform duration-200">
            <IconPlay size={18} className="ml-0.5" />
          </div>
        </div>

        {/* Bottom Rating */}
        {rating && (
          <div className="absolute bottom-2.5 left-2.5 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-amber-500/35 text-amber-400 text-[0.72rem] font-bold shadow-[0_2px_10px_rgba(245,158,11,0.2)]">
            <IconStar size={11} className="text-amber-400" />
            <span>{rating}</span>
          </div>
        )}
      </div>

      <div
        className="px-1"
        style={{
          marginTop: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <h4 className="font-outfit font-bold text-sm text-neutral-200 group-hover:text-sky-300 transition-colors truncate">
          {movie.title}
        </h4>
        <div className="flex items-center gap-1.5 text-[0.74rem] text-neutral-400 font-medium truncate">
          {year && <span>{year}</span>}
          {genre && (
            <>
              <span className="text-neutral-600">•</span>
              <span className="truncate">{genre}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
});

export default MovieCard;

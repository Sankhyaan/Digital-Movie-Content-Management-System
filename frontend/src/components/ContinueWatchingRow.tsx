import React from 'react';
import { Link } from 'react-router-dom';
import type { Movie } from '../api/movieApi';
import { posterUrl, backdropUrl } from '../api/movieApi';
import { IconPlay, IconChevronRight } from './Icons';

interface ContinueWatchingRowProps {
  movies: Movie[];
}

interface SimulatedProgress {
  percent: number;
  remainingText: string;
  seasonEpisode?: string;
}

const SIMULATED_PROGRESS_MAP: SimulatedProgress[] = [
  { percent: 72, remainingText: '32m left', seasonEpisode: 'S1, Ep 3' },
  { percent: 45, remainingText: '1h 10m left', seasonEpisode: 'S2, Ep 1' },
  { percent: 88, remainingText: '14m left', seasonEpisode: 'S1, Ep 8' },
  { percent: 28, remainingText: '1h 45m left', seasonEpisode: 'Film' },
];

export default function ContinueWatchingRow({ movies = [] }: ContinueWatchingRowProps) {
  const validMovies = (Array.isArray(movies) ? movies : []).filter(
    (m): m is Movie => Boolean(m && m.contentId != null)
  );
  if (validMovies.length === 0) return null;

  const items = validMovies.slice(0, 4);

  return (
    <section className="space-y-3.5" id="continue-watching">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-600 shadow-sm shadow-sky-500" />
          <h2 className="font-outfit font-extrabold text-lg md:text-xl text-white tracking-tight">
            Continue Watching
          </h2>
        </div>

        <Link
          to="/search"
          className="text-xs font-semibold text-neutral-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
        >
          <span>See All</span>
          <IconChevronRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((movie, idx) => {
          const progress = SIMULATED_PROGRESS_MAP[idx % SIMULATED_PROGRESS_MAP.length];
          const poster = posterUrl(movie.posterPath, movie.title);
          const bg = backdropUrl(movie.backdropPath) || backdropUrl(movie.posterPath) || poster;

          return (
            <Link
              key={movie.contentId}
              to={`/movie/${movie.contentId}`}
              className="group relative rounded-2xl overflow-hidden bg-[#0a0e17] border border-white/[0.07] hover:border-sky-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/15 block"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-[#070a12]">
                <img
                  src={bg}
                  alt={movie.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = 'true';
                      target.src = poster;
                    } else {
                      target.onerror = null;
                      target.src = `https://placehold.co/400x225/070a12/0ea5e9?text=${encodeURIComponent(
                        movie.title || 'Movie'
                      )}`;
                    }
                  }}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#070a12] via-[#070a12]/50 to-transparent" />

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/40 transform scale-75 group-hover:scale-100 transition-transform duration-200">
                    <IconPlay size={18} className="ml-0.5" />
                  </div>
                </div>

                <div className="absolute bottom-2.5 left-3 right-3">
                  <h3 className="font-outfit font-bold text-sm text-white truncate drop-shadow">
                    {movie.title}
                  </h3>
                  <div className="flex items-center justify-between text-[0.7rem] text-neutral-300 mt-0.5 font-medium">
                    <span className="px-1.5 py-0.2 rounded bg-black/60 border border-white/10 text-sky-300 text-[0.65rem] font-semibold shadow-sm">
                      {progress.seasonEpisode}
                    </span>
                    <span className="text-neutral-400">{progress.remainingText}</span>
                  </div>
                </div>
              </div>

              {/* Electric Cyan Progress Bar */}
              <div className="w-full h-1 bg-neutral-800/80 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 rounded-r-full shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

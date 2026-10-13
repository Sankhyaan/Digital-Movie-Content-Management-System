import React from 'react';
import { Link } from 'react-router-dom';
import { clearSavedCineMatch } from '../utils/cinematchStorage';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      id="site-footer"
      className="mt-auto border-t border-white/[0.06] text-xs text-neutral-500 w-full max-w-full shrink-0 bg-[#06080e]/95 backdrop-blur-md z-30"
      style={{
        padding: '16px clamp(24px, 3.5vw, 48px)',
      }}
    >
      <div className="w-full flex flex-wrap items-center justify-between gap-6">
        {/* Brand Copyright */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-sky-500/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="15" rx="3" />
              <polyline points="17 2 12 7 7 2" />
            </svg>
          </div>
          <span className="font-outfit font-bold text-neutral-300">CineVerse</span>
          <span>© {currentYear}</span>
        </div>

        {/* Footer Navigation Links: Home, Explore, CineMatch, Watchlist */}
        <div className="flex flex-wrap items-center gap-6 text-neutral-400">
          <Link
            to="/home"
            onClick={() => {
              clearSavedCineMatch();
              window.dispatchEvent(new CustomEvent('cineverse:home-clicked'));
            }}
            className="hover:text-sky-300 transition-colors"
          >
            Home
          </Link>
          <Link
            to="/search"
            onClick={() => {
              clearSavedCineMatch();
            }}
            className="hover:text-sky-300 transition-colors"
          >
            Explore
          </Link>
          <Link
            to="/cinematch"
            onClick={() => {
              clearSavedCineMatch();
              window.dispatchEvent(new CustomEvent('cineverse:cinematch-reset'));
            }}
            className="hover:text-sky-300 transition-colors"
          >
            CineMatch
          </Link>
          <Link
            to="/watchlist"
            onClick={() => {
              clearSavedCineMatch();
            }}
            className="hover:text-sky-300 transition-colors"
          >
            Watchlist
          </Link>
        </div>
      </div>
    </footer>
  );
}


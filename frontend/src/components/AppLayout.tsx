import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWatchlist } from '../context/WatchlistContext';
import Footer from './Footer';
import {
  IconHome,
  IconCompass,
  IconBookmark,
  IconSparkles,
  IconClose,
  IconMenu,
  IconChevronUp,
} from './Icons';
import { clearSavedCineMatch } from '../utils/cinematchStorage';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  highlight?: boolean;
  count?: number;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { watchlist } = useWatchlist();
  const location = useLocation();
  const isMovieDetail = location.pathname.startsWith('/movie/');

  useEffect(() => {
    if (isMovieDetail) return;
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMovieDetail]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const discoverNavItems: NavItem[] = [
    { to: '/home', label: 'Home', icon: IconHome },
    { to: '/search', label: 'Explore', icon: IconCompass },
    { to: '/cinematch', label: 'CineMatch AI', icon: IconSparkles, highlight: true },
  ];

  const libraryNavItems: NavItem[] = [
    { to: '/watchlist', label: 'Watchlist', icon: IconBookmark, count: watchlist.length },
  ];

  const renderNavLinks = (items: NavItem[]) => (
    items.map((item) => {
      const Icon = item.icon;
      const isActive = (() => {
        if (item.to === '/home') return location.pathname === '/home' || location.pathname === '/';
        if (item.to === '/cinematch') return location.pathname === '/cinematch';
        const [itemPath, itemQuery] = item.to.split('?');
        if (itemQuery) {
          return location.pathname === itemPath && location.search.includes(itemQuery);
        }
        return location.pathname === itemPath || location.pathname.startsWith(itemPath);
      })();

      return (
        <Link
          key={item.label}
          to={item.to}
          title={sidebarCollapsed ? item.label : undefined}
          onClick={() => {
            setMobileMenuOpen(false);
            if (item.to === '/home' && (location.pathname === '/home' || location.pathname === '/')) {
              window.dispatchEvent(new CustomEvent('cineverse:home-clicked'));
            }
            if (item.to === '/cinematch' && location.pathname === '/cinematch') {
              clearSavedCineMatch();
              window.dispatchEvent(new CustomEvent('cineverse:cinematch-reset'));
            }
          }}
          className={`relative flex items-center rounded-xl font-medium transition-all duration-200 group ${
            sidebarCollapsed ? 'justify-center' : 'gap-3'
          } ${
            isActive
              ? 'bg-gradient-to-r from-sky-500/[0.14] via-sky-500/[0.08] to-transparent text-white font-semibold border border-sky-400/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_2px_12px_-2px_rgba(14,165,233,0.22)]'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
          }`}
          style={{
            padding: sidebarCollapsed ? '13px 0' : '11px 14px',
            fontSize: '0.92rem',
            width: '100%',
          }}
        >
          <div
            className={`w-5 shrink-0 flex items-center justify-center transition-all duration-200 ${
              isActive
                ? 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.65)]'
                : 'text-neutral-400 group-hover:text-neutral-200 group-hover:scale-105'
            }`}
          >
            <Icon size={19} />
          </div>

          {!sidebarCollapsed && (
            <>
              <span
                className={`flex-1 truncate tracking-tight transition-colors ${
                  isActive ? 'text-white font-semibold' : 'text-neutral-400 group-hover:text-neutral-200'
                }`}
              >
                {item.label}
              </span>

              {item.highlight && (
                <span
                  className={`shrink-0 text-[0.62rem] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-slate-950 font-black shadow-[0_0_10px_rgba(56,189,248,0.45)]'
                      : 'bg-sky-500/15 text-sky-300 border border-sky-400/25 group-hover:bg-sky-500/25 group-hover:border-sky-400/40'
                  }`}
                >
                  AI
                </span>
              )}

              {typeof item.count === 'number' && item.count > 0 && (
                <span
                  className={`shrink-0 text-[0.65rem] font-bold px-2 py-0.5 rounded-full border transition-all ${
                    isActive
                      ? 'bg-sky-400/20 text-sky-200 border-sky-400/35'
                      : 'bg-white/[0.06] text-neutral-400 border-white/[0.08] group-hover:text-white'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </>
          )}

          {sidebarCollapsed && typeof item.count === 'number' && item.count > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-sky-400 ring-2 ring-[#090d16]" />
          )}
        </Link>
      );
    })
  );

  return (
    <div className="flex min-h-screen bg-[#06080e] text-[#f1f5f9] antialiased selection:bg-sky-500/30 selection:text-sky-200">
      {/* ── Mobile Sidebar Overlay ────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Left Sidebar: Desktop Fixed + Mobile Off-canvas Drawer ─────────── */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-40 h-screen bg-[#090d16] border-r border-white/[0.06] flex flex-col shrink-0 transition-[width] duration-200 ease-in-out md:translate-x-0 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-60 lg:w-64'
        } ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ willChange: 'width' }}
      >
        {/* Brand Header */}
        <div
          className="h-[68px] flex items-center border-b border-white/[0.05] shrink-0 relative"
          style={{
            paddingLeft: sidebarCollapsed ? '0' : '20px',
            paddingRight: sidebarCollapsed ? '0' : '14px',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          }}
        >
          {sidebarCollapsed ? (
            /* Collapsed state: Hovering over icon transforms it to toggle button */
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="group relative w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-sky-500/40"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              {/* Default CineVerse TV icon — fades out on hover */}
              <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="15" rx="3" />
                  <polyline points="17 2 12 7 7 2" />
                </svg>
              </div>

              {/* Toggle expand icon — reveals on hover */}
              <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100 pointer-events-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m14 9 3 3-3 3" />
                </svg>
              </div>
            </button>
          ) : (
            /* Expanded state: Full logo and collapse button beside title */
            <>
              <Link
                to="/home"
                title="CineVerse Home"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (location.pathname === '/home' || location.pathname === '/') {
                    window.dispatchEvent(new CustomEvent('cineverse:home-clicked'));
                  }
                }}
                className="flex items-center gap-3 group text-decoration-none min-w-0"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 group-hover:shadow-sky-500/40 group-hover:shadow-lg transition-all duration-300 shrink-0">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="15" rx="3" />
                    <polyline points="17 2 12 7 7 2" />
                  </svg>
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-outfit font-black text-lg text-white tracking-tight leading-none">
                    Cine<span className="text-sky-400">Verse</span>
                  </span>
                  <span className="text-[0.62rem] font-bold tracking-widest uppercase text-sky-400/80 mt-1">
                    Cinema OTT
                  </span>
                </div>
              </Link>

              {/* Toggle button beside CineVerse title */}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="hidden md:flex p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m16 15-3-3 3-3" />
                </svg>
              </button>

              {/* Close button inside mobile drawer */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden absolute right-4 text-neutral-400 hover:text-white p-1"
                aria-label="Close menu"
              >
                <IconClose size={18} />
              </button>
            </>
          )}
        </div>

        {/* Navigation Sections */}
        <nav
          className="flex-1 overflow-y-auto scrollbar-none transition-all duration-300"
          style={{ padding: sidebarCollapsed ? '20px 8px' : '24px 16px' }}
        >
          {/* Section: DISCOVER */}
          <div>
            {!sidebarCollapsed ? (
              <div className="text-[0.6rem] font-bold tracking-[0.12em] uppercase text-neutral-500" style={{ paddingLeft: '12px', marginBottom: '10px' }}>
                Discover
              </div>
            ) : (
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 4px 12px' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {renderNavLinks(discoverNavItems)}
            </div>
          </div>

          {/* Section: LIBRARY */}
          <div style={{ marginTop: sidebarCollapsed ? '16px' : '28px' }}>
            {!sidebarCollapsed ? (
              <div className="text-[0.6rem] font-bold tracking-[0.12em] uppercase text-neutral-500" style={{ paddingLeft: '12px', marginBottom: '10px' }}>
                Library
              </div>
            ) : (
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 4px 12px' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {renderNavLinks(libraryNavItems)}
            </div>
          </div>
        </nav>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col min-w-0 w-full ${
          isMovieDetail ? 'h-screen max-h-screen overflow-hidden' : 'min-h-screen'
        }`}
      >
        {/* Mobile Header (Mobile Drawer Toggle only) */}
        <header className="md:hidden sticky top-0 z-30 h-14 bg-[#06080e]/95 backdrop-blur-md border-b border-white/[0.05] flex items-center px-4 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Open navigation menu"
          >
            <IconMenu size={20} />
          </button>
        </header>

        {/* Page Content Body */}
        <main
          className="flex-1 flex flex-col min-w-0 w-full max-w-full"
          style={{
            padding: isMovieDetail ? '0' : '36px 48px 32px 48px',
            overflow: isMovieDetail ? 'hidden' : 'visible',
          }}
        >
          {children}
        </main>

        {/* Footer: attached flush to the bottom */}
        <Footer />
      </div>

      {/* Scroll to Top Floating Button */}
      {!isMovieDetail && showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          id="scroll-to-top-btn"
          aria-label="Scroll to top"
          title="Scroll to top"
          className="fixed bottom-7 right-7 z-40 w-11 h-11 rounded-full bg-[#0b101c]/90 border border-sky-400/40 text-sky-400 hover:text-white hover:bg-sky-500/20 hover:border-sky-400/70 shadow-lg shadow-sky-500/20 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
        >
          <IconChevronUp size={20} />
        </button>
      )}
    </div>
  );
}

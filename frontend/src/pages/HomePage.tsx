import { useState, useEffect } from 'react';
import HeroCarousel from '../components/HeroCarousel';
import CategoryRow from '../components/CategoryRow';
import MovieCard from '../components/MovieCard';
import {
  fetchFeaturedMovies,
  fetchTrendingMovies,
  fetchMovies,
  getCachedData,
  setCachedData,
} from '../api/movieApi';
import type { Movie } from '../api/movieApi';

const CONTAINER: React.CSSProperties = {
  maxWidth: 'var(--container-max)',
  margin: '0 auto',
  padding: '0 32px',
};

interface HomeCache {
  featured: Movie[];
  trending: Movie[];
  actionMovies: Movie[];
  dramaMovies: Movie[];
  scifiMovies: Movie[];
  animMovies: Movie[];
  allMovies: Movie[];
}

let homeMemoryCache: HomeCache | null = null;

export default function HomePage() {
  const initialCache = homeMemoryCache || getCachedData<HomeCache>('home_page_bundle');

  const [featured,     setFeatured]     = useState<Movie[]>(() => initialCache?.featured || []);
  const [trending,     setTrending]     = useState<Movie[]>(() => initialCache?.trending || []);
  const [actionMovies, setActionMovies] = useState<Movie[]>(() => initialCache?.actionMovies || []);
  const [dramaMovies,  setDramaMovies]  = useState<Movie[]>(() => initialCache?.dramaMovies || []);
  const [scifiMovies,  setScifiMovies]  = useState<Movie[]>(() => initialCache?.scifiMovies || []);
  const [animMovies,   setAnimMovies]   = useState<Movie[]>(() => initialCache?.animMovies || []);
  const [allMovies,    setAllMovies]    = useState<Movie[]>(() => initialCache?.allMovies || []);
  const [loading,      setLoading]      = useState(() => !initialCache || initialCache.featured.length === 0);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [featuredData, trendingData, allData, actionData, dramaData, scifiData, animData] =
          await Promise.all([
            fetchFeaturedMovies(),
            fetchTrendingMovies(),
            fetchMovies({ limit: 48 }),
            fetchMovies({ genre: 'Action', limit: 20 }),
            fetchMovies({ genre: 'Drama', limit: 20 }),
            fetchMovies({ genre: 'Sci-Fi & Fantasy', limit: 20 }),
            fetchMovies({ genre: 'Animation', limit: 20 }),
          ]);

        if (!isMounted) return;

        setFeatured(featuredData);
        setTrending(trendingData);
        setAllMovies(allData);
        setActionMovies(actionData);
        setDramaMovies(dramaData);
        setScifiMovies(scifiData);
        setAnimMovies(animData);

        const newBundle: HomeCache = {
          featured: featuredData,
          trending: trendingData,
          allMovies: allData,
          actionMovies: actionData,
          dramaMovies: dramaData,
          scifiMovies: scifiData,
          animMovies: animData,
        };
        homeMemoryCache = newBundle;
        setCachedData('home_page_bundle', newBundle);
      } catch (error) {
        console.error('Failed to load home data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // If we have cached data, fetch in background without blocking UI
    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const more = await fetchMovies({ limit: 48, offset: allMovies.length }, true);
      if (more.length === 0) {
        setHasMore(false);
      } else {
        const updated = [...allMovies, ...more];
        setAllMovies(updated);
        if (homeMemoryCache) homeMemoryCache.allMovies = updated;
      }
    } catch (e) {
      console.error('Failed to load more movies:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div style={{ ...CONTAINER, paddingTop: 'calc(var(--navbar-height) + 32px)', paddingBottom: '64px' }}>
        <div className="skeleton" style={{ width: '100%', height: '500px', borderRadius: '20px', marginBottom: '48px' }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: '48px' }}>
            <div className="skeleton" style={{ width: '200px', height: '28px', borderRadius: '8px', marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '18px' }}>
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="skeleton" style={{ width: '160px', height: '240px', borderRadius: '10px', flexShrink: 0 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div id="home-page">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          ...CONTAINER,
          paddingTop: 'calc(var(--navbar-height) + 20px)',
          paddingBottom: '12px',
        }}
      >
        <HeroCarousel movies={featured} />
      </div>

      {/* ── Rows + Grid ──────────────────────────────────────────────────── */}
      <div style={{ ...CONTAINER, paddingTop: '40px', paddingBottom: '64px' }}>
        <CategoryRow title="Trending Now"     movies={trending}     icon="🔥" />
        <CategoryRow title="Action"           movies={actionMovies}  icon="💥" />
        <CategoryRow title="Drama"            movies={dramaMovies}   icon="🎭" />
        <CategoryRow title="Sci-Fi & Fantasy" movies={scifiMovies}   icon="🚀" />
        <CategoryRow title="Animation"        movies={animMovies}    icon="✨" />

        {/* ── All Movies Grid ──────────────────────────────────────────── */}
        {allMovies.length > 0 && (
          <section style={{ marginTop: '16px' }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <span style={{ fontSize: '1.4rem' }}>🎬</span>
              <h2 style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.35rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}>
                All Titles
              </h2>
              <div style={{ height: '3px', width: '40px', borderRadius: '99px', background: 'var(--gradient-accent)' }} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
                gap: '20px',
              }}
            >
              {allMovies.map((movie, index) => (
                <MovieCard key={`${movie.contentId}-${index}`} movie={movie} index={index} />
              ))}
            </div>

            {hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  id="load-more-btn"
                  style={{
                    padding: '12px 32px',
                    borderRadius: '12px',
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: 'var(--accent-bright)',
                    cursor: loadingMore ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingMore) {
                      e.currentTarget.style.background = 'rgba(16,185,129,0.22)';
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(16,185,129,0.12)';
                    e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)';
                  }}
                >
                  {loadingMore ? 'Loading more titles...' : 'Load More Titles ↓'}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

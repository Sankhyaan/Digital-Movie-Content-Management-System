import React, { useState, useEffect, useCallback } from 'react';
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
import {
  IconSparkles,
  IconChevronRight,
  IconFire,
  IconLightning,
  IconTheater,
  IconFilm,
  IconStar,
} from '../components/Icons';

interface HomeCache {
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

  // Top panel: always fresh random 10 movies on visit/click/refresh
  const [featured, setFeatured] = useState<Movie[]>([]);
  const [trending, setTrending] = useState<Movie[]>(() => initialCache?.trending || []);
  const [actionMovies, setActionMovies] = useState<Movie[]>(() => initialCache?.actionMovies || []);
  const [dramaMovies, setDramaMovies] = useState<Movie[]>(() => initialCache?.dramaMovies || []);
  const [scifiMovies, setScifiMovies] = useState<Movie[]>(() => initialCache?.scifiMovies || []);
  const [animMovies, setAnimMovies] = useState<Movie[]>(() => initialCache?.animMovies || []);
  const [allMovies, setAllMovies] = useState<Movie[]>(() => initialCache?.allMovies || []);
  const [loading, setLoading] = useState(() => !initialCache || initialCache.trending.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Fetch a fresh set of random 10 featured titles
  const refreshFeatured = useCallback(async () => {
    try {
      const featuredData = await fetchFeaturedMovies(true);
      if (featuredData && featuredData.length > 0) {
        setFeatured(featuredData);
      }
    } catch (err) {
      console.error('Failed to load random featured movies:', err);
    }
  }, []);

  // Listen for Home tab click event (e.g. clicking Home in sidebar while already on /)
  useEffect(() => {
    const onHomeClick = () => {
      refreshFeatured();
    };
    window.addEventListener('cineverse:home-clicked', onHomeClick);
    return () => {
      window.removeEventListener('cineverse:home-clicked', onHomeClick);
    };
  }, [refreshFeatured]);

  const loadData = useCallback(async () => {
    try {
      const [
        featuredRes,
        trendingRes,
        allRes,
        actionRes,
        dramaRes,
        scifiRes,
        animRes,
      ] = await Promise.allSettled([
        fetchFeaturedMovies(true),
        fetchTrendingMovies(),
        fetchMovies({ limit: 48 }),
        fetchMovies({ genre: 'Action', limit: 20 }),
        fetchMovies({ genre: 'Drama', limit: 20 }),
        fetchMovies({ genre: 'Sci-Fi & Fantasy', limit: 20 }),
        fetchMovies({ genre: 'Animation', limit: 20 }),
      ]);

      const featuredData = featuredRes.status === 'fulfilled' ? featuredRes.value : [];
      const trendingData = trendingRes.status === 'fulfilled' ? trendingRes.value : [];
      const allData      = allRes.status === 'fulfilled' ? allRes.value : [];
      const actionData   = actionRes.status === 'fulfilled' ? actionRes.value : [];
      const dramaData    = dramaRes.status === 'fulfilled' ? dramaRes.value : [];
      const scifiData    = scifiRes.status === 'fulfilled' ? scifiRes.value : [];
      const animData     = animRes.status === 'fulfilled' ? animRes.value : [];

      setFeatured(featuredData);
      setTrending(trendingData);
      setAllMovies(allData);
      setActionMovies(actionData);
      setDramaMovies(dramaData);
      setScifiMovies(scifiData);
      setAnimMovies(animData);

      const newBundle: HomeCache = {
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const more = await fetchMovies({ limit: 48, offset: allMovies.length }, true);
      const existingIds = new Set(allMovies.map((m) => m.contentId));
      const uniqueMore = more.filter((m) => m && m.contentId != null && !existingIds.has(m.contentId));
      if (uniqueMore.length === 0) {
        setHasMore(false);
      } else {
        const updated = [...allMovies, ...uniqueMore];
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
      <div className="space-y-10 animate-pulse">
        <div className="w-full h-[450px] md:h-[510px] rounded-[28px] skeleton" />
        <div className="space-y-4">
          <div className="w-40 h-5 rounded skeleton" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-video rounded-2xl skeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasAnyContent = featured.length > 0 || trending.length > 0 || allMovies.length > 0;

  if (!hasAnyContent) {
    return (
      <div className="flex flex-col items-center justify-center py-28 px-4 text-center space-y-4" id="home-empty-state">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <IconFilm size={32} />
        </div>
        <h3 className="font-outfit font-bold text-xl text-white">
          No Titles Available
        </h3>
        <p className="text-sm text-neutral-400 max-w-md">
          Unable to load movies right now. Please check your connection or tap Retry to reload.
        </p>
        <button
          onClick={() => { setLoading(true); loadData(); }}
          className="btn-primary py-2.5 px-6 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '56px' }} id="home-page">
      {/* Featured Carousel Banner */}
      {featured.length > 0 && (
        <section>
          <HeroCarousel movies={featured} />
        </section>
      )}

      {/* Content Shelves from Database */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '52px' }}>
        {trending.length > 0 && (
          <CategoryRow
            title="Now Trending"
            movies={trending}
            icon={<IconFire size={20} />}
            seeAllLink="/search"
          />
        )}

        {actionMovies.length > 0 && (
          <CategoryRow
            title="Action & Adventure"
            movies={actionMovies}
            icon={<IconLightning size={20} />}
            seeAllLink="/search?genre=Action"
          />
        )}

        {scifiMovies.length > 0 && (
          <CategoryRow
            title="Sci-Fi & Cosmos"
            movies={scifiMovies}
            icon={<IconSparkles size={20} />}
            seeAllLink="/search?genre=Sci-Fi%20%26%20Fantasy"
          />
        )}

        {dramaMovies.length > 0 && (
          <CategoryRow
            title="Masterpiece Dramas"
            movies={dramaMovies}
            icon={<IconTheater size={20} />}
            seeAllLink="/search?genre=Drama"
          />
        )}

        {animMovies.length > 0 && (
          <CategoryRow
            title="Animation"
            movies={animMovies}
            icon={<IconStar size={20} />}
            seeAllLink="/search?genre=Animation"
          />
        )}
      </section>

      {/* All Titles Catalog Grid from Database */}
      {allMovies.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingTop: '44px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '6px', paddingRight: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '5px', height: '24px', borderRadius: '999px', background: 'linear-gradient(to bottom, #38bdf8, #2563eb)', boxShadow: '0 0 10px rgba(56, 189, 248, 0.45)' }} />
              <IconFilm size={20} className="text-sky-400" />
              <h2 className="font-outfit font-extrabold text-xl md:text-2xl text-white tracking-tight">
                All Titles
              </h2>
            </div>
            <span className="text-xs text-neutral-400 font-medium">
              {allMovies.length} Loaded
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '22px' }}>
            {allMovies.map((movie, index) => (
              <MovieCard
                key={`${movie.contentId}-${index}`}
                movie={movie}
                index={index}
              />
            ))}
          </div>

          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '28px', paddingBottom: '16px' }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                id="load-more-btn"
                className="btn-primary"
              >
                {loadingMore ? 'Loading...' : 'Load More Titles'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}


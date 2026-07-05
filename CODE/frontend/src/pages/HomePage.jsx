import { useState, useEffect } from 'react';
import HeroCarousel from '../components/HeroCarousel';
import CategoryRow from '../components/CategoryRow';
import MovieCard from '../components/MovieCard';
import { fetchFeaturedMovies, fetchTrendingMovies, fetchMovies } from '../api/movieApi';

const CONTAINER = {
  maxWidth: 'var(--container-max)',
  margin: '0 auto',
  padding: '0 32px',
};

export default function HomePage() {
  const [featured,    setFeatured]    = useState([]);
  const [trending,    setTrending]    = useState([]);
  const [actionMovies,setActionMovies]= useState([]);
  const [dramaMovies, setDramaMovies] = useState([]);
  const [scifiMovies, setScifiMovies] = useState([]);
  const [animMovies,  setAnimMovies]  = useState([]);
  const [allMovies,   setAllMovies]   = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [featuredData, trendingData, allData, actionData, dramaData, scifiData, animData] =
          await Promise.all([
            fetchFeaturedMovies(),
            fetchTrendingMovies(),
            fetchMovies(),
            fetchMovies({ genre: 'Action' }),
            fetchMovies({ genre: 'Drama' }),
            fetchMovies({ genre: 'Sci-Fi & Fantasy' }),
            fetchMovies({ genre: 'Animation' }),
          ]);
        setFeatured(featuredData);
        setTrending(trendingData);
        setAllMovies(allData);
        setActionMovies(actionData);
        setDramaMovies(dramaData);
        setScifiMovies(scifiData);
        setAnimMovies(animData);
      } catch (error) {
        console.error('Failed to load home data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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
        <CategoryRow title="Trending Now"       movies={trending}     icon="🔥" />
        <CategoryRow title="Action & Adventure" movies={actionMovies}  icon="💥" />
        <CategoryRow title="Drama"              movies={dramaMovies}   icon="🎭" />
        <CategoryRow title="Science Fiction"    movies={scifiMovies}   icon="🚀" />
        <CategoryRow title="Animation"          movies={animMovies}    icon="✨" />

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
                <MovieCard key={movie.contentId} movie={movie} index={index} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

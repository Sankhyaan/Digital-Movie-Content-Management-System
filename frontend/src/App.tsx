import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WatchlistProvider } from './context/WatchlistContext';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import MovieDetailPage from './pages/MovieDetailPage';
import SearchPage from './pages/SearchPage';
import WatchlistPage from './pages/WatchlistPage';
import CineMatchPage from './pages/CineMatchPage';

function App() {
  return (
    <WatchlistProvider>
      <Router>
        <AppLayout>
          <div className="flex-1 flex flex-col w-full min-w-0">
            <Routes>
              {/* Default page is Home */}
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/cinematch" element={<CineMatchPage />} />
              <Route path="/movie/:id" element={<MovieDetailPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
            </Routes>
          </div>
        </AppLayout>
      </Router>
    </WatchlistProvider>
  );
}

export default App;

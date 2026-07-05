import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRecommendations } from '../api/movieApi';
import MovieCard from '../components/MovieCard';

const QUESTIONS = [
  {
    id: 'vibe',
    title: 'What kind of vibe are you looking for today?',
    options: [
      { label: '🤯 Blow my mind!', value: 'Science Fiction' },
      { label: '😂 Make me laugh out loud.', value: 'Comedy' },
      { label: '💥 Keep me on the edge of my seat.', value: 'Action' },
      { label: '❤️ Something heartfelt and emotional.', value: 'Drama' },
      { label: '🤷 Surprise me!', value: null },
    ],
  },
  {
    id: 'time',
    title: 'How much time do you have?',
    options: [
      { label: '⏱️ Just a quick movie.', type: 'Movie', maxDuration: 120 },
      { label: '🍿 I want a long, epic movie.', type: 'Movie', maxDuration: 300 },
      { label: '📺 A quick series to binge.', type: 'Series', maxDuration: 2 },
      { label: '🛋️ A long show to get invested in.', type: 'Series', maxDuration: 20 },
      { label: '🤷 I don\'t care.', type: null, maxDuration: null },
    ],
  },
  {
    id: 'era',
    title: 'Do you prefer modern hits or older classics?',
    options: [
      { label: '✨ Brand new releases only.', minYear: 2020 },
      { label: '💿 Modern classics.', minYear: 2000 },
      { label: '📼 Old school retro vibes.', minYear: 1900 },
      { label: '🤷 Doesn\'t matter to me.', minYear: null },
    ],
  },
  {
    id: 'picky',
    title: 'How picky are you feeling?',
    options: [
      { label: '🏆 Only the absolute masterpieces.', minRating: 8.5 },
      { label: '👍 Anything decent is fine.', minRating: 7.0 },
      { label: '🍿 Just give me something.', minRating: null },
    ],
  },
];

export default function CineMatchPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({
    vibe: null,
    type: null,
    maxDuration: null,
    minYear: null,
    minRating: null,
  });
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleOptionSelect = async (option) => {
    // Update answers based on the current question
    const stepData = QUESTIONS[currentStep];
    const newAnswers = { ...answers };
    
    if (stepData.id === 'vibe') {
      newAnswers.vibe = option.value;
    } else if (stepData.id === 'time') {
      newAnswers.type = option.type;
      newAnswers.maxDuration = option.maxDuration;
    } else if (stepData.id === 'era') {
      newAnswers.minYear = option.minYear;
    } else if (stepData.id === 'picky') {
      newAnswers.minRating = option.minRating;
    }

    setAnswers(newAnswers);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Finished quiz! Fetch recommendations
      setLoading(true);
      try {
        const matches = await fetchRecommendations(newAnswers);
        // Artificial delay for dramatic effect
        setTimeout(() => {
          setResults(matches);
          setLoading(false);
        }, 1500);
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
        setLoading(false);
        setResults([]);
      }
    }
  };

  const resetQuiz = () => {
    setCurrentStep(0);
    setAnswers({ vibe: null, type: null, maxDuration: null, minYear: null, minRating: null });
    setResults(null);
  };

  // ── Render Loading State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton" style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '20px', animation: 'pulse 1s infinite alternate' }} />
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2rem', color: 'var(--accent-primary)', marginBottom: '10px' }}>
          Finding your perfect match...
        </h2>
        <p style={{ color: 'var(--text-muted)' }}>Running complex database queries to find the best content for you.</p>
      </div>
    );
  }

  // ── Render Results State ──────────────────────────────────────────────────
  if (results !== null) {
    const excitedMessages = [
      { emoji: '🎯', text: 'Nailed it!', sub: `We found ${results.length} spot-on pick${results.length === 1 ? '' : 's'} just for you.` },
      { emoji: '🔥', text: 'You\'re going to love these!', sub: `${results.length} hand-picked recommendation${results.length === 1 ? '' : 's'} from our database.` },
      { emoji: '🍿', text: 'Grab your popcorn!', sub: `${results.length} perfect match${results.length === 1 ? '' : 'es'} waiting for you.` },
    ];
    const msg = results.length > 0 ? excitedMessages[results.length % excitedMessages.length] : null;

    return (
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: 'calc(var(--navbar-height) + 40px) 36px 64px' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          {results.length > 0 ? (
            <>
              <div style={{ fontSize: '4rem', marginBottom: '12px', animation: 'none' }}>{msg.emoji}</div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2.8rem', fontWeight: 800, marginBottom: '12px', background: 'linear-gradient(135deg, #f0fdf4 0%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {msg.text}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '520px', margin: '0 auto 8px' }}>
                {msg.sub}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 auto 28px' }}>
                ✨ Powered by your <strong style={{ color: 'var(--accent-primary)' }}>CineMatch</strong> preferences &amp; a custom SQL stored procedure
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '4rem', marginBottom: '12px' }}>😅</div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2.4rem', fontWeight: 800, marginBottom: '12px' }}>
                Your tastes are one of a kind!
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '520px', margin: '0 auto 28px' }}>
                Even our database couldn't pin you down. Try loosening your criteria!
              </p>
            </>
          )}
          <button
            onClick={resetQuiz}
            style={{
              padding: '12px 28px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #10b981, #065f46)', color: '#fff',
              fontFamily: "'Outfit', sans-serif", fontSize: '0.95rem', fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16,185,129,0.35)', transition: 'transform 0.18s, box-shadow 0.18s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(16,185,129,0.5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(16,185,129,0.35)'; }}
          >
            🎲 Take Quiz Again
          </button>
        </div>

        {/* ── Cards Grid ── */}
        {results.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <div style={{ width: '3px', height: '20px', background: 'linear-gradient(180deg, #10b981, #065f46)', borderRadius: '2px' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Your Recommendations
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
              gap: '20px',
            }}>
              {results.map((movie, index) => (
                <MovieCard key={movie.contentId} movie={movie} index={index} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }


  // ── Render Quiz State ─────────────────────────────────────────────────────
  const currentQuestion = QUESTIONS[currentStep];

  return (
    <div style={{ minHeight: 'calc(100vh - var(--navbar-height))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center', marginBottom: '40px' }}>
        <span style={{ display: 'inline-block', padding: '6px 12px', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-primary)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '20px' }}>
          QUESTION {currentStep + 1} OF {QUESTIONS.length}
        </span>
        <h1 className="animate-slide-up" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 }}>
          {currentQuestion.title}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '500px' }}>
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            className="animate-slide-up"
            style={{
              animationDelay: `${index * 0.1}s`,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '20px 24px',
              borderRadius: '16px',
              fontSize: '1.1rem',
              color: 'var(--text-primary)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(16,185,129,0.1)';
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onClick={() => handleOptionSelect(option)}
          >
            {option.label}
          </button>
        ))}
      </div>
      
    </div>
  );
}

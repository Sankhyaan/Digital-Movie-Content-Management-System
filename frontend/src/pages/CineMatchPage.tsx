import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  buildPreferenceProfile,
  getRecommendations,
  fetchMovies,
  UserPreferenceProfile,
  RecommendationResult,
  Movie,
} from '../api/movieApi';
import MovieCard from '../components/MovieCard';
import {
  IconSparkles,
  IconBrain,
  IconChevronRight,
  IconChevronLeft,
  IconFilm,
} from '../components/Icons';
import {
  getSavedCineMatch,
  saveCineMatch,
  clearSavedCineMatch,
} from '../utils/cinematchStorage';

type Mode = 'select' | 'guided' | 'custom' | 'results';

interface GuidedOption {
  label: string;
  value: any;
}

interface GuidedQuestion {
  id: string;
  title: string;
  options: GuidedOption[];
}

const GUIDED_QUESTIONS: GuidedQuestion[] = [
  {
    id: 'experience',
    title: 'Select your vibe',
    options: [
      { label: 'Thought-Provoking & Deep', value: 'thought_provoking' },
      { label: 'Lighthearted Comedy', value: 'funny' },
      { label: 'High-Stakes Thriller', value: 'thrilling' },
      { label: 'Heartfelt & Emotional', value: 'emotional' },
      { label: 'Escapist Sci-Fi & Fantasy', value: 'escapist' },
    ],
  },
  {
    id: 'type',
    title: 'Choose format',
    options: [
      { label: 'Feature Film', value: 'Movie' },
      { label: 'Television Series', value: 'Series' },
      { label: 'Any Format', value: null },
    ],
  },
  {
    id: 'runtime',
    title: 'Select duration',
    options: [
      { label: 'Under 2 Hours', value: 'under_2_hours' },
      { label: 'Standard 2 Hours', value: 'around_2_hours' },
      { label: 'Epic (2.5+ Hours)', value: 'long_movie_ok' },
      { label: 'Binge Series', value: 'binge_series' },
      { label: 'Any Length', value: 'no_preference' },
    ],
  },
  {
    id: 'era',
    title: 'Select era',
    options: [
      { label: 'Recent (2020+)', value: 'recent' },
      { label: '2000s – 2019', value: 'modern' },
      { label: 'Classic (Pre-2000)', value: 'classic' },
      { label: 'Any Era', value: 'any' },
    ],
  },
  {
    id: 'quality',
    title: 'Rating preference',
    options: [
      { label: 'Top-Rated (7.5+)', value: 'high' },
      { label: 'Popular (6.5+)', value: 'medium' },
      { label: 'All Titles', value: 'low' },
    ],
  },
];

const EXAMPLE_PROMPTS = [
  'Interstellar but faster paced',
  'Dark psychological thriller from the 2000s',
  'Family comedy with great reviews',
  'Cyberpunk sci-fi with mind-bending twists',
];

const OPTION_THEMES = [
  {
    accent: '#38bdf8', // Electric Cyan
    glow: 'rgba(56, 189, 248, 0.55)',
    glowSubtle: 'rgba(56, 189, 248, 0.2)',
    borderHover: 'rgba(56, 189, 248, 0.85)',
    bgHover: 'linear-gradient(90deg, rgba(14, 165, 233, 0.24) 0%, rgba(13, 22, 42, 0.95) 100%)',
    chevronBg: 'linear-gradient(135deg, #38bdf8, #0284c7)',
  },
  {
    accent: '#fbbf24', // Amber Gold
    glow: 'rgba(251, 191, 36, 0.55)',
    glowSubtle: 'rgba(251, 191, 36, 0.2)',
    borderHover: 'rgba(251, 191, 36, 0.85)',
    bgHover: 'linear-gradient(90deg, rgba(245, 158, 11, 0.24) 0%, rgba(26, 20, 10, 0.95) 100%)',
    chevronBg: 'linear-gradient(135deg, #fbbf24, #d97706)',
  },
  {
    accent: '#fb7185', // Neon Rose
    glow: 'rgba(251, 113, 133, 0.55)',
    glowSubtle: 'rgba(251, 113, 133, 0.2)',
    borderHover: 'rgba(251, 113, 133, 0.85)',
    bgHover: 'linear-gradient(90deg, rgba(244, 63, 94, 0.24) 0%, rgba(28, 12, 18, 0.95) 100%)',
    chevronBg: 'linear-gradient(135deg, #fb7185, #e11d48)',
  },
  {
    accent: '#c084fc', // Cosmic Violet
    glow: 'rgba(192, 132, 252, 0.55)',
    glowSubtle: 'rgba(192, 132, 252, 0.2)',
    borderHover: 'rgba(192, 132, 252, 0.85)',
    bgHover: 'linear-gradient(90deg, rgba(168, 85, 247, 0.24) 0%, rgba(22, 12, 34, 0.95) 100%)',
    chevronBg: 'linear-gradient(135deg, #c084fc, #9333ea)',
  },
  {
    accent: '#34d399', // Emerald Mint
    glow: 'rgba(52, 211, 153, 0.55)',
    glowSubtle: 'rgba(52, 211, 153, 0.2)',
    borderHover: 'rgba(52, 211, 153, 0.85)',
    bgHover: 'linear-gradient(90deg, rgba(16, 185, 129, 0.24) 0%, rgba(10, 24, 18, 0.95) 100%)',
    chevronBg: 'linear-gradient(135deg, #34d399, #059669)',
  },
];

export default function CineMatchPage() {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = getSavedCineMatch();
    return saved && saved.recommendations && saved.recommendations.length > 0 ? 'results' : 'select';
  });
  const [currentStep, setCurrentStep] = useState(0);

  const [guidedAnswers, setGuidedAnswers] = useState({
    experience: null as string | null,
    type: null as 'Movie' | 'Series' | null,
    runtime_preference: null as string | null,
    era_preference: null as string | null,
    quality_preference: null as string | null,
  });

  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserPreferenceProfile | null>(() => {
    const saved = getSavedCineMatch();
    return saved ? saved.profile : null;
  });
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>(() => {
    const saved = getSavedCineMatch();
    return saved ? saved.recommendations : [];
  });

  const startGuided = () => {
    setCurrentStep(0);
    setGuidedAnswers({
      experience: null,
      type: null,
      runtime_preference: null,
      era_preference: null,
      quality_preference: null,
    });
    setProfile(null);
    setRecommendations([]);
    setError(null);
    setMode('guided');
  };

  const startCustom = () => {
    setProfile(null);
    setRecommendations([]);
    setError(null);
    setMode('custom');
  };

  const handleNewSearch = () => {
    clearSavedCineMatch();
    setRecommendations([]);
    setProfile(null);
    setError(null);
    setCustomPrompt('');
    setMode('select');
  };

  useEffect(() => {
    const handleReset = () => {
      handleNewSearch();
    };
    window.addEventListener('cineverse:cinematch-reset', handleReset);
    return () => {
      window.removeEventListener('cineverse:cinematch-reset', handleReset);
    };
  }, []);

  const executeRecommendationPipeline = async (builtProfile: UserPreferenceProfile) => {
    setLoading(true);
    setError(null);

    try {
      const recResult = await getRecommendations(builtProfile, false);
      if (!recResult || !recResult.success) {
        throw new Error('No results returned.');
      }
      if ((recResult as any).clarification_needed) {
        setError((recResult as any).message || "We couldn't identify any clear movie preferences in your request. Try describing genres, moods, actors, or movie titles you enjoy.");
      }
      setProfile(builtProfile);
      let recs = Array.isArray(recResult.recommendations) ? recResult.recommendations : [];

      if (recs.length === 0 && !(recResult as any).clarification_needed) {
        try {
          const fallback = await fetchMovies({ limit: 12 }, false);
          if (Array.isArray(fallback) && fallback.length > 0) {
            recs = fallback.map((m) => ({
              content_id: m.contentId,
              title: m.title,
              type: m.type,
              poster_path: m.posterPath || null,
              rating: m.rating || null,
              release_year: m.releaseYear || null,
              genres: m.genres || [],
              recommendation_score: 0.85,
              match_percentage: 85,
              score_breakdown: {
                semantic: 0.8,
                experience: 0.8,
                genre: 0.8,
                reference: 0.8,
                runtime: 0.8,
                era: 0.8,
                quality: 0.8,
                language: 0.8,
                platform: 0.8,
              },
              match_reasons: ['Trending catalog title recommended for you'],
            }));
            setError('No exact matches found for that specific combination — showing top catalog titles instead:');
          }
        } catch {}
      }

      setRecommendations(recs);
      setMode('results');
      if (recs.length > 0) {
        saveCineMatch({
          recommendations: recs,
          profile: builtProfile,
        });
      }
    } catch (err: any) {
      console.error('Failed recommendations:', err);
      setError('Recommendation service is temporarily initializing. Displaying top catalog titles below:');
      try {
        const fallback = await fetchMovies({ limit: 12 }, false);
        if (Array.isArray(fallback) && fallback.length > 0) {
          const fallbackRecs = fallback.map((m) => ({
            content_id: m.contentId,
            title: m.title,
            type: m.type,
            poster_path: m.posterPath || null,
            rating: m.rating || null,
            release_year: m.releaseYear || null,
            genres: m.genres || [],
            recommendation_score: 0.8,
            match_percentage: 80,
            score_breakdown: {
              semantic: 0.8,
              experience: 0.8,
              genre: 0.8,
              reference: 0.8,
              runtime: 0.8,
              era: 0.8,
              quality: 0.8,
              language: 0.8,
              platform: 0.8,
            },
            match_reasons: ['Curated popular selection'],
          }));
          setRecommendations(fallbackRecs);
        }
      } catch {}
      setMode('results');
    } finally {
      setLoading(false);
    }
  };

  const handleGuidedSelect = async (val: any) => {
    const q = GUIDED_QUESTIONS[currentStep];
    const updated = { ...guidedAnswers };

    if (q.id === 'experience') updated.experience = val;
    else if (q.id === 'type') updated.type = val;
    else if (q.id === 'runtime') updated.runtime_preference = val;
    else if (q.id === 'era') updated.era_preference = val;
    else if (q.id === 'quality') updated.quality_preference = val;

    setGuidedAnswers(updated);

    if (currentStep < GUIDED_QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setLoading(true);
      try {
        const profileRes = await buildPreferenceProfile({
          source: 'guided',
          answers: updated,
        });
        await executeRecommendationPipeline(profileRes.profile);
      } catch (err: any) {
        console.error(err);
        setError('Failed to process choices.');
        setLoading(false);
        setMode('results');
      }
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    setLoading(true);
    try {
      const profileRes = await buildPreferenceProfile({
        source: 'custom',
        prompt: customPrompt.trim(),
      });
      await executeRecommendationPipeline(profileRes.profile);
    } catch (err: any) {
      console.error(err);
      setError('Failed to parse search prompt.');
      setLoading(false);
      setMode('results');
    }
  };

  const handleQuickPrompt = async (promptText: string) => {
    setCustomPrompt(promptText);
    setLoading(true);
    setError(null);
    try {
      const profileRes = await buildPreferenceProfile({
        source: 'custom',
        prompt: promptText,
      });
      await executeRecommendationPipeline(profileRes.profile);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load recommendation matches.');
      setLoading(false);
      setMode('results');
    }
  };

  // ── Unified Render with Persistent Background ──────────────────────────────
  return (
    <div
      className={`flex-1 flex flex-col items-center w-full relative ${
        mode === 'results' ? 'justify-start' : 'justify-center'
      }`}
      style={{
        minHeight: 'calc(100vh - 120px)',
        paddingTop: '32px',
        paddingBottom: '60px',
      }}
    >
      {/* High-Performance Ambient Glow Backdrop (Zero GPU lag, 60fps) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 18%, rgba(14, 165, 233, 0.12) 0%, rgba(6, 8, 14, 0.88) 60%, #06080e 100%)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: '38%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '850px',
            height: '520px',
            background: 'radial-gradient(ellipse at center, rgba(14, 165, 233, 0.14) 0%, rgba(99, 102, 241, 0.05) 50%, transparent 72%)',
            filter: 'blur(75px)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.7) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Dynamic Content Views in Foreground */}
      <div className="relative z-10 w-full flex flex-col items-center">

        {/* Loading Spinner */}
        {loading && (
          <div className="min-h-[55vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin" />
            <h2 className="font-outfit font-bold text-2xl text-white">
              Matching Cinema Titles...
            </h2>
          </div>
        )}

        {/* Mode: Select Screen */}
        {!loading && mode === 'select' && (
          <div className="w-full max-w-[880px] mx-auto flex flex-col items-center px-4 sm:px-6">
            {/* Heading block — centered with balanced hierarchy */}
            <div className="text-center flex flex-col items-center max-w-[680px]" style={{ marginBottom: '44px' }}>
              {/* Pill badge with dark shade and glowing border */}
              <div
                className="cinematch-badge-glow inline-flex items-center gap-2 rounded-full text-sky-300 text-[11px] font-bold tracking-widest uppercase transition-all duration-300 select-none"
                style={{ padding: '7px 20px', marginBottom: '24px' }}
              >
                <IconSparkles size={13} className="text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]" />
                <span className="drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]">AI Recommendation Engine</span>
              </div>

              <h1
                className="font-outfit font-black text-4xl sm:text-5xl md:text-[54px] text-white tracking-tight leading-[1.12] drop-shadow-md"
                style={{ marginBottom: '16px' }}
              >
                Discover Your{' '}
                <span className="bg-gradient-to-r from-sky-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
                  Next Watch
                </span>
              </h1>

              <p className="text-[15px] sm:text-[16px] text-neutral-300 font-normal leading-[1.65] text-center">
                Find films and series tailored to your taste — answer a few quick questions or describe exactly what you want.
              </p>
            </div>

            {/* Two option boxes — squarish, mid-aligned, with comfortable vertical spacing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[700px] mx-auto">
              {/* Card 1: Guided Quiz */}
              <button
                type="button"
                onClick={startGuided}
                className="group cinematch-card-glow relative rounded-[22px] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06080e] w-full"
                style={{
                  background: 'linear-gradient(145deg, rgba(13, 21, 38, 0.94) 0%, rgba(8, 12, 22, 0.98) 100%)',
                  backdropFilter: 'blur(16px)',
                  padding: '30px 28px 32px 28px',
                }}
              >
                {/* Subtle radial sheen on card hover */}
                <div
                  className="absolute inset-0 rounded-[22px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at 25% 20%, rgba(14, 165, 233, 0.22) 0%, transparent 65%)',
                  }}
                />

                <div className="relative z-10 flex flex-col h-full justify-between">
                  {/* 1st line: Icon and Title */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className="rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/10 border border-sky-400/35 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/25 group-hover:border-sky-400/60 group-hover:text-sky-300 group-hover:scale-105 transition-all duration-300 shrink-0 shadow-md shadow-sky-500/15"
                      style={{ width: '48px', height: '48px' }}
                    >
                      <IconBrain size={24} />
                    </div>
                    <h2 className="font-outfit font-black text-xl sm:text-[21px] text-white tracking-tight leading-snug group-hover:text-sky-300 transition-colors">
                      CineMatch Quiz
                    </h2>
                  </div>

                  {/* 2nd & 3rd lines: Description */}
                  <p
                    className="text-[13.5px] sm:text-[14px] text-neutral-300 leading-relaxed font-normal min-h-[42px]"
                    style={{ marginTop: '22px' }}
                  >
                    Answer 5 quick questions to match your current vibe, format, duration, and era.
                  </p>

                  {/* 4th line: Mid-aligned glossy blue button */}
                  <div className="flex justify-center w-full" style={{ marginTop: '30px' }}>
                    <div
                      className="border border-sky-400/70 text-white font-bold text-[14px] tracking-wide transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[0_6px_24px_rgba(0,119,230,0.6)]"
                      style={{
                        background: 'linear-gradient(180deg, #0e85f5 0%, #0066d6 55%, #0052b3 100%)',
                        boxShadow: '0 4px 18px rgba(0, 102, 224, 0.45), inset 0 1px 1.5px rgba(255, 255, 255, 0.55), inset 0 -2px 4px rgba(0, 40, 120, 0.35)',
                        padding: '13px 42px',
                        borderRadius: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '175px',
                      }}
                    >
                      <span className="text-center select-none">Start Quiz</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Card 2: Custom Prompt */}
              <button
                type="button"
                onClick={startCustom}
                className="group cinematch-card-glow relative rounded-[22px] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06080e] w-full"
                style={{
                  background: 'linear-gradient(145deg, rgba(13, 21, 38, 0.94) 0%, rgba(8, 12, 22, 0.98) 100%)',
                  backdropFilter: 'blur(16px)',
                  padding: '30px 28px 32px 28px',
                }}
              >
                {/* Subtle radial sheen on card hover */}
                <div
                  className="absolute inset-0 rounded-[22px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at 25% 20%, rgba(14, 165, 233, 0.22) 0%, transparent 65%)',
                  }}
                />

                <div className="relative z-10 flex flex-col h-full justify-between">
                  {/* 1st line: Icon and Title */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className="rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/10 border border-sky-400/35 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/25 group-hover:border-sky-400/60 group-hover:text-sky-300 group-hover:scale-105 transition-all duration-300 shrink-0 shadow-md shadow-sky-500/15"
                      style={{ width: '48px', height: '48px' }}
                    >
                      <IconSparkles size={24} />
                    </div>
                    <h2 className="font-outfit font-black text-xl sm:text-[21px] text-white tracking-tight leading-snug group-hover:text-sky-300 transition-colors">
                      Custom Prompt
                    </h2>
                  </div>

                  {/* 2nd & 3rd lines: Description */}
                  <p
                    className="text-[13.5px] sm:text-[14px] text-neutral-300 leading-relaxed font-normal min-h-[42px]"
                    style={{ marginTop: '22px' }}
                  >
                    Describe what you want to watch in your own words — vibes or themes.
                  </p>

                  {/* 4th line: Mid-aligned glossy blue button */}
                  <div className="flex justify-center w-full" style={{ marginTop: '30px' }}>
                    <div
                      className="border border-sky-400/70 text-white font-bold text-[14px] tracking-wide transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[0_6px_24px_rgba(0,119,230,0.6)]"
                      style={{
                        background: 'linear-gradient(180deg, #0e85f5 0%, #0066d6 55%, #0052b3 100%)',
                        boxShadow: '0 4px 18px rgba(0, 102, 224, 0.45), inset 0 1px 1.5px rgba(255, 255, 255, 0.55), inset 0 -2px 4px rgba(0, 40, 120, 0.35)',
                        padding: '13px 42px',
                        borderRadius: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '175px',
                      }}
                    >
                      <span className="text-center select-none">Write Prompt</span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Mode: Guided Screen (Quiz) */}
        {!loading && mode === 'guided' && (
          <div
            className="cinematch-card-glow w-full mx-auto rounded-[24px] border border-white/[0.12]"
            style={{
              background: 'linear-gradient(145deg, rgba(13, 21, 38, 0.94) 0%, rgba(8, 12, 22, 0.98) 100%)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 0 36px 4px rgba(14, 165, 233, 0.28), 0 20px 40px -6px rgba(0, 0, 0, 0.85)',
              padding: '36px 32px',
              maxWidth: '560px',
            }}
          >
            <div className="w-full flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <button
                onClick={() => {
                  if (currentStep > 0) setCurrentStep(currentStep - 1);
                  else setMode('select');
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <IconChevronLeft size={16} />
                <span>{currentStep > 0 ? 'Back' : 'Cancel'}</span>
              </button>
              <span
                className="text-xs font-bold text-sky-400 bg-sky-500/10 rounded-full border border-sky-400/30"
                style={{ padding: '4px 12px' }}
              >
                {currentStep + 1} / {GUIDED_QUESTIONS.length}
              </span>
            </div>

            <h1
              className="font-outfit font-black text-2xl sm:text-3xl text-white text-center"
              style={{ marginBottom: '24px' }}
            >
              {GUIDED_QUESTIONS[currentStep].title}
            </h1>

            <div className="w-full flex flex-col" style={{ gap: '14px' }}>
              {GUIDED_QUESTIONS[currentStep].options.map((opt, idx) => {
                const theme = OPTION_THEMES[idx % OPTION_THEMES.length];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleGuidedSelect(opt.value)}
                    className="quiz-option-card group select-none text-left"
                    style={{
                      ['--opt-accent' as any]: theme.accent,
                      ['--opt-glow' as any]: theme.glow,
                      ['--opt-glow-subtle' as any]: theme.glowSubtle,
                      ['--opt-border' as any]: theme.borderHover,
                      ['--opt-bg-hover' as any]: theme.bgHover,
                      ['--opt-chevron-bg' as any]: theme.chevronBg,
                      padding: '16px 20px',
                    }}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Luminous Glowing Dot Indicator */}
                      <span
                        className="quiz-accent-dot w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300"
                        style={{
                          background: theme.accent,
                          boxShadow: `0 0 10px ${theme.accent}`,
                        }}
                      />
                      <span className="font-outfit font-bold text-sm sm:text-[15px] text-neutral-100 group-hover:text-white transition-colors duration-200 tracking-tight truncate">
                        {opt.label}
                      </span>
                    </div>

                    {/* Glowing Chevron Badge */}
                    <div
                      className="quiz-chevron-badge w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/10 text-neutral-400 group-hover:text-white transition-all duration-200 ml-3"
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      <IconChevronRight size={15} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode: Custom Screen */}
        {!loading && mode === 'custom' && (
          <div
            className="cinematch-card-glow w-full mx-auto rounded-[24px] border border-white/[0.12]"
            style={{
              background: 'linear-gradient(145deg, rgba(13, 21, 38, 0.94) 0%, rgba(8, 12, 22, 0.98) 100%)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 0 36px 4px rgba(14, 165, 233, 0.28), 0 20px 40px -6px rgba(0, 0, 0, 0.85)',
              padding: '36px 32px',
              maxWidth: '580px',
            }}
          >
            <div className="w-full" style={{ marginBottom: '20px' }}>
              <button
                onClick={() => setMode('select')}
                className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <IconChevronLeft size={16} />
                <span>Back</span>
              </button>
            </div>

            <h1
              className="font-outfit font-black text-2xl sm:text-3xl text-white text-center"
              style={{ marginBottom: '24px' }}
            >
              Describe what you want to watch
            </h1>

            <form onSubmit={handleCustomSubmit} className="w-full flex flex-col" style={{ gap: '18px' }}>
              <textarea
                rows={3}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. A fast-paced mystery thriller with unexpected plot twists..."
                className="w-full rounded-2xl bg-black/45 border border-white/[0.12] focus:border-sky-400 focus:bg-[#0b1324] focus:shadow-[0_0_20px_rgba(56,189,248,0.25)] text-white placeholder-neutral-500 text-sm outline-none resize-none shadow-inner transition-all duration-200"
                style={{ padding: '16px 18px', minHeight: '100px' }}
              />

              <button
                type="submit"
                disabled={!customPrompt.trim()}
                className="w-full text-white font-bold text-[14px] tracking-wide transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_6px_24px_rgba(0,119,230,0.6)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(180deg, #0e85f5 0%, #0066d6 55%, #0052b3 100%)',
                  boxShadow: '0 4px 18px rgba(0, 102, 224, 0.45), inset 0 1px 1.5px rgba(255, 255, 255, 0.55), inset 0 -2px 4px rgba(0, 40, 120, 0.35)',
                  padding: '14px 28px',
                  borderRadius: '14px',
                  border: '1px solid rgba(56, 189, 248, 0.7)',
                }}
              >
                <IconSparkles size={16} className="text-sky-200" />
                <span>Find Matches</span>
              </button>
            </form>

            <div className="w-full flex flex-wrap" style={{ gap: '8px', marginTop: '24px' }}>
              {EXAMPLE_PROMPTS.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCustomPrompt(ex)}
                  className="rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 hover:border-sky-400/50 text-xs text-sky-200 hover:text-white hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm hover:shadow-sky-500/20"
                  style={{ padding: '7px 14px' }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode: Results Screen */}
        {!loading && mode === 'results' && (
          <div className="w-full max-w-[1450px] mx-auto px-4 sm:px-6">
            <div
              className="flex items-center justify-between border-b border-white/[0.08]"
              style={{
                paddingTop: '6px',
                paddingBottom: '24px',
                marginBottom: '36px',
              }}
            >
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={handleNewSearch}
                  className="w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-sky-400/50 text-neutral-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm group"
                  title="Back to start"
                  aria-label="Back to starter options"
                >
                  <IconChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform text-sky-400" />
                </button>

                <h1 className="font-outfit font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                  Recommended for You
                </h1>
              </div>

              <button
                type="button"
                onClick={handleNewSearch}
                className="btn-primary text-xs font-semibold cursor-pointer shadow-lg shadow-sky-500/25"
                style={{ padding: '10px 22px' }}
              >
                New Search
              </button>
            </div>

            {error && (
              <div
                className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs"
                style={{ padding: '14px 18px', marginBottom: '28px' }}
              >
                {error}
              </div>
            )}

            {recommendations.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  columnGap: '22px',
                  rowGap: '38px',
                }}
              >
                {recommendations.map((rec, index) => {
                  const movieObj: Movie = {
                    contentId: rec.content_id,
                    title: rec.title,
                    type: rec.type,
                    posterPath: rec.poster_path ?? undefined,
                    rating: rec.rating ?? undefined,
                    releaseYear: rec.release_year ?? undefined,
                    genres: rec.genres || [],
                  };
                  return <MovieCard key={rec.content_id} movie={movieObj} index={index} />;
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 px-4 text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4 shadow-lg shadow-sky-500/10">
                  <IconFilm size={30} />
                </div>
                <h3 className="font-outfit font-extrabold text-xl text-white mb-2">
                  No Direct Matches Found
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 mb-6 leading-relaxed">
                  We couldn't find cinema titles matching every single constraint. Try selecting a broader format, explore popular cinema searches below, or browse the entire catalog.
                </p>

                {/* Popular recovery prompt chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                  {[
                    'Interstellar sci-fi adventure',
                    'Dark psychological thriller',
                    'Heartfelt family comedy',
                    'Mind-bending cyberpunk twists',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleQuickPrompt(chip)}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/20 hover:border-sky-400/50 text-xs text-sky-300 hover:text-white transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleNewSearch}
                    className="btn-primary py-2.5 px-6 text-xs font-semibold cursor-pointer shadow-lg shadow-sky-500/20"
                  >
                    Start New Search
                  </button>
                  <Link
                    to="/search"
                    className="py-2.5 px-6 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all"
                    style={{ textDecoration: 'none' }}
                  >
                    Browse Catalog
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

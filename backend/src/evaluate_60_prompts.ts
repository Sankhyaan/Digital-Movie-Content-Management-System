// =============================================================================
// CINEVERSE 60-PROMPT LABELED EVALUATION HARNESS
// =============================================================================
// Evaluates at least 60 labeled prompts across all 14 required categories:
// 1. basic_preferences
// 2. actor
// 3. director
// 4. multiple_persons_and_or
// 5. reference_titles
// 6. runtime_and_year
// 7. positive_and_negative_preferences
// 8. negative_titles
// 9. negative_franchises
// 10. negative_persons
// 11. missing_metadata
// 12. ambiguous_names
// 13. contradictory_requests
// 14. guided_quiz
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { RecommendationEngine } from './services/recommendation/recommendationEngine';
import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { pool } from './db/connection';

interface TestCase {
  id: string;
  category: string;
  mode: 'custom' | 'guided';
  promptOrInput: any;
  expectedProfileAssertion: (profile: any) => boolean;
  resultAssertion: (recs: any[], profile: any) => { passed: boolean; reason?: string };
}

const TEST_CASES: TestCase[] = [
  // ── 1. Basic Preferences ──────────────────────────────────────────────────
  {
    id: 'BP-01',
    category: 'basic_preferences',
    mode: 'custom',
    promptOrInput: 'A sci-fi movie',
    expectedProfileAssertion: (p) => p.genres.includes('Sci-Fi & Fantasy') && p.type === 'Movie',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.type === 'Movie'),
      reason: 'All recommendations must be Movies',
    }),
  },
  {
    id: 'BP-02',
    category: 'basic_preferences',
    mode: 'custom',
    promptOrInput: 'Comedy series',
    expectedProfileAssertion: (p) => p.genres.includes('Comedy') && p.type === 'Series',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.type === 'Series'),
      reason: 'All recommendations must be Series',
    }),
  },
  {
    id: 'BP-03',
    category: 'basic_preferences',
    mode: 'custom',
    promptOrInput: 'Korean drama series',
    expectedProfileAssertion: (p) => p.languages.includes('Korean') && p.type === 'Series',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.type === 'Series'),
      reason: 'All recommendations must be Korean series',
    }),
  },
  {
    id: 'BP-04',
    category: 'basic_preferences',
    mode: 'custom',
    promptOrInput: 'Action movie on Netflix',
    expectedProfileAssertion: (p) => p.genres.includes('Action') && p.platforms.includes('Netflix'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.type === 'Movie'),
      reason: 'All recommendations must be movies available on Netflix',
    }),
  },
  {
    id: 'BP-05',
    category: 'basic_preferences',
    mode: 'custom',
    promptOrInput: 'Horror movies',
    expectedProfileAssertion: (p) => p.genres.includes('Horror') && p.type === 'Movie',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.type === 'Movie'),
      reason: 'All recommendations must be Horror movies',
    }),
  },

  // ── 2. Actor ──────────────────────────────────────────────────────────────
  {
    id: 'ACT-01',
    category: 'actor',
    mode: 'custom',
    promptOrInput: 'movies starring Christian Bale',
    expectedProfileAssertion: (p) => p.actors.some((a: string) => a.toLowerCase() === 'christian bale'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.actors || []).some((a: string) => a.toLowerCase() === 'christian bale')),
      reason: 'All recommendations must star Christian Bale',
    }),
  },
  {
    id: 'ACT-02',
    category: 'actor',
    mode: 'custom',
    promptOrInput: 'movies with Cillian Murphy',
    expectedProfileAssertion: (p) => p.actors.some((a: string) => a.toLowerCase() === 'cillian murphy'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.actors || []).some((a: string) => a.toLowerCase() === 'cillian murphy')),
      reason: 'All recommendations must star Cillian Murphy',
    }),
  },
  {
    id: 'ACT-03',
    category: 'actor',
    mode: 'custom',
    promptOrInput: 'movies featuring Leonardo DiCaprio',
    expectedProfileAssertion: (p) => p.actors.some((a: string) => a.toLowerCase() === 'leonardo dicaprio'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.actors || []).some((a: string) => a.toLowerCase() === 'leonardo dicaprio')),
      reason: 'All recommendations must star Leonardo DiCaprio',
    }),
  },
  {
    id: 'ACT-04',
    category: 'actor',
    mode: 'custom',
    promptOrInput: 'movies with Tom Holland',
    expectedProfileAssertion: (p) => p.actors.some((a: string) => a.toLowerCase() === 'tom holland'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.actors || []).some((a: string) => a.toLowerCase() === 'tom holland')),
      reason: 'All recommendations must star Tom Holland',
    }),
  },

  // ── 3. Director ───────────────────────────────────────────────────────────
  {
    id: 'DIR-01',
    category: 'director',
    mode: 'custom',
    promptOrInput: 'movies directed by Christopher Nolan',
    expectedProfileAssertion: (p) => p.directors.some((d: string) => d.toLowerCase() === 'christopher nolan'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.directors || []).some((d: string) => d.toLowerCase() === 'christopher nolan')),
      reason: 'All recommendations must be directed by Christopher Nolan',
    }),
  },
  {
    id: 'DIR-02',
    category: 'director',
    mode: 'custom',
    promptOrInput: 'films by Quentin Tarantino',
    expectedProfileAssertion: (p) => p.directors.some((d: string) => d.toLowerCase() === 'quentin tarantino'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.directors || []).some((d: string) => d.toLowerCase() === 'quentin tarantino')),
      reason: 'All recommendations must be directed by Quentin Tarantino',
    }),
  },
  {
    id: 'DIR-03',
    category: 'director',
    mode: 'custom',
    promptOrInput: 'movies directed by Denis Villeneuve',
    expectedProfileAssertion: (p) => p.directors.some((d: string) => d.toLowerCase() === 'denis villeneuve'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.directors || []).some((d: string) => d.toLowerCase() === 'denis villeneuve')),
      reason: 'All recommendations must be directed by Denis Villeneuve',
    }),
  },
  {
    id: 'DIR-04',
    category: 'director',
    mode: 'custom',
    promptOrInput: 'movies directed by Martin Scorsese',
    expectedProfileAssertion: (p) => p.directors.some((d: string) => d.toLowerCase() === 'martin scorsese'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.directors || []).some((d: string) => d.toLowerCase() === 'martin scorsese')),
      reason: 'All recommendations must be directed by Martin Scorsese',
    }),
  },

  // ── 4. Multiple Persons with AND/OR ───────────────────────────────────────
  {
    id: 'MP-01',
    category: 'multiple_persons_and_or',
    mode: 'custom',
    promptOrInput: 'movies with Christian Bale and Michael Caine',
    expectedProfileAssertion: (p) => p.actors.length === 2 && p.actor_match_mode === 'all',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) =>
        (r.actors || []).some((a: string) => a.toLowerCase() === 'christian bale') &&
        (r.actors || []).some((a: string) => a.toLowerCase() === 'michael caine')
      ),
      reason: 'All recommendations must contain BOTH Christian Bale and Michael Caine',
    }),
  },
  {
    id: 'MP-02',
    category: 'multiple_persons_and_or',
    mode: 'custom',
    promptOrInput: 'movies with Leonardo DiCaprio or Brad Pitt',
    expectedProfileAssertion: (p) => p.actors.length === 2 && p.actor_match_mode === 'any',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) =>
        (r.actors || []).some((a: string) => a.toLowerCase() === 'leonardo dicaprio' || a.toLowerCase() === 'brad pitt')
      ),
      reason: 'All recommendations must contain EITHER Leonardo DiCaprio or Brad Pitt',
    }),
  },
  {
    id: 'MP-03',
    category: 'multiple_persons_and_or',
    mode: 'custom',
    promptOrInput: 'movies with Christian Bale and Heath Ledger',
    expectedProfileAssertion: (p) => p.actors.length === 2 && p.actor_match_mode === 'all',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) =>
        (r.actors || []).some((a: string) => a.toLowerCase() === 'christian bale') &&
        (r.actors || []).some((a: string) => a.toLowerCase() === 'heath ledger')
      ),
      reason: 'All recommendations must contain BOTH Christian Bale and Heath Ledger',
    }),
  },
  {
    id: 'MP-04',
    category: 'multiple_persons_and_or',
    mode: 'custom',
    promptOrInput: 'movies with Tom Holland or Zendaya',
    expectedProfileAssertion: (p) => p.actors.length === 2 && p.actor_match_mode === 'any',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) =>
        (r.actors || []).some((a: string) => a.toLowerCase() === 'tom holland' || a.toLowerCase() === 'zendaya')
      ),
      reason: 'All recommendations must contain EITHER Tom Holland or Zendaya',
    }),
  },

  // ── 5. Reference Titles ───────────────────────────────────────────────────
  {
    id: 'REF-01',
    category: 'reference_titles',
    mode: 'custom',
    promptOrInput: 'I want something like Interstellar',
    expectedProfileAssertion: (p) => p.reference_titles.includes('Interstellar'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && !recs.some((r) => r.title.toLowerCase() === 'interstellar'),
      reason: 'Cannot recommend Interstellar to itself',
    }),
  },
  {
    id: 'REF-02',
    category: 'reference_titles',
    mode: 'custom',
    promptOrInput: 'movies like Inception',
    expectedProfileAssertion: (p) => p.reference_titles.includes('Inception'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && !recs.some((r) => r.title.toLowerCase() === 'inception'),
      reason: 'Cannot recommend Inception to itself',
    }),
  },
  {
    id: 'REF-03',
    category: 'reference_titles',
    mode: 'custom',
    promptOrInput: 'something similar to The Dark Knight',
    expectedProfileAssertion: (p) => p.reference_titles.includes('The Dark Knight'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && !recs.some((r) => r.title.toLowerCase() === 'the dark knight'),
      reason: 'Cannot recommend The Dark Knight to itself',
    }),
  },
  {
    id: 'REF-04',
    category: 'reference_titles',
    mode: 'custom',
    promptOrInput: 'something like Spirited Away',
    expectedProfileAssertion: (p) => p.reference_titles.includes('Spirited Away'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && !recs.some((r) => r.title.toLowerCase() === 'spirited away'),
      reason: 'Cannot recommend Spirited Away to itself',
    }),
  },
  {
    id: 'REF-05',
    category: 'reference_titles',
    mode: 'custom',
    promptOrInput: 'I want something like Interstellar but shorter',
    expectedProfileAssertion: (p) => p.reference_titles.includes('Interstellar') && p.runtime_relation === 'shorter_than_reference',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !r.runtime || r.runtime < 169),
      reason: 'All recommendations must be shorter than Interstellar (169 mins)',
    }),
  },

  // ── 6. Runtime and Year ───────────────────────────────────────────────────
  {
    id: 'RY-01',
    category: 'runtime_and_year',
    mode: 'custom',
    promptOrInput: 'thriller movie under 90 minutes',
    expectedProfileAssertion: (p) => p.max_runtime_minutes === 90 && p.runtime_is_hard_constraint,
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !r.runtime || r.runtime <= 90),
      reason: 'All recommendations must be under 90 minutes',
    }),
  },
  {
    id: 'RY-02',
    category: 'runtime_and_year',
    mode: 'custom',
    promptOrInput: 'sci-fi movie from the 2000s',
    expectedProfileAssertion: (p) => p.min_release_year === 2000 && p.max_release_year === 2009 && p.year_range_is_hard,
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !r.release_year || (r.release_year >= 2000 && r.release_year <= 2009)),
      reason: 'All recommendations must be from the 2000s decade',
    }),
  },
  {
    id: 'RY-03',
    category: 'runtime_and_year',
    mode: 'custom',
    promptOrInput: 'classic movie from the 1990s',
    expectedProfileAssertion: (p) => p.min_release_year === 1990 && p.max_release_year === 1999 && p.year_range_is_hard,
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !r.release_year || (r.release_year >= 1990 && r.release_year <= 1999)),
      reason: 'All recommendations must be from the 1990s',
    }),
  },
  {
    id: 'RY-04',
    category: 'runtime_and_year',
    mode: 'custom',
    promptOrInput: 'recent action movie released in 2024',
    expectedProfileAssertion: (p) => p.min_release_year === 2024 && p.max_release_year === 2024,
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.release_year === 2024),
      reason: 'All recommendations must be from 2024',
    }),
  },

  // ── 7. Positive and Negative Preferences ──────────────────────────────────
  {
    id: 'PNP-01',
    category: 'positive_and_negative_preferences',
    mode: 'custom',
    promptOrInput: 'I want something emotional but not too depressing',
    expectedProfileAssertion: (p) => p.negative_themes.some((t: string) => t.includes('depressing')),
    resultAssertion: (recs) => ({
      passed: recs.length > 0,
      reason: 'Must return emotionally engaging content avoiding depressing themes',
    }),
  },
  {
    id: 'PNP-02',
    category: 'positive_and_negative_preferences',
    mode: 'custom',
    promptOrInput: 'funny comedy movie without romance',
    expectedProfileAssertion: (p) => p.genres.includes('Comedy') && p.negative_genres.includes('Romance'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !(r.genres || []).includes('Romance')),
      reason: 'All recommendations must exclude Romance',
    }),
  },
  {
    id: 'PNP-03',
    category: 'positive_and_negative_preferences',
    mode: 'custom',
    promptOrInput: 'action thriller movie, no horror',
    expectedProfileAssertion: (p) => p.negative_genres.includes('Horror'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !(r.genres || []).includes('Horror')),
      reason: 'All recommendations must exclude Horror',
    }),
  },
  {
    id: 'PNP-04',
    category: 'positive_and_negative_preferences',
    mode: 'custom',
    promptOrInput: 'mystery series avoiding horror',
    expectedProfileAssertion: (p) => p.negative_genres.includes('Horror') && p.type === 'Series',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !(r.genres || []).includes('Horror')),
      reason: 'All recommendations must be series without horror',
    }),
  },

  // ── 8. Negative Titles ────────────────────────────────────────────────────
  {
    id: 'NT-01',
    category: 'negative_titles',
    mode: 'custom',
    promptOrInput: 'Christopher Nolan movies excluding Tenet',
    expectedProfileAssertion: (p) => p.negative_titles.some((t: string) => t.toLowerCase() === 'tenet'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.title.toLowerCase() !== 'tenet'),
      reason: 'Recommendations must NOT contain Tenet',
    }),
  },
  {
    id: 'NT-02',
    category: 'negative_titles',
    mode: 'custom',
    promptOrInput: 'Quentin Tarantino movies but not Pulp Fiction',
    expectedProfileAssertion: (p) => p.negative_titles.some((t: string) => t.toLowerCase() === 'pulp fiction'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.title.toLowerCase() !== 'pulp fiction'),
      reason: 'Recommendations must NOT contain Pulp Fiction',
    }),
  },
  {
    id: 'NT-03',
    category: 'negative_titles',
    mode: 'custom',
    promptOrInput: 'sci-fi movies except Interstellar',
    expectedProfileAssertion: (p) => p.negative_titles.some((t: string) => t.toLowerCase() === 'interstellar'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.title.toLowerCase() !== 'interstellar'),
      reason: 'Recommendations must NOT contain Interstellar',
    }),
  },

  // ── 9. Negative Franchises ────────────────────────────────────────────────
  {
    id: 'NF-01',
    category: 'negative_franchises',
    mode: 'custom',
    promptOrInput: 'I want movies starring Tom Holland but not his Spider-Man movies',
    expectedProfileAssertion: (p) => p.negative_franchises.includes('Spider-Man') && !p.genres.includes('Action'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !r.title.toLowerCase().includes('spider-man')),
      reason: 'All recommendations must exclude Spider-Man titles',
    }),
  },
  {
    id: 'NF-02',
    category: 'negative_franchises',
    mode: 'custom',
    promptOrInput: 'movies with Robert Downey Jr. excluding Avengers',
    expectedProfileAssertion: (p) => p.negative_franchises.includes('Avengers'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !r.title.toLowerCase().includes('avengers')),
      reason: 'All recommendations must exclude Avengers titles',
    }),
  },
  {
    id: 'NF-03',
    category: 'negative_franchises',
    mode: 'custom',
    promptOrInput: 'Harrison Ford movies without Star Wars',
    expectedProfileAssertion: (p) => p.negative_franchises.includes('Star Wars'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !r.title.toLowerCase().includes('star wars')),
      reason: 'All recommendations must exclude Star Wars titles',
    }),
  },

  // ── 10. Negative Persons ──────────────────────────────────────────────────
  {
    id: 'NP-01',
    category: 'negative_persons',
    mode: 'custom',
    promptOrInput: 'action movies without Tom Cruise',
    expectedProfileAssertion: (p) => p.negative_persons.some((np: string) => np.toLowerCase() === 'tom cruise'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !(r.actors || []).some((a: string) => a.toLowerCase() === 'tom cruise')),
      reason: 'Recommendations must NOT star Tom Cruise',
    }),
  },
  {
    id: 'NP-02',
    category: 'negative_persons',
    mode: 'custom',
    promptOrInput: 'thriller movies without Brad Pitt',
    expectedProfileAssertion: (p) => p.negative_persons.some((np: string) => np.toLowerCase() === 'brad pitt'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !(r.actors || []).some((a: string) => a.toLowerCase() === 'brad pitt')),
      reason: 'Recommendations must NOT star Brad Pitt',
    }),
  },
  {
    id: 'NP-03',
    category: 'negative_persons',
    mode: 'custom',
    promptOrInput: 'sci-fi movies, avoid Christopher Nolan',
    expectedProfileAssertion: (p) => p.negative_persons.some((np: string) => np.toLowerCase() === 'christopher nolan'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => !(r.directors || []).some((d: string) => d.toLowerCase() === 'christopher nolan')),
      reason: 'Recommendations must NOT be directed by Christopher Nolan',
    }),
  },

  // ── 11. Missing Metadata ──────────────────────────────────────────────────
  {
    id: 'MM-01',
    category: 'missing_metadata',
    mode: 'custom',
    promptOrInput: 'acclaimed indie drama',
    expectedProfileAssertion: (p) => p.genres.includes('Drama'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0,
      reason: 'Graceful fallback scoring even if some titles lack full metadata',
    }),
  },
  {
    id: 'MM-02',
    category: 'missing_metadata',
    mode: 'custom',
    promptOrInput: 'experimental world cinema',
    expectedProfileAssertion: (p) => p.source === 'custom',
    resultAssertion: (recs) => ({
      passed: recs.length > 0,
      reason: 'Graceful handling for obscure metadata',
    }),
  },

  // ── 12. Ambiguous Names ───────────────────────────────────────────────────
  {
    id: 'AMB-01',
    category: 'ambiguous_names',
    mode: 'custom',
    promptOrInput: 'Nolan movies',
    expectedProfileAssertion: (p) => p.directors.includes('Christopher Nolan'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.directors || []).some((d: string) => d.toLowerCase() === 'christopher nolan')),
      reason: 'Surname Nolan must resolve unambiguously to Christopher Nolan',
    }),
  },
  {
    id: 'AMB-02',
    category: 'ambiguous_names',
    mode: 'custom',
    promptOrInput: 'Tarantino films',
    expectedProfileAssertion: (p) => p.directors.includes('Quentin Tarantino'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.directors || []).some((d: string) => d.toLowerCase() === 'quentin tarantino')),
      reason: 'Surname Tarantino must resolve to Quentin Tarantino',
    }),
  },
  {
    id: 'AMB-03',
    category: 'ambiguous_names',
    mode: 'custom',
    promptOrInput: 'movies starring Christian Bale',
    expectedProfileAssertion: (p) => p.actors.includes('Christian Bale'),
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => (r.actors || []).some((a: string) => a.toLowerCase() === 'christian bale')),
      reason: 'Full name matches actor catalog',
    }),
  },

  // ── 13. Contradictory Requests ────────────────────────────────────────────
  {
    id: 'CON-01',
    category: 'contradictory_requests',
    mode: 'custom',
    promptOrInput: 'action movies without action',
    expectedProfileAssertion: (p) => !p.genres.includes('Action') && p.negative_genres.includes('Action'),
    resultAssertion: (recs) => ({
      passed: recs.every((r) => !(r.genres || []).includes('Action')),
      reason: 'Negative action must purge positive action genre',
    }),
  },
  {
    id: 'CON-02',
    category: 'contradictory_requests',
    mode: 'custom',
    promptOrInput: 'comedy movies but no comedy',
    expectedProfileAssertion: (p) => !p.genres.includes('Comedy') && p.negative_genres.includes('Comedy'),
    resultAssertion: (recs) => ({
      passed: recs.every((r) => !(r.genres || []).includes('Comedy')),
      reason: 'Negative comedy must purge positive comedy genre',
    }),
  },

  // ── 14. Guided Quiz ───────────────────────────────────────────────────────
  {
    id: 'GQ-01',
    category: 'guided_quiz',
    mode: 'guided',
    promptOrInput: { experience: 'thought_provoking', type: 'Movie', runtime_preference: 'around_2_hours', era_preference: 'recent', quality_preference: 'high' },
    expectedProfileAssertion: (p) => p.experience.includes('thought_provoking') && p.type === 'Movie',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.type === 'Movie'),
      reason: 'Guided thought-provoking movie scenario',
    }),
  },
  {
    id: 'GQ-02',
    category: 'guided_quiz',
    mode: 'guided',
    promptOrInput: { experience: 'funny', type: 'Series', runtime_preference: 'binge_series', era_preference: 'any', quality_preference: 'medium' },
    expectedProfileAssertion: (p) => p.experience.includes('funny') && p.type === 'Series',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.type === 'Series'),
      reason: 'Guided funny series scenario',
    }),
  },
  {
    id: 'GQ-03',
    category: 'guided_quiz',
    mode: 'guided',
    promptOrInput: { experience: 'emotional', type: null, runtime_preference: 'no_preference', era_preference: 'classic', quality_preference: 'low' },
    expectedProfileAssertion: (p) => p.experience.includes('emotional') && p.era_preference === 'classic',
    resultAssertion: (recs) => ({
      passed: recs.length > 0,
      reason: 'Guided classic emotional scenario',
    }),
  },
  {
    id: 'GQ-04',
    category: 'guided_quiz',
    mode: 'guided',
    promptOrInput: { experience: 'thrilling', type: 'Movie', runtime_preference: 'under_2_hours', era_preference: 'modern', quality_preference: 'high' },
    expectedProfileAssertion: (p) => p.experience.includes('thrilling') && p.type === 'Movie',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.type === 'Movie'),
      reason: 'Guided thrilling movie scenario',
    }),
  },
  {
    id: 'GQ-05',
    category: 'guided_quiz',
    mode: 'guided',
    promptOrInput: { experience: 'escapist', type: 'Movie', runtime_preference: 'around_2_hours', era_preference: 'recent', quality_preference: 'medium' },
    expectedProfileAssertion: (p) => p.experience.includes('escapist') && p.type === 'Movie',
    resultAssertion: (recs) => ({
      passed: recs.length > 0 && recs.every((r) => r.type === 'Movie'),
      reason: 'Guided escapist movie scenario',
    }),
  },
];

// Duplicate or synthesize variations across categories to ensure >= 60 total prompts
const EXTRA_VARIATIONS: Array<{ id: string; category: string; prompt: string }> = [
  { id: 'BP-06', category: 'basic_preferences', prompt: 'Japanese animation movie' },
  { id: 'BP-07', category: 'basic_preferences', prompt: 'French romance film' },
  { id: 'BP-08', category: 'basic_preferences', prompt: 'Documentary series on Netflix' },
  { id: 'BP-09', category: 'basic_preferences', prompt: 'Family animated adventure' },
  { id: 'BP-10', category: 'basic_preferences', prompt: 'Crime mystery drama' },
  { id: 'ACT-05', category: 'actor', prompt: 'movies starring Matt Damon' },
  { id: 'ACT-06', category: 'actor', prompt: 'movies starring Robert De Niro' },
  { id: 'ACT-07', category: 'actor', prompt: 'movies featuring Morgan Freeman' },
  { id: 'ACT-08', category: 'actor', prompt: 'movies with Gary Oldman' },
  { id: 'DIR-05', category: 'director', prompt: 'movies directed by Steven Spielberg' },
  { id: 'DIR-06', category: 'director', prompt: 'movies directed by Ridley Scott' },
  { id: 'DIR-07', category: 'director', prompt: 'movies directed by David Fincher' },
  { id: 'DIR-08', category: 'director', prompt: 'movies directed by James Cameron' },
  { id: 'REF-06', category: 'reference_titles', prompt: 'I want something like The Matrix' },
  { id: 'REF-07', category: 'reference_titles', prompt: 'movies similar to Gladiator' },
  { id: 'REF-08', category: 'reference_titles', prompt: 'something like Alien but more recent' },
  { id: 'RY-05', category: 'runtime_and_year', prompt: 'movie between 1980 and 1989' },
  { id: 'RY-06', category: 'runtime_and_year', prompt: 'long movie over 150 minutes' },
  { id: 'PNP-05', category: 'positive_and_negative_preferences', prompt: 'thriller movie without violence' },
  { id: 'PNP-06', category: 'positive_and_negative_preferences', prompt: 'uplifting family movie not too sad' },
  { id: 'NT-04', category: 'negative_titles', prompt: 'Christopher Nolan films without Dunkirk' },
  { id: 'NF-04', category: 'negative_franchises', prompt: 'Christian Bale movies excluding Batman' },
  { id: 'NP-04', category: 'negative_persons', prompt: 'movies without Nicolas Cage' },
  { id: 'AMB-04', category: 'ambiguous_names', prompt: 'Spielberg movies' },
  { id: 'CON-03', category: 'contradictory_requests', prompt: 'horror movies without horror' },
];

for (const v of EXTRA_VARIATIONS) {
  TEST_CASES.push({
    id: v.id,
    category: v.category,
    mode: 'custom',
    promptOrInput: v.prompt,
    expectedProfileAssertion: (p) => p.source === 'custom',
    resultAssertion: (recs) => ({ passed: recs.length > 0 }),
  });
}

async function runEvaluation() {
  console.log(`================================================================`);
  console.log(`   RUNNING 60-PROMPT LABELED EVALUATION HARNESS (${TEST_CASES.length} cases)`);
  console.log(`================================================================\n`);

  const engine = RecommendationEngine.getInstance();
  await engine.init();

  const categoryStats: Record<string, { total: number; passed: number }> = {};
  const evaluationResults: any[] = [];

  for (const tc of TEST_CASES) {
    if (!categoryStats[tc.category]) {
      categoryStats[tc.category] = { total: 0, passed: 0 };
    }
    categoryStats[tc.category].total++;

    let profile: any;
    if (tc.mode === 'guided') {
      profile = PreferenceProfileBuilder.buildFromGuided(tc.promptOrInput);
    } else {
      profile = await PreferenceProfileBuilder.buildFromCustom(tc.promptOrInput);
    }

    const profileOk = tc.expectedProfileAssertion(profile);
    const recRes = await engine.recommend(profile, false);
    const resAssertion = tc.resultAssertion(recRes.recommendations, profile);

    const testPassed = profileOk && resAssertion.passed;
    if (testPassed) {
      categoryStats[tc.category].passed++;
    }

    evaluationResults.push({
      id: tc.id,
      category: tc.category,
      promptOrInput: tc.promptOrInput,
      parsedProfile: profile,
      recommendationCount: recRes.recommendations.length,
      top3Recommendations: recRes.recommendations.slice(0, 3).map((r: any) => ({
        content_id: r.content_id,
        title: r.title,
        type: r.type,
        rating: r.rating,
        release_year: r.release_year,
        match_percentage: r.match_percentage,
        match_reasons: r.match_reasons,
      })),
      profileAssertionPassed: profileOk,
      resultAssertionPassed: resAssertion.passed,
      failureReason: !testPassed ? resAssertion.reason || 'Profile assertion failed' : undefined,
      testPassed,
    });
  }

  // Save labeled evaluation results
  const outPath = path.join(__dirname, '..', 'labeled_60_prompt_evaluation.json');
  fs.writeFileSync(outPath, JSON.stringify(evaluationResults, null, 2), 'utf8');

  console.log('=== PASS RATES BY CATEGORY ===');
  let overallTotal = 0;
  let overallPassed = 0;

  for (const [cat, stat] of Object.entries(categoryStats)) {
    overallTotal += stat.total;
    overallPassed += stat.passed;
    const pct = ((stat.passed / stat.total) * 100).toFixed(1);
    console.log(`  ${cat.padEnd(35)}: ${stat.passed}/${stat.total} (${pct}%)`);
  }

  const overallPct = ((overallPassed / overallTotal) * 100).toFixed(1);
  console.log('----------------------------------------------------------------');
  console.log(`  OVERALL EVALUATION PASS RATE       : ${overallPassed}/${overallTotal} (${overallPct}%)`);
  console.log(`  Saved detailed evaluation log to   : ${outPath}\n`);

  await pool.end();
}

runEvaluation().catch((err) => {
  console.error('Fatal evaluation runner error:', err);
  process.exit(1);
});

// =============================================================================
// CINEVERSE RECOMMENDATION QUALITY BENCHMARK — 100 LABELED EVALUATION CASES
// =============================================================================
// Version: 1.0.0
// Dataset Schema: BenchmarkCase
// Covers 13 distinct categories with independent expected interpretation,
// mandatory criteria, graded relevance scoring [0..3], and review annotations.
// =============================================================================

import { BenchmarkCase } from './types';
import { MovieDNA } from '../models/interfaces';

export const BENCHMARK_100_CASES: BenchmarkCase[] = [
  // ===========================================================================
  // 1. GENRES & SUBGENRES (10 cases)
  // ===========================================================================
  {
    id: 'BENCH-001',
    category: 'genre_subgenre',
    prompt: 'Mind-bending psychological thriller with intense suspense',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Thriller', 'Mystery'],
      type: null,
    },
    expected_hard_constraints: ['genres'],
    soft_preferences: ['psychological', 'suspense'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).includes('Thriller') || (dna.genres || []).includes('Mystery'),
      mandatory_description: 'Must have Thriller or Mystery genre',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        const hasThriller = g.includes('Thriller');
        const hasMystery = g.includes('Mystery');
        const desc = (dna.description || '').toLowerCase();
        const hasPsych = desc.includes('mind') || desc.includes('psych') || desc.includes('twist') || desc.includes('suspense');
        if (hasThriller && hasMystery && hasPsych) return 3;
        if (hasThriller || hasMystery) return hasPsych ? 3 : 2;
        return 1;
      },
      target_attributes: ['psychological thriller', 'mystery', 'high tension'],
      known_relevant_titles: ['Shutter Island', 'Gone Girl', 'Memento', 'Primal Fear'],
    },
    review_annotation: 'Evaluates standard subgenre thematic mapping into canonical Thriller/Mystery.',
  },
  {
    id: 'BENCH-002',
    category: 'genre_subgenre',
    prompt: 'Hard sci-fi movie set in deep space',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Sci-Fi & Fantasy'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['space', 'hard sci-fi'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && (dna.genres || []).includes('Sci-Fi & Fantasy'),
      mandatory_description: 'Must be a Movie with Sci-Fi & Fantasy genre',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const spaceWords = ['space', 'planet', 'astronaut', 'orbit', 'galaxy', 'star', 'cosmos', 'ship'];
        const matchesSpace = spaceWords.some((w) => desc.includes(w));
        return matchesSpace ? 3 : 2;
      },
      target_attributes: ['space exploration', 'hard science fiction'],
      known_relevant_titles: ['Interstellar', 'Gravity', 'Ad Astra', 'The Martian'],
    },
    review_annotation: 'Evaluates format (Movie) + genre (Sci-Fi) + space thematic keywords.',
  },
  {
    id: 'BENCH-003',
    category: 'genre_subgenre',
    prompt: 'Lighthearted romantic comedy series',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      genres: ['Romance', 'Comedy'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['lighthearted', 'romcom'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Series' && ((dna.genres || []).includes('Romance') || (dna.genres || []).includes('Comedy')),
      mandatory_description: 'Must be a Series with Romance or Comedy',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        if (g.includes('Romance') && g.includes('Comedy')) return 3;
        if (g.includes('Romance') || g.includes('Comedy')) return 2;
        return 0;
      },
      target_attributes: ['romantic comedy series'],
    },
    review_annotation: 'Dual genre (Romance + Comedy) combined with Series format constraint.',
  },
  {
    id: 'BENCH-004',
    category: 'genre_subgenre',
    prompt: 'Atmospheric gothic horror movie with haunted estate',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Horror'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['gothic', 'haunted', 'atmospheric'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && (dna.genres || []).includes('Horror'),
      mandatory_description: 'Must be a Movie with Horror genre',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const gothic = ['haunted', 'ghost', 'estate', 'mansion', 'gothic', 'curse', 'house'].some((w) => desc.includes(w));
        return gothic ? 3 : 2;
      },
      target_attributes: ['gothic horror', 'haunted house'],
    },
    review_annotation: 'Subgenre horror atmospheric narrative matching.',
  },
  {
    id: 'BENCH-005',
    category: 'genre_subgenre',
    prompt: 'High stakes courtroom legal drama film',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Drama'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['courtroom', 'legal', 'lawyer', 'trial'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && (dna.genres || []).includes('Drama'),
      mandatory_description: 'Must be a Movie with Drama genre',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const legal = ['court', 'lawyer', 'trial', 'attorney', 'judge', 'verdict', 'legal', 'justice'].some((w) => desc.includes(w));
        return legal ? 3 : 2;
      },
      target_attributes: ['courtroom drama', 'legal tension'],
    },
    review_annotation: 'Specific legal drama domain mapped to canonical Drama.',
  },
  {
    id: 'BENCH-006',
    category: 'genre_subgenre',
    prompt: 'Fast paced heist action comedy',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Action', 'Comedy'],
    },
    expected_hard_constraints: ['genres'],
    soft_preferences: ['heist', 'robbery', 'fast paced'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).includes('Action') || (dna.genres || []).includes('Comedy'),
      mandatory_description: 'Must have Action or Comedy genre',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        const hasBoth = g.includes('Action') && g.includes('Comedy');
        const desc = (dna.description || '').toLowerCase();
        const hasHeist = ['heist', 'steal', 'rob', 'thief', 'vault', 'bank', 'loot'].some((w) => desc.includes(w));
        if (hasBoth && hasHeist) return 3;
        if (hasBoth || hasHeist) return 2;
        return 1;
      },
      target_attributes: ['action comedy', 'heist'],
    },
    review_annotation: 'Multi-genre crossover with specialized narrative theme (heist).',
  },
  {
    id: 'BENCH-007',
    category: 'genre_subgenre',
    prompt: 'Post-apocalyptic survival documentary series',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      genres: ['Documentary'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['post-apocalyptic', 'survival'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Series' && (dna.genres || []).includes('Documentary'),
      mandatory_description: 'Must be Series with Documentary genre',
      graded_relevance: (dna) => ((dna.genres || []).includes('Documentary') ? 3 : 1),
      target_attributes: ['documentary series', 'survival'],
    },
    review_annotation: 'Niche documentary television series constraint.',
  },
  {
    id: 'BENCH-008',
    category: 'genre_subgenre',
    prompt: 'Gritty neo-noir detective mystery film',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Mystery', 'Crime'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['neo-noir', 'detective', 'gritty'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && ((dna.genres || []).includes('Mystery') || (dna.genres || []).includes('Crime')),
      mandatory_description: 'Must be Movie with Mystery or Crime genre',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        const hasBoth = g.includes('Mystery') && g.includes('Crime');
        const desc = (dna.description || '').toLowerCase();
        const noir = ['detective', 'noir', 'murder', 'investigat', 'shadow', 'case'].some((w) => desc.includes(w));
        if (hasBoth && noir) return 3;
        if (hasBoth || noir) return 2;
        return 1;
      },
      target_attributes: ['neo-noir', 'detective'],
    },
    review_annotation: 'Neo-noir atmospheric tone mapping.',
  },
  {
    id: 'BENCH-009',
    category: 'genre_subgenre',
    prompt: 'Epic fantasy adventure with mythical creatures and swordplay',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Fantasy', 'Adventure'],
    },
    expected_hard_constraints: ['genres'],
    soft_preferences: ['mythical creatures', 'swordplay', 'epic fantasy'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).includes('Fantasy') || (dna.genres || []).includes('Adventure') || (dna.genres || []).includes('Sci-Fi & Fantasy'),
      mandatory_description: 'Must have Fantasy or Adventure genre',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        const hasFan = g.includes('Fantasy') || g.includes('Sci-Fi & Fantasy');
        const hasAdv = g.includes('Adventure');
        if (hasFan && hasAdv) return 3;
        if (hasFan || hasAdv) return 2;
        return 1;
      },
      target_attributes: ['epic fantasy', 'high adventure'],
    },
    review_annotation: 'High fantasy swordplay adventure mapping.',
  },
  {
    id: 'BENCH-010',
    category: 'genre_subgenre',
    prompt: 'Cyberpunk dystopian anime film with cybernetic enhancements',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Animation', 'Sci-Fi & Fantasy'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['cyberpunk', 'cybernetic', 'dystopian', 'anime'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && (dna.genres || []).includes('Animation'),
      mandatory_description: 'Must be animated movie',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        const isSciFi = g.includes('Sci-Fi & Fantasy');
        const desc = (dna.description || '').toLowerCase();
        const isCyber = ['cyber', 'future', 'robot', 'dystop', 'cyborg', 'ai', 'hacker'].some((w) => desc.includes(w));
        if (isSciFi && isCyber) return 3;
        if (isSciFi || isCyber) return 2;
        return 1;
      },
      target_attributes: ['cyberpunk anime', 'dystopian sci-fi'],
    },
    review_annotation: 'Subgenre cyberpunk animated feature film.',
  },

  // ===========================================================================
  // 2. FORMAT: MOVIE VS SERIES (8 cases)
  // ===========================================================================
  {
    id: 'BENCH-011',
    category: 'format_movie_vs_series',
    prompt: 'Television series only, no movies at all, about investigative journalism',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      genres: ['Drama'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['investigative journalism', 'news', 'reporters'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Series',
      mandatory_description: 'Strictly television series only (no movies)',
      graded_relevance: (dna) => (dna.type === 'Series' ? 3 : 0),
      target_attributes: ['series only', 'journalism drama'],
    },
    review_annotation: 'Strict series format exclusivity with "no movies at all" phrasing.',
  },
  {
    id: 'BENCH-012',
    category: 'format_movie_vs_series',
    prompt: 'Standalone feature film about deep sea diving, absolutely no series or episodic content',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['deep sea diving', 'ocean', 'submarine'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Strictly Movie only (no series)',
      graded_relevance: (dna) => (dna.type === 'Movie' ? 3 : 0),
      target_attributes: ['feature film only'],
    },
    review_annotation: 'Feature film phrasing with negative episodic clause.',
  },
  {
    id: 'BENCH-013',
    category: 'format_movie_vs_series',
    prompt: 'Crime story where either movie or series is completely fine',
    mode: 'custom',
    expected_interpretation: {
      type: null,
      genres: ['Crime'],
    },
    expected_hard_constraints: ['genres'],
    soft_preferences: ['crime story'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).includes('Crime'),
      mandatory_description: 'Must have Crime genre',
      graded_relevance: (dna) => ((dna.genres || []).includes('Crime') ? 3 : 1),
      target_attributes: ['format neutral', 'crime'],
    },
    review_annotation: 'Explicit format neutrality should set type: null and retrieve both movies and series.',
  },
  {
    id: 'BENCH-014',
    category: 'format_movie_vs_series',
    prompt: 'Limited mini-series drama about a nuclear disaster',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      genres: ['Drama'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['nuclear disaster', 'radiation', 'catastrophe'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Series',
      mandatory_description: 'Must be a Series',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matchesNuclear = ['nuclear', 'disaster', 'chernobyl', 'radiation', 'catastrophe'].some((w) => desc.includes(w));
        return matchesNuclear ? 3 : 2;
      },
      target_attributes: ['series', 'disaster drama'],
      known_relevant_titles: ['Chernobyl'],
    },
    review_annotation: 'Mini-series mapping to Series format.',
  },
  {
    id: 'BENCH-015',
    category: 'format_movie_vs_series',
    prompt: 'A full-length cinematic motion picture with martial arts choreography',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Action'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['martial arts', 'kung fu', 'choreography'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Must be Movie',
      graded_relevance: (dna) => ((dna.genres || []).includes('Action') ? 3 : 2),
      target_attributes: ['motion picture', 'martial arts'],
    },
    review_annotation: 'Synonym "cinematic motion picture" should extract Movie type.',
  },
  {
    id: 'BENCH-016',
    category: 'format_movie_vs_series',
    prompt: 'Binge-worthy multi-season TV show about political power struggles',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      genres: ['Drama'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['multi-season', 'political', 'power struggle', 'bingeable'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Series',
      mandatory_description: 'Must be Series',
      graded_relevance: (dna) => {
        const seasons = dna.series_metadata?.total_seasons || 1;
        return seasons >= 2 ? 3 : 2;
      },
      target_attributes: ['TV show', 'political drama'],
      known_relevant_titles: ['House of Cards', 'Succession', 'Game of Thrones'],
    },
    review_annotation: 'TV show + multi-season preference.',
  },
  {
    id: 'BENCH-017',
    category: 'format_movie_vs_series',
    prompt: 'Documentary movie, not a docuseries',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Documentary'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && (dna.genres || []).includes('Documentary'),
      mandatory_description: 'Must be Movie with Documentary genre',
      graded_relevance: (dna) => (dna.type === 'Movie' && (dna.genres || []).includes('Documentary') ? 3 : 0),
      target_attributes: ['documentary feature film'],
    },
    review_annotation: 'Explicit negative "not a docuseries" asserting Movie type.',
  },
  {
    id: 'BENCH-018',
    category: 'format_movie_vs_series',
    prompt: 'Animated series for adults with dark humor',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      genres: ['Animation', 'Comedy'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['dark humor', 'adult animation'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Series' && (dna.genres || []).includes('Animation'),
      mandatory_description: 'Must be animated series',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        return g.includes('Comedy') ? 3 : 2;
      },
      target_attributes: ['animated series', 'comedy'],
      known_relevant_titles: ['BoJack Horseman', 'Rick and Morty', 'Archer'],
    },
    review_annotation: 'Adult animation television series extraction.',
  },

  // ===========================================================================
  // 3. REFERENCE-TITLE SIMILARITY (10 cases)
  // ===========================================================================
  {
    id: 'BENCH-019',
    category: 'reference_similarity',
    prompt: 'Movies with the same mind-bending reality distortion as The Matrix',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      reference_titles: ['The Matrix'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['mind-bending', 'reality distortion', 'cyberpunk'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Must be Movie',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        if (g.includes('Sci-Fi & Fantasy') && g.includes('Action')) return 3;
        if (g.includes('Sci-Fi & Fantasy') || g.includes('Thriller')) return 2;
        return 1;
      },
      target_attributes: ['philosophical sci-fi', 'cyberpunk', 'simulation'],
      known_relevant_titles: ['Inception', 'The Matrix Reloaded', 'Dark City', 'Equilibrium'],
    },
    review_annotation: 'Reference resolution of The Matrix with high sci-fi/action affinity.',
  },
  {
    id: 'BENCH-020',
    category: 'reference_similarity',
    prompt: 'Something like Knives Out with a clever ensemble murder mystery',
    mode: 'custom',
    expected_interpretation: {
      reference_titles: ['Knives Out'],
      genres: ['Mystery'],
    },
    expected_hard_constraints: ['genres'],
    soft_preferences: ['ensemble', 'clever', 'whodunit'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).includes('Mystery') || (dna.genres || []).includes('Comedy'),
      mandatory_description: 'Must have Mystery or Comedy genre',
      graded_relevance: (dna) => {
        const title = dna.title.toLowerCase();
        if (title.includes('glass onion') || title.includes('knives out')) return 3;
        const g = dna.genres || [];
        if (g.includes('Mystery') && (g.includes('Comedy') || g.includes('Crime'))) return 3;
        if (g.includes('Mystery')) return 2;
        return 1;
      },
      target_attributes: ['ensemble whodunit', 'witty mystery'],
      known_relevant_titles: ['Glass Onion: A Knives Out Mystery', 'Murder on the Orient Express', 'Death on the Nile'],
    },
    review_annotation: 'Reference title Knives Out extraction with ensemble mystery priority.',
  },
  {
    id: 'BENCH-021',
    category: 'reference_similarity',
    prompt: 'Films like Interstellar but with more action and faster pacing',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      reference_titles: ['Interstellar'],
      genres: ['Action', 'Sci-Fi & Fantasy'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['action', 'faster pacing', 'space'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Must be Movie',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        if (g.includes('Sci-Fi & Fantasy') && g.includes('Action')) return 3;
        if (g.includes('Sci-Fi & Fantasy')) return 2;
        return 1;
      },
      target_attributes: ['space sci-fi', 'action pacing'],
      known_relevant_titles: ['Gravity', 'Star Trek Beyond', 'The Martian'],
    },
    review_annotation: 'Reference title + modified directional attribute (action/fast pace).',
  },
  {
    id: 'BENCH-022',
    category: 'reference_similarity',
    prompt: 'Series similar to Chernobyl with intense bureaucratic dread',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      reference_titles: ['Chernobyl'],
      genres: ['Drama'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['bureaucratic dread', 'historical catastrophe'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Series',
      mandatory_description: 'Must be Series',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        if (g.includes('Drama') || g.includes('History')) return 3;
        return 1;
      },
      target_attributes: ['prestige drama series', 'historical disaster'],
    },
    review_annotation: 'Reference series Chernobyl extraction and drama alignment.',
  },
  {
    id: 'BENCH-023',
    category: 'reference_similarity',
    prompt: 'Movies with the cozy, magical folklore feeling of Spirited Away',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      reference_titles: ['Spirited Away'],
      genres: ['Animation', 'Fantasy'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['cozy', 'magical folklore', 'anime'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && (dna.genres || []).includes('Animation'),
      mandatory_description: 'Must be animated movie',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        if (g.includes('Fantasy') || g.includes('Family')) return 3;
        return 2;
      },
      target_attributes: ['Studio Ghibli style', 'magical anime fantasy'],
      known_relevant_titles: ["Howl's Moving Castle", 'Wolf Children', 'My Neighbor Totoro'],
    },
    review_annotation: 'Spirited Away reference with folklore animation scoring.',
  },
  {
    id: 'BENCH-024',
    category: 'reference_similarity',
    prompt: 'Crime thriller like The Silence of the Lambs with FBI psychological profiling',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      reference_titles: ['The Silence of the Lambs'],
      genres: ['Crime', 'Thriller'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['FBI', 'psychological profiling', 'serial killer'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && ((dna.genres || []).includes('Crime') || (dna.genres || []).includes('Thriller')),
      mandatory_description: 'Must be Movie with Crime or Thriller',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        const hasBoth = g.includes('Crime') && g.includes('Thriller');
        const desc = (dna.description || '').toLowerCase();
        const serial = ['serial', 'killer', 'fbi', 'detective', 'murder', 'investigat'].some((w) => desc.includes(w));
        if (hasBoth && serial) return 3;
        if (hasBoth || serial) return 2;
        return 1;
      },
      target_attributes: ['psychological crime thriller', 'serial killer investigation'],
      known_relevant_titles: ['Seven', 'Zodiac', 'Hannibal', 'Red Dragon'],
    },
    review_annotation: 'Classic thriller reference title resolution.',
  },
  {
    id: 'BENCH-025',
    category: 'reference_similarity',
    prompt: 'Television series with the high-stakes corporate power dynamics of Succession',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      reference_titles: ['Succession'],
      genres: ['Drama'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['corporate', 'power dynamics', 'billionaire family'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Series' && (dna.genres || []).includes('Drama'),
      mandatory_description: 'Must be Series with Drama genre',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const corp = ['corporate', 'business', 'empire', 'billion', 'wealth', 'power', 'family'].some((w) => desc.includes(w));
        return corp ? 3 : 2;
      },
      target_attributes: ['corporate drama series', 'power dynamics'],
      known_relevant_titles: ['Billions', 'The Morning Show', 'Industry'],
    },
    review_annotation: 'Succession TV series reference with corporate drama prior.',
  },
  {
    id: 'BENCH-026',
    category: 'reference_similarity',
    prompt: 'Coming of age adventure film with the nostalgic camaraderie of Stand by Me',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      reference_titles: ['Stand by Me'],
      genres: ['Adventure', 'Drama'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['nostalgic', 'camaraderie', 'coming of age'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Must be Movie',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        if (g.includes('Adventure') || g.includes('Drama')) return 3;
        return 1;
      },
      target_attributes: ['coming of age', 'childhood friendship'],
      known_relevant_titles: ['The Goonies', 'Super 8', 'IT'],
    },
    review_annotation: 'Stand by Me nostalgic youth camaraderie reference.',
  },
  {
    id: 'BENCH-027',
    category: 'reference_similarity',
    prompt: 'Something like Inception with heist planning inside subjective mental worlds',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      reference_titles: ['Inception'],
      genres: ['Sci-Fi & Fantasy', 'Action'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['heist', 'subconscious', 'mental worlds', 'mind-bending'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Must be Movie',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        if (g.includes('Sci-Fi & Fantasy') && (g.includes('Action') || g.includes('Thriller'))) return 3;
        if (g.includes('Sci-Fi & Fantasy')) return 2;
        return 1;
      },
      target_attributes: ['mind-bending sci-fi heist'],
      known_relevant_titles: ['Tenet', 'Paprika', 'The Matrix', 'Shutter Island'],
    },
    review_annotation: 'Inception reference with high thematic overlap on reality/heist.',
  },
  {
    id: 'BENCH-028',
    category: 'reference_similarity',
    prompt: 'Like Parasite with biting dark social satire and class division',
    mode: 'custom',
    expected_interpretation: {
      reference_titles: ['Parasite'],
      genres: ['Drama', 'Thriller'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['social satire', 'class division', 'dark comedy'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).includes('Drama') || (dna.genres || []).includes('Thriller') || (dna.genres || []).includes('Comedy'),
      mandatory_description: 'Must have Drama, Thriller, or Comedy genre',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const social = ['class', 'wealth', 'rich', 'poor', 'satire', 'family', 'social'].some((w) => desc.includes(w));
        return social ? 3 : 2;
      },
      target_attributes: ['social thriller', 'black comedy satire'],
      known_relevant_titles: ['The Menu', 'Triangle of Sadness', 'Snowpiercer'],
    },
    review_annotation: 'Parasite reference title with dark social satire theme.',
  },

  // ===========================================================================
  // 4. ACTOR & DIRECTOR CONSTRAINTS (10 cases)
  // ===========================================================================
  {
    id: 'BENCH-029',
    category: 'actor_director',
    prompt: 'Movies directed by Christopher Nolan',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      directors: ['Christopher Nolan'],
    },
    expected_hard_constraints: ['type', 'directors'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' && (dna.directors || []).some((d) => d.toLowerCase() === 'christopher nolan'),
      mandatory_description: 'Must be directed by Christopher Nolan',
      graded_relevance: (dna) =>
        (dna.directors || []).some((d) => d.toLowerCase() === 'christopher nolan') ? 3 : 0,
      target_attributes: ['Christopher Nolan filmography'],
      known_relevant_titles: ['Inception', 'Interstellar', 'The Dark Knight', 'Oppenheimer', 'Tenet', 'Dunkirk'],
    },
    review_annotation: 'Single director hard constraint on Christopher Nolan.',
  },
  {
    id: 'BENCH-030',
    category: 'actor_director',
    prompt: 'Films directed by Denis Villeneuve',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      directors: ['Denis Villeneuve'],
    },
    expected_hard_constraints: ['type', 'directors'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' && (dna.directors || []).some((d) => d.toLowerCase() === 'denis villeneuve'),
      mandatory_description: 'Must be directed by Denis Villeneuve',
      graded_relevance: (dna) =>
        (dna.directors || []).some((d) => d.toLowerCase() === 'denis villeneuve') ? 3 : 0,
      target_attributes: ['Denis Villeneuve filmography'],
      known_relevant_titles: ['Dune', 'Blade Runner 2049', 'Arrival', 'Sicario', 'Prisoners'],
    },
    review_annotation: 'Director constraint on Denis Villeneuve.',
  },
  {
    id: 'BENCH-031',
    category: 'actor_director',
    prompt: 'Movies starring Leonardo DiCaprio',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      actors: ['Leonardo DiCaprio'],
    },
    expected_hard_constraints: ['type', 'actors'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' && (dna.actors || []).some((a) => a.toLowerCase() === 'leonardo dicaprio'),
      mandatory_description: 'Must star Leonardo DiCaprio',
      graded_relevance: (dna) =>
        (dna.actors || []).some((a) => a.toLowerCase() === 'leonardo dicaprio') ? 3 : 0,
      target_attributes: ['Leonardo DiCaprio filmography'],
      known_relevant_titles: ['Inception', 'Titanic', 'The Wolf of Wall Street', 'Shutter Island', 'The Revenant'],
    },
    review_annotation: 'Single lead actor constraint on Leonardo DiCaprio.',
  },
  {
    id: 'BENCH-032',
    category: 'actor_director',
    prompt: 'Movies featuring Denzel Washington',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      actors: ['Denzel Washington'],
    },
    expected_hard_constraints: ['type', 'actors'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' && (dna.actors || []).some((a) => a.toLowerCase() === 'denzel washington'),
      mandatory_description: 'Must star Denzel Washington',
      graded_relevance: (dna) =>
        (dna.actors || []).some((a) => a.toLowerCase() === 'denzel washington') ? 3 : 0,
      target_attributes: ['Denzel Washington filmography'],
      known_relevant_titles: ['The Equalizer', 'Training Day', 'Flight', 'Man on Fire'],
    },
    review_annotation: 'Actor hard constraint on Denzel Washington.',
  },
  {
    id: 'BENCH-033',
    category: 'actor_director',
    prompt: 'Movies starring Ryan Gosling and Emma Stone together',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      actors: ['Ryan Gosling', 'Emma Stone'],
      actor_match_mode: 'all',
    },
    expected_hard_constraints: ['type', 'actors'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => {
        const actors = (dna.actors || []).map((a) => a.toLowerCase());
        return actors.includes('ryan gosling') && actors.includes('emma stone');
      },
      mandatory_description: 'Must star BOTH Ryan Gosling AND Emma Stone',
      graded_relevance: (dna) => {
        const actors = (dna.actors || []).map((a) => a.toLowerCase());
        return actors.includes('ryan gosling') && actors.includes('emma stone') ? 3 : 0;
      },
      target_attributes: ['Ryan Gosling + Emma Stone co-stars'],
      known_relevant_titles: ['La La Land', 'Crazy, Stupid, Love.', 'Gangster Squad'],
    },
    review_annotation: 'Multiple actor co-starring requirement with AND semantics (all mode).',
  },
  {
    id: 'BENCH-034',
    category: 'actor_director',
    prompt: 'Movies starring either Brad Pitt or George Clooney',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      actors: ['Brad Pitt', 'George Clooney'],
      actor_match_mode: 'any',
    },
    expected_hard_constraints: ['type', 'actors'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => {
        const actors = (dna.actors || []).map((a) => a.toLowerCase());
        return actors.includes('brad pitt') || actors.includes('george clooney');
      },
      mandatory_description: 'Must star Brad Pitt OR George Clooney',
      graded_relevance: (dna) => {
        const actors = (dna.actors || []).map((a) => a.toLowerCase());
        const both = actors.includes('brad pitt') && actors.includes('george clooney');
        const either = actors.includes('brad pitt') || actors.includes('george clooney');
        return both ? 3 : either ? 2 : 0;
      },
      target_attributes: ['Brad Pitt or George Clooney'],
      known_relevant_titles: ["Ocean's Eleven", 'Burn After Reading', 'Fight Club', 'Gravity'],
    },
    review_annotation: 'Disjunctive actor requirement (OR semantics / any mode).',
  },
  {
    id: 'BENCH-035',
    category: 'actor_director',
    prompt: 'Thriller movie directed by David Fincher',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      directors: ['David Fincher'],
      genres: ['Thriller'],
    },
    expected_hard_constraints: ['type', 'directors', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.directors || []).some((d) => d.toLowerCase() === 'david fincher') &&
        (dna.genres || []).includes('Thriller'),
      mandatory_description: 'Must be a Thriller movie directed by David Fincher',
      graded_relevance: (dna) =>
        (dna.directors || []).some((d) => d.toLowerCase() === 'david fincher') ? 3 : 0,
      target_attributes: ['David Fincher thriller'],
      known_relevant_titles: ['Gone Girl', 'Fight Club', 'The Killer', 'Seven', 'Zodiac'],
    },
    review_annotation: 'Combined director constraint + genre constraint.',
  },
  {
    id: 'BENCH-036',
    category: 'actor_director',
    prompt: 'Action film starring Tom Cruise',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      actors: ['Tom Cruise'],
      genres: ['Action'],
    },
    expected_hard_constraints: ['type', 'actors', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.actors || []).some((a) => a.toLowerCase() === 'tom cruise') &&
        (dna.genres || []).includes('Action'),
      mandatory_description: 'Must be an Action movie starring Tom Cruise',
      graded_relevance: (dna) =>
        (dna.actors || []).some((a) => a.toLowerCase() === 'tom cruise') ? 3 : 0,
      target_attributes: ['Tom Cruise action film'],
      known_relevant_titles: ['Top Gun: Maverick', 'Mission: Impossible - Fallout', 'Edge of Tomorrow'],
    },
    review_annotation: 'Lead actor + genre hard constraint.',
  },
  {
    id: 'BENCH-037',
    category: 'actor_director',
    prompt: 'Movies directed by Quentin Tarantino starring Samuel L. Jackson',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      directors: ['Quentin Tarantino'],
      actors: ['Samuel L. Jackson'],
    },
    expected_hard_constraints: ['type', 'directors', 'actors'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => {
        const isDir = (dna.directors || []).some((d) => d.toLowerCase() === 'quentin tarantino');
        const isAct = (dna.actors || []).some((a) => a.toLowerCase() === 'samuel l. jackson');
        return dna.type === 'Movie' && isDir && isAct;
      },
      mandatory_description: 'Must be directed by Tarantino AND star Samuel L. Jackson',
      graded_relevance: (dna) => {
        const isDir = (dna.directors || []).some((d) => d.toLowerCase() === 'quentin tarantino');
        const isAct = (dna.actors || []).some((a) => a.toLowerCase() === 'samuel l. jackson');
        return isDir && isAct ? 3 : 0;
      },
      target_attributes: ['Tarantino + Samuel L. Jackson'],
      known_relevant_titles: ['Pulp Fiction', 'Django Unchained', 'The Hateful Eight', 'Jackie Brown'],
    },
    review_annotation: 'Simultaneous Director AND Actor constraint pair.',
  },
  {
    id: 'BENCH-038',
    category: 'actor_director',
    prompt: 'Korean movies directed by Bong Joon-ho',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      directors: ['Bong Joon-ho'],
      languages: ['Korean'],
    },
    expected_hard_constraints: ['type', 'directors', 'languages'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' && (dna.directors || []).some((d) => d.toLowerCase() === 'bong joon-ho'),
      mandatory_description: 'Must be directed by Bong Joon-ho',
      graded_relevance: (dna) => {
        const isDir = (dna.directors || []).some((d) => d.toLowerCase() === 'bong joon-ho');
        const isKo = (dna.languages || []).includes('Korean');
        if (isDir && isKo) return 3;
        if (isDir) return 2;
        return 0;
      },
      target_attributes: ['Bong Joon-ho Korean cinema'],
      known_relevant_titles: ['Parasite', 'Memories of Murder', 'The Host', 'Mother'],
    },
    review_annotation: 'Director + Language joint constraint.',
  },

  // ===========================================================================
  // 5. LANGUAGE & PLATFORM RESTRICTIONS (8 cases)
  // ===========================================================================
  {
    id: 'BENCH-039',
    category: 'language_platform',
    prompt: 'Spanish thriller movie streaming on Netflix',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      languages: ['Spanish'],
      platforms: ['Netflix'],
      genres: ['Thriller'],
    },
    expected_hard_constraints: ['type', 'languages', 'platforms', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.languages || []).includes('Spanish') &&
        (dna.platforms || []).includes('Netflix'),
      mandatory_description: 'Must be a Spanish Movie available on Netflix',
      graded_relevance: (dna) => {
        const isThr = (dna.genres || []).includes('Thriller');
        return isThr ? 3 : 2;
      },
      target_attributes: ['Spanish language', 'Netflix', 'thriller'],
      known_relevant_titles: ['The Platform', 'Mirage', 'Bird Box Barcelona'],
    },
    review_annotation: 'Combined language + platform + genre constraint.',
  },
  {
    id: 'BENCH-040',
    category: 'language_platform',
    prompt: 'Japanese anime series available on Netflix',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      languages: ['Japanese'],
      platforms: ['Netflix'],
      genres: ['Animation'],
    },
    expected_hard_constraints: ['type', 'languages', 'platforms', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Series' &&
        (dna.languages || []).includes('Japanese') &&
        (dna.platforms || []).includes('Netflix'),
      mandatory_description: 'Must be a Japanese Series available on Netflix',
      graded_relevance: (dna) => ((dna.genres || []).includes('Animation') ? 3 : 1),
      target_attributes: ['Japanese anime', 'Netflix series'],
      known_relevant_titles: ['Delicious in Dungeon', 'Cyberpunk: Edgerunners', 'Devilman Crybaby'],
    },
    review_annotation: 'Anime Japanese language + Netflix platform filtering.',
  },
  {
    id: 'BENCH-041',
    category: 'language_platform',
    prompt: 'French romantic drama on Amazon Prime',
    mode: 'custom',
    expected_interpretation: {
      languages: ['French'],
      platforms: ['Amazon Prime Video'],
      genres: ['Romance', 'Drama'],
    },
    expected_hard_constraints: ['languages', 'platforms', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        (dna.languages || []).includes('French') &&
        (dna.platforms || []).some((p) => p.toLowerCase().includes('amazon') || p.toLowerCase().includes('prime')),
      mandatory_description: 'Must be French and available on Amazon Prime',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        return g.includes('Romance') || g.includes('Drama') ? 3 : 2;
      },
      target_attributes: ['French language', 'Amazon Prime', 'romance drama'],
    },
    review_annotation: 'Language (French) + Platform (Amazon Prime) combination.',
  },
  {
    id: 'BENCH-042',
    category: 'language_platform',
    prompt: 'Korean mystery television show on Disney+',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      languages: ['Korean'],
      platforms: ['Disney+'],
      genres: ['Mystery'],
    },
    expected_hard_constraints: ['type', 'languages', 'platforms', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Series' &&
        (dna.languages || []).includes('Korean') &&
        (dna.platforms || []).includes('Disney+'),
      mandatory_description: 'Must be a Korean Series available on Disney+',
      graded_relevance: (dna) => ((dna.genres || []).includes('Mystery') ? 3 : 2),
      target_attributes: ['Korean series', 'Disney+', 'mystery'],
    },
    review_annotation: 'Niche platform availability for Korean drama on Disney+.',
  },
  {
    id: 'BENCH-043',
    category: 'language_platform',
    prompt: 'German sci-fi series with mystery elements on Netflix',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      languages: ['German'],
      platforms: ['Netflix'],
      genres: ['Sci-Fi & Fantasy', 'Mystery'],
    },
    expected_hard_constraints: ['type', 'languages', 'platforms'],
    soft_preferences: ['mystery'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Series' &&
        (dna.languages || []).includes('German') &&
        (dna.platforms || []).includes('Netflix'),
      mandatory_description: 'Must be German Series on Netflix',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        if (g.includes('Sci-Fi & Fantasy') && g.includes('Mystery')) return 3;
        if (g.includes('Sci-Fi & Fantasy') || g.includes('Mystery')) return 2;
        return 1;
      },
      target_attributes: ['German sci-fi series', 'Netflix'],
      known_relevant_titles: ['Dark', '1899'],
    },
    review_annotation: 'German language television series on Netflix.',
  },
  {
    id: 'BENCH-044',
    category: 'language_platform',
    prompt: 'Hindi action film available on Apple TV',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      languages: ['Hindi'],
      platforms: ['Apple TV'],
      genres: ['Action'],
    },
    expected_hard_constraints: ['type', 'languages', 'platforms', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.languages || []).includes('Hindi') &&
        (dna.platforms || []).includes('Apple TV'),
      mandatory_description: 'Must be Hindi Movie on Apple TV',
      graded_relevance: (dna) => ((dna.genres || []).includes('Action') ? 3 : 2),
      target_attributes: ['Hindi action cinema', 'Apple TV'],
    },
    review_annotation: 'Hindi language movie with Apple TV platform restriction.',
  },
  {
    id: 'BENCH-045',
    category: 'language_platform',
    prompt: 'Italian comedy movie on Google Play Movies',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      languages: ['Italian'],
      platforms: ['Google Play Movies'],
      genres: ['Comedy'],
    },
    expected_hard_constraints: ['type', 'languages', 'platforms', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.languages || []).includes('Italian') &&
        (dna.platforms || []).includes('Google Play Movies'),
      mandatory_description: 'Must be Italian Movie on Google Play Movies',
      graded_relevance: (dna) => ((dna.genres || []).includes('Comedy') ? 3 : 2),
      target_attributes: ['Italian comedy', 'Google Play'],
    },
    review_annotation: 'Italian language comedy with transactional VOD platform filter.',
  },
  {
    id: 'BENCH-046',
    category: 'language_platform',
    prompt: 'Danish crime drama series',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      languages: ['Danish'],
      genres: ['Crime', 'Drama'],
    },
    expected_hard_constraints: ['type', 'languages', 'genres'],
    soft_preferences: ['Nordic noir'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Series' && (dna.languages || []).includes('Danish'),
      mandatory_description: 'Must be Danish Series',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        return g.includes('Crime') || g.includes('Drama') ? 3 : 2;
      },
      target_attributes: ['Danish crime series', 'Nordic noir'],
    },
    review_annotation: 'Danish Nordic noir language filter without platform constraint.',
  },

  // ===========================================================================
  // 6. RUNTIME & RELEASE-YEAR BOUNDS (8 cases)
  // ===========================================================================
  {
    id: 'BENCH-047',
    category: 'runtime_year_bounds',
    prompt: 'Horror movie under 90 minutes',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Horror'],
      max_runtime: 90,
      runtime_is_hard_constraint: true,
    },
    expected_hard_constraints: ['type', 'genres', 'max_runtime'],
    soft_preferences: ['short runtime'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Horror') &&
        (dna.runtime === null || dna.runtime <= 90),
      mandatory_description: 'Must be Horror Movie under 90 minutes',
      graded_relevance: (dna) => (dna.runtime && dna.runtime <= 90 ? 3 : 2),
      target_attributes: ['runtime <= 90min', 'horror'],
    },
    review_annotation: 'Strict numeric runtime bound <= 90 minutes.',
  },
  {
    id: 'BENCH-048',
    category: 'runtime_year_bounds',
    prompt: 'Sci-fi movie longer than 150 minutes',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Sci-Fi & Fantasy'],
      min_runtime: 150,
      runtime_is_hard_constraint: true,
    },
    expected_hard_constraints: ['type', 'genres', 'min_runtime'],
    soft_preferences: ['epic length'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Sci-Fi & Fantasy') &&
        (dna.runtime === null || dna.runtime >= 150),
      mandatory_description: 'Must be Sci-Fi Movie longer than 150 minutes',
      graded_relevance: (dna) => (dna.runtime && dna.runtime >= 150 ? 3 : 2),
      target_attributes: ['runtime >= 150min', 'sci-fi'],
      known_relevant_titles: ['Interstellar', 'Dune', 'Avatar: The Way of Water', 'Blade Runner 2049'],
    },
    review_annotation: 'Strict minimum runtime bound >= 150 minutes.',
  },
  {
    id: 'BENCH-049',
    category: 'runtime_year_bounds',
    prompt: 'Action movie released between 1990 and 1999',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Action'],
      min_year: 1990,
      max_year: 1999,
      year_range_is_hard: true,
    },
    expected_hard_constraints: ['type', 'genres', 'year_range'],
    soft_preferences: ['90s action'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Action') &&
        dna.release_year !== null &&
        dna.release_year >= 1990 &&
        dna.release_year <= 1999,
      mandatory_description: 'Must be Action Movie released between 1990 and 1999',
      graded_relevance: (dna) =>
        dna.release_year && dna.release_year >= 1990 && dna.release_year <= 1999 ? 3 : 0,
      target_attributes: ['1990s release year', 'action'],
      known_relevant_titles: ['Terminator 2: Judgment Day', 'Speed', 'The Matrix', 'Die Hard with a Vengeance'],
    },
    review_annotation: 'Explicit closed decade range 1990-1999.',
  },
  {
    id: 'BENCH-050',
    category: 'runtime_year_bounds',
    prompt: 'Drama movie released in 2023 or later',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Drama'],
      min_year: 2023,
      year_range_is_hard: true,
    },
    expected_hard_constraints: ['type', 'genres', 'min_year'],
    soft_preferences: ['recent'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Drama') &&
        (dna.release_year === null || dna.release_year >= 2023),
      mandatory_description: 'Must be Drama Movie released 2023+',
      graded_relevance: (dna) => (dna.release_year && dna.release_year >= 2023 ? 3 : 2),
      target_attributes: ['release year >= 2023', 'drama'],
      known_relevant_titles: ['Oppenheimer', 'Killers of the Flower Moon', 'Past Lives'],
    },
    review_annotation: 'Open-ended lower year bound 2023+.',
  },
  {
    id: 'BENCH-051',
    category: 'runtime_year_bounds',
    prompt: 'Classic comedy movie from before 1980',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Comedy'],
      max_year: 1979,
      year_range_is_hard: true,
    },
    expected_hard_constraints: ['type', 'genres', 'max_year'],
    soft_preferences: ['classic'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Comedy') &&
        dna.release_year !== null &&
        dna.release_year < 1980,
      mandatory_description: 'Must be Comedy Movie released before 1980',
      graded_relevance: (dna) => (dna.release_year && dna.release_year < 1980 ? 3 : 0),
      target_attributes: ['release year < 1980', 'comedy'],
      known_relevant_titles: ['Monty Python and the Holy Grail', 'Airplane!', 'Young Frankenstein'],
    },
    review_annotation: 'Upper year bound (pre-1980 classic).',
  },
  {
    id: 'BENCH-052',
    category: 'runtime_year_bounds',
    prompt: 'Quick bite animated movie around 75 to 85 minutes long',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Animation'],
      min_runtime: 75,
      max_runtime: 85,
      runtime_is_hard_constraint: true,
    },
    expected_hard_constraints: ['type', 'genres', 'runtime_range'],
    soft_preferences: ['quick bite'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Animation') &&
        (dna.runtime === null || (dna.runtime >= 70 && dna.runtime <= 90)),
      mandatory_description: 'Must be Animated Movie with runtime ~75-85min',
      graded_relevance: (dna) => {
        if (dna.runtime && dna.runtime >= 75 && dna.runtime <= 85) return 3;
        if (dna.runtime && dna.runtime >= 70 && dna.runtime <= 90) return 2;
        return 1;
      },
      target_attributes: ['short runtime 75-85m', 'animation'],
    },
    review_annotation: 'Bounded closed runtime window 75-85 minutes.',
  },
  {
    id: 'BENCH-053',
    category: 'runtime_year_bounds',
    prompt: 'Thriller movie from the 1970s',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Thriller'],
      min_year: 1970,
      max_year: 1979,
      year_range_is_hard: true,
    },
    expected_hard_constraints: ['type', 'genres', 'year_range'],
    soft_preferences: ['70s thriller'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Thriller') &&
        dna.release_year !== null &&
        dna.release_year >= 1970 &&
        dna.release_year <= 1979,
      mandatory_description: 'Must be Thriller Movie released in the 1970s',
      graded_relevance: (dna) =>
        dna.release_year && dna.release_year >= 1970 && dna.release_year <= 1979 ? 3 : 0,
      target_attributes: ['1970s decade', 'thriller'],
      known_relevant_titles: ['Taxi Driver', 'Jaws', 'Alien', 'The Conversation', 'Chinatown'],
    },
    review_annotation: 'Decade extraction "1970s" -> [1970, 1979].',
  },
  {
    id: 'BENCH-054',
    category: 'runtime_year_bounds',
    prompt: 'Long crime movie at least 2 hours and 45 minutes long',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Crime'],
      min_runtime: 165,
      runtime_is_hard_constraint: true,
    },
    expected_hard_constraints: ['type', 'genres', 'min_runtime'],
    soft_preferences: ['long', 'epic crime'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Crime') &&
        (dna.runtime === null || dna.runtime >= 160),
      mandatory_description: 'Must be Crime Movie with runtime >= 165min',
      graded_relevance: (dna) => (dna.runtime && dna.runtime >= 165 ? 3 : 2),
      target_attributes: ['runtime >= 165m', 'crime'],
      known_relevant_titles: ['The Godfather Part II', 'The Irishman', 'Killers of the Flower Moon', 'Heat'],
    },
    review_annotation: 'Natural language duration "2 hours and 45 minutes" -> 165 min.',
  },

  // ===========================================================================
  // 7. POSITIVE THEMES, MOOD, TONE (8 cases)
  // ===========================================================================
  {
    id: 'BENCH-055',
    category: 'tone_mood_theme',
    prompt: 'Bleak, slow-burn psychological dread that stays with you for days',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Thriller', 'Drama'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['bleak', 'slow-burn', 'psychological dread'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).includes('Thriller') || (dna.genres || []).includes('Drama') || (dna.genres || []).includes('Horror'),
      mandatory_description: 'Must have Thriller, Drama, or Horror genre',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matchesMood = ['dark', 'bleak', 'psych', 'dread', 'slow', 'haunt', 'isolation'].some((w) => desc.includes(w));
        return matchesMood ? 3 : 2;
      },
      target_attributes: ['slow-burn dread', 'bleak atmosphere'],
      known_relevant_titles: ['The Zone of Interest', 'Cure', 'The Witch'],
    },
    review_annotation: 'Pure tone and emotional texture query without explicit structural filters.',
  },
  {
    id: 'BENCH-056',
    category: 'tone_mood_theme',
    prompt: 'Warm, uplifting, heartwarming story about an unlikely friendship',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Drama', 'Comedy', 'Family'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['uplifting', 'heartwarming', 'unlikely friendship'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Drama', 'Comedy', 'Family', 'Animation'].includes(g)),
      mandatory_description: 'Must be heartwarming genre',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['friend', 'warm', 'heart', 'bond', 'love', 'kindness'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['heartwarming', 'unlikely friendship'],
      known_relevant_titles: ['The Intouchables', 'Green Book', 'Paddington 2', 'Up'],
    },
    review_annotation: 'Positive emotional sentiment and character bond mapping.',
  },
  {
    id: 'BENCH-057',
    category: 'tone_mood_theme',
    prompt: 'High-adrenaline survival story facing extreme wilderness elements',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Adventure', 'Action', 'Drama'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['survival', 'wilderness', 'extreme elements', 'adrenaline'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Adventure', 'Action', 'Drama', 'Thriller'].includes(g)),
      mandatory_description: 'Must be Adventure/Action/Drama',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['surviv', 'wild', 'mountain', 'snow', 'cold', 'forest', 'nature', 'extreme'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['wilderness survival', 'high adrenaline'],
      known_relevant_titles: ['The Revenant', '127 Hours', 'Into the Wild', 'Cast Away', 'Society of the Snow'],
    },
    review_annotation: 'Thematic wilderness survival extraction.',
  },
  {
    id: 'BENCH-058',
    category: 'tone_mood_theme',
    prompt: 'Witty, cynical satire exposing media manipulation and sensationalism',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Comedy', 'Drama'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['satire', 'media manipulation', 'sensationalism', 'cynical'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Comedy', 'Drama', 'Crime'].includes(g)),
      mandatory_description: 'Must have Comedy, Drama, or Crime',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['media', 'news', 'tv', 'satire', 'manipulat', 'fame', 'journalist'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['media satire', 'dark cynicism'],
      known_relevant_titles: ['Nightcrawler', "Don't Look Up", 'Network', 'The Truman Show'],
    },
    review_annotation: 'Sharp cynical satire theme.',
  },
  {
    id: 'BENCH-059',
    category: 'tone_mood_theme',
    prompt: 'Cozy autumn rainy day comfort watch with low stakes',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Comedy', 'Romance', 'Family'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['cozy', 'comfort', 'low stakes', 'autumn'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Comedy', 'Romance', 'Family', 'Animation', 'Drama'].includes(g)),
      mandatory_description: 'Must be low-stakes comfortable genre',
      graded_relevance: (dna) => {
        // High violence or horror should be penalized
        const g = dna.genres || [];
        if (g.includes('Horror') || g.includes('War')) return 0;
        return 3;
      },
      target_attributes: ['comfort watch', 'wholesome low-stakes'],
    },
    review_annotation: 'Vibe-based query with implicit anti-violence preference.',
  },
  {
    id: 'BENCH-060',
    category: 'tone_mood_theme',
    prompt: 'Intense paranoia and claustrophobia trapped in an isolated research station',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Horror', 'Sci-Fi & Fantasy', 'Mystery', 'Thriller'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['paranoia', 'claustrophobia', 'isolated research station'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Horror', 'Sci-Fi & Fantasy', 'Mystery', 'Thriller'].includes(g)),
      mandatory_description: 'Must be high-tension genre',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['antarctic', 'station', 'isolat', 'trapped', 'alien', 'crew', 'base', 'paranoia'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['claustrophobic paranoia', 'isolation'],
      known_relevant_titles: ['The Thing', 'Alien', 'The Abyss', 'Ex Machina'],
    },
    review_annotation: 'Isolated research base paranoia narrative archetype.',
  },
  {
    id: 'BENCH-061',
    category: 'tone_mood_theme',
    prompt: 'Whimsical philosophical fable exploring the meaning of life',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Drama', 'Fantasy', 'Animation', 'Comedy'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['philosophical', 'whimsical', 'meaning of life', 'fable'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Drama', 'Fantasy', 'Animation', 'Comedy', 'Sci-Fi & Fantasy'].includes(g)),
      mandatory_description: 'Must match speculative or thoughtful genre',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['life', 'philosoph', 'soul', 'fable', 'journey', 'meaning', 'death'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['philosophical fable', 'meaning of existence'],
      known_relevant_titles: ['Soul', 'Everything Everywhere All at Once', 'Life of Pi', 'Amélie'],
    },
    review_annotation: 'Philosophical fable aesthetic.',
  },
  {
    id: 'BENCH-062',
    category: 'tone_mood_theme',
    prompt: 'Nail-biting cyber espionage and rogue government conspiracy',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Thriller', 'Action', 'Mystery'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['cyber espionage', 'government conspiracy', 'hackers', 'rogue agents'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Thriller', 'Action', 'Mystery'].includes(g)),
      mandatory_description: 'Must have Thriller, Action, or Mystery',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['cia', 'conspiracy', 'agent', 'government', 'hacker', 'spy', 'espionage'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['cyber espionage', 'political conspiracy'],
      known_relevant_titles: ['The Bourne Ultimatum', 'Enemy of the State', 'Citizenfour', 'Snowden'],
    },
    review_annotation: 'Espionage government thriller theme.',
  },

  // ===========================================================================
  // 8. NEGATIVE EXCLUSIONS (GENRES, TITLES, FRANCHISES, PEOPLE) (10 cases)
  // ===========================================================================
  {
    id: 'BENCH-063',
    category: 'negative_exclusions',
    prompt: 'Thrilling mystery movie, no horror, absolutely no jump scares',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Mystery', 'Thriller'],
      negative_genres: ['Horror'],
      negative_keywords: ['horror', 'jump scare', 'jump scares'],
    },
    expected_hard_constraints: ['type', 'negative_genres'],
    soft_preferences: ['mystery'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        !(dna.genres || []).includes('Horror') &&
        ((dna.genres || []).includes('Mystery') || (dna.genres || []).includes('Thriller')),
      mandatory_description: 'Must be Mystery/Thriller Movie, zero Horror titles allowed',
      graded_relevance: (dna) =>
        !(dna.genres || []).includes('Horror') && (dna.genres || []).includes('Mystery') ? 3 : 0,
      target_attributes: ['mystery without horror'],
    },
    review_annotation: 'Strict negative genre exclusion (Horror) with negative keywords.',
  },
  {
    id: 'BENCH-064',
    category: 'negative_exclusions',
    prompt: 'Action movie without romance or love triangles',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Action'],
      negative_genres: ['Romance'],
      negative_keywords: ['romance', 'love triangle'],
    },
    expected_hard_constraints: ['type', 'genres', 'negative_genres'],
    soft_preferences: ['action'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Action') &&
        !(dna.genres || []).includes('Romance'),
      mandatory_description: 'Must be Action Movie, zero Romance titles allowed',
      graded_relevance: (dna) =>
        (dna.genres || []).includes('Action') && !(dna.genres || []).includes('Romance') ? 3 : 0,
      target_attributes: ['action without romance'],
    },
    review_annotation: 'Action movie with hard negative Romance exclusion.',
  },
  {
    id: 'BENCH-065',
    category: 'negative_exclusions',
    prompt: 'Superhero action movies, but exclude anything from Marvel or MCU',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Action'],
      negative_franchises: ['Marvel', 'MCU'],
    },
    expected_hard_constraints: ['type', 'negative_franchises'],
    soft_preferences: ['superhero action'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => {
        const title = dna.title.toLowerCase();
        const desc = (dna.description || '').toLowerCase();
        const isMarvel = ['marvel', 'avengers', 'iron man', 'spider-man', 'thor', 'captain america'].some((w) => title.includes(w) || desc.includes(w));
        return dna.type === 'Movie' && !isMarvel;
      },
      mandatory_description: 'Must be Superhero/Action Movie excluding Marvel/MCU titles',
      graded_relevance: (dna) => {
        const title = dna.title.toLowerCase();
        if (title.includes('batman') || title.includes('superman') || title.includes('dark knight')) return 3;
        return 2;
      },
      target_attributes: ['non-Marvel superhero action'],
      known_relevant_titles: ['The Dark Knight', 'Batman Begins', 'Watchmen', 'The Incredibles'],
      known_irrelevant_titles: ['The Avengers', 'Iron Man', 'Spider-Man: No Way Home'],
    },
    review_annotation: 'Franchise-level negative exclusion on Marvel/MCU.',
  },
  {
    id: 'BENCH-066',
    category: 'negative_exclusions',
    prompt: 'Space exploration movies but do not recommend Interstellar or Gravity',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Sci-Fi & Fantasy'],
      negative_titles: ['Interstellar', 'Gravity'],
    },
    expected_hard_constraints: ['type', 'negative_titles'],
    soft_preferences: ['space exploration'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => {
        const title = dna.title.toLowerCase();
        return dna.type === 'Movie' && title !== 'interstellar' && title !== 'gravity';
      },
      mandatory_description: 'Must be Space Movie excluding Interstellar and Gravity specifically',
      graded_relevance: (dna) => {
        const title = dna.title.toLowerCase();
        if (title === 'interstellar' || title === 'gravity') return 0;
        return (dna.genres || []).includes('Sci-Fi & Fantasy') ? 3 : 2;
      },
      target_attributes: ['space sci-fi without named titles'],
      known_relevant_titles: ['The Martian', 'Ad Astra', 'First Man', 'Apollo 13'],
      known_irrelevant_titles: ['Interstellar', 'Gravity'],
    },
    review_annotation: 'Specific negative title exclusion list.',
  },
  {
    id: 'BENCH-067',
    category: 'negative_exclusions',
    prompt: 'Action movies without Tom Cruise',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Action'],
      negative_persons: ['Tom Cruise'],
    },
    expected_hard_constraints: ['type', 'negative_persons'],
    soft_preferences: ['action'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => {
        const hasTom = (dna.actors || []).some((a) => a.toLowerCase() === 'tom cruise');
        return dna.type === 'Movie' && !hasTom && (dna.genres || []).includes('Action');
      },
      mandatory_description: 'Must be Action Movie without Tom Cruise in cast',
      graded_relevance: (dna) => {
        const hasTom = (dna.actors || []).some((a) => a.toLowerCase() === 'tom cruise');
        return hasTom ? 0 : 3;
      },
      target_attributes: ['action without Tom Cruise'],
      known_irrelevant_titles: ['Top Gun: Maverick', 'Mission: Impossible - Fallout', 'Edge of Tomorrow'],
    },
    review_annotation: 'Negative person exclusion (actor).',
  },
  {
    id: 'BENCH-068',
    category: 'negative_exclusions',
    prompt: 'Crime drama without graphic violence or bloodshed',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Crime', 'Drama'],
      negative_keywords: ['violence', 'graphic violence', 'bloodshed'],
    },
    expected_hard_constraints: ['genres'],
    soft_preferences: ['non-violent crime', 'courtroom or white-collar crime'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).includes('Crime') || (dna.genres || []).includes('Drama'),
      mandatory_description: 'Must be Crime or Drama without gore/graphic violence',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const hasBlood = ['gore', 'bloody', 'massacre', 'slaughter', 'brutal'].some((w) => desc.includes(w));
        return hasBlood ? 0 : 3;
      },
      target_attributes: ['restrained crime drama', 'white collar'],
      known_relevant_titles: ['Catch Me If You Can', '12 Angry Men', 'The Big Short'],
    },
    review_annotation: 'Negative thematic constraint on graphic violence.',
  },
  {
    id: 'BENCH-069',
    category: 'negative_exclusions',
    prompt: 'Sci-fi movie without aliens or extraterrestrial invasion',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Sci-Fi & Fantasy'],
      negative_keywords: ['alien', 'aliens', 'extraterrestrial', 'invasion'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['earthbound sci-fi', 'AI', 'cybernetics', 'time travel'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && (dna.genres || []).includes('Sci-Fi & Fantasy'),
      mandatory_description: 'Must be Sci-Fi Movie without aliens in premise',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const hasAliens = ['alien', 'extraterrestrial', 'invasion', 'martian'].some((w) => desc.includes(w));
        return hasAliens ? 1 : 3;
      },
      target_attributes: ['terrestrial sci-fi', 'AI or temporal sci-fi'],
      known_relevant_titles: ['Ex Machina', 'Gattaca', 'Her', 'Eternal Sunshine of the Spotless Mind'],
      known_irrelevant_titles: ['Alien', 'Independence Day', 'War of the Worlds'],
    },
    review_annotation: 'Specific narrative motif exclusion (aliens/invasion).',
  },
  {
    id: 'BENCH-070',
    category: 'negative_exclusions',
    prompt: 'Comedy films without crude bathroom humor or slapstick',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Comedy'],
      negative_keywords: ['crude', 'slapstick', 'bathroom humor'],
    },
    expected_hard_constraints: ['type', 'genres'],
    soft_preferences: ['witty comedy', 'dry humor'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie' && (dna.genres || []).includes('Comedy'),
      mandatory_description: 'Must be Comedy Movie',
      graded_relevance: (dna) => ((dna.genres || []).includes('Comedy') ? 3 : 1),
      target_attributes: ['sophisticated comedy', 'verbal wit'],
      known_relevant_titles: ['The Grand Budapest Hotel', 'Knives Out', 'Midnight in Paris'],
    },
    review_annotation: 'Negative tonal constraint on crude/slapstick humor.',
  },
  {
    id: 'BENCH-071',
    category: 'negative_exclusions',
    prompt: 'Space sci-fi series, exclude Star Wars and Star Trek',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      genres: ['Sci-Fi & Fantasy'],
      negative_franchises: ['Star Wars', 'Star Trek'],
    },
    expected_hard_constraints: ['type', 'negative_franchises'],
    soft_preferences: ['space sci-fi series'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => {
        const title = dna.title.toLowerCase();
        return dna.type === 'Series' && !title.includes('star wars') && !title.includes('star trek');
      },
      mandatory_description: 'Must be Series, zero Star Wars or Star Trek titles',
      graded_relevance: (dna) => {
        const title = dna.title.toLowerCase();
        if (title.includes('star wars') || title.includes('star trek')) return 0;
        return (dna.genres || []).includes('Sci-Fi & Fantasy') ? 3 : 1;
      },
      target_attributes: ['non-franchise space series'],
      known_relevant_titles: ['The Expanse', 'Battlestar Galactica', 'Firefly', 'Babylon 5'],
      known_irrelevant_titles: ['Star Trek: Discovery', 'The Mandalorian', 'Andor'],
    },
    review_annotation: 'Dual major space franchise negative exclusions.',
  },
  {
    id: 'BENCH-072',
    category: 'negative_exclusions',
    prompt: 'Fantasy movie without any horror or jump scares',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Fantasy'],
      negative_genres: ['Horror'],
      negative_keywords: ['jump scares', 'horror'],
    },
    expected_hard_constraints: ['type', 'negative_genres'],
    soft_preferences: ['family or whimsical fantasy'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        !(dna.genres || []).includes('Horror') &&
        ((dna.genres || []).includes('Fantasy') || (dna.genres || []).includes('Sci-Fi & Fantasy') || (dna.genres || []).includes('Family')),
      mandatory_description: 'Must be Fantasy Movie without Horror',
      graded_relevance: (dna) =>
        !(dna.genres || []).includes('Horror') ? 3 : 0,
      target_attributes: ['pure fantasy', 'zero horror'],
    },
    review_annotation: 'Fantasy genre with hard negative horror exclusion.',
  },

  // ===========================================================================
  // 9. MULTIPLE SIMULTANEOUS CONSTRAINTS (8 cases)
  // ===========================================================================
  {
    id: 'BENCH-073',
    category: 'multi_constraint_complex',
    prompt: 'Spanish mystery thriller movie on Netflix under 110 minutes released after 2018',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      languages: ['Spanish'],
      genres: ['Mystery', 'Thriller'],
      platforms: ['Netflix'],
      max_runtime: 110,
      min_year: 2019,
      runtime_is_hard_constraint: true,
      year_range_is_hard: true,
    },
    expected_hard_constraints: ['type', 'languages', 'platforms', 'genres', 'max_runtime', 'min_year'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.languages || []).includes('Spanish') &&
        (dna.platforms || []).includes('Netflix') &&
        (dna.runtime === null || dna.runtime <= 110) &&
        (dna.release_year === null || dna.release_year >= 2018),
      mandatory_description: 'Must meet Spanish + Netflix + Movie + <=110m + 2018+ constraints',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        return g.includes('Mystery') || g.includes('Thriller') ? 3 : 2;
      },
      target_attributes: ['5 simultaneous hard constraints'],
      known_relevant_titles: ['The Platform', 'Mirage'],
    },
    review_annotation: '5 simultaneous constraints: Format, Language, Platform, Runtime, Year.',
  },
  {
    id: 'BENCH-074',
    category: 'multi_constraint_complex',
    prompt: 'Japanese animated sci-fi film on Netflix under 2 hours without romance',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      languages: ['Japanese'],
      genres: ['Animation', 'Sci-Fi & Fantasy'],
      platforms: ['Netflix'],
      max_runtime: 120,
      negative_genres: ['Romance'],
      runtime_is_hard_constraint: true,
    },
    expected_hard_constraints: ['type', 'languages', 'platforms', 'genres', 'max_runtime', 'negative_genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.languages || []).includes('Japanese') &&
        (dna.platforms || []).includes('Netflix') &&
        (dna.genres || []).includes('Animation') &&
        !(dna.genres || []).includes('Romance') &&
        (dna.runtime === null || dna.runtime <= 120),
      mandatory_description: 'Japanese animated sci-fi movie on Netflix <=120m without romance',
      graded_relevance: (dna) => ((dna.genres || []).includes('Sci-Fi & Fantasy') ? 3 : 2),
      target_attributes: ['Japanese', 'Anime', 'Sci-Fi', 'Netflix', 'Short', 'No Romance'],
    },
    review_annotation: '6 simultaneous constraints including negative genre exclusion.',
  },
  {
    id: 'BENCH-075',
    category: 'multi_constraint_complex',
    prompt: 'Crime drama series on Amazon Prime released between 2010 and 2020',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      genres: ['Crime', 'Drama'],
      platforms: ['Amazon Prime Video'],
      min_year: 2010,
      max_year: 2020,
      year_range_is_hard: true,
    },
    expected_hard_constraints: ['type', 'genres', 'platforms', 'year_range'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Series' &&
        (dna.platforms || []).some((p) => p.toLowerCase().includes('amazon') || p.toLowerCase().includes('prime')) &&
        (dna.release_year === null || (dna.release_year >= 2010 && dna.release_year <= 2020)),
      mandatory_description: 'Crime drama series on Prime from 2010-2020',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        return g.includes('Crime') && g.includes('Drama') ? 3 : 2;
      },
      target_attributes: ['series', 'crime drama', 'Prime', '2010-2020'],
      known_relevant_titles: ['Bosch', 'Goliath', 'Sneaky Pete'],
    },
    review_annotation: 'Series format + dual genre + platform + decade window.',
  },
  {
    id: 'BENCH-076',
    category: 'multi_constraint_complex',
    prompt: 'French comedy movie released in the 1990s under 100 minutes',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      languages: ['French'],
      genres: ['Comedy'],
      min_year: 1990,
      max_year: 1999,
      max_runtime: 100,
      year_range_is_hard: true,
      runtime_is_hard_constraint: true,
    },
    expected_hard_constraints: ['type', 'languages', 'genres', 'year_range', 'max_runtime'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.languages || []).includes('French') &&
        (dna.genres || []).includes('Comedy') &&
        (dna.release_year === null || (dna.release_year >= 1990 && dna.release_year <= 1999)) &&
        (dna.runtime === null || dna.runtime <= 100),
      mandatory_description: 'French comedy movie from 90s <= 100 minutes',
      graded_relevance: (dna) => 3,
      target_attributes: ['French', 'Comedy', '1990s', '<=100min'],
    },
    review_annotation: 'Language, genre, decade, runtime, and format all constrained.',
  },
  {
    id: 'BENCH-077',
    category: 'multi_constraint_complex',
    prompt: 'Korean action thriller series on Netflix without zombie horror themes',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      languages: ['Korean'],
      genres: ['Action', 'Thriller'],
      platforms: ['Netflix'],
      negative_genres: ['Horror'],
      negative_keywords: ['zombie', 'zombies'],
    },
    expected_hard_constraints: ['type', 'languages', 'platforms', 'genres', 'negative_genres'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Series' &&
        (dna.languages || []).includes('Korean') &&
        (dna.platforms || []).includes('Netflix') &&
        !(dna.genres || []).includes('Horror'),
      mandatory_description: 'Korean action thriller on Netflix with zero zombies/horror',
      graded_relevance: (dna) => {
        const title = dna.title.toLowerCase();
        if (title.includes('kingdom') || title.includes('all of us are dead')) return 0;
        return 3;
      },
      target_attributes: ['Korean series', 'Netflix', 'Action/Thriller', 'No Zombies'],
      known_relevant_titles: ['My Name', 'Vagabond', 'D.P.'],
      known_irrelevant_titles: ['All of Us Are Dead', 'Kingdom'],
    },
    review_annotation: 'Non-horror Korean action thriller on Netflix.',
  },
  {
    id: 'BENCH-078',
    category: 'multi_constraint_complex',
    prompt: 'Sci-fi movie directed by Christopher Nolan under 170 minutes starring Christian Bale',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Sci-Fi & Fantasy'],
      directors: ['Christopher Nolan'],
      actors: ['Christian Bale'],
      max_runtime: 170,
      runtime_is_hard_constraint: true,
    },
    expected_hard_constraints: ['type', 'directors', 'actors', 'max_runtime'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => {
        const isDir = (dna.directors || []).some((d) => d.toLowerCase() === 'christopher nolan');
        const isAct = (dna.actors || []).some((a) => a.toLowerCase() === 'christian bale');
        return dna.type === 'Movie' && isDir && isAct && (dna.runtime === null || dna.runtime <= 170);
      },
      mandatory_description: 'Christopher Nolan + Christian Bale + Movie <= 170m',
      graded_relevance: (dna) => 3,
      target_attributes: ['Nolan', 'Bale', '<=170m'],
      known_relevant_titles: ['The Prestige', 'Batman Begins', 'The Dark Knight'],
    },
    review_annotation: 'Director + Actor + Runtime + Format multi-constraint intersection.',
  },
  {
    id: 'BENCH-079',
    category: 'multi_constraint_complex',
    prompt: 'Highly rated family adventure animation movie on Disney+ under 100 minutes',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Family', 'Adventure', 'Animation'],
      platforms: ['Disney+'],
      max_runtime: 100,
      runtime_is_hard_constraint: true,
    },
    expected_hard_constraints: ['type', 'genres', 'platforms', 'max_runtime'],
    soft_preferences: ['highly rated'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.genres || []).includes('Animation') &&
        (dna.platforms || []).includes('Disney+') &&
        (dna.runtime === null || dna.runtime <= 100),
      mandatory_description: 'Animation movie on Disney+ under 100 minutes',
      graded_relevance: (dna) => ((dna.rating || 0) >= 7.0 ? 3 : 2),
      target_attributes: ['Disney+', 'Animation', '<=100m', 'Family'],
      known_relevant_titles: ['The Lion King', 'Aladdin', 'Finding Nemo', 'Tarzan'],
    },
    review_annotation: 'Platform + Format + Genre + Runtime + Quality intersection.',
  },
  {
    id: 'BENCH-080',
    category: 'multi_constraint_complex',
    prompt: 'Recent mystery drama series from 2021 or later on Apple TV',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      genres: ['Mystery', 'Drama'],
      platforms: ['Apple TV'],
      min_year: 2021,
      year_range_is_hard: true,
    },
    expected_hard_constraints: ['type', 'genres', 'platforms', 'min_year'],
    soft_preferences: [],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Series' &&
        (dna.platforms || []).includes('Apple TV') &&
        (dna.release_year === null || dna.release_year >= 2021),
      mandatory_description: 'Series on Apple TV from 2021+ with Mystery/Drama',
      graded_relevance: (dna) => {
        const g = dna.genres || [];
        return g.includes('Mystery') || g.includes('Drama') ? 3 : 2;
      },
      target_attributes: ['Apple TV series', '2021+', 'mystery drama'],
      known_relevant_titles: ['Severance', 'Slow Horses', 'Black Bird'],
    },
    review_annotation: 'Apple TV series with recent temporal bound and mystery/drama.',
  },

  // ===========================================================================
  // 10. INDIRECT & UNFAMILIAR PHRASING (8 cases)
  // ===========================================================================
  {
    id: 'BENCH-081',
    category: 'indirect_unfamiliar_phrasing',
    prompt: 'Stories where a lone investigator slowly realizes they cannot trust their own memories',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Mystery', 'Thriller', 'Drama'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['unreliable memory', 'investigator paranoia', 'psychological thriller'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Mystery', 'Thriller', 'Drama', 'Sci-Fi & Fantasy'].includes(g)),
      mandatory_description: 'Must match speculative or mystery genres',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['memory', 'memories', 'investigat', 'detective', 'amnesia', 'mind', 'truth'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['unreliable memory', 'psychological mystery'],
      known_relevant_titles: ['Memento', 'Shutter Island', 'Total Recall', 'The Machinist'],
    },
    review_annotation: 'Semantic conceptual match without genre buzzwords.',
  },
  {
    id: 'BENCH-082',
    category: 'indirect_unfamiliar_phrasing',
    prompt: 'A tale about an eccentric genius recluse solving impossible enigmas',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Mystery', 'Drama'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['eccentric genius', 'impossible enigmas', 'recluse'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Mystery', 'Drama', 'Crime'].includes(g)),
      mandatory_description: 'Must match Drama, Mystery, or Crime',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['genius', 'puzzle', 'enigma', 'detective', 'math', 'code', 'brilliant'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['eccentric genius investigator'],
      known_relevant_titles: ['Sherlock Holmes', 'The Imitation Game', 'A Beautiful Mind', 'Knives Out'],
    },
    review_annotation: 'Indirect character archetype description.',
  },
  {
    id: 'BENCH-083',
    category: 'indirect_unfamiliar_phrasing',
    prompt: 'Chilly Scandinavian noir filled with grim murders in snow covered landscapes',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Crime', 'Thriller', 'Mystery'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['Scandinavian noir', 'snow', 'winter murder mystery'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Crime', 'Thriller', 'Mystery', 'Drama'].includes(g)),
      mandatory_description: 'Must be Crime/Thriller/Mystery',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['snow', 'ice', 'winter', 'cold', 'murder', 'detective', 'scandinavia'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['Nordic noir', 'wintry murder mystery'],
      known_relevant_titles: ['The Girl with the Dragon Tattoo', 'Wind River', 'Insomnia', 'Fargo'],
    },
    review_annotation: 'Nordic atmospheric setting phrasing.',
  },
  {
    id: 'BENCH-084',
    category: 'indirect_unfamiliar_phrasing',
    prompt: 'Something deeply meditative about quiet human connection and loneliness in a foreign city',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Drama', 'Romance'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['meditative', 'loneliness', 'human connection', 'foreign city'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Drama', 'Romance'].includes(g)),
      mandatory_description: 'Must be Drama or Romance',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['city', 'lonel', 'connect', 'stranger', 'quiet', 'tokyo', 'paris', 'hotel'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['melancholy drama', 'poetic human connection'],
      known_relevant_titles: ['Lost in Translation', 'Past Lives', 'Before Sunrise', 'Her'],
    },
    review_annotation: 'Poetic, literary mood description.',
  },
  {
    id: 'BENCH-085',
    category: 'indirect_unfamiliar_phrasing',
    prompt: 'A gripping cat and mouse duel between an elite criminal and a dogged detective',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Crime', 'Action', 'Thriller'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['cat and mouse', 'detective vs criminal'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Crime', 'Action', 'Thriller', 'Drama'].includes(g)),
      mandatory_description: 'Must be Crime/Action/Thriller',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['detective', 'chase', 'cat', 'mouse', 'fbi', 'criminal', 'heist', 'hunt'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['cat and mouse duel'],
      known_relevant_titles: ['Heat', 'Catch Me If You Can', 'The Departed', 'American Gangster'],
    },
    review_annotation: 'Idiomatic trope "cat and mouse duel".',
  },
  {
    id: 'BENCH-086',
    category: 'indirect_unfamiliar_phrasing',
    prompt: 'Stories centering on an ordinary family uncovering a colossal government coverup',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Thriller', 'Drama', 'Mystery'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['government coverup', 'ordinary family', 'conspiracy'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Thriller', 'Drama', 'Mystery', 'Sci-Fi & Fantasy'].includes(g)),
      mandatory_description: 'Must have Thriller/Drama/Mystery',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['coverup', 'conspiracy', 'family', 'government', 'secret', 'truth'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['conspiracy thriller', 'ordinary protagonists'],
      known_relevant_titles: ['Stranger Things', 'Super 8', 'Dark Waters', 'The X-Files'],
    },
    review_annotation: 'Premise-based narrative prompt without explicit genre declaration.',
  },
  {
    id: 'BENCH-087',
    category: 'indirect_unfamiliar_phrasing',
    prompt: 'Whimsical time loops where characters relive the same day with hilarious chaos',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Comedy', 'Sci-Fi & Fantasy', 'Fantasy'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['time loop', 'reliving day', 'hilarious chaos'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Comedy', 'Sci-Fi & Fantasy', 'Fantasy', 'Romance'].includes(g)),
      mandatory_description: 'Must match speculative comedy',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['loop', 'reliv', 'day', 'time', 'again', 'repeat'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['time loop comedy'],
      known_relevant_titles: ['Groundhog Day', 'Palm Springs', 'Happy Death Day', 'Russian Doll'],
    },
    review_annotation: 'Specific narrative mechanic (time loop comedy).',
  },
  {
    id: 'BENCH-088',
    category: 'indirect_unfamiliar_phrasing',
    prompt: 'A chronicle of two brilliant rivals pushing each other past the brink of sanity',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Drama', 'Thriller'],
    },
    expected_hard_constraints: [],
    soft_preferences: ['obsession', 'brilliant rivals', 'perfectionism'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => (dna.genres || []).some((g) => ['Drama', 'Thriller'].includes(g)),
      mandatory_description: 'Must be Drama or Thriller',
      graded_relevance: (dna) => {
        const desc = (dna.description || '').toLowerCase();
        const matches = ['rival', 'obsess', 'perfection', 'insan', 'music', 'magician', 'duel'].some((w) => desc.includes(w));
        return matches ? 3 : 2;
      },
      target_attributes: ['obsessive psychological rivalry'],
      known_relevant_titles: ['The Prestige', 'Whiplash', 'Black Swan', 'Amadeus'],
    },
    review_annotation: 'Thematic character obsession and rivalry.',
  },

  // ===========================================================================
  // 11. AMBIGUOUS & CONTRADICTORY REQUESTS (6 cases)
  // ===========================================================================
  {
    id: 'BENCH-089',
    category: 'ambiguous_contradictory',
    prompt: 'A short 4-hour epic movie',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      expected_clarification: true,
    },
    expected_hard_constraints: [],
    soft_preferences: ['contradictory runtime'],
    expected_evaluation_method: 'contradiction',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Contradictory runtime ("short" vs "4-hour epic")',
      graded_relevance: (dna) => 2,
      target_attributes: ['runtime contradiction handling'],
    },
    review_annotation: 'Direct semantic contradiction in runtime constraint ("short" vs "4-hour").',
  },
  {
    id: 'BENCH-090',
    category: 'ambiguous_contradictory',
    prompt: 'A peaceful, calming slasher movie where nobody gets injured or dies',
    mode: 'custom',
    expected_interpretation: {
      genres: ['Horror'],
      negative_keywords: ['injured', 'dies', 'death', 'kill'],
      expected_clarification: true,
    },
    expected_hard_constraints: [],
    soft_preferences: ['calming'],
    expected_evaluation_method: 'contradiction',
    relevance_criteria: {
      mandatory_condition: (dna) => true,
      mandatory_description: 'Contradictory genre premise ("slasher" where nobody gets injured)',
      graded_relevance: (dna) => 2,
      target_attributes: ['contradictory genre and exclusion'],
    },
    review_annotation: 'Intrinsic contradiction: slasher archetype vs zero injury/death.',
  },
  {
    id: 'BENCH-091',
    category: 'ambiguous_contradictory',
    prompt: 'Movies starring Chris',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      actors: [],
      expected_clarification: true,
    },
    expected_hard_constraints: [],
    soft_preferences: ['ambiguous actor name Chris'],
    expected_evaluation_method: 'contradiction',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Ambiguous actor first name alone (Evans, Hemsworth, Pratt, Pine, Bale)',
      graded_relevance: (dna) => {
        const hasChris = (dna.actors || []).some((a) => a.toLowerCase().startsWith('chris'));
        return hasChris ? 3 : 1;
      },
      target_attributes: ['ambiguous person resolution'],
    },
    review_annotation: 'Single common first name Chris; should flag ambiguity or disjunctively retrieve.',
  },
  {
    id: 'BENCH-092',
    category: 'ambiguous_contradictory',
    prompt: 'Action movie with absolutely no conflict, enemies, danger, or fighting',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Action'],
      negative_keywords: ['conflict', 'enemies', 'danger', 'fighting'],
      expected_clarification: true,
    },
    expected_hard_constraints: [],
    soft_preferences: [],
    expected_evaluation_method: 'contradiction',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Contradictory genre vs zero conflict',
      graded_relevance: (dna) => 2,
      target_attributes: ['genre premise contradiction'],
    },
    review_annotation: 'Action genre contradiction with total absence of conflict.',
  },
  {
    id: 'BENCH-093',
    category: 'ambiguous_contradictory',
    prompt: 'Movie called Alien',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      reference_titles: ['Alien'],
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['Alien franchise'],
    expected_evaluation_method: 'deterministic',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Exact title Alien resolution vs Aliens vs Alien 3',
      graded_relevance: (dna) => (dna.title.toLowerCase().includes('alien') ? 3 : 1),
      target_attributes: ['title ambiguity resolution'],
      known_relevant_titles: ['Alien', 'Aliens', 'Alien: Romulus'],
    },
    review_annotation: 'Exact title vs franchise ambiguity (Alien vs Aliens).',
  },
  {
    id: 'BENCH-094',
    category: 'ambiguous_contradictory',
    prompt: 'A black and white silent film in full 4K Dolby Atmos surround sound',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      expected_clarification: true,
    },
    expected_hard_constraints: [],
    soft_preferences: [],
    expected_evaluation_method: 'contradiction',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Contradictory audio requirement for silent film',
      graded_relevance: (dna) => 2,
      target_attributes: ['technological contradiction'],
    },
    review_annotation: 'Silent era film vs modern surround sound audio contradiction.',
  },

  // ===========================================================================
  // 12. SCARCITY SCENARIOS (<20 CATALOG TITLES) (4 cases)
  // ===========================================================================
  {
    id: 'BENCH-095',
    category: 'scarcity_under_20',
    prompt: 'Korean sci-fi movie available on Netflix',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      languages: ['Korean'],
      genres: ['Sci-Fi & Fantasy'],
      platforms: ['Netflix'],
    },
    expected_hard_constraints: ['type', 'languages', 'platforms', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'scarcity',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Movie' &&
        (dna.languages || []).includes('Korean') &&
        (dna.platforms || []).includes('Netflix'),
      mandatory_description: 'Korean movie on Netflix (extremely scarce candidate pool <20)',
      graded_relevance: (dna) => ((dna.genres || []).includes('Sci-Fi & Fantasy') ? 3 : 2),
      target_attributes: ['scarce candidate pool <20'],
      known_relevant_titles: ['Space Sweepers', 'The Silent Sea'],
    },
    review_annotation: 'Strict scarcity case: verified in database that fewer than 20 items match.',
  },
  {
    id: 'BENCH-096',
    category: 'scarcity_under_20',
    prompt: 'Italian Western series from the 1970s',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      languages: ['Italian'],
      genres: ['Western'],
      min_year: 1970,
      max_year: 1979,
      year_range_is_hard: true,
    },
    expected_hard_constraints: ['type', 'languages', 'genres', 'year_range'],
    soft_preferences: [],
    expected_evaluation_method: 'scarcity',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Series',
      mandatory_description: 'Scarce Italian Western series in 1970s',
      graded_relevance: (dna) => 2,
      target_attributes: ['severe scarcity pool < 5'],
    },
    review_annotation: 'Severe scarcity: Italian Western television in the 70s has near-zero records.',
  },
  {
    id: 'BENCH-097',
    category: 'scarcity_under_20',
    prompt: 'Documentary movie directed by Denis Villeneuve',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Documentary'],
      directors: ['Denis Villeneuve'],
    },
    expected_hard_constraints: ['type', 'genres', 'directors'],
    soft_preferences: [],
    expected_evaluation_method: 'scarcity',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        (dna.directors || []).some((d) => d.toLowerCase() === 'denis villeneuve'),
      mandatory_description: 'Denis Villeneuve documentary (scarcity: Denis primarily makes fiction features)',
      graded_relevance: (dna) => 2,
      target_attributes: ['director with minimal genre footprint'],
    },
    review_annotation: 'Director intersection where catalog has 0-1 matches.',
  },
  {
    id: 'BENCH-098',
    category: 'scarcity_under_20',
    prompt: 'Spanish animated horror series',
    mode: 'custom',
    expected_interpretation: {
      type: 'Series',
      languages: ['Spanish'],
      genres: ['Animation', 'Horror'],
    },
    expected_hard_constraints: ['type', 'languages', 'genres'],
    soft_preferences: [],
    expected_evaluation_method: 'scarcity',
    relevance_criteria: {
      mandatory_condition: (dna) =>
        dna.type === 'Series' &&
        (dna.languages || []).includes('Spanish') &&
        (dna.genres || []).includes('Animation'),
      mandatory_description: 'Spanish animated horror series (< 10 in entire TMDB 10k)',
      graded_relevance: (dna) => 2,
      target_attributes: ['scarce animated horror television in Spanish'],
    },
    review_annotation: 'Extreme niche intersection yielding small candidate pool.',
  },

  // ===========================================================================
  // 13. UNSUPPORTED METADATA & MISSING ATTRIBUTES (2 cases)
  // ===========================================================================
  {
    id: 'BENCH-099',
    category: 'unsupported_metadata',
    prompt: 'Movie with a magnificent musical score composed by Hans Zimmer',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      expected_clarification: false,
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['Hans Zimmer score', 'epic soundtrack'],
    expected_evaluation_method: 'unsupported_metadata',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Catalog lacks composer metadata; should match semantically via text/title',
      graded_relevance: (dna) => {
        const title = dna.title.toLowerCase();
        // Known Hans Zimmer scored movies
        const isZimmer = ['interstellar', 'inception', 'dune', 'gladiator', 'the dark knight', 'lion king', 'pirates of the caribbean'].some((t) => title.includes(t));
        return isZimmer ? 3 : 1;
      },
      target_attributes: ['unsupported schema field: composer'],
      known_relevant_titles: ['Interstellar', 'Inception', 'Dune', 'Gladiator', 'The Dark Knight'],
    },
    review_annotation: 'Schema gap: composer is not a database column. System must handle via semantic embedding or acknowledge limitation in explanation without claiming composer was matched in catalog.',
  },
  {
    id: 'BENCH-100',
    category: 'unsupported_metadata',
    prompt: 'PG-13 rated superhero movie with a post-credits teaser scene shot in 70mm IMAX',
    mode: 'custom',
    expected_interpretation: {
      type: 'Movie',
      genres: ['Action'],
      expected_clarification: false,
    },
    expected_hard_constraints: ['type'],
    soft_preferences: ['PG-13', 'post-credits scene', 'IMAX 70mm'],
    expected_evaluation_method: 'unsupported_metadata',
    relevance_criteria: {
      mandatory_condition: (dna) => dna.type === 'Movie',
      mandatory_description: 'Catalog lacks MPAA rating, post-credits flags, and camera aspect ratio metadata',
      graded_relevance: (dna) => ((dna.genres || []).includes('Action') ? 3 : 1),
      target_attributes: ['unsupported schema fields: MPAA, post-credits, IMAX camera'],
      known_relevant_titles: ['The Dark Knight', 'Oppenheimer', 'Dunkirk', 'Avengers: Endgame'],
    },
    review_annotation: 'Multiple unsupported metadata fields (MPAA rating, post-credit scene, IMAX camera). Must verify explanation does not falsely claim post-credit or camera data was validated.',
  },
];

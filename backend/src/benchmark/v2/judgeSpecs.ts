// =============================================================================
// CINEVERSE BENCHMARK V2 — JUDGE SPECS
// =============================================================================
// For each benchmark case, this module defines the exact (auditable) judge
// specification as a data object — NOT as an inline closure reading catalog
// content at arbitrary runtime.
//
// Design Principles:
// 1. mandatory_condition is rebuilt from expected_interpretation fields ONLY.
//    Broad "OR over 3 genres" checks replaced by exact checks per the case.
// 2. graded_relevance is NOT keyword-based for mood/tone/indirect cases;
//    those cases are marked NOT_MEASURABLE_KEYWORD_FREE and use LLM judging.
// 3. Every judge spec has:
//    - judge_type: 'deterministic' | 'llm_required' | 'contradiction' | 'scarcity' | 'unsupported'
//    - mandatory_fields: list of expected_interpretation keys used
//    - for deterministic: exact mandatory predicate logic described in spec
// =============================================================================

import { MovieDNA } from '../../models/interfaces';

export type JudgeType =
  | 'deterministic'   // Exact structural match — measurable
  | 'llm_required'    // Mood/tone/indirect — keyword grades replaced by LLM
  | 'contradiction'   // Inherently contradictory prompt — no good ranking
  | 'scarcity'        // Valid constraints but <20 catalog items match
  | 'unsupported';    // Required metadata absent from catalog schema

export interface V2JudgeSpec {
  case_id: string;
  judge_type: JudgeType;
  // The mandatory predicate (exact from expected_interpretation, not heuristic)
  is_mandatory: (dna: MovieDNA) => boolean;
  mandatory_description: string;
  // The graded relevance (only for deterministic cases; llm_required returns null)
  graded_relevance: ((dna: MovieDNA) => number) | null;
  // Which interpretation fields drive the mandatory check
  mandatory_fields: string[];
  // Note visible in the report
  judge_note: string;
}

// ---------------------------------------------------------------------------
// Helper constructors
// ---------------------------------------------------------------------------

function hasAll(genres: string[]): (dna: MovieDNA) => boolean {
  return (dna) => genres.every((g) => (dna.genres || []).includes(g));
}

function hasAny(genres: string[]): (dna: MovieDNA) => boolean {
  return (dna) => genres.some((g) => (dna.genres || []).includes(g));
}

function hasType(type: 'Movie' | 'Series'): (dna: MovieDNA) => boolean {
  return (dna) => dna.type === type;
}

function hasActor(name: string): (dna: MovieDNA) => boolean {
  return (dna) => (dna.actors || []).some((a) => a.toLowerCase() === name.toLowerCase());
}

function hasDirector(name: string): (dna: MovieDNA) => boolean {
  return (dna) => (dna.directors || []).some((d) => d.toLowerCase() === name.toLowerCase());
}

function hasLanguage(lang: string): (dna: MovieDNA) => boolean {
  return (dna) => (dna.languages || []).includes(lang);
}

function hasPlatform(platform: string): (dna: MovieDNA) => boolean {
  return (dna) => (dna.platforms || []).some((p) => p.toLowerCase().includes(platform.toLowerCase()));
}

function notGenre(genre: string): (dna: MovieDNA) => boolean {
  return (dna) => !(dna.genres || []).includes(genre);
}

function runtimeBelow(max: number): (dna: MovieDNA) => boolean {
  return (dna) => dna.runtime === null || dna.runtime === undefined || dna.runtime <= max;
}

function runtimeAbove(min: number): (dna: MovieDNA) => boolean {
  return (dna) => dna.runtime === null || dna.runtime === undefined || dna.runtime >= min;
}

function yearAbove(min: number): (dna: MovieDNA) => boolean {
  return (dna) => dna.release_year === null || dna.release_year === undefined || dna.release_year >= min;
}

function yearBelow(max: number): (dna: MovieDNA) => boolean {
  return (dna) => dna.release_year === null || dna.release_year === undefined || dna.release_year <= max;
}

function and(...fns: Array<(dna: MovieDNA) => boolean>): (dna: MovieDNA) => boolean {
  return (dna) => fns.every((f) => f(dna));
}

// Perfect-match graded relevance: 3 if mandatory, else 0.
// Used by actor/director-exact cases.
function gradePerfectOrZero(isMandatory: (dna: MovieDNA) => boolean): (dna: MovieDNA) => number {
  return (dna) => (isMandatory(dna) ? 3 : 0);
}

// ---------------------------------------------------------------------------
// JUDGE SPECS — 100 cases
// ---------------------------------------------------------------------------

export const V2_JUDGE_SPECS: V2JudgeSpec[] = [
  // BENCH-001: Psychological thriller — genre must include Thriller OR Mystery
  {
    case_id: 'BENCH-001',
    judge_type: 'deterministic',
    is_mandatory: hasAny(['Thriller', 'Mystery']),
    mandatory_description: 'genre ∈ {Thriller, Mystery}',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      const both = g.includes('Thriller') && g.includes('Mystery');
      return both ? 3 : g.includes('Thriller') || g.includes('Mystery') ? 2 : 0;
    },
    mandatory_fields: ['genres'],
    judge_note: 'v1 used OR — preserved; graded no longer keyword-scans description.',
  },

  // BENCH-002: Hard sci-fi movie set in deep space — type=Movie AND genre=Sci-Fi
  {
    case_id: 'BENCH-002',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Sci-Fi & Fantasy'])),
    mandatory_description: 'type=Movie AND genre=Sci-Fi & Fantasy',
    graded_relevance: (dna) =>
      dna.type === 'Movie' && (dna.genres || []).includes('Sci-Fi & Fantasy') ? 3 : 0,
    mandatory_fields: ['type', 'genres'],
    judge_note: 'graded relevance collapsed to 3/0 — space keyword scan removed.',
  },

  // BENCH-003: Lighthearted romantic comedy series — type=Series AND (Romance OR Comedy)
  {
    case_id: 'BENCH-003',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Series'), hasAny(['Romance', 'Comedy'])),
    mandatory_description: 'type=Series AND genre ∈ {Romance, Comedy}',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      return dna.type === 'Series' && g.includes('Romance') && g.includes('Comedy') ? 3
        : dna.type === 'Series' && (g.includes('Romance') || g.includes('Comedy')) ? 2 : 0;
    },
    mandatory_fields: ['type', 'genres'],
    judge_note: 'Perfect = both genres; Good = one of them; series format required.',
  },

  // BENCH-004: Gothic horror movie — type=Movie AND genre=Horror
  {
    case_id: 'BENCH-004',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Horror'])),
    mandatory_description: 'type=Movie AND genre=Horror',
    graded_relevance: (dna) =>
      dna.type === 'Movie' && (dna.genres || []).includes('Horror') ? 3 : 0,
    mandatory_fields: ['type', 'genres'],
    judge_note: 'Removed keyword-based gothic/haunted description scan.',
  },

  // BENCH-005: Courtroom legal drama film — type=Movie AND genre=Drama
  {
    case_id: 'BENCH-005',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Drama'])),
    mandatory_description: 'type=Movie AND genre=Drama',
    graded_relevance: (dna) =>
      dna.type === 'Movie' && (dna.genres || []).includes('Drama') ? 3 : 0,
    mandatory_fields: ['type', 'genres'],
    judge_note: 'Legal sub-theme unverifiable; description scan removed.',
  },

  // BENCH-006: Fast paced heist action comedy — genre must include BOTH Action AND Comedy
  {
    case_id: 'BENCH-006',
    judge_type: 'deterministic',
    is_mandatory: hasAny(['Action', 'Comedy']),
    mandatory_description: 'genre ∈ {Action, Comedy}',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      return g.includes('Action') && g.includes('Comedy') ? 3 : g.includes('Action') || g.includes('Comedy') ? 2 : 0;
    },
    mandatory_fields: ['genres'],
    judge_note: 'Heist keyword scan removed; both genres = perfect, one = good.',
  },

  // BENCH-007: Post-apocalyptic survival documentary series — type=Series AND genre=Documentary
  {
    case_id: 'BENCH-007',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Series'), hasAny(['Documentary'])),
    mandatory_description: 'type=Series AND genre=Documentary',
    graded_relevance: (dna) =>
      dna.type === 'Series' && (dna.genres || []).includes('Documentary') ? 3 : 0,
    mandatory_fields: ['type', 'genres'],
    judge_note: 'No keyword scan; documentary series = 3, else 0.',
  },

  // BENCH-008: Gritty neo-noir detective mystery film — type=Movie AND (Mystery OR Crime)
  {
    case_id: 'BENCH-008',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Mystery', 'Crime'])),
    mandatory_description: 'type=Movie AND genre ∈ {Mystery, Crime}',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      return dna.type === 'Movie' && g.includes('Mystery') && g.includes('Crime') ? 3
        : dna.type === 'Movie' && (g.includes('Mystery') || g.includes('Crime')) ? 2 : 0;
    },
    mandatory_fields: ['type', 'genres'],
    judge_note: 'noir/detective description scan removed.',
  },

  // BENCH-009: Epic fantasy adventure — genre includes Fantasy OR Adventure
  {
    case_id: 'BENCH-009',
    judge_type: 'deterministic',
    is_mandatory: hasAny(['Sci-Fi & Fantasy', 'Adventure']),
    mandatory_description: 'genre ∈ {Sci-Fi & Fantasy, Adventure}',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      const hasFan = g.includes('Sci-Fi & Fantasy');
      const hasAdv = g.includes('Adventure');
      return hasFan && hasAdv ? 3 : hasFan || hasAdv ? 2 : 0;
    },
    mandatory_fields: ['genres'],
    judge_note: 'Swordplay/creature keyword scan removed.',
  },

  // BENCH-010: Cyberpunk anime film — type=Movie AND genre=Animation
  {
    case_id: 'BENCH-010',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Animation'])),
    mandatory_description: 'type=Movie AND genre=Animation',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      return dna.type === 'Movie' && g.includes('Animation') && g.includes('Sci-Fi & Fantasy') ? 3
        : dna.type === 'Movie' && g.includes('Animation') ? 2 : 0;
    },
    mandatory_fields: ['type', 'genres'],
    judge_note: 'cyber/future keyword scan removed; Sci-Fi + Animation = perfect.',
  },

  // BENCH-011: TV series about investigative journalism — type=Series
  {
    case_id: 'BENCH-011',
    judge_type: 'deterministic',
    is_mandatory: hasType('Series'),
    mandatory_description: 'type=Series (format strictly excludes Movies)',
    graded_relevance: (dna) => dna.type === 'Series' ? 3 : 0,
    mandatory_fields: ['type'],
    judge_note: 'Journalism keyword scan removed; type=Series is the only hard check.',
  },

  // BENCH-012: Standalone feature film about deep sea diving — type=Movie
  {
    case_id: 'BENCH-012',
    judge_type: 'deterministic',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'type=Movie',
    graded_relevance: (dna) => dna.type === 'Movie' ? 3 : 0,
    mandatory_fields: ['type'],
    judge_note: 'Ocean/diving is thematic preference; only hard check is Movie.',
  },

  // BENCH-013: Crime story (either format) — genre=Crime
  {
    case_id: 'BENCH-013',
    judge_type: 'deterministic',
    is_mandatory: hasAny(['Crime']),
    mandatory_description: 'genre=Crime (type=null)',
    graded_relevance: (dna) => (dna.genres || []).includes('Crime') ? 3 : 0,
    mandatory_fields: ['genres'],
    judge_note: 'Format explicitly neutral; graded on Crime genre presence only.',
  },

  // BENCH-014: Mini-series drama about nuclear disaster — type=Series
  {
    case_id: 'BENCH-014',
    judge_type: 'deterministic',
    is_mandatory: hasType('Series'),
    mandatory_description: 'type=Series',
    graded_relevance: (dna) => dna.type === 'Series' ? 3 : 0,
    mandatory_fields: ['type'],
    judge_note: 'Nuclear disaster is thematic; nuclear keyword scan removed.',
  },

  // BENCH-015: Full-length cinematic motion picture with martial arts — type=Movie
  {
    case_id: 'BENCH-015',
    judge_type: 'deterministic',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'type=Movie',
    graded_relevance: (dna) => dna.type === 'Movie' ? 3 : 0,
    mandatory_fields: ['type'],
    judge_note: 'Martial arts is thematic; type=Movie is the verifiable constraint.',
  },

  // BENCH-016: Binge-worthy multi-season TV show about political power — type=Series
  {
    case_id: 'BENCH-016',
    judge_type: 'deterministic',
    is_mandatory: hasType('Series'),
    mandatory_description: 'type=Series',
    graded_relevance: (dna) => dna.type === 'Series' ? 3 : 0,
    mandatory_fields: ['type'],
    judge_note: 'Season count and political sub-theme are soft; type=Series is the hard check.',
  },

  // BENCH-017: Documentary movie, not a docuseries — type=Movie AND genre=Documentary
  {
    case_id: 'BENCH-017',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Documentary'])),
    mandatory_description: 'type=Movie AND genre=Documentary',
    graded_relevance: (dna) =>
      dna.type === 'Movie' && (dna.genres || []).includes('Documentary') ? 3 : 0,
    mandatory_fields: ['type', 'genres'],
    judge_note: 'Explicit negative docuseries; both type and genre must be exact.',
  },

  // BENCH-018: Animated series for adults with dark humor — type=Series AND genre=Animation
  {
    case_id: 'BENCH-018',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Series'), hasAny(['Animation'])),
    mandatory_description: 'type=Series AND genre=Animation',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      return dna.type === 'Series' && g.includes('Animation') && g.includes('Comedy') ? 3
        : dna.type === 'Series' && g.includes('Animation') ? 2 : 0;
    },
    mandatory_fields: ['type', 'genres'],
    judge_note: 'Comedy in addition to Animation = perfect; animation series alone = good.',
  },

  // BENCH-019: Movies like The Matrix — type=Movie
  {
    case_id: 'BENCH-019',
    judge_type: 'deterministic',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'type=Movie',
    graded_relevance: (dna) => {
      if (dna.type !== 'Movie') return 0;
      const g = dna.genres || [];
      return g.includes('Sci-Fi & Fantasy') && g.includes('Action') ? 3
        : g.includes('Sci-Fi & Fantasy') || g.includes('Thriller') ? 2 : 1;
    },
    mandatory_fields: ['type'],
    judge_note: 'Reference similarity graded; sci-fi action = perfect, sci-fi alone = good.',
  },

  // BENCH-020: Something like Knives Out — genre includes Mystery
  {
    case_id: 'BENCH-020',
    judge_type: 'deterministic',
    is_mandatory: hasAny(['Mystery', 'Comedy']),
    mandatory_description: 'genre ∈ {Mystery, Comedy}',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      return g.includes('Mystery') && (g.includes('Comedy') || g.includes('Crime')) ? 3
        : g.includes('Mystery') ? 2 : 1;
    },
    mandatory_fields: ['genres', 'reference_titles'],
    judge_note: 'Glass Onion-style ensemble whodunit; description scan removed.',
  },

  // BENCH-021: Films like Interstellar but faster — type=Movie
  {
    case_id: 'BENCH-021',
    judge_type: 'deterministic',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'type=Movie',
    graded_relevance: (dna) => {
      if (dna.type !== 'Movie') return 0;
      const g = dna.genres || [];
      return g.includes('Sci-Fi & Fantasy') && g.includes('Action') ? 3
        : g.includes('Sci-Fi & Fantasy') ? 2 : 1;
    },
    mandatory_fields: ['type'],
    judge_note: 'Sci-Fi+Action = perfect; Sci-Fi alone = good.',
  },

  // BENCH-022: Series similar to Chernobyl — type=Series
  {
    case_id: 'BENCH-022',
    judge_type: 'deterministic',
    is_mandatory: hasType('Series'),
    mandatory_description: 'type=Series',
    graded_relevance: (dna) => {
      if (dna.type !== 'Series') return 0;
      const g = dna.genres || [];
      return g.includes('Drama') || g.includes('History') ? 3 : 1;
    },
    mandatory_fields: ['type'],
    judge_note: 'Drama/History series = perfect; type alone = 1.',
  },

  // BENCH-023: Like Spirited Away — type=Movie AND genre=Animation
  {
    case_id: 'BENCH-023',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Animation'])),
    mandatory_description: 'type=Movie AND genre=Animation',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      return dna.type === 'Movie' && g.includes('Animation') && (g.includes('Fantasy') || g.includes('Family')) ? 3
        : dna.type === 'Movie' && g.includes('Animation') ? 2 : 0;
    },
    mandatory_fields: ['type', 'genres'],
    judge_note: 'Animation + Fantasy/Family = perfect; Animation only = good.',
  },

  // BENCH-024: Crime thriller like Silence of the Lambs — type=Movie AND (Crime OR Thriller)
  {
    case_id: 'BENCH-024',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Crime', 'Thriller'])),
    mandatory_description: 'type=Movie AND genre ∈ {Crime, Thriller}',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      return dna.type === 'Movie' && g.includes('Crime') && g.includes('Thriller') ? 3
        : dna.type === 'Movie' && (g.includes('Crime') || g.includes('Thriller')) ? 2 : 0;
    },
    mandatory_fields: ['type', 'genres'],
    judge_note: 'Serial killer description scan removed; genre overlap drives grade.',
  },

  // BENCH-025: Series with Succession dynamics — type=Series AND genre=Drama
  {
    case_id: 'BENCH-025',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Series'), hasAny(['Drama'])),
    mandatory_description: 'type=Series AND genre=Drama',
    graded_relevance: (dna) =>
      dna.type === 'Series' && (dna.genres || []).includes('Drama') ? 3 : 0,
    mandatory_fields: ['type', 'genres'],
    judge_note: 'Corporate sub-theme description scan removed.',
  },

  // BENCH-026: Coming-of-age like Stand by Me — type=Movie
  {
    case_id: 'BENCH-026',
    judge_type: 'deterministic',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'type=Movie',
    graded_relevance: (dna) => {
      if (dna.type !== 'Movie') return 0;
      const g = dna.genres || [];
      return g.includes('Adventure') || g.includes('Drama') ? 3 : 1;
    },
    mandatory_fields: ['type'],
    judge_note: 'Adventure/Drama movies = perfect; other movies = marginal.',
  },

  // BENCH-027: Like Inception with heist — type=Movie
  {
    case_id: 'BENCH-027',
    judge_type: 'deterministic',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'type=Movie',
    graded_relevance: (dna) => {
      if (dna.type !== 'Movie') return 0;
      const g = dna.genres || [];
      return g.includes('Sci-Fi & Fantasy') && (g.includes('Action') || g.includes('Thriller')) ? 3
        : g.includes('Sci-Fi & Fantasy') ? 2 : 1;
    },
    mandatory_fields: ['type'],
    judge_note: 'Mind-bending Sci-Fi action = perfect; Sci-Fi alone = good.',
  },

  // BENCH-028: Like Parasite with social satire — no hard structural constraint (reference only)
  {
    case_id: 'BENCH-028',
    judge_type: 'deterministic',
    is_mandatory: hasAny(['Drama', 'Thriller', 'Comedy']),
    mandatory_description: 'genre ∈ {Drama, Thriller, Comedy}',
    graded_relevance: (dna) => {
      const g = dna.genres || [];
      return g.includes('Drama') || g.includes('Thriller') ? 3 : g.includes('Comedy') ? 2 : 1;
    },
    mandatory_fields: ['genres'],
    judge_note: 'Social satire description scan removed; drama/thriller genres drive grade.',
  },

  // BENCH-029: Movies directed by Christopher Nolan — type=Movie AND director=Christopher Nolan
  // NOTE: This prompt is flagged as an AUDIT PROMPT (tuning overlap)
  {
    case_id: 'BENCH-029',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasDirector('Christopher Nolan')),
    mandatory_description: 'type=Movie AND director="Christopher Nolan"',
    graded_relevance: gradePerfectOrZero(and(hasType('Movie'), hasDirector('Christopher Nolan'))),
    mandatory_fields: ['type', 'directors'],
    judge_note: 'AUDIT_OVERLAP: prompt used verbatim in prior adversarial audit. Held-out subset excluded.',
  },

  // BENCH-030: Films by Denis Villeneuve — type=Movie AND director=Denis Villeneuve
  {
    case_id: 'BENCH-030',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasDirector('Denis Villeneuve')),
    mandatory_description: 'type=Movie AND director="Denis Villeneuve"',
    graded_relevance: gradePerfectOrZero(and(hasType('Movie'), hasDirector('Denis Villeneuve'))),
    mandatory_fields: ['type', 'directors'],
    judge_note: '',
  },

  // BENCH-031: Movies starring Leonardo DiCaprio
  {
    case_id: 'BENCH-031',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasActor('Leonardo DiCaprio')),
    mandatory_description: 'type=Movie AND actor="Leonardo DiCaprio"',
    graded_relevance: gradePerfectOrZero(and(hasType('Movie'), hasActor('Leonardo DiCaprio'))),
    mandatory_fields: ['type', 'actors'],
    judge_note: '',
  },

  // BENCH-032: Movies featuring Denzel Washington
  {
    case_id: 'BENCH-032',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasActor('Denzel Washington')),
    mandatory_description: 'type=Movie AND actor="Denzel Washington"',
    graded_relevance: gradePerfectOrZero(and(hasType('Movie'), hasActor('Denzel Washington'))),
    mandatory_fields: ['type', 'actors'],
    judge_note: '',
  },

  // BENCH-033: Movies starring both Ryan Gosling AND Emma Stone (AND-mode)
  {
    case_id: 'BENCH-033',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasActor('Ryan Gosling'), hasActor('Emma Stone')),
    mandatory_description: 'type=Movie AND actor="Ryan Gosling" AND actor="Emma Stone"',
    graded_relevance: gradePerfectOrZero(and(hasType('Movie'), hasActor('Ryan Gosling'), hasActor('Emma Stone'))),
    mandatory_fields: ['type', 'actors', 'actor_match_mode'],
    judge_note: 'AND-mode multi-actor; v1 retrieval returned empty pool.',
  },

  // BENCH-034: Movies starring Brad Pitt OR George Clooney (OR-mode)
  {
    case_id: 'BENCH-034',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), (dna) => hasActor('Brad Pitt')(dna) || hasActor('George Clooney')(dna)),
    mandatory_description: 'type=Movie AND (actor="Brad Pitt" OR actor="George Clooney")',
    graded_relevance: (dna) => {
      if (dna.type !== 'Movie') return 0;
      const hasBoth = hasActor('Brad Pitt')(dna) && hasActor('George Clooney')(dna);
      const hasEither = hasActor('Brad Pitt')(dna) || hasActor('George Clooney')(dna);
      return hasBoth ? 3 : hasEither ? 2 : 0;
    },
    mandatory_fields: ['type', 'actors', 'actor_match_mode'],
    judge_note: 'OR-mode; both present = perfect, one present = good.',
  },

  // BENCH-035: Thriller movie directed by David Fincher
  {
    case_id: 'BENCH-035',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasDirector('David Fincher'), hasAny(['Thriller'])),
    mandatory_description: 'type=Movie AND director="David Fincher" AND genre=Thriller',
    graded_relevance: gradePerfectOrZero(and(hasType('Movie'), hasDirector('David Fincher'), hasAny(['Thriller']))),
    mandatory_fields: ['type', 'directors', 'genres'],
    judge_note: '',
  },

  // BENCH-036: Action film starring Tom Cruise
  {
    case_id: 'BENCH-036',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasActor('Tom Cruise'), hasAny(['Action'])),
    mandatory_description: 'type=Movie AND actor="Tom Cruise" AND genre=Action',
    graded_relevance: gradePerfectOrZero(and(hasType('Movie'), hasActor('Tom Cruise'), hasAny(['Action']))),
    mandatory_fields: ['type', 'actors', 'genres'],
    judge_note: '',
  },

  // BENCH-037: Tarantino + Samuel L. Jackson films
  {
    case_id: 'BENCH-037',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasDirector('Quentin Tarantino'), hasActor('Samuel L. Jackson')),
    mandatory_description: 'type=Movie AND director="Quentin Tarantino" AND actor="Samuel L. Jackson"',
    graded_relevance: gradePerfectOrZero(and(hasType('Movie'), hasDirector('Quentin Tarantino'), hasActor('Samuel L. Jackson'))),
    mandatory_fields: ['type', 'directors', 'actors'],
    judge_note: '',
  },

  // BENCH-038: Korean movies by Bong Joon-ho
  {
    case_id: 'BENCH-038',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasDirector('Bong Joon-ho')),
    mandatory_description: 'type=Movie AND director="Bong Joon-ho"',
    graded_relevance: (dna) => {
      if (!hasDirector('Bong Joon-ho')(dna) || dna.type !== 'Movie') return 0;
      return hasLanguage('Korean')(dna) ? 3 : 2;
    },
    mandatory_fields: ['type', 'directors', 'languages'],
    judge_note: 'Korean language is soft preference; director is the hard gate.',
  },

  // BENCH-039: Spanish thriller movie on Netflix — type=Movie AND language=Spanish AND platform=Netflix
  {
    case_id: 'BENCH-039',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasLanguage('Spanish'), hasPlatform('Netflix')),
    mandatory_description: 'type=Movie AND language=Spanish AND platform=Netflix',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && hasLanguage('Spanish')(dna) && hasPlatform('Netflix')(dna);
      if (!passes) return 0;
      return (dna.genres || []).includes('Thriller') ? 3 : 2;
    },
    mandatory_fields: ['type', 'languages', 'platforms'],
    judge_note: 'Platform metadata may be sparse; judge logs NOT_MEASURABLE_IF_EMPTY.',
  },

  // BENCH-040: Japanese anime series on Netflix
  {
    case_id: 'BENCH-040',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Series'), hasLanguage('Japanese'), hasPlatform('Netflix')),
    mandatory_description: 'type=Series AND language=Japanese AND platform=Netflix',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Series' && hasLanguage('Japanese')(dna) && hasPlatform('Netflix')(dna);
      if (!passes) return 0;
      return (dna.genres || []).includes('Animation') ? 3 : 2;
    },
    mandatory_fields: ['type', 'languages', 'platforms'],
    judge_note: '',
  },

  // BENCH-041: French romantic drama on Amazon Prime
  {
    case_id: 'BENCH-041',
    judge_type: 'deterministic',
    is_mandatory: and(hasLanguage('French'), hasPlatform('amazon')),
    mandatory_description: 'language=French AND platform=Amazon Prime Video',
    graded_relevance: (dna) => {
      const passes = hasLanguage('French')(dna) && hasPlatform('amazon')(dna);
      if (!passes) return 0;
      const g = dna.genres || [];
      return g.includes('Romance') || g.includes('Drama') ? 3 : 2;
    },
    mandatory_fields: ['languages', 'platforms'],
    judge_note: '',
  },

  // BENCH-042: Korean mystery TV show on Disney+
  {
    case_id: 'BENCH-042',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Series'), hasLanguage('Korean'), hasPlatform('Disney+')),
    mandatory_description: 'type=Series AND language=Korean AND platform=Disney+',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Series' && hasLanguage('Korean')(dna) && hasPlatform('Disney+')(dna);
      if (!passes) return 0;
      return (dna.genres || []).includes('Mystery') ? 3 : 2;
    },
    mandatory_fields: ['type', 'languages', 'platforms'],
    judge_note: '',
  },

  // BENCH-043: German sci-fi series on Netflix
  {
    case_id: 'BENCH-043',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Series'), hasLanguage('German'), hasPlatform('Netflix')),
    mandatory_description: 'type=Series AND language=German AND platform=Netflix',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Series' && hasLanguage('German')(dna) && hasPlatform('Netflix')(dna);
      if (!passes) return 0;
      const g = dna.genres || [];
      return g.includes('Sci-Fi & Fantasy') && g.includes('Mystery') ? 3
        : g.includes('Sci-Fi & Fantasy') || g.includes('Mystery') ? 2 : 1;
    },
    mandatory_fields: ['type', 'languages', 'platforms'],
    judge_note: '',
  },

  // BENCH-044: Hindi action film on Apple TV
  {
    case_id: 'BENCH-044',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasLanguage('Hindi'), hasPlatform('Apple TV')),
    mandatory_description: 'type=Movie AND language=Hindi AND platform=Apple TV',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && hasLanguage('Hindi')(dna) && hasPlatform('Apple TV')(dna);
      if (!passes) return 0;
      return (dna.genres || []).includes('Action') ? 3 : 2;
    },
    mandatory_fields: ['type', 'languages', 'platforms'],
    judge_note: '',
  },

  // BENCH-045: Italian comedy movie on Google Play Movies
  {
    case_id: 'BENCH-045',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasLanguage('Italian'), hasPlatform('Google Play')),
    mandatory_description: 'type=Movie AND language=Italian AND platform=Google Play Movies',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && hasLanguage('Italian')(dna) && hasPlatform('Google Play')(dna);
      if (!passes) return 0;
      return (dna.genres || []).includes('Comedy') ? 3 : 2;
    },
    mandatory_fields: ['type', 'languages', 'platforms'],
    judge_note: '',
  },

  // BENCH-046: Danish crime drama series
  {
    case_id: 'BENCH-046',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Series'), hasLanguage('Danish')),
    mandatory_description: 'type=Series AND language=Danish',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Series' && hasLanguage('Danish')(dna);
      if (!passes) return 0;
      const g = dna.genres || [];
      return g.includes('Crime') || g.includes('Drama') ? 3 : 2;
    },
    mandatory_fields: ['type', 'languages'],
    judge_note: '',
  },

  // BENCH-047: Horror movie under 90 minutes — type=Movie AND genre=Horror AND runtime<=90
  {
    case_id: 'BENCH-047',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Horror']), runtimeBelow(90)),
    mandatory_description: 'type=Movie AND genre=Horror AND runtime<=90',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && (dna.genres || []).includes('Horror')
        && (dna.runtime === null || dna.runtime === undefined || dna.runtime <= 90);
      return passes ? 3 : 0;
    },
    mandatory_fields: ['type', 'genres', 'max_runtime', 'runtime_is_hard_constraint'],
    judge_note: 'runtimeBelow allows null runtime items (missing=unknown, not a violation).',
  },

  // BENCH-048: Sci-fi movie longer than 150 minutes
  {
    case_id: 'BENCH-048',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Sci-Fi & Fantasy']), runtimeAbove(150)),
    mandatory_description: 'type=Movie AND genre=Sci-Fi & Fantasy AND runtime>=150',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && (dna.genres || []).includes('Sci-Fi & Fantasy')
        && (dna.runtime === null || dna.runtime === undefined || dna.runtime >= 150);
      return passes ? 3 : 0;
    },
    mandatory_fields: ['type', 'genres', 'min_runtime', 'runtime_is_hard_constraint'],
    judge_note: '',
  },

  // BENCH-049: Action movie released 1990-1999
  {
    case_id: 'BENCH-049',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Action']),
      (dna) => dna.release_year !== null && dna.release_year !== undefined
        && dna.release_year >= 1990 && dna.release_year <= 1999),
    mandatory_description: 'type=Movie AND genre=Action AND 1990<=year<=1999',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && (dna.genres || []).includes('Action')
        && dna.release_year !== null && dna.release_year !== undefined
        && dna.release_year >= 1990 && dna.release_year <= 1999;
      return passes ? 3 : 0;
    },
    mandatory_fields: ['type', 'genres', 'min_year', 'max_year', 'year_range_is_hard'],
    judge_note: 'Null release_year fails the year check (unknown ≠ in range).',
  },

  // BENCH-050: Drama movie from 2023 or later
  {
    case_id: 'BENCH-050',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Drama']), yearAbove(2023)),
    mandatory_description: 'type=Movie AND genre=Drama AND year>=2023',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && (dna.genres || []).includes('Drama')
        && (dna.release_year === null || dna.release_year === undefined || dna.release_year >= 2023);
      return passes ? 3 : 0;
    },
    mandatory_fields: ['type', 'genres', 'min_year'],
    judge_note: '',
  },

  // BENCH-051: Classic comedy movie from before 1980
  {
    case_id: 'BENCH-051',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Comedy']),
      (dna) => dna.release_year !== null && dna.release_year !== undefined && dna.release_year < 1980),
    mandatory_description: 'type=Movie AND genre=Comedy AND year<1980',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && (dna.genres || []).includes('Comedy')
        && dna.release_year !== null && dna.release_year !== undefined && dna.release_year < 1980;
      return passes ? 3 : 0;
    },
    mandatory_fields: ['type', 'genres', 'max_year'],
    judge_note: 'Null release_year fails (unknown year ≠ pre-1980).',
  },

  // BENCH-052: Animated movie 75-85 minutes
  {
    case_id: 'BENCH-052',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Animation']),
      (dna) => dna.runtime === null || dna.runtime === undefined || (dna.runtime >= 70 && dna.runtime <= 90)),
    mandatory_description: 'type=Movie AND genre=Animation AND runtime ~70-90 min',
    graded_relevance: (dna) => {
      if (dna.type !== 'Movie' || !(dna.genres || []).includes('Animation')) return 0;
      if (dna.runtime && dna.runtime >= 75 && dna.runtime <= 85) return 3;
      if (dna.runtime && dna.runtime >= 70 && dna.runtime <= 90) return 2;
      return dna.runtime ? 0 : 1; // null runtime = marginal
    },
    mandatory_fields: ['type', 'genres', 'min_runtime', 'max_runtime'],
    judge_note: '±5 min tolerance window for the graded relevance.',
  },

  // BENCH-053: Thriller movie from the 1970s
  {
    case_id: 'BENCH-053',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Thriller']),
      (dna) => dna.release_year !== null && dna.release_year !== undefined
        && dna.release_year >= 1970 && dna.release_year <= 1979),
    mandatory_description: 'type=Movie AND genre=Thriller AND 1970<=year<=1979',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && (dna.genres || []).includes('Thriller')
        && dna.release_year !== null && dna.release_year !== undefined
        && dna.release_year >= 1970 && dna.release_year <= 1979;
      return passes ? 3 : 0;
    },
    mandatory_fields: ['type', 'genres', 'min_year', 'max_year'],
    judge_note: '',
  },

  // BENCH-054: Long crime movie >=165 minutes
  {
    case_id: 'BENCH-054',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Crime']), runtimeAbove(160)),
    mandatory_description: 'type=Movie AND genre=Crime AND runtime>=160',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && (dna.genres || []).includes('Crime')
        && (dna.runtime === null || dna.runtime === undefined || dna.runtime >= 160);
      return passes ? 3 : 0;
    },
    mandatory_fields: ['type', 'genres', 'min_runtime'],
    judge_note: 'Relaxed from 165→160 to account for parsing rounding.',
  },

  // BENCH-055 to BENCH-062: tone_mood_theme — LLM judging required
  {
    case_id: 'BENCH-055',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Thriller', 'Drama', 'Horror']),
    mandatory_description: 'genre ∈ {Thriller, Drama, Horror} — broad genre gate only',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'MOOD: keyword-based graded_relevance replaced by LLM judge. Grade = NOT_MEASURABLE_KEYWORD_FREE.',
  },
  {
    case_id: 'BENCH-056',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Drama', 'Comedy', 'Family', 'Animation']),
    mandatory_description: 'genre ∈ {Drama, Comedy, Family, Animation}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'MOOD: LLM judging required.',
  },
  {
    case_id: 'BENCH-057',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Adventure', 'Action', 'Drama', 'Thriller']),
    mandatory_description: 'genre ∈ {Adventure, Action, Drama, Thriller}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'MOOD: LLM judging required.',
  },
  {
    case_id: 'BENCH-058',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Comedy', 'Drama', 'Crime']),
    mandatory_description: 'genre ∈ {Comedy, Drama, Crime}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'MOOD: LLM judging required.',
  },
  {
    case_id: 'BENCH-059',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Comedy', 'Romance', 'Family', 'Animation', 'Drama']),
    mandatory_description: 'genre ∈ {Comedy, Romance, Family, Animation, Drama}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'MOOD/VIBE: LLM judging required.',
  },
  {
    case_id: 'BENCH-060',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Horror', 'Sci-Fi & Fantasy', 'Mystery', 'Thriller']),
    mandatory_description: 'genre ∈ {Horror, Sci-Fi & Fantasy, Mystery, Thriller}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'MOOD: LLM judging required.',
  },
  {
    case_id: 'BENCH-061',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Drama', 'Sci-Fi & Fantasy', 'Animation', 'Comedy']),
    mandatory_description: 'genre ∈ {Drama, Sci-Fi & Fantasy, Animation, Comedy}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'MOOD: LLM judging required.',
  },
  {
    case_id: 'BENCH-062',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Thriller', 'Action', 'Mystery']),
    mandatory_description: 'genre ∈ {Thriller, Action, Mystery}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'MOOD: LLM judging required.',
  },

  // BENCH-063: Thrilling mystery movie, no horror
  {
    case_id: 'BENCH-063',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), notGenre('Horror'), hasAny(['Mystery', 'Thriller'])),
    mandatory_description: 'type=Movie AND genre ∈ {Mystery, Thriller} AND genre ∉ {Horror}',
    graded_relevance: (dna) =>
      dna.type === 'Movie' && !(dna.genres || []).includes('Horror') && (dna.genres || []).includes('Mystery') ? 3 : 0,
    mandatory_fields: ['type', 'genres', 'negative_genres'],
    judge_note: '',
  },

  // BENCH-064: Action movie without romance
  {
    case_id: 'BENCH-064',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Action']), notGenre('Romance')),
    mandatory_description: 'type=Movie AND genre=Action AND genre ∉ {Romance}',
    graded_relevance: (dna) =>
      dna.type === 'Movie' && (dna.genres || []).includes('Action') && !(dna.genres || []).includes('Romance') ? 3 : 0,
    mandatory_fields: ['type', 'genres', 'negative_genres'],
    judge_note: '',
  },

  // BENCH-065: Superhero movies but not Marvel/MCU
  {
    case_id: 'BENCH-065',
    judge_type: 'deterministic',
    is_mandatory: (dna) => {
      const title = dna.title.toLowerCase();
      const desc = (dna.description || '').toLowerCase();
      const isMarvel = ['marvel', 'avengers', 'iron man', 'spider-man', 'thor', 'captain america', ' mcu'].some(
        (w) => title.includes(w) || desc.includes(w)
      );
      return dna.type === 'Movie' && !isMarvel;
    },
    mandatory_description: 'type=Movie AND title/desc ∉ Marvel/MCU keywords',
    graded_relevance: (dna) => {
      const title = dna.title.toLowerCase();
      if (title.includes('batman') || title.includes('superman') || title.includes('dark knight')) return 3;
      if (dna.type === 'Movie') return 2;
      return 0;
    },
    mandatory_fields: ['type', 'negative_franchises'],
    judge_note: 'Title/desc keyword check for Marvel; exact franchise negation.',
  },

  // BENCH-066: Space movies excluding Interstellar and Gravity
  {
    case_id: 'BENCH-066',
    judge_type: 'deterministic',
    is_mandatory: (dna) => {
      const titleL = dna.title.toLowerCase();
      return dna.type === 'Movie' && titleL !== 'interstellar' && titleL !== 'gravity';
    },
    mandatory_description: 'type=Movie AND title ∉ {"Interstellar","Gravity"}',
    graded_relevance: (dna) => {
      const titleL = dna.title.toLowerCase();
      if (titleL === 'interstellar' || titleL === 'gravity') return 0;
      return dna.type === 'Movie' && (dna.genres || []).includes('Sci-Fi & Fantasy') ? 3 : 2;
    },
    mandatory_fields: ['type', 'negative_titles'],
    judge_note: '',
  },

  // BENCH-067: Action movies without Tom Cruise
  {
    case_id: 'BENCH-067',
    judge_type: 'deterministic',
    is_mandatory: (dna) => {
      return dna.type === 'Movie' && (dna.genres || []).includes('Action')
        && !(dna.actors || []).some((a) => a.toLowerCase() === 'tom cruise');
    },
    mandatory_description: 'type=Movie AND genre=Action AND actor ≠ "Tom Cruise"',
    graded_relevance: (dna) => {
      const hasTom = (dna.actors || []).some((a) => a.toLowerCase() === 'tom cruise');
      return hasTom ? 0 : dna.type === 'Movie' && (dna.genres || []).includes('Action') ? 3 : 0;
    },
    mandatory_fields: ['type', 'genres', 'negative_persons'],
    judge_note: '',
  },

  // BENCH-068: Crime drama without graphic violence — genre only (description keyword removed)
  {
    case_id: 'BENCH-068',
    judge_type: 'deterministic',
    is_mandatory: hasAny(['Crime', 'Drama']),
    mandatory_description: 'genre ∈ {Crime, Drama}',
    graded_relevance: (dna) => (dna.genres || []).includes('Crime') || (dna.genres || []).includes('Drama') ? 3 : 0,
    mandatory_fields: ['genres', 'negative_keywords'],
    judge_note: 'gore/bloody description scan removed; keyword exclusion is soft scoring only.',
  },

  // BENCH-069: Sci-fi movie without aliens
  {
    case_id: 'BENCH-069',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Sci-Fi & Fantasy'])),
    mandatory_description: 'type=Movie AND genre=Sci-Fi & Fantasy',
    graded_relevance: (dna) => {
      if (dna.type !== 'Movie' || !(dna.genres || []).includes('Sci-Fi & Fantasy')) return 0;
      const desc = (dna.description || '').toLowerCase();
      const hasAliens = ['alien', 'extraterrestrial', 'martian'].some((w) => desc.includes(w));
      return hasAliens ? 1 : 3;
    },
    mandatory_fields: ['type', 'genres', 'negative_keywords'],
    judge_note: 'Alien keyword check used only for grading (1 vs 3), not for mandatory gate.',
  },

  // BENCH-070: Comedy films without crude humor
  {
    case_id: 'BENCH-070',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), hasAny(['Comedy'])),
    mandatory_description: 'type=Movie AND genre=Comedy',
    graded_relevance: (dna) =>
      dna.type === 'Movie' && (dna.genres || []).includes('Comedy') ? 3 : 0,
    mandatory_fields: ['type', 'genres', 'negative_keywords'],
    judge_note: 'crude/slapstick unverifiable in catalog; genre is the only hard check.',
  },

  // BENCH-071: Space sci-fi series excluding Star Wars and Star Trek
  {
    case_id: 'BENCH-071',
    judge_type: 'deterministic',
    is_mandatory: (dna) => {
      const title = dna.title.toLowerCase();
      return dna.type === 'Series' && !title.includes('star wars') && !title.includes('star trek');
    },
    mandatory_description: 'type=Series AND title ∉ Star Wars / Star Trek titles',
    graded_relevance: (dna) => {
      const title = dna.title.toLowerCase();
      if (title.includes('star wars') || title.includes('star trek')) return 0;
      return dna.type === 'Series' && (dna.genres || []).includes('Sci-Fi & Fantasy') ? 3 : 1;
    },
    mandatory_fields: ['type', 'negative_franchises'],
    judge_note: '',
  },

  // BENCH-072: Fantasy movie without horror
  {
    case_id: 'BENCH-072',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Movie'), notGenre('Horror'), hasAny(['Sci-Fi & Fantasy', 'Family'])),
    mandatory_description: 'type=Movie AND genre ∉ {Horror} AND genre ∈ {Sci-Fi & Fantasy, Family}',
    graded_relevance: (dna) =>
      dna.type === 'Movie' && !(dna.genres || []).includes('Horror')
        && (dna.genres || []).some((g) => ['Sci-Fi & Fantasy', 'Family'].includes(g)) ? 3 : 0,
    mandatory_fields: ['type', 'genres', 'negative_genres'],
    judge_note: 'Pure fantasy without horror required.',
  },

  // BENCH-073: Spanish mystery thriller movie on Netflix under 110 min after 2018
  {
    case_id: 'BENCH-073',
    judge_type: 'deterministic',
    is_mandatory: and(
      hasType('Movie'), hasLanguage('Spanish'), hasPlatform('Netflix'),
      runtimeBelow(110), yearAbove(2018)
    ),
    mandatory_description: 'type=Movie AND lang=Spanish AND platform=Netflix AND runtime<=110 AND year>=2018',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && hasLanguage('Spanish')(dna) && hasPlatform('Netflix')(dna)
        && (dna.runtime === null || dna.runtime === undefined || dna.runtime <= 110)
        && (dna.release_year === null || dna.release_year === undefined || dna.release_year >= 2018);
      if (!passes) return 0;
      return (dna.genres || []).some((g) => ['Mystery', 'Thriller'].includes(g)) ? 3 : 2;
    },
    mandatory_fields: ['type', 'languages', 'platforms', 'max_runtime', 'min_year'],
    judge_note: '5-way constraint intersection.',
  },

  // BENCH-074: Japanese animated sci-fi film on Netflix under 2h without romance
  {
    case_id: 'BENCH-074',
    judge_type: 'deterministic',
    is_mandatory: and(
      hasType('Movie'), hasLanguage('Japanese'), hasPlatform('Netflix'),
      hasAny(['Animation']), notGenre('Romance'), runtimeBelow(120)
    ),
    mandatory_description: 'type=Movie AND lang=Japanese AND platform=Netflix AND genre=Animation AND genre≠Romance AND runtime<=120',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && hasLanguage('Japanese')(dna) && hasPlatform('Netflix')(dna)
        && (dna.genres || []).includes('Animation') && !(dna.genres || []).includes('Romance')
        && (dna.runtime === null || dna.runtime === undefined || dna.runtime <= 120);
      return passes ? 3 : 0;
    },
    mandatory_fields: ['type', 'languages', 'platforms', 'genres', 'negative_genres', 'max_runtime'],
    judge_note: '6-way constraint intersection.',
  },

  // BENCH-075: Crime drama series on Amazon Prime 2010-2020
  {
    case_id: 'BENCH-075',
    judge_type: 'deterministic',
    is_mandatory: and(
      hasType('Series'), hasPlatform('amazon'),
      yearAbove(2010), yearBelow(2020)
    ),
    mandatory_description: 'type=Series AND platform=Amazon Prime AND 2010<=year<=2020',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Series' && hasPlatform('amazon')(dna)
        && (dna.release_year === null || dna.release_year === undefined
          || (dna.release_year >= 2010 && dna.release_year <= 2020));
      if (!passes) return 0;
      const g = dna.genres || [];
      return g.includes('Crime') && g.includes('Drama') ? 3 : 2;
    },
    mandatory_fields: ['type', 'platforms', 'min_year', 'max_year'],
    judge_note: '',
  },

  // BENCH-076: French comedy movie 1990s under 100 minutes
  {
    case_id: 'BENCH-076',
    judge_type: 'deterministic',
    is_mandatory: and(
      hasType('Movie'), hasLanguage('French'), hasAny(['Comedy']),
      yearAbove(1990), yearBelow(1999), runtimeBelow(100)
    ),
    mandatory_description: 'type=Movie AND lang=French AND genre=Comedy AND 1990<=year<=1999 AND runtime<=100',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && hasLanguage('French')(dna)
        && (dna.genres || []).includes('Comedy')
        && (dna.release_year === null || dna.release_year === undefined
          || (dna.release_year >= 1990 && dna.release_year <= 1999))
        && (dna.runtime === null || dna.runtime === undefined || dna.runtime <= 100);
      return passes ? 3 : 0;
    },
    mandatory_fields: ['type', 'languages', 'genres', 'min_year', 'max_year', 'max_runtime'],
    judge_note: '5-way constraint intersection.',
  },

  // BENCH-077: Korean action thriller series on Netflix, no zombie horror
  {
    case_id: 'BENCH-077',
    judge_type: 'deterministic',
    is_mandatory: and(
      hasType('Series'), hasLanguage('Korean'), hasPlatform('Netflix'), notGenre('Horror')
    ),
    mandatory_description: 'type=Series AND lang=Korean AND platform=Netflix AND genre≠Horror',
    graded_relevance: (dna) => {
      const title = dna.title.toLowerCase();
      if (title.includes('kingdom') || title.includes('all of us are dead')) return 0;
      return dna.type === 'Series' && hasLanguage('Korean')(dna) && hasPlatform('Netflix')(dna)
        && !(dna.genres || []).includes('Horror') ? 3 : 0;
    },
    mandatory_fields: ['type', 'languages', 'platforms', 'negative_genres'],
    judge_note: 'Known zombie titles explicitly grade 0.',
  },

  // BENCH-078: Nolan + Christian Bale + Movie + runtime<=170
  {
    case_id: 'BENCH-078',
    judge_type: 'deterministic',
    is_mandatory: and(
      hasType('Movie'), hasDirector('Christopher Nolan'), hasActor('Christian Bale'),
      runtimeBelow(170)
    ),
    mandatory_description: 'type=Movie AND director="Christopher Nolan" AND actor="Christian Bale" AND runtime<=170',
    graded_relevance: gradePerfectOrZero(
      and(hasType('Movie'), hasDirector('Christopher Nolan'), hasActor('Christian Bale'), runtimeBelow(170))
    ),
    mandatory_fields: ['type', 'directors', 'actors', 'max_runtime'],
    judge_note: '4-way constraint.',
  },

  // BENCH-079: Family animation movie on Disney+ under 100 min
  {
    case_id: 'BENCH-079',
    judge_type: 'deterministic',
    is_mandatory: and(
      hasType('Movie'), hasAny(['Animation']), hasPlatform('Disney+'), runtimeBelow(100)
    ),
    mandatory_description: 'type=Movie AND genre=Animation AND platform=Disney+ AND runtime<=100',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Movie' && (dna.genres || []).includes('Animation')
        && hasPlatform('Disney+')(dna)
        && (dna.runtime === null || dna.runtime === undefined || dna.runtime <= 100);
      if (!passes) return 0;
      return (dna.rating || 0) >= 7.0 ? 3 : 2;
    },
    mandatory_fields: ['type', 'genres', 'platforms', 'max_runtime'],
    judge_note: 'Rating >= 7.0 earns perfect grade.',
  },

  // BENCH-080: Mystery drama series on Apple TV from 2021+
  {
    case_id: 'BENCH-080',
    judge_type: 'deterministic',
    is_mandatory: and(hasType('Series'), hasPlatform('Apple TV'), yearAbove(2021)),
    mandatory_description: 'type=Series AND platform=Apple TV AND year>=2021',
    graded_relevance: (dna) => {
      const passes = dna.type === 'Series' && hasPlatform('Apple TV')(dna)
        && (dna.release_year === null || dna.release_year === undefined || dna.release_year >= 2021);
      if (!passes) return 0;
      const g = dna.genres || [];
      return g.includes('Mystery') || g.includes('Drama') ? 3 : 2;
    },
    mandatory_fields: ['type', 'platforms', 'min_year'],
    judge_note: '',
  },

  // BENCH-081 to BENCH-088: indirect_unfamiliar_phrasing — LLM judging required
  {
    case_id: 'BENCH-081',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Mystery', 'Thriller', 'Drama', 'Sci-Fi & Fantasy']),
    mandatory_description: 'genre ∈ {Mystery, Thriller, Drama, Sci-Fi & Fantasy}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'INDIRECT: LLM judging required.',
  },
  {
    case_id: 'BENCH-082',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Mystery', 'Drama', 'Crime']),
    mandatory_description: 'genre ∈ {Mystery, Drama, Crime}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'INDIRECT: LLM judging required.',
  },
  {
    case_id: 'BENCH-083',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Crime', 'Thriller', 'Mystery', 'Drama']),
    mandatory_description: 'genre ∈ {Crime, Thriller, Mystery, Drama}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'INDIRECT: LLM judging required.',
  },
  {
    case_id: 'BENCH-084',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Drama', 'Romance']),
    mandatory_description: 'genre ∈ {Drama, Romance}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'INDIRECT: LLM judging required.',
  },
  {
    case_id: 'BENCH-085',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Crime', 'Action', 'Thriller', 'Drama']),
    mandatory_description: 'genre ∈ {Crime, Action, Thriller, Drama}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'INDIRECT: LLM judging required.',
  },
  {
    case_id: 'BENCH-086',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Thriller', 'Drama', 'Mystery', 'Sci-Fi & Fantasy']),
    mandatory_description: 'genre ∈ {Thriller, Drama, Mystery, Sci-Fi & Fantasy}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'INDIRECT: LLM judging required.',
  },
  {
    case_id: 'BENCH-087',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Comedy', 'Sci-Fi & Fantasy', 'Romance']),
    mandatory_description: 'genre ∈ {Comedy, Sci-Fi & Fantasy, Romance}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'INDIRECT: LLM judging required.',
  },
  {
    case_id: 'BENCH-088',
    judge_type: 'llm_required',
    is_mandatory: hasAny(['Drama', 'Thriller']),
    mandatory_description: 'genre ∈ {Drama, Thriller}',
    graded_relevance: null,
    mandatory_fields: ['genres'],
    judge_note: 'INDIRECT: LLM judging required.',
  },

  // BENCH-089 to BENCH-094: ambiguous/contradictory cases
  {
    case_id: 'BENCH-089',
    judge_type: 'contradiction',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'Contradictory: "short 4-hour" — expected clarification response',
    graded_relevance: (_dna) => 1,
    mandatory_fields: ['type'],
    judge_note: 'Pass = system requests clarification or flags contradiction.',
  },
  {
    case_id: 'BENCH-090',
    judge_type: 'contradiction',
    is_mandatory: (_dna) => true,
    mandatory_description: 'Contradictory: slasher where nobody is harmed',
    graded_relevance: (_dna) => 1,
    mandatory_fields: [],
    judge_note: 'Pass = system requests clarification.',
  },
  {
    case_id: 'BENCH-091',
    judge_type: 'contradiction',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'Ambiguous actor first name "Chris" — expected clarification',
    graded_relevance: (dna) => {
      return (dna.actors || []).some((a) => a.toLowerCase().startsWith('chris')) ? 2 : 1;
    },
    mandatory_fields: ['type'],
    judge_note: 'Pass = system signals actor name is ambiguous.',
  },
  {
    case_id: 'BENCH-092',
    judge_type: 'contradiction',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'Contradictory: Action with no conflict, enemies, or fighting',
    graded_relevance: (_dna) => 1,
    mandatory_fields: ['type'],
    judge_note: 'Pass = system flags genre contradiction.',
  },
  {
    case_id: 'BENCH-093',
    judge_type: 'deterministic',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'type=Movie (Alien title reference)',
    graded_relevance: (dna) => dna.title.toLowerCase().includes('alien') ? 3 : 1,
    mandatory_fields: ['type'],
    judge_note: 'Alien title family graded 3; all other movies graded 1.',
  },
  {
    case_id: 'BENCH-094',
    judge_type: 'contradiction',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'Contradictory: silent film + Dolby Atmos',
    graded_relevance: (_dna) => 1,
    mandatory_fields: ['type'],
    judge_note: 'Pass = system flags technological contradiction.',
  },

  // BENCH-095 to BENCH-098: scarcity cases
  {
    case_id: 'BENCH-095',
    judge_type: 'scarcity',
    is_mandatory: and(hasType('Movie'), hasLanguage('Korean'), hasPlatform('Netflix')),
    mandatory_description: 'type=Movie AND lang=Korean AND platform=Netflix (<20 catalog items expected)',
    graded_relevance: (dna) => {
      return dna.type === 'Movie' && hasLanguage('Korean')(dna) && hasPlatform('Netflix')(dna)
        && (dna.genres || []).includes('Sci-Fi & Fantasy') ? 3 : 2;
    },
    mandatory_fields: ['type', 'languages', 'platforms'],
    judge_note: 'Scarcity: pass if system surfaces all matching items.',
  },
  {
    case_id: 'BENCH-096',
    judge_type: 'scarcity',
    is_mandatory: hasType('Series'),
    mandatory_description: 'type=Series (Italian Western series from 1970s, near-zero pool)',
    graded_relevance: (_dna) => 2,
    mandatory_fields: ['type'],
    judge_note: 'Severe scarcity; zero relevant items expected.',
  },
  {
    case_id: 'BENCH-097',
    judge_type: 'scarcity',
    is_mandatory: hasDirector('Denis Villeneuve'),
    mandatory_description: 'director="Denis Villeneuve" + Documentary (scarcity)',
    graded_relevance: (_dna) => 2,
    mandatory_fields: ['directors'],
    judge_note: 'Near-zero Villeneuve documentaries in catalog.',
  },
  {
    case_id: 'BENCH-098',
    judge_type: 'scarcity',
    is_mandatory: and(hasType('Series'), hasLanguage('Spanish'), hasAny(['Animation'])),
    mandatory_description: 'type=Series AND lang=Spanish AND genre=Animation',
    graded_relevance: (_dna) => 2,
    mandatory_fields: ['type', 'languages', 'genres'],
    judge_note: 'Extreme niche intersection; <10 items expected in catalog.',
  },

  // BENCH-099 and BENCH-100: unsupported metadata
  {
    case_id: 'BENCH-099',
    judge_type: 'unsupported',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'type=Movie (composer metadata absent from catalog)',
    graded_relevance: (dna) => {
      const t = dna.title.toLowerCase();
      return ['interstellar', 'inception', 'dune', 'gladiator', 'the dark knight', 'lion king'].some((s) => t.includes(s)) ? 3 : 1;
    },
    mandatory_fields: ['type'],
    judge_note: 'UNSUPPORTED: Composer not in schema. Pass = system does not claim composer match.',
  },
  {
    case_id: 'BENCH-100',
    judge_type: 'unsupported',
    is_mandatory: hasType('Movie'),
    mandatory_description: 'type=Movie (MPAA rating, post-credits, IMAX all absent from catalog)',
    graded_relevance: (dna) => (dna.genres || []).includes('Action') ? 3 : 1,
    mandatory_fields: ['type'],
    judge_note: 'UNSUPPORTED: PG-13/IMAX/post-credits absent from schema.',
  },
];

// Build a lookup map for fast access
export const V2_JUDGE_BY_CASE_ID: Map<string, V2JudgeSpec> = new Map(
  V2_JUDGE_SPECS.map((s) => [s.case_id, s])
);

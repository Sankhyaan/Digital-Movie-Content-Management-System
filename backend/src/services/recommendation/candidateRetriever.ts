// =============================================================================
// CINEVERSE RECOMMENDATION ENGINE — CANDIDATE RETRIEVER
// =============================================================================
// High-performance candidate retrieval with in-memory MovieDNA caching.
// Enforces HARD structural constraints without over-filtering soft preferences.
// =============================================================================

import { pool } from '../../db/connection';
import { MovieDNA } from '../../models/interfaces';
import { UserPreferenceProfile } from '../../models/preferenceProfile';

export class CandidateRetriever {
  private static instance: CandidateRetriever | null = null;
  private dnaCache: MovieDNA[] = [];
  private dnaMap = new Map<number, MovieDNA>();
  private loaded = false;

  private constructor() {}

  public static getInstance(): CandidateRetriever {
    if (!CandidateRetriever.instance) {
      CandidateRetriever.instance = new CandidateRetriever();
    }
    return CandidateRetriever.instance;
  }

  /**
   * Initializes or refreshes the in-memory MovieDNA catalog cache.
   */
  public async init(): Promise<void> {
    if (this.loaded) return;

    try {
      const [rows]: any = await pool.query(
        `SELECT cd.content_id, c.poster_path, cd.dna_json
         FROM content_dna cd
         JOIN content c ON c.content_id = cd.content_id
         ORDER BY cd.content_id ASC`
      );

      this.dnaCache = [];
      this.dnaMap.clear();

      for (const row of rows) {
        let dna: any;
        if (typeof row.dna_json === 'string') {
          dna = JSON.parse(row.dna_json);
        } else {
          dna = { ...row.dna_json };
        }
        dna.poster_path = row.poster_path || null;
        this.dnaCache.push(dna as MovieDNA);
        this.dnaMap.set(dna.content_id, dna as MovieDNA);
      }

      this.loaded = true;
      console.log(`[CandidateRetriever] Cached ${this.dnaCache.length} MovieDNA records in memory.`);
    } catch (err) {
      console.error('[CandidateRetriever] Failed to load MovieDNA from database:', err);
    }
  }

  /**
   * Retrieves a single MovieDNA by content_id.
   */
  public getMovieDNA(contentId: number): MovieDNA | null {
    return this.dnaMap.get(contentId) || null;
  }

  /**
   * Finds a MovieDNA record by exact or case-insensitive title match.
   */
  public findMovieByName(title: string): MovieDNA | null {
    const clean = title.trim().toLowerCase();
    // 1. Exact match
    for (const item of this.dnaCache) {
      if (item.title.toLowerCase() === clean) {
        return item;
      }
    }
    // 2. Exact match with / without "The "
    for (const item of this.dnaCache) {
      if (item.title.toLowerCase() === `the ${clean}` || `the ${item.title.toLowerCase()}` === clean) {
        return item;
      }
    }
    // 3. Token-safe normalized match (never single-token collision)
    for (const item of this.dnaCache) {
      if (item.title.toLowerCase().replace(/[:\-,'’!?]/g, ' ').replace(/\s+/g, ' ').trim() === clean) {
        return item;
      }
    }
    return null;
  }

  /**
   * Returns all cached MovieDNA records.
   */
  public getAllDnas(): MovieDNA[] {
    return this.dnaCache;
  }

  /**
   * Retrieves candidate pool by applying HARD structural constraints.
   * Target candidate pool: 500–2,000 records.
   */
  public async retrieveCandidates(profile: UserPreferenceProfile): Promise<MovieDNA[]> {
    if (!this.loaded) {
      await this.init();
    }

    const typeConstraint = profile.type;
    // Platform and language constraints: active when the profile specifies them (regardless of source).
    // Previously constrained to source==='custom', but guided profiles may carry these too.
    const hasPlatformConstraint = profile.platforms.length > 0;
    const hasLanguageConstraint = profile.languages.length > 0;
    const hasNegativeGenres = profile.negative_genres && profile.negative_genres.length > 0;
    const hasHardRuntime = profile.runtime_is_hard_constraint;
    const hasHardYearRange = profile.year_range_is_hard;

    let candidates: MovieDNA[] = [];

    for (const item of this.dnaCache) {
      // 1. HARD CONSTRAINT: Type (Movie vs Series)
      if (typeConstraint && item.type !== typeConstraint) {
        continue;
      }

      // 2. HARD CONSTRAINT: Explicit Platform requirement in Custom Request (e.g. "on Netflix")
      if (hasPlatformConstraint) {
        const matchesPlatform = profile.platforms.some((p) => item.platforms.includes(p));
        if (!matchesPlatform) {
          continue;
        }
      }

      // 3. HARD CONSTRAINT: Explicit Language requirement in Custom Request (e.g. "Korean series")
      if (hasLanguageConstraint) {
        const matchesLang = profile.languages.some((l) => item.languages.includes(l));
        if (!matchesLang) {
          continue;
        }
      }

      // 4. HARD CONSTRAINT: Explicit Negative Genre Exclusion (e.g. "no horror", "without romance")
      if (hasNegativeGenres) {
        const hasExcluded = profile.negative_genres.some((ng) => item.genres.includes(ng));
        if (hasExcluded) {
          continue;
        }
      }

      // 4b. HARD CONSTRAINT: Explicit Negative Title Exclusion
      if (profile.negative_titles && profile.negative_titles.length > 0) {
        const matchesNegTitle = profile.negative_titles.some((nt) => {
          const ntLower = nt.toLowerCase();
          return item.title.toLowerCase() === ntLower || String(item.content_id) === nt;
        });
        if (matchesNegTitle) {
          continue;
        }
      }

      // 4c. HARD CONSTRAINT: Explicit Negative Person Exclusion (Actors & Directors)
      if (profile.negative_persons && profile.negative_persons.length > 0) {
        const matchesNegPerson = profile.negative_persons.some((np) => {
          const npLower = np.toLowerCase();
          const inActors = item.actors && item.actors.some((a) => a.toLowerCase() === npLower);
          const inDirectors = item.directors && item.directors.some((d) => d.toLowerCase() === npLower);
          return inActors || inDirectors;
        });
        if (matchesNegPerson) {
          continue;
        }
      }

      // 4d. HARD CONSTRAINT: Explicit Negative Franchise Exclusion
      if (profile.negative_franchises && profile.negative_franchises.length > 0) {
        const matchesNegFranchise = profile.negative_franchises.some((nf) => {
          const nfLower = nf.toLowerCase();
          const titleLower = item.title.toLowerCase();
          if (
            new RegExp(`\\b${nfLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(titleLower) ||
            titleLower.startsWith(`${nfLower}:`) ||
            titleLower.startsWith(`${nfLower} `) ||
            titleLower === nfLower ||
            titleLower === `the ${nfLower}` ||
            titleLower.includes(` ${nfLower}`) ||
            titleLower.includes(`${nfLower} `) ||
            (nfLower === 'superhero' && (titleLower.includes('superhero') || titleLower.includes('super hero') || (item.description && /superhero|super\s+hero/i.test(item.description))))
          ) {
            return true;
          }
          return false;
        });
        if (matchesNegFranchise) {
          continue;
        }
      }

      // 5. HARD CONSTRAINT: Explicit Runtime Limits (e.g. "under 90 minutes", "at least 150 minutes")
      if (hasHardRuntime) {
        if (profile.max_runtime_minutes !== null && item.type === 'Movie') {
          if (item.runtime && item.runtime > profile.max_runtime_minutes) {
            continue;
          }
        }
        if (profile.min_runtime_minutes !== null && item.type === 'Movie') {
          if (item.runtime && item.runtime < profile.min_runtime_minutes) {
            continue;
          }
        }
      }

      // 6. HARD CONSTRAINT: Explicit Year Range / Decade (e.g. "from the 2000s", "between 1990 and 1995")
      if (hasHardYearRange) {
        if (profile.min_release_year !== null && item.release_year && item.release_year < profile.min_release_year) {
          continue;
        }
        if (profile.max_release_year !== null && item.release_year && item.release_year > profile.max_release_year) {
          continue;
        }
      }

      // 7. HARD CONSTRAINT: Explicit Director requirement (e.g. "Christopher Nolan movies")
      if (profile.directors && profile.directors.length > 0) {
        if (!item.directors || item.directors.length === 0) {
          continue;
        }
        const matchesDirector = profile.directors.some((reqDir) =>
          item.directors.some((d) => d.toLowerCase() === reqDir.toLowerCase())
        );
        if (!matchesDirector) {
          continue;
        }
      }

      // 8. HARD CONSTRAINT: Explicit Actor requirement (e.g. "movies with Karl Urban")
      if (profile.actors && profile.actors.length > 0) {
        if (!item.actors || item.actors.length === 0) {
          continue;
        }
        const mode = profile.actor_match_mode || 'all';
        if (mode === 'any') {
          const matchesAny = profile.actors.some((reqActor) =>
            item.actors.some((a) => a.toLowerCase() === reqActor.toLowerCase())
          );
          if (!matchesAny) {
            continue;
          }
        } else {
          // 'all' mode: candidate must contain ALL requested actors
          const matchesAll = profile.actors.every((reqActor) =>
            item.actors.some((a) => a.toLowerCase() === reqActor.toLowerCase())
          );
          if (!matchesAll) {
            continue;
          }
        }
      }

      // 9. HARD CONSTRAINT: Explicit Genre requirement (e.g. "A Korean mystery series on Netflix")
      // Hard constraint ONLY when the genre came from user-stated text or quiz (LLM-added genres are soft preferences)
      if (profile.genres && profile.genres.length > 0) {
        const hardGenres = profile.genres.filter((g) => {
          if (!profile.genre_sources) return true;
          return profile.genre_sources[g] === 'user' || profile.genre_sources[g] === 'quiz';
        });

        if (hardGenres.length > 0) {
          if (!item.genres || item.genres.length === 0) {
            continue;
          }
          const matchesGenre = hardGenres.some((reqG) => item.genres.includes(reqG));
          if (!matchesGenre) {
            continue;
          }
        }
      }

      candidates.push(item);
    }

    return candidates;
  }
}

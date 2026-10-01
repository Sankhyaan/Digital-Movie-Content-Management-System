// =============================================================================
// SQL CONTENT REPOSITORY — Queries the ACTUAL "project" database tables
// =============================================================================
//
//  Tables queried (all confirmed from DESC output):
//    content          — main table
//    movie            — LEFT JOINed for duration
//    series           — LEFT JOINed for total_seasons
//    season           — for episode lists
//    episode          — episode details
//    actor            — actor name lookup
//    content_actor    — junction (content_id, actor_id, role_name)
//    genre            — genre name lookup
//    content_genre    — junction (content_id, genre_id)
//    language         — language name lookup
//    content_language — junction (content_id, language_id, type)
//    ott_platform     — platform name lookup
//    content_platform — junction (content_id, platform_id, available_from,
//                                 available_till, region)
// =============================================================================

import https from 'https';
import { RowDataPacket } from 'mysql2/promise';
import { pool }          from '../db/connection';
import {
  Content, ContentFilters,
  Actor, ContentLanguage, Platform, Season, Episode,
} from '../models/interfaces';

/** Quick YouTube trailer resolver for contents without trailer_key */
function resolveYouTubeTrailer(title: string, year?: number | null): Promise<string | null> {
  return new Promise((resolve) => {
    const q = encodeURIComponent(`${title} ${year || ''} official trailer`);
    const req = https.get(`https://www.youtube.com/results?search_query=${q}`, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
        const m = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        if (m) {
          req.destroy();
          resolve(m[1]);
        }
      });
      res.on('end', () => {
        const m = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        resolve(m ? m[1] : null);
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(null);
    });
  });
}

// ── Raw DB row types ──────────────────────────────────────────────────────────

interface ContentRow extends RowDataPacket {
  content_id:    number;
  title:         string;
  release_year:  number | null;
  type:          'Movie' | 'Series';
  tmdb_id:       number | null;
  poster_path:   string | null;
  rating:        number | null;
  description:   string | null;   // content.description
  backdrop_path: string | null;   // content.backdrop_path
  trailer_key:   string | null;   // content.trailer_key
  duration:      number | null;   // from LEFT JOIN movie
  total_seasons: number | null;   // from LEFT JOIN series
}

interface ActorRow extends RowDataPacket {
  content_id:   number;
  actor_id:     number;
  name:         string;
  profile_path: string | null;
  role_name:    string | null;
}

interface GenreRow extends RowDataPacket {
  content_id: number;
  genre_name: string;
}

interface LangRow extends RowDataPacket {
  content_id:    number;
  language_id:   number;
  language_name: string;
  type:          'Original' | 'Dubbed' | 'Subtitle';
}

interface PlatformRow extends RowDataPacket {
  content_id:     number;
  platform_id:    number;
  name:           string;
  available_from: string;
  available_till: string | null;
  region:         string | null;
}

interface SeasonRow extends RowDataPacket {
  season_id:     number;
  series_id:     number;
  season_number: number | null;
}

interface EpisodeRow extends RowDataPacket {
  episode_id:     number;
  season_id:      number;
  title:          string | null;
  episode_number: number | null;
  duration:       number | null;
}

// ── Pre-grouped lookups for O(1) content relation assembly ────────────────────

interface ContentLookups {
  actors:    Map<number, ActorRow[]>;
  genres:    Map<number, GenreRow[]>;
  languages: Map<number, LangRow[]>;
  platforms: Map<number, PlatformRow[]>;
  seasons:   Map<number, SeasonRow[]>;
  episodes:  Map<number, EpisodeRow[]>;
}

function buildContent(row: ContentRow, lookups: ContentLookups): Content {
  const id = row.content_id;
  const myActors    = lookups.actors.get(id)    || [];
  const myGenres    = lookups.genres.get(id)    || [];
  const myLanguages = lookups.languages.get(id) || [];
  const myPlatforms = lookups.platforms.get(id) || [];
  const mySeasons   = lookups.seasons.get(id)   || [];

  const seasonsList: Season[] = mySeasons.map(s => ({
    seasonId:     s.season_id,
    seasonNumber: s.season_number ?? 0,
    episodes: (lookups.episodes.get(s.season_id) || []).map((e): Episode => ({
      episodeId:     e.episode_id,
      title:         e.title,
      episodeNumber: e.episode_number,
      duration:      e.duration,
    })),
  }));

  return {
    contentId:    id,
    title:        row.title,
    releaseYear:  row.release_year,
    type:         row.type,
    tmdbId:       row.tmdb_id,
    posterPath:   row.poster_path,
    rating:       row.rating !== null ? Number(row.rating) : null,
    description:  row.description ?? null,
    backdropPath: row.backdrop_path ?? null,
    trailerKey:   row.trailer_key ?? null,
    duration:     row.duration,
    totalSeasons: row.total_seasons,
    seasons:      seasonsList,
    genres:       myGenres.map(g => g.genre_name),
    actors:       myActors.map((a): Actor => ({
      actorId:     a.actor_id,
      name:        a.name,
      profilePath: a.profile_path ?? null,
      roleName:    a.role_name,
    })),
    // Deduplicate languages
    languages: (() => {
      const seen = new Set<string>();
      const result: ContentLanguage[] = [];
      for (const l of myLanguages) {
        const key = `${l.language_name.trim().toLowerCase()}_${l.type}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            languageId:   l.language_id,
            languageName: l.language_name,
            type:         l.type,
          });
        }
      }
      return result;
    })(),

    // Deduplicate platforms
    platforms: (() => {
      const seen = new Set<string>();
      const result: Platform[] = [];
      for (const p of myPlatforms) {
        const key = p.name.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            platformId:    p.platform_id,
            name:          p.name,
            availableFrom: p.available_from,
            availableTill: p.available_till,
            region:        p.region,
          });
        }
      }
      return result;
    })(),
  };
}

// ── Hydrate: fetch all relations for a list of content rows ───────────────────

async function hydrateContent(rows: ContentRow[]): Promise<Content[]> {
  if (rows.length === 0) return [];

  const ids = rows.map(r => r.content_id);
  const ph  = ids.map(() => '?').join(',');

  const lookups: ContentLookups = {
    actors:    new Map(),
    genres:    new Map(),
    languages: new Map(),
    platforms: new Map(),
    seasons:   new Map(),
    episodes:  new Map(),
  };

  // Actors
  const [actors] = await pool.query<ActorRow[]>(
    `SELECT ca.content_id, ca.actor_id, a.name, a.profile_path, ca.role_name
     FROM content_actor ca
     JOIN actor a ON a.actor_id = ca.actor_id
     WHERE ca.content_id IN (${ph})`,
    ids,
  );
  for (const a of actors) {
    let list = lookups.actors.get(a.content_id);
    if (!list) { list = []; lookups.actors.set(a.content_id, list); }
    list.push(a);
  }

  // Genres
  const [genres] = await pool.query<GenreRow[]>(
    `SELECT cg.content_id, g.genre_name
     FROM content_genre cg
     JOIN genre g ON g.genre_id = cg.genre_id
     WHERE cg.content_id IN (${ph})`,
    ids,
  );
  for (const g of genres) {
    let list = lookups.genres.get(g.content_id);
    if (!list) { list = []; lookups.genres.set(g.content_id, list); }
    list.push(g);
  }

  // Languages
  const [languages] = await pool.query<LangRow[]>(
    `SELECT cl.content_id, cl.language_id, l.language_name, cl.type
     FROM content_language cl
     JOIN language l ON l.language_id = cl.language_id
     WHERE cl.content_id IN (${ph})`,
    ids,
  );
  for (const l of languages) {
    let list = lookups.languages.get(l.content_id);
    if (!list) { list = []; lookups.languages.set(l.content_id, list); }
    list.push(l);
  }

  // Platforms
  const [platforms] = await pool.query<PlatformRow[]>(
    `SELECT cp.content_id, cp.platform_id, o.name,
            cp.available_from, cp.available_till, cp.region
     FROM content_platform cp
     JOIN ott_platform o ON o.platform_id = cp.platform_id
     WHERE cp.content_id IN (${ph})`,
    ids,
  );
  for (const p of platforms) {
    let list = lookups.platforms.get(p.content_id);
    if (!list) { list = []; lookups.platforms.set(p.content_id, list); }
    list.push(p);
  }

  // Seasons + Episodes (only for Series)
  const seriesIds = rows.filter(r => r.type === 'Series').map(r => r.content_id);
  if (seriesIds.length > 0) {
    const sph = seriesIds.map(() => '?').join(',');
    const [seasons] = await pool.query<SeasonRow[]>(
      `SELECT season_id, series_id, season_number
       FROM season
       WHERE series_id IN (${sph})
         AND season_number > 0`,
      seriesIds,
    );
    for (const s of seasons) {
      let list = lookups.seasons.get(s.series_id);
      if (!list) { list = []; lookups.seasons.set(s.series_id, list); }
      list.push(s);
    }

    if (seasons.length > 0) {
      const seasonIds = seasons.map(s => s.season_id);
      const eph = seasonIds.map(() => '?').join(',');
      const [episodes] = await pool.query<EpisodeRow[]>(
        `SELECT episode_id, season_id, title, episode_number, duration
         FROM episode
         WHERE season_id IN (${eph})`,
        seasonIds,
      );
      for (const e of episodes) {
        let list = lookups.episodes.get(e.season_id);
        if (!list) { list = []; lookups.episodes.set(e.season_id, list); }
        list.push(e);
      }
    }
  }

  return rows.map(row => buildContent(row, lookups));
}

// ── Base SELECT ───────────────────────────────────────────────────────────────

const BASE_SELECT = `
  SELECT
    c.content_id,
    c.title,
    c.release_year,
    c.type,
    c.tmdb_id,
    c.poster_path,
    c.rating,
    c.description,
    c.backdrop_path,
    c.trailer_key,
    m.duration,
    s.total_seasons
  FROM content c
  LEFT JOIN movie  m ON m.content_id = c.content_id
  LEFT JOIN series s ON s.content_id = c.content_id
`;

// ── Repository ────────────────────────────────────────────────────────────────

export class SQLMovieRepository {

  /** All content, with optional filters */
  async getAll(filters?: ContentFilters): Promise<Content[]> {
    let sql = BASE_SELECT;
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (filters?.genre) {
      sql += `
        JOIN content_genre cg_f ON cg_f.content_id = c.content_id
        JOIN genre          g_f ON g_f.genre_id     = cg_f.genre_id
      `;
      conditions.push('g_f.genre_name = ?');
      params.push(filters.genre);
    }

    if (filters?.language) {
      sql += `
        JOIN content_language cl_f ON cl_f.content_id  = c.content_id
        JOIN language          l_f ON l_f.language_id  = cl_f.language_id
      `;
      conditions.push('l_f.language_name = ?');
      params.push(filters.language);
    }

    if (filters?.type)   { conditions.push('c.type = ?');          params.push(filters.type); }
    if (filters?.year)   { conditions.push('c.release_year = ?');  params.push(filters.year); }
    if (filters?.search) { conditions.push('c.title LIKE ?');      params.push(`%${filters.search}%`); }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' GROUP BY c.content_id ORDER BY c.release_year DESC';

    if (filters?.limit) {
      const limitNum = Math.max(1, parseInt(String(filters.limit), 10));
      sql += ' LIMIT ?';
      params.push(limitNum);

      if (filters?.offset) {
        const offsetNum = Math.max(0, parseInt(String(filters.offset), 10));
        sql += ' OFFSET ?';
        params.push(offsetNum);
      }
    }

    const [rows] = await pool.query<ContentRow[]>(sql, params);
    return hydrateContent(rows);
  }

  /** Single content item by content_id */
  async getById(id: string): Promise<Content | null> {
    const [rows] = await pool.query<ContentRow[]>(
      `${BASE_SELECT} WHERE c.content_id = ?`, [id],
    );
    if (rows.length === 0) return null;
    const items = await hydrateContent(rows);
    const item = items[0];
    if (item && !item.trailerKey) {
      try {
        const ytKey = await resolveYouTubeTrailer(item.title, item.releaseYear);
        if (ytKey) {
          item.trailerKey = ytKey;
          pool.query('UPDATE content SET trailer_key = ? WHERE content_id = ?', [ytKey, item.contentId]).catch(() => {});
        }
      } catch {
        // Fallback gracefully without throwing
      }
    }
    return item;
  }

  /** Featured — top rated (rating >= 8.0), up to 10 items with backdrops for hero display */
  async getFeatured(): Promise<Content[]> {
    const [rows] = await pool.query<ContentRow[]>(
      `${BASE_SELECT} WHERE c.rating >= 8.0 AND c.rating <= 10.0 ORDER BY (c.backdrop_path IS NOT NULL) DESC, c.rating DESC LIMIT 10`,
    );
    return hydrateContent(rows);
  }

  /** Trending — most recently released high-rated content, up to 20 items */
  async getTrending(): Promise<Content[]> {
    const [rows] = await pool.query<ContentRow[]>(
      `${BASE_SELECT}
       WHERE c.release_year <= YEAR(CURDATE())
         AND c.rating IS NOT NULL
         AND c.rating >= 6.5
       ORDER BY c.release_year DESC, c.rating DESC
       LIMIT 20`,
    );
    return hydrateContent(rows);
  }

  /** All distinct genre names */
  async getGenres(): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT genre_name FROM genre ORDER BY genre_name ASC`,
    );
    return rows.map(r => r.genre_name as string);
  }

  /** Search by title */
  async search(query: string): Promise<Content[]> {
    const [rows] = await pool.query<ContentRow[]>(
      `${BASE_SELECT} WHERE c.title LIKE ? ORDER BY c.rating DESC`,
      [`%${query}%`],
    );
    return hydrateContent(rows);
  }

  /** CineMatch Recommendation Engine */
  async getRecommendations(
    vibe: string | null,
    type: string | null,
    maxDuration: number | null,
    minYear: number | null,
    minRating: number | null
  ): Promise<Content[]> {
    const [results] = await pool.query<any>(
      `CALL GetCineMatchRecommendations(?, ?, ?, ?, ?)`,
      [vibe, type, maxDuration, minYear, minRating]
    );
    // mysql2 returns an array of result sets for stored procedures.
    // The first result set contains our row data.
    const rows = results[0] as ContentRow[];
    return hydrateContent(rows);
  }
}

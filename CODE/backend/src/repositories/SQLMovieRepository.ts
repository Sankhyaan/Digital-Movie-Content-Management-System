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

import { RowDataPacket } from 'mysql2/promise';
import { pool }          from '../db/connection';
import {
  Content, ContentFilters,
  Actor, ContentLanguage, Platform, Season, Episode,
} from '../models/interfaces';

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
  duration:      number | null;   // from LEFT JOIN movie
  total_seasons: number | null;   // from LEFT JOIN series
}

interface ActorRow extends RowDataPacket {
  content_id: number;
  actor_id:   number;
  name:       string;
  role_name:  string | null;
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

// ── Build a Content object from flat SQL rows ─────────────────────────────────

function buildContent(
  row:       ContentRow,
  actors:    ActorRow[],
  genres:    GenreRow[],
  languages: LangRow[],
  platforms: PlatformRow[],
  seasons:   SeasonRow[],
  episodes:  EpisodeRow[],
): Content {
  const id = row.content_id;

  const mySeasons: Season[] = seasons
    .filter(s => s.series_id === id)
    .map(s => ({
      seasonId:     s.season_id,
      seasonNumber: s.season_number ?? 0,
      episodes: episodes
        .filter(e => e.season_id === s.season_id)
        .map((e): Episode => ({
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
    duration:     row.duration,
    totalSeasons: row.total_seasons,
    seasons:      mySeasons,
    genres:    genres.filter(g => g.content_id === id).map(g => g.genre_name),
    actors:    actors.filter(a => a.content_id === id).map((a): Actor => ({
      actorId:  a.actor_id,
      name:     a.name,
      roleName: a.role_name,
    })),
    languages: languages.filter(l => l.content_id === id).map((l): ContentLanguage => ({
      languageId:   l.language_id,
      languageName: l.language_name,
      type:         l.type,
    })),
    platforms: platforms.filter(p => p.content_id === id).map((p): Platform => ({
      platformId:    p.platform_id,
      name:          p.name,
      availableFrom: p.available_from,
      availableTill: p.available_till,
      region:        p.region,
    })),
  };
}

// ── Hydrate: fetch all relations for a list of content rows ───────────────────

async function hydrateContent(rows: ContentRow[]): Promise<Content[]> {
  if (rows.length === 0) return [];

  const ids = rows.map(r => r.content_id);
  const ph  = ids.map(() => '?').join(',');

  // Actors
  const [actors] = await pool.query<ActorRow[]>(
    `SELECT ca.content_id, ca.actor_id, a.name, ca.role_name
     FROM content_actor ca
     JOIN actor a ON a.actor_id = ca.actor_id
     WHERE ca.content_id IN (${ph})`,
    ids,
  );

  // Genres
  const [genres] = await pool.query<GenreRow[]>(
    `SELECT cg.content_id, g.genre_name
     FROM content_genre cg
     JOIN genre g ON g.genre_id = cg.genre_id
     WHERE cg.content_id IN (${ph})`,
    ids,
  );

  // Languages
  const [languages] = await pool.query<LangRow[]>(
    `SELECT cl.content_id, cl.language_id, l.language_name, cl.type
     FROM content_language cl
     JOIN language l ON l.language_id = cl.language_id
     WHERE cl.content_id IN (${ph})`,
    ids,
  );

  // Platforms
  const [platforms] = await pool.query<PlatformRow[]>(
    `SELECT cp.content_id, cp.platform_id, o.name,
            cp.available_from, cp.available_till, cp.region
     FROM content_platform cp
     JOIN ott_platform o ON o.platform_id = cp.platform_id
     WHERE cp.content_id IN (${ph})`,
    ids,
  );

  // Seasons + Episodes (only for Series)
  const seriesIds = rows.filter(r => r.type === 'Series').map(r => r.content_id);
  let seasons:  SeasonRow[]  = [];
  let episodes: EpisodeRow[] = [];

  if (seriesIds.length > 0) {
    const sph = seriesIds.map(() => '?').join(',');
    [seasons] = await pool.query<SeasonRow[]>(
      `SELECT season_id, series_id, season_number
       FROM season
       WHERE series_id IN (${sph})`,
      seriesIds,
    );

    if (seasons.length > 0) {
      const seasonIds = seasons.map(s => s.season_id);
      const eph = seasonIds.map(() => '?').join(',');
      [episodes] = await pool.query<EpisodeRow[]>(
        `SELECT episode_id, season_id, title, episode_number, duration
         FROM episode
         WHERE season_id IN (${eph})`,
        seasonIds,
      );
    }
  }

  return rows.map(row =>
    buildContent(row, actors, genres, languages, platforms, seasons, episodes),
  );
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
    return items[0];
  }

  /** Featured — top rated (rating >= 8.0), up to 10 items */
  async getFeatured(): Promise<Content[]> {
    const [rows] = await pool.query<ContentRow[]>(
      `${BASE_SELECT} WHERE c.rating >= 8.0 ORDER BY c.rating DESC LIMIT 10`,
    );
    return hydrateContent(rows);
  }

  /** Trending — most recently released, up to 20 items */
  async getTrending(): Promise<Content[]> {
    const [rows] = await pool.query<ContentRow[]>(
      `${BASE_SELECT} ORDER BY c.release_year DESC LIMIT 20`,
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

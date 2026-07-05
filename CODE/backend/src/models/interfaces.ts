// =============================================================================
// INTERFACES — Matched to the ACTUAL MySQL "project" database schema
// =============================================================================
//
//  Actual tables in your database:
//    content          — content_id, title, release_year, type, tmdb_id,
//                       poster_path, rating
//    movie            — content_id, duration
//    series           — content_id, total_seasons
//    season           — season_id, series_id, season_number
//    episode          — episode_id, season_id, title, episode_number, duration
//    actor            — actor_id, name
//    content_actor    — content_id, actor_id, role_name
//    genre            — genre_id, genre_name
//    content_genre    — content_id, genre_id
//    language         — language_id, language_name
//    content_language — content_id, language_id, type
//    ott_platform     — platform_id, name
//    content_platform — content_id, platform_id, available_from,
//                       available_till, region
// =============================================================================

/** An actor that appears in a piece of content. */
export interface Actor {
  actorId:  number;    // actor.actor_id
  name:     string;    // actor.name
  roleName: string | null;  // content_actor.role_name
}

/** A language linked to a content item. */
export interface ContentLanguage {
  languageId:   number;  // language.language_id
  languageName: string;  // language.language_name
  type:         'Original' | 'Dubbed' | 'Subtitle';  // content_language.type
}

/** An OTT platform that hosts the content. */
export interface Platform {
  platformId:    number;        // ott_platform.platform_id
  name:          string;        // ott_platform.name
  availableFrom: string;        // content_platform.available_from
  availableTill: string | null; // content_platform.available_till
  region:        string | null; // content_platform.region
}

/** A season belonging to a Series. */
export interface Season {
  seasonId:     number;    // season.season_id
  seasonNumber: number;    // season.season_number
  episodes:     Episode[];
}

/** An episode belonging to a Season. */
export interface Episode {
  episodeId:     number;        // episode.episode_id
  title:         string | null; // episode.title
  episodeNumber: number | null; // episode.episode_number
  duration:      number | null; // episode.duration (minutes)
}

/**
 * Core content item — either a Movie or a Series.
 * Built from: content + LEFT JOIN movie + LEFT JOIN series + related tables.
 */
export interface Content {
  contentId:    number;        // content.content_id
  title:        string;        // content.title
  releaseYear:  number | null; // content.release_year
  type:         'Movie' | 'Series'; // content.type
  tmdbId:       number | null; // content.tmdb_id
  posterPath:   string | null; // content.poster_path
  rating:       number | null; // content.rating
  description:  string | null; // content.description (added via ALTER TABLE)

  // Movie-specific (null for Series)
  duration:     number | null; // movie.duration

  // Series-specific (null for Movie)
  totalSeasons: number | null; // series.total_seasons
  seasons:      Season[];

  // Related data
  genres:    string[];          // from genre via content_genre
  actors:    Actor[];           // from actor via content_actor
  languages: ContentLanguage[]; // from language via content_language
  platforms: Platform[];        // from ott_platform via content_platform
}

/** Filters accepted by list/search endpoints. */
export interface ContentFilters {
  search?:   string;
  genre?:    string;
  year?:     string;
  language?: string;
  type?:     'Movie' | 'Series';
}

// Aliases so controller/service files compile without modification
export type Movie        = Content;
export type MovieFilters = ContentFilters;

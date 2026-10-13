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
  actorId:     number;        // actor.actor_id
  name:        string;        // actor.name
  profilePath: string | null; // actor.profile_path
  roleName:    string | null; // content_actor.role_name
}

/** A director that directed a piece of content. */
export interface Director {
  directorId:  number;        // director.director_id
  name:        string;        // director.name
  profilePath: string | null; // director.profile_path
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
  description:  string | null; // content.description
  backdropPath: string | null; // content.backdrop_path
  trailerKey:   string | null; // content.trailer_key

  // Movie-specific (null for Series)
  duration:     number | null; // movie.duration

  // Series-specific (null for Movie)
  totalSeasons: number | null; // series.total_seasons
  seasons:      Season[];

  // Related data
  genres:    string[];          // from genre via content_genre
  actors:    Actor[];           // from actor via content_actor
  directors: Director[];        // from director via content_director
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
  limit?:    number | string;
  offset?:   number | string;
}

// Aliases so controller/service files compile without modification
export type Movie        = Content;
export type MovieFilters = ContentFilters;

// =============================================================================
// MOVIE DNA / RECOMMENDATION DATA LAYER INTERFACES (DERIVED FEATURE LAYER)
// =============================================================================

export interface SeriesMetadata {
  total_seasons:                  number | null;
  has_episode_metadata:           boolean;
  total_episodes:                 number;
  seasons_with_episodes:          number;
  known_episode_duration_count:   number;
  missing_episode_duration_count: number;
  avg_episode_duration:           number | null; // in minutes
  median_episode_duration:        number | null; // in minutes
  total_known_runtime:            number | null; // in minutes
}

export interface QualityFlags {
  has_description:      boolean;
  has_genres:           boolean;
  has_languages:        boolean;
  has_platforms:        boolean;
  has_actors:           boolean;
  has_directors:        boolean;
  has_runtime:          boolean;
  has_rating:           boolean;
  is_unreleased:        boolean;
  has_episode_metadata: boolean;
}

export interface MovieDNA {
  content_id:      number;
  title:           string;
  type:            'Movie' | 'Series';
  description:     string | null;
  release_year:    number | null;
  rating:          number | null;
  runtime:         number | null; // in minutes, null for Series
  genres:          string[];
  languages:       string[];
  platforms:       string[];
  actors:          string[];
  directors:       string[];
  series_metadata: SeriesMetadata | null; // null for Movie
  quality_flags:   QualityFlags;
}

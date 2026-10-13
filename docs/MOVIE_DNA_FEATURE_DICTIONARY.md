# CineVerse — Movie DNA Feature Dictionary

This document details the schema, source lineage, semantic meaning, missing-data handling, and recommendation intent for every field in the **Movie DNA** data layer.

The Movie DNA representation serves as a clean, standardized, recommendation-ready feature representation derived reproducibly from the normalized relational tables in MySQL (`content`, `movie`, `series`, `genre`, `language`, `ott_platform`, `actor`, `season`, `episode`).

---

## 1. Top-Level Entity Fields

| Field Name | Source Table / Column | Data Type | Meaning | Derived? | Missing Data Behavior | Future Recommendation Intent |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `content_id` | `content.content_id` | `integer` | Unique primary key identifying the content item in CineVerse. | No | Mandatory (`NOT NULL`) | Primary entity identifier for candidate generation & user history tracking. |
| `title` | `content.title` | `string` | Canonical title of the movie or television series. | No | Mandatory (`NOT NULL`, non-empty) | Display, text search, and candidate presentation. |
| `type` | `content.type` | `enum('Movie', 'Series')` | Distinguishes whether the work is a standalone film or an episodic series. | No | Mandatory (`NOT NULL`) | Hard filtering (e.g., user selects "Only Movies" or "Only TV Shows"). |
| `description` | `content.description` | `string \| null` | Authentic TMDB synopsis / plot overview. | No | `null` if unavailable in TMDB (79 titles) | Future semantic content analysis and display. |
| `release_year` | `content.release_year` | `integer \| null` | Year of initial theatrical release or television premiere (1920–2026). | No | Mandatory in current catalog | Recency weighting, decade/era filtering, and temporal preference matching. |
| `rating` | `content.rating` | `float \| null` | TMDB weighted average vote score (scale 0.0 to 10.0). | No | Valid float (`0.0` for 8 unreleased 2026 titles) | Quality filtering, popularity prior, and Bayesian score adjustments. |
| `runtime` | `movie.duration` | `integer \| null` | Runtime of the movie in minutes. Strictly `null` for TV series. | No | Valid integer for all 6,253 movies; `null` for Series | Duration-based filtering (e.g., "Under 90 min", "Epic > 2.5 hours"). |
| `genres` | `content_genre` + `genre.genre_name` | `array[string]` | Alphabetically sorted list of distinct standard genre names (from 25 standard genres). | Yes | Empty array `[]` if unclassified (74 titles) | Core collaborative & content-based similarity matching, user taste vector. |
| `languages` | `content_language` + `language.language_name` | `array[string]` | Alphabetically sorted list of distinct standard English language names (38 languages). | Yes | Empty array `[]` if unclassified (127 titles) | Regional preferences, native language boost, multilingual filtering. |
| `platforms` | `content_platform` + `ott_platform.name` | `array[string]` | Alphabetically sorted list of distinct streaming services where title is available (12 platforms). | Yes | Empty array `[]` if unavailable (302 titles) | OTT provider availability filtering & platform-specific recommendations. |
| `actors` | `content_actor` + `actor.name` | `array[string]` | Alphabetically sorted list of credited actors appearing in the work. | Yes | Empty array `[]` if uncredited (9,304 titles) | Cast-based similarity, favorite actor matching (without fabricating missing data). |
| `series_metadata` | `series`, `season`, `episode` | `object \| null` | Detailed television structure and episode runtime metrics. Strictly `null` for Movie. | Yes | `null` for Movies; populated object for Series | Bingeability score, format preference, total watch-time estimation. |
| `quality_flags` | Derived from record completeness | `object` | Boolean indicators stating data completeness across all feature dimensions. | Yes | Mandatory object with 9 booleans | Dynamic feature weighting and cold-start metadata gating. |

---

## 2. `series_metadata` Fields (For Type = 'Series')

Strictly `null` when `type = 'Movie'`.

| Field Name | Source Table / Column | Data Type | Meaning | Derived? | Missing Data Behavior | Future Recommendation Intent |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `total_seasons` | `series.total_seasons` | `integer \| null` | Real-world total season count from TMDB metadata. | No | `null` if unrecorded | Filtering by series length (miniseries vs long-running). |
| `has_episode_metadata` | `season` + `episode` records | `boolean` | `true` if detailed season and episode records exist in database (2,458 series), `false` if legacy overview-only (1,289 series). | Yes | Mandatory boolean (`true` or `false`) | Distinguishes rich episodic data from overview-only TV shows. |
| `total_episodes` | `COUNT(episode.episode_id)` | `integer` | Count of indexed episodes in CineVerse database. | Yes | `0` if `has_episode_metadata = false` | Episode count categorization (e.g. short 10-ep season vs 100+ ep syndication). |
| `seasons_with_episodes` | `COUNT(DISTINCT season.season_id)` | `integer` | Number of distinct seasons with indexed episode rows. | Yes | `0` if `has_episode_metadata = false` | Validation of season coverage. |
| `known_episode_duration_count` | `COUNT(CASE WHEN duration > 0)` | `integer` | Number of episodes with non-null, valid runtime in minutes. | Yes | `0` if none | Confidence indicator for episode duration statistics. |
| `missing_episode_duration_count` | `COUNT(CASE WHEN duration IS NULL)` | `integer` | Number of indexed episodes lacking individual runtime. | Yes | `0` if none | Data quality indicator. |
| `avg_episode_duration` | `AVG(episode.duration)` | `float \| null` | Mean runtime of episodes with known durations (minutes, 1 decimal place). | Yes | `null` if 0 known episode durations | Pacing match (e.g. 20-30 min comedy vs 50-60 min prestige drama). |
| `median_episode_duration` | Median of valid episode durations | `float \| null` | Robust median runtime of episodes with known durations (minutes). | Yes | `null` if 0 known episode durations | Robust central tendency resilient against specials/outliers. |
| `total_known_runtime` | `SUM(episode.duration)` | `integer \| null` | Total cumulative minutes across all episodes with known duration. | Yes | `null` if 0 known episode durations | Total binge-watch commitment estimation. |

---

## 3. `quality_flags` Fields (Data Quality Gating)

| Field Name | Condition / Logic | Data Type | Meaning | Missing Data Handling |
| :--- | :--- | :--- | :--- | :--- |
| `has_description` | `description !== null && description.trim().length > 0` | `boolean` | Indicates whether synopsis text is present. | `false` for 79 titles. |
| `has_genres` | `genres.length > 0` | `boolean` | Indicates whether at least one valid genre is mapped. | `false` for 74 titles. |
| `has_languages` | `languages.length > 0` | `boolean` | Indicates whether language information is mapped. | `false` for 127 titles. |
| `has_platforms` | `platforms.length > 0` | `boolean` | Indicates whether OTT platform availability is known. | `false` for 302 titles. |
| `has_actors` | `actors.length > 0` | `boolean` | Indicates whether credited actor data exists. | `false` for 9,304 titles. |
| `has_runtime` | `runtime !== null && runtime > 0` (Movies) | `boolean` | Indicates whether movie runtime is available. | `true` for all 6,253 movies; `false` for series. |
| `has_rating` | `rating !== null && rating > 0` | `boolean` | Indicates whether title has received user votes. | `false` for 8 unreleased titles. |
| `is_unreleased` | `rating === 0` | `boolean` | Identifies unreleased/upcoming titles with 0 vote count. | `true` for 8 unreleased 2026 titles. |
| `has_episode_metadata`| `type === 'Series' && series_metadata.has_episode_metadata` | `boolean` | Indicates whether detailed season & episode data exists. | `false` for movies and 1,289 legacy series. |

---

## 4. Preservation & Non-Denormalization Guarantees

1. **Normalized Database Integrity**: The core relational tables (`content`, `movie`, `series`, `genre`, `content_genre`, `language`, `content_language`, `ott_platform`, `content_platform`, `actor`, `content_actor`, `season`, `episode`) remain the single source of truth.
2. **Derived Storage Layer**:
   - MySQL table `content_dna` stores `dna_json` keyed by `content_id` with `FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE`.
   - Standalone JSON file at `backend/data/movie_dna.json` and `data/movie_dna.json` allows fast in-memory hydration without database load.
3. **Deterministic Reproducibility**: Running `node scripts/build_movie_dna.js` reproduces this exact structure from the normalized relational database in under 2 seconds.

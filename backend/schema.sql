-- =============================================================================
-- DATABASE SCHEMA — CineVerse Movie OTT Platform
-- Database: project
-- =============================================================================
-- This file reflects the ACTUAL tables, columns, constraints, and indexes
-- in the MySQL "project" database.
-- =============================================================================

-- Drop in reverse dependency order
DROP TABLE IF EXISTS content_dna;
DROP TABLE IF EXISTS episode_language;
DROP TABLE IF EXISTS content_platform;
DROP TABLE IF EXISTS content_language;
DROP TABLE IF EXISTS content_genre;
DROP TABLE IF EXISTS content_director;
DROP TABLE IF EXISTS content_actor;
DROP TABLE IF EXISTS episode;
DROP TABLE IF EXISTS season;
DROP TABLE IF EXISTS series;
DROP TABLE IF EXISTS movie;
DROP TABLE IF EXISTS watchlist;
DROP TABLE IF EXISTS watchlist_count;
DROP TABLE IF EXISTS content;
DROP TABLE IF EXISTS ott_platform;
DROP TABLE IF EXISTS language;
DROP TABLE IF EXISTS genre;
DROP TABLE IF EXISTS director;
DROP TABLE IF EXISTS actor;

-- ── actor ─────────────────────────────────────────────────────────────────────
CREATE TABLE actor (
  actor_id      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  profile_path  VARCHAR(255) DEFAULT NULL,
  tmdb_actor_id INT          DEFAULT NULL,
  UNIQUE KEY uk_actor_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── director ──────────────────────────────────────────────────────────────────
CREATE TABLE director (
  director_id      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  profile_path     VARCHAR(255) DEFAULT NULL,
  tmdb_director_id INT          DEFAULT NULL,
  UNIQUE KEY uk_director_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── genre ─────────────────────────────────────────────────────────────────────
CREATE TABLE genre (
  genre_id   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  genre_name VARCHAR(100) DEFAULT NULL,
  UNIQUE KEY (genre_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── language ──────────────────────────────────────────────────────────────────
CREATE TABLE language (
  language_id   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  language_name VARCHAR(100) DEFAULT NULL,
  UNIQUE KEY (language_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── ott_platform ──────────────────────────────────────────────────────────────
CREATE TABLE ott_platform (
  platform_id INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) DEFAULT NULL,
  UNIQUE KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── content ───────────────────────────────────────────────────────────────────
CREATE TABLE content (
  content_id    INT                    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(255)           NOT NULL,
  release_year  INT                    DEFAULT NULL,
  type          ENUM('Movie','Series') NOT NULL,
  tmdb_id       INT                    DEFAULT NULL,
  poster_path   VARCHAR(255)           DEFAULT NULL,
  rating        FLOAT                  DEFAULT NULL,
  description   TEXT                   DEFAULT NULL,
  backdrop_path VARCHAR(255)           DEFAULT NULL,
  trailer_key   VARCHAR(30)            DEFAULT NULL,
  UNIQUE KEY uk_content_tmdb_id (tmdb_id),
  KEY idx_content_type (type),
  KEY idx_content_release_year (release_year),
  KEY idx_content_rating (rating DESC),
  KEY idx_content_year_rating (release_year DESC, rating DESC),
  KEY idx_content_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── movie (extends content for Movie type) ────────────────────────────────────
CREATE TABLE movie (
  content_id INT NOT NULL,
  duration   INT DEFAULT NULL,          -- runtime in minutes
  PRIMARY KEY (content_id),
  FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── series (extends content for Series type) ──────────────────────────────────
CREATE TABLE series (
  content_id    INT NOT NULL,
  total_seasons INT DEFAULT NULL,
  PRIMARY KEY (content_id),
  FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── season ────────────────────────────────────────────────────────────────────
CREATE TABLE season (
  season_id     INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  series_id     INT DEFAULT NULL,
  season_number INT DEFAULT NULL,
  UNIQUE KEY uk_series_season (series_id, season_number),
  FOREIGN KEY (series_id) REFERENCES series(content_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── episode ───────────────────────────────────────────────────────────────────
CREATE TABLE episode (
  episode_id     INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  season_id      INT          DEFAULT NULL,
  title          VARCHAR(255) DEFAULT NULL,
  episode_number INT          DEFAULT NULL,
  duration       INT          DEFAULT NULL,
  UNIQUE KEY uk_season_episode (season_id, episode_number),
  FOREIGN KEY (season_id) REFERENCES season(season_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── content_actor ─────────────────────────────────────────────────────────────
CREATE TABLE content_actor (
  content_id INT          NOT NULL,
  actor_id   INT          NOT NULL,
  role_name  VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (content_id, actor_id),
  KEY actor_id (actor_id),
  FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id)   REFERENCES actor(actor_id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── content_director ──────────────────────────────────────────────────────────
CREATE TABLE content_director (
  content_id  INT NOT NULL,
  director_id INT NOT NULL,
  PRIMARY KEY (content_id, director_id),
  KEY idx_content_director_director (director_id),
  FOREIGN KEY (content_id)  REFERENCES content(content_id)   ON DELETE CASCADE,
  FOREIGN KEY (director_id) REFERENCES director(director_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── content_genre ─────────────────────────────────────────────────────────────
CREATE TABLE content_genre (
  content_id INT NOT NULL,
  genre_id   INT NOT NULL,
  PRIMARY KEY (content_id, genre_id),
  KEY idx_content_genre (genre_id),
  FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id)   REFERENCES genre(genre_id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── content_language ──────────────────────────────────────────────────────────
CREATE TABLE content_language (
  content_id  INT                                  NOT NULL,
  language_id INT                                  NOT NULL,
  type        ENUM('Original','Dubbed','Subtitle') NOT NULL,
  PRIMARY KEY (content_id, language_id, type),
  KEY language_id (language_id),
  FOREIGN KEY (content_id)  REFERENCES content(content_id)   ON DELETE CASCADE,
  FOREIGN KEY (language_id) REFERENCES language(language_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── content_platform ──────────────────────────────────────────────────────────
CREATE TABLE content_platform (
  content_id     INT         NOT NULL,
  platform_id    INT         NOT NULL,
  available_from DATE        NOT NULL,
  available_till DATE        DEFAULT NULL,
  region         VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (content_id, platform_id, available_from),
  KEY platform_id (platform_id),
  FOREIGN KEY (content_id)  REFERENCES content(content_id)       ON DELETE CASCADE,
  FOREIGN KEY (platform_id) REFERENCES ott_platform(platform_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── episode_language ──────────────────────────────────────────────────────────
CREATE TABLE episode_language (
  episode_id  INT                                  NOT NULL,
  language_id INT                                  NOT NULL,
  type        ENUM('Original','Dubbed','Subtitle') NOT NULL,
  PRIMARY KEY (episode_id, language_id, type),
  KEY language_id (language_id),
  FOREIGN KEY (episode_id)  REFERENCES episode(episode_id)   ON DELETE CASCADE,
  FOREIGN KEY (language_id) REFERENCES language(language_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── watchlist ─────────────────────────────────────────────────────────────────
CREATE TABLE watchlist (
  watchlist_id INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  content_id   INT          NOT NULL,
  content_name VARCHAR(255) NOT NULL,
  release_year INT          DEFAULT NULL,
  type         VARCHAR(10)  DEFAULT NULL,
  poster_path  VARCHAR(500) DEFAULT NULL,
  rating       DECIMAL(3,1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── watchlist_count ───────────────────────────────────────────────────────────
CREATE TABLE watchlist_count (
  total INT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── content_dna (Derived Movie DNA Layer) ─────────────────────────────────────
CREATE TABLE content_dna (
  content_id INT       NOT NULL,
  dna_json   JSON      NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (content_id),
  CONSTRAINT fk_content_dna_content FOREIGN KEY (content_id) REFERENCES content (content_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

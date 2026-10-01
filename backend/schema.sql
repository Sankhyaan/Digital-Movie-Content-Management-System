-- =============================================================================
-- DATABASE SCHEMA — CineVerse Movie OTT Platform
-- Database: project
-- =============================================================================
-- This file reflects the ACTUAL tables in the MySQL "project" database.
-- Run: mysql -u root -p project < schema.sql
-- =============================================================================

-- Drop in reverse dependency order
DROP TABLE IF EXISTS content_platform;
DROP TABLE IF EXISTS content_language;
DROP TABLE IF EXISTS content_genre;
DROP TABLE IF EXISTS content_actor;
DROP TABLE IF EXISTS episode;
DROP TABLE IF EXISTS season;
DROP TABLE IF EXISTS series;
DROP TABLE IF EXISTS movie;
DROP TABLE IF EXISTS content;
DROP TABLE IF EXISTS ott_platform;
DROP TABLE IF EXISTS language;
DROP TABLE IF EXISTS genre;
DROP TABLE IF EXISTS actor;

-- ── actor ─────────────────────────────────────────────────────────────────────
CREATE TABLE actor (
  actor_id INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── genre ─────────────────────────────────────────────────────────────────────
CREATE TABLE genre (
  genre_id   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  genre_name VARCHAR(100) DEFAULT NULL,
  UNIQUE KEY (genre_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── language ──────────────────────────────────────────────────────────────────
CREATE TABLE language (
  language_id   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  language_name VARCHAR(100) DEFAULT NULL,
  UNIQUE KEY (language_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ott_platform ──────────────────────────────────────────────────────────────
CREATE TABLE ott_platform (
  platform_id INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) DEFAULT NULL,
  UNIQUE KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── content ───────────────────────────────────────────────────────────────────
CREATE TABLE content (
  content_id   INT                    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(255)           NOT NULL,
  release_year INT                    DEFAULT NULL,
  type         ENUM('Movie','Series') NOT NULL,
  tmdb_id      INT                    DEFAULT NULL,
  poster_path  VARCHAR(255)           DEFAULT NULL,
  rating       FLOAT                  DEFAULT NULL,
  description  TEXT                   DEFAULT NULL,
  UNIQUE KEY (tmdb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── movie (extends content for Movie type) ────────────────────────────────────
CREATE TABLE movie (
  content_id INT DEFAULT NULL,
  duration   INT DEFAULT NULL,          -- runtime in minutes
  PRIMARY KEY (content_id),
  FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── series (extends content for Series type) ──────────────────────────────────
CREATE TABLE series (
  content_id     INT DEFAULT NULL,
  total_seasons  INT DEFAULT NULL,
  PRIMARY KEY (content_id),
  FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── season ────────────────────────────────────────────────────────────────────
CREATE TABLE season (
  season_id     INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  series_id     INT DEFAULT NULL,
  season_number INT DEFAULT NULL,
  KEY (series_id),
  FOREIGN KEY (series_id) REFERENCES series(content_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── episode ───────────────────────────────────────────────────────────────────
CREATE TABLE episode (
  episode_id     INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  season_id      INT          DEFAULT NULL,
  title          VARCHAR(255) DEFAULT NULL,
  episode_number INT          DEFAULT NULL,
  duration       INT          DEFAULT NULL,
  KEY (season_id),
  FOREIGN KEY (season_id) REFERENCES season(season_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── content_actor ─────────────────────────────────────────────────────────────
CREATE TABLE content_actor (
  content_id INT          NOT NULL,
  actor_id   INT          NOT NULL,
  role_name  VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (content_id, actor_id),
  FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id)   REFERENCES actor(actor_id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── content_genre ─────────────────────────────────────────────────────────────
CREATE TABLE content_genre (
  content_id INT NOT NULL,
  genre_id   INT NOT NULL,
  PRIMARY KEY (content_id, genre_id),
  FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id)   REFERENCES genre(genre_id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── content_language ──────────────────────────────────────────────────────────
CREATE TABLE content_language (
  content_id  INT                                    NOT NULL,
  language_id INT                                    NOT NULL,
  type        ENUM('Original','Dubbed','Subtitle')   NOT NULL,
  PRIMARY KEY (content_id, language_id, type),
  FOREIGN KEY (content_id)  REFERENCES content(content_id)    ON DELETE CASCADE,
  FOREIGN KEY (language_id) REFERENCES language(language_id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── content_platform ──────────────────────────────────────────────────────────
CREATE TABLE content_platform (
  content_id     INT         NOT NULL,
  platform_id    INT         NOT NULL,
  available_from DATE        NOT NULL,
  available_till DATE        DEFAULT NULL,
  region         VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (content_id, platform_id, available_from),
  FOREIGN KEY (content_id)  REFERENCES content(content_id)         ON DELETE CASCADE,
  FOREIGN KEY (platform_id) REFERENCES ott_platform(platform_id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

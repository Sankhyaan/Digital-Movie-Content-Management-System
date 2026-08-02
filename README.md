# Digital Movie Content Management System (CineVerse)

CineVerse is a full-stack OTT content management web application modeled after modern platforms like Netflix. It integrates a highly normalized relational database with a responsive web interface to manage and explore movies, TV series, actors, genres, languages, and OTT platform availability.

This documentation serves as the comprehensive guide for the system, compiling database design, SQL implementations (procedures, triggers, cursors, UDFs, transactions), application architecture, and deployment instructions derived from the project report and actual codebase.

---

## 📋 Table of Contents
1. [Objective](#1-objective)
2. [Key Features](#2-key-features)
3. [Technology Stack](#3-technology-stack)
4. [Entity-Relationship (ER) Model](#4-entity-relationship-er-model)
5. [Relational Model (Schema Breakdown)](#5-relational-model-schema-breakdown)
6. [Normalization Analysis (3NF)](#6-normalization-analysis-3nf)
7. [DBMS Implementations & SQL Code](#7-dbms-implementations--sql-code)
   - [Triggers](#triggers)
   - [Stored Procedures](#stored-procedures)
   - [User-Defined Functions (UDFs)](#user-defined-functions-udfs)
   - [Cursors](#cursors)
   - [Transactions](#transactions)
   - [Views](#views)
   - [Indexes](#indexes)
8. [Novelty - CineMatch Recommendation Quiz](#8-novelty---cinematch-recommendation-quiz)
9. [Application Architecture](#9-application-architecture)
10. [Setup & Installation](#10-setup--installation)

---

## 1. Objective

The primary objective of this project is to design and implement a fully normalized relational database system for an Over-The-Top (OTT) content management platform. The system manages complex relationships between movies, TV series, actors, seasons, episodes, languages, and regional platform availabilities. 

This project demonstrates the practical integration of relational database management systems (RDBMS) with modern web technologies, showcasing:
* Structured DDL & DML operations.
* Advanced database programmability (stored procedures, user-defined functions, triggers, cursors).
* ACID-compliant transactions for data safety.
* Database performance tuning (views, indexing).

---

## 2. Key Features

* **Hierarchical TV Series Modeling:** Structurally nested relation of `Series ➔ Season ➔ Episode` with dedicated metadata (durations, episode numbers, etc.).
* **Multi-Language Support:** Track original, dubbed, and subtitled languages at the content level, as well as episode-specific audio availability.
* **Global Platform Availability:** Manage regional availability windows (`available_from` and `available_till` date ranges) across different OTT platforms.
* **Auto-Maintained Watchlist:** Background database triggers automatically keep track of total items saved on a user's watchlist.
* **Advanced Search & Filtering:** Perform real-time, efficient queries across multiple table joins by genre, language, content type, and search queries.
* **CineMatch Recommendation Engine:** Custom stored procedure filtering movies/shows using database-level preference weightings rather than client-side filter logic.

---

## 3. Technology Stack

* **Database:** MySQL (relational database storage, views, procedures, UDFs, triggers, and transactions)
* **Backend:** Node.js, Express.js, TypeScript (utilizing the **Repository Pattern** with `mysql2/promise` for raw connection pooling and execution)
* **Frontend:** React.js, React-Router-DOM, Vanilla CSS (designed with premium black & emerald green aesthetics, glassmorphism, responsive grids, and micro-interactions)
* **API Architecture:** RESTful API Design

---

## 4. Entity-Relationship (ER) Model

The database is built around **16 interrelated tables** designed using MySQL Workbench. 

### Key Observations from the ER Model:
1. **Centralized Content Specialization:** `content` serves as the superclass/parent table, which is specialized into `movie` and `series` tables using a 1:1 shared primary key pattern (`content_id`).
2. **Hierarchical Content Organization:** TV Series contain a recursive 3-level tree: `series` (via `content_id`) ➔ `season` ➔ `episode`.
3. **Complex Junction Tables:** All many-to-many relationships are cleanly resolved:
   - `content_actor` associates cast members and their specific character roles to a title.
   - `content_genre` links content to multiple genres.
   - `content_language` enables multi-language options (Original, Dubbed, Subtitle) for title streams.
   - `episode_language` resolves language audio support mapping directly to individual episodes.
   - `content_platform` tracks availability date ranges and regional limits per OTT platform.

---

## 5. Relational Model (Schema Breakdown)

Below is the relational schema corresponding to the MySQL database tables.

```
• actor (actor_id [PK], name)
• genre (genre_id [PK], genre_name [UNIQUE])
• language (language_id [PK], language_name [UNIQUE])
• ott_platform (platform_id [PK], name [UNIQUE])

• content (content_id [PK], title, release_year, type [ENUM('Movie', 'Series')], tmdb_id [UNIQUE], poster_path, rating, description)
• movie (content_id [PK, FK ➔ content], duration)
• series (content_id [PK, FK ➔ content], total_seasons)

• season (season_id [PK], series_id [FK ➔ series], season_number)
• episode (episode_id [PK], season_id [FK ➔ season], title, episode_number, duration)

• content_actor (content_id [PK, FK ➔ content], actor_id [PK, FK ➔ actor], role_name)
• content_genre (content_id [PK, FK ➔ content], genre_id [PK, FK ➔ genre])
• content_language (content_id [PK, FK ➔ content], language_id [PK, FK ➔ language], type [PK, ENUM('Original', 'Dubbed', 'Subtitle')])
• episode_language (episode_id [PK, FK ➔ episode], language_id [PK, FK ➔ language], type [PK, ENUM(...)])
• content_platform (content_id [PK, FK ➔ content], platform_id [PK, FK ➔ ott_platform], available_from [PK], available_till, region)

• watchlist (watchlist_id [PK], content_id, content_name, release_year, type, poster_path, rating)
• watchlist_count (total)
```

---

## 6. Normalization Analysis (3NF)

To ensure high data integrity, minimize redundancy, and prevent anomalous updates, the database design adheres to the **Third Normal Form (3NF)**:

* **First Normal Form (1NF):** Every attribute contains atomic values (no lists or comma-separated values). Each table has a defined primary key (or composite keys) that uniquely identifies a row.
* **Second Normal Form (2NF):** Satisfies 1NF and guarantees that all non-key attributes are fully functionally dependent on the entire primary key. In many-to-many junction tables like `content_actor` or `content_platform`, composite primary keys prevent partial dependencies.
* **Third Normal Form (3NF):** Satisfies 2NF and ensures that no transitive dependencies exist. For example, `genre_name` is stored in the `genre` table dependent on `genre_id` rather than on `content_id` directly, preventing update anomalies when genres are reassigned.
* **Specialization Pattern:** Specializing `content` into separate `movie` and `series` tables using a 1:1 shared primary key avoids nullable columns (e.g., `duration` is only present in `movie`; `total_seasons` is only present in `series`).

---

## 7. DBMS Implementations & SQL Code

Here are the SQL DDL/DML implementations for the advanced database components:

### Triggers

#### 1. Increment Watchlist Count (`trg_watchlist_increment`)
Automatically increments the total count in `watchlist_count` whenever a new item is added to the user's watchlist.
```sql
DELIMITER $$
CREATE TRIGGER trg_watchlist_increment
AFTER INSERT ON watchlist
FOR EACH ROW
BEGIN
    UPDATE watchlist_count
    SET total = total + 1;
END $$
DELIMITER ;
```

#### 2. Decrement Watchlist Count (`trg_watchlist_decrement`)
Automatically decrements the total count in `watchlist_count` whenever an item is removed from the user's watchlist.
```sql
DELIMITER $$
CREATE TRIGGER trg_watchlist_decrement
AFTER DELETE ON watchlist
FOR EACH ROW
BEGIN
    UPDATE watchlist_count
    SET total = total - 1;
END $$
DELIMITER ;
```

---

### Stored Procedures

#### 1. Retrieve Content by Genre (`GetContentByGenre`)
Fetches all matching content (movies or series) associated with a given genre, listing their aggregated metadata ordered by rating.
```sql
DELIMITER $$
CREATE PROCEDURE GetContentByGenre(IN g_name VARCHAR(100))
BEGIN
    SELECT DISTINCT
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
    LEFT JOIN movie m ON m.content_id = c.content_id
    LEFT JOIN series s ON s.content_id = c.content_id
    JOIN content_genre cg ON cg.content_id = c.content_id
    JOIN genre g ON g.genre_id = cg.genre_id
    WHERE g.genre_name = g_name
    ORDER BY c.rating DESC;
END $$
DELIMITER ;
```

#### 2. CineMatch Recommendation Engine (`GetCineMatchRecommendations`)
Filters content based on multi-parameter user inputs (vibe/genre, type, maximum duration, release era, and minimum rating) to generate randomized personalized recommendations.
```sql
DELIMITER //
CREATE PROCEDURE GetCineMatchRecommendations(
    IN p_vibe VARCHAR(100), 
    IN p_type_preference VARCHAR(20), 
    IN p_max_duration INT, 
    IN p_min_year INT, 
    IN p_min_rating FLOAT
)
BEGIN
    SELECT DISTINCT
        c.content_id, c.title, c.release_year, c.type, c.tmdb_id, 
        c.poster_path, c.rating, c.description, m.duration, s.total_seasons
    FROM content c
    LEFT JOIN content_genre cg ON c.content_id = cg.content_id
    LEFT JOIN genre g ON cg.genre_id = g.genre_id
    LEFT JOIN movie m ON c.content_id = m.content_id
    LEFT JOIN series s ON c.content_id = s.content_id
    WHERE (p_min_rating IS NULL OR c.rating >= p_min_rating)
      AND (p_min_year IS NULL OR c.release_year >= p_min_year)
      AND (p_vibe IS NULL OR g.genre_name LIKE CONCAT('%', p_vibe, '%'))
      AND (p_type_preference IS NULL 
           OR (c.type = 'Movie' AND p_type_preference = 'Movie' AND (p_max_duration IS NULL OR m.duration IS NULL OR m.duration <= p_max_duration))
           OR (c.type = 'Series' AND p_type_preference = 'Series' AND (p_max_duration IS NULL OR s.total_seasons IS NULL OR s.total_seasons <= p_max_duration)))
    ORDER BY c.rating DESC, RAND() LIMIT 10;
END //
DELIMITER ;
```

---

### User-Defined Functions (UDFs)

#### 1. Retrieve Content by Type (`GetContentByType`)
Returns a aggregated JSON array containing all content metadata matching a specific type (`Movie` or `Series`).
```sql
DELIMITER $$
CREATE FUNCTION GetContentByType(p_type VARCHAR(10))
RETURNS JSON
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE result JSON;
    SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
            'content_id', c.content_id,
            'title', c.title,
            'release_year', c.release_year,
            'type', c.type,
            'rating', c.rating,
            'poster_path', c.poster_path,
            'description', c.description
        )
    ) INTO result
    FROM content c
    WHERE c.type = p_type;
    RETURN COALESCE(result, JSON_ARRAY());
END $$
DELIMITER ;
```

#### 2. Retrieve Content by Release Year (`GetContentByReleaseYear`)
Returns a JSON array containing details of all contents released in a specified year.
```sql
DELIMITER $$
CREATE FUNCTION GetContentByReleaseYear(p_year INT)
RETURNS JSON
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE result JSON;
    SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
            'content_id', c.content_id,
            'title', c.title,
            'release_year', c.release_year,
            'type', c.type,
            'rating', c.rating,
            'poster_path', c.poster_path,
            'description', c.description
        )
    ) INTO result
    FROM content c
    WHERE c.release_year = p_year;
    RETURN COALESCE(result, JSON_ARRAY());
END $$
DELIMITER ;
```

---

### Cursors

#### 1. Print All Content Names (`ShowAllContent`)
Iterates sequentially over all content records in the database, fetching and outputting titles.
```sql
DELIMITER $$
CREATE PROCEDURE ShowAllContent()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE cname VARCHAR(255);
    DECLARE cur CURSOR FOR SELECT title FROM content;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO cname;
        IF done THEN
            LEAVE read_loop;
        END IF;
        SELECT cname;
    END LOOP;
    
    CLOSE cur;
END $$
DELIMITER ;
```

#### 2. Count Movies (`CountMovies`)
Iterates through all content type rows using a database cursor to count and return the total number of content items classified as 'Movie'.
```sql
DELIMITER $$
CREATE PROCEDURE CountMovies()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE ctype VARCHAR(10);
    DECLARE total INT DEFAULT 0;
    
    DECLARE cur CURSOR FOR SELECT type FROM content;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO ctype;
        IF done THEN
            LEAVE read_loop;
        END IF;
        IF ctype = 'Movie' THEN
            SET total = total + 1;
        END IF;
    END LOOP;
    
    CLOSE cur;
    SELECT total AS total_movies;
END $$
DELIMITER ;
```

---

### Transactions
Ensures transactional integrity (ACID compliance) for compound updates on watchlist components. The transaction commits if operations complete successfully or issues a rollback if an error occurs.
```sql
START TRANSACTION;

INSERT INTO watchlist (content_id, content_name, release_year, type, poster_path, rating)
VALUES (5, 'Inception', 2010, 'Movie', '/qmDkWeJ0L12Hz6Plre9oiAQQSkQ.jpg', 8.8);

-- If an error is caught during runtime:
ROLLBACK;

-- If successful:
COMMIT;
```

---

### Views

#### Content Details View (`vw_content_details`)
Provides a pre-joined, denormalized view aggregating general metadata with specialized movie duration and series season properties. This view simplifies report generation and query writing.
```sql
CREATE OR REPLACE VIEW vw_content_details AS
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
LEFT JOIN movie m ON m.content_id = m.content_id
LEFT JOIN series s ON s.content_id = s.content_id;
```

---

### Indexes
To optimize retrieval performance on frequently joined, filtered, or searched attributes, the database implements indexing:
```sql
-- Speed up content type lookups (Movie vs Series categorization filtering)
CREATE INDEX idx_content_type ON content(type);

-- Speed up filtering by release timelines
CREATE INDEX idx_content_release_year ON content(release_year);

-- Speed up genre-based filtering in content_genre junction table joins
CREATE INDEX idx_content_genre ON content_genre(genre_id);
```

---

## 8. Novelty - CineMatch Recommendation Quiz

The key differentiator in CineVerse's feature set is the **CineMatch Recommendation Quiz**. 

* **No Tracking Necessary:** Unlike modern streaming applications that track watch history and user behaviors to build algorithms, CineMatch is entirely preference-based.
* **Database-Driven Engine:** A 4-question interactive questionnaire gathers user preferences on genre/vibe, content medium, maximum runtime, and release era.
* **Instant Recommendations:** These choices are converted directly into inputs passed to the `GetCineMatchRecommendations` stored procedure. Database-level execution returns up to 10 matching, high-quality, randomized options in real time.

---

## 9. Application Architecture

CineVerse follows clean software design principles:

### Backend Architecture:
* **Controller-Repository Pattern:** Decouples API route logic from data access operations.
* **SQLMovieRepository:** Directly handles connection pool queries, executes raw SQL queries, and fires stored procedures (e.g. `GetCineMatchRecommendations`).
* **Connection Pooling:** Uses standard `mysql2/promise` pooling in `connection.ts` for handling concurrent requests.

### Frontend Architecture:
* **Componentized Design:** Clean separation of UI blocks (Navbar, footer, interactive cards, hero banners, filter bars).
* **Client-Side Watchlist Context:** Implements a `WatchlistProvider` utilizing React Context and a reducer to persist user watchlist arrays to `localStorage`.
* **CSS Variable Theme:** Built around dark aesthetics using design tokens for typography, layouts, and colors (Emerald/Lime accents with dark obsidian background gradients).

---

## 10. Setup & Installation

### Prerequisites
* **Node.js** (version 18 or above)
* **MySQL Server**

### 1. Database Setup
1. Launch your local MySQL client.
2. Create a database called `project`:
   ```sql
   CREATE DATABASE project;
   ```
3. Import the base table schemas:
   ```bash
   mysql -u root -p project < CODE/backend/schema.sql
   ```
4. Define your stored procedures, triggers, functions, cursors, and views by executing the SQL statements listed in the [DBMS Implementations & SQL Code](#7-dbms-implementations--sql-code) section within your MySQL database tool.

### 2. Backend Initialization
1. Navigate to the backend directory:
   ```bash
   cd CODE/backend
   ```
2. Install the node packages:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root of the `backend` folder and populate it with your database credentials:
   ```env
   PORT=5000
   DB_HOST=127.0.0.1
   DB_USER=your_mysql_username
   DB_PASSWORD=your_mysql_password
   DB_NAME=project
   ```
4. Run the TypeScript development server:
   ```bash
   npm run dev
   ```
   The backend server should run on `http://localhost:5000`.

### 3. Frontend Initialization
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd CODE/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   Open the application in your browser at `http://localhost:5173`.

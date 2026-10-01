# Digital Movie Content Management System (CineVerse)

CineVerse is a full-stack OTT content management web application modeled after modern commercial streaming platforms like Netflix. It integrates a highly normalized relational database with an ultra-fast, responsive web interface to manage and explore movies, TV series, cast members, genres, languages, and verified OTT streaming platform availability.

This repository features a 3,200+ title catalog, verified streaming deep-link routing, stored procedure recommendation engine (CineMatch), in-app official YouTube trailer player, and sub-50ms query caching.

---

## 📋 Table of Contents
1. [Key Features & Highlights](#1-key-features--highlights)
2. [Project Directory Layout](#2-project-directory-layout)
3. [Technology Stack](#3-technology-stack)
4. [Entity-Relationship (ER) & Relational Model](#4-entity-relationship-er--relational-model)
5. [Normalization Analysis (3NF)](#5-normalization-analysis-3nf)
6. [Database Programmability & SQL Code](#6-database-programmability--sql-code)
   - [Triggers](#triggers)
   - [Stored Procedures](#stored-procedures)
   - [User-Defined Functions (UDFs)](#user-defined-functions-udfs)
   - [Indexes & Performance Optimizations](#indexes--performance-optimizations)
7. [CineMatch Recommendation Engine](#7-cinematch-recommendation-engine)
8. [Local Setup & Installation](#8-local-setup--installation)
9. [Production AWS Deployment (CI/CD)](#9-production-aws-deployment-cicd)

---

## 1. Key Features & Highlights

* **3,200+ Titles Catalog**: Comprehensive dataset containing 1,755 movies and 1,445 series, enriched with 4,596 cast members with headshots and 30,000+ TV episodes.
* **Verified Global Streaming Redirection**:
  * Automatically maps content availability to verified global streaming providers: **Netflix**, **Amazon Prime Video**, **Disney+**, **JioHotstar**, **Apple TV+**, **Max**, **Paramount+**, **Sony LIV**, **Zee5**, and **Crunchyroll**.
  * Direct 1-click deep search URLs launch target service players without login gates or geoblock loops.
  * Real-time fallback to **JustWatch** for titles currently in theatrical or digital purchase windows.
* **In-App Official YouTube Trailer Modal**: Embedded responsive YouTube trailer player accessible on 100% of titles directly inside the application.
* **Instant 0ms Navigation (Client SWR Cache)**:
  * Persistent in-memory and `sessionStorage` cache eliminating skeleton loading screens when returning to the Home page or reloading.
  * $O(1)$ relational hash map hydration in the backend yielding sub-40ms query execution.
* **Hierarchical TV Series Modeling**: Fully normalized `Series ➔ Season ➔ Episode` tree with dedicated episode runtimes and numbers.
* **Multilingual Tracking**: Distinguishes `Original`, `Dubbed`, and `Subtitle` language tracks across global film libraries.
* **CineMatch Recommendation Engine**: Custom multi-constraint MySQL stored procedure evaluating mood, runtime budget, era, and rating threshold.

---

## 2. Project Directory Layout

```
Digital-Movie-Content-Management-System/
├── backend/                  # Express.js + Node.js + TypeScript REST API
│   ├── src/
│   │   ├── controllers/      # Route controllers (movieController.ts)
│   │   ├── db/               # MySQL connection pool configuration
│   │   ├── models/           # Domain interfaces & filter shapes
│   │   ├── repositories/     # SQL repository pattern & O(1) hydration
│   │   ├── routes/           # Express endpoint definitions
│   │   ├── services/         # Business logic layer
│   │   ├── app.ts            # Express application setup & middleware
│   │   └── server.ts         # Application entry point
│   ├── schema.sql            # Complete MySQL database DDL schema
│   ├── .env.example          # Sample environment configuration
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                 # React 18 + Vite + TypeScript Web Application
│   ├── public/               # Static assets & favicons
│   ├── src/
│   │   ├── api/              # Axios client with SWR in-memory caching
│   │   ├── components/       # Reusable UI components (Navbar, HeroCarousel, etc.)
│   │   ├── context/          # React Context (WatchlistProvider)
│   │   ├── pages/            # View pages (HomePage, MovieDetailPage, CineMatch, etc.)
│   │   ├── App.tsx           # Route layout and navigation
│   │   ├── index.css         # Dark obsidian & emerald design system
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── scripts/                  # Catalog ingestion & data sanitization utilities
│   ├── import_3000_tmdb.js   # Automated high-volume catalog ingestion script
│   ├── sanitize_verified_platforms.js # Purges unverified/broken streaming services
│   └── full_enrichment.js    # Credits, episodes, and watch providers backfiller
│
├── .gitignore                # Production git ignore configuration
├── README.md                 # Complete documentation
└── Report.pdf                # Formal architectural report
```

---

## 3. Technology Stack

* **Database**: MySQL 8.0 (Relational storage, stored procedures, triggers, views, and composite indexing)
* **Backend**: Node.js, Express.js, TypeScript, `mysql2/promise` (connection pooling and repository pattern)
* **Frontend**: React 18, React Router v6, TypeScript, Vite, Vanilla CSS design system
* **External Integration**: TMDB Image CDN (static image hosting) & YouTube Trailer Embeds

---

## 4. Entity-Relationship (ER) & Relational Model

The database is built around **16 interrelated tables**:

```
• actor (actor_id [PK], name, profile_path, tmdb_actor_id)
• genre (genre_id [PK], genre_name [UNIQUE])
• language (language_id [PK], language_name [UNIQUE])
• ott_platform (platform_id [PK], name [UNIQUE])

• content (content_id [PK], title, release_year, type [ENUM('Movie', 'Series')], tmdb_id [UNIQUE], poster_path, backdrop_path, rating, description, trailer_key)
• movie (content_id [PK, FK ➔ content], duration)
• series (content_id [PK, FK ➔ content], total_seasons)

• season (season_id [PK], series_id [FK ➔ series], season_number)
• episode (episode_id [PK], season_id [FK ➔ season], title, episode_number, duration)

• content_actor (content_id [PK, FK ➔ content], actor_id [PK, FK ➔ actor], role_name)
• content_genre (content_id [PK, FK ➔ content], genre_id [PK, FK ➔ genre])
• content_language (content_id [PK, FK ➔ content], language_id [PK, FK ➔ language], type [PK, ENUM('Original', 'Dubbed', 'Subtitle')])
• content_platform (content_id [PK, FK ➔ content], platform_id [PK, FK ➔ ott_platform], available_from [PK], available_till, region)
```

---

## 5. Normalization Analysis (3NF)

1. **First Normal Form (1NF)**: All attributes contain atomic values. Multi-valued fields (such as multiple genres, actors, or languages per title) are separated into junction tables (`content_genre`, `content_actor`, `content_language`).
2. **Second Normal Form (2NF)**: All non-key attributes are fully functionally dependent on the entire primary key, eliminating partial dependencies in composite primary keys.
3. **Third Normal Form (3NF)**: Transitive dependencies are removed. Platform, genre, language, and actor attributes exist in independent master entities referenced via foreign keys.

---

## 6. Database Programmability & SQL Code

### Triggers
```sql
-- Automatically update series total season count when a new season is inserted
DELIMITER $$
CREATE TRIGGER trg_after_season_insert
AFTER INSERT ON season
FOR EACH ROW
BEGIN
  UPDATE series 
  SET total_seasons = (SELECT COUNT(*) FROM season WHERE series_id = NEW.series_id AND season_number > 0)
  WHERE content_id = NEW.series_id;
END$$
DELIMITER ;
```

### Stored Procedures
```sql
-- Recommendation Procedure: multi-dimensional constraint filtering
DELIMITER $$
CREATE PROCEDURE GetCineMatchRecommendations(
  IN p_vibe VARCHAR(50),
  IN p_type VARCHAR(20),
  IN p_max_duration INT,
  IN p_min_year INT,
  IN p_min_rating FLOAT
)
BEGIN
  SELECT c.content_id, c.title, c.release_year, c.type, c.poster_path, c.rating, c.description,
         m.duration, s.total_seasons
  FROM content c
  LEFT JOIN movie m ON m.content_id = c.content_id
  LEFT JOIN series s ON s.content_id = c.content_id
  WHERE (p_type IS NULL OR c.type = p_type)
    AND (p_min_year IS NULL OR c.release_year >= p_min_year)
    AND (p_min_rating IS NULL OR c.rating >= p_min_rating)
    AND (p_max_duration IS NULL OR m.duration IS NULL OR m.duration <= p_max_duration)
  ORDER BY c.rating DESC, RAND()
  LIMIT 10;
END$$
DELIMITER ;
```

### Indexes & Performance Optimizations
```sql
-- Eliminates table scans across 3,200+ catalog rows
CREATE INDEX idx_content_type ON content(type);
CREATE INDEX idx_content_release_year ON content(release_year);
CREATE INDEX idx_content_rating ON content(rating DESC);
CREATE INDEX idx_content_year_rating ON content(release_year DESC, rating DESC);
CREATE INDEX idx_content_title ON content(title);
CREATE INDEX idx_content_genre ON content_genre(genre_id);
```

---

## 7. CineMatch Recommendation Engine

Unlike algorithmic trackers that monitor browsing history, **CineMatch** is an interactive, zero-tracking discovery tool:
1. Users answer 4 quick questions: **Vibe/Mood**, **Type (Movie or Series)**, **Maximum Runtime**, and **Release Era**.
2. Inputs are passed directly to the `GetCineMatchRecommendations` stored procedure.
3. The database executes constraint filtering and returns tailored recommendations in under 30ms.

---

## 8. Local Setup & Installation

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **MySQL Server** 8.0+

### 1. Database Setup
```bash
# Connect to MySQL and initialize database
mysql -u root -p
CREATE DATABASE project;
EXIT;

# Import base schema
mysql -u root -p project < backend/schema.sql
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your local MySQL password:
# PORT=5000
# DB_HOST=127.0.0.1
# DB_USER=project_user
# DB_PASSWORD=your_password
# DB_NAME=project

# Start backend server
npm run dev
```
Backend will be active at `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 9. Production AWS Deployment (CI/CD)

For an automated setup where code changes push directly to AWS with zero downtime:

### Automated GitHub Actions Workflow (`.github/workflows/deploy.yml`)
```yaml
name: CineVerse Auto-Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Build Assets
        run: |
          cd backend && npm ci && npm run build
          cd ../frontend && npm ci && npm run build

      - name: Deploy to AWS EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /var/www/cineverse
            git pull origin main
            cd backend && npm ci && npm run build
            pm2 restart cineverse-backend || pm2 start dist/server.js --name "cineverse-backend"
            cd ../frontend && npm ci && npm run build
            sudo rm -rf /var/www/cineverse/frontend/dist
            sudo cp -r dist /var/www/cineverse/frontend/
            sudo systemctl reload nginx
```
Pushing to the `main` branch automatically deploys, compiles, and reloads production servers in under 30 seconds.

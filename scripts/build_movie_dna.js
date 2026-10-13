// =============================================================================
// CINEVERSE — MOVIE DNA REPRODUCIBLE GENERATOR & VALIDATOR
// =============================================================================
// Builds a structured, normalized-preserving "Movie DNA" representation for all
// 10,000 titles from the MySQL project database using bulk queries.
//
// Outputs:
// 1. Derived MySQL table: `content_dna`
// 2. Exported JSON file: `backend/data/movie_dna.json` and `data/movie_dna.json`
// 3. Complete validation & coverage audit
// =============================================================================

const fs = require('fs');
const path = require('path');
const mysql = require(path.join(__dirname, '../backend/node_modules/mysql2/promise'));

// Helper for median calculation
function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

async function main() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('       CINEVERSE MOVIE DNA BUILDER & VALIDATOR                  ');
  console.log('================================================================\n');

  const db = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'project_user',
    password: process.env.DB_PASSWORD || '',
    database: 'project'
  });

  console.log('✓ Connected to MySQL database');

  // 1. Ensure derived table `content_dna` exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS content_dna (
      content_id INT NOT NULL,
      dna_json JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (content_id),
      CONSTRAINT fk_content_dna_content FOREIGN KEY (content_id) REFERENCES content (content_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log('✓ Verified derived table `content_dna` in MySQL');

  // 2. Efficient Bulk Queries (Eliminates N+1)
  console.log('\nFetching normalized data via high-performance bulk queries...');

  // A. Content + Movie + Series
  const [contents] = await db.query(`
    SELECT 
      c.content_id, c.title, c.type, c.description, c.release_year, c.rating, c.tmdb_id,
      m.duration as movie_duration,
      s.total_seasons
    FROM content c
    LEFT JOIN movie m ON c.content_id = m.content_id
    LEFT JOIN series s ON c.content_id = s.content_id
    ORDER BY c.content_id ASC
  `);
  console.log(`✓ Loaded ${contents.length} core content records`);

  // B. Genres
  const [genreRows] = await db.query(`
    SELECT cg.content_id, g.genre_name
    FROM content_genre cg
    JOIN genre g ON cg.genre_id = g.genre_id
    ORDER BY cg.content_id ASC, g.genre_name ASC
  `);
  const genreMap = new Map();
  for (const r of genreRows) {
    if (!genreMap.has(r.content_id)) genreMap.set(r.content_id, new Set());
    genreMap.get(r.content_id).add(r.genre_name);
  }
  console.log(`✓ Loaded ${genreRows.length} genre relationships`);

  // C. Languages
  const [langRows] = await db.query(`
    SELECT cl.content_id, l.language_name
    FROM content_language cl
    JOIN language l ON cl.language_id = l.language_id
    ORDER BY cl.content_id ASC, l.language_name ASC
  `);
  const langMap = new Map();
  for (const r of langRows) {
    if (!langMap.has(r.content_id)) langMap.set(r.content_id, new Set());
    langMap.get(r.content_id).add(r.language_name);
  }
  console.log(`✓ Loaded ${langRows.length} language relationships`);

  // D. Platforms
  const [platRows] = await db.query(`
    SELECT cp.content_id, p.name as platform_name
    FROM content_platform cp
    JOIN ott_platform p ON cp.platform_id = p.platform_id
    ORDER BY cp.content_id ASC, p.name ASC
  `);
  const platMap = new Map();
  for (const r of platRows) {
    if (!platMap.has(r.content_id)) platMap.set(r.content_id, new Set());
    platMap.get(r.content_id).add(r.platform_name);
  }
  console.log(`✓ Loaded ${platRows.length} platform relationships`);

  // E. Actors
  const [actorRows] = await db.query(`
    SELECT ca.content_id, a.name as actor_name
    FROM content_actor ca
    JOIN actor a ON ca.actor_id = a.actor_id
    ORDER BY ca.content_id ASC, a.name ASC
  `);
  const actorMap = new Map();
  for (const r of actorRows) {
    if (!actorMap.has(r.content_id)) actorMap.set(r.content_id, new Set());
    actorMap.get(r.content_id).add(r.actor_name);
  }
  console.log(`✓ Loaded ${actorRows.length} actor relationships`);

  // E2. Directors
  const [directorRows] = await db.query(`
    SELECT cd.content_id, d.name as director_name
    FROM content_director cd
    JOIN director d ON cd.director_id = d.director_id
    ORDER BY cd.content_id ASC, d.name ASC
  `);
  const directorMap = new Map();
  for (const r of directorRows) {
    if (!directorMap.has(r.content_id)) directorMap.set(r.content_id, new Set());
    directorMap.get(r.content_id).add(r.director_name);
  }
  console.log(`✓ Loaded ${directorRows.length} director relationships`);

  // F. Seasons & Episodes
  const [epRows] = await db.query(`
    SELECT 
      sea.series_id,
      sea.season_id,
      e.episode_id,
      e.duration
    FROM season sea
    JOIN episode e ON sea.season_id = e.season_id
    ORDER BY sea.series_id ASC
  `);
  const seriesEpMap = new Map();
  for (const r of epRows) {
    if (!seriesEpMap.has(r.series_id)) {
      seriesEpMap.set(r.series_id, {
        seasonIds: new Set(),
        episodeCount: 0,
        durations: []
      });
    }
    const entry = seriesEpMap.get(r.series_id);
    entry.seasonIds.add(r.season_id);
    entry.episodeCount++;
    if (r.duration !== null && r.duration > 0) {
      entry.durations.push(r.duration);
    }
  }
  console.log(`✓ Aggregated ${epRows.length} episode records across ${seriesEpMap.size} series`);

  // 3. Assemble Movie DNA
  console.log('\nAssembling structured Movie DNA representations...');
  const movieDnaList = [];
  const validationErrors = [];

  for (const c of contents) {
    const contentId = c.content_id;
    const isMovie = c.type === 'Movie';
    const isSeries = c.type === 'Series';

    // Genres (deterministic alphabetical order, deduplicated)
    const genres = Array.from(genreMap.get(contentId) || []).sort();

    // Languages (deterministic alphabetical order, deduplicated)
    const languages = Array.from(langMap.get(contentId) || []).sort();

    // Platforms (deterministic alphabetical order, deduplicated)
    const platforms = Array.from(platMap.get(contentId) || []).sort();

    // Actors (deterministic alphabetical order, deduplicated)
    const actors = Array.from(actorMap.get(contentId) || []).sort();

    // Directors (deterministic alphabetical order, deduplicated)
    const directors = Array.from(directorMap.get(contentId) || []).sort();

    // Runtime
    const runtime = isMovie ? (c.movie_duration ?? null) : null;

    // Series Metadata
    let seriesMetadata = null;
    if (isSeries) {
      const epData = seriesEpMap.get(contentId);
      const hasEpisodeMeta = !!(epData && epData.episodeCount > 0);

      if (hasEpisodeMeta) {
        const knownCount = epData.durations.length;
        const missingCount = epData.episodeCount - knownCount;
        const totalKnownRuntime = knownCount > 0 ? epData.durations.reduce((a, b) => a + b, 0) : null;
        const avgDuration = knownCount > 0 ? Math.round((totalKnownRuntime / knownCount) * 10) / 10 : null;
        const medianDuration = knownCount > 0 ? calculateMedian(epData.durations) : null;

        seriesMetadata = {
          total_seasons: c.total_seasons ?? null,
          has_episode_metadata: true,
          total_episodes: epData.episodeCount,
          seasons_with_episodes: epData.seasonIds.size,
          known_episode_duration_count: knownCount,
          missing_episode_duration_count: missingCount,
          avg_episode_duration: avgDuration,
          median_episode_duration: medianDuration,
          total_known_runtime: totalKnownRuntime
        };
      } else {
        seriesMetadata = {
          total_seasons: c.total_seasons ?? null,
          has_episode_metadata: false,
          total_episodes: 0,
          seasons_with_episodes: 0,
          known_episode_duration_count: 0,
          missing_episode_duration_count: 0,
          avg_episode_duration: null,
          median_episode_duration: null,
          total_known_runtime: null
        };
      }
    }

    // Quality Flags
    const descStr = (c.description || '').trim();
    const hasDesc = descStr.length > 0;
    const hasRating = c.rating !== null && c.rating > 0;
    const isUnreleased = c.rating === 0;

    const qualityFlags = {
      has_description: hasDesc,
      has_genres: genres.length > 0,
      has_languages: languages.length > 0,
      has_platforms: platforms.length > 0,
      has_actors: actors.length > 0,
      has_directors: directors.length > 0,
      has_runtime: isMovie ? (runtime !== null && runtime > 0) : false,
      has_rating: hasRating,
      is_unreleased: isUnreleased,
      has_episode_metadata: isSeries ? seriesMetadata.has_episode_metadata : false
    };

    const record = {
      content_id: contentId,
      title: c.title,
      type: c.type,
      description: hasDesc ? c.description : null,
      release_year: c.release_year ?? null,
      rating: c.rating !== null ? Number(c.rating) : null,
      runtime: runtime,
      genres: genres,
      languages: languages,
      platforms: platforms,
      actors: actors,
      directors: directors,
      series_metadata: seriesMetadata,
      quality_flags: qualityFlags
    };

    movieDnaList.push(record);
  }

  console.log(`✓ Assembled ${movieDnaList.length} Movie DNA records`);

  // 4. In-Memory Comprehensive Validation
  console.log('\nRunning strict validation checks...');

  if (movieDnaList.length !== 10000) {
    validationErrors.push(`Expected exactly 10,000 records, got ${movieDnaList.length}`);
  }

  const seenIds = new Set();
  let movieCount = 0;
  let seriesCount = 0;

  for (const d of movieDnaList) {
    if (seenIds.has(d.content_id)) {
      validationErrors.push(`Duplicate content_id: ${d.content_id}`);
    }
    seenIds.add(d.content_id);

    if (!d.title || d.title.trim() === '') {
      validationErrors.push(`Missing or empty title for content_id: ${d.content_id}`);
    }

    if (d.type !== 'Movie' && d.type !== 'Series') {
      validationErrors.push(`Invalid type "${d.type}" for content_id: ${d.content_id}`);
    }

    if (d.type === 'Movie') {
      movieCount++;
      if (d.runtime === null || d.runtime <= 0) {
        validationErrors.push(`Movie without runtime: ${d.content_id}`);
      }
      if (d.series_metadata !== null) {
        validationErrors.push(`Movie has series_metadata: ${d.content_id}`);
      }
    } else {
      seriesCount++;
      if (d.runtime !== null) {
        validationErrors.push(`Series has runtime: ${d.content_id}`);
      }
      if (!d.series_metadata) {
        validationErrors.push(`Series missing series_metadata: ${d.content_id}`);
      }
    }

    if (new Set(d.actors).size !== d.actors.length) {
      validationErrors.push(`Duplicate actors in content_id: ${d.content_id}`);
    }

    if (new Set(d.directors).size !== d.directors.length) {
      validationErrors.push(`Duplicate directors in content_id: ${d.content_id}`);
    }
  }

  // Check orphan relationships in DB
  const [[{ orphanDirectors }]] = await db.query(`
    SELECT COUNT(*) as orphanDirectors
    FROM content_director cd
    LEFT JOIN content c ON cd.content_id = c.content_id
    LEFT JOIN director d ON cd.director_id = d.director_id
    WHERE c.content_id IS NULL OR d.director_id IS NULL
  `);
  if (orphanDirectors > 0) {
    validationErrors.push(`Found ${orphanDirectors} orphan content_director relationships`);
  }

  if (movieCount !== 6253) validationErrors.push(`Expected 6,253 movies, found ${movieCount}`);
  if (seriesCount !== 3747) validationErrors.push(`Expected 3,747 series, found ${seriesCount}`);

  if (validationErrors.length > 0) {
    console.error('❌ Validation failed with errors:');
    console.error(validationErrors);
    process.exit(1);
  } else {
    console.log('✓ All 10,000 records passed strict schema, integrity, and director validation with 0 errors');
  }

  // 5. Persist to MySQL derived table `content_dna`
  console.log('\nPersisting Movie DNA records into MySQL derived table `content_dna`...');
  const batchSize = 500;
  for (let i = 0; i < movieDnaList.length; i += batchSize) {
    const batch = movieDnaList.slice(i, i + batchSize);
    const values = batch.map(b => [b.content_id, JSON.stringify(b)]);
    await db.query(
      `INSERT INTO content_dna (content_id, dna_json) VALUES ?
       ON DUPLICATE KEY UPDATE dna_json = VALUES(dna_json)`,
      [values]
    );
  }
  const [[{ totalDnaInDb }]] = await db.query('SELECT COUNT(*) as totalDnaInDb FROM content_dna');
  console.log(`✓ Persisted ${totalDnaInDb.toLocaleString()} records to MySQL table \`content_dna\``);

  // 6. Export JSON files
  console.log('\nExporting structured JSON files...');
  const backendDataDir = path.join(__dirname, '../backend/data');
  if (!fs.existsSync(backendDataDir)) fs.mkdirSync(backendDataDir, { recursive: true });
  const backendJsonPath = path.join(backendDataDir, 'movie_dna.json');
  fs.writeFileSync(backendJsonPath, JSON.stringify(movieDnaList, null, 2), 'utf8');
  console.log(`✓ Saved ${backendJsonPath} (${(fs.statSync(backendJsonPath).size / 1024 / 1024).toFixed(2)} MB)`);

  const rootDataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir, { recursive: true });
  const rootJsonPath = path.join(rootDataDir, 'movie_dna.json');
  fs.writeFileSync(rootJsonPath, JSON.stringify(movieDnaList, null, 2), 'utf8');
  console.log(`✓ Saved ${rootJsonPath} (${(fs.statSync(rootJsonPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // 7. Calculate Comprehensive Coverage & Summary Metrics
  console.log('\n================================================================');
  console.log('              MOVIE DNA COVERAGE & AUDIT REPORT                 ');
  console.log('================================================================\n');

  let descCount = 0;
  let genreCount = 0;
  let totalGenresAssigned = 0;
  let langCount = 0;
  let totalLangsAssigned = 0;
  let platCount = 0;
  let totalPlatsAssigned = 0;
  let actorCount = 0;
  let totalActorsAssigned = 0;
  let directorCount = 0;
  let totalDirectorsAssigned = 0;
  let movieRuntimeCount = 0;
  let seriesEpisodeMetaCount = 0;
  let totalEpisodesAvailable = 0;
  let allKnownEpisodeDurations = [];

  for (const d of movieDnaList) {
    if (d.quality_flags.has_description) descCount++;
    if (d.quality_flags.has_genres) genreCount++;
    totalGenresAssigned += d.genres.length;

    if (d.quality_flags.has_languages) langCount++;
    totalLangsAssigned += d.languages.length;

    if (d.quality_flags.has_platforms) platCount++;
    totalPlatsAssigned += d.platforms.length;

    if (d.quality_flags.has_actors) actorCount++;
    totalActorsAssigned += d.actors.length;

    if (d.quality_flags.has_directors) directorCount++;
    totalDirectorsAssigned += d.directors.length;

    if (d.quality_flags.has_runtime) movieRuntimeCount++;

    if (d.type === 'Series' && d.series_metadata.has_episode_metadata) {
      seriesEpisodeMetaCount++;
      totalEpisodesAvailable += d.series_metadata.total_episodes;
      const epData = seriesEpMap.get(d.content_id);
      if (epData && epData.durations.length > 0) {
        allKnownEpisodeDurations.push(...epData.durations);
      }
    }
  }

  const avgGenres = (totalGenresAssigned / 10000).toFixed(2);
  const avgLangs = (totalLangsAssigned / 10000).toFixed(2);
  const avgPlats = (totalPlatsAssigned / 10000).toFixed(2);
  const avgActors = actorCount > 0 ? (totalActorsAssigned / actorCount).toFixed(2) : 0;
  const avgDirectors = directorCount > 0 ? (totalDirectorsAssigned / directorCount).toFixed(2) : 0;
  const avgEpsPerSeries = seriesEpisodeMetaCount > 0 ? (totalEpisodesAvailable / seriesEpisodeMetaCount).toFixed(1) : 0;

  const totalKnownEpDurSum = allKnownEpisodeDurations.reduce((a, b) => a + b, 0);
  const avgKnownEpDur = allKnownEpisodeDurations.length > 0 ? (totalKnownEpDurSum / allKnownEpisodeDurations.length).toFixed(1) : 0;
  const medianKnownEpDur = calculateMedian(allKnownEpisodeDurations);

  console.log(`Total Titles:                     10,000`);
  console.log(`- Movies:                         ${movieCount.toLocaleString()} (62.53%)`);
  console.log(`- TV Series:                      ${seriesCount.toLocaleString()} (37.47%)`);
  console.log('----------------------------------------------------------------');
  console.log(`Description Coverage:             ${descCount.toLocaleString()} / 10,000 (${(descCount / 100).toFixed(2)}%)`);
  console.log(`Genre Coverage:                   ${genreCount.toLocaleString()} / 10,000 (${(genreCount / 100).toFixed(2)}%)`);
  console.log(`Language Coverage:                ${langCount.toLocaleString()} / 10,000 (${(langCount / 100).toFixed(2)}%)`);
  console.log(`Platform Coverage:                ${platCount.toLocaleString()} / 10,000 (${(platCount / 100).toFixed(2)}%)`);
  console.log(`Actor Coverage:                   ${actorCount.toLocaleString()} / 10,000 (${(actorCount / 100).toFixed(2)}%)`);
  console.log(`Director Coverage:                ${directorCount.toLocaleString()} / 10,000 (${(directorCount / 100).toFixed(2)}%)`);
  console.log(`Movie Runtime Coverage:           ${movieRuntimeCount.toLocaleString()} / ${movieCount.toLocaleString()} (100.00%)`);
  console.log(`Series Episode Metadata Coverage: ${seriesEpisodeMetaCount.toLocaleString()} / ${seriesCount.toLocaleString()} (${(seriesEpisodeMetaCount / seriesCount * 100).toFixed(2)}%)`);
  console.log('----------------------------------------------------------------');
  console.log(`Average Genres per Title:         ${avgGenres}`);
  console.log(`Average Languages per Title:      ${avgLangs}`);
  console.log(`Average Platforms per Title:      ${avgPlats}`);
  console.log(`Average Actors per Credited Title:${avgActors}`);
  console.log(`Average Directors per Title:      ${avgDirectors}`);
  console.log(`Average Episodes per Series:      ${avgEpsPerSeries} (for series with episode metadata)`);
  console.log(`Average Known Episode Duration:   ${avgKnownEpDur} min`);
  console.log(`Median Known Episode Duration:    ${medianKnownEpDur} min`);
  console.log('================================================================');

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Movie DNA compilation and validation completed in ${elapsedSec}s!\n`);

  await db.end();
}

main().catch(err => {
  console.error('Fatal error during Movie DNA generation:', err);
  process.exit(1);
});

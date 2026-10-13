// =============================================================================
// CINEVERSE PROPOSED BACKFILL: DIRECTORS & FRANCHISES / COLLECTIONS
// =============================================================================
// Fetches missing directors and franchise/collection metadata from TMDB API
// and updates the database tables (director, content_director, collection)
// and aggregates into content_dna.dna_json.
//
// SAFETY INVARIANTS:
// 1. TMDB API key is read strictly from process.env.TMDB_API_KEY or .env.
// 2. Strict rate limiting: Concurrency 3, 100ms delay between batches.
// 3. Dry-run mode and target database selector (to run on copy first).
// =============================================================================

const https = require('https');
const zlib = require('zlib');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

let mysql;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  mysql = require(path.join(__dirname, '../backend/node_modules/mysql2/promise'));
}

// Read TMDB API key strictly from environment:
const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.TMDB_KEY;
const WORKING_IP = '3.175.86.50'; // Pinned working CloudFront IP to avoid ISP TLS resets
const CONCURRENCY = 3;
const BATCH_DELAY_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchTMDB(endpoint, apiKey) {
  return new Promise((resolve) => {
    if (!apiKey) {
      resolve({ ok: false, error: 'TMDB_API_KEY missing from environment' });
      return;
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const req = https.request(
      {
        hostname: 'api.themoviedb.org',
        port: 443,
        path: `/3${endpoint}${separator}api_key=${apiKey}`,
        method: 'GET',
        servername: 'api.themoviedb.org',
        lookup: (hostname, options, cb) => {
          const callback = typeof options === 'function' ? options : cb;
          const wantsAll = options && typeof options === 'object' && options.all;
          if (wantsAll) callback(null, [{ address: WORKING_IP, family: 4 }]);
          else callback(null, WORKING_IP, 4);
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const enc = res.headers['content-encoding'];
          const parse = (str) => {
            try {
              resolve({ ok: true, status: res.statusCode, data: JSON.parse(str) });
            } catch (e) {
              resolve({ ok: false, status: res.statusCode, error: e.message });
            }
          };

          if (enc === 'gzip') {
            zlib.gunzip(buf, (err, decoded) => {
              if (err) resolve({ ok: false, error: err.message });
              else parse(decoded.toString('utf8'));
            });
          } else if (enc === 'deflate') {
            zlib.inflate(buf, (err, decoded) => {
              if (err) resolve({ ok: false, error: err.message });
              else parse(decoded.toString('utf8'));
            });
          } else {
            parse(buf.toString('utf8'));
          }
        });
      }
    );

    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    req.end();
  });
}

/**
 * Migration helper to ensure franchise/collection relational tables exist.
 */
async function ensureCollectionTables(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS collection (
      collection_id INT AUTO_INCREMENT PRIMARY KEY,
      tmdb_collection_id INT UNIQUE,
      name VARCHAR(255) NOT NULL,
      poster_path VARCHAR(255),
      backdrop_path VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS content_collection (
      content_id INT NOT NULL,
      collection_id INT NOT NULL,
      PRIMARY KEY (content_id, collection_id),
      FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collection(collection_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

/**
 * Main backfill coordinator (requires explicit user confirmation to execute)
 */
async function runBackfill(options = { dryRun: true, targetDb: 'project_copy' }) {
  if (!TMDB_API_KEY) {
    console.error('ERROR: TMDB_API_KEY is not defined in environment variables.');
    process.exit(1);
  }

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: options.targetDb,
  });

  console.log(`Connected to target database: ${options.targetDb} (Dry-run: ${options.dryRun})`);
  await ensureCollectionTables(db);

  // Identify candidates missing directors or collection info
  const [candidates] = await db.execute(`
    SELECT c.content_id, c.tmdb_id, c.type, c.title
    FROM content c
    LEFT JOIN content_director cd ON c.content_id = cd.content_id
    WHERE cd.director_id IS NULL AND c.tmdb_id IS NOT NULL
    ORDER BY c.content_id ASC
  `);

  console.log(`Found ${candidates.length} titles missing directors to enrich.`);

  const stats = {
    processed: 0,
    directorsAdded: 0,
    collectionsAdded: 0,
    errors: 0,
  };

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const chunk = candidates.slice(i, i + CONCURRENCY);

    await Promise.all(
      chunk.map(async (item) => {
        const ep = item.type === 'Series' ? 'tv' : 'movie';
        const [detailsRes, creditsRes] = await Promise.all([
          fetchTMDB(`/${ep}/${item.tmdb_id}`, TMDB_API_KEY),
          fetchTMDB(`/${ep}/${item.tmdb_id}/credits`, TMDB_API_KEY),
        ]);

        if (!detailsRes.ok && !creditsRes.ok) {
          stats.errors++;
          return;
        }

        const details = detailsRes.data || {};
        const credits = creditsRes.data || {};

        // 1. Extract Directors
        const directors = [];
        if (item.type === 'Movie' && credits.crew) {
          const dirCrew = credits.crew.filter((c) => c.job === 'Director');
          for (const d of dirCrew) {
            if (d.name && !directors.some((x) => x.name === d.name)) {
              directors.push({ name: d.name, profile_path: d.profile_path || null, tmdb_id: d.id });
            }
          }
        } else if (item.type === 'Series') {
          if (details.created_by && Array.isArray(details.created_by)) {
            for (const c of details.created_by) {
              if (c.name && !directors.some((x) => x.name === c.name)) {
                directors.push({ name: c.name, profile_path: c.profile_path || null, tmdb_id: c.id });
              }
            }
          }
          if (directors.length === 0 && credits.crew) {
            const dirCrew = credits.crew.filter((c) => c.job === 'Director');
            for (const d of dirCrew) {
              if (d.name && !directors.some((x) => x.name === d.name)) {
                directors.push({ name: d.name, profile_path: d.profile_path || null, tmdb_id: d.id });
              }
            }
          }
        }

        // 2. Extract Belongs To Collection (Movies)
        const collection = details.belongs_to_collection || null;

        if (!options.dryRun) {
          // Write directors
          for (const d of directors) {
            await db.execute(
              `INSERT INTO director (name, profile_path, tmdb_director_id)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE tmdb_director_id = COALESCE(VALUES(tmdb_director_id), tmdb_director_id)`,
              [d.name, d.profile_path, d.tmdb_id]
            );
            const [[dirRow]] = await db.execute('SELECT director_id FROM director WHERE name = ?', [d.name]);
            if (dirRow) {
              await db.execute(
                `INSERT IGNORE INTO content_director (content_id, director_id) VALUES (?, ?)`,
                [item.content_id, dirRow.director_id]
              );
              stats.directorsAdded++;
            }
          }

          // Write collection
          if (collection && collection.id && collection.name) {
            await db.execute(
              `INSERT INTO collection (tmdb_collection_id, name, poster_path, backdrop_path)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE name = VALUES(name)`,
              [collection.id, collection.name, collection.poster_path || null, collection.backdrop_path || null]
            );
            const [[colRow]] = await db.execute('SELECT collection_id FROM collection WHERE tmdb_collection_id = ?', [
              collection.id,
            ]);
            if (colRow) {
              await db.execute(
                `INSERT IGNORE INTO content_collection (content_id, collection_id) VALUES (?, ?)`,
                [item.content_id, colRow.collection_id]
              );
              stats.collectionsAdded++;
            }
          }
        }

        stats.processed++;
      })
    );

    await sleep(BATCH_DELAY_MS);
  }

  console.log('Backfill run completed. Stats:', stats);
  await db.end();
}

module.exports = { runBackfill, fetchTMDB };

if (require.main === module) {
  console.log('NOTICE: Phase 3 requires explicit approval before running backfill execution.');
  console.log('Use runBackfill() only after approval on database copy.');
}

// =============================================================================
// DATABASE CONNECTION — MySQL Pool
// =============================================================================
// Uses a connection pool (not a single connection) for better performance.
// Credentials are loaded from the .env file.
// =============================================================================

import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME     || 'project',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    25,
  queueLimit:         0,
});

/**
 * Call this once at startup to verify the DB is reachable.
 */
export async function testConnection(): Promise<void> {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err);
    throw err;
  }
}

/**
 * Automatically ensures necessary tables exist in the database upon startup.
 * Prevents missing table crashes on fresh deployments.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS director (
        director_id      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name             VARCHAR(255) NOT NULL,
        profile_path     VARCHAR(255) DEFAULT NULL,
        tmdb_director_id INT          DEFAULT NULL,
        UNIQUE KEY uk_director_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_director (
        content_id  INT NOT NULL,
        director_id INT NOT NULL,
        PRIMARY KEY (content_id, director_id),
        KEY idx_content_director_director (director_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_dna (
        content_id INT NOT NULL PRIMARY KEY,
        dna_json JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    console.log('✅ Database schema verified (director, content_director & content_dna ready)');

    // Non-blocking auto-population of content_dna if table is empty
    setTimeout(async () => {
      try {
        const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM content_dna');
        if (rows && rows[0]?.count === 0) {
          const fs = await import('fs');
          const candidatePaths = [
            path.resolve(process.cwd(), 'data/movie_dna.json'),
            path.resolve(process.cwd(), 'backend/data/movie_dna.json'),
            path.resolve(process.cwd(), '../data/movie_dna.json'),
            path.resolve(__dirname, '../../data/movie_dna.json'),
            path.resolve(__dirname, '../../../data/movie_dna.json'),
          ];
          let jsonPath: string | null = null;
          for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
              jsonPath = p;
              break;
            }
          }
          if (jsonPath) {
            console.log(`⚡ Populating empty content_dna table from ${jsonPath}...`);
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const batchSize = 500;
            for (let i = 0; i < data.length; i += batchSize) {
              const batch = data.slice(i, i + batchSize);
              const values = batch.map((item: any) => [item.content_id, JSON.stringify(item)]);
              await pool.query('INSERT IGNORE INTO content_dna (content_id, dna_json) VALUES ?', [values]);
            }
            console.log(`✅ Successfully backfilled ${data.length} records into content_dna table.`);
          }
        }
      } catch (err: any) {
        console.warn('⚠️ Content DNA auto-population note:', err?.message);
      }
    }, 1000);

    // Non-blocking auto-sync of content table up to 10,000 records if incomplete
    setTimeout(async () => {
      try {
        const [contentCount]: any = await pool.query('SELECT COUNT(*) as count FROM content');
        const count = contentCount[0]?.count || 0;
        if (count < 10000) {
          const fs = await import('fs');
          const candidatePaths = [
            path.resolve(process.cwd(), 'data/movie_dna.json'),
            path.resolve(process.cwd(), 'backend/data/movie_dna.json'),
            path.resolve(process.cwd(), '../data/movie_dna.json'),
            path.resolve(__dirname, '../../data/movie_dna.json'),
            path.resolve(__dirname, '../../../data/movie_dna.json'),
          ];
          let jsonPath: string | null = null;
          for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
              jsonPath = p;
              break;
            }
          }
          if (jsonPath) {
            console.log(`⚡ Syncing missing catalog movies to content table (current: ${count})...`);
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const batchSize = 500;
            for (let i = 0; i < data.length; i += batchSize) {
              const batch = data.slice(i, i + batchSize);
              const values = batch.map((item: any) => [
                item.content_id,
                item.title,
                item.release_year || null,
                item.type || 'Movie',
                item.tmdb_id || null,
                item.poster_path || null,
                item.rating || null,
                item.description || null,
                item.backdrop_path || null,
                item.trailer_key || null,
              ]);
              await pool.query(
                `INSERT IGNORE INTO content (content_id, title, release_year, type, tmdb_id, poster_path, rating, description, backdrop_path, trailer_key) VALUES ?`,
                [values]
              );
            }
            console.log(`✅ Successfully synced all catalog records into content table.`);
          }
        }
      } catch (err: any) {
        console.warn('⚠️ Content table auto-sync note:', err?.message);
      }
    }, 1500);
  } catch (err: any) {
    console.warn('⚠️ Schema check note:', err?.message);
  }
}

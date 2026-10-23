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
    console.log('✅ Database schema verified (director & content_director ready)');
  } catch (err: any) {
    console.warn('⚠️ Schema check note:', err?.message);
  }
}

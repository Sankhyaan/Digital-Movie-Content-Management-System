const path = require('path');
const mysql = require(path.join(__dirname, '../backend/node_modules/mysql2/promise'));

async function main() {
  const db = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'project_user',
    password: process.env.DB_PASSWORD || '',
    database: 'project'
  });

  console.log('✓ Connected to MySQL database');

  await db.query(`
    CREATE TABLE IF NOT EXISTS director (
      director_id      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name             VARCHAR(255) NOT NULL,
      profile_path     VARCHAR(255) DEFAULT NULL,
      tmdb_director_id INT          DEFAULT NULL,
      UNIQUE KEY uk_director_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS content_director (
      content_id  INT NOT NULL,
      director_id INT NOT NULL,
      PRIMARY KEY (content_id, director_id),
      KEY idx_content_director_director (director_id),
      FOREIGN KEY (content_id)  REFERENCES content(content_id)   ON DELETE CASCADE,
      FOREIGN KEY (director_id) REFERENCES director(director_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  console.log('✓ Tables director and content_director created successfully!');
  const [dCols] = await db.query('DESCRIBE director');
  console.log('director cols:', dCols.map(c => c.Field));
  const [cdCols] = await db.query('DESCRIBE content_director');
  console.log('content_director cols:', cdCols.map(c => c.Field));
  await db.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

import { pool } from './db/connection';

async function check() {
  const [rows]: any = await pool.query('SELECT content_id, title, type, release_year FROM content WHERE title LIKE ?', ['%Inside Out%']);
  console.log('Inside Out Matches:', rows);
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});

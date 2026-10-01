import { pool } from '../backend/src/db/connection.js';

async function test() {
  try {
    const [results] = await pool.query('CALL GetCineMatchRecommendations(NULL, NULL, NULL, NULL, NULL)');
    console.log("Results for all NULL:", results[0]);

    const [results2] = await pool.query('CALL GetCineMatchRecommendations("Sci-Fi", NULL, NULL, NULL, NULL)');
    console.log("Results for Sci-Fi:", results2[0]);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

test();

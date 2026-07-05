import { pool } from './src/db/connection';

async function update() {
  try {
    await pool.query('DROP PROCEDURE IF EXISTS GetCineMatchRecommendations');
    const createSql = `
CREATE PROCEDURE GetCineMatchRecommendations(
    IN p_vibe VARCHAR(100), IN p_type_preference VARCHAR(20), 
    IN p_max_duration INT, IN p_min_year INT, IN p_min_rating FLOAT
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
END;
    `;
    await pool.query(createSql);
    console.log("Procedure updated successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error updating procedure:", err);
    process.exit(1);
  }
}

update();

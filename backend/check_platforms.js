const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'project_user',
    password: 'Sankhu@2006',
    database: 'project'
  });

  const [platforms] = await conn.execute(`
    SELECT p.platform_id, p.name, COUNT(cp.content_id) as movie_count
    FROM ott_platform p
    LEFT JOIN content_platform cp ON p.platform_id = cp.platform_id
    GROUP BY p.platform_id, p.name
    ORDER BY movie_count DESC
  `);

  console.log('Platforms and movie count:');
  console.table(platforms);

  const [hulu] = await conn.execute(`
    SELECT cp.content_id, c.title, p.name as platform_name, cp.region
    FROM content_platform cp
    JOIN content c ON cp.content_id = c.content_id
    JOIN ott_platform p ON cp.platform_id = p.platform_id
    WHERE p.name LIKE '%Hulu%'
  `);
  console.log('Hulu entries:', hulu.length);
  if (hulu.length > 0) {
    console.table(hulu.slice(0, 10));
  }

  await conn.end();
}

main().catch(console.error);

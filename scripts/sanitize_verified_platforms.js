const mysql = require('mysql2/promise');

const VERIFIED_PLATFORM_NAMES = [
  'Netflix',
  'Amazon Prime Video',
  'Disney+',
  'JioHotstar',
  'Apple TV+',
  'Max',
  'Paramount+',
  'Sony Liv',
  'Zee5',
  'Crunchyroll',
  'YouTube',
  'Google Play Movies',
];

async function cleanDatabase() {
  const db = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'project_user',
    password: 'Sankhu@2006',
    database: 'project',
  });

  console.log('🔗 Connected to MySQL. Sanitizing platforms...');

  // 1. Delete any platform matching Hulu unconditionally
  const [huluDel] = await db.query(`
    DELETE cp FROM content_platform cp
    JOIN ott_platform o ON cp.platform_id = o.platform_id
    WHERE LOWER(o.name) LIKE '%hulu%'
  `);
  console.log(`Deleted ${huluDel.affectedRows} Hulu records from content_platform.`);

  await db.query(`DELETE FROM ott_platform WHERE LOWER(name) LIKE '%hulu%'`);

  // 2. Delete all non-verified platforms from content_platform
  const [nonVerifiedDel] = await db.query(`
    DELETE cp FROM content_platform cp
    JOIN ott_platform o ON cp.platform_id = o.platform_id
    WHERE o.name NOT IN (?)
  `, [VERIFIED_PLATFORM_NAMES]);
  console.log(`Deleted ${nonVerifiedDel.affectedRows} unverified/niche/cable platform mappings from content_platform.`);

  // 3. Remove orphaned platforms from ott_platform
  const [orphanDel] = await db.query(`
    DELETE FROM ott_platform
    WHERE platform_id NOT IN (SELECT DISTINCT platform_id FROM content_platform)
  `);
  console.log(`Cleaned ${orphanDel.affectedRows} unused platforms from ott_platform.`);

  // 4. Summarize remaining verified platforms
  const [remaining] = await db.query(`
    SELECT o.platform_id, o.name, COUNT(cp.content_id) as movie_count
    FROM ott_platform o
    JOIN content_platform cp ON o.platform_id = cp.platform_id
    GROUP BY o.platform_id, o.name
    ORDER BY movie_count DESC
  `);

  console.log('\n✅ ACTIVE VERIFIED PLATFORMS IN DATABASE:');
  console.table(remaining);

  const [[{ totalWithPlatforms }]] = await db.query(`SELECT COUNT(DISTINCT content_id) as totalWithPlatforms FROM content_platform`);
  const [[{ totalContent }]] = await db.query(`SELECT COUNT(*) as totalContent FROM content`);
  console.log(`Total titles with verified platforms: ${totalWithPlatforms} / ${totalContent}`);

  await db.end();
}

cleanDatabase().catch(console.error);

// =============================================================================
// VERIFIED STREAMING PLATFORM CLEANER & VALIDATOR
// =============================================================================

const mysql = require('mysql2/promise');

async function clean() {
  const db = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'project_user',
    password: 'Sankhu@2006',
    database: 'project',
  });

  console.log('🧹 Connected to MySQL. Cleaning unverified & geo-broken platforms...');

  // 1. Delete Hulu completely (Hulu is US-only and geo-redirects non-US users to JioHotstar/Disney+)
  const [huluRes] = await db.query(`
    DELETE cp FROM content_platform cp
    JOIN ott_platform o ON o.platform_id = cp.platform_id
    WHERE LOWER(o.name) LIKE '%hulu%'
  `);
  console.log(`✅ Removed ${huluRes.affectedRows} Hulu records from content_platform.`);

  // 2. Delete broken / obscure / non-standalone channel platforms (e.g. VI movies, Fandango, Amazon Channels)
  const obscurePatterns = [
    '%channel%', '%fandango%', '%vi movies%', '%tubi%', '%philo%', '%freevee%',
    '%spectrum%', '%plex%', '%pluto%', '%xumo%', '%retrocrush%', '%screambox%',
    '%midnight pulp%', '%mhz%', '%rokuchannel%', '%vix%'
  ];

  for (const pat of obscurePatterns) {
    const [delRes] = await db.query(`
      DELETE cp FROM content_platform cp
      JOIN ott_platform o ON o.platform_id = cp.platform_id
      WHERE LOWER(o.name) LIKE ?
    `, [pat]);
    if (delRes.affectedRows > 0) {
      console.log(`✅ Removed ${delRes.affectedRows} unverified/channel records matching "${pat}".`);
    }
  }

  // 3. Delete Hulu from ott_platform table as well
  await db.query(`DELETE FROM ott_platform WHERE LOWER(name) LIKE '%hulu%'`);

  // 4. Clean up any orphaned platform records
  await db.query(`
    DELETE FROM ott_platform
    WHERE platform_id NOT IN (SELECT DISTINCT platform_id FROM content_platform)
  `);

  // 5. Check remaining platforms
  const [remaining] = await db.query(`
    SELECT o.name, COUNT(*) as count
    FROM content_platform cp
    JOIN ott_platform o ON o.platform_id = cp.platform_id
    GROUP BY o.name
    ORDER BY count DESC
  `);

  console.log('\n📊 Clean, Verified Platforms Remaining:');
  console.table(remaining);

  await db.end();
}

clean().catch(console.error);

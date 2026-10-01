// =============================================================================
// CINEVERSE MASTER BACKFILL SCRIPT
// Fetches ALL missing data from TMDB API and populates MySQL database
// =============================================================================
// Fixes:
// 1. Missing Genres (all titles)
// 2. Missing Languages (all titles)
// 3. Missing Descriptions / Overviews
// 4. Missing Backdrop images (for Hero banner & Detail pages)
// 5. Missing YouTube Trailers
// 6. Missing Actor profile photos & character role names
// 7. Missing Seasons & Episodes for TV series
// 8. Missing OTT Streaming Platforms (India & US availability)
// 9. Fixes rating = 0 (replaced with accurate TMDB vote_average)
// 10. Removes junk test data & merges duplicate genres/platforms
// =============================================================================

const https = require('https');
const zlib = require('zlib');
const mysql = require('mysql2/promise');

const API_KEY = 'f0197a9fc1809810ff1f5485f7d6d78d';
const WORKING_IP = '3.175.86.50'; // Pinned working CloudFront IP to avoid ISP TLS resets
const CONCURRENCY = 4; // 4 concurrent titles at a time

const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  gray:   s => `\x1b[90m${s}\x1b[0m`,
};

function fetchTMDB(path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.themoviedb.org',
      port: 443,
      path: `/3${path}${path.includes('?') ? '&' : '?'}api_key=${API_KEY}`,
      method: 'GET',
      servername: 'api.themoviedb.org',
      lookup: (hostname, options, cb) => {
        if (typeof options === 'function') options(null, WORKING_IP, 4);
        else if (options && options.all) cb(null, [{ address: WORKING_IP, family: 4 }]);
        else cb(null, WORKING_IP, 4);
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const enc = res.headers['content-encoding'];
        const parse = (str) => {
          try { resolve({ ok: true, status: res.statusCode, data: JSON.parse(str) }); }
          catch (e) { resolve({ ok: false, status: res.statusCode, error: e.message }); }
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
    });

    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.end();
  });
}

const LANG_MAP = {
  en:'English',hi:'Hindi',ja:'Japanese',ko:'Korean',es:'Spanish',
  fr:'French',de:'German',it:'Italian',zh:'Chinese',pt:'Portuguese',
  ru:'Russian',ar:'Arabic',ta:'Tamil',te:'Telugu',ml:'Malayalam',
  bn:'Bengali',tr:'Turkish',th:'Thai',nl:'Dutch',sv:'Swedish',
  no:'Norwegian',da:'Danish',fi:'Finnish',pl:'Polish',id:'Indonesian',
};

function normalizeGenre(name) {
  if (name === 'Science Fiction') return 'Sci-Fi & Fantasy';
  if (name === 'Action & Adventure') return 'Action';
  return name;
}

function normalizePlatform(name) {
  if (name.includes('Prime') || name.includes('Amazon Video')) return 'Amazon Prime Video';
  if (name.includes('Apple TV')) return 'Apple TV+';
  if (name.includes('Disney')) return 'Disney+';
  if (name.includes('HBO') || name === 'Max') return 'Max';
  if (name.includes('Crunchyroll')) return 'Crunchyroll';
  if (name.includes('AMC')) return 'AMC+';
  return name;
}

async function processSingleItem(db, row, stats) {
  const { content_id, tmdb_id, type } = row;
  const ep = type === 'Series' ? 'tv' : 'movie';

  const [mainRes, vidRes, credRes, provRes] = await Promise.all([
    fetchTMDB(`/${ep}/${tmdb_id}`),
    fetchTMDB(`/${ep}/${tmdb_id}/videos`),
    fetchTMDB(`/${ep}/${tmdb_id}/credits`),
    fetchTMDB(`/${ep}/${tmdb_id}/watch/providers`),
  ]);

  if (!mainRes.ok || !mainRes.data) {
    stats.errors++;
    return;
  }
  const main = mainRes.data;

  // 1. Content fields
  const updates = [];
  const params = [];

  if (main.overview) { updates.push('description = COALESCE(NULLIF(description, ""), ?)'); params.push(main.overview); stats.descriptions++; }
  if (main.backdrop_path) { updates.push('backdrop_path = COALESCE(NULLIF(backdrop_path, ""), ?)'); params.push(main.backdrop_path); stats.backdrops++; }
  if (main.vote_average) { updates.push('rating = CASE WHEN rating IS NULL OR rating = 0 THEN ? ELSE rating END'); params.push(main.vote_average); }
  if (main.poster_path) { updates.push('poster_path = COALESCE(NULLIF(poster_path, ""), ?)'); params.push(main.poster_path); }

  if (vidRes.ok && vidRes.data?.results) {
    const tr = vidRes.data.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
               vidRes.data.results.find(v => v.site === 'YouTube');
    if (tr?.key) {
      updates.push('trailer_key = COALESCE(NULLIF(trailer_key, ""), ?)');
      params.push(tr.key);
      stats.trailers++;
    }
  }

  if (updates.length > 0) {
    params.push(content_id);
    await db.execute(`UPDATE content SET ${updates.join(', ')} WHERE content_id = ?`, params);
  }

  // Duration / Seasons
  if (type === 'Movie' && main.runtime) {
    await db.execute('INSERT INTO movie (content_id, duration) VALUES (?, ?) ON DUPLICATE KEY UPDATE duration = VALUES(duration)', [content_id, main.runtime]);
  } else if (type === 'Series' && main.number_of_seasons) {
    await db.execute('INSERT INTO series (content_id, total_seasons) VALUES (?, ?) ON DUPLICATE KEY UPDATE total_seasons = VALUES(total_seasons)', [content_id, main.number_of_seasons]);
  }

  // 2. Genres
  if (main.genres && main.genres.length > 0) {
    for (const g of main.genres) {
      const gName = normalizeGenre(g.name);
      await db.execute('INSERT IGNORE INTO genre (genre_name) VALUES (?)', [gName]);
      const [[gRow]] = await db.execute('SELECT genre_id FROM genre WHERE genre_name = ?', [gName]);
      if (gRow) {
        await db.execute('INSERT IGNORE INTO content_genre (content_id, genre_id) VALUES (?, ?)', [content_id, gRow.genre_id]);
      }
    }
    stats.genres++;
  }

  // 3. Language
  if (main.original_language) {
    const lName = LANG_MAP[main.original_language] || main.original_language.toUpperCase();
    await db.execute('INSERT IGNORE INTO language (language_name) VALUES (?)', [lName]);
    const [[lRow]] = await db.execute('SELECT language_id FROM language WHERE language_name = ?', [lName]);
    if (lRow) {
      await db.execute('INSERT IGNORE INTO content_language (content_id, language_id, type) VALUES (?, ?, "Original")', [content_id, lRow.language_id]);
    }
    stats.languages++;
  }

  // 4. Actors & Roles
  if (credRes.ok && credRes.data?.cast) {
    const cast = credRes.data.cast.slice(0, 12);
    for (const a of cast) {
      if (!a.name) continue;
      await db.execute(
        'INSERT INTO actor (name, profile_path, tmdb_actor_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE profile_path = COALESCE(VALUES(profile_path), profile_path), tmdb_actor_id = COALESCE(VALUES(tmdb_actor_id), tmdb_actor_id)',
        [a.name, a.profile_path || null, a.id]
      );
      const [[aRow]] = await db.execute('SELECT actor_id FROM actor WHERE name = ?', [a.name]);
      if (aRow) {
        const role = a.character || null;
        await db.execute('INSERT IGNORE INTO content_actor (content_id, actor_id, role_name) VALUES (?, ?, ?)', [content_id, aRow.actor_id, role]);
      }
    }
    stats.actors++;
  }

  // 5. Watch Providers
  if (provRes.ok && provRes.data?.results) {
    const region = provRes.data.results.IN || provRes.data.results.US || {};
    const provs = [...(region.flatrate || []), ...(region.ads || []), ...(region.buy || [])];
    const seenP = new Set();
    for (const p of provs) {
      const pName = normalizePlatform(p.provider_name);
      if (seenP.has(pName)) continue;
      seenP.add(pName);

      await db.execute('INSERT IGNORE INTO ott_platform (name) VALUES (?)', [pName]);
      const [[pRow]] = await db.execute('SELECT platform_id FROM ott_platform WHERE name = ?', [pName]);
      if (pRow) {
        await db.execute('INSERT IGNORE INTO content_platform (content_id, platform_id, available_from) VALUES (?, ?, CURDATE())', [content_id, pRow.platform_id]);
      }
    }
    stats.platforms++;
  }

  // 6. Seasons & Episodes (for Series)
  if (type === 'Series' && main.seasons && main.seasons.length > 0) {
    const validSeasons = main.seasons.filter(s => s.season_number > 0);
    for (const s of validSeasons) {
      await db.execute('INSERT IGNORE INTO season (series_id, season_number) VALUES (?, ?)', [content_id, s.season_number]);
      const [[sRow]] = await db.execute('SELECT season_id FROM season WHERE series_id = ? AND season_number = ?', [content_id, s.season_number]);
      if (sRow) {
        const epRes = await fetchTMDB(`/tv/${tmdb_id}/season/${s.season_number}`);
        if (epRes.ok && epRes.data?.episodes) {
          for (const ep of epRes.data.episodes) {
            await db.execute(
              'INSERT IGNORE INTO episode (season_id, title, episode_number, duration) VALUES (?, ?, ?, ?)',
              [sRow.season_id, ep.name || `Episode ${ep.episode_number}`, ep.episode_number, ep.runtime || null]
            );
            stats.episodes++;
          }
        }
      }
    }
    stats.seasons += validSeasons.length;
  }
}

async function main() {
  console.log(C.bold('\n🎬 ==================================================='));
  console.log(C.bold('   CINEVERSE MASTER DATABASE BACKFILL & ENRICHMENT'));
  console.log(C.bold('===================================================\n'));

  const db = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'project_user',
    password: 'Sankhu@2006',
    database: 'project',
  });
  console.log(C.green('✓ Connected to MySQL database\n'));

  // STEP 0: Clean up junk data & season 0
  console.log(C.cyan('STEP 0: Cleaning up junk test data & normalizing...'));
  await db.execute("DELETE FROM content WHERE title IN ('Test Movie', 'Demo Series')");
  // Clean up season 0 episodes and season 0
  const [s0Rows] = await db.execute('SELECT season_id FROM season WHERE season_number = 0');
  if (s0Rows.length > 0) {
    const s0Ids = s0Rows.map(r => r.season_id);
    await db.execute(`DELETE FROM episode WHERE season_id IN (${s0Ids.join(',')})`);
    await db.execute('DELETE FROM season WHERE season_number = 0');
    console.log(C.green(`  Removed ${s0Rows.length} Season 0 records`));
  }
  console.log(C.green('  Clean up completed.\n'));

  // STEP 1: Merge existing duplicate genres
  console.log(C.cyan('STEP 1: Merging duplicate genres...'));
  const genreMerges = [
    ['Science Fiction', 'Sci-Fi & Fantasy'],
    ['Action & Adventure', 'Action'],
  ];
  for (const [from, to] of genreMerges) {
    const [[toR]] = await db.execute('SELECT genre_id FROM genre WHERE genre_name = ?', [to]);
    const [[fromR]] = await db.execute('SELECT genre_id FROM genre WHERE genre_name = ?', [from]);
    if (toR && fromR) {
      await db.execute('UPDATE IGNORE content_genre SET genre_id = ? WHERE genre_id = ?', [toR.genre_id, fromR.genre_id]);
      await db.execute('DELETE FROM content_genre WHERE genre_id = ?', [fromR.genre_id]);
      await db.execute('DELETE FROM genre WHERE genre_id = ?', [fromR.genre_id]);
      console.log(C.green(`  Merged genre "${from}" -> "${to}"`));
    }
  }
  console.log();

  // STEP 2: Query content rows
  const [rows] = await db.execute(
    'SELECT content_id, tmdb_id, type, title FROM content WHERE tmdb_id IS NOT NULL AND tmdb_id NOT IN (999999, 888888) ORDER BY content_id'
  );
  const total = rows.length;
  console.log(C.cyan(`STEP 2: Backfilling data for ${total} titles from TMDB (Concurrency: ${CONCURRENCY})...\n`));

  const stats = {
    genres: 0,
    languages: 0,
    descriptions: 0,
    backdrops: 0,
    trailers: 0,
    actors: 0,
    platforms: 0,
    seasons: 0,
    episodes: 0,
    errors: 0,
  };

  let completed = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(r => processSingleItem(db, r, stats)));
    completed += batch.length;

    const pct = Math.round((completed / total) * 100);
    const filled = Math.floor(pct / 5);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
    const lastTitle = batch[batch.length - 1]?.title.slice(0, 22) || '';
    process.stdout.write(`\r  [${bar}] ${pct}% (${completed}/${total}) [${elapsedSec}s] ${C.gray(lastTitle.padEnd(24))}`);
  }

  process.stdout.write('\n\n');

  // STEP 3: Merge duplicate platforms
  console.log(C.cyan('STEP 3: Merging duplicate streaming platforms...'));
  const platMerges = [
    ['Amazon Prime Video', ['Amazon Prime', 'Amazon Prime Video with Ads', 'Amazon Video']],
    ['Apple TV+', ['Apple TV', 'Apple TV Amazon Channel', 'Apple TV Plus']],
    ['Disney+', ['Disney Plus', 'Disney+ Amazon Channel', 'Disney Plus India', 'Disney+ Hotstar']],
    ['Max', ['HBO Max']],
    ['Crunchyroll', ['Crunchyroll Amazon Channel']],
    ['AMC+', ['AMC Plus Apple TV Channel', 'AMC+ Amazon Channel']],
  ];

  for (const [canonical, variants] of platMerges) {
    const [[canRow]] = await db.execute('SELECT platform_id FROM ott_platform WHERE name = ?', [canonical]);
    if (!canRow) continue;
    for (const v of variants) {
      const [[vRow]] = await db.execute('SELECT platform_id FROM ott_platform WHERE name = ?', [v]);
      if (!vRow) continue;
      await db.execute('UPDATE IGNORE content_platform SET platform_id = ? WHERE platform_id = ?', [canRow.platform_id, vRow.platform_id]);
      await db.execute('DELETE FROM content_platform WHERE platform_id = ?', [vRow.platform_id]);
      await db.execute('DELETE FROM ott_platform WHERE platform_id = ?', [vRow.platform_id]);
      console.log(C.green(`  Merged platform "${v}" -> "${canonical}"`));
    }
  }

  // FINAL STATS
  const [[{ totContent }]] = await db.execute('SELECT COUNT(*) as totContent FROM content');
  const [[{ withG }]] = await db.execute('SELECT COUNT(DISTINCT content_id) as withG FROM content_genre');
  const [[{ withL }]] = await db.execute('SELECT COUNT(DISTINCT content_id) as withL FROM content_language');
  const [[{ withB }]] = await db.execute("SELECT COUNT(*) as withB FROM content WHERE backdrop_path IS NOT NULL AND backdrop_path != ''");
  const [[{ withT }]] = await db.execute("SELECT COUNT(*) as withT FROM content WHERE trailer_key IS NOT NULL AND trailer_key != ''");
  const [[{ withP }]] = await db.execute('SELECT COUNT(DISTINCT content_id) as withP FROM content_platform');
  const [[{ totAct }]] = await db.execute('SELECT COUNT(*) as totAct FROM actor');
  const [[{ actPic }]] = await db.execute("SELECT COUNT(*) as actPic FROM actor WHERE profile_path IS NOT NULL AND profile_path != ''");
  const [[{ totS }]] = await db.execute('SELECT COUNT(DISTINCT series_id) as totS FROM season');
  const [[{ totE }]] = await db.execute('SELECT COUNT(*) as totE FROM episode');
  const [[{ zeroR }]] = await db.execute('SELECT COUNT(*) as zeroR FROM content WHERE rating = 0');

  console.log(C.bold('\n' + '='.repeat(60)));
  console.log(C.bold('   🎉 BACKFILL COMPLETE! FINAL DATABASE STATS:'));
  console.log(C.bold('='.repeat(60)));
  console.log(`  Total Content Items:       ${C.bold(totContent)}`);
  console.log(`  Titles with Genres:        ${C.bold(withG + '/' + totContent)} (${Math.round((withG/totContent)*100)}%)`);
  console.log(`  Titles with Language:      ${C.bold(withL + '/' + totContent)} (${Math.round((withL/totContent)*100)}%)`);
  console.log(`  Titles with Backdrop:      ${C.bold(withB + '/' + totContent)} (${Math.round((withB/totContent)*100)}%)`);
  console.log(`  Titles with Trailer:       ${C.bold(withT + '/' + totContent)} (${Math.round((withT/totContent)*100)}%)`);
  console.log(`  Titles with OTT Platform:  ${C.bold(withP + '/' + totContent)} (${Math.round((withP/totContent)*100)}%)`);
  console.log(`  Actors with Photos:        ${C.bold(actPic + '/' + totAct)} (${Math.round((actPic/totAct)*100)}%)`);
  console.log(`  TV Series with Seasons:    ${C.bold(totS)}`);
  console.log(`  Total Episodes:            ${C.bold(totE)}`);
  console.log(`  Zero Rating Items:         ${C.bold(zeroR)}`);
  console.log(C.bold('='.repeat(60) + '\n'));

  await db.end();
}

main().catch((err) => {
  console.error('\nFatal backfill error:', err);
  process.exit(1);
});

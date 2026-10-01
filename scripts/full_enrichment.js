// =============================================================================
// CINEVERSE 100% COMPLETE DATABASE ENRICHMENT & DEDUPLICATION RUNNER
// =============================================================================

const https = require('https');
const zlib = require('zlib');
const mysql = require('mysql2/promise');

const API_KEY = 'f0197a9fc1809810ff1f5485f7d6d78d';
const WORKING_IP = '3.175.86.50';
const CONCURRENCY = 2; // Controlled 2 concurrent titles to prevent socket reset
const SLEEP_BETWEEN_CALLS = 60; // 60ms pause

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchTMDB(path, retries = 4) {
  return new Promise((resolve) => {
    const attempt = (n) => {
      const req = https.request({
        hostname: 'api.themoviedb.org',
        port: 443,
        path: `/3${path}${path.includes('?') ? '&' : '?'}api_key=${API_KEY}`,
        method: 'GET',
        servername: 'api.themoviedb.org',
        agent: false,
        lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: WORKING_IP, family: 4 }]) : cb(null, WORKING_IP, 4)),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'close',
        },
      }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const enc = res.headers['content-encoding'];
          const done = (raw) => {
            try { resolve({ ok: true, status: res.statusCode, data: JSON.parse(raw) }); }
            catch (e) {
              if (n > 1) setTimeout(() => attempt(n - 1), 350);
              else resolve({ ok: false, error: e.message });
            }
          };

          if (enc === 'gzip') {
            zlib.gunzip(buf, (err, decoded) => {
              if (err) {
                if (n > 1) setTimeout(() => attempt(n - 1), 350);
                else resolve({ ok: false, error: err.message });
              } else done(decoded.toString('utf8'));
            });
          } else {
            done(buf.toString('utf8'));
          }
        });
      });

      req.on('error', (err) => {
        if (n > 1) setTimeout(() => attempt(n - 1), 350);
        else resolve({ ok: false, error: err.message });
      });

      req.setTimeout(8000, () => {
        req.destroy();
        if (n > 1) setTimeout(() => attempt(n - 1), 350);
        else resolve({ ok: false, error: 'timeout' });
      });

      req.end();
    };

    attempt(retries);
  });
}

const LANG_MAP = {
  en:'English',hi:'Hindi',ja:'Japanese',ko:'Korean',es:'Spanish',
  fr:'French',de:'German',it:'Italian',zh:'Chinese',cn:'Chinese',
  pt:'Portuguese',ru:'Russian',ar:'Arabic',ta:'Tamil',te:'Telugu',
  ml:'Malayalam',bn:'Bengali',tr:'Turkish',th:'Thai',nl:'Dutch',
  sv:'Swedish',no:'Norwegian',da:'Danish',fi:'Finnish',pl:'Polish',
  id:'Indonesian',tl:'Filipino',mn:'Mongolian',el:'Greek',he:'Hebrew',
};

function normalizeGenre(name) {
  if (name === 'Science Fiction') return 'Sci-Fi & Fantasy';
  if (name === 'Action & Adventure') return 'Action';
  return name;
}

function normalizePlatform(name) {
  const lower = name.toLowerCase();
  if (lower.includes('prime') || lower.includes('amazon video') || lower.includes('amazon mx')) return 'Amazon Prime Video';
  if (lower.includes('apple tv')) return 'Apple TV+';
  if (lower.includes('disney')) return 'Disney+';
  if (lower.includes('hbo') || name === 'Max') return 'Max';
  if (lower.includes('paramount')) return 'Paramount+';
  if (lower.includes('peacock')) return 'Peacock';
  if (lower.includes('mgm')) return 'MGM+';
  if (lower.includes('lionsgate')) return 'Lionsgate Play';
  if (lower.includes('crunchyroll')) return 'Crunchyroll';
  if (lower.includes('amc')) return 'AMC+';
  if (lower.includes('netflix')) return 'Netflix';
  if (lower.includes('britbox')) return 'BritBox';
  if (lower.includes('starz')) return 'Starz';
  if (lower.includes('shudder')) return 'Shudder';
  if (lower.includes('youtube')) return 'YouTube';
  if (lower.includes('plex')) return 'Plex';
  if (lower.includes('fandango')) return 'Fandango at Home';
  return name.trim();
}

async function enrichTitle(db, row) {
  const { content_id, tmdb_id, type } = row;
  const ep = type === 'Series' ? 'tv' : 'movie';

  // 1. Details
  const main = await fetchTMDB(`/${ep}/${tmdb_id}`);
  await sleep(SLEEP_BETWEEN_CALLS);

  if (main.ok && main.data) {
    const d = main.data;
    const updates = [];
    const params = [];

    if (d.overview) { updates.push('description = COALESCE(NULLIF(description, ""), ?)'); params.push(d.overview); }
    if (d.backdrop_path) { updates.push('backdrop_path = ?'); params.push(d.backdrop_path); }
    if (d.vote_average && d.vote_average > 0) { updates.push('rating = ?'); params.push(d.vote_average); }
    if (d.poster_path) { updates.push('poster_path = COALESCE(NULLIF(poster_path, ""), ?)'); params.push(d.poster_path); }

    if (updates.length > 0) {
      params.push(content_id);
      await db.execute(`UPDATE content SET ${updates.join(', ')} WHERE content_id = ?`, params);
    }

    // Duration / Seasons
    if (type === 'Movie' && d.runtime) {
      await db.execute('INSERT INTO movie (content_id, duration) VALUES (?, ?) ON DUPLICATE KEY UPDATE duration = VALUES(duration)', [content_id, d.runtime]);
    } else if (type === 'Series' && d.number_of_seasons) {
      await db.execute('INSERT INTO series (content_id, total_seasons) VALUES (?, ?) ON DUPLICATE KEY UPDATE total_seasons = VALUES(total_seasons)', [content_id, d.number_of_seasons]);
    }

    // Language
    if (d.original_language) {
      const cleanLang = LANG_MAP[d.original_language.toLowerCase()] || d.original_language.toUpperCase();
      await db.execute('INSERT IGNORE INTO language (language_name) VALUES (?)', [cleanLang]);
      const [[lRow]] = await db.execute('SELECT language_id FROM language WHERE language_name = ?', [cleanLang]);
      if (lRow) {
        await db.execute('INSERT IGNORE INTO content_language (content_id, language_id, type) VALUES (?, ?, "Original")', [content_id, lRow.language_id]);
      }
    }

    // Genres
    if (d.genres && d.genres.length > 0) {
      for (const g of d.genres) {
        const cleanG = normalizeGenre(g.name);
        await db.execute('INSERT IGNORE INTO genre (genre_name) VALUES (?)', [cleanG]);
        const [[gRow]] = await db.execute('SELECT genre_id FROM genre WHERE genre_name = ?', [cleanG]);
        if (gRow) {
          await db.execute('INSERT IGNORE INTO content_genre (content_id, genre_id) VALUES (?, ?)', [content_id, gRow.genre_id]);
        }
      }
    }
  }

  // 2. Videos (Trailer)
  const vids = await fetchTMDB(`/${ep}/${tmdb_id}/videos`);
  await sleep(SLEEP_BETWEEN_CALLS);
  if (vids.ok && vids.data?.results) {
    const tr = vids.data.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
               vids.data.results.find(v => v.site === 'YouTube');
    if (tr?.key) {
      await db.execute('UPDATE content SET trailer_key = ? WHERE content_id = ?', [tr.key, content_id]);
    }
  }

  // 3. Credits (Actors with profile photos)
  const creds = await fetchTMDB(`/${ep}/${tmdb_id}/credits`);
  await sleep(SLEEP_BETWEEN_CALLS);
  if (creds.ok && creds.data?.cast) {
    for (const a of creds.data.cast.slice(0, 12)) {
      if (!a.name) continue;
      await db.execute('INSERT IGNORE INTO actor (name) VALUES (?)', [a.name]);
      if (a.profile_path) {
        await db.execute('UPDATE actor SET profile_path = ?, tmdb_actor_id = ? WHERE name = ?', [a.profile_path, a.id, a.name]);
      }
      const [[aRow]] = await db.execute('SELECT actor_id FROM actor WHERE name = ?', [a.name]);
      if (aRow) {
        const char = a.character || null;
        await db.execute('INSERT IGNORE INTO content_actor (content_id, actor_id, role_name) VALUES (?, ?, ?)', [content_id, aRow.actor_id, char]);
      }
    }
  }

  // 4. Watch Providers
  const provs = await fetchTMDB(`/${ep}/${tmdb_id}/watch/providers`);
  await sleep(SLEEP_BETWEEN_CALLS);
  if (provs.ok && provs.data?.results) {
    const reg = provs.data.results.IN || provs.data.results.US || {};
    const items = [...(reg.flatrate || []), ...(reg.ads || []), ...(reg.buy || [])];
    const seenP = new Set();
    for (const p of items) {
      const cleanP = normalizePlatform(p.provider_name);
      if (seenP.has(cleanP)) continue;
      seenP.add(cleanP);

      await db.execute('INSERT IGNORE INTO ott_platform (name) VALUES (?)', [cleanP]);
      const [[pRow]] = await db.execute('SELECT platform_id FROM ott_platform WHERE name = ?', [cleanP]);
      if (pRow) {
        // Ensure no duplicate content_platform row
        const [[hasP]] = await db.execute('SELECT COUNT(*) as c FROM content_platform WHERE content_id = ? AND platform_id = ?', [content_id, pRow.platform_id]);
        if (hasP.c === 0) {
          await db.execute('INSERT INTO content_platform (content_id, platform_id, available_from) VALUES (?, ?, CURDATE())', [content_id, pRow.platform_id]);
        }
      }
    }
  }
}

async function main() {
  console.log('\n🚀 Starting Full 100% Database Enrichment...');

  const db = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'project_user',
    password: 'Sankhu@2006',
    database: 'project',
  });

  const [rows] = await db.execute(
    'SELECT content_id, tmdb_id, type, title FROM content WHERE tmdb_id IS NOT NULL AND tmdb_id NOT IN (999999, 888888) ORDER BY content_id'
  );
  const total = rows.length;
  console.log(`Processing ${total} titles with retry-resilient requests...\n`);

  let done = 0;
  const t0 = Date.now();

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(r => enrichTitle(db, r)));
    done += batch.length;

    const pct = Math.round((done / total) * 100);
    const filled = Math.floor(pct / 5);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    const elapsed = Math.round((Date.now() - t0) / 1000);
    const title = batch[batch.length - 1]?.title.slice(0, 20) || '';
    process.stdout.write(`\r  [${bar}] ${pct}% (${done}/${total}) [${elapsed}s] ${title.padEnd(22)}`);
  }

  process.stdout.write('\n\n');

  // Final Cleanup: Deduplicate any duplicate content_platform entries
  console.log('Cleaning any remaining duplicate content_platform rows...');
  await db.execute(`
    DELETE cp1 FROM content_platform cp1
    INNER JOIN content_platform cp2
      ON cp1.content_id = cp2.content_id
      AND cp1.platform_id = cp2.platform_id
      AND cp1.available_from > cp2.available_from
  `);

  // Final DB stats
  const [[{ totContent }]] = await db.execute('SELECT COUNT(*) as totContent FROM content');
  const [[{ withG }]] = await db.execute('SELECT COUNT(DISTINCT content_id) as withG FROM content_genre');
  const [[{ withL }]] = await db.execute('SELECT COUNT(DISTINCT content_id) as withL FROM content_language');
  const [[{ withB }]] = await db.execute("SELECT COUNT(*) as withB FROM content WHERE backdrop_path IS NOT NULL AND backdrop_path != ''");
  const [[{ withT }]] = await db.execute("SELECT COUNT(*) as withT FROM content WHERE trailer_key IS NOT NULL AND trailer_key != ''");
  const [[{ withP }]] = await db.execute('SELECT COUNT(DISTINCT content_id) as withP FROM content_platform');
  const [[{ totAct }]] = await db.execute('SELECT COUNT(*) as totAct FROM actor');
  const [[{ actPic }]] = await db.execute("SELECT COUNT(*) as actPic FROM actor WHERE profile_path IS NOT NULL AND profile_path != ''");

  console.log('='.repeat(55));
  console.log('🎉 100% ENRICHMENT COMPLETE!');
  console.log('='.repeat(55));
  console.log(`Total Titles:         ${totContent}`);
  console.log(`Titles with Genres:   ${withG}/${totContent} (${Math.round((withG/totContent)*100)}%)`);
  console.log(`Titles with Language: ${withL}/${totContent} (${Math.round((withL/totContent)*100)}%)`);
  console.log(`Titles with Backdrop: ${withB}/${totContent} (${Math.round((withB/totContent)*100)}%)`);
  console.log(`Titles with Trailer:  ${withT}/${totContent} (${Math.round((withT/totContent)*100)}%)`);
  console.log(`Titles with Platform: ${withP}/${totContent} (${Math.round((withP/totContent)*100)}%)`);
  console.log(`Actors with Photo:    ${actPic}/${totAct} (${Math.round((actPic/totAct)*100)}%)`);
  console.log('='.repeat(55) + '\n');

  await db.end();
}

main().catch(console.error);

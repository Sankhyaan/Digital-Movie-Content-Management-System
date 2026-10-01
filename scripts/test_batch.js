const https = require('https');
const zlib = require('zlib');
const mysql = require('mysql2/promise');

const API_KEY = 'f0197a9fc1809810ff1f5485f7d6d78d';
const WORKING_IP = '3.175.86.50';

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

async function processTitle(db, row) {
  const { content_id, tmdb_id, type, title } = row;
  const ep = type === 'Series' ? 'tv' : 'movie';

  const [mainRes, vidRes, credRes, provRes] = await Promise.all([
    fetchTMDB(`/${ep}/${tmdb_id}`),
    fetchTMDB(`/${ep}/${tmdb_id}/videos`),
    fetchTMDB(`/${ep}/${tmdb_id}/credits`),
    fetchTMDB(`/${ep}/${tmdb_id}/watch/providers`),
  ]);

  if (!mainRes.ok || !mainRes.data) {
    return { title, error: mainRes.error || 'Failed to fetch main' };
  }
  const main = mainRes.data;

  // 1. Update content metadata
  const updates = [];
  const params = [];

  if (main.overview) { updates.push('description = COALESCE(NULLIF(description, ""), ?)'); params.push(main.overview); }
  if (main.backdrop_path) { updates.push('backdrop_path = COALESCE(NULLIF(backdrop_path, ""), ?)'); params.push(main.backdrop_path); }
  if (main.vote_average) { updates.push('rating = CASE WHEN rating IS NULL OR rating = 0 THEN ? ELSE rating END'); params.push(main.vote_average); }
  if (main.poster_path) { updates.push('poster_path = COALESCE(NULLIF(poster_path, ""), ?)'); params.push(main.poster_path); }

  // Trailer
  if (vidRes.ok && vidRes.data?.results) {
    const tr = vidRes.data.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
               vidRes.data.results.find(v => v.site === 'YouTube');
    if (tr?.key) {
      updates.push('trailer_key = COALESCE(NULLIF(trailer_key, ""), ?)');
      params.push(tr.key);
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
  }

  // 3. Language
  if (main.original_language) {
    const lName = LANG_MAP[main.original_language] || main.original_language.toUpperCase();
    await db.execute('INSERT IGNORE INTO language (language_name) VALUES (?)', [lName]);
    const [[lRow]] = await db.execute('SELECT language_id FROM language WHERE language_name = ?', [lName]);
    if (lRow) {
      await db.execute('INSERT IGNORE INTO content_language (content_id, language_id, type) VALUES (?, ?, "Original")', [content_id, lRow.language_id]);
    }
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
          }
        }
      }
    }
  }

  return { title, ok: true };
}

async function testSample() {
  const db = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'project_user',
    password: 'Sankhu@2006',
    database: 'project',
  });

  const [rows] = await db.execute('SELECT content_id, tmdb_id, type, title FROM content WHERE tmdb_id IS NOT NULL LIMIT 5');
  console.log(`Processing test batch of ${rows.length} titles...`);

  for (const r of rows) {
    const t0 = Date.now();
    const res = await processTitle(db, r);
    console.log(`- ${r.title} (${r.type}):`, res.ok ? `Done in ${Date.now() - t0}ms` : `Error: ${res.error}`);
  }

  await db.end();
}

testSample().catch(console.error);

import http from 'http';
import * as fs from 'fs';
import * as path from 'path';

function postJson(url: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`Failed to parse response: ${raw.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runLiveChecks() {
  const cases = [
    {
      id: 'request_1_nolan',
      prompt: 'movies directed by Christopher Nolan',
      outFile: 'phase2_request_1_nolan.json',
    },
    {
      id: 'request_2_tom_holland',
      prompt: 'I want movies starring Tom Holland but not his Spider-Man movies',
      outFile: 'phase2_request_2_tom_holland.json',
    },
    {
      id: 'request_3_interstellar',
      prompt: 'I want something like Interstellar but shorter',
      outFile: 'phase2_request_3_interstellar.json',
    },
  ];

  for (const c of cases) {
    console.log(`\n=======================================================`);
    console.log(`Running live test for: "${c.prompt}"...`);

    // 1. Build profile
    const profileRes = await postJson('http://localhost:5000/api/movies/profile', {
      source: 'custom',
      prompt: c.prompt,
    });

    if (!profileRes.success) {
      throw new Error(`Profile creation failed for "${c.prompt}": ${JSON.stringify(profileRes)}`);
    }

    const profile = profileRes.profile;
    console.log(`Profile parsed:`);
    console.log(`  directors:`, profile.directors);
    console.log(`  actors:`, profile.actors);
    console.log(`  genres:`, profile.genres);
    console.log(`  reference_titles:`, profile.reference_titles);
    console.log(`  negative_franchises:`, profile.negative_franchises);
    console.log(`  negative_titles:`, profile.negative_titles);
    console.log(`  negative_genres:`, profile.negative_genres);

    // 2. Recommend
    const recRes = await postJson('http://localhost:5000/api/movies/recommend', {
      profile,
      debug: true,
    });

    if (!recRes.success) {
      throw new Error(`Recommendation failed for "${c.prompt}": ${JSON.stringify(recRes)}`);
    }

    console.log(`Returned ${recRes.recommendations.length} recommendations. Top 3:`);
    for (let i = 0; i < Math.min(3, recRes.recommendations.length); i++) {
      const r = recRes.recommendations[i];
      console.log(`  #${i + 1}: ${r.title} (${r.release_year}, ${r.type}, ${r.rating}★)`);
      console.log(`      directors:`, r.directors);
      console.log(`      actors:`, (r.actors || []).slice(0, 4));
      console.log(`      match_percentage:`, r.match_percentage);
      console.log(`      match_reasons:`, r.match_reasons);
    }

    // Save full JSON output
    const outData = {
      prompt: c.prompt,
      profile,
      recommendations: recRes.recommendations,
      debug: recRes.debug,
    };
    const outPath = path.join(__dirname, '..', c.outFile);
    fs.writeFileSync(outPath, JSON.stringify(outData, null, 2), 'utf8');
    console.log(`Saved result to ${outPath}`);
  }
}

runLiveChecks()
  .then(() => {
    console.log('\nAll live HTTP checks completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error in live checks:', err);
    process.exit(1);
  });

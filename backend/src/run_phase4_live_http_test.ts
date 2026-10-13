import http from 'http';
import * as fs from 'fs';
import * as path from 'path';

function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

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
  console.log('=== Checking /api/health ===');
  const health = await getJson('http://localhost:5000/api/health');
  console.log('Health response:', JSON.stringify(health, null, 2));

  const cases = [
    {
      id: 'request_1_nolan',
      prompt: 'movies directed by Christopher Nolan',
      outFile: 'phase4_request_1_nolan.json',
    },
    {
      id: 'request_2_tom_holland',
      prompt: 'I want movies starring Tom Holland but not his Spider-Man movies',
      outFile: 'phase4_request_2_tom_holland.json',
    },
    {
      id: 'request_3_interstellar',
      prompt: 'I want something like Interstellar but shorter',
      outFile: 'phase4_request_3_interstellar.json',
    },
  ];

  for (const c of cases) {
    console.log(`\n=======================================================`);
    console.log(`Running LIVE HTTP TEST: ${c.id}`);
    console.log(`Prompt: "${c.prompt}"`);

    // 1. Build profile
    const profileRes = await postJson('http://localhost:5000/api/movies/profile', {
      source: 'custom',
      prompt: c.prompt,
    });
    console.log(`Profile build success:`, profileRes.success);
    const profile = profileRes.profile;

    // 2. Query recommendations
    const recRes = await postJson('http://localhost:5000/api/movies/recommend', {
      profile,
      surpriseMe: false,
    });

    console.log(`Recommendations count:`, recRes.recommendations?.length);
    const topRecs = (recRes.recommendations || []).slice(0, 5).map((r: any) => ({
      content_id: r.content_id,
      title: r.title,
      type: r.type,
      rating: r.rating,
      release_year: r.release_year,
      match_percentage: r.match_percentage,
      match_reasons: r.match_reasons,
      directors: r.directors,
      actors: r.actors,
    }));

    const outputData = {
      testId: c.id,
      prompt: c.prompt,
      profile,
      recommendationCount: recRes.recommendations?.length || 0,
      top5Recommendations: topRecs,
    };

    const outPath = path.join(__dirname, '..', c.outFile);
    fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`Saved output to ${c.outFile}`);
  }
}

runLiveChecks().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

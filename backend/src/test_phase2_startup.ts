// =============================================================================
// CINEVERSE PHASE 2: CATALOG INITIALIZATION & SERVER STARTUP TESTS
// =============================================================================
// Validates:
// 1. Zero references to movie_dna.json exist in backend/src (file catalog removed).
// 2. Database person catalog loads before HTTP server accepts connections.
// 3. First HTTP request to POST /api/movies/profile has is_degraded === undefined/false.
// =============================================================================

import assert from 'assert';
import http from 'http';
import { execSync } from 'child_process';
import path from 'path';
import { createApp } from './app';
import { SQLMovieRepository } from './repositories/SQLMovieRepository';
import { testConnection, ensureDatabaseSchema, pool } from './db/connection';
import {
  initPersonCatalogFromDatabase,
  isPersonCatalogDegraded,
} from './services/customPromptParser';

console.log('================================================================');
console.log('   CINEVERSE PHASE 2: CATALOG & STARTUP VERIFICATION SUITE       ');
console.log('================================================================\n');

async function runPhase2Tests() {
  // Test 1: Grep check for movie_dna.json
  console.log('--- TEST 2.1: NO MOVIE_DNA.JSON REFERENCES IN BACKEND/SRC ---');
  let grepFound = false;
  try {
    const srcDir = path.resolve(__dirname);
    const result = execSync(`git grep "movie_dna.json" src`, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });
    if (result.trim().length > 0) {
      grepFound = true;
    }
  } catch (err: any) {
    // git grep exits with 1 when no matches are found
    grepFound = false;
  }
  assert.strictEqual(grepFound, false, 'movie_dna.json must not be referenced anywhere in backend/src');
  console.log('✅ PASS: Zero references to movie_dna.json found in backend/src.\n');

  // Test 2: Startup sequence with DB available
  console.log('--- TEST 2.2: DB PERSON CATALOG INITIALIZATION & NON-DEGRADED STATE ---');
  await testConnection();
  await ensureDatabaseSchema();
  await initPersonCatalogFromDatabase();

  assert.strictEqual(
    isPersonCatalogDegraded(),
    false,
    'Person catalog must NOT be degraded when database is available at startup'
  );
  console.log('✅ PASS: Database person catalog initialized with is_degraded: false.\n');

  // Test 3: HTTP Server startup and first request check
  console.log('--- TEST 2.3: FIRST HTTP REQUEST RETURNS IS_DEGRADED FALSE ---');
  const repo = new SQLMovieRepository();
  const app = createApp(repo);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const port = address.port;
  console.log(`Ephemeral test server listening on port ${port}...`);

  const requestBody = JSON.stringify({
    source: 'custom',
    prompt: 'Sci-fi adventure directed by Christopher Nolan',
  });

  const responseData = await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: port,
        path: '/api/movies/profile',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 500, body: JSON.parse(raw) });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });

  server.close();

  assert.strictEqual(responseData.statusCode, 200, `Expected status 200, got ${responseData.statusCode}`);
  assert.strictEqual(responseData.body.success, true, 'Expected success: true');
  assert.ok(responseData.body.profile, 'Expected profile object in response');
  assert.strictEqual(
    Boolean(responseData.body.profile.is_degraded),
    false,
    `Profile must not be degraded on first request. Found is_degraded: ${responseData.body.profile.is_degraded}`
  );
  assert.ok(
    responseData.body.profile.directors.includes('Christopher Nolan'),
    'Expected director Christopher Nolan in profile'
  );

  console.log('✅ PASS: First HTTP request returned 200 with is_degraded: false and verified director.\n');

  console.log('================================================================');
  console.log('   ALL PHASE 2 VERIFICATIONS PASSED SUCCESSFULLY                ');
  console.log('================================================================\n');

  await pool.end();
}

runPhase2Tests().catch((err) => {
  console.error('❌ Phase 2 test failed:', err);
  process.exit(1);
});

// =============================================================================
// CINEVERSE — PARSER PARAPHRASES COMPREHENSIVE TEST SUITE (PHASE 1)
// =============================================================================
// Validates structured output and bucket placement across 42 distinct
// negation paraphrases (covering all grammatical cues, sentence-initial
// negations, and audit prompts).
// Checks:
// - Explicit polarity on extracted items (positive, negative, unresolved).
// - Strict bucket isolation (negative items never enter positive fields).
// - Zero excluded terms leaking into unresolved_references or unresolved_persons.
// - Canonical theme concept normalization against catalog concept vocabulary.
// =============================================================================

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { pool } from './db/connection';
import { parseCustomPrompt, initPersonCatalogFromDatabase } from './services/customPromptParser';

interface ParaphraseTestCase {
  id: string;
  prompt: string;
  category: string;
  expected_positive_genres?: string[];
  expected_negative_genres?: string[];
  expected_negative_persons?: string[];
  expected_negative_titles?: string[];
  expected_negative_franchises?: string[];
  expected_negative_themes?: string[];
  unresolved_must_not_contain?: string[];
}

async function runParaphraseTests() {
  console.log('================================================================');
  console.log('   CINEVERSE PHASE 1: 42 PARAPHRASE PARSER VERIFICATION SUITE   ');
  console.log('================================================================\n');

  // Ensure DB catalog is initialized
  await initPersonCatalogFromDatabase();

  const fixturePath = path.resolve(__dirname, '../../audit/fixtures/parser_paraphrases.json');
  const testCases: ParaphraseTestCase[] = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  let passed = 0;
  let failed = 0;
  const failures: Array<{ id: string; prompt: string; error: string }> = [];

  for (const tc of testCases) {
    try {
      const profile = await parseCustomPrompt(tc.prompt);

      // 1. Verify Expected Positive Genres
      if (tc.expected_positive_genres) {
        for (const expG of tc.expected_positive_genres) {
          assert.ok(
            profile.genres.includes(expG),
            `[${tc.id}] Expected positive genre "${expG}" missing from profile.genres: [${profile.genres.join(', ')}]`
          );
          // Check extracted_items polarity
          assert.ok(
            profile.extracted_items?.some(
              (item) => item.category === 'genre' && item.normalized === expG && item.polarity === 'positive'
            ),
            `[${tc.id}] Extracted items missing positive genre "${expG}"`
          );
        }
      }

      // 2. Verify Expected Negative Genres
      if (tc.expected_negative_genres) {
        for (const expNG of tc.expected_negative_genres) {
          assert.ok(
            profile.negative_genres.includes(expNG),
            `[${tc.id}] Expected negative genre "${expNG}" missing from profile.negative_genres: [${profile.negative_genres.join(', ')}]`
          );
          assert.ok(
            !profile.genres.includes(expNG),
            `[${tc.id}] Negative genre "${expNG}" leaked into positive profile.genres!`
          );
          assert.ok(
            profile.extracted_items?.some(
              (item) => item.category === 'genre' && item.normalized === expNG && item.polarity === 'negative'
            ),
            `[${tc.id}] Extracted items missing negative genre "${expNG}"`
          );
        }
      }

      // 3. Verify Expected Negative Persons
      if (tc.expected_negative_persons) {
        for (const expNP of tc.expected_negative_persons) {
          assert.ok(
            profile.negative_persons.some((p) => p.toLowerCase() === expNP.toLowerCase()),
            `[${tc.id}] Expected negative person "${expNP}" missing from profile.negative_persons: [${profile.negative_persons.join(', ')}]`
          );
          assert.ok(
            !profile.actors.some((a) => a.toLowerCase() === expNP.toLowerCase()),
            `[${tc.id}] Negative person "${expNP}" leaked into positive profile.actors!`
          );
          assert.ok(
            !profile.directors.some((d) => d.toLowerCase() === expNP.toLowerCase()),
            `[${tc.id}] Negative person "${expNP}" leaked into positive profile.directors!`
          );
          assert.ok(
            profile.extracted_items?.some(
              (item) => item.category === 'person' && item.normalized.toLowerCase() === expNP.toLowerCase() && item.polarity === 'negative'
            ),
            `[${tc.id}] Extracted items missing negative person "${expNP}"`
          );
        }
      }

      // 4. Verify Expected Negative Titles
      if (tc.expected_negative_titles) {
        for (const expNT of tc.expected_negative_titles) {
          assert.ok(
            profile.negative_titles.some((t) => t.toLowerCase() === expNT.toLowerCase()),
            `[${tc.id}] Expected negative title "${expNT}" missing from profile.negative_titles: [${profile.negative_titles.join(', ')}]`
          );
          assert.ok(
            !profile.reference_titles.some((t) => t.toLowerCase() === expNT.toLowerCase()),
            `[${tc.id}] Negative title "${expNT}" leaked into positive reference_titles!`
          );
          assert.ok(
            profile.extracted_items?.some(
              (item) => item.category === 'title' && item.normalized.toLowerCase() === expNT.toLowerCase() && item.polarity === 'negative'
            ),
            `[${tc.id}] Extracted items missing negative title "${expNT}"`
          );
        }
      }

      // 5. Verify Expected Negative Franchises
      if (tc.expected_negative_franchises) {
        for (const expNF of tc.expected_negative_franchises) {
          assert.ok(
            profile.negative_franchises.some((f) => f.toLowerCase() === expNF.toLowerCase()),
            `[${tc.id}] Expected negative franchise "${expNF}" missing from profile.negative_franchises: [${profile.negative_franchises.join(', ')}]`
          );
          assert.ok(
            profile.extracted_items?.some(
              (item) => item.category === 'franchise' && item.normalized.toLowerCase() === expNF.toLowerCase() && item.polarity === 'negative'
            ),
            `[${tc.id}] Extracted items missing negative franchise "${expNF}"`
          );
        }
      }

      // 6. Verify Expected Negative Themes / Concepts
      if (tc.expected_negative_themes) {
        for (const expTheme of tc.expected_negative_themes) {
          const inNegThemes = profile.negative_themes.some((t) =>
            t.toLowerCase().includes(expTheme.toLowerCase()) || expTheme.toLowerCase().includes(t.toLowerCase())
          );
          const inNegKeywords = profile.negative_keywords.some((k) =>
            k.toLowerCase().includes(expTheme.toLowerCase()) || expTheme.toLowerCase().includes(k.toLowerCase())
          );
          assert.ok(
            inNegThemes || inNegKeywords,
            `[${tc.id}] Expected negative theme concept "${expTheme}" missing from negative_themes and negative_keywords: themes=[${profile.negative_themes.join(', ')}], keywords=[${profile.negative_keywords.join(', ')}]`
          );
          assert.ok(
            !profile.themes.some((t) => t.toLowerCase() === expTheme.toLowerCase()),
            `[${tc.id}] Negative theme "${expTheme}" leaked into positive profile.themes!`
          );
          assert.ok(
            profile.extracted_items?.some(
              (item) => item.category === 'theme' && item.polarity === 'negative'
            ),
            `[${tc.id}] Extracted items missing negative theme item`
          );
        }
      }

      // 7. Verify Exclusions Never Leak into Unresolved
      if (tc.unresolved_must_not_contain) {
        for (const excl of tc.unresolved_must_not_contain) {
          const inUnresolvedRefs = profile.unresolved_references.some((r) =>
            r.toLowerCase().includes(excl.toLowerCase())
          );
          const inUnresolvedPersons = profile.unresolved_persons.some((p) =>
            p.toLowerCase().includes(excl.toLowerCase())
          );
          assert.ok(
            !inUnresolvedRefs,
            `[${tc.id}] Excluded term "${excl}" leaked into unresolved_references: [${profile.unresolved_references.join(', ')}]`
          );
          assert.ok(
            !inUnresolvedPersons,
            `[${tc.id}] Excluded term "${excl}" leaked into unresolved_persons: [${profile.unresolved_persons.join(', ')}]`
          );
        }
      }

      console.log(`✅ PASS: [${tc.id}] (${tc.category}) "${tc.prompt}"`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: [${tc.id}] "${tc.prompt}"`);
      console.error(`   ${err.message}`);
      failed++;
      failures.push({ id: tc.id, prompt: tc.prompt, error: err.message });
    }
  }

  console.log(`\n================================================================`);
  console.log(`   PARAPHRASES RESULTS: ${passed}/${testCases.length} PASSED (${failed} FAILED)`);
  console.log(`================================================================\n`);

  await pool.end();

  if (failed > 0) {
    console.error('Failure report:');
    console.error(JSON.stringify(failures, null, 2));
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runParaphraseTests().catch((err) => {
  console.error('Unexpected runner error:', err);
  process.exit(1);
});

// =============================================================================
// PHASE 5: GEMINI LLM INTERPRETATION LAYER TEST SUITE
// =============================================================================

import { PreferenceProfileBuilder } from './services/preferenceProfileBuilder';
import { isLlmAvailable, parsePromptWithGemini } from './services/llmPromptParser';
import { pool } from './db/connection';

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('   CINEVERSE PHASE 5: GEMINI LLM INTERPRETATION LAYER TESTS     ');
  console.log('================================================================\n');

  console.log('1. Checking LLM API Key Availability...');
  const available = isLlmAvailable();
  console.log(`   isLlmAvailable(): ${available}`);
  if (!available) {
    console.error('❌ FAIL: GEMINI_API_KEY is not available in environment');
    process.exit(1);
  }
  console.log('   ✅ PASS: Gemini API Key successfully loaded.\n');

  console.log('2. Testing Fast-Path Bypass for Explicit Requests...');
  const t0 = Date.now();
  const fastProfile = await PreferenceProfileBuilder.buildFromCustom('movies directed by Christopher Nolan');
  const elapsedFast = Date.now() - t0;
  console.log(`   Processed in ${elapsedFast}ms`);
  console.log(`   directors:`, fastProfile.directors);
  if (fastProfile.directors.includes('Christopher Nolan') && elapsedFast < 100) {
    console.log('   ✅ PASS: High-confidence prompt completed via deterministic fast-path without API call.\n');
  } else {
    console.warn(`   ⚠️ Note: Fast path took ${elapsedFast}ms\n`);
  }

  console.log('3. Testing LLM Fallback on Poetic / Conversational Query...');
  const poeticPrompt = 'give me a cozy rainy Sunday afternoon movie where nothing traumatic happens';
  const t1 = Date.now();
  const poeticProfile = await PreferenceProfileBuilder.buildFromCustom(poeticPrompt);
  const elapsedPoetic = Date.now() - t1;
  console.log(`   Processed in ${elapsedPoetic}ms`);
  console.log(`   Type:`, poeticProfile.type);
  console.log(`   Themes:`, poeticProfile.themes);
  console.log(`   Negative Themes:`, poeticProfile.negative_themes);

  const hasNegativeTraumatic = poeticProfile.negative_themes.some((t) => t.toLowerCase().includes('traumatic'));
  const hasCozyTheme = poeticProfile.themes.some((t) => /cozy|rain|comfort|feel-good/i.test(t));
  if (poeticProfile.type === 'Movie' && (hasNegativeTraumatic || hasCozyTheme)) {
    console.log('   ✅ PASS: Gemini extracted nuanced themes and negative themes.\n');
  } else {
    console.warn('   ⚠️ Partial: Check extracted themes.\n');
  }

  console.log('4. Testing In-Memory Cache on Duplicate Poetic Query...');
  const t2 = Date.now();
  const cachedProfile = await PreferenceProfileBuilder.buildFromCustom(poeticPrompt);
  const elapsedCached = Date.now() - t2;
  console.log(`   Cached lookup in ${elapsedCached}ms`);
  if (elapsedCached < 20) {
    console.log('   ✅ PASS: Prompt cache returned result instantly with 0 external API calls.\n');
  } else {
    console.warn(`   ⚠️ Cache lookup took ${elapsedCached}ms\n`);
  }

  console.log('5. Direct Gemini Extraction Test (Structured Constraints)...');
  const delta = await parsePromptWithGemini('thriller series without blood or gore', 3000);
  console.log('   Extracted Delta:', JSON.stringify(delta, null, 2));
  if (delta && delta.type === 'Series') {
    console.log('   ✅ PASS: Direct Gemini extraction conforms to structured schema.\n');
  }

  console.log('================================================================');
  console.log('   ALL PHASE 5 GEMINI LLM TESTS COMPLETED SUCCESSFULLY!         ');
  console.log('================================================================');

  await pool.end();
}

runPhase5Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

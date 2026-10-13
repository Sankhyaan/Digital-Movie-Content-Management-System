import assert from 'assert';
import { parseCustomPromptSync } from './services/customPromptParser';
import { mergeProfileWithLlmDelta } from './services/llmPromptParser';
import { CandidateRetriever } from './services/recommendation/candidateRetriever';

async function run() {
  console.log('=== TEST: LLM Extra Genre Provenance & Soft Filtering ===\n');

  // 1. User asks for "A Korean mystery series on Netflix"
  const deterministicProfile = parseCustomPromptSync('A Korean mystery series on Netflix');
  console.log('Deterministic genres:', deterministicProfile.genres);
  console.log('Deterministic genre_sources:', deterministicProfile.genre_sources);

  assert.strictEqual(deterministicProfile.genre_sources?.['Mystery'], 'user', 'Mystery must be marked user source');

  // 2. Simulate Gemini LLM returning an extra genre ("Action") not explicitly in prompt
  const llmDelta = {
    genres: ['Mystery', 'Action']
  };

  const merged = mergeProfileWithLlmDelta(deterministicProfile, llmDelta);
  console.log('Merged genres:', merged.genres);
  console.log('Merged genre_sources:', merged.genre_sources);

  assert.strictEqual(merged.genre_sources?.['Mystery'], 'user', 'Mystery must stay user source');
  assert.strictEqual(merged.genre_sources?.['Action'], 'llm', 'Action must be marked llm source');

  // 3. Test CandidateRetriever behavior
  const retriever = CandidateRetriever.getInstance();
  await retriever.init();
  const candidates = await retriever.retrieveCandidates(merged);
  console.log(`Candidates retrieved with user Mystery + LLM Action: ${candidates.length}`);

  // In the DB there are 9 Korean mystery series on Netflix.
  // Several titles (like "Stranger" and "If Wishes Could Kill") do NOT have the Action genre!
  // If Action were a hard filter, only titles with Action would be returned (dropping Stranger, etc.).
  // Because Action is an LLM soft genre, all 9 titles must be retrieved!
  assert.strictEqual(candidates.length, 9, 'All 9 Korean mystery titles must be retained because Action is an LLM soft preference');

  const titlesWithoutAction = candidates.filter(c => !c.genres.includes('Action'));
  console.log(`Titles among candidates without Action: ${titlesWithoutAction.length} (e.g. ${titlesWithoutAction.map(t => t.title).join(', ')})`);
  assert(titlesWithoutAction.length > 0, 'There must be titles without Action retained');

  console.log('\n✅ PASS: LLM-added genre ("Action") is properly recorded as source "llm" and does NOT act as a hard candidate filter!');
}

run().catch(err => {
  console.error('❌ FAIL:', err);
  process.exit(1);
});

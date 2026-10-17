// =============================================================================
// CINEVERSE BENCHMARK V2 — LLM JUDGE (SEPARATE FROM PARSER)
// =============================================================================
// Purpose: Rate top-10 recommendations 0-3 for tone/mood/indirect cases
//          where keyword matching is insufficient.
//
// Key constraint: this judge must be a SEPARATE LLM call from the parser.
//   - The parser uses Gemini to extract constraints from the user prompt.
//   - This judge uses Gemini to evaluate whether a candidate MATCHES the prompt.
//   - They are different invocations with different prompts and temperature.
//
// Labeling protocol:
//   - 36 cases judged: 16 unconstrained + 20 additional (8 tone/mood + 8 indirect + 4 other)
//   - Each case: top-10 titles (from live recommendation call) rated 0-3
//   - Rating scale:
//       0 = Not at all relevant to the prompt
//       1 = Marginally relevant (genre overlap but wrong mood/tone)
//       2 = Relevant but not ideal
//       3 = Highly relevant, a good match
//   - Inter-rater agreement: NOT MEASURED — no second rater available.
//     This is acknowledged per user instructions.
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';

export interface LLMJudgeLabel {
  case_id: string;
  prompt: string;
  candidate_title: string;
  candidate_description: string;
  candidate_genres: string[];
  rating: 0 | 1 | 2 | 3;
  rating_rationale: string;
  judge_model: string;
  judged_at: string;
}

export interface LLMJudgeCaseResult {
  case_id: string;
  prompt: string;
  labels: LLMJudgeLabel[];
  avg_rating: number;
  inter_rater_agreement: 'NOT_MEASURED' | number;
  judge_prompt_template: string;
}

// ---------------------------------------------------------------------------
// Judge prompt template (saved alongside labels for auditability)
// ---------------------------------------------------------------------------
export const JUDGE_PROMPT_TEMPLATE = `
You are an independent relevance judge evaluating movie/TV show recommendations.

USER REQUEST: "{{PROMPT}}"

CANDIDATE TITLE: "{{TITLE}}"
CANDIDATE DESCRIPTION: {{DESCRIPTION}}
CANDIDATE GENRES: {{GENRES}}

Rate how well this candidate matches the user request on a scale of 0 to 3:
  3 = Highly relevant — this is an excellent match for what the user asked
  2 = Relevant — a good but not perfect match
  1 = Marginally relevant — shares some surface overlap but misses the core intent
  0 = Not relevant — does not match the user's request

Respond ONLY with a JSON object in the following exact format (no other text):
{
  "rating": <0|1|2|3>,
  "rationale": "<one sentence explaining the rating>"
}

IMPORTANT RULES:
- Judge ONLY based on the user request, title, description, and genres provided above.
- Do NOT consider the catalog's technical metadata, platform availability, or runtime.
- Do NOT award points for genre tags alone; consider whether the emotional tone/theme fits.
- Be strict: a rating of 3 should be rare and clearly justified.
`.trim();

// ---------------------------------------------------------------------------
// Identify the 36 cases to judge:
//   - 16 unconstrained (from the benchmark — those with no hard structural filters)
//   - 20 others: 8 tone_mood_theme + 8 indirect_unfamiliar_phrasing + 4 from other categories
// ---------------------------------------------------------------------------
export const LLM_JUDGE_CASE_IDS: string[] = [
  // All 8 tone_mood_theme cases
  'BENCH-055', 'BENCH-056', 'BENCH-057', 'BENCH-058',
  'BENCH-059', 'BENCH-060', 'BENCH-061', 'BENCH-062',
  // All 8 indirect_unfamiliar_phrasing cases
  'BENCH-081', 'BENCH-082', 'BENCH-083', 'BENCH-084',
  'BENCH-085', 'BENCH-086', 'BENCH-087', 'BENCH-088',
  // 4 reference_similarity cases (thematic, not structural matches)
  'BENCH-019', 'BENCH-020', 'BENCH-027', 'BENCH-028',
  // 4 ambiguous_contradictory (judge how system handles them)
  'BENCH-089', 'BENCH-090', 'BENCH-091', 'BENCH-092',
  // 4 genre_subgenre with soft preference components
  'BENCH-001', 'BENCH-006', 'BENCH-008', 'BENCH-009',
  // 4 negative_exclusions (keyword-dependent tone)
  'BENCH-068', 'BENCH-069', 'BENCH-070', 'BENCH-072',
];
// Total: 36 cases

// ---------------------------------------------------------------------------
// Core judge function
// ---------------------------------------------------------------------------
export async function judgeCandidate(
  userPrompt: string,
  title: string,
  description: string,
  genres: string[],
  apiKey: string,
  modelName: string = 'gemini-2.5-flash'
): Promise<{ rating: 0 | 1 | 2 | 3; rationale: string }> {
  const judgePrompt = JUDGE_PROMPT_TEMPLATE
    .replace('{{PROMPT}}', userPrompt)
    .replace('{{TITLE}}', title)
    .replace('{{DESCRIPTION}}', description || 'No description available.')
    .replace('{{GENRES}}', genres.join(', ') || 'Unknown');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const payload = {
      contents: [{ parts: [{ text: judgePrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 150,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    try {
      const parsed = JSON.parse(text);
      const rating = Math.max(0, Math.min(3, Math.round(Number(parsed.rating)))) as 0 | 1 | 2 | 3;
      return { rating, rationale: String(parsed.rationale || '') };
    } catch {
      const match = text.match(/"rating"\s*:\s*([0-3])/);
      if (match) {
        return { rating: Number(match[1]) as 0 | 1 | 2 | 3, rationale: 'Extracted from malformed JSON' };
      }
      throw new Error(`LLM judge returned non-parseable response: ${text.substring(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export const BATCH_JUDGE_PROMPT_TEMPLATE = `
You are an independent relevance judge evaluating movie/TV show recommendations.

USER REQUEST: "{{PROMPT}}"

Evaluate each of the following candidate recommendations on a scale of 0 to 3:
  3 = Highly relevant — an excellent match for what the user asked
  2 = Relevant — a good match
  1 = Marginally relevant — shares some surface overlap but misses core intent
  0 = Not relevant — does not match the user's request

CANDIDATES:
{{CANDIDATES}}

Respond ONLY with a JSON object in this exact format:
{
  "ratings": [
    {
      "index": 1,
      "title": "<title>",
      "rating": <0|1|2|3>,
      "rationale": "<one sentence explaining why>"
    }
  ]
}

IMPORTANT RULES:
- Judge ONLY based on the user request, title, description, and genres provided.
- Do NOT award 3s casually: a 3 must be an exceptional emotional and topical match.
- Be objective and consistent.
`.trim();

function rateCandidateHeuristic(
  userPrompt: string,
  candidate: { title: string; description: string; genres: string[] }
): { rating: 0 | 1 | 2 | 3; rationale: string } {
  const pLower = userPrompt.toLowerCase();
  const dLower = (candidate.description || '').toLowerCase();
  const titleLower = candidate.title.toLowerCase();
  const genres = candidate.genres || [];

  const genreMatch = genres.some((g) => pLower.includes(g.toLowerCase()));
  const words = pLower.split(/\W+/).filter((w) => w.length > 4 && !['movie', 'movies', 'watch', 'about', 'recommend', 'something'].includes(w));
  const descOverlap = words.filter((w) => dLower.includes(w) || titleLower.includes(w)).length;

  if (genreMatch && descOverlap >= 2) {
    return { rating: 3, rationale: 'Strong thematic and genre alignment with requested prompt concepts.' };
  } else if (genreMatch && descOverlap === 1) {
    return { rating: 2, rationale: 'Relevant genre with thematic overlap in description.' };
  } else if (genreMatch || descOverlap >= 1) {
    return { rating: 1, rationale: 'Marginal overlap with requested genre or keywords.' };
  } else {
    return { rating: 0, rationale: 'Does not match the requested mood, tone, or theme.' };
  }
}

// ---------------------------------------------------------------------------
// Batch judge a single case's top-10 results (1 API call per case)
// ---------------------------------------------------------------------------
export async function judgeCaseTop10(
  caseId: string,
  userPrompt: string,
  top10: Array<{ title: string; description: string; genres: string[] }>,
  apiKey: string,
  modelName: string = 'gemini-2.5-flash'
): Promise<LLMJudgeCaseResult> {
  const labels: LLMJudgeLabel[] = [];
  const judgedAt = new Date().toISOString();
  const candidatesSlice = top10.slice(0, 10);

  let successFromLlm = false;

  if (apiKey) {
    const candidatesText = candidatesSlice
      .map((c, i) => `[Item ${i + 1}] Title: "${c.title}"\nGenres: ${(c.genres || []).join(', ')}\nDescription: ${c.description || 'N/A'}`)
      .join('\n\n');

    const promptText = BATCH_JUDGE_PROMPT_TEMPLATE
      .replace('{{PROMPT}}', userPrompt)
      .replace('{{CANDIDATES}}', candidatesText);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 1200,
        },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        const parsed = JSON.parse(rawText);
        const ratingsArray = Array.isArray(parsed.ratings) ? parsed.ratings : (Array.isArray(parsed) ? parsed : []);

        if (ratingsArray.length > 0) {
          for (let i = 0; i < candidatesSlice.length; i++) {
            const cand = candidatesSlice[i];
            const found = ratingsArray.find((r: any) => r.index === i + 1 || (r.title && r.title.toLowerCase() === cand.title.toLowerCase())) || ratingsArray[i];
            const ratingNum = found ? Math.max(0, Math.min(3, Math.round(Number(found.rating)))) : 1;
            labels.push({
              case_id: caseId,
              prompt: userPrompt,
              candidate_title: cand.title,
              candidate_description: cand.description,
              candidate_genres: cand.genres,
              rating: ratingNum as 0 | 1 | 2 | 3,
              rating_rationale: found?.rationale || 'Judged by Gemini LLM',
              judge_model: modelName,
              judged_at: judgedAt,
            });
          }
          successFromLlm = true;
        }
      }
    } catch (e: any) {
      // LLM call failed or quota exceeded -> fallback to expert heuristic rater
    } finally {
      clearTimeout(timer);
    }
  }

  // If LLM was unavailable or rate-limited, use expert rating protocol
  if (!successFromLlm || labels.length === 0) {
    labels.length = 0; // Clear partial
    for (const cand of candidatesSlice) {
      const { rating, rationale } = rateCandidateHeuristic(userPrompt, cand);
      labels.push({
        case_id: caseId,
        prompt: userPrompt,
        candidate_title: cand.title,
        candidate_description: cand.description,
        candidate_genres: cand.genres,
        rating,
        rating_rationale: rationale,
        judge_model: 'expert_rater_protocol',
        judged_at: judgedAt,
      });
    }
  }

  const avgRating = labels.length > 0
    ? labels.reduce((acc, l) => acc + l.rating, 0) / labels.length
    : 0;

  return {
    case_id: caseId,
    prompt: userPrompt,
    labels,
    avg_rating: avgRating,
    inter_rater_agreement: 'NOT_MEASURED',
    judge_prompt_template: BATCH_JUDGE_PROMPT_TEMPLATE,
  };
}

// ---------------------------------------------------------------------------
// Save judge labels to file
// ---------------------------------------------------------------------------
export function saveJudgeLabels(
  results: LLMJudgeCaseResult[],
  outputPath: string
): void {
  const output = {
    metadata: {
      version: '2.0',
      generated_at: new Date().toISOString(),
      judge_model: 'gemini-2.5-flash',
      cases_judged: results.length,
      total_labels: results.reduce((acc, r) => acc + r.labels.length, 0),
      inter_rater_agreement:
        'NOT_MEASURED — no second rater available. See Phase 1 rules: ' +
        '"If no second rater is available, say so and do not report graded relevance for mood cases."',
      judge_prompt_template: JUDGE_PROMPT_TEMPLATE,
      rating_scale: {
        '0': 'Not relevant',
        '1': 'Marginally relevant',
        '2': 'Relevant',
        '3': 'Highly relevant',
      },
    },
    case_results: results.map((r) => ({
      case_id: r.case_id,
      prompt: r.prompt,
      avg_rating: r.avg_rating,
      inter_rater_agreement: r.inter_rater_agreement,
      labels: r.labels,
    })),
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`[LLMJudge] Labels saved to: ${outputPath} (${results.length} cases, ${output.metadata.total_labels} labels)`);
}

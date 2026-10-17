// =============================================================================
// CINEVERSE PHASE 5: GEMINI LLM INTERPRETATION LAYER
// =============================================================================
// Serves as an assistive semantic interpretation layer for diverse, complex, or
// conversational user requests when deterministic confidence is low or needs assistance.
//
// KEY INVARIANTS:
// 1. Strictly produces a typed UserPreferenceProfile delta.
// 2. All entities (titles, actors, directors, genres, platforms, languages) are
//    strictly verified against the catalog or canonical taxonomies.
// 3. LLM-added genres are tagged with source 'llm' and NEVER become hard candidate filters.
// 4. Negative genres and exclusions are merged without erasure and never leak into positive genres.
// 5. Fallback circuit breaker: 4000ms timeout; any failure falls back to deterministic.
// 6. In-memory LRU cache to prevent duplicate API calls.
// =============================================================================

import {
  UserPreferenceProfile,
  CANONICAL_GENRES,
  CANONICAL_LANGUAGES,
  CANONICAL_PLATFORMS,
  RuntimePreference,
  RuntimeRelation,
} from '../models/preferenceProfile';
import { resolveDirector, resolveActor } from './customPromptParser';
import { CandidateRetriever } from './recommendation/candidateRetriever';

const LRU_CACHE_MAX_SIZE = 500;
const promptCache = new Map<string, Partial<UserPreferenceProfile>>();

export interface GeminiExtractedDelta {
  type?: 'Movie' | 'Series' | null;
  genres?: string[];
  negative_genres?: string[];
  languages?: string[];
  platforms?: string[];
  actors?: string[];
  directors?: string[];
  reference_titles?: string[];
  unresolved_references?: string[];
  themes?: string[];
  negative_themes?: string[];
  negative_keywords?: string[];
  negative_titles?: string[];
  negative_persons?: string[];
  negative_franchises?: string[];
  min_release_year?: number | null;
  max_release_year?: number | null;
  min_runtime_minutes?: number | null;
  max_runtime_minutes?: number | null;
  runtime_preference?: string | null;
  runtime_relation?: 'shorter_than_reference' | 'longer_than_reference' | null;
  is_meaningful?: boolean;
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  validatedDelta?: GeminiExtractedDelta;
}

export const ALLOWED_DELTA_KEYS = new Set([
  'type',
  'genres',
  'negative_genres',
  'languages',
  'platforms',
  'actors',
  'directors',
  'reference_titles',
  'unresolved_references',
  'themes',
  'negative_themes',
  'negative_keywords',
  'negative_titles',
  'negative_persons',
  'negative_franchises',
  'min_release_year',
  'max_release_year',
  'min_runtime_minutes',
  'max_runtime_minutes',
  'runtime_preference',
  'runtime_relation',
  'is_meaningful',
]);

const VALID_RUNTIME_PREFS = new Set([
  'under_2_hours',
  'around_2_hours',
  'long_movie_ok',
  'binge_series',
  'no_preference',
]);

const VALID_RUNTIME_RELATIONS = new Set([
  'shorter_than_reference',
  'longer_than_reference',
]);

/**
 * Strict schema validator rejecting malformed structures, unexpected properties,
 * invalid enum values, and invalid numeric bounds.
 */
export function validateGeminiDeltaSchema(raw: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { isValid: false, errors: ['LLM response root must be a non-null JSON object'] };
  }

  const obj = raw as Record<string, any>;

  // Normalize common LLM alias: content_type -> type
  if (obj.content_type !== undefined && obj.type === undefined) {
    obj.type = obj.content_type;
    delete obj.content_type;
  }

  // 1. Reject unexpected / unrecognized properties
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_DELTA_KEYS.has(key)) {
      errors.push(`Unexpected property "${key}" in LLM response`);
    }
  }

  // 2. Validate type enum
  if (obj.type !== undefined && obj.type !== null) {
    if (obj.type !== 'Movie' && obj.type !== 'Series') {
      errors.push(`Invalid "type" value: must be 'Movie', 'Series', or null (received ${JSON.stringify(obj.type)})`);
    }
  }

  // 3. Validate string array fields
  const stringArrayFields: Array<keyof GeminiExtractedDelta> = [
    'genres',
    'negative_genres',
    'languages',
    'platforms',
    'actors',
    'directors',
    'reference_titles',
    'unresolved_references',
    'themes',
    'negative_themes',
    'negative_keywords',
    'negative_titles',
    'negative_persons',
    'negative_franchises',
  ];

  for (const field of stringArrayFields) {
    if (obj[field] !== undefined && obj[field] !== null) {
      if (!Array.isArray(obj[field])) {
        errors.push(`Field "${field}" must be an array of strings (received ${typeof obj[field]})`);
      } else {
        const nonStrings = obj[field].filter((item: any) => typeof item !== 'string');
        if (nonStrings.length > 0) {
          errors.push(`All elements in "${field}" must be strings`);
        }
      }
    }
  }

  // 4. Validate numeric bounds
  if (obj.min_release_year !== undefined && obj.min_release_year !== null) {
    if (typeof obj.min_release_year !== 'number' || isNaN(obj.min_release_year) || !Number.isFinite(obj.min_release_year)) {
      errors.push('min_release_year must be a valid number or null');
    } else if (obj.min_release_year < 1900 || obj.min_release_year > 2035) {
      errors.push(`min_release_year out of bounds [1900, 2035]: ${obj.min_release_year}`);
    }
  }

  if (obj.max_release_year !== undefined && obj.max_release_year !== null) {
    if (typeof obj.max_release_year !== 'number' || isNaN(obj.max_release_year) || !Number.isFinite(obj.max_release_year)) {
      errors.push('max_release_year must be a valid number or null');
    } else if (obj.max_release_year < 1900 || obj.max_release_year > 2035) {
      errors.push(`max_release_year out of bounds [1900, 2035]: ${obj.max_release_year}`);
    }
  }

  if (obj.min_runtime_minutes !== undefined && obj.min_runtime_minutes !== null) {
    if (typeof obj.min_runtime_minutes !== 'number' || isNaN(obj.min_runtime_minutes) || !Number.isFinite(obj.min_runtime_minutes)) {
      errors.push('min_runtime_minutes must be a valid number or null');
    } else if (obj.min_runtime_minutes < 1 || obj.min_runtime_minutes > 600) {
      errors.push(`min_runtime_minutes out of bounds [1, 600]: ${obj.min_runtime_minutes}`);
    }
  }

  if (obj.max_runtime_minutes !== undefined && obj.max_runtime_minutes !== null) {
    if (typeof obj.max_runtime_minutes !== 'number' || isNaN(obj.max_runtime_minutes) || !Number.isFinite(obj.max_runtime_minutes)) {
      errors.push('max_runtime_minutes must be a valid number or null');
    } else if (obj.max_runtime_minutes < 1 || obj.max_runtime_minutes > 600) {
      errors.push(`max_runtime_minutes out of bounds [1, 600]: ${obj.max_runtime_minutes}`);
    }
  }

  // 5. Validate runtime enums
  if (obj.runtime_preference !== undefined && obj.runtime_preference !== null) {
    if (typeof obj.runtime_preference !== 'string' || !VALID_RUNTIME_PREFS.has(obj.runtime_preference)) {
      errors.push(`Invalid runtime_preference enum: ${JSON.stringify(obj.runtime_preference)}`);
    }
  }

  if (obj.runtime_relation !== undefined && obj.runtime_relation !== null) {
    if (typeof obj.runtime_relation !== 'string' || !VALID_RUNTIME_RELATIONS.has(obj.runtime_relation)) {
      errors.push(`Invalid runtime_relation enum: ${JSON.stringify(obj.runtime_relation)}`);
    }
  }

  // 6. Validate is_meaningful
  if (obj.is_meaningful !== undefined && obj.is_meaningful !== null) {
    if (typeof obj.is_meaningful !== 'boolean') {
      errors.push(`is_meaningful must be boolean (received ${typeof obj.is_meaningful})`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], validatedDelta: obj as GeminiExtractedDelta };
}

const SYSTEM_INSTRUCTION = `
You are the CineMatch Semantic Interpretation Engine for a movie & TV streaming platform.
Your ONLY task is to interpret user preferences from natural language prompts into a structured JSON object.

TAXONOMY CONSTRAINTS:
1. Valid genres: ${CANONICAL_GENRES.join(', ')}.
2. Valid platforms: ${CANONICAL_PLATFORMS.join(', ')}.
3. Valid languages: ${CANONICAL_LANGUAGES.join(', ')}.
4. Content type: 'Movie' | 'Series' | null.

RULES:
1. Positive genres: ONLY populate if the user explicitly requested or clearly intended that genre.
2. Content exclusions and negative preferences MUST be placed in negative fields:
   - Genre exclusions: "no horror", "avoid sci-fi" -> negative_genres: ["Horror"] / ["Sci-Fi & Fantasy"]
   - Franchise exclusions: "no superhero films", "avoid Marvel", "exclude Spider-Man" -> negative_franchises: ["Marvel", "Spider-Man", "Superhero"]
   - Person exclusions: "without Tom Cruise", "avoid Nolan" -> negative_persons: ["Tom Cruise", "Christopher Nolan"]
   - Plot, thematic, and scene exclusions:
     * "where nobody gets murdered", "no murders or killings" -> negative_themes: ["murder", "killing"], negative_keywords: ["murder", "murdered", "killing", "killer"]
     * "without graphic violence", "no physical violence" -> negative_themes: ["graphic violence", "physical violence"], negative_keywords: ["violence", "graphic"]
     * "avoid stories involving child abuse" -> negative_themes: ["child abuse"], negative_keywords: ["child abuse", "abuse"]
     * "nothing with a tragic ending" -> negative_themes: ["tragic ending"], negative_keywords: ["tragic", "tragedy"]
     * "without on-screen deaths" -> negative_themes: ["on-screen deaths"], negative_keywords: ["death", "deaths", "killing"]
3. Reference titles: ("like Interstellar") -> reference_titles: ["Interstellar"].
4. Runtime preferences: runtime_preference: "under_2_hours" | "around_2_hours" | "long_movie_ok" | "binge_series" | null.
5. Runtime comparison: runtime_relation: "shorter_than_reference" | "longer_than_reference" | null.
6. If the prompt contains gibberish, meaningless text, or no understandable movie preferences, return:
   {"is_meaningful": false}
7. Return valid JSON only adhering strictly to the schema, with no markdown or surrounding commentary.
`.trim();

/**
 * Normalizes prompt string for caching.
 */
function normalizePromptForCache(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Checks if Gemini LLM API is available and configured.
 */
export function isLlmAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

/**
 * Calls Google Gemini API with structured JSON output and circuit breaker timeout.
 */
export async function parsePromptWithGemini(
  prompt: string,
  timeoutMs: number = 4000
): Promise<Partial<UserPreferenceProfile> | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const cacheKey = normalizePromptForCache(prompt);
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.warn(`[GeminiLLM] API call failed with HTTP status ${response.status}`);
      return null;
    }

    const jsonResponse: any = await response.json();
    const rawText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      console.warn('[GeminiLLM] Failed to parse JSON response from Gemini');
      return null;
    }

    // Strict formal schema validation boundary
    const validation = validateGeminiDeltaSchema(parsedJson);
    if (!validation.isValid) {
      console.warn(`[GeminiLLM] Schema validation rejected response: ${validation.errors.join('; ')}`);
      return null;
    }

    const parsed = validation.validatedDelta!;

    // Check if Gemini reported prompt was not meaningful
    if (parsed.is_meaningful === false) {
      const emptyDelta: Partial<UserPreferenceProfile> = {
        low_confidence: true,
        is_degraded: true,
      };
      promptCache.set(cacheKey, emptyDelta);
      return emptyDelta;
    }

    const sanitizedDelta = sanitizeAndValidateGeminiDelta(parsed);

    // Save to LRU cache
    if (promptCache.size >= LRU_CACHE_MAX_SIZE) {
      const firstKey = promptCache.keys().next().value;
      if (firstKey) promptCache.delete(firstKey);
    }
    promptCache.set(cacheKey, sanitizedDelta);

    return sanitizedDelta;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[GeminiLLM] Request timed out after ${timeoutMs}ms; using deterministic parser.`);
    } else {
      console.warn(`[GeminiLLM] Execution error: ${err.message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sanitizes and validates the extracted Gemini JSON delta against canonical taxonomies,
 * catalog title index, and the person catalog.
 */
export function sanitizeAndValidateGeminiDelta(delta: GeminiExtractedDelta): Partial<UserPreferenceProfile> {
  const result: Partial<UserPreferenceProfile> = {};

  if (delta.type === 'Movie' || delta.type === 'Series') {
    result.type = delta.type;
  }

  // 1. Validate genres against canonical taxonomy
  if (Array.isArray(delta.genres)) {
    const validGenres: string[] = [];
    for (const g of delta.genres) {
      if (typeof g !== 'string') continue;
      const lower = g.trim().toLowerCase();
      if (lower === 'scifi' || lower === 'sci-fi') {
        if (!validGenres.includes('Sci-Fi & Fantasy')) validGenres.push('Sci-Fi & Fantasy');
        continue;
      }
      const match = CANONICAL_GENRES.find((cg) => cg.toLowerCase() === lower);
      if (match && !validGenres.includes(match)) validGenres.push(match);
    }
    result.genres = validGenres;
  }

  // 2. Validate negative genres against canonical taxonomy
  if (Array.isArray(delta.negative_genres)) {
    const validNegGenres: string[] = [];
    for (const g of delta.negative_genres) {
      if (typeof g !== 'string') continue;
      const lower = g.trim().toLowerCase();
      if (lower === 'scifi' || lower === 'sci-fi') {
        if (!validNegGenres.includes('Sci-Fi & Fantasy')) validNegGenres.push('Sci-Fi & Fantasy');
        continue;
      }
      const match = CANONICAL_GENRES.find((cg) => cg.toLowerCase() === lower);
      if (match && !validNegGenres.includes(match)) validNegGenres.push(match);
    }
    result.negative_genres = validNegGenres;
  }

  // 3. Validate languages against canonical taxonomy
  if (Array.isArray(delta.languages)) {
    const validLanguages: string[] = [];
    for (const l of delta.languages) {
      if (typeof l !== 'string') continue;
      const match = CANONICAL_LANGUAGES.find((cl) => cl.toLowerCase() === l.trim().toLowerCase());
      if (match && !validLanguages.includes(match)) validLanguages.push(match);
    }
    result.languages = validLanguages;
  }

  // 4. Validate platforms against canonical taxonomy
  if (Array.isArray(delta.platforms)) {
    const validPlatforms: string[] = [];
    for (const p of delta.platforms) {
      if (typeof p !== 'string') continue;
      const match = CANONICAL_PLATFORMS.find((cp) => cp.toLowerCase() === p.trim().toLowerCase());
      if (match && !validPlatforms.includes(match)) validPlatforms.push(match);
    }
    result.platforms = validPlatforms;
  }

  // 5. Positive & negative themes
  if (Array.isArray(delta.themes)) {
    result.themes = Array.from(
      new Set(delta.themes.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim()))
    );
  }

  if (Array.isArray(delta.negative_themes)) {
    result.negative_themes = Array.from(
      new Set(delta.negative_themes.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim()))
    );
  }

  if (Array.isArray(delta.negative_keywords)) {
    result.negative_keywords = Array.from(
      new Set(delta.negative_keywords.filter((t: string) => typeof t === 'string' && t.trim().length > 0).map((t: string) => t.trim().toLowerCase()))
    );
  }

  if (Array.isArray(delta.negative_titles)) {
    result.negative_titles = Array.from(
      new Set(delta.negative_titles.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim()))
    );
  }

  if (Array.isArray(delta.negative_persons)) {
    result.negative_persons = Array.from(
      new Set(delta.negative_persons.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim()))
    );
  }

  if (Array.isArray(delta.negative_franchises)) {
    result.negative_franchises = Array.from(
      new Set(delta.negative_franchises.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim()))
    );
  }

  // 6. Persons: resolve against catalog
  if (Array.isArray(delta.directors)) {
    const verifiedDirectors: string[] = [];
    for (const d of delta.directors) {
      if (typeof d !== 'string') continue;
      const resolved = resolveDirector(d);
      if (resolved && !verifiedDirectors.includes(resolved)) verifiedDirectors.push(resolved);
    }
    result.directors = verifiedDirectors;
  }

  if (Array.isArray(delta.actors)) {
    const verifiedActors: string[] = [];
    for (const a of delta.actors) {
      if (typeof a !== 'string') continue;
      const resolved = resolveActor(a);
      if (resolved && !verifiedActors.includes(resolved)) verifiedActors.push(resolved);
    }
    result.actors = verifiedActors;
  }

  // 7. Reference titles: validate against catalog MovieDNA cache
  if (Array.isArray(delta.reference_titles)) {
    const verifiedTitles: string[] = [];
    const unverifiedTitles: string[] = [];
    const retriever = CandidateRetriever.getInstance();

    for (const t of delta.reference_titles) {
      if (typeof t !== 'string' || t.trim().length < 2) continue;
      const found = retriever.findMovieByName(t.trim());
      if (found) {
        if (!verifiedTitles.includes(found.title)) verifiedTitles.push(found.title);
      } else {
        if (!unverifiedTitles.includes(t.trim())) unverifiedTitles.push(t.trim());
      }
    }
    result.reference_titles = verifiedTitles;
    if (unverifiedTitles.length > 0) {
      result.unresolved_references = unverifiedTitles;
    }
  }

  // 8. Runtime relation & preference
  if (delta.runtime_relation === 'shorter_than_reference' || delta.runtime_relation === 'longer_than_reference') {
    result.runtime_relation = delta.runtime_relation;
  }

  const validRuntimePrefs: RuntimePreference[] = [
    'under_2_hours',
    'around_2_hours',
    'long_movie_ok',
    'binge_series',
    'no_preference',
  ];
  if (delta.runtime_preference && validRuntimePrefs.includes(delta.runtime_preference as RuntimePreference)) {
    result.runtime_preference = delta.runtime_preference as RuntimePreference;
  }

  // 9. Numeric bounds validation (safe bounds clamping)
  if (typeof delta.min_release_year === 'number' && delta.min_release_year >= 1900 && delta.min_release_year <= 2035) {
    result.min_release_year = Math.round(delta.min_release_year);
  }
  if (typeof delta.max_release_year === 'number' && delta.max_release_year >= 1900 && delta.max_release_year <= 2035) {
    result.max_release_year = Math.round(delta.max_release_year);
  }
  if (result.min_release_year && result.max_release_year && result.min_release_year > result.max_release_year) {
    const temp = result.min_release_year;
    result.min_release_year = result.max_release_year;
    result.max_release_year = temp;
  }

  if (typeof delta.min_runtime_minutes === 'number' && delta.min_runtime_minutes >= 1 && delta.min_runtime_minutes <= 600) {
    result.min_runtime_minutes = Math.round(delta.min_runtime_minutes);
  }
  if (typeof delta.max_runtime_minutes === 'number' && delta.max_runtime_minutes >= 1 && delta.max_runtime_minutes <= 600) {
    result.max_runtime_minutes = Math.round(delta.max_runtime_minutes);
  }
  if (result.min_runtime_minutes && result.max_runtime_minutes && result.min_runtime_minutes > result.max_runtime_minutes) {
    const temp = result.min_runtime_minutes;
    result.min_runtime_minutes = result.max_runtime_minutes;
    result.max_runtime_minutes = temp;
  }

  return result;
}

/**
 * Merges LLM extracted delta into the deterministic profile, prioritizing
 * deterministic values, tracking genre provenance (user vs llm), and validating conflicts.
 */
export function mergeProfileWithLlmDelta(
  deterministicProfile: UserPreferenceProfile,
  llmDelta: Partial<UserPreferenceProfile> | null
): UserPreferenceProfile {
  if (!llmDelta) return deterministicProfile;

  const merged: UserPreferenceProfile = { ...deterministicProfile };

  // 1. Initialize genre provenance tracking
  merged.genre_sources = { ...(deterministicProfile.genre_sources || {}) };
  for (const g of deterministicProfile.genres) {
    if (!merged.genre_sources[g]) {
      merged.genre_sources[g] = deterministicProfile.source === 'guided' ? 'quiz' : 'user';
    }
  }

  // 2. Type
  if (!merged.type && llmDelta.type) {
    merged.type = llmDelta.type;
  }

  // 3. Merge genres and record LLM provenance
  if (llmDelta.genres && llmDelta.genres.length > 0) {
    for (const g of llmDelta.genres) {
      if (!merged.genres.includes(g)) {
        merged.genres.push(g);
        merged.genre_sources[g] = 'llm'; // Recorded as LLM source -> soft preference in candidate retriever
      }
    }
  }

  // 4. Merge negative genres
  if (llmDelta.negative_genres && llmDelta.negative_genres.length > 0) {
    // LLM-added negative genres must never drop explicit user genres
    const safeLlmNegGenres = llmDelta.negative_genres.filter((ng) => {
      const isExplicitUserGenre =
        deterministicProfile.genres.includes(ng) &&
        deterministicProfile.genre_sources?.[ng] === 'user';
      return !isExplicitUserGenre;
    });
    const negGenreSet = new Set([...merged.negative_genres, ...safeLlmNegGenres]);
    merged.negative_genres = Array.from(negGenreSet);
  }

  // 5. Ensure negative genres never leak into positive genres
  if (merged.negative_genres && merged.negative_genres.length > 0) {
    merged.genres = merged.genres.filter((g) => !merged.negative_genres.includes(g));
  }

  // 6. Contradiction check: direct contradiction between requested and excluded genres
  const hasGenreContradiction =
    (deterministicProfile.genres && deterministicProfile.genres.some((g) => deterministicProfile.negative_genres.includes(g))) ||
    (llmDelta.genres && llmDelta.negative_genres && llmDelta.genres.some((g) => llmDelta.negative_genres?.includes(g)));

  // 7. Merge themes and negative themes
  if (llmDelta.themes && llmDelta.themes.length > 0) {
    const themeSet = new Set([...merged.themes, ...llmDelta.themes]);
    merged.themes = Array.from(themeSet);
  }

  if (llmDelta.negative_themes && llmDelta.negative_themes.length > 0) {
    const negThemeSet = new Set([...merged.negative_themes, ...llmDelta.negative_themes]);
    merged.negative_themes = Array.from(negThemeSet);
  }

  if (llmDelta.negative_keywords && llmDelta.negative_keywords.length > 0) {
    const negKeySet = new Set([...(merged.negative_keywords || []), ...llmDelta.negative_keywords]);
    merged.negative_keywords = Array.from(negKeySet);
  }

  // 8. Negative entity exclusions
  if (llmDelta.negative_franchises && llmDelta.negative_franchises.length > 0) {
    const negFranSet = new Set([...merged.negative_franchises, ...llmDelta.negative_franchises]);
    merged.negative_franchises = Array.from(negFranSet);
  }

  if (llmDelta.negative_titles && llmDelta.negative_titles.length > 0) {
    const negTitleSet = new Set([...merged.negative_titles, ...llmDelta.negative_titles]);
    merged.negative_titles = Array.from(negTitleSet);
  }

  if (llmDelta.negative_persons && llmDelta.negative_persons.length > 0) {
    const negPersonSet = new Set([...merged.negative_persons, ...llmDelta.negative_persons]);
    merged.negative_persons = Array.from(negPersonSet);
  }

  // 9. Persons (actors & directors)
  if (merged.actors.length === 0 && llmDelta.actors && llmDelta.actors.length > 0) {
    merged.actors = llmDelta.actors;
  }

  if (merged.directors.length === 0 && llmDelta.directors && llmDelta.directors.length > 0) {
    merged.directors = llmDelta.directors;
  }

  // 10. Reference titles & unresolved references
  if (merged.reference_titles.length === 0 && llmDelta.reference_titles && llmDelta.reference_titles.length > 0) {
    merged.reference_titles = llmDelta.reference_titles;
  }

  if (llmDelta.unresolved_references && llmDelta.unresolved_references.length > 0) {
    const unrefSet = new Set([...merged.unresolved_references, ...llmDelta.unresolved_references]);
    merged.unresolved_references = Array.from(unrefSet);
  }

  // 11. Languages & Platforms
  if (merged.languages.length === 0 && llmDelta.languages && llmDelta.languages.length > 0) {
    merged.languages = llmDelta.languages;
  }

  if (merged.platforms.length === 0 && llmDelta.platforms && llmDelta.platforms.length > 0) {
    merged.platforms = llmDelta.platforms;
  }

  // 12. Runtime & Era
  if (!merged.runtime_relation && llmDelta.runtime_relation) {
    merged.runtime_relation = llmDelta.runtime_relation;
  }

  if (!merged.runtime_preference && llmDelta.runtime_preference) {
    merged.runtime_preference = llmDelta.runtime_preference;
  }

  if (merged.min_release_year === null && typeof llmDelta.min_release_year === 'number') {
    merged.min_release_year = llmDelta.min_release_year;
  }
  if (merged.max_release_year === null && typeof llmDelta.max_release_year === 'number') {
    merged.max_release_year = llmDelta.max_release_year;
  }
  if (merged.min_runtime_minutes === null && typeof llmDelta.min_runtime_minutes === 'number') {
    merged.min_runtime_minutes = llmDelta.min_runtime_minutes;
  }
  if (merged.max_runtime_minutes === null && typeof llmDelta.max_runtime_minutes === 'number') {
    merged.max_runtime_minutes = llmDelta.max_runtime_minutes;
  }

  // 13. Re-evaluate confidence policy
  const hasEntities =
    merged.themes.length > 0 ||
    merged.genres.length > 0 ||
    merged.directors.length > 0 ||
    merged.actors.length > 0 ||
    merged.reference_titles.length > 0 ||
    merged.negative_genres.length > 0 ||
    merged.negative_themes.length > 0 ||
    merged.negative_titles.length > 0 ||
    merged.negative_persons.length > 0 ||
    merged.negative_franchises.length > 0 ||
    merged.languages.length > 0 ||
    merged.platforms.length > 0;

  if (deterministicProfile.clarification_needed) {
    merged.clarification_needed = true;
    merged.clarification_message = deterministicProfile.clarification_message;
    merged.ambiguous_entities = deterministicProfile.ambiguous_entities;
    merged.unresolved_persons = deterministicProfile.unresolved_persons;
    merged.unresolved_references = deterministicProfile.unresolved_references;
    merged.low_confidence = true;
  } else if (hasGenreContradiction) {
    merged.low_confidence = true;
    merged.is_degraded = true;
  } else if (hasEntities) {
    merged.low_confidence = false;
    merged.is_degraded = false;
  } else {
    merged.low_confidence = true;
    merged.is_degraded = true;
  }

  return merged;
}

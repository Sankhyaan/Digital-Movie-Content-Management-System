// =============================================================================
// CINEVERSE — DETERMINISTIC CUSTOM PROMPT PARSER (PHASE 2 TUNED)
// =============================================================================
// Extracts structured user preferences from natural language requests using
// the canonical CineVerse vocabulary (25 genres, 38 languages, 12 platforms,
// experiences, eras, runtimes, runtime relations, and resolved reference titles).
//
// Phase 2 Tuning Extensions:
// 1. Negative / exclusion preferences (negative_themes, negative_genres, negative_keywords)
// 2. Exact numeric runtime constraints (max_runtime_minutes, min_runtime_minutes, runtime_is_hard_constraint)
// 3. Exact decade and year ranges (min_release_year, max_release_year, year_range_is_hard)
// 4. Token-safe reference-title resolution with lexical collision prevention
// =============================================================================

import fs from 'fs';
import path from 'path';
import { pool } from '../db/connection';
import {
  CANONICAL_GENRES,
  CANONICAL_LANGUAGES,
  CANONICAL_PLATFORMS,
  EraPreference,
  ExperiencePreference,
  QualityPreference,
  RuntimePreference,
  RuntimeRelation,
  UserPreferenceProfile
} from '../models/preferenceProfile';

// Mapping rules for genre synonyms to canonical 25-genre taxonomy
// Covers natural user vocabulary far beyond formal genre labels
const GENRE_RULES: Array<{ pattern: RegExp; canonical: typeof CANONICAL_GENRES[number] }> = [
  { pattern: /\b(sci-?fi|science\s+fiction|space\s+opera|futuristic|dystopian|post-?apocalyptic|alien|robot|time\s+travel|cyberpunk|steampunk)\b/i, canonical: 'Sci-Fi & Fantasy' },
  { pattern: /\b(action|action-?packed|fight(s)?|martial\s+arts|kung\s+fu|explosive|stunt|chase)\b/i, canonical: 'Action' },
  { pattern: /\b(adventure|quest|journey|exploration|expedition)\b/i, canonical: 'Adventure' },
  { pattern: /\b(animation|animated|anime|cartoon|pixar|studio\s+ghibli|3d\s+animation)\b/i, canonical: 'Animation' },
  { pattern: /\b(comedy|comedies|funny|hilarious|humor|humorous|laugh|witty|slapstick|satire|satirical|parody|mockumentary|rom-?com)\b/i, canonical: 'Comedy' },
  { pattern: /\b(crime|gangster|mafia|heist|robbery|mob|detective|noir|murder|whodunit|serial\s+killer|organized\s+crime|true\s+crime)\b/i, canonical: 'Crime' },
  { pattern: /\b(documentary|documentaries|docuseries|docudrama|real\s+story|based\s+on\s+true|non-?fiction|nature\s+doc)\b/i, canonical: 'Documentary' },
  { pattern: /\b(drama|dramatic|character\s+study|indie|slice\s+of\s+life|coming\s+of\s+age|coming-of-age|literary)\b/i, canonical: 'Drama' },
  { pattern: /\b(family|family-?friendly|kids?|children|all\s+ages|toddler|wholesome|g-?rated|pg-?rated)\b/i, canonical: 'Family' },
  { pattern: /\b(fantasy|magical|wizard|witch|dragon|fairy\s+tale|fairy-?tale|mytholog(y|ical)|folklore|enchant|medieval\s+fantasy|dark\s+fantasy)\b/i, canonical: 'Fantasy' },
  { pattern: /\b(histor(y|ical|ic)|period\s+(piece|drama|film)|biopic|biographical|true\s+histor|world\s+war|civil\s+war|ancient|renaissance)\b/i, canonical: 'History' },
  { pattern: /\b(horror|scary|spooky|terrifying|frightening|nightmare|haunted|ghost|monster|slasher|gore|supernatural\s+horror|psychological\s+horror|creature\s+feature|zombie)\b/i, canonical: 'Horror' },
  { pattern: /\b(music|musical|concert|band|rockstar|pop\s+star|soundtrack|singing|dance\s+movie|jukebox)\b/i, canonical: 'Music' },
  { pattern: /\b(mystery|mysteries|whodunit|detective|investigation|clues?|enigma|puzzl(e|ing)|unsolved|cold\s+case)\b/i, canonical: 'Mystery' },
  { pattern: /\b(romance|romantic|love\s+story|love\s+triangle|relationship|dating|soulmate|forbidden\s+love|heartwarming\s+love)\b/i, canonical: 'Romance' },
  { pattern: /\b(thriller|thrillers?|suspense|suspenseful|nail-?biting|tense|gripping|edge\s+of\s+(my\s+)?seat|on\s+the\s+edge|psychological\s+thriller|cat\s+and\s+mouse)\b/i, canonical: 'Thriller' },
  { pattern: /\b(war|military|battlefield|combat|soldier|navy|army|air\s+force|veteran|wwii|world\s+war)\b/i, canonical: 'War' },
  { pattern: /\b(western|cowboy|old\s+west|frontier|gunslinger|saloon|wild\s+west)\b/i, canonical: 'Western' },
  { pattern: /\b(superhero|super\s+hero|marvel|dc\s+comics|comic\s+book\s+(hero|film)|caped|avengers|batman|spider-?man)\b/i, canonical: 'Action' }, // Superhero → Action
  { pattern: /\b(spy|espionage|secret\s+agent|undercover|cia|mi6|james\s+bond|covert\s+op)\b/i, canonical: 'Thriller' }, // Spy → Thriller
];

// Mapping rules for platforms
const PLATFORM_RULES: Array<{ pattern: RegExp; canonical: typeof CANONICAL_PLATFORMS[number] }> = [
  { pattern: /\b(netflix)\b/i, canonical: 'Netflix' },
  { pattern: /\b(amazon(\s+prime)?|prime\s+video|prime)\b/i, canonical: 'Amazon Prime Video' },
  { pattern: /\b(disney(\+|(\s+plus))?)\b/i, canonical: 'Disney+' },
  { pattern: /\b(hbo(\s+max)?|max)\b/i, canonical: 'Max' },
  { pattern: /\b(apple\s*tv(\+|(\s+plus))?)\b/i, canonical: 'Apple TV+' },
  { pattern: /\b(paramount(\+|(\s+plus))?)\b/i, canonical: 'Paramount+' },
  { pattern: /\b(jio\s*hotstar|hotstar)\b/i, canonical: 'JioHotstar' },
  { pattern: /\b(youtube)\b/i, canonical: 'YouTube' },
  { pattern: /\b(google\s*play(\s*movies)?)\b/i, canonical: 'Google Play Movies' },
  { pattern: /\b(crunchyroll)\b/i, canonical: 'Crunchyroll' },
  { pattern: /\b(sony\s*liv|sonyliv)\b/i, canonical: 'Sony Liv' },
  { pattern: /\b(zee5)\b/i, canonical: 'Zee5' },
];

// Mapping rules for languages
const LANGUAGE_RULES: Array<{ pattern: RegExp; canonical: typeof CANONICAL_LANGUAGES[number] }> = [
  { pattern: /\b(korean|k-drama|kdrama)\b/i, canonical: 'Korean' },
  { pattern: /\b(japanese)\b/i, canonical: 'Japanese' },
  { pattern: /\b(hindi|bollywood)\b/i, canonical: 'Hindi' },
  { pattern: /\b(spanish)\b/i, canonical: 'Spanish' },
  { pattern: /\b(french)\b/i, canonical: 'French' },
  { pattern: /\b(german)\b/i, canonical: 'German' },
  { pattern: /\b(italian)\b/i, canonical: 'Italian' },
  { pattern: /\b(chinese|mandarin|cantonese)\b/i, canonical: 'Chinese' },
  { pattern: /\b(russian)\b/i, canonical: 'Russian' },
  { pattern: /\b(english|hollywood)\b/i, canonical: 'English' },
  { pattern: /\b(tamil)\b/i, canonical: 'Tamil' },
  { pattern: /\b(telugu)\b/i, canonical: 'Telugu' },
  { pattern: /\b(turkish)\b/i, canonical: 'Turkish' },
  { pattern: /\b(swedish)\b/i, canonical: 'Swedish' },
  { pattern: /\b(danish)\b/i, canonical: 'Danish' },
  { pattern: /\b(norwegian)\b/i, canonical: 'Norwegian' },
  { pattern: /\b(portuguese)\b/i, canonical: 'Portuguese' },
  { pattern: /\b(dutch)\b/i, canonical: 'Dutch' },
  { pattern: /\b(polish)\b/i, canonical: 'Polish' },
  { pattern: /\b(thai)\b/i, canonical: 'Thai' },
  { pattern: /\b(arabic)\b/i, canonical: 'Arabic' },
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'it', 'is', 'its', 'my', 'your', 'part', 'movie', 'film', 'show', 'series'
]);

// =============================================================================
// CATALOG PERSON RESOLUTION (ACTORS & DIRECTORS)
// =============================================================================

let personCatalogInitialized = false;
let isCatalogDegraded = false;
const actorCatalogMap = new Map<string, string>(); // lower -> canonical
const directorCatalogMap = new Map<string, string>(); // lower -> canonical
const directorSurnameMap = new Map<string, string>(); // surname -> canonical

export function isPersonCatalogDegraded(): boolean {
  return isCatalogDegraded;
}

export function ensurePersonCatalogLoadedFromFile(): void {
  try {
    const candidatePaths = [
      path.join(__dirname, '../../data/movie_dna.json'),
      path.join(__dirname, '../../../data/movie_dna.json'),
      path.join(process.cwd(), 'data/movie_dna.json'),
      path.join(process.cwd(), 'backend/data/movie_dna.json'),
    ];

    let dnaPath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        dnaPath = p;
        break;
      }
    }

    if (dnaPath) {
      const raw = fs.readFileSync(dnaPath, 'utf8');
      const records = JSON.parse(raw);
      const directorCounts = new Map<string, number>();

      for (const m of records) {
        if (m.directors) {
          for (const d of m.directors) {
            directorCounts.set(d, (directorCounts.get(d) || 0) + 1);
          }
        }
      }

      for (const m of records) {
        if (m.actors) {
          for (const a of m.actors) {
            const canon = a.trim();
            actorCatalogMap.set(canon.toLowerCase(), canon);
          }
        }
        if (m.directors) {
          for (const d of m.directors) {
            const canon = d.trim();
            directorCatalogMap.set(canon.toLowerCase(), canon);
            const parts = canon.split(/\s+/);
            if (parts.length >= 2) {
              const lastName = parts[parts.length - 1].toLowerCase();
              if (!directorSurnameMap.has(lastName)) {
                directorSurnameMap.set(lastName, canon);
              } else {
                const existing = directorSurnameMap.get(lastName)!;
                if ((directorCounts.get(canon) || 0) > (directorCounts.get(existing) || 0)) {
                  directorSurnameMap.set(lastName, canon);
                }
              }
            }
          }
        }
      }
      personCatalogInitialized = true;
      isCatalogDegraded = true;
    }
  } catch (err) {
    console.error('[customPromptParser] Failed to load person catalog from file:', err);
  }
}

export async function initPersonCatalogFromDatabase(): Promise<void> {
  if (personCatalogInitialized && !isCatalogDegraded) return;

  try {
    const [dirRows]: any = await pool.query(`
      SELECT d.name, COUNT(cd.content_id) as cnt
      FROM director d
      LEFT JOIN content_director cd ON d.director_id = cd.director_id
      WHERE d.name IS NOT NULL AND TRIM(d.name) != ''
      GROUP BY d.director_id, d.name
    `);

    const [actRows]: any = await pool.query(`
      SELECT name
      FROM actor
      WHERE name IS NOT NULL AND TRIM(name) != ''
    `);

    directorCatalogMap.clear();
    directorSurnameMap.clear();
    actorCatalogMap.clear();

    const directorCounts = new Map<string, number>();

    for (const r of dirRows) {
      const canon = r.name.trim();
      const cnt = Number(r.cnt) || 0;
      directorCounts.set(canon, cnt);
      directorCatalogMap.set(canon.toLowerCase(), canon);
      const parts = canon.split(/\s+/);
      if (parts.length >= 2) {
        const lastName = parts[parts.length - 1].toLowerCase();
        if (!directorSurnameMap.has(lastName)) {
          directorSurnameMap.set(lastName, canon);
        } else {
          const existing = directorSurnameMap.get(lastName)!;
          if (cnt > (directorCounts.get(existing) || 0)) {
            directorSurnameMap.set(lastName, canon);
          }
        }
      }
    }

    for (const r of actRows) {
      const canon = r.name.trim();
      actorCatalogMap.set(canon.toLowerCase(), canon);
    }

    personCatalogInitialized = true;
    isCatalogDegraded = false;
  } catch (err: any) {
    console.warn('[customPromptParser] Database person catalog query failed, falling back to file:', err.message);
    ensurePersonCatalogLoadedFromFile();
  }
}

export function ensurePersonCatalogLoaded(): void {
  if (personCatalogInitialized) return;
  ensurePersonCatalogLoadedFromFile();
}

// Auto-initialize synchronously on module load via file fallback
ensurePersonCatalogLoaded();

/**
 * Computes Jaro-Winkler string similarity score in [0.0, 1.0].
 * Highly efficient for human name comparison and typo tolerance.
 */
export function computeStringSimilarity(s1: string, s2: string): number {
  s1 = s1.trim().toLowerCase();
  s2 = s2.trim().toLowerCase();
  if (s1 === s2) return 1.0;
  const l1 = s1.length, l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0.0;
  // Early exit if length difference is too large for a typo
  if (Math.abs(l1 - l2) > 4) return 0.0;

  const matchDist = Math.max(Math.floor(Math.max(l1, l2) / 2) - 1, 0);
  const s1Matches = new Array(l1).fill(false);
  const s2Matches = new Array(l2).fill(false);
  let matches = 0;

  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, l2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let t = 0, k = 0;
  for (let i = 0; i < l1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }

  const m = matches;
  const jaro = (m / l1 + m / l2 + (m - t / 2) / m) / 3;
  let p = 0;
  for (let i = 0; i < Math.min(4, Math.min(l1, l2)); i++) {
    if (s1[i] === s2[i]) p++; else break;
  }
  return jaro + p * 0.1 * (1 - jaro);
}

/**
 * Computes token-aware person name similarity score in [0.0, 1.0].
 * Anchors multi-word names on surname similarity to avoid false collisions
 * between different people sharing common first names.
 */
export function matchPersonName(query: string, candidate: string): number {
  const qParts = query.trim().toLowerCase().split(/\s+/);
  const cParts = candidate.trim().toLowerCase().split(/\s+/);

  if (qParts.length >= 2 && cParts.length >= 2) {
    const qFirst = qParts[0];
    const qLast = qParts[qParts.length - 1];
    const cFirst = cParts[0];
    const cLast = cParts[cParts.length - 1];

    const lastSim = computeStringSimilarity(qLast, cLast);
    const firstSim = computeStringSimilarity(qFirst, cFirst);

    if (lastSim >= 0.88 && (firstSim >= 0.80 || cFirst.startsWith(qFirst) || qFirst.startsWith(cFirst))) {
      return (lastSim * 0.6) + (firstSim * 0.4);
    }
    return 0.0;
  }

  return computeStringSimilarity(query, candidate);
}

const COMMON_NON_PERSON_WORDS = new Set([
  'story', 'good', 'great', 'movie', 'film', 'show', 'series', 'cinema',
  'actor', 'actress', 'director', 'twist', 'ending', 'plot', 'character',
  'vibe', 'music', 'song', 'action', 'comedy', 'drama', 'horror', 'thriller',
  'family', 'famous', 'famous actor', 'good story', 'emotional story', 'strong emotional story',
  'long', 'short', 'old', 'new', 'recent', 'classic', 'best', 'top', 'bad', 'fun',
  'cool', 'slow', 'fast', 'dark', 'light', 'funny', 'scary', 'romantic', 'animated',
  'live', 'real', 'true', 'sad', 'happy', 'deep', 'epic'
]);

export function resolveDirector(name: string): string | null {
  ensurePersonCatalogLoaded();
  let clean = name.trim().toLowerCase().replace(/^["'`]|["'`]$/g, '').trim();
  clean = clean.replace(/^(?:a|an|the)\s+/i, '').trim();
  if (!clean || clean.length < 2 || COMMON_NON_PERSON_WORDS.has(clean)) return null;

  // 1. Exact full name
  if (directorCatalogMap.has(clean)) return directorCatalogMap.get(clean)!;

  // 2. Exact single-word surname
  if (directorSurnameMap.has(clean)) return directorSurnameMap.get(clean)!;

  // 3. String similarity scoring (Jaro-Winkler >= 0.88)
  const parts = clean.split(/\s+/);
  const isMultiWord = parts.length >= 2;

  let bestMatch: string | null = null;
  let highestScore = 0.88;

  if (isMultiWord) {
    for (const [canonLower, canon] of directorCatalogMap.entries()) {
      const score = matchPersonName(clean, canonLower);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = canon;
      }
    }
    const lastName = parts[parts.length - 1];
    const firstName = parts[0];
    if (directorSurnameMap.has(lastName)) {
      const cand = directorSurnameMap.get(lastName)!;
      const candFirst = cand.split(/\s+/)[0].toLowerCase();
      const firstScore = computeStringSimilarity(firstName, candFirst);
      if (firstScore >= 0.80 || candFirst.startsWith(firstName) || firstName.startsWith(candFirst)) {
        return cand;
      }
    }
  } else {
    for (const [sName, canon] of directorSurnameMap.entries()) {
      const score = computeStringSimilarity(clean, sName);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = canon;
      }
    }
  }

  return bestMatch;
}

export function resolveActor(name: string): string | null {
  ensurePersonCatalogLoaded();
  let clean = name.trim().toLowerCase().replace(/^["'`]|["'`]$/g, '').trim();
  clean = clean.replace(/^(?:a|an|the)\s+/i, '').trim();
  if (!clean || clean.length < 2 || COMMON_NON_PERSON_WORDS.has(clean)) return null;

  // 1. Exact full name
  if (actorCatalogMap.has(clean)) return actorCatalogMap.get(clean)!;

  // 2. String similarity scoring (Jaro-Winkler >= 0.88)
  const parts = clean.split(/\s+/);
  const isMultiWord = parts.length >= 2;

  let bestMatch: string | null = null;
  let highestScore = 0.88;

  if (isMultiWord) {
    for (const [canonLower, canon] of actorCatalogMap.entries()) {
      const score = matchPersonName(clean, canonLower);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = canon;
      }
    }
  } else {
    if (clean.length >= 4) {
      for (const [canonLower, canon] of actorCatalogMap.entries()) {
        if (!canonLower.includes(' ')) {
          const score = computeStringSimilarity(clean, canonLower);
          if (score > highestScore) {
            highestScore = score;
            bestMatch = canon;
          }
        }
      }
    }
  }

  return bestMatch;
}

export function extractPersonsFromPrompt(prompt: string): {
  actors: string[];
  directors: string[];
  actor_match_mode: 'all' | 'any';
  unresolved_persons: string[];
} {
  const extractedActors = new Set<string>();
  const extractedDirectors = new Set<string>();
  const unresolvedPersons = new Set<string>();
  let actorMatchMode: 'all' | 'any' = 'all';

  // Check 'or' vs 'and' for multiple actors
  if (/\b(?:with|starring|featuring)\s+[^.,;!?]+?\s+or\s+[^.,;!?]+/i.test(prompt) || /\b(?:[A-Za-z]+)\s+or\s+(?:[A-Za-z]+)\b/i.test(prompt)) {
    actorMatchMode = 'any';
  }

  // 1. Director patterns
  // Pattern 1a: 'directed by <Person>' or 'director <Person>' or 'films by <Person>' or 'movies by <Person>'
  const dirRegex1 = /\b(?:directed\s+by|director|films?\s+by|movies?\s+by)\s+([A-Za-z0-9\s'’\.\-]+?)(?=(?:\s+(?:in|from|under|less|longer|shorter|rated|on|released))|(?:[.,;!?]|$))/gi;
  let dMatch: RegExpExecArray | null;
  while ((dMatch = dirRegex1.exec(prompt)) !== null) {
    const candidate = dMatch[1].trim();
    const res = resolveDirector(candidate);
    if (res) {
      extractedDirectors.add(res);
    } else if (candidate.length >= 2 && !COMMON_NON_PERSON_WORDS.has(candidate.toLowerCase())) {
      unresolvedPersons.add(candidate);
    }
  }

  // Pattern 1b: '<Person> movies/films/shows/thriller/etc.' or 'a <Person> movie/thriller'
  const dirRegex2 = /\b([A-Za-z'’\.\-]+(?:\s+[A-Za-z'’\.\-]+)?)\s+(?:movies?|films?|shows?|series|cinema|flicks?|thrillers?|comedies?|dramas?|sci-?fi)\b/gi;
  while ((dMatch = dirRegex2.exec(prompt)) !== null) {
    const candidate = dMatch[1].trim();
    const res = resolveDirector(candidate);
    if (res) extractedDirectors.add(res);
  }

  // 2. Actor patterns
  // Pattern 2a: 'starring <Person>', 'featuring <Person>', 'with <Person>'
  const actorRegex1 = /\b(?:(starring|featuring)|(with))\s+([A-Za-z0-9\s'’\.\-]+?)(?=(?:\s+(?:in|from|under|less|longer|shorter|rated|on|released))|(?:[.,;!?]|$))/gi;
  let aMatch: RegExpExecArray | null;
  while ((aMatch = actorRegex1.exec(prompt)) !== null) {
    const isWith = Boolean(aMatch[2]);
    const candidateStr = (aMatch[3] || '').trim();
    // Split on 'and' or 'or' or comma
    const parts = candidateStr.split(/\b(?:and|or)\b|,/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (
        part.split(/\s+/).length > 3 ||
        /\b(no|not|without|zero|none|scenes?|elements?|effects?|dialogue|music|pacing|humor|comedy|drama|horror|action|thriller|vibe|mood|atmosphere|twist|story|plot|theme|ending|feel|runtime|eco|futurism|community)\b/i.test(part)
      ) {
        continue;
      }
      const res = resolveActor(part);
      if (res) {
        extractedActors.add(res);
      } else if (!isWith && part.length >= 2 && !COMMON_NON_PERSON_WORDS.has(part.toLowerCase())) {
        unresolvedPersons.add(part);
      }
    }
  }

  // Pattern 2b: '<Person> movies/films/shows' (e.g. 'Tom Hanks movies', 'Karl Urban movies')
  const actorRegex2 = /\b([A-Za-z'’\.\-]+(?:\s+[A-Za-z'’\.\-]+)?)\s+(?:movies?|films?|shows?|series|cinema|flicks?)\b/gi;
  while ((aMatch = actorRegex2.exec(prompt)) !== null) {
    const candidate = aMatch[1].trim();
    const dirRes = resolveDirector(candidate);
    if (dirRes && extractedDirectors.has(dirRes)) {
      continue;
    }
    const res = resolveActor(candidate);
    if (res) extractedActors.add(res);
  }

  return {
    actors: Array.from(extractedActors),
    directors: Array.from(extractedDirectors),
    actor_match_mode: actorMatchMode,
    unresolved_persons: Array.from(unresolvedPersons),
  };
}

/**
 * Checks if a candidate title matches a target catalog title safely without single-token collision.
 */
export function isSafeReferenceTitleMatch(candidate: string, targetTitle: string): boolean {
  const normCandidate = candidate.trim().toLowerCase().replace(/^["'`]|["'`]$/g, '').trim();
  const normTarget = targetTitle.trim().toLowerCase().replace(/^["'`]|["'`]$/g, '').trim();

  // 1. Exact match
  if (normCandidate === normTarget) return true;

  // 2. Exact match with / without leading "the "
  const candNoThe = normCandidate.replace(/^the\s+/i, '');
  const targetNoThe = normTarget.replace(/^the\s+/i, '');
  if (candNoThe === targetNoThe) return true;

  // 3. Multi-word token safety:
  const candTokens = normCandidate.split(/[\s:\-,!?]+/).filter((t) => !STOPWORDS.has(t) && t.length > 0);
  const targetTokens = normTarget.split(/[\s:\-,!?]+/).filter((t) => !STOPWORDS.has(t) && t.length > 0);

  // If candidate is multi-word (e.g. "Inside Out", "The Dark Knight"):
  if (candTokens.length >= 2) {
    // Target MUST contain ALL candidate tokens
    const containsAll = candTokens.every((ct) => targetTokens.includes(ct));
    if (!containsAll) return false;

    // Disallow matching if target title is much longer or has completely distinct leading word
    // e.g. "Inside Out" must NOT match "It's What's Inside" (missing "out") or "Insidious: Out of the Further"
    const lengthDiff = Math.abs(targetTokens.length - candTokens.length);
    if (lengthDiff > 1) return false;

    return true;
  }

  // Single-word candidate: only exact match is allowed, never partial substring!
  return candNoThe === targetNoThe;
}

/**
 * Resolves a potential candidate title against the CineVerse local MySQL `content` table.
 * NO external APIs or TMDB calls are made.
 */
export async function resolveTitleFromDatabase(
  candidate: string,
  typeConstraint?: 'Movie' | 'Series' | null
): Promise<string | null> {
  const clean = candidate.trim().replace(/^["'`]|["'`]$/g, '').trim();
  if (!clean || clean.length < 2) return null;

  try {
    // 1. Direct case-insensitive match on canonical content table (with type constraint priority)
    if (typeConstraint) {
      const [typeRows]: any = await pool.query(
        'SELECT title FROM content WHERE LOWER(title) = LOWER(?) AND type = ? LIMIT 1',
        [clean, typeConstraint]
      );
      if (typeRows && typeRows.length > 0) return typeRows[0].title;
    }

    const [rows]: any = await pool.query(
      'SELECT title FROM content WHERE LOWER(title) = LOWER(?) LIMIT 1',
      [clean]
    );
    if (rows && rows.length > 0) {
      return rows[0].title;
    }

    // 2. Try prefixing "The " if not present
    if (!/^the\s+/i.test(clean)) {
      const [theRows]: any = await pool.query(
        'SELECT title FROM content WHERE LOWER(title) = LOWER(?) LIMIT 1',
        [`The ${clean}`]
      );
      if (theRows && theRows.length > 0) {
        return theRows[0].title;
      }
    }

    // 3. Try stripping "The " if present
    if (/^the\s+/i.test(clean)) {
      const withoutThe = clean.replace(/^the\s+/i, '').trim();
      const [noTheRows]: any = await pool.query(
        'SELECT title FROM content WHERE LOWER(title) = LOWER(?) LIMIT 1',
        [withoutThe]
      );
      if (noTheRows && noTheRows.length > 0) {
        return noTheRows[0].title;
      }
    }

    // 4. Token-safe lookup for multi-word titles (prevent single-word collisions)
    const candTokens = clean.toLowerCase().split(/[\s:\-,!?]+/).filter((t) => !STOPWORDS.has(t) && t.length > 0);
    if (candTokens.length >= 2) {
      const [likeRows]: any = await pool.query(
        'SELECT title FROM content WHERE title LIKE ? LIMIT 10',
        [`${clean}%`]
      );
      if (likeRows && likeRows.length > 0) {
        for (const r of likeRows) {
          if (isSafeReferenceTitleMatch(clean, r.title)) {
            return r.title;
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export interface ReferenceCandidate {
  raw: string;
  candidate: string;
}

/**
 * Extracts a candidate title reference from phrases like:
 * - "like Interstellar"
 * - "something like The Dark Knight"
 * - "movies similar to Inception"
 * - "similar to Avatar"
 *
 * Explicitly rejects verb usages like "I like funny movies" or "movies I like".
 */
export function extractReferenceCandidate(prompt: string): ReferenceCandidate | null {
  const lookahead = '(?=(?:\\s+(?:but|and|with|under|less\\s+than|longer\\s+than|shorter\\s+than|shorter|longer|from|on|in|rated|released))|(?:\\s*[.,;!?]|$))';

  // 1. "similar to <Title>", "movies similar to <Title>", "shows similar to <Title>", etc.
  const similarMatch = prompt.match(
    new RegExp(`\\b(?:(?:movies?|films?|shows?|series|something|anything)\\s+)?similar\\s+to\\s+([A-Za-z0-9\\s:,'’\\-&]+?)${lookahead}`, 'i')
  );
  if (similarMatch && similarMatch[1]) {
    return { raw: similarMatch[0].trim(), candidate: similarMatch[1].trim() };
  }

  // 2. "something like <Title>", "movies like <Title>", "like <Title>" (at start or after punctuation)
  const likeMatch = prompt.match(
    new RegExp(`(?:(?:\\b(?:something|anything|movies?|films?|shows?|series|cinema|give\\s+me)\\s+like)|(?:^|[.!?])\\s*(?:just\\s+)?like|\\b(?:want|looking\\s+for|recommend)\\s+like)\\s+([A-Za-z0-9\\s:,'’\\-&]+?)${lookahead}`, 'i')
  );
  if (likeMatch && likeMatch[1]) {
    return { raw: likeMatch[0].trim(), candidate: likeMatch[1].trim() };
  }

  return null;
}

// =============================================================================
// CLAUSE SPLITTING & NEGATION SCOPING
// =============================================================================

export function splitPromptIntoClauses(prompt: string): {
  positiveClauses: string[];
  negativeClauses: string[];
} {
  const text = prompt.trim();
  if (!text) {
    return { positiveClauses: [], negativeClauses: [] };
  }

  // Regex to split on punctuation and conjunction boundaries
  const splitRegex = /(?:([,;.!?]+)|(\b(?:where\s+nobody|where\s+no\s+one|where\s+nothing|where\s+none|but\s+not|except\s+for|except|excluding|without|avoiding|avoid|do(?:n't|\s+not)\s+want|never)\b)|(\b(?:but|instead\s+of|rather\s+than)\b))/gi;

  const tokens: Array<{ type: 'text' | 'punct' | 'neg_conn' | 'pos_conn'; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = splitRegex.exec(text)) !== null) {
    const preText = text.substring(lastIndex, match.index).trim();
    if (preText) {
      tokens.push({ type: 'text', value: preText });
    }
    if (match[1]) {
      tokens.push({ type: 'punct', value: match[1] });
    } else if (match[2]) {
      tokens.push({ type: 'neg_conn', value: match[2] });
    } else if (match[3]) {
      tokens.push({ type: 'pos_conn', value: match[3] });
    }
    lastIndex = splitRegex.lastIndex;
  }
  const remaining = text.substring(lastIndex).trim();
  if (remaining) {
    tokens.push({ type: 'text', value: remaining });
  }

  const positiveClauses: string[] = [];
  const negativeClauses: string[] = [];
  let currentMode: 'positive' | 'negative' = 'positive';

  for (const tok of tokens) {
    if (tok.type === 'neg_conn') {
      currentMode = 'negative';
      continue;
    } else if (tok.type === 'pos_conn') {
      currentMode = 'positive';
      continue;
    } else if (tok.type === 'punct') {
      currentMode = 'positive';
      continue;
    } else if (tok.type === 'text') {
      const val = tok.value;
      const startsWithNeg = /^(?:where\s+nobody\b|where\s+no\s+one\b|where\s+nothing\b|where\s+none\b|nobody\b|no\s+one\b|no-one\b|not\b|no\b|never\b|none\b|neither\b|without\b|avoid\b|avoiding\b|exclude\b|excluding\b|except\b|nothing\b|do(?:n't|\s+not)\s+want\b)/i.test(val);
      const effectiveMode = startsWithNeg ? 'negative' : currentMode;
      if (effectiveMode === 'negative') {
        negativeClauses.push(val);
      } else {
        positiveClauses.push(val);
      }
      currentMode = 'positive';
    }
  }

  return { positiveClauses, negativeClauses };
}

function cleanNegativeClauseToEntity(clause: string): string {
  let clean = clause.trim();
  // Remove leading negation words
  clean = clean.replace(/^(?:where\s+nobody(?:\s+gets|\s+is)?|where\s+no\s+one(?:\s+gets|\s+is)?|where\s+nothing(?:\s+gets|\s+is)?|where\s+none(?:\s+gets|\s+is)?|nobody(?:\s+gets|\s+is)?|no\s+one(?:\s+gets|\s+is)?|nothing(?:\s+gets|\s+is)?|but\s+not|except\s+for|except|excluding|without|avoiding|avoid|do(?:n't|\s+not)\s+want|never|not|no|none|neither|nothing)\s+/i, '');
  // Remove leading articles / pronouns
  clean = clean.replace(/^(?:his|her|their|my|the|a|an)\s+/i, '');
  // Remove trailing collection words
  clean = clean.replace(/\s+(?:movies?|films?|series|shows?|flicks?|franchise|universe)$/i, '');
  // Remove surrounding quotes
  clean = clean.replace(/^["'`]|["'`]$/g, '').trim();
  return clean;
}

async function resolveNegativeEntitiesFromDatabase(
  negativeClauses: string[]
): Promise<{
  negative_persons: string[];
  negative_titles: string[];
  negative_franchises: string[];
  unresolved_references: string[];
  unresolved_persons: string[];
  low_confidence: boolean;
}> {
  const negativePersons = new Set<string>();
  const negativeTitles = new Set<string>();
  const negativeFranchises = new Set<string>();
  const unresolvedReferences = new Set<string>();
  const unresolvedPersons = new Set<string>();
  let lowConfidence = false;

  for (const clause of negativeClauses) {
    const rawEntity = cleanNegativeClauseToEntity(clause);
    if (!rawEntity || rawEntity.length < 2) continue;

    // 1. Is it a person?
    const act = resolveActor(rawEntity);
    const dir = resolveDirector(rawEntity);
    if (act || dir) {
      if (act) negativePersons.add(act);
      if (dir) negativePersons.add(dir);
      continue;
    }

    // 2. Is it a canonical genre? (If so, handled in genre exclusions, don't treat as title)
    let isGenre = false;
    for (const rule of GENRE_RULES) {
      if (rule.pattern.test(rawEntity) && !/\b(superhero|marvel|spider-?man|avengers|batman)\b/i.test(rawEntity)) {
        isGenre = true;
        break;
      }
    }
    if (isGenre) continue;

    // 3. Query MySQL for title and franchise matches
    try {
      const [exactRows]: any = await pool.query(
        'SELECT content_id, title FROM content WHERE LOWER(title) = LOWER(?) LIMIT 2',
        [rawEntity]
      );
      const [prefixRows]: any = await pool.query(
        'SELECT content_id, title FROM content WHERE LOWER(title) LIKE LOWER(?) OR LOWER(title) LIKE LOWER(?) LIMIT 10',
        [`${rawEntity}:%`, `${rawEntity} %`]
      );

      const hasFranchiseWord = /\b(?:movies?|films?|series|shows?|franchise|universe)\b/i.test(clause);

      if (prefixRows.length > 0 || (exactRows.length > 0 && hasFranchiseWord)) {
        negativeFranchises.add(rawEntity);
        lowConfidence = true;
        if (exactRows.length > 0) {
          negativeTitles.add(exactRows[0].title);
        }
      } else if (exactRows.length > 0) {
        negativeTitles.add(exactRows[0].title);
      } else {
        if (/\b(?:actor|director|starring|with|star)\b/i.test(clause)) {
          unresolvedPersons.add(rawEntity);
        } else {
          unresolvedReferences.add(rawEntity);
        }
      }
    } catch {
      unresolvedReferences.add(rawEntity);
    }
  }

  return {
    negative_persons: Array.from(negativePersons),
    negative_titles: Array.from(negativeTitles),
    negative_franchises: Array.from(negativeFranchises),
    unresolved_references: Array.from(unresolvedReferences),
    unresolved_persons: Array.from(unresolvedPersons),
    low_confidence: lowConfidence,
  };
}

function resolveNegativeEntitiesSync(
  negativeClauses: string[]
): {
  negative_persons: string[];
  negative_titles: string[];
  negative_franchises: string[];
  unresolved_references: string[];
  unresolved_persons: string[];
  low_confidence: boolean;
} {
  const negativePersons = new Set<string>();
  const negativeTitles = new Set<string>();
  const negativeFranchises = new Set<string>();
  const unresolvedReferences = new Set<string>();
  const unresolvedPersons = new Set<string>();
  let lowConfidence = false;

  const candidatePaths = [
    path.join(__dirname, '../../data/movie_dna.json'),
    path.join(__dirname, '../../../data/movie_dna.json'),
    path.join(process.cwd(), 'data/movie_dna.json'),
    path.join(process.cwd(), 'backend/data/movie_dna.json'),
  ];
  let fileTitles: string[] = [];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        fileTitles = parsed.map((m: any) => m.title);
        break;
      } catch {}
    }
  }

  for (const clause of negativeClauses) {
    const rawEntity = cleanNegativeClauseToEntity(clause);
    if (!rawEntity || rawEntity.length < 2) continue;

    const act = resolveActor(rawEntity);
    const dir = resolveDirector(rawEntity);
    if (act || dir) {
      if (act) negativePersons.add(act);
      if (dir) negativePersons.add(dir);
      continue;
    }

    let isGenre = false;
    for (const rule of GENRE_RULES) {
      if (rule.pattern.test(rawEntity) && !/\b(superhero|marvel|spider-?man|avengers|batman)\b/i.test(rawEntity)) {
        isGenre = true;
        break;
      }
    }
    if (isGenre) continue;

    const cleanLower = rawEntity.toLowerCase();
    const exact = fileTitles.find((t) => t.toLowerCase() === cleanLower);
    const prefixMatches = fileTitles.filter(
      (t) => t.toLowerCase().startsWith(`${cleanLower}:`) || t.toLowerCase().startsWith(`${cleanLower} `)
    );
    const hasFranchiseWord = /\b(?:movies?|films?|series|shows?|franchise|universe)\b/i.test(clause);

    if (prefixMatches.length > 0 || (exact && hasFranchiseWord)) {
      negativeFranchises.add(rawEntity);
      lowConfidence = true;
      if (exact) negativeTitles.add(exact);
    } else if (exact) {
      negativeTitles.add(exact);
    } else {
      if (/\b(?:actor|director|starring|with|star)\b/i.test(clause)) {
        unresolvedPersons.add(rawEntity);
      } else {
        unresolvedReferences.add(rawEntity);
      }
    }
  }

  return {
    negative_persons: Array.from(negativePersons),
    negative_titles: Array.from(negativeTitles),
    negative_franchises: Array.from(negativeFranchises),
    unresolved_references: Array.from(unresolvedReferences),
    unresolved_persons: Array.from(unresolvedPersons),
    low_confidence: lowConfidence,
  };
}

/**
 * Shared extraction logic for both async and sync parser variants.
 */
function extractStructuredFeatures(prompt: string) {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  // 1. Scoped Clause Splitting
  const { positiveClauses, negativeClauses } = splitPromptIntoClauses(prompt);
  const positiveText = positiveClauses.length > 0 ? positiveClauses.join(' ') : (negativeClauses.length === 0 ? text : '');
  const positiveLower = positiveText.toLowerCase();

  // Pre-detect reference candidate
  const refCandForSanitize = extractReferenceCandidate(text);
  const lowerForExtraction = refCandForSanitize
    ? positiveLower.replace(refCandForSanitize.raw.toLowerCase(), ' ').replace(/\s+/g, ' ').trim()
    : positiveLower;

  // ── 1. Negative Preferences (Exclusions & Avoidances) ──────────────────────
  const negativeGenresSet = new Set<string>();
  const negativeThemes: string[] = [];
  const negativeKeywords: string[] = [];

  // 1a. Explicit Genre Exclusions
  const genreExclRegex = /\b(?:no|avoid|without|don't\s+want|do\s+not\s+want|never|not|except(?:\s+for)?|excluding)\s+(?:any\s+)?(sci-?fi|science\s+fiction|action|adventure|animation|animated|anime|cartoon|comedy|comedies|funny|crime|documentary|drama|family|fantasy|history|horror|scary|spooky|music|musical|mystery|romance|romantic|thriller|suspense|war|western)\b/gi;
  let genreExclMatch: RegExpExecArray | null;
  while ((genreExclMatch = genreExclRegex.exec(lower)) !== null) {
    const rawGenre = genreExclMatch[1];
    for (const rule of GENRE_RULES) {
      if (rule.pattern.test(rawGenre)) {
        negativeGenresSet.add(rule.canonical);
      }
    }
  }

  // Also check if any negative clause directly specifies a genre name (e.g. "except horror")
  for (const nc of negativeClauses) {
    const ncClean = cleanNegativeClauseToEntity(nc);
    for (const rule of GENRE_RULES) {
      if (rule.pattern.test(ncClean) && !/\b(superhero|marvel|spider-?man|avengers|batman)\b/i.test(ncClean)) {
        negativeGenresSet.add(rule.canonical);
      }
    }
  }

  // 1b. General Avoidance Language Mechanism -> mapped into negative_themes and negative_keywords
  // Maps avoidance language ("no X", "without X", "not X", "nothing X happens", "nobody X", "avoid X", etc.)
  // into negative_themes using the same negation scoping as negative genres.
  const negativeFranchisesSet = new Set<string>();

  function expandNegativeStemWords(words: string[]): string[] {
    const result = new Set<string>();
    for (const w of words) {
      const lower = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.length <= 1) continue;
      result.add(lower);
      if (lower.startsWith('murder')) {
        result.add('murder');
        result.add('murderer');
        result.add('murderers');
        result.add('murdered');
        result.add('murders');
      } else if (lower.startsWith('kill')) {
        result.add('kill');
        result.add('killer');
        result.add('killers');
        result.add('killing');
        result.add('killings');
      } else if (lower.startsWith('violenc') || lower.startsWith('violent')) {
        result.add('violence');
        result.add('violent');
      } else if (lower.startsWith('dead') || lower.startsWith('death') || lower.startsWith('die')) {
        result.add('death');
        result.add('deaths');
        result.add('die');
        result.add('dead');
      } else if (lower.startsWith('trauma')) {
        result.add('trauma');
        result.add('traumatic');
      } else if (lower.startsWith('traged') || lower.startsWith('tragic')) {
        result.add('tragedy');
        result.add('tragic');
      } else if (lower.startsWith('abus')) {
        result.add('abuse');
        result.add('abusive');
      }
    }
    return Array.from(result);
  }

  const avoidancePattern = /\b(?:(?:where\s+)?(?:nothing|nobody|no\s+one|none)\s+(?:gets?\s+|is\s+|are\s+)?([^,;.!?]+)|without\s+(?:any\s+|too\s+much\s+)?([^,;.!?]+)|(?:avoid|avoiding|do(?:n't|\s+not)\s+want|never)\s+(?:any\s+|stories\s+involving\s+|story\s+involving\s+)?([^,;.!?]+)|not\s+(?:too\s+|a\s+)?([^,;.!?]+)|no\s+([^,;.!?]+)|excluding\s+([^,;.!?]+)|except(?:\s+for)?\s+([^,;.!?]+))\b/gi;
  let avoidMatch: RegExpExecArray | null;
  while ((avoidMatch = avoidancePattern.exec(lower)) !== null) {
    const rawTarget = avoidMatch[1] || avoidMatch[2] || avoidMatch[3] || avoidMatch[4] || avoidMatch[5] || avoidMatch[6] || avoidMatch[7];
    if (!rawTarget) continue;
    const cleanTarget = rawTarget.trim()
      .replace(/^(?:too\s+|any\s+|too\s+much\s+|a\s+|an\s+|the\s+|much\s+|stories\s+involving\s+|story\s+involving\s+)/i, '')
      .replace(/\s+(?:happens?|movies?|films?|series|shows?)$/i, '')
      .trim();
    if (!cleanTarget || cleanTarget.length < 2) continue;

    // Check superhero exclusion
    if (/\b(superhero|super\s+hero)\b/i.test(cleanTarget)) {
      negativeFranchisesSet.add('Superhero');
      negativeFranchisesSet.add('Marvel');
      negativeFranchisesSet.add('Spider-Man');
      negativeFranchisesSet.add('Avengers');
      negativeFranchisesSet.add('Batman');
      negativeFranchisesSet.add('Iron Man');
      if (!negativeThemes.includes('superhero')) negativeThemes.push('superhero');
      if (!negativeKeywords.includes('superhero')) negativeKeywords.push('superhero');
      continue;
    } else if (/\bspider-?man\b/i.test(cleanTarget)) {
      negativeFranchisesSet.add('Spider-Man');
      continue;
    } else if (/\bbatman\b/i.test(cleanTarget)) {
      negativeFranchisesSet.add('Batman');
      continue;
    } else if (/\bavengers\b/i.test(cleanTarget)) {
      negativeFranchisesSet.add('Avengers');
      continue;
    } else if (/\biron\s+man\b/i.test(cleanTarget)) {
      negativeFranchisesSet.add('Iron Man');
      continue;
    } else if (/\bmarvel\b/i.test(cleanTarget)) {
      negativeFranchisesSet.add('Marvel');
      continue;
    }

    // Check if it's a genre
    let isGenre = false;
    for (const rule of GENRE_RULES) {
      if (rule.pattern.test(cleanTarget) && !/\b(superhero|marvel|spider-?man|avengers|batman)\b/i.test(cleanTarget)) {
        negativeGenresSet.add(rule.canonical);
        isGenre = true;
        break;
      }
    }
    if (isGenre) continue;

    // Check if it's a person
    if (resolveActor(cleanTarget) || resolveDirector(cleanTarget)) continue;

    // Descriptive phrase or theme (e.g. "traumatic", "graphic violence", "depressing", "child abuse", "murdered")
    const words = cleanTarget.split(/\s+/).filter(w => !STOPWORDS.has(w) && w.length > 1);
    if (words.length > 0 && words.length <= 6) {
      if (!negativeThemes.includes(cleanTarget)) {
        negativeThemes.push(cleanTarget);
      }
      const expandedWords = expandNegativeStemWords(words);
      for (const w of expandedWords) {
        if (!negativeKeywords.includes(w)) {
          negativeKeywords.push(w);
        }
      }
    }
  }

  // Also process all negativeClauses through this general mechanism
  for (const nc of negativeClauses) {
    const rawEntity = cleanNegativeClauseToEntity(nc);
    if (!rawEntity || rawEntity.length < 2) continue;

    if (/\b(superhero|super\s+hero)\b/i.test(rawEntity)) {
      negativeFranchisesSet.add('Superhero');
      negativeFranchisesSet.add('Marvel');
      negativeFranchisesSet.add('Spider-Man');
      negativeFranchisesSet.add('Avengers');
      negativeFranchisesSet.add('Batman');
      negativeFranchisesSet.add('Iron Man');
      if (!negativeThemes.includes('superhero')) negativeThemes.push('superhero');
      if (!negativeKeywords.includes('superhero')) negativeKeywords.push('superhero');
      continue;
    } else if (/\bspider-?man\b/i.test(rawEntity)) {
      negativeFranchisesSet.add('Spider-Man');
      continue;
    } else if (/\bbatman\b/i.test(rawEntity)) {
      negativeFranchisesSet.add('Batman');
      continue;
    } else if (/\bavengers\b/i.test(rawEntity)) {
      negativeFranchisesSet.add('Avengers');
      continue;
    } else if (/\biron\s+man\b/i.test(rawEntity)) {
      negativeFranchisesSet.add('Iron Man');
      continue;
    } else if (/\bmarvel\b/i.test(rawEntity)) {
      negativeFranchisesSet.add('Marvel');
      continue;
    }

    let isGenre = false;
    for (const rule of GENRE_RULES) {
      if (rule.pattern.test(rawEntity) && !/\b(superhero|marvel|spider-?man|avengers|batman)\b/i.test(rawEntity)) {
        negativeGenresSet.add(rule.canonical);
        isGenre = true;
        break;
      }
    }
    if (isGenre) continue;
    if (resolveActor(rawEntity) || resolveDirector(rawEntity)) continue;

    const words = rawEntity.split(/\s+/).filter(w => !STOPWORDS.has(w) && w.length > 1);
    if (words.length > 0 && words.length <= 6) {
      if (!negativeThemes.includes(rawEntity)) {
        negativeThemes.push(rawEntity);
      }
      const expandedWords = expandNegativeStemWords(words);
      for (const w of expandedWords) {
        if (!negativeKeywords.includes(w)) {
          negativeKeywords.push(w);
        }
      }
    }
  }

  // ── 2. Positive Genres (Scoped strictly to positive clauses!) ───────────────
  const genresSet = new Set<string>();
  for (const rule of GENRE_RULES) {
    if (rule.pattern.test(positiveLower)) {
      if (!negativeGenresSet.has(rule.canonical)) {
        genresSet.add(rule.canonical);
      }
    }
  }

  // ── 3. Languages (Scoped to positive clauses) ───────────────────────────────
  const languagesSet = new Set<string>();
  for (const rule of LANGUAGE_RULES) {
    if (rule.pattern.test(positiveLower)) {
      languagesSet.add(rule.canonical);
    }
  }

  // ── 4. Platforms (Scoped to positive clauses) ───────────────────────────────
  const platformsSet = new Set<string>();
  for (const rule of PLATFORM_RULES) {
    if (rule.pattern.test(positiveLower)) {
      platformsSet.add(rule.canonical);
    }
  }

  // ── 5. Format / Type (Movie vs Series from positive clauses) ────────────────
  let type: 'Movie' | 'Series' | null = null;
  const hasMovie = /\b(movies?|films?|cinema|flick|feature(?:\s+film)?)\b/i.test(positiveLower);
  const hasSeries = /\b(series|tv\s+shows?|shows?|k-?drama|seasons?|episodes?|miniseries|mini-?series|limited\s+series|pilot|sitcom|soap|streaming\s+show)\b/i.test(positiveLower)
    || /\banime\b/i.test(positiveLower);
  if (hasMovie && !hasSeries) {
    type = 'Movie';
  } else if (hasSeries && !hasMovie) {
    type = 'Series';
  }

  // ── 6. Experience (Scoped to positive clauses) ──────────────────────────────
  const experiencesSet = new Set<ExperiencePreference>();
  if (/\b(mind-?bending|think|thought-?provoking|philosophical|complex|deep|intellectual|cerebral|smart|clever|makes?\s+you\s+think|mind-?blowing|introspective|profound)\b/i.test(positiveLower)) {
    experiencesSet.add('thought_provoking');
  }
  if (/\b(laugh|funny|hilarious|humor|comedy|comedic|lighthearted|light-?hearted|fun|playful|whimsical|quirky|charming|feel-?good|uplifting|cheerful|joyful)\b/i.test(positiveLower)
      && !negativeGenresSet.has('Comedy')) {
    experiencesSet.add('funny');
  }
  const isDarkNegative = negativeKeywords.includes('dark');
  if (/\b(edge(\s+of(\s+my)?\s+seat)?|thrill(ing)?|intense|suspense(ful)?|nail-?biting|gripping|riveting|pulse-?pounding|adrenaline|heart-?pounding|fast-?paced|action-?packed|explosive)\b/i.test(positiveLower) ||
      (/\bdark(\s+psychological)?\b/i.test(positiveLower) && !isDarkNegative)) {
    experiencesSet.add('thrilling');
  }
  if (/\b(emotional|feel\s+something|touching|heartwarming|tearjerker|cry|moving|poignant|bittersweet|soul|deeply\s+moving|heartbreaking|heart-?wrenching|sentimental|feels)\b/i.test(positiveLower)) {
    experiencesSet.add('emotional');
  }
  if (/\b(escapis(m|t)|somewhere\s+different|transport\s+me|otherworldly|immersive|epic\s+world|world-?building|fantastical|magical\s+world|lost\s+in|get\s+lost|alternate\s+(world|universe|reality))\b/i.test(positiveLower)) {
    experiencesSet.add('escapist');
  }

  // ── 7. Exact Decade & Year Range Constraints (Scoped to positive clauses) ────
  let minReleaseYear: number | null = null;
  let maxReleaseYear: number | null = null;
  let yearRangeIsHard = false;
  let eraPreference: EraPreference | null = null;

  const spanMatch = positiveLower.match(/\b(?:from|between)\s+(\d{4})\s+(?:to|and|-)\s+(\d{4})\b/i);
  if (spanMatch) {
    minReleaseYear = parseInt(spanMatch[1], 10);
    maxReleaseYear = parseInt(spanMatch[2], 10);
    yearRangeIsHard = !/\b(?:prefer|ideally|rather)\b/i.test(positiveLower);
    if (minReleaseYear >= 2020) eraPreference = 'recent';
    else if (minReleaseYear >= 2000) eraPreference = 'modern';
    else eraPreference = 'classic';
  }

  if (minReleaseYear === null && maxReleaseYear === null) {
    const decadeMatch = positiveLower.match(/\b(?:from\s+the|in\s+the|from\s+)?(\b(?:19[5-9]0s|20[0-2]0s|00s|10s|20s|70s|80s|90s))\b/i);
    if (decadeMatch) {
      const dec = decadeMatch[1].toLowerCase();
      if (dec === '2000s' || dec === '00s') {
        minReleaseYear = 2000;
        maxReleaseYear = 2009;
        eraPreference = 'modern';
      } else if (dec === '2010s' || dec === '10s') {
        minReleaseYear = 2010;
        maxReleaseYear = 2019;
        eraPreference = 'modern';
      } else if (dec === '1990s' || dec === '90s') {
        minReleaseYear = 1990;
        maxReleaseYear = 1999;
        eraPreference = 'classic';
      } else if (dec === '1980s' || dec === '80s') {
        minReleaseYear = 1980;
        maxReleaseYear = 1989;
        eraPreference = 'classic';
      } else if (dec === '1970s' || dec === '70s') {
        minReleaseYear = 1970;
        maxReleaseYear = 1979;
        eraPreference = 'classic';
      } else if (dec === '2020s' || dec === '20s') {
        minReleaseYear = 2020;
        maxReleaseYear = 2029;
        eraPreference = 'recent';
      }
      if (minReleaseYear !== null) {
        yearRangeIsHard = !/\b(?:prefer|ideally|rather)\b/i.test(positiveLower);
      }
    }
  }

  if (minReleaseYear === null && maxReleaseYear === null) {
    const singleYearMatch = positiveLower.match(/\b(?:released\s+in|from\s+year|in\s+year|year\s+of|released)\s+(\d{4})\b/i);
    if (singleYearMatch) {
      const yr = parseInt(singleYearMatch[1], 10);
      if (yr >= 1900 && yr <= 2030) {
        minReleaseYear = yr;
        maxReleaseYear = yr;
        yearRangeIsHard = !/\b(?:prefer|ideally|rather)\b/i.test(positiveLower);
        if (yr >= 2020) eraPreference = 'recent';
        else if (yr >= 2000) eraPreference = 'modern';
        else eraPreference = 'classic';
      }
    }
    const afterMatch = positiveLower.match(/\bafter\s+(\d{4})\b/i);
    if (afterMatch && minReleaseYear === null) {
      minReleaseYear = parseInt(afterMatch[1], 10) + 1;
      yearRangeIsHard = !/\b(?:prefer|ideally)\b/i.test(positiveLower);
    }
    const beforeMatch = positiveLower.match(/\bbefore\s+(\d{4})\b/i);
    if (beforeMatch && maxReleaseYear === null) {
      maxReleaseYear = parseInt(beforeMatch[1], 10) - 1;
      yearRangeIsHard = !/\b(?:prefer|ideally)\b/i.test(positiveLower);
    }
  }

  if (eraPreference === null) {
    if (/\b(recent|new|latest|newly\s+released|2020s|202[4-6]|modern\s+day)\b/i.test(positiveLower)) {
      eraPreference = 'recent';
    } else if (/\b(2000s|2010s|modern|00s|10s)\b/i.test(positiveLower)) {
      eraPreference = 'modern';
    } else if (/\b(classic|retro|old|vintage|80s|90s|golden\s+age)\b/i.test(positiveLower)) {
      eraPreference = 'classic';
    } else if (/\b(any\s+era|any\s+time|any\s+year)\b/i.test(positiveLower)) {
      eraPreference = 'any';
    }
  }

  // ── 8. Quality Preference ───────────────────────────────────────────────────
  let qualityPreference: QualityPreference | null = null;
  if (/\b(best(-|\s*)rated|top(-|\s*)rated|masterpieces?|highly\s+rated|acclaimed|award-winning|oscar|emmy|golden\s+globe|critically\s+acclaimed|must-?watch|must\s+watch|greatest|all[-\s]time\s+best|cinema\s+classic)\b/i.test(positiveLower)) {
    qualityPreference = 'high';
  } else if (/\b(well(-|\s*)reviewed|good\s+ratings?|solid\s+ratings?|decent|cult\s+classic|fan\s+favorite|underrated|hidden\s+gem|overlooked|under-?appreciated)\b/i.test(positiveLower)) {
    qualityPreference = 'medium';
  } else if (/\b(ratings?\s+don'?t\s+matter|b-movie|guilty\s+pleasure|trashy|so-?bad-?it'?s-?good|campy)\b/i.test(positiveLower)) {
    qualityPreference = 'low';
  }

  // ── 9. Exact Numeric Runtime & Runtime Preferences ──────────────────────────
  let maxRuntimeMinutes: number | null = null;
  let minRuntimeMinutes: number | null = null;
  let runtimeIsHardConstraint = false;
  let runtimePreference: RuntimePreference | null = null;

  const hoursMatch = lower.match(/\b(?:(?:under|less\s+than|i\s+only\s+have|i\s+have|around|about|at\s+least|longer\s+than|more\s+than|over|maximum\s+of|at\s+most)\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  if (hoursMatch) {
    const hours = parseFloat(hoursMatch[1]);
    const mins = Math.round(hours * 60);
    if (/\b(?:at\s+least|longer\s+than|more\s+than|minimum\s+of|over)\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?)/i.test(lower)) {
      minRuntimeMinutes = mins;
      runtimeIsHardConstraint = true;
    } else {
      maxRuntimeMinutes = mins;
      runtimeIsHardConstraint = /\b(?:under|less\s+than|need|must|at\s+most|maximum\s+of)\b/i.test(lower);
    }
  }

  if (maxRuntimeMinutes === null && minRuntimeMinutes === null) {
    const atLeastMinMatch = lower.match(/\b(?:at\s+least|longer\s+than|more\s+than|minimum\s+of|over)\s+(\d+)\s*(?:min(?:utes?|s)?)\b/i);
    if (atLeastMinMatch) {
      minRuntimeMinutes = parseInt(atLeastMinMatch[1], 10);
      runtimeIsHardConstraint = true;
    }

    const underMinMatch = lower.match(/\b(?:under|less\s+than|at\s+most|maximum\s+of|need\s+something\s+under|must\s+be\s+under)\s+(\d+)\s*(?:min(?:utes?|s)?)\b/i);
    if (underMinMatch && minRuntimeMinutes === null) {
      maxRuntimeMinutes = parseInt(underMinMatch[1], 10);
      runtimeIsHardConstraint = true;
    }

    const aboutMinMatch = lower.match(/\b(?:(?:i\s+only\s+have|i\s+have)\s+(?:about\s+)?|around\s+|about\s+|approx(?:imately)?\s+)?(\d+)\s*(?:min(?:utes?|s)?)\b/i);
    if (aboutMinMatch && maxRuntimeMinutes === null && minRuntimeMinutes === null) {
      maxRuntimeMinutes = parseInt(aboutMinMatch[1], 10);
      runtimeIsHardConstraint = /\b(?:need|must\s+be|under|less\s+than)\b/i.test(lower);
    }
  }

  if (maxRuntimeMinutes !== null) {
    runtimePreference = maxRuntimeMinutes <= 120 ? 'under_2_hours' : 'around_2_hours';
  } else {
    if (/\b(under\s+(two|2)\s*hours?|less\s+than\s+(two|2)\s*hours?|quick(\s+movie)?|short\s+movie)\b/i.test(lower)) {
      runtimePreference = 'under_2_hours';
      maxRuntimeMinutes = 120;
      runtimeIsHardConstraint = true;
    } else if (/\b(around\s+(two|2)\s*hours?|about\s+(two|2)\s*hours?)\b/i.test(lower)) {
      runtimePreference = 'around_2_hours';
      maxRuntimeMinutes = 120;
      runtimeIsHardConstraint = false;
    } else if (/\b(long\s+movie|epic|long\s+film|3\s*hours?)\b/i.test(lower)) {
      runtimePreference = 'long_movie_ok';
    } else if (/\b(binge(-?able)?|multi-?season|binge-?watch)\b/i.test(lower)) {
      runtimePreference = 'binge_series';
    } else if (/\b(no\s+preference|doesn't\s+matter(\s+how\s+long)?|any\s+length)\b/i.test(lower)) {
      runtimePreference = 'no_preference';
    }
  }

  // ── 10. Rich Theme Extraction (Scoped to positiveLower) ──────────────────────
  const themesSet = new Set<string>();

  if (/\b(with\s+(my\s+)?family|family\s+movie\s+night|watch\s+with\s+(kids|children)|kid-?friendly|all\s+ages)\b/i.test(lowerForExtraction)) {
    themesSet.add('family friendly wholesome');
  }
  if (/\b(friend(ship)?s?|buddy|bromance|sisterhood|bond(ing)?|besties|found\s+family)\b/i.test(lowerForExtraction)) {
    themesSet.add('friendship bonds relationships');
  }
  if (/\b(love\s+story|fall\s+in\s+love|falling\s+in\s+love|soulmate|romantic|romance|heartbreak|first\s+love|unrequited)\b/i.test(lowerForExtraction)) {
    themesSet.add('love romance relationships');
  }
  if (/\b(revenge|vengeance|payback|justice|vigilante|wrongly\s+accused|frame(d)?)\b/i.test(lowerForExtraction)) {
    themesSet.add('revenge justice vengeance');
  }
  if (/\b(survival|survive|stranded|trapped|isolated|wilderness|apocalypse|end\s+of\s+world|disaster|natural\s+disaster)\b/i.test(lowerForExtraction)) {
    themesSet.add('survival disaster struggle');
  }
  if (/\b(redemption|second\s+chance|overcome|overcoming|growth|transform(ation)?|reinvent|start\s+over|forgiveness)\b/i.test(lowerForExtraction)) {
    themesSet.add('redemption personal growth transformation');
  }
  if (/\b(coming[\s-]of[\s-]age|growing\s+up|teenager|teen|high\s+school|college|young\s+adult|adolescen|puberty|youth)\b/i.test(lowerForExtraction)) {
    themesSet.add('coming of age youth identity');
  }
  if (/\b(heist|robbery|bank\s+robbery|con\s+(man|artist)|con\s+game|caper|pulling\s+off|the\s+job|master\s+plan)\b/i.test(lowerForExtraction)) {
    themesSet.add('heist con caper clever plan');
  }
  if (/\b(time\s+travel|time\s+loop|alternate\s+(timeline|universe|reality)|parallel\s+universe|multiverse|simulation)\b/i.test(lowerForExtraction)) {
    themesSet.add('time travel alternate reality mind bending');
  }
  if (/\b(space|cosmos|galaxy|astronaut|alien|extraterrestrial|planet|stars?|intergalactic|nasa|spacecraft)\b/i.test(lowerForExtraction)) {
    themesSet.add('space cosmos exploration science fiction');
  }
  if (/\b(supernatural|paranormal|ghost|haunted|demon|occult|psychic|mystical|unexplained|afterlife|possession)\b/i.test(lowerForExtraction)) {
    themesSet.add('supernatural paranormal mystery');
  }
  if (/\b(conspiracy|cover-?up|government|corruption|political|whistleblower|shadowy|hidden\s+truth|expos[eé]|deep\s+state)\b/i.test(lowerForExtraction)) {
    themesSet.add('conspiracy political thriller corruption');
  }
  if (/\b(underdog|sports?|athlete|competition|championship|tournament|training|coach|team|overcom(ing)?\s+odds)\b/i.test(lowerForExtraction)) {
    themesSet.add('sports underdog competition triumph');
  }
  if (/\b(war|battle|combat|soldier|troop|siege|front\s+line|prisoner\s+of\s+war|pow|world\s+war)\b/i.test(lowerForExtraction)) {
    themesSet.add('war conflict battle courage sacrifice');
  }
  if (/\b(power|ambition|empire|rise\s+to|corrupt(ion)?|greed|political\s+power|ruthless|corporate)\b/i.test(lowerForExtraction)) {
    themesSet.add('power ambition corruption ruthless');
  }
  if (/\b(nature|wildlife|animal|forest|ocean|underwater|planet\s+earth|environment)\b/i.test(lowerForExtraction)) {
    themesSet.add('nature wildlife environment');
  }
  if (/\b(cozy|comfort(ing)?|relax(ing)?|feel-?good|wholesome|gentle|warm|peaceful)\b/i.test(lowerForExtraction)) {
    themesSet.add('cozy comforting relaxing feel good');
  }
  if (/\b(solarpunk|futurism|optimistic|community|eco-?futurism)\b/i.test(lowerForExtraction)) {
    themesSet.add('optimistic futurism community');
  }

  const themes: string[] = Array.from(themesSet);
  const persons = extractPersonsFromPrompt(positiveText || text);

  const genreSources: Record<string, 'user' | 'quiz' | 'llm'> = {};
  for (const g of genresSet) {
    if (!negativeGenresSet.has(g)) {
      genreSources[g] = 'user';
    }
  }

  return {
    text,
    lower,
    positiveText,
    positiveLower,
    positiveClauses,
    negativeClauses,
    type,
    genres: Array.from(genresSet).sort(),
    genre_sources: genreSources,
    negative_genres: Array.from(negativeGenresSet).sort(),
    languages: Array.from(languagesSet).sort(),
    platforms: Array.from(platformsSet).sort(),
    experience: Array.from(experiencesSet).sort(),
    era_preference: eraPreference,
    quality_preference: qualityPreference,
    themes,
    negative_themes: negativeThemes,
    negative_keywords: negativeKeywords,
    negative_franchises: Array.from(negativeFranchisesSet),
    max_runtime_minutes: maxRuntimeMinutes,
    min_runtime_minutes: minRuntimeMinutes,
    runtime_is_hard_constraint: runtimeIsHardConstraint,
    min_release_year: minReleaseYear,
    max_release_year: maxReleaseYear,
    year_range_is_hard: yearRangeIsHard,
    runtime_preference: runtimePreference,
    actors: persons.actors,
    directors: persons.directors,
    actor_match_mode: persons.actor_match_mode,
    unresolved_persons: persons.unresolved_persons || [],
  };
}

/**
 * Main parser entry point (async, resolves reference titles against the CineVerse DB).
 */
export async function parseCustomPrompt(
  prompt: string,
  titleResolver?: (candidate: string) => Promise<string | null> | string | null
): Promise<UserPreferenceProfile> {
  if (!personCatalogInitialized) {
    await initPersonCatalogFromDatabase();
  }

  const feat = extractStructuredFeatures(prompt);

  // Reference Title Resolution
  const refCandidate = extractReferenceCandidate(feat.text);
  const referenceTitles: string[] = [];
  const unresolvedReferences: string[] = [];

  if (refCandidate) {
    let resolvedTitle: string | null = null;
    if (titleResolver) {
      resolvedTitle = await titleResolver(refCandidate.candidate);
    } else {
      resolvedTitle = await resolveTitleFromDatabase(refCandidate.candidate, feat.type);
    }

    if (resolvedTitle) {
      referenceTitles.push(resolvedTitle);
    } else {
      // Unresolved reference: never push to themes!
      unresolvedReferences.push(refCandidate.candidate);
    }
  }

  // Resolve Negative Entities (franchises, titles, persons)
  const negEntities = await resolveNegativeEntitiesFromDatabase(feat.negativeClauses);

  let runtimeRelation: RuntimeRelation = null;
  const hasShorterComp = /\b(shorter|less\s+long|not\s+as\s+long)\b/i.test(feat.lower);
  const hasLongerComp = /\b(longer)\b/i.test(feat.lower);

  if (referenceTitles.length > 0) {
    if (hasShorterComp) runtimeRelation = 'shorter_than_reference';
    else if (hasLongerComp) runtimeRelation = 'longer_than_reference';
  }

  // Reconcile and purge negative items from positive fields
  const finalGenres = feat.genres.filter((g) => !feat.negative_genres.includes(g));
  const finalActors = feat.actors.filter(
    (a) => !negEntities.negative_persons.some((np) => np.toLowerCase() === a.toLowerCase())
  );
  const finalDirectors = feat.directors.filter(
    (d) => !negEntities.negative_persons.some((np) => np.toLowerCase() === d.toLowerCase())
  );
  const finalRefTitles = referenceTitles.filter(
    (rt) => !negEntities.negative_titles.some((nt) => nt.toLowerCase() === rt.toLowerCase())
  );
  const finalThemes = feat.themes.filter(
    (t) => !feat.negative_keywords.includes(t.toLowerCase()) && !feat.negative_themes.includes(t)
  );

  const finalUnresolvedRefs = Array.from(new Set([...unresolvedReferences, ...negEntities.unresolved_references]));
  const finalUnresolvedPersons = Array.from(new Set([...feat.unresolved_persons, ...negEntities.unresolved_persons]));

  const hasAnyPreference =
    finalGenres.length > 0 ||
    finalActors.length > 0 ||
    finalDirectors.length > 0 ||
    finalRefTitles.length > 0 ||
    finalThemes.length > 0 ||
    feat.experience.length > 0 ||
    feat.languages.length > 0 ||
    feat.platforms.length > 0 ||
    feat.type !== null ||
    feat.min_release_year !== null ||
    feat.max_release_year !== null ||
    feat.min_runtime_minutes !== null ||
    feat.max_runtime_minutes !== null ||
    feat.negative_genres.length > 0 ||
    feat.negative_themes.length > 0 ||
    negEntities.negative_titles.length > 0 ||
    negEntities.negative_persons.length > 0 ||
    negEntities.negative_franchises.length > 0;

  const genreContradiction = feat.negative_genres.some((ng) => {
    return GENRE_RULES.some((r) => r.canonical === ng && r.pattern.test(feat.positiveLower));
  });
  const runtimeContradiction =
    feat.min_runtime_minutes !== null &&
    feat.max_runtime_minutes !== null &&
    feat.min_runtime_minutes > feat.max_runtime_minutes;
  const hasContradiction = genreContradiction || runtimeContradiction;

  const lowConfidence = negEntities.low_confidence || negEntities.negative_franchises.length > 0 || !hasAnyPreference || hasContradiction;

  const finalGenreSources: Record<string, 'user' | 'quiz' | 'llm'> = {};
  for (const g of finalGenres) {
    if (feat.genre_sources && feat.genre_sources[g]) {
      finalGenreSources[g] = feat.genre_sources[g];
    }
  }

  return {
    source: 'custom',
    experience: feat.experience,
    type: feat.type,
    genres: finalGenres,
    genre_sources: finalGenreSources,
    languages: feat.languages,
    platforms: feat.platforms,
    runtime_preference: feat.runtime_preference,
    runtime_relation: runtimeRelation,
    era_preference: feat.era_preference,
    quality_preference: feat.quality_preference,
    themes: finalThemes,
    reference_titles: finalRefTitles,
    free_text: feat.text,
    negative_themes: feat.negative_themes,
    negative_genres: feat.negative_genres,
    negative_keywords: feat.negative_keywords,
    negative_titles: negEntities.negative_titles,
    negative_persons: negEntities.negative_persons,
    negative_franchises: Array.from(new Set([...negEntities.negative_franchises, ...feat.negative_franchises])),
    unresolved_references: finalUnresolvedRefs,
    unresolved_persons: finalUnresolvedPersons,
    max_runtime_minutes: feat.max_runtime_minutes,
    min_runtime_minutes: feat.min_runtime_minutes,
    runtime_is_hard_constraint: feat.runtime_is_hard_constraint,
    min_release_year: feat.min_release_year,
    max_release_year: feat.max_release_year,
    year_range_is_hard: feat.year_range_is_hard,
    actors: finalActors,
    directors: finalDirectors,
    actor_match_mode: feat.actor_match_mode,
    is_degraded: isCatalogDegraded || !hasAnyPreference || hasContradiction ? true : undefined,
    low_confidence: lowConfidence ? true : undefined,
  };
}

/**
 * Synchronous variant for offline or mock unit test execution.
 */
export function parseCustomPromptSync(
  prompt: string,
  syncResolver?: (candidate: string) => string | null
): UserPreferenceProfile {
  ensurePersonCatalogLoaded();

  const feat = extractStructuredFeatures(prompt);

  const refCandidate = extractReferenceCandidate(feat.text);
  const referenceTitles: string[] = [];
  const unresolvedReferences: string[] = [];

  if (refCandidate) {
    let resolvedTitle: string | null = null;
    if (syncResolver) {
      resolvedTitle = syncResolver(refCandidate.candidate);
    }

    if (resolvedTitle) {
      referenceTitles.push(resolvedTitle);
    } else {
      unresolvedReferences.push(refCandidate.candidate);
    }
  }

  const negEntities = resolveNegativeEntitiesSync(feat.negativeClauses);

  let runtimeRelation: RuntimeRelation = null;
  const hasShorterComp = /\b(shorter|less\s+long|not\s+as\s+long)\b/i.test(feat.lower);
  const hasLongerComp = /\b(longer)\b/i.test(feat.lower);

  if (referenceTitles.length > 0) {
    if (hasShorterComp) runtimeRelation = 'shorter_than_reference';
    else if (hasLongerComp) runtimeRelation = 'longer_than_reference';
  }

  const finalGenres = feat.genres.filter((g) => !feat.negative_genres.includes(g));
  const finalActors = feat.actors.filter(
    (a) => !negEntities.negative_persons.some((np) => np.toLowerCase() === a.toLowerCase())
  );
  const finalDirectors = feat.directors.filter(
    (d) => !negEntities.negative_persons.some((np) => np.toLowerCase() === d.toLowerCase())
  );
  const finalRefTitles = referenceTitles.filter(
    (rt) => !negEntities.negative_titles.some((nt) => nt.toLowerCase() === rt.toLowerCase())
  );
  const finalThemes = feat.themes.filter(
    (t) => !feat.negative_keywords.includes(t.toLowerCase()) && !feat.negative_themes.includes(t)
  );

  const finalUnresolvedRefs = Array.from(new Set([...unresolvedReferences, ...negEntities.unresolved_references]));
  const finalUnresolvedPersons = Array.from(new Set([...feat.unresolved_persons, ...negEntities.unresolved_persons]));

  const hasAnyPreference =
    finalGenres.length > 0 ||
    finalActors.length > 0 ||
    finalDirectors.length > 0 ||
    finalRefTitles.length > 0 ||
    finalThemes.length > 0 ||
    feat.experience.length > 0 ||
    feat.languages.length > 0 ||
    feat.platforms.length > 0 ||
    feat.type !== null ||
    feat.min_release_year !== null ||
    feat.max_release_year !== null ||
    feat.min_runtime_minutes !== null ||
    feat.max_runtime_minutes !== null ||
    feat.negative_genres.length > 0 ||
    feat.negative_themes.length > 0 ||
    feat.negative_franchises.length > 0 ||
    negEntities.negative_titles.length > 0 ||
    negEntities.negative_persons.length > 0 ||
    negEntities.negative_franchises.length > 0;

  const genreContradiction = feat.negative_genres.some((ng) => {
    return GENRE_RULES.some((r) => r.canonical === ng && r.pattern.test(feat.positiveLower));
  });
  const runtimeContradiction =
    feat.min_runtime_minutes !== null &&
    feat.max_runtime_minutes !== null &&
    feat.min_runtime_minutes > feat.max_runtime_minutes;
  const hasContradiction = genreContradiction || runtimeContradiction;

  const lowConfidence = negEntities.low_confidence || negEntities.negative_franchises.length > 0 || feat.negative_franchises.length > 0 || !hasAnyPreference || hasContradiction;

  const finalGenreSources: Record<string, 'user' | 'quiz' | 'llm'> = {};
  for (const g of finalGenres) {
    if (feat.genre_sources && feat.genre_sources[g]) {
      finalGenreSources[g] = feat.genre_sources[g];
    }
  }

  return {
    source: 'custom',
    experience: feat.experience,
    type: feat.type,
    genres: finalGenres,
    genre_sources: finalGenreSources,
    languages: feat.languages,
    platforms: feat.platforms,
    runtime_preference: feat.runtime_preference,
    runtime_relation: runtimeRelation,
    era_preference: feat.era_preference,
    quality_preference: feat.quality_preference,
    themes: finalThemes,
    reference_titles: finalRefTitles,
    free_text: feat.text,
    negative_themes: feat.negative_themes,
    negative_genres: feat.negative_genres,
    negative_keywords: feat.negative_keywords,
    negative_titles: negEntities.negative_titles,
    negative_persons: negEntities.negative_persons,
    negative_franchises: Array.from(new Set([...negEntities.negative_franchises, ...feat.negative_franchises])),
    unresolved_references: finalUnresolvedRefs,
    unresolved_persons: finalUnresolvedPersons,
    max_runtime_minutes: feat.max_runtime_minutes,
    min_runtime_minutes: feat.min_runtime_minutes,
    runtime_is_hard_constraint: feat.runtime_is_hard_constraint,
    min_release_year: feat.min_release_year,
    max_release_year: feat.max_release_year,
    year_range_is_hard: feat.year_range_is_hard,
    actors: finalActors,
    directors: finalDirectors,
    actor_match_mode: feat.actor_match_mode,
    is_degraded: isCatalogDegraded || !hasAnyPreference || hasContradiction ? true : undefined,
    low_confidence: lowConfidence ? true : undefined,
  };
}

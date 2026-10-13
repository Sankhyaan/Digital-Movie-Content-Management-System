// =============================================================================
// CINEVERSE RECOMMENDATION ENGINE — EMBEDDING CLIENT
// =============================================================================
// Constructs semantic query representations from UserPreferenceProfile and
// generates 384-dimensional normalized vectors via the local embedding service.
// NO external LLMs or cloud embedding APIs are used.
// =============================================================================

import http from 'http';
import { UserPreferenceProfile } from '../../models/preferenceProfile';
import { ReferenceProfile } from './types';

// Canonical intent expansions for Guided Quiz experiences (Intent descriptions, NOT genre labels)
export const EXPERIENCE_INTENT_MAP: Record<string, string> = {
  thought_provoking: 'thought-provoking, intellectually engaging, complex ideas, interesting concepts, mentally stimulating, surprising philosophical depth',
  funny:             'humorous, comedic, playful, entertaining, light-hearted, laugh-out-loud fun',
  thrilling:         'suspenseful, tense, exciting, dangerous, fast-paced, edge-of-your-seat adrenaline',
  emotional:         'heartfelt, moving, emotionally powerful, human relationships, deeply touching drama',
  escapist:          'immersive, adventurous, imaginative, entertaining, transportive world-building, escapism',
};

export class EmbeddingClient {
  private static serviceUrl = 'http://127.0.0.1:5002/embed';

  /**
   * Constructs the semantic query string from the user preference profile.
   * For GUIDED: Expands experience into descriptive intent text.
   * For CUSTOM: Uses the authentic free_text prompt, themes, plus reference title concepts.
   */
  public static buildSemanticQuery(
    profile: UserPreferenceProfile,
    referenceProfiles: ReferenceProfile[] = []
  ): string {
    if (profile.source === 'custom') {
      const parts: string[] = [];

      // 1. Core user intent — strip negative avoidance phrases to keep it positive
      if (profile.free_text && profile.free_text.trim()) {
        let cleanPromptText = profile.free_text.trim();
        cleanPromptText = cleanPromptText
          .replace(/\b(?:but\s+)?(?:not\s+(?:too\s+)?[a-z\s]+|without\s+[a-z\s]+|avoid\s+[a-z\s]+|no\s+[a-z\s]+|nothing\s+too\s+[a-z\s]+)\b/gi, '')
          .replace(/[,.]\s*[,.]/g, '.')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanPromptText) {
          parts.push(cleanPromptText);
        }
      }

      // 2. Detected genres → natural language phrases (enrich the embedding signal)
      if (profile.genres && profile.genres.length > 0) {
        const genreDesc = profile.genres.map((g) => {
          // Map canonical genre labels to natural language embedding phrases
          const phraseMap: Record<string, string> = {
            'Sci-Fi & Fantasy': 'science fiction speculative futuristic',
            'Action': 'action exciting thrilling fast-paced',
            'Adventure': 'adventurous journey exploration quest',
            'Animation': 'animated colorful imaginative',
            'Comedy': 'funny comedic humorous lighthearted',
            'Crime': 'crime criminal investigation detective',
            'Documentary': 'documentary real factual informative',
            'Drama': 'dramatic emotional human drama',
            'Family': 'family wholesome all-ages heartwarming',
            'Fantasy': 'fantasy magical mystical enchanting',
            'History': 'historical period authentic true events',
            'Horror': 'horror scary frightening dark supernatural',
            'Music': 'music musical performance artistic',
            'Mystery': 'mystery suspenseful enigmatic puzzling',
            'Romance': 'romantic love relationship heartfelt',
            'Thriller': 'thriller suspense tension gripping',
            'War': 'war military combat heroic sacrifice',
            'Western': 'western frontier cowboy rugged',
          };
          return phraseMap[g] || g;
        });
        parts.push(genreDesc.join(', '));
      }

      // 3. Detected themes → descriptive thematic phrases
      if (profile.themes && profile.themes.length > 0) {
        parts.push(profile.themes.join('. '));
      }

      // 4. Detected experience intents
      if (profile.experience && profile.experience.length > 0) {
        for (const exp of profile.experience) {
          if (EXPERIENCE_INTENT_MAP[exp]) {
            parts.push(EXPERIENCE_INTENT_MAP[exp]);
          }
        }
      }

      // 5. Reference title concepts: description (richest signal) or genres
      if (referenceProfiles && referenceProfiles.length > 0) {
        for (const ref of referenceProfiles) {
          if (ref.description && ref.description.trim()) {
            const descSnippet = ref.description.trim().slice(0, 200);
            parts.push(`Similar themes and storytelling to: ${descSnippet}`);
          } else if (ref.genres && ref.genres.length > 0) {
            parts.push(`thematic elements of ${ref.genres.join(', ')}`);
          }
        }
      }

      return parts.length > 0 ? parts.join('. ') : 'captivating entertaining cinema story';
    }

    // Guided mode
    const intentParts: string[] = [];
    if (profile.experience && profile.experience.length > 0) {
      for (const exp of profile.experience) {
        if (EXPERIENCE_INTENT_MAP[exp]) {
          intentParts.push(EXPERIENCE_INTENT_MAP[exp]);
        }
      }
    }

    // Include genre context for guided mode when genres are available
    if (profile.genres && profile.genres.length > 0) {
      intentParts.push(profile.genres.join(' '));
    }

    // Include type context to steer embedding toward the right content format
    if (profile.type === 'Movie') {
      intentParts.push('cinematic film storytelling');
    } else if (profile.type === 'Series') {
      intentParts.push('serialized television series storytelling');
    }

    if (profile.era_preference === 'classic') {
      intentParts.push('classic retro timeless cinematic heritage');
    } else if (profile.era_preference === 'recent') {
      intentParts.push('contemporary fresh modern storytelling');
    }

    if (intentParts.length === 0) {
      return 'high quality engaging storytelling';
    }

    return intentParts.join('. ');
  }

  /**
   * Constructs negative query text when negative/exclusion preferences are present.
   */
  public static buildNegativeQuery(profile: UserPreferenceProfile): string | null {
    const parts: string[] = [];
    if (profile.negative_themes && profile.negative_themes.length > 0) {
      parts.push(...profile.negative_themes);
    }
    if (profile.negative_keywords && profile.negative_keywords.length > 0) {
      parts.push(...profile.negative_keywords);
    }
    if (profile.negative_genres && profile.negative_genres.length > 0) {
      parts.push(...profile.negative_genres);
    }

    if (parts.length === 0) return null;

    const uniqueTerms = Array.from(new Set(parts.map((p) => p.trim()).filter(Boolean)));
    const expanded: string[] = [];

    for (const term of uniqueTerms) {
      const lower = term.toLowerCase();
      if (lower.includes('depressing') || lower.includes('sad')) {
        expanded.push('depressing, bleak, gloomy, emotionally devastating, sad');
      } else if (lower.includes('dark')) {
        expanded.push('dark, grim, disturbing, bleak, sinister');
      } else if (lower.includes('violent')) {
        expanded.push('violent, gore, brutality, gruesome, graphic violence');
      } else if (lower.includes('scary') || lower.includes('horror')) {
        expanded.push('horror, terrifying, nightmare, jumpscare, scary');
      } else {
        expanded.push(term);
      }
    }

    return Array.from(new Set(expanded)).join(', ');
  }

  /**
   * Encodes a query text using the local embedding HTTP service (all-MiniLM-L6-v2).
   */
  public static async embedText(text: string): Promise<number[] | null> {
    const payload = JSON.stringify({ texts: [text] });

    return new Promise((resolve) => {
      const req = http.request(
        'http://127.0.0.1:5002/embed',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 4000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.success && json.embeddings && json.embeddings.length > 0) {
                resolve(json.embeddings[0]);
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          });
        }
      );

      req.on('error', () => {
        resolve(null);
      });
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.write(payload);
      req.end();
    });
  }
}

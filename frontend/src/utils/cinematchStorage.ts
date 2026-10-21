import { RecommendationResult, UserPreferenceProfile } from '../api/movieApi';

export const CINEMATCH_STORAGE_KEY = 'cinematch_saved_results_v2';

export interface SavedCineMatchState {
  recommendations: RecommendationResult[];
  profile: UserPreferenceProfile;
}

/**
 * Safely retrieves cached CineMatch state from sessionStorage.
 * Validates data structure and discards stale or corrupt versions.
 */
export function getSavedCineMatch(): SavedCineMatchState | null {
  try {
    const raw = sessionStorage.getItem(CINEMATCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.recommendations) &&
      parsed.recommendations.length > 0 &&
      parsed.profile
    ) {
      return parsed;
    }
    // Clean up empty, invalid or corrupted structure
    sessionStorage.removeItem(CINEMATCH_STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

/**
 * Caches valid CineMatch recommendations and profile to sessionStorage.
 */
export function saveCineMatch(state: SavedCineMatchState): void {
  try {
    if (
      !state ||
      !Array.isArray(state.recommendations) ||
      state.recommendations.length === 0
    ) {
      clearSavedCineMatch();
      return;
    }
    sessionStorage.setItem(CINEMATCH_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to cache CineMatch state in sessionStorage:', e);
  }
}

/**
 * Clears saved CineMatch state from sessionStorage and removes legacy keys.
 */
export function clearSavedCineMatch(): void {
  try {
    sessionStorage.removeItem(CINEMATCH_STORAGE_KEY);
    sessionStorage.removeItem('cinematch_saved_results');
  } catch {}
}

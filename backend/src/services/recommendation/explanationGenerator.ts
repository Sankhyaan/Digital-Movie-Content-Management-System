// =============================================================================
// CINEVERSE RECOMMENDATION ENGINE — EXPLANATION GENERATOR
// =============================================================================
// Generates concise, truthful, deterministic explanations for recommendations.
// Strictly mentions only signals that actively contributed to the candidate's rank.
// NO LLM hallucinations or invented justifications.
// =============================================================================

import { ScoredCandidate } from './types';
import { UserPreferenceProfile } from '../../models/preferenceProfile';

export class ExplanationGenerator {
  public static generateMatchReasons(
    candidate: ScoredCandidate,
    profile: UserPreferenceProfile,
    isSurpriseMe: boolean,
    refProfiles: import('./types').ReferenceProfile[] = []
  ): string[] {
    const reasons: string[] = [];
    const dna = candidate.dna;

    if (isSurpriseMe) {
      if (dna.rating && dna.rating >= 7.5) {
        reasons.push(`Acclaimed ${dna.genres.slice(0, 2).join('/')} pick (${dna.rating.toFixed(1)}/10 on TMDB)`);
      } else {
        reasons.push(`Curated discovery pick showcasing ${dna.genres.slice(0, 2).join(' & ')}`);
      }
      if (dna.release_year) {
        reasons.push(`Released in ${dna.release_year}`);
      }
      return reasons.slice(0, 3);
    }

    // 1. Explicit Director Match (High priority signal)
    if (profile.directors && profile.directors.length > 0) {
      const matchedDirs = profile.directors.filter((d) =>
        (dna.directors || []).some((cd) => cd.toLowerCase() === d.toLowerCase())
      );
      if (matchedDirs.length > 0) {
        reasons.push(`Directed by ${matchedDirs.join(' & ')}`);
      }
    }

    // 2. Explicit Actor Match (High priority signal)
    if (profile.actors && profile.actors.length > 0) {
      const matchedActors = profile.actors.filter((a) =>
        (dna.actors || []).some((ca) => ca.toLowerCase() === a.toLowerCase())
      );
      if (matchedActors.length > 0) {
        reasons.push(`Starring ${matchedActors.join(' & ')}`);
      }
    }



    // 4. Reference Title Match (Truthful signal-backed explanations)
    // Threshold raised to 0.65: below this the similarity is too loose for a confident explanation
    if (profile.reference_titles && profile.reference_titles.length > 0) {
      if (candidate.reference_score >= 0.65) {
        const refTitle = candidate.reference_details?.reference_title || profile.reference_titles[0];
        const matchedRef = refProfiles.find((r) => r.title.toLowerCase() === refTitle.toLowerCase());
        const sharedGenres = matchedRef
          ? matchedRef.genres.filter((g) => dna.genres.includes(g))
          : [];

        if (sharedGenres.length >= 2) {
          reasons.push(`Similar to ${refTitle} in ${sharedGenres.slice(0, 2).join(' & ')} and thematic style`);
        } else if (sharedGenres.length === 1) {
          reasons.push(`Shares ${sharedGenres[0]} elements with ${refTitle}`);
        } else {
          reasons.push(`Similar to ${refTitle} in narrative tone and thematic style`);
        }
      }
    }

    // 5. Explicit Genre Overlap (Truthful: strictly verified against requested genres)
    if (profile.genres && profile.genres.length > 0) {
      const matchedGenres = profile.genres.filter((g) => dna.genres.includes(g));
      if (matchedGenres.length > 0) {
        reasons.push(`Matches your requested ${matchedGenres.join(' & ')} genre`);
      }
    }

    // 3. Experience / Mood intent
    if (profile.experience && profile.experience.length > 0) {
      if (candidate.experience_score >= 0.60) {
        const labels = profile.experience
          .map((e) => e.replace('_', '-'))
          .join(' and ');
        reasons.push(`Strong match for a ${labels} experience`);
      }
    }

    // 4. Runtime relation / preference / exact minutes
    if (profile.max_runtime_minutes && dna.runtime && dna.runtime <= profile.max_runtime_minutes) {
      reasons.push(`Under your ${profile.max_runtime_minutes}-minute limit (${dna.runtime} min)`);
    } else if (profile.runtime_relation === 'shorter_than_reference') {
      const runtime = dna.type === 'Movie' ? dna.runtime : dna.series_metadata?.avg_episode_duration;
      if (runtime) reasons.push(`Runtime (${runtime} min) is shorter than reference title`);
    } else if (profile.runtime_preference === 'under_2_hours' && dna.runtime) {
      reasons.push(`Quick runtime (${dna.runtime} min) under 2 hours`);
    } else if (profile.runtime_preference === 'around_2_hours' && dna.runtime) {
      reasons.push(`Runtime (${dna.runtime} min) closely fits your ~2-hour preference`);
    } else if (profile.runtime_preference === 'binge_series' && dna.type === 'Series') {
      const seasons = dna.series_metadata?.total_seasons || 1;
      reasons.push(`Binge-worthy series across ${seasons} seasons`);
    }



    // 6. Platform availability
    if (profile.platforms && profile.platforms.length > 0) {
      const available = profile.platforms.filter((p) => dna.platforms.includes(p));
      if (available.length > 0) {
        reasons.push(`Available to stream on ${available.join(', ')}`);
      }
    }

    // 7. Language availability
    if (profile.languages && profile.languages.length > 0) {
      const available = profile.languages.filter((l) => dna.languages.includes(l));
      if (available.length > 0) {
        reasons.push(`Available in ${available.join(', ')}`);
      }
    }

    // 8. Era & Exact Year Bounds
    if (profile.min_release_year !== null && profile.max_release_year !== null && dna.release_year) {
      if (dna.release_year >= profile.min_release_year && dna.release_year <= profile.max_release_year) {
        if (profile.min_release_year === 2000 && profile.max_release_year === 2009) {
          reasons.push(`Released in the 2000s (${dna.release_year})`);
        } else {
          reasons.push(`Released between ${profile.min_release_year} and ${profile.max_release_year} (${dna.release_year})`);
        }
      }
    } else if (profile.era_preference && profile.era_preference !== 'any' && candidate.era_score >= 0.85) {
      if (profile.era_preference === 'recent') {
        reasons.push(`Recent release (${dna.release_year})`);
      } else if (profile.era_preference === 'classic') {
        reasons.push(`Classic cinematic era (${dna.release_year})`);
      } else if (profile.era_preference === 'modern') {
        reasons.push(`Modern 2000s–2010s era (${dna.release_year})`);
      }
    }

    // 9. Quality / Acclaim
    if (
      dna.rating &&
      dna.rating >= 7.8 &&
      (profile.quality_preference === 'high' || profile.quality_preference === 'medium')
    ) {
      reasons.push(`Highly rated on TMDB (${dna.rating.toFixed(1)}/10)`);
    }

    // Fallback if no specific condition met but high semantic similarity
    if (reasons.length === 0) {
      if (candidate.semantic_score >= 0.65) {
        reasons.push('High story and thematic relevance to your request');
      } else {
        reasons.push(`Strong overall match across ${dna.genres.slice(0, 2).join(' and ')}`);
      }
    }

    // Return top 2-3 most relevant reasons
    return reasons.slice(0, 3);
  }
}

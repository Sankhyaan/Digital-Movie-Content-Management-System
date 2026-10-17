// =============================================================================
// UNIT TESTS — V2 METRIC CALCULATORS
// =============================================================================
// Hand-computed reference values for:
//  1. dcg()
//  2. ndcgAtK() — ideal built from full catalog, not candidate pool
//  3. precisionAtK()
//  4. recallAtK() — full catalog denominator
//  5. hardViolations()
//
// How to run: npx ts-jest --testPathPattern=v2/metricCalculators.test
// or: npm test -- --testPathPattern=metricCalculators
// =============================================================================

import {
  dcg,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  hardViolations,
  inferParseStatus,
} from './metricCalculators';
import { V2JudgeSpec } from './judgeSpecs';
import { MovieDNA } from '../../models/interfaces';

// Standalone runner shim when Jest/Mocha is not present
declare const describe: any;
declare const it: any;
declare const expect: any;

if (typeof (global as any).describe === 'undefined') {
  (global as any).describe = (name: string, fn: () => void) => {
    console.log(`\n--- ${name} ---`);
    fn();
  };
  (global as any).it = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      console.error(`  ✗ ${name}\n    ${e.message}`);
      throw e;
    }
  };
  (global as any).expect = (actual: any) => ({
    toBe: (expected: any) => {
      if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
    },
    toBeCloseTo: (expected: number, precision: number = 2) => {
      const diff = Math.abs(actual - expected);
      const tolerance = Math.pow(10, -precision) / 2;
      if (diff > tolerance) throw new Error(`Expected ${actual} to be close to ${expected} (tolerance ${tolerance}, diff ${diff})`);
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal MovieDNA stub with only the fields the judge needs */
function stub(overrides: Partial<MovieDNA>): MovieDNA {
  return {
    content_id: 0,
    title: 'Test',
    type: 'Movie',
    genres: [],
    actors: [],
    directors: [],
    languages: ['English'],
    platforms: [],
    release_year: 2020,
    runtime: 100,
    rating: 7.0,
    description: '',
    series_metadata: null,
    quality_flags: null,
    ...overrides,
  } as MovieDNA;
}

/** Build a judge spec that deems a title relevant if type=Movie */
const movieJudge: V2JudgeSpec = {
  case_id: 'TEST-MOVIE',
  judge_type: 'deterministic',
  is_mandatory: (dna) => dna.type === 'Movie',
  mandatory_description: 'type=Movie',
  graded_relevance: (dna) => (dna.type === 'Movie' ? 3 : 0),
  mandatory_fields: ['type'],
  judge_note: '',
};

/** Build a judge spec that deems a title relevant if genre=Action */
const actionJudge: V2JudgeSpec = {
  case_id: 'TEST-ACTION',
  judge_type: 'deterministic',
  is_mandatory: (dna) => (dna.genres || []).includes('Action'),
  mandatory_description: 'genre=Action',
  graded_relevance: (dna) => ((dna.genres || []).includes('Action') ? 3 : 0),
  mandatory_fields: ['genres'],
  judge_note: '',
};

// ---------------------------------------------------------------------------
// DCG
// ---------------------------------------------------------------------------

describe('dcg()', () => {
  it('should return 0 for empty grades', () => {
    expect(dcg([])).toBe(0);
  });

  it('should return rel/log2(2)=rel for a single item at rank 1', () => {
    // DCG[1] = 3 / log2(2) = 3/1 = 3
    expect(dcg([3])).toBeCloseTo(3.0, 5);
  });

  it('should compute DCG correctly for a 3-item ranking', () => {
    // [3, 2, 1]:
    // 3/log2(2) + 2/log2(3) + 1/log2(4)
    // = 3/1     + 2/1.585   + 1/2
    // = 3.000   + 1.262     + 0.500  = 4.762
    const result = dcg([3, 2, 1]);
    expect(result).toBeCloseTo(4.762, 2);
  });

  it('should compute DCG for [3, 0, 0] (only rank-1 relevant)', () => {
    // 3/log2(2) = 3
    expect(dcg([3, 0, 0])).toBeCloseTo(3.0, 5);
  });

  it('should compute DCG for [0, 0, 3] (only rank-3 relevant)', () => {
    // 3/log2(4) = 3/2 = 1.5
    expect(dcg([0, 0, 3])).toBeCloseTo(1.5, 5);
  });
});

// ---------------------------------------------------------------------------
// NDCG@K — ideal from full catalog
// ---------------------------------------------------------------------------

describe('ndcgAtK()', () => {
  it('should return 1.0 when there are no relevant items in the catalog', () => {
    // allCatalogGrades all 0 → idealDCG=0 → return 1.0 by convention
    const result = ndcgAtK([0, 0, 0], [0, 0, 0, 0, 0], 3);
    expect(result).toBe(1.0);
  });

  it('should return 1.0 when the ranking is ideal', () => {
    // Catalog has grades [3, 2, 1]; top-3 result matches ideal
    const result = ndcgAtK([3, 2, 1], [3, 2, 1, 0, 0], 3);
    expect(result).toBeCloseTo(1.0, 5);
  });

  it('should return <1.0 when the ranking is sub-optimal', () => {
    // Best 3 from catalog: [3, 3, 2] (ideal)
    // Actual top-3: [0, 0, 0]
    const idealGrades = [3, 3, 2, 1, 0];
    const result = ndcgAtK([0, 0, 0], idealGrades, 3);
    expect(result).toBe(0.0);
  });

  it('should compute NDCG correctly against catalog-based ideal', () => {
    // Catalog has 10 items: [3, 3, 3, 2, 2, 1, 1, 0, 0, 0]
    // Ideal top-3: [3, 3, 3]
    // Ideal DCG = 3/log2(2) + 3/log2(3) + 3/log2(4)
    //           = 3         + 1.893      + 1.5       = 6.393
    // Actual top-3: [3, 2, 1]
    // Actual DCG = 3/log2(2) + 2/log2(3) + 1/log2(4)
    //            = 3         + 1.262      + 0.5       = 4.762
    // NDCG = 4.762 / 6.393 = 0.745
    const catalogGrades = [3, 3, 3, 2, 2, 1, 1, 0, 0, 0];
    const result = ndcgAtK([3, 2, 1], catalogGrades, 3);
    expect(result).toBeCloseTo(0.745, 2);
  });

  it('should not use candidate pool as ideal — only full catalog', () => {
    // Full catalog has a grade-3 item not in top-3
    const catalogGrades = [3, 0, 0, 0]; // 1 highly relevant item in catalog
    const actualTop3 = [0, 0, 0]; // none of the highly relevant items returned
    const result = ndcgAtK(actualTop3, catalogGrades, 3);
    // Ideal DCG = 3/log2(2) = 3; Actual DCG = 0; NDCG = 0
    expect(result).toBe(0.0);
  });
});

// ---------------------------------------------------------------------------
// Precision@K
// ---------------------------------------------------------------------------

describe('precisionAtK()', () => {
  const movieResults = [
    stub({ type: 'Movie' }),
    stub({ type: 'Movie' }),
    stub({ type: 'Series' }),
    stub({ type: 'Movie' }),
    stub({ type: 'Series' }),
  ];

  it('should return 0 for empty results', () => {
    expect(precisionAtK([], movieJudge, 10)).toBe(0);
  });

  it('should compute precision correctly (3/5 movies)', () => {
    // 3 Movies out of 5 results
    expect(precisionAtK(movieResults, movieJudge, 5)).toBeCloseTo(0.6, 5);
  });

  it('should truncate at K', () => {
    // Only first 2 items considered — both are Movie → P@2 = 1.0
    expect(precisionAtK(movieResults, movieJudge, 2)).toBeCloseTo(1.0, 5);
  });

  it('should return 0 when no results pass the mandatory judge', () => {
    const seriesOnly = [
      stub({ type: 'Series' }),
      stub({ type: 'Series' }),
    ];
    expect(precisionAtK(seriesOnly, movieJudge, 10)).toBe(0);
  });

  it('should return 1.0 when all results pass the mandatory judge', () => {
    const allMovies = [
      stub({ type: 'Movie' }),
      stub({ type: 'Movie' }),
      stub({ type: 'Movie' }),
    ];
    expect(precisionAtK(allMovies, movieJudge, 5)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Recall@K — full catalog denominator
// ---------------------------------------------------------------------------

describe('recallAtK()', () => {
  const fullCatalog: MovieDNA[] = [
    stub({ type: 'Movie', title: 'M1' }),
    stub({ type: 'Movie', title: 'M2' }),
    stub({ type: 'Movie', title: 'M3' }),
    stub({ type: 'Series', title: 'S1' }),
    stub({ type: 'Series', title: 'S2' }),
  ];
  // 3 Movies in the full catalog

  it('should return 1.0 when no items in catalog are relevant', () => {
    // Catalog with only Series items; actionJudge requires Action genre
    const catalogNoAction: MovieDNA[] = [
      stub({ genres: ['Drama'] }),
      stub({ genres: ['Comedy'] }),
    ];
    expect(recallAtK([stub({ genres: [] })], actionJudge, catalogNoAction, 10)).toBe(1.0);
  });

  it('should return 0 when top-K has no relevant results', () => {
    const top10: MovieDNA[] = [stub({ type: 'Series' }), stub({ type: 'Series' })];
    // fullCatalog has 3 Movies → recall = 0/3 = 0
    expect(recallAtK(top10, movieJudge, fullCatalog, 10)).toBe(0);
  });

  it('should compute recall correctly: 2 relevant in top-3, 3 total in catalog', () => {
    const top3: MovieDNA[] = [
      stub({ type: 'Movie' }),
      stub({ type: 'Movie' }),
      stub({ type: 'Series' }),
    ];
    // 2 movies in top-3; 3 movies in full catalog → recall = 2/3
    expect(recallAtK(top3, movieJudge, fullCatalog, 3)).toBeCloseTo(2 / 3, 5);
  });

  it('should cap recall at 1.0 even if somehow more than total relevant returned', () => {
    const top10 = Array(10).fill(stub({ type: 'Movie' }));
    // 10 movies in top-10 but only 3 relevant in catalog → recall = 3/3 = 1.0
    // (we use the actual matching, so it's min(matched, total)/total)
    const matched = top10.filter((r) => movieJudge.is_mandatory(r)).length; // 10
    const totalRelevant = fullCatalog.filter((r) => movieJudge.is_mandatory(r)).length; // 3
    // recall = min(matched, totalRelevant)/totalRelevant
    const rawRecall = matched / totalRelevant; // 10/3 > 1 — our function should return matched in top10 / totalRelevant
    // The actual function counts relevant in top10, not the total matched count
    expect(recallAtK(top10, movieJudge, fullCatalog, 10)).toBe(1.0); // 3/3
  });

  it('should use only the first K results from top10', () => {
    const manyResults: MovieDNA[] = [
      stub({ type: 'Movie' }), // rank 1
      stub({ type: 'Series' }), // rank 2
      stub({ type: 'Movie' }), // rank 3
      stub({ type: 'Movie' }), // rank 4 — outside K=2 cutoff
    ];
    // K=2: only rank 1 and 2; rank 1 is Movie → 1 relevant out of 3 in catalog
    expect(recallAtK(manyResults, movieJudge, fullCatalog, 2)).toBeCloseTo(1 / 3, 5);
  });
});

// ---------------------------------------------------------------------------
// Hard violations
// ---------------------------------------------------------------------------

describe('hardViolations()', () => {
  it('should return zero violations for empty results', () => {
    const result = hardViolations([], movieJudge, 10);
    expect(result.count).toBe(0);
    expect(result.rate).toBe(0);
  });

  it('should count violations correctly', () => {
    const results = [
      stub({ type: 'Movie' }),   // passes
      stub({ type: 'Series' }), // fails — violation
      stub({ type: 'Movie' }),  // passes
    ];
    const { count, rate } = hardViolations(results, movieJudge, 3);
    expect(count).toBe(1);
    expect(rate).toBeCloseTo(1 / 3, 5);
  });

  it('should truncate at K', () => {
    const results = [
      stub({ type: 'Series' }), // rank 1 — violation
      stub({ type: 'Series' }), // rank 2 — violation
      stub({ type: 'Movie' }),  // rank 3 — passes but outside K=2
    ];
    const { count, rate } = hardViolations(results, movieJudge, 2);
    expect(count).toBe(2);
    expect(rate).toBe(1.0);
  });

  it('should detect zero violations when all results pass', () => {
    const allMovies = [
      stub({ type: 'Movie' }),
      stub({ type: 'Movie' }),
    ];
    const { count, rate } = hardViolations(allMovies, movieJudge, 10);
    expect(count).toBe(0);
    expect(rate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Parse status inference
// ---------------------------------------------------------------------------

describe('inferParseStatus()', () => {
  it('should return "empty" when no constraints are present', () => {
    const status = inferParseStatus({
      hasGenres: false, hasType: false, hasDirectors: false, hasActors: false,
      hasLanguages: false, hasPlatforms: false, hasRuntimeBound: false,
      hasYearBound: false, hasNegatives: false,
    });
    expect(status).toBe('empty');
  });

  it('should return "constrained" when type is specified', () => {
    const status = inferParseStatus({
      hasGenres: false, hasType: true, hasDirectors: false, hasActors: false,
      hasLanguages: false, hasPlatforms: false, hasRuntimeBound: false,
      hasYearBound: false, hasNegatives: false,
    });
    expect(status).toBe('constrained');
  });

  it('should return "constrained" when a director is specified', () => {
    const status = inferParseStatus({
      hasGenres: false, hasType: false, hasDirectors: true, hasActors: false,
      hasLanguages: false, hasPlatforms: false, hasRuntimeBound: false,
      hasYearBound: false, hasNegatives: false,
    });
    expect(status).toBe('constrained');
  });

  it('should return "constrained" when only genre is given (user-stated)', () => {
    const status = inferParseStatus({
      hasGenres: true, hasType: false, hasDirectors: false, hasActors: false,
      hasLanguages: false, hasPlatforms: false, hasRuntimeBound: false,
      hasYearBound: false, hasNegatives: false,
    });
    expect(status).toBe('constrained');
  });
});

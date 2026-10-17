// =============================================================================
// UNIT TESTS: Metric Calculators Verification
// =============================================================================
// Validates that NDCG@10, P@10, MRR, Set F1, and Violation Rate are computed
// with exact mathematical precision against textbook IR formulas.
// =============================================================================

import { MetricCalculators } from './metricCalculators';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${msg}`);
  }
}

function runTests() {
  console.log('🧪 Running MetricCalculators Unit Tests...');

  // 1. Set Metrics Tests (Precision, Recall, F1)
  {
    const emptyMatch = MetricCalculators.calculateSetMetrics([], []);
    assert(emptyMatch.precision === 1.0 && emptyMatch.recall === 1.0 && emptyMatch.f1 === 1.0, 'Empty sets must yield 1.0');

    const exactMatch = MetricCalculators.calculateSetMetrics(['Action', 'Sci-Fi'], ['action', 'sci-fi']);
    assert(exactMatch.f1 === 1.0, 'Exact case-insensitive match must yield F1 = 1.0');

    const partialMatch = MetricCalculators.calculateSetMetrics(['Action', 'Drama'], ['Action', 'Comedy']);
    // TP=1, FP=1, FN=1 -> P=0.5, R=0.5, F1=0.5
    assert(partialMatch.precision === 0.5 && partialMatch.recall === 0.5 && partialMatch.f1 === 0.5, 'Partial match must yield 0.5');

    const disjoint = MetricCalculators.calculateSetMetrics(['Action'], ['Drama']);
    assert(disjoint.precision === 0 && disjoint.recall === 0 && disjoint.f1 === 0, 'Disjoint sets must yield 0.0');
    console.log('  ✓ Set metrics (P/R/F1) passed');
  }

  // 2. DCG & NDCG Tests
  {
    // Textbook example: grades = [3, 2, 1, 0]
    // DCG = (2^3-1)/log2(2) + (2^2-1)/log2(3) + (2^1-1)/log2(4) + 0
    //     = 7/1 + 3/1.5849625 + 1/2 = 7 + 1.892789 + 0.5 = 9.392789
    const dcg = MetricCalculators.calculateDCG([3, 2, 1, 0], 4);
    assert(Math.abs(dcg - 9.3928) < 0.001, `DCG value expected ~9.3928, got ${dcg}`);

    // If returned is identical to ideal, NDCG = 1.0
    const perfectNdcg = MetricCalculators.calculateNDCG([3, 2, 1, 0], [3, 2, 1, 0], 4);
    assert(perfectNdcg === 1.0, `Perfect ranking must yield NDCG = 1.0, got ${perfectNdcg}`);

    // Suboptimal ordering: [1, 2, 3, 0] vs ideal [3, 2, 1, 0]
    // DCG = (2^1-1)/1 + (2^2-1)/1.58496 + (2^3-1)/2 = 1 + 1.892789 + 3.5 = 6.392789
    // NDCG = 6.392789 / 9.392789 = 0.6806
    const subNdcg = MetricCalculators.calculateNDCG([1, 2, 3, 0], [3, 2, 1, 0], 4);
    assert(Math.abs(subNdcg - 0.6806) < 0.002, `Suboptimal NDCG expected ~0.6806, got ${subNdcg}`);

    // Edge case: All zeros
    const zeroNdcg = MetricCalculators.calculateNDCG([0, 0], [0, 0], 2);
    assert(zeroNdcg === 1.0, 'Zero-relevant pool with zero returns must yield 1.0');
    console.log('  ✓ DCG and NDCG@K passed');
  }

  // 3. Precision@K Tests
  {
    const p1 = MetricCalculators.calculatePrecisionAtK([3, 2, 3, 1, 0], 5, 2);
    // items >= 2: 3, 2, 3 (3 items) out of 5 -> 0.6
    assert(p1 === 0.6, `Precision@5 expected 0.6, got ${p1}`);

    const pEmpty = MetricCalculators.calculatePrecisionAtK([], 10);
    assert(pEmpty === 0, 'Precision of empty results must be 0');
    console.log('  ✓ Precision@K passed');
  }

  // 4. Mean Reciprocal Rank (MRR) Tests
  {
    // First relevant item at rank 1 -> MRR = 1.0
    assert(MetricCalculators.calculateMRR([2, 1, 0], 3, 2) === 1.0, 'Rank 1 must yield MRR = 1.0');

    // First relevant item at rank 3 -> MRR = 1/3 = 0.3333
    const mrr3 = MetricCalculators.calculateMRR([0, 1, 3, 0], 4, 2);
    assert(Math.abs(mrr3 - 0.3333) < 0.001, `Rank 3 must yield MRR ~0.3333, got ${mrr3}`);

    // No relevant item -> MRR = 0
    assert(MetricCalculators.calculateMRR([0, 1, 1], 3, 2) === 0, 'No hits must yield MRR = 0');
    console.log('  ✓ MRR passed');
  }

  // 5. Hard Violation Rate Tests
  {
    const hvr = MetricCalculators.calculateHardViolationRate(2, 10);
    assert(hvr === 0.2, `Violation rate expected 0.2, got ${hvr}`);

    const hvrZero = MetricCalculators.calculateHardViolationRate(0, 10);
    assert(hvrZero === 0, `Zero violations must yield 0, got ${hvrZero}`);
    console.log('  ✓ Hard constraint violation rate passed');
  }

  console.log('✅ ALL METRIC CALCULATOR TESTS PASSED!\n');
}

runTests();

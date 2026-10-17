// =============================================================================
// CINEVERSE RECOMMENDATION QUALITY BENCHMARK — METRIC CALCULATORS
// =============================================================================
// Pure, deterministic, mathematically rigorous implementations of standard
// Information Retrieval (IR) and NLP evaluation metrics.
// =============================================================================

export class MetricCalculators {
  /**
   * Evaluates set overlap (Precision, Recall, F1) for discrete tokens/entities.
   * Case-insensitive matching.
   */
  public static calculateSetMetrics(
    expected: string[] | null | undefined,
    actual: string[] | null | undefined
  ): { precision: number; recall: number; f1: number } {
    const expSet = new Set((expected || []).map((s) => s.trim().toLowerCase()).filter(Boolean));
    const actSet = new Set((actual || []).map((s) => s.trim().toLowerCase()).filter(Boolean));

    if (expSet.size === 0 && actSet.size === 0) {
      return { precision: 1.0, recall: 1.0, f1: 1.0 };
    }
    if (expSet.size === 0 && actSet.size > 0) {
      return { precision: 0.0, recall: 1.0, f1: 0.0 };
    }
    if (expSet.size > 0 && actSet.size === 0) {
      return { precision: 1.0, recall: 0.0, f1: 0.0 };
    }

    let tp = 0;
    for (const item of actSet) {
      if (expSet.has(item)) {
        tp++;
      }
    }

    const precision = tp / actSet.size;
    const recall = tp / expSet.size;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
    };
  }

  /**
   * Discounted Cumulative Gain at rank K.
   * Standard formula: DCG@K = sum_{i=1}^K (2^rel_i - 1) / log2(i + 1)
   */
  public static calculateDCG(grades: number[], k: number = 10): number {
    const topGrades = grades.slice(0, k);
    let dcg = 0;
    for (let i = 0; i < topGrades.length; i++) {
      const rel = topGrades[i];
      if (rel > 0) {
        dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2); // i=0 => log2(2)=1
      }
    }
    return dcg;
  }

  /**
   * Normalized Discounted Cumulative Gain at rank K (NDCG@K).
   * returnedGrades: relevance scores of items in returned order [0..3].
   * allAvailableEligibleGrades: optional pool to compute ideal DCG. Defaults to returnedGrades sorted DESC.
   */
  public static calculateNDCG(
    returnedGrades: number[],
    allAvailableEligibleGrades?: number[],
    k: number = 10
  ): number {
    const dcg = this.calculateDCG(returnedGrades, k);
    const pool = (allAvailableEligibleGrades && allAvailableEligibleGrades.length > 0)
      ? allAvailableEligibleGrades
      : returnedGrades;

    const idealGrades = [...pool].sort((a, b) => b - a).slice(0, k);
    const idcg = this.calculateDCG(idealGrades, k);

    if (idcg === 0) {
      return dcg === 0 ? 1.0 : 0.0;
    }

    return Number((dcg / idcg).toFixed(4));
  }

  /**
   * Precision at K (P@K).
   * Fraction of top K returned items with relevance grade >= minimumRelevantGrade.
   */
  public static calculatePrecisionAtK(
    grades: number[],
    k: number = 10,
    minimumRelevantGrade: number = 2
  ): number {
    const slice = grades.slice(0, k);
    if (slice.length === 0) return 0;

    let relevantCount = 0;
    for (const g of slice) {
      if (g >= minimumRelevantGrade) {
        relevantCount++;
      }
    }
    return Number((relevantCount / slice.length).toFixed(4));
  }

  /**
   * Recall at K (R@K).
   * Fraction of total known relevant items retrieved in top K.
   */
  public static calculateRecallAtK(
    retrievedRelevantCount: number,
    totalKnownRelevantCount: number
  ): number {
    if (totalKnownRelevantCount <= 0) return 1.0;
    return Number((Math.min(1.0, retrievedRelevantCount / totalKnownRelevantCount)).toFixed(4));
  }

  /**
   * Mean Reciprocal Rank (MRR) for a single query.
   * Reciprocal rank of the first returned item with grade >= minimumRelevantGrade.
   */
  public static calculateMRR(grades: number[], k: number = 10, minimumRelevantGrade: number = 2): number {
    const slice = grades.slice(0, k);
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] >= minimumRelevantGrade) {
        return Number((1 / (i + 1)).toFixed(4));
      }
    }
    return 0;
  }

  /**
   * Hard Constraint Violation Rate in top K.
   * Fraction of top K recommendations that violate any mandatory requirement.
   */
  public static calculateHardViolationRate(violationsInTopK: number, topKCount: number): number {
    if (topKCount <= 0) return 0;
    return Number((violationsInTopK / topKCount).toFixed(4));
  }
}

// =============================================================================
// Standalone Functional Exports
// =============================================================================

export const calculateSetMetrics = (expected: string[] | null | undefined, actual: string[] | null | undefined) =>
  MetricCalculators.calculateSetMetrics(expected, actual);

export const calculateDCG = (grades: number[], k: number = 10) =>
  MetricCalculators.calculateDCG(grades, k);

export const calculateNDCGAtK = (returnedGrades: number[], k: number = 10, allGrades?: number[]) =>
  MetricCalculators.calculateNDCG(returnedGrades, allGrades, k);

export const calculatePrecisionAtK = (grades: number[], minimumRelevantGrade: number = 2, k: number = 10) =>
  MetricCalculators.calculatePrecisionAtK(grades, k, minimumRelevantGrade);

export const calculateRecallAtK = (retrievedRelevantCount: number, totalKnownRelevantCount: number, k: number = 10) =>
  MetricCalculators.calculateRecallAtK(retrievedRelevantCount, totalKnownRelevantCount);

export const calculateMRR = (grades: number[], minimumRelevantGrade: number = 2, k: number = 10) =>
  MetricCalculators.calculateMRR(grades, k, minimumRelevantGrade);

export const calculateHardConstraintViolationRate = (violationFlags: boolean[]) => {
  const count = violationFlags.filter((v) => v).length;
  return MetricCalculators.calculateHardViolationRate(count, violationFlags.length);
};

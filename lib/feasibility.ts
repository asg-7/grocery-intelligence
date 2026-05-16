/**
 * Feasibility Scorer
 *
 * Evaluates how well a set of requested grocery items can be fulfilled
 * by the available product catalog. Produces a 0–1 score with warnings.
 *
 * Scoring factors:
 *   - Match rate: what % of items found a product match
 *   - Confidence quality: average similarity score across matches
 *   - Low-confidence penalty: items matched but with weak similarity
 */

export interface MatchedItem {
  original: string;
  item: string;
  matched_product: string | null;
  confidence: number | null;
  product_id: string | null;
}

export interface FeasibilityResult {
  score: number;          // 0.0 – 1.0
  total_items: number;
  matched_items: number;
  unmatched_items: number;
  avg_confidence: number;
  warnings: string[];
}

// ─── Thresholds ────────────────────────────────────────────────────────
const HIGH_CONFIDENCE = 0.5;   // Above this = strong match
const LOW_CONFIDENCE  = 0.3;   // Below this = weak / dubious match
const MIN_SCORE_FLOOR = 0.05;  // Never return exactly 0 unless truly empty

/**
 * Compute a feasibility score for a set of matched cart items.
 *
 * @param items - Array of items with their match results from vector search
 * @returns FeasibilityResult with score and diagnostics
 */
export function computeFeasibility(items: MatchedItem[]): FeasibilityResult {
  if (items.length === 0) {
    return {
      score: 0,
      total_items: 0,
      matched_items: 0,
      unmatched_items: 0,
      avg_confidence: 0,
      warnings: ["Empty item list — nothing to score."],
    };
  }

  const warnings: string[] = [];

  // ── Partition items ──────────────────────────────────────────────────
  const matched = items.filter((i) => i.matched_product !== null && i.confidence !== null);
  const unmatched = items.filter((i) => i.matched_product === null || i.confidence === null);

  const matchRate = matched.length / items.length;

  // ── Confidence analysis ──────────────────────────────────────────────
  const confidences = matched.map((i) => i.confidence!);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0;

  const lowConfidenceItems = matched.filter((i) => i.confidence! < LOW_CONFIDENCE);
  const highConfidenceItems = matched.filter((i) => i.confidence! >= HIGH_CONFIDENCE);

  // ── Generate warnings ────────────────────────────────────────────────
  if (unmatched.length > 0) {
    const names = unmatched.map((i) => `"${i.item}"`).join(", ");
    warnings.push(`${unmatched.length} item(s) could not be matched: ${names}`);
  }

  if (lowConfidenceItems.length > 0) {
    const names = lowConfidenceItems.map((i) => `"${i.item}" (${i.confidence})`).join(", ");
    warnings.push(`${lowConfidenceItems.length} item(s) have low-confidence matches: ${names}`);
  }

  if (matchRate < 0.5) {
    warnings.push("Less than half of the items could be matched — consider expanding the product catalog.");
  }

  if (avgConfidence > 0 && avgConfidence < LOW_CONFIDENCE) {
    warnings.push("Overall match quality is poor — results may not reflect what you need.");
  }

  // ── Compute composite score ──────────────────────────────────────────
  // Weight: 60% match coverage, 40% match quality
  const coverageScore = matchRate;
  const qualityScore = avgConfidence;  // Already 0–1 (cosine similarity)

  let score = (coverageScore * 0.6) + (qualityScore * 0.4);

  // Bonus for high-confidence ratio
  if (matched.length > 0) {
    const highRatio = highConfidenceItems.length / matched.length;
    score += highRatio * 0.05;  // Up to 5% bonus
  }

  // Clamp to [0, 1]
  score = Math.max(0, Math.min(1, score));
  score = Math.round(score * 100) / 100;

  return {
    score,
    total_items: items.length,
    matched_items: matched.length,
    unmatched_items: unmatched.length,
    avg_confidence: Math.round(avgConfidence * 100) / 100,
    warnings,
  };
}

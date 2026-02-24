/**
 * Trending score computation for Deep-Tech Pulse.
 *
 * Formula:
 *   trendingScore = normalize(externalSignal) * 0.6
 *                 + relevanceScore * 0.3
 *                 + recencyBoost * 0.1
 *
 * All three component values are on a 0–100 scale before weighting,
 * so the final score is also in [0, 100].
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimum subset of an article row required by computeTrendingScore. */
export interface TrendingInput {
  /** YouTube view count, HN points, or 0 for RSS articles without signals. */
  externalSignal: number | null | undefined;
  /** 0–100 relevance score assigned by the AI summarizer. */
  relevanceScore: number;
  /** Unix millisecond timestamp when the article was originally published. */
  publishedAt: number;
}

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Max external signal value used as the 100-point ceiling.
 *
 * YouTube videos with 100 000+ views are considered maximally viral for this
 * niche audience. Values above the cap are clamped to 100.
 */
const SIGNAL_CAP = 100_000;

/**
 * Maps a raw external signal (e.g. YouTube view count) to a 0–100 scale.
 *
 * - 0 views        → 0
 * - 100 000+ views → 100
 * - Values between are linearly interpolated.
 * - Negative values are clamped to 0.
 */
export function normalizeSignal(signal: number): number {
  if (signal <= 0) return 0;
  if (signal >= SIGNAL_CAP) return 100;
  return (signal / SIGNAL_CAP) * 100;
}

// ── Recency boost ─────────────────────────────────────────────────────────────

const ONE_HOUR_MS = 60 * 60 * 1_000;
const DECAY_ZERO_H = 24; // reaches 0 at 24 hours

/**
 * Computes a recency boost that decays linearly over 24 hours.
 *
 * - 0 hours old → 100
 * - 12 hours old → 50
 * - 24+ hours old → 0
 *
 * @param publishedAt Unix millisecond timestamp of the article's publish date.
 * @param nowMs       Current time in Unix milliseconds (injectable for testing).
 */
export function computeRecencyBoost(publishedAt: number, nowMs = Date.now()): number {
  const ageMs = nowMs - publishedAt;
  if (ageMs <= 0) return 100; // future-dated or same-millisecond publish

  const ageHours = ageMs / ONE_HOUR_MS;

  if (ageHours >= DECAY_ZERO_H) return 0;

  // Linear decay: 100 at 0h, 50 at 12h, 0 at 24h
  // Slope: -100 / 24 points per hour
  const boost = 100 * (1 - ageHours / DECAY_ZERO_H);
  return Math.max(0, boost);
}

// ── Weighted composite ────────────────────────────────────────────────────────

/** Weights must sum to 1.0 */
const WEIGHT_SIGNAL = 0.6;
const WEIGHT_RELEVANCE = 0.3;
const WEIGHT_RECENCY = 0.1;

/**
 * Computes the composite trending score for a single article.
 *
 * The score is in the range [0, 100] and is suitable for direct storage in
 * the `trending_score` column of the articles table.
 *
 * @param article An object carrying the three required fields.
 * @param nowMs   Current time override for testability (defaults to Date.now()).
 */
export function computeTrendingScore(article: TrendingInput, nowMs = Date.now()): number {
  const signal = article.externalSignal ?? 0;
  const relevance = article.relevanceScore ?? 0;

  const normalizedSignal = normalizeSignal(signal);
  const recencyBoost = computeRecencyBoost(article.publishedAt, nowMs);

  // Clamp relevanceScore to 0–100 in case of bad data from the AI layer
  const clampedRelevance = Math.min(100, Math.max(0, relevance));

  const score =
    normalizedSignal * WEIGHT_SIGNAL +
    clampedRelevance * WEIGHT_RELEVANCE +
    recencyBoost * WEIGHT_RECENCY;

  // Round to two decimal places to avoid floating-point noise in storage
  return Math.round(score * 100) / 100;
}

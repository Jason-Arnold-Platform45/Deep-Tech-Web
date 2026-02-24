import { describe, it, expect } from "vitest";
import {
  normalizeSignal,
  computeRecencyBoost,
  computeTrendingScore,
  type TrendingInput,
} from "../../../src/lib/utils/trending";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ONE_HOUR_MS = 60 * 60 * 1_000;
const NOW = 1_700_000_000_000; // fixed reference timestamp (ms)

function makeArticle(overrides: Partial<TrendingInput> = {}): TrendingInput {
  return {
    externalSignal: 0,
    relevanceScore: 50,
    publishedAt: NOW, // "just published" by default
    ...overrides,
  };
}

// ── normalizeSignal ───────────────────────────────────────────────────────────

describe("normalizeSignal", () => {
  it("returns 0 for zero signal", () => {
    expect(normalizeSignal(0)).toBe(0);
  });

  it("returns 0 for negative signal", () => {
    expect(normalizeSignal(-500)).toBe(0);
  });

  it("returns 100 for the cap value (100 000)", () => {
    expect(normalizeSignal(100_000)).toBe(100);
  });

  it("returns 100 for values above the cap", () => {
    expect(normalizeSignal(500_000)).toBe(100);
    expect(normalizeSignal(1_000_000)).toBe(100);
  });

  it("returns 50 for exactly half the cap (50 000)", () => {
    expect(normalizeSignal(50_000)).toBe(50);
  });

  it("returns 10 for 10 000 views", () => {
    expect(normalizeSignal(10_000)).toBe(10);
  });

  it("returns a value between 0 and 100 for mid-range inputs", () => {
    const result = normalizeSignal(25_000);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
    expect(result).toBe(25);
  });

  it("output is always in [0, 100]", () => {
    const values = [0, 1, 999, 10_000, 50_000, 99_999, 100_000, 200_000];
    for (const v of values) {
      const result = normalizeSignal(v);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    }
  });
});

// ── computeRecencyBoost ───────────────────────────────────────────────────────

describe("computeRecencyBoost", () => {
  it("returns 100 for a freshly published article (0 hours old)", () => {
    expect(computeRecencyBoost(NOW, NOW)).toBe(100);
  });

  it("returns 100 for a future-dated article (negative age)", () => {
    expect(computeRecencyBoost(NOW + ONE_HOUR_MS, NOW)).toBe(100);
  });

  it("returns 50 for an article exactly 12 hours old", () => {
    const publishedAt = NOW - 12 * ONE_HOUR_MS;
    const result = computeRecencyBoost(publishedAt, NOW);
    expect(result).toBeCloseTo(50, 5);
  });

  it("returns 0 for an article exactly 24 hours old", () => {
    const publishedAt = NOW - 24 * ONE_HOUR_MS;
    const result = computeRecencyBoost(publishedAt, NOW);
    expect(result).toBe(0);
  });

  it("returns 0 for an article older than 24 hours", () => {
    const publishedAt = NOW - 48 * ONE_HOUR_MS;
    expect(computeRecencyBoost(publishedAt, NOW)).toBe(0);
  });

  it("returns 0 for very old content (7 days)", () => {
    const publishedAt = NOW - 7 * 24 * ONE_HOUR_MS;
    expect(computeRecencyBoost(publishedAt, NOW)).toBe(0);
  });

  it("returns 75 for an article exactly 6 hours old", () => {
    const publishedAt = NOW - 6 * ONE_HOUR_MS;
    const result = computeRecencyBoost(publishedAt, NOW);
    expect(result).toBeCloseTo(75, 5);
  });

  it("decays monotonically from 100 to 0 over 24 hours", () => {
    const samples = [0, 4, 8, 12, 16, 20, 24];
    let previous = 101; // start above max so first comparison succeeds
    for (const hours of samples) {
      const publishedAt = NOW - hours * ONE_HOUR_MS;
      const result = computeRecencyBoost(publishedAt, NOW);
      expect(result).toBeLessThanOrEqual(previous);
      previous = result;
    }
  });

  it("output is always in [0, 100]", () => {
    const ages = [-1, 0, 1, 6, 12, 18, 24, 48, 720]; // hours
    for (const h of ages) {
      const publishedAt = NOW - h * ONE_HOUR_MS;
      const result = computeRecencyBoost(publishedAt, NOW);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    }
  });
});

// ── computeTrendingScore ──────────────────────────────────────────────────────

describe("computeTrendingScore", () => {
  it("returns 0 for an article with zero signal, zero relevance, and old content", () => {
    const article = makeArticle({
      externalSignal: 0,
      relevanceScore: 0,
      publishedAt: NOW - 48 * ONE_HOUR_MS, // older than 24h → recency = 0
    });
    expect(computeTrendingScore(article, NOW)).toBe(0);
  });

  it("returns a perfect score for max signal, max relevance, and fresh content", () => {
    const article = makeArticle({
      externalSignal: 100_000,
      relevanceScore: 100,
      publishedAt: NOW, // 0 hours old → recency = 100
    });
    // 100*0.6 + 100*0.3 + 100*0.1 = 100
    expect(computeTrendingScore(article, NOW)).toBe(100);
  });

  it("weights correctly with known inputs (spot-check)", () => {
    // signal=50000 → normalized=50; relevance=70; recency: 12h old → 50
    // score = 50*0.6 + 70*0.3 + 50*0.1 = 30 + 21 + 5 = 56
    const article = makeArticle({
      externalSignal: 50_000,
      relevanceScore: 70,
      publishedAt: NOW - 12 * ONE_HOUR_MS,
    });
    expect(computeTrendingScore(article, NOW)).toBeCloseTo(56, 1);
  });

  it("treats null externalSignal as zero signal", () => {
    const withNull = makeArticle({ externalSignal: null, relevanceScore: 0, publishedAt: NOW - 48 * ONE_HOUR_MS });
    const withZero = makeArticle({ externalSignal: 0, relevanceScore: 0, publishedAt: NOW - 48 * ONE_HOUR_MS });
    expect(computeTrendingScore(withNull, NOW)).toBe(computeTrendingScore(withZero, NOW));
  });

  it("treats undefined externalSignal as zero signal", () => {
    const withUndefined = makeArticle({ externalSignal: undefined, relevanceScore: 0, publishedAt: NOW - 48 * ONE_HOUR_MS });
    const withZero = makeArticle({ externalSignal: 0, relevanceScore: 0, publishedAt: NOW - 48 * ONE_HOUR_MS });
    expect(computeTrendingScore(withUndefined, NOW)).toBe(computeTrendingScore(withZero, NOW));
  });

  it("clamps relevanceScore above 100 to 100", () => {
    const clamped = makeArticle({ externalSignal: 0, relevanceScore: 200, publishedAt: NOW - 48 * ONE_HOUR_MS });
    const max = makeArticle({ externalSignal: 0, relevanceScore: 100, publishedAt: NOW - 48 * ONE_HOUR_MS });
    // Both should produce the same score since 200 clamps to 100
    expect(computeTrendingScore(clamped, NOW)).toBe(computeTrendingScore(max, NOW));
  });

  it("clamps relevanceScore below 0 to 0", () => {
    const negative = makeArticle({ externalSignal: 0, relevanceScore: -50, publishedAt: NOW - 48 * ONE_HOUR_MS });
    const zero = makeArticle({ externalSignal: 0, relevanceScore: 0, publishedAt: NOW - 48 * ONE_HOUR_MS });
    expect(computeTrendingScore(negative, NOW)).toBe(computeTrendingScore(zero, NOW));
  });

  it("returns a number in [0, 100] for all edge inputs", () => {
    const scenarios: TrendingInput[] = [
      makeArticle({ externalSignal: 0, relevanceScore: 0, publishedAt: NOW - 100 * ONE_HOUR_MS }),
      makeArticle({ externalSignal: 100_000, relevanceScore: 100, publishedAt: NOW }),
      makeArticle({ externalSignal: 1_000_000, relevanceScore: 200, publishedAt: NOW + ONE_HOUR_MS }),
      makeArticle({ externalSignal: -999, relevanceScore: -999, publishedAt: NOW - 999 * ONE_HOUR_MS }),
      makeArticle({ externalSignal: null, relevanceScore: 50, publishedAt: NOW }),
    ];
    for (const article of scenarios) {
      const score = computeTrendingScore(article, NOW);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("recency boost contributes 10 % of total when other components are zero", () => {
    // externalSignal=0 → 0; relevanceScore=0 → 0; fresh article → recency=100
    // score = 0*0.6 + 0*0.3 + 100*0.1 = 10
    const article = makeArticle({
      externalSignal: 0,
      relevanceScore: 0,
      publishedAt: NOW,
    });
    expect(computeTrendingScore(article, NOW)).toBeCloseTo(10, 5);
  });

  it("signal contributes 60 % of total when other components are zero and old", () => {
    // externalSignal=100000 → normalized=100; relevance=0; 24h+ old → recency=0
    // score = 100*0.6 + 0*0.3 + 0*0.1 = 60
    const article = makeArticle({
      externalSignal: 100_000,
      relevanceScore: 0,
      publishedAt: NOW - 24 * ONE_HOUR_MS,
    });
    expect(computeTrendingScore(article, NOW)).toBeCloseTo(60, 5);
  });

  it("relevance contributes 30 % of total when other components are zero and old", () => {
    // externalSignal=0 → 0; relevance=100; 24h+ old → recency=0
    // score = 0*0.6 + 100*0.3 + 0*0.1 = 30
    const article = makeArticle({
      externalSignal: 0,
      relevanceScore: 100,
      publishedAt: NOW - 24 * ONE_HOUR_MS,
    });
    expect(computeTrendingScore(article, NOW)).toBeCloseTo(30, 5);
  });

  it("returns a rounded two-decimal-place value", () => {
    // score = 25*0.6 + 33*0.3 + 75*0.1
    //       = 15 + 9.9 + 7.5 = 32.4
    const article = makeArticle({
      externalSignal: 25_000,
      relevanceScore: 33,
      publishedAt: NOW - 6 * ONE_HOUR_MS, // 6h → recency=75
    });
    const score = computeTrendingScore(article, NOW);
    // verify it's a number with at most 2 decimal places
    expect(score).toBeCloseTo(32.4, 1);
    const decimals = (score.toString().split(".")[1] ?? "").length;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

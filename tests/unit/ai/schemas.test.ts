/**
 * Unit tests for src/lib/ai/schemas.ts
 *
 * Covers:
 *   - Valid complete objects pass ArticleAnalysisSchema
 *   - Field-level constraint violations (string length, enum values, int/range)
 *   - Malformed JSON string handling upstream of schema (parse → validate)
 *   - Partial objects (missing required fields)
 *   - RELEVANCE_THRESHOLD constant is exported with the expected value
 */

import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  ArticleAnalysisSchema,
  RELEVANCE_THRESHOLD,
} from "../../../src/lib/ai/schemas";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function validPayload() {
  return {
    summary:
      "Claude 3 Haiku now supports a 200K context window, enabling entire codebases to be analyzed in a single prompt.",
    whyItMatters:
      "Agentic coding tools can ingest full project context without chunking.",
    urgency: "use_now" as const,
    category: "model_release" as const,
    relevanceScore: 92,
    isGenericAINoise: false,
    contentSafe: true,
  };
}

// ---------------------------------------------------------------------------
// Happy-path tests
// ---------------------------------------------------------------------------

describe("ArticleAnalysisSchema — valid data", () => {
  it("accepts a fully valid payload", () => {
    const result = ArticleAnalysisSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("accepts all urgency enum values", () => {
    const urgencies = ["use_now", "watch_this_week", "coming_soon"] as const;
    for (const urgency of urgencies) {
      const result = ArticleAnalysisSchema.safeParse({
        ...validPayload(),
        urgency,
      });
      expect(result.success, `urgency "${urgency}" should be valid`).toBe(true);
    }
  });

  it("accepts all category enum values", () => {
    const categories = [
      "model_release",
      "tools",
      "research",
      "industry_moves",
    ] as const;
    for (const category of categories) {
      const result = ArticleAnalysisSchema.safeParse({
        ...validPayload(),
        category,
      });
      expect(result.success, `category "${category}" should be valid`).toBe(
        true
      );
    }
  });

  it("accepts relevanceScore at boundary values 0 and 100", () => {
    expect(
      ArticleAnalysisSchema.safeParse({ ...validPayload(), relevanceScore: 0 })
        .success
    ).toBe(true);
    expect(
      ArticleAnalysisSchema.safeParse({
        ...validPayload(),
        relevanceScore: 100,
      }).success
    ).toBe(true);
  });

  it("accepts summary at minimum length (20 chars)", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      summary: "A".repeat(20),
    });
    expect(result.success).toBe(true);
  });

  it("accepts summary at maximum length (500 chars)", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      summary: "A".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("accepts whyItMatters at minimum length (10 chars)", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      whyItMatters: "A".repeat(10),
    });
    expect(result.success).toBe(true);
  });

  it("accepts whyItMatters at maximum length (200 chars)", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      whyItMatters: "A".repeat(200),
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// String length constraints
// ---------------------------------------------------------------------------

describe("ArticleAnalysisSchema — string length violations", () => {
  it("rejects summary shorter than 20 chars", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      summary: "Too short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("summary");
    }
  });

  it("rejects summary longer than 500 chars", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      summary: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects whyItMatters shorter than 10 chars", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      whyItMatters: "Short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("whyItMatters");
    }
  });

  it("rejects whyItMatters longer than 200 chars", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      whyItMatters: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Enum violations
// ---------------------------------------------------------------------------

describe("ArticleAnalysisSchema — enum violations", () => {
  it("rejects an invalid urgency value", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      urgency: "right_now",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("urgency");
    }
  });

  it("rejects an invalid category value", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      category: "entertainment",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("category");
    }
  });

  it("rejects urgency with wrong casing", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      urgency: "Use_Now",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Numeric range constraints
// ---------------------------------------------------------------------------

describe("ArticleAnalysisSchema — numeric constraints", () => {
  it("rejects relevanceScore below 0", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      relevanceScore: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("relevanceScore");
    }
  });

  it("rejects relevanceScore above 100", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      relevanceScore: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer relevanceScore", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      relevanceScore: 75.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("relevanceScore");
    }
  });

  it("rejects relevanceScore as a string", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      relevanceScore: "75",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Boolean fields
// ---------------------------------------------------------------------------

describe("ArticleAnalysisSchema — boolean field validation", () => {
  it('rejects isGenericAINoise as a string "true"', () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      isGenericAINoise: "true",
    });
    expect(result.success).toBe(false);
  });

  it("rejects contentSafe as null", () => {
    const result = ArticleAnalysisSchema.safeParse({
      ...validPayload(),
      contentSafe: null,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Partial / missing fields
// ---------------------------------------------------------------------------

describe("ArticleAnalysisSchema — missing fields", () => {
  it("rejects an object missing 'summary'", () => {
    const { summary: _s, ...rest } = validPayload();
    const result = ArticleAnalysisSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("summary");
    }
  });

  it("rejects an object missing 'urgency' and 'category'", () => {
    const { urgency: _u, category: _c, ...rest } = validPayload();
    const result = ArticleAnalysisSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("urgency");
      expect(paths).toContain("category");
    }
  });

  it("rejects an empty object", () => {
    const result = ArticleAnalysisSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects null", () => {
    const result = ArticleAnalysisSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Simulating malformed LLM JSON (parse upstream, validate with schema)
// ---------------------------------------------------------------------------

describe("ArticleAnalysisSchema — malformed JSON simulation", () => {
  it("schema rejects a parsed object with wrong types even if JSON was valid", () => {
    // Simulate LLM returning wrong types despite valid JSON structure
    const malformed = JSON.parse(
      JSON.stringify({
        summary: "Short", // too short
        whyItMatters: 12345, // wrong type
        urgency: "immediately",
        category: "misc",
        relevanceScore: "high",
        isGenericAINoise: "yes",
        contentSafe: 1,
      })
    );
    const result = ArticleAnalysisSchema.safeParse(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should have multiple issues
      expect(result.error.issues.length).toBeGreaterThan(1);
    }
  });

  it("schema correctly validates a well-formed parsed object", () => {
    const json = JSON.stringify(validPayload());
    const parsed = JSON.parse(json);
    const result = ArticleAnalysisSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RELEVANCE_THRESHOLD constant
// ---------------------------------------------------------------------------

describe("RELEVANCE_THRESHOLD", () => {
  it("is exported and equals 40", () => {
    expect(RELEVANCE_THRESHOLD).toBe(40);
  });
});

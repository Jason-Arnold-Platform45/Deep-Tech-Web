/**
 * Unit tests for src/lib/ai/prompts.ts
 *
 * Covers:
 *   - buildSummarizationPrompt: structure, required content, no hallucination
 *     hints, content truncation contract
 *   - buildRetryPrompt: includes schema hint, references previous output
 *   - resolveDisplayDecision: noise filtering and quarantine rules
 */

import { describe, it, expect } from "vitest";
import {
  buildSummarizationPrompt,
  buildRetryPrompt,
  resolveDisplayDecision,
  type DisplayDecision,
} from "../../../src/lib/ai/prompts";

// ---------------------------------------------------------------------------
// buildSummarizationPrompt
// ---------------------------------------------------------------------------

describe("buildSummarizationPrompt", () => {
  const title = "Claude 3 Haiku Now Available with 200K Context";
  const content =
    "Anthropic today released Claude 3 Haiku to general availability. " +
    "The model supports a 200K token context window, making it possible to " +
    "analyze an entire codebase in a single API call. Pricing starts at $0.25 " +
    "per million input tokens, making it the most cost-effective model in the " +
    "Claude 3 family.";

  it("includes the article title verbatim", () => {
    const prompt = buildSummarizationPrompt(title, content);
    expect(prompt).toContain(title);
  });

  it("includes the article content verbatim", () => {
    const prompt = buildSummarizationPrompt(title, content);
    expect(prompt).toContain(content);
  });

  it("instructs the LLM to use only facts from the article (extractive only)", () => {
    const prompt = buildSummarizationPrompt(title, content);
    // Must include instructions preventing external knowledge injection
    expect(prompt.toLowerCase()).toMatch(
      /only facts|only information|do not add|not add external|use only/
    );
  });

  it("references agentic coding relevance", () => {
    const prompt = buildSummarizationPrompt(title, content);
    expect(prompt.toLowerCase()).toMatch(
      /agentic.coding|agentic coding|code generation|ai.assisted|developer tool|ai ide/
    );
  });

  it("includes all required JSON field names in the schema reference", () => {
    const prompt = buildSummarizationPrompt(title, content);
    const requiredFields = [
      "summary",
      "whyItMatters",
      "urgency",
      "category",
      "relevanceScore",
      "isGenericAINoise",
      "contentSafe",
    ];
    for (const field of requiredFields) {
      expect(prompt, `missing field "${field}" in prompt schema`).toContain(
        field
      );
    }
  });

  it("includes all urgency enum values", () => {
    const prompt = buildSummarizationPrompt(title, content);
    expect(prompt).toContain("use_now");
    expect(prompt).toContain("watch_this_week");
    expect(prompt).toContain("coming_soon");
  });

  it("includes all category enum values", () => {
    const prompt = buildSummarizationPrompt(title, content);
    expect(prompt).toContain("model_release");
    expect(prompt).toContain("tools");
    expect(prompt).toContain("research");
    expect(prompt).toContain("industry_moves");
  });

  it("instructs the LLM to return only JSON", () => {
    const prompt = buildSummarizationPrompt(title, content);
    expect(prompt.toLowerCase()).toMatch(/only.*json|return.*json|respond.*json/);
  });

  it("includes content safety instructions", () => {
    const prompt = buildSummarizationPrompt(title, content);
    expect(prompt.toLowerCase()).toMatch(/content.safe|contentSafe|safety/i);
  });

  it("returns a non-empty string for empty content", () => {
    const prompt = buildSummarizationPrompt(title, "");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain(title);
  });

  it("handles titles with special characters without throwing", () => {
    const specialTitle =
      'GPT-5 "Orion" leaked: 10x performance gain for <code>generation</code>';
    expect(() =>
      buildSummarizationPrompt(specialTitle, content)
    ).not.toThrow();
    const prompt = buildSummarizationPrompt(specialTitle, content);
    expect(prompt).toContain(specialTitle);
  });
});

// ---------------------------------------------------------------------------
// buildRetryPrompt
// ---------------------------------------------------------------------------

describe("buildRetryPrompt", () => {
  const title = "New Cursor AI IDE Feature Automates Refactoring";
  const content =
    "Cursor released a new refactoring agent that can autonomously restructure " +
    "TypeScript codebases. The feature uses Claude 3.5 Sonnet under the hood and " +
    "is available to all Pro subscribers.";
  const previousBadOutput =
    '{"summary": "short", "urgency": "right_now", "score": 99}';

  it("includes the previous (invalid) output", () => {
    const prompt = buildRetryPrompt(title, content, previousBadOutput);
    // Truncated to 300 chars in implementation
    expect(prompt).toContain(previousBadOutput.slice(0, 200));
  });

  it("includes all required JSON field names in the schema hint", () => {
    const prompt = buildRetryPrompt(title, content, previousBadOutput);
    const requiredFields = [
      "summary",
      "whyItMatters",
      "urgency",
      "category",
      "relevanceScore",
      "isGenericAINoise",
      "contentSafe",
    ];
    for (const field of requiredFields) {
      expect(prompt, `retry prompt missing field "${field}"`).toContain(field);
    }
  });

  it("includes length constraints in the schema hint", () => {
    const prompt = buildRetryPrompt(title, content, previousBadOutput);
    // Should mention character limits for summary/whyItMatters
    expect(prompt).toMatch(/20.{0,10}500|500.{0,10}20/); // "20–500" or "500" near "20"
  });

  it("includes the article title", () => {
    const prompt = buildRetryPrompt(title, content, previousBadOutput);
    expect(prompt).toContain(title);
  });

  it("includes the article content", () => {
    const prompt = buildRetryPrompt(title, content, previousBadOutput);
    expect(prompt).toContain(content);
  });

  it("instructs the LLM to return only JSON (no markdown)", () => {
    const prompt = buildRetryPrompt(title, content, previousBadOutput);
    expect(prompt.toLowerCase()).toMatch(/only.*json|no markdown|no prose/);
  });

  it("handles a very long previousOutput by truncating gracefully", () => {
    const longOutput = "x".repeat(5000);
    expect(() =>
      buildRetryPrompt(title, content, longOutput)
    ).not.toThrow();
    const prompt = buildRetryPrompt(title, content, longOutput);
    // Previous output is sliced to 300 chars in implementation
    const longOutputOccurrences = (
      prompt.match(new RegExp("x{301,}", "g")) ?? []
    ).length;
    expect(longOutputOccurrences).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveDisplayDecision — noise filtering and quarantine
// ---------------------------------------------------------------------------

describe("resolveDisplayDecision", () => {
  function makeAnalysis(overrides: {
    relevanceScore?: number;
    isGenericAINoise?: boolean;
    contentSafe?: boolean;
  }) {
    return {
      relevanceScore: 80,
      isGenericAINoise: false,
      contentSafe: true,
      ...overrides,
    };
  }

  // ---- display: true cases ------------------------------------------------

  it("returns display: true for a high-relevance, safe, specific article", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ relevanceScore: 80, isGenericAINoise: false, contentSafe: true })
    );
    expect(decision.display).toBe(true);
  });

  it("returns display: true when relevanceScore equals the threshold (40)", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ relevanceScore: 40 })
    );
    expect(decision.display).toBe(true);
  });

  it("returns display: true at relevanceScore 100", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ relevanceScore: 100 })
    );
    expect(decision.display).toBe(true);
  });

  // ---- low relevance -------------------------------------------------------

  it("returns display: false / low_relevance when relevanceScore < 40", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ relevanceScore: 39 })
    );
    expect(decision.display).toBe(false);
    if (!decision.display) {
      expect(decision.reason).toBe("low_relevance");
    }
  });

  it("returns display: false / low_relevance when relevanceScore is 0", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ relevanceScore: 0 })
    );
    expect(decision.display).toBe(false);
    if (!decision.display) {
      expect(decision.reason).toBe("low_relevance");
    }
  });

  // ---- generic AI noise ---------------------------------------------------

  it("returns display: false / generic_noise when isGenericAINoise is true", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ isGenericAINoise: true, relevanceScore: 65 })
    );
    expect(decision.display).toBe(false);
    if (!decision.display) {
      expect(decision.reason).toBe("generic_noise");
    }
  });

  it("excludes generic noise even when relevanceScore is above threshold", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ isGenericAINoise: true, relevanceScore: 90 })
    );
    expect(decision.display).toBe(false);
    if (!decision.display) {
      expect(decision.reason).toBe("generic_noise");
    }
  });

  // ---- content safety / quarantine -----------------------------------------

  it("returns display: false / quarantine when contentSafe is false", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ contentSafe: false })
    );
    expect(decision.display).toBe(false);
    if (!decision.display) {
      expect(decision.reason).toBe("quarantine");
    }
  });

  it("quarantines even when relevanceScore is high", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ contentSafe: false, relevanceScore: 95 })
    );
    expect(decision.display).toBe(false);
    if (!decision.display) {
      expect(decision.reason).toBe("quarantine");
    }
  });

  // ---- priority: quarantine > generic_noise > low_relevance ---------------

  it("prioritizes quarantine over generic_noise when both are true", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ contentSafe: false, isGenericAINoise: true })
    );
    expect(decision.display).toBe(false);
    if (!decision.display) {
      expect(decision.reason).toBe("quarantine");
    }
  });

  it("prioritizes generic_noise over low_relevance when both are true", () => {
    const decision = resolveDisplayDecision(
      makeAnalysis({ isGenericAINoise: true, relevanceScore: 10 })
    );
    expect(decision.display).toBe(false);
    if (!decision.display) {
      // generic_noise is checked before low_relevance per implementation
      expect(decision.reason).toBe("generic_noise");
    }
  });

  // ---- type narrowing: DisplayDecision discriminated union -----------------

  it("DisplayDecision reason field is accessible only when display is false", () => {
    const hidden: DisplayDecision = resolveDisplayDecision(
      makeAnalysis({ relevanceScore: 10 })
    );
    // TypeScript type narrowing — this is a runtime guard test
    if (!hidden.display) {
      expect(["low_relevance", "generic_noise", "quarantine"]).toContain(
        hidden.reason
      );
    }
  });
});

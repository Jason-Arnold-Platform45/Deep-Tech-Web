/**
 * AI provider abstraction.
 *
 * Exports:
 *   - AIProvider interface
 *   - getAIProvider()            — returns the configured primary provider
 *   - summarizeWithFallback()    — Claude → OpenAI → null with Zod retry logic
 */

import { ArticleAnalysisSchema, type ArticleAnalysis } from "@/lib/ai/schemas";
import { resolveDisplayDecision, type DisplayDecision } from "@/lib/ai/prompts";

// Re-export so callers have a single import path
export type { ArticleAnalysis, DisplayDecision };
export { resolveDisplayDecision };

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AIProvider {
  /**
   * Summarize an article and return a validated ArticleAnalysis.
   * Throws on unrecoverable errors (network, auth). Returns null when the
   * LLM output cannot be validated after one retry.
   */
  summarize(content: string, title: string): Promise<ArticleAnalysis | null>;
}

// ---------------------------------------------------------------------------
// Lazy provider singletons
// ---------------------------------------------------------------------------

let _claudeProvider: AIProvider | null = null;
let _openaiProvider: AIProvider | null = null;

/** Returns the Claude Haiku provider, initializing it on first call. */
export function getAIProvider(): AIProvider {
  if (!_claudeProvider) {
    // Dynamic require keeps the import lazy so tests can mock the SDK module
    // before the module is evaluated.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClaudeProvider } = require("@/lib/ai/claude") as {
      ClaudeProvider: new () => AIProvider;
    };
    _claudeProvider = new ClaudeProvider();
  }
  return _claudeProvider;
}

/** Returns the OpenAI GPT-4o-mini provider, initializing it on first call. */
export function getOpenAIProvider(): AIProvider {
  if (!_openaiProvider) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAIProvider } = require("@/lib/ai/openai") as {
      OpenAIProvider: new () => AIProvider;
    };
    _openaiProvider = new OpenAIProvider();
  }
  return _openaiProvider;
}

// ---------------------------------------------------------------------------
// Zod parse helper with one retry
// ---------------------------------------------------------------------------

/**
 * Attempts to parse a raw JSON string from an LLM response.
 * Strips markdown code fences if present before parsing.
 */
function extractJSON(raw: string): unknown {
  // Strip ```json ... ``` or ``` ... ``` fences that some models emit
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenceMatch ? fenceMatch[1].trim() : raw.trim();
  return JSON.parse(text);
}

/**
 * Parses and validates the raw LLM output against ArticleAnalysisSchema.
 * Returns the typed result on success, or throws a ZodError / SyntaxError.
 */
function parseAnalysis(raw: string): ArticleAnalysis {
  const parsed = extractJSON(raw);
  return ArticleAnalysisSchema.parse(parsed);
}

// ---------------------------------------------------------------------------
// summarizeWithFallback
// ---------------------------------------------------------------------------

export type SummarizeResult =
  | { ok: true; analysis: ArticleAnalysis }
  | { ok: false; reason: "exhausted" };

/**
 * Summarizes an article with automatic fallback and Zod retry logic.
 *
 * Strategy:
 *   1. Try Claude Haiku (primary).
 *      a. On Zod/parse failure: retry ONCE with a schema hint prompt.
 *      b. Second failure on Claude: fall through to OpenAI.
 *   2. Try OpenAI GPT-4o-mini (fallback).
 *      a. Same retry-once logic.
 *   3. Both exhausted: return null → article stored as unsummarized.
 *
 * Network/auth errors from either provider propagate up; the pipeline runner
 * is responsible for per-source isolation (try/catch wrapping each article).
 */
export async function summarizeWithFallback(
  content: string,
  title: string
): Promise<ArticleAnalysis | null> {
  const { buildSummarizationPrompt, buildRetryPrompt } = await import(
    "@/lib/ai/prompts"
  );

  // ---- helper: attempt summarize via one provider with one Zod retry -----
  async function attemptWithProvider(
    provider: AIProvider,
    providerName: string
  ): Promise<ArticleAnalysis | null> {
    // First attempt — provider is responsible for sending the base prompt
    let raw: string;

    try {
      // Providers expose a low-level rawComplete for retry support
      const p = provider as AIProvider & {
        rawComplete?: (prompt: string) => Promise<string>;
      };

      if (p.rawComplete) {
        // Use rawComplete so we control the prompt on both attempts
        const firstPrompt = buildSummarizationPrompt(title, content);
        raw = await p.rawComplete(firstPrompt);
      } else {
        // Fallback: use the high-level summarize (handles its own prompt)
        const result = await provider.summarize(content, title);
        return result; // already validated
      }
    } catch (err) {
      console.error(`[ai/provider] ${providerName} first attempt error:`, err);
      return null;
    }

    // Validate first response
    try {
      return parseAnalysis(raw);
    } catch {
      console.warn(
        `[ai/provider] ${providerName} first attempt produced invalid JSON — retrying with schema hint`
      );
    }

    // Retry with schema hint prompt
    const p = provider as AIProvider & { rawComplete: (prompt: string) => Promise<string> };
    try {
      const retryPrompt = buildRetryPrompt(title, content, raw);
      const retryRaw = await p.rawComplete(retryPrompt);
      return parseAnalysis(retryRaw);
    } catch (retryErr) {
      console.warn(
        `[ai/provider] ${providerName} retry also failed:`,
        retryErr
      );
      return null;
    }
  }

  // ---- 1. Claude Haiku (primary) -----------------------------------------
  try {
    const claudeResult = await attemptWithProvider(getAIProvider(), "claude");
    if (claudeResult !== null) return claudeResult;
  } catch (err) {
    console.error("[ai/provider] Claude provider threw:", err);
  }

  // ---- 2. OpenAI GPT-4o-mini (fallback) ----------------------------------
  try {
    const openaiResult = await attemptWithProvider(
      getOpenAIProvider(),
      "openai"
    );
    if (openaiResult !== null) return openaiResult;
  } catch (err) {
    console.error("[ai/provider] OpenAI provider threw:", err);
  }

  // ---- 3. Both exhausted — store raw, no summary -------------------------
  console.warn(
    `[ai/provider] Both providers exhausted for article: "${title}" — storing as unsummarized`
  );
  return null;
}

// ---------------------------------------------------------------------------
// Display filter helpers (convenience wrappers for pipeline runner)
// ---------------------------------------------------------------------------

/** Returns true when the article should be shown on the dashboard. */
export function shouldDisplay(analysis: ArticleAnalysis): boolean {
  return resolveDisplayDecision(analysis).display;
}

/** Returns true when the article should be quarantined (stored but hidden). */
export function shouldQuarantine(analysis: ArticleAnalysis): boolean {
  const decision = resolveDisplayDecision(analysis);
  return !decision.display && decision.reason === "quarantine";
}

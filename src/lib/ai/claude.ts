/**
 * Claude Haiku implementation of AIProvider.
 *
 * Model: claude-3-haiku-20240307
 * SDK:   @anthropic-ai/sdk
 * Key:   process.env.ANTHROPIC_API_KEY (server-side only)
 */

import Anthropic from "@anthropic-ai/sdk";

import { ArticleAnalysisSchema, type ArticleAnalysis } from "@/lib/ai/schemas";
import { buildSummarizationPrompt } from "@/lib/ai/prompts";
import type { AIProvider } from "@/lib/ai/provider";

const MODEL = "claude-3-haiku-20240307";
const MAX_TOKENS = 1024;

/** Maximum characters of article content to include in a single prompt.
 *  Keeps total prompt well under Claude's context window even for long posts. */
const MAX_CONTENT_CHARS = 4000;

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "[claude] ANTHROPIC_API_KEY is not set. Add it to your environment."
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Low-level completion — sends an arbitrary prompt string and returns the
   * raw text response. Exposed so provider.ts can build retry prompts without
   * duplicating the HTTP call logic.
   */
  async rawComplete(prompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      throw new Error("[claude] Unexpected response format — no text block");
    }
    return block.text;
  }

  /**
   * High-level summarize — builds the prompt, calls the API, and validates
   * the response against ArticleAnalysisSchema.
   *
   * Returns null when validation fails (provider.ts handles retry via rawComplete).
   */
  async summarize(content: string, title: string): Promise<ArticleAnalysis | null> {
    const truncated = content.slice(0, MAX_CONTENT_CHARS);
    const prompt = buildSummarizationPrompt(title, truncated);

    let raw: string;
    try {
      raw = await this.rawComplete(prompt);
    } catch (err) {
      console.error("[claude] API call failed:", err);
      throw err; // propagate — provider.ts handles fallback
    }

    try {
      // Strip markdown fences some models emit
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const text = fenceMatch ? fenceMatch[1].trim() : raw.trim();
      return ArticleAnalysisSchema.parse(JSON.parse(text));
    } catch {
      console.warn("[claude] Zod validation failed on first attempt");
      return null; // provider.ts will retry via rawComplete
    }
  }
}

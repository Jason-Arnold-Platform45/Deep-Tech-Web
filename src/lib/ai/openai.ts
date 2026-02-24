/**
 * OpenAI GPT-4o-mini implementation of AIProvider.
 *
 * Model: gpt-4o-mini
 * SDK:   openai
 * Key:   process.env.OPENAI_API_KEY (server-side only)
 */

import OpenAI from "openai";

import { ArticleAnalysisSchema, type ArticleAnalysis } from "@/lib/ai/schemas";
import { buildSummarizationPrompt } from "@/lib/ai/prompts";
import type { AIProvider } from "@/lib/ai/provider";

const MODEL = "gpt-4o-mini";
const MAX_TOKENS = 1024;

/** Maximum characters of article content to include in a single prompt. */
const MAX_CONTENT_CHARS = 4000;

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "[openai] OPENAI_API_KEY is not set. Add it to your environment."
      );
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Low-level completion — sends an arbitrary prompt string and returns the
   * raw text response. Exposed so provider.ts can build retry prompts without
   * duplicating the HTTP call logic.
   */
  async rawComplete(prompt: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "system",
          content:
            "You are an expert analyst. Return ONLY valid JSON — no markdown, no prose.",
        },
        { role: "user", content: prompt },
      ],
    });

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error("[openai] Unexpected response — missing message content");
    }
    return choice.message.content;
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
      console.error("[openai] API call failed:", err);
      throw err; // propagate — provider.ts handles fallback
    }

    try {
      // Strip markdown fences some models emit
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const text = fenceMatch ? fenceMatch[1].trim() : raw.trim();
      return ArticleAnalysisSchema.parse(JSON.parse(text));
    } catch {
      console.warn("[openai] Zod validation failed on first attempt");
      return null; // provider.ts will retry via rawComplete
    }
  }
}

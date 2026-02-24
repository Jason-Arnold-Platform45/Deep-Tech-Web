/**
 * Prompts for AI-powered article summarization.
 *
 * All prompts enforce extractive-only summarization — the LLM must use only
 * facts present in the supplied article text and must not inject external
 * knowledge or opinions.
 */

/** The exact JSON shape the LLM must return. Embedded in the prompt so the
 *  model has an unambiguous schema reference. */
const JSON_SCHEMA = `{
  "summary": "string (20–500 chars) — extractive summary of the article",
  "whyItMatters": "string (10–200 chars) — why this matters for agentic coding teams",
  "urgency": "one of: use_now | watch_this_week | coming_soon",
  "category": "one of: model_release | tools | research | industry_moves",
  "relevanceScore": "integer 0–100 — relevance to agentic coding (see rubric below)",
  "isGenericAINoise": "boolean — true if the article is generic AI hype unrelated to agentic coding",
  "contentSafe": "boolean — false if the article contains harmful, illegal, or explicitly inappropriate content"
}`;

/** Rubric inserted into the prompt to calibrate relevanceScore. */
const RELEVANCE_RUBRIC = `Relevance rubric for agentic coding (score 0–100):
- 90–100: Direct improvement to agentic coding workflows (new coding model, agent framework, IDE AI feature, code-generation tool)
- 70–89: Strong indirect relevance (API improvements, token limits, multimodal features used in coding pipelines)
- 50–69: Moderate relevance (general developer tooling, AI safety affecting coding models)
- 30–49: Weak relevance (general AI industry news with minor developer implications)
- 0–29: Noise — consumer AI, entertainment AI, politics, generalized hype with no developer angle`;

/** Urgency rubric inserted into the prompt. */
const URGENCY_RUBRIC = `Urgency rubric:
- use_now: Immediately actionable — a tool/model is available today and improves your workflow
- watch_this_week: Worth monitoring — announced, in beta, or releasing very soon
- coming_soon: Not yet available — research, roadmap, or future announcement`;

/**
 * Builds the primary summarization prompt for a given article.
 *
 * @param title   The article title as retrieved from the source feed.
 * @param content The raw article body text (truncated to ~4000 chars before
 *                being passed here to stay within context limits).
 */
export function buildSummarizationPrompt(title: string, content: string): string {
  return `You are an expert analyst for a small agentic coding team. Your job is to evaluate articles and extract structured summaries.

CRITICAL RULES:
1. Use ONLY facts present in the article text below. Do NOT add external knowledge, opinions, or information not in the article.
2. If the article is unrelated to agentic coding, AI-assisted development, code generation, autonomous coding agents, AI IDEs, or developer tooling — set isGenericAINoise to true and relevanceScore accordingly.
3. Return ONLY valid JSON matching the schema exactly. No markdown fences, no extra keys, no explanations outside the JSON.

${RELEVANCE_RUBRIC}

${URGENCY_RUBRIC}

Content safety rule:
- Set contentSafe to false if the article promotes illegal activity, contains hate speech, explicit sexual content, or is clearly spam/malicious. Set to true for all normal tech news.

ARTICLE TITLE: ${title}

ARTICLE CONTENT:
${content}

Respond with ONLY this JSON object (no other text):
${JSON_SCHEMA}`;
}

/**
 * Builds a retry prompt that includes a schema hint when the first attempt
 * produced malformed or invalid JSON.
 *
 * @param title          The article title.
 * @param content        The raw article body text.
 * @param previousOutput The raw string the LLM returned on the first attempt.
 */
export function buildRetryPrompt(
  title: string,
  content: string,
  previousOutput: string
): string {
  return `Your previous response did not match the required JSON schema. Please try again.

Previous (invalid) response:
${previousOutput.slice(0, 300)}

REQUIRED JSON SCHEMA (return ONLY this structure, no extra keys, no markdown):
${JSON_SCHEMA}

IMPORTANT:
- "summary" must be 20–500 characters
- "whyItMatters" must be 10–200 characters
- "urgency" must be exactly one of: use_now, watch_this_week, coming_soon
- "category" must be exactly one of: model_release, tools, research, industry_moves
- "relevanceScore" must be an integer between 0 and 100
- "isGenericAINoise" must be true or false (boolean)
- "contentSafe" must be true or false (boolean)

${RELEVANCE_RUBRIC}

ARTICLE TITLE: ${title}

ARTICLE CONTENT:
${content}

Respond with ONLY the JSON object:`;
}

/**
 * Determines whether a successfully validated analysis result should be
 * excluded from display.
 *
 * Rules (from spec):
 * - relevanceScore < 40  → exclude from display (too low signal)
 * - isGenericAINoise     → exclude from display
 * - contentSafe === false → quarantine (stored but not displayed)
 *
 * This function returns a classification rather than a boolean so callers can
 * distinguish between "low relevance" and "quarantine" for storage purposes.
 */
export type DisplayDecision =
  | { display: true }
  | { display: false; reason: "low_relevance" | "generic_noise" | "quarantine" };

export function resolveDisplayDecision(analysis: {
  relevanceScore: number;
  isGenericAINoise: boolean;
  contentSafe: boolean;
}): DisplayDecision {
  if (!analysis.contentSafe) {
    return { display: false, reason: "quarantine" };
  }
  if (analysis.isGenericAINoise) {
    return { display: false, reason: "generic_noise" };
  }
  if (analysis.relevanceScore < 40) {
    return { display: false, reason: "low_relevance" };
  }
  return { display: true };
}

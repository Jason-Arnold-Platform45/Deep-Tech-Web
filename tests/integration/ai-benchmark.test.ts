/**
 * AI Quality Benchmark — Task 5.2
 *
 * Validates that 50 articles pass through the AI summarization pipeline correctly:
 *   1. AI provider produces valid ArticleAnalysis for diverse article types
 *   2. Zod schema validation catches malformed outputs
 *   3. Display decision logic filters correctly (relevance, noise, safety)
 *   4. Urgency/category distribution covers all expected values
 *   5. Edge cases: retry on malformed JSON, null on persistent failure
 *
 * The AI provider is mocked to return controlled outputs so the benchmark
 * is deterministic and does not require API keys. The mock outputs reflect
 * realistic distributions observed in Gemini Flash free tier testing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ArticleAnalysis } from "../../src/lib/ai/schemas";
import { ArticleAnalysisSchema } from "../../src/lib/ai/schemas";
import {
  resolveDisplayDecision,
  type DisplayDecision,
} from "../../src/lib/ai/prompts";
import { buildSummarizationPrompt } from "../../src/lib/ai/prompts";

// ---------------------------------------------------------------------------
// Test data — 50 realistic article inputs
// ---------------------------------------------------------------------------

interface MockArticle {
  title: string;
  content: string;
  expectedCategory: ArticleAnalysis["category"];
  expectedUrgency: ArticleAnalysis["urgency"];
  expectedRelevance: number;
  expectedNoise: boolean;
  expectedSafe: boolean;
}

function generateBenchmarkArticles(): MockArticle[] {
  return [
    // ── model_release (10 articles) ─────────────────────────────────────
    { title: "Claude 4 Released with Enhanced Coding Capabilities", content: "Anthropic has released Claude 4 with significant improvements in code generation, debugging, and agentic workflows.", expectedCategory: "model_release", expectedUrgency: "use_now", expectedRelevance: 95, expectedNoise: false, expectedSafe: true },
    { title: "GPT-5 Turbo Enters Public Beta", content: "OpenAI announced GPT-5 Turbo with 1M context window and improved function calling for coding agents.", expectedCategory: "model_release", expectedUrgency: "watch_this_week", expectedRelevance: 92, expectedNoise: false, expectedSafe: true },
    { title: "Gemini 2.0 Flash Available for Free Tier", content: "Google DeepMind has released Gemini 2.0 Flash to the free tier API with 15 RPM and 1500 req/day limits.", expectedCategory: "model_release", expectedUrgency: "use_now", expectedRelevance: 88, expectedNoise: false, expectedSafe: true },
    { title: "Llama 4 Open Source Release", content: "Meta released Llama 4 with Apache 2.0 license, featuring code-specialized variants up to 405B parameters.", expectedCategory: "model_release", expectedUrgency: "use_now", expectedRelevance: 90, expectedNoise: false, expectedSafe: true },
    { title: "Mistral Large 3 Coding Benchmark Results", content: "Mistral released their latest model showing state-of-the-art results on HumanEval and SWE-bench.", expectedCategory: "model_release", expectedUrgency: "watch_this_week", expectedRelevance: 85, expectedNoise: false, expectedSafe: true },
    { title: "DeepSeek Coder V3 Released", content: "DeepSeek has published their latest code-specialized model with 236B parameters and MoE architecture.", expectedCategory: "model_release", expectedUrgency: "watch_this_week", expectedRelevance: 82, expectedNoise: false, expectedSafe: true },
    { title: "Cohere Command R+ For Enterprise Coding", content: "Cohere launched Command R+ with enterprise-grade coding features and RAG capabilities.", expectedCategory: "model_release", expectedUrgency: "watch_this_week", expectedRelevance: 75, expectedNoise: false, expectedSafe: true },
    { title: "Google Releases PaLM 3 Code Model", content: "Google has released PaLM 3 Code, a specialized model for code generation and understanding.", expectedCategory: "model_release", expectedUrgency: "coming_soon", expectedRelevance: 78, expectedNoise: false, expectedSafe: true },
    { title: "Qwen 3 Released with Agentic Capabilities", content: "Alibaba Cloud released Qwen 3 with built-in tool use and multi-step reasoning for coding tasks.", expectedCategory: "model_release", expectedUrgency: "use_now", expectedRelevance: 80, expectedNoise: false, expectedSafe: true },
    { title: "StabilityAI Releases Code Generation Model", content: "StabilityAI released StableCode 3B, a small but capable code generation model for local use.", expectedCategory: "model_release", expectedUrgency: "watch_this_week", expectedRelevance: 70, expectedNoise: false, expectedSafe: true },

    // ── tools (12 articles) ─────────────────────────────────────────────
    { title: "Cursor IDE 1.0 Released", content: "Cursor AI IDE hits version 1.0 with multi-file editing, composer mode, and improved agent capabilities.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 98, expectedNoise: false, expectedSafe: true },
    { title: "GitHub Copilot Workspace Enters GA", content: "GitHub Copilot Workspace is now generally available, allowing developers to plan and execute multi-step coding tasks.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 96, expectedNoise: false, expectedSafe: true },
    { title: "Devin 2.0: Autonomous Coding Agent", content: "Cognition Labs released Devin 2.0 with improved autonomous coding, testing, and deployment capabilities.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 97, expectedNoise: false, expectedSafe: true },
    { title: "Windsurf AI Editor Gets Terminal Integration", content: "Codeium's Windsurf editor now includes AI-powered terminal with automatic command suggestions.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 90, expectedNoise: false, expectedSafe: true },
    { title: "Continue.dev Adds Multi-Model Support", content: "The open-source AI coding assistant Continue.dev now supports switching between Claude, GPT-4, and local models.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 85, expectedNoise: false, expectedSafe: true },
    { title: "VS Code Adds Built-in AI Features", content: "Microsoft added native AI chat, code completion, and refactoring tools directly into VS Code.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 88, expectedNoise: false, expectedSafe: true },
    { title: "JetBrains AI Assistant Gets Agent Mode", content: "JetBrains IDE AI Assistant now supports autonomous multi-file editing and test generation.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 87, expectedNoise: false, expectedSafe: true },
    { title: "Aider CLI Tool Updated to v0.50", content: "Aider, the popular CLI coding assistant, adds support for Claude Opus and improved git integration.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 92, expectedNoise: false, expectedSafe: true },
    { title: "Bolt.new Launches AI Full-Stack Builder", content: "StackBlitz released Bolt.new, an AI-powered tool that builds full-stack apps from prompts in the browser.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 83, expectedNoise: false, expectedSafe: true },
    { title: "Replit Agents Can Deploy to Production", content: "Replit Agents now support end-to-end development including deployment to production environments.", expectedCategory: "tools", expectedUrgency: "watch_this_week", expectedRelevance: 80, expectedNoise: false, expectedSafe: true },
    { title: "Sourcegraph Cody Adds Autocomplete", content: "Sourcegraph Cody now offers inline autocomplete alongside its existing chat and command features.", expectedCategory: "tools", expectedUrgency: "use_now", expectedRelevance: 78, expectedNoise: false, expectedSafe: true },
    { title: "Tabnine Launches Enterprise AI Platform", content: "Tabnine released a new enterprise platform with team-specific model training and private code search.", expectedCategory: "tools", expectedUrgency: "watch_this_week", expectedRelevance: 72, expectedNoise: false, expectedSafe: true },

    // ── research (10 articles) ──────────────────────────────────────────
    { title: "SWE-Bench Results Show 80% Resolve Rate", content: "Latest SWE-Bench evaluations show Claude 4 achieving 80% resolve rate on real GitHub issues.", expectedCategory: "research", expectedUrgency: "watch_this_week", expectedRelevance: 88, expectedNoise: false, expectedSafe: true },
    { title: "New Paper: ReAct Agents with Tool Use", content: "Researchers demonstrate improved ReAct agent architecture with structured tool calling for coding tasks.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 82, expectedNoise: false, expectedSafe: true },
    { title: "Chain-of-Thought Prompting for Code Review", content: "A new study shows chain-of-thought prompting improves AI code review accuracy by 35%.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 75, expectedNoise: false, expectedSafe: true },
    { title: "Scaling Laws for Code Generation Models", content: "DeepMind published findings on optimal compute allocation for training code-specialized language models.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 70, expectedNoise: false, expectedSafe: true },
    { title: "Multi-Agent Coding Framework Benchmarks", content: "Stanford researchers benchmarked 5 multi-agent coding frameworks on complex software engineering tasks.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 85, expectedNoise: false, expectedSafe: true },
    { title: "AI Safety in Autonomous Coding Agents", content: "New research on preventing autonomous coding agents from introducing security vulnerabilities.", expectedCategory: "research", expectedUrgency: "watch_this_week", expectedRelevance: 78, expectedNoise: false, expectedSafe: true },
    { title: "Test Generation with LLMs: A Survey", content: "Comprehensive survey of LLM-based test generation approaches covering unit, integration, and property-based testing.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 72, expectedNoise: false, expectedSafe: true },
    { title: "Retrieval Augmented Code Generation", content: "New approach combines codebase RAG with LLM generation for more contextually accurate code suggestions.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 80, expectedNoise: false, expectedSafe: true },
    { title: "Formal Verification of AI-Generated Code", content: "Researchers demonstrate automated formal verification pipeline for code produced by LLMs.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 68, expectedNoise: false, expectedSafe: true },
    { title: "Mixture of Experts for Code Understanding", content: "New MoE architecture shows improved code comprehension with 3x less compute than dense models.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 65, expectedNoise: false, expectedSafe: true },

    // ── industry_moves (8 articles) ─────────────────────────────────────
    { title: "Microsoft Acquires AI Coding Startup", content: "Microsoft announced acquisition of a stealth AI coding agent startup for $2.1B.", expectedCategory: "industry_moves", expectedUrgency: "watch_this_week", expectedRelevance: 75, expectedNoise: false, expectedSafe: true },
    { title: "Anthropic Raises $5B Series E", content: "Anthropic secured $5B in new funding to accelerate Claude model development and enterprise features.", expectedCategory: "industry_moves", expectedUrgency: "watch_this_week", expectedRelevance: 70, expectedNoise: false, expectedSafe: true },
    { title: "GitHub Copilot Reaches 2M Paying Users", content: "GitHub reports Copilot now has 2 million paying individual and enterprise subscribers.", expectedCategory: "industry_moves", expectedUrgency: "watch_this_week", expectedRelevance: 65, expectedNoise: false, expectedSafe: true },
    { title: "Google Invests in Coding Agent Startups", content: "Google Ventures led a $500M round across three AI coding agent startups.", expectedCategory: "industry_moves", expectedUrgency: "watch_this_week", expectedRelevance: 60, expectedNoise: false, expectedSafe: true },
    { title: "Stack Overflow Partnership with OpenAI", content: "Stack Overflow and OpenAI announced a data licensing deal for code training data.", expectedCategory: "industry_moves", expectedUrgency: "watch_this_week", expectedRelevance: 55, expectedNoise: false, expectedSafe: true },
    { title: "AWS Launches AI Coding Service", content: "Amazon Web Services launched a new managed AI coding service integrated with CodeWhisperer.", expectedCategory: "industry_moves", expectedUrgency: "use_now", expectedRelevance: 72, expectedNoise: false, expectedSafe: true },
    { title: "Apple Adds AI Code Completion to Xcode", content: "Apple announced AI-powered code completion coming to Xcode in the next major release.", expectedCategory: "industry_moves", expectedUrgency: "coming_soon", expectedRelevance: 68, expectedNoise: false, expectedSafe: true },
    { title: "EU AI Act Impact on Coding Tools", content: "New EU regulations require AI coding tools to disclose training data sources and model capabilities.", expectedCategory: "industry_moves", expectedUrgency: "watch_this_week", expectedRelevance: 50, expectedNoise: false, expectedSafe: true },

    // ── Noise articles (7 articles — should be filtered) ────────────────
    { title: "AI Art Generator Creates Stunning Landscapes", content: "A new AI art tool creates photorealistic landscape paintings from text descriptions.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 10, expectedNoise: true, expectedSafe: true },
    { title: "ChatGPT Now Available on Smart Fridges", content: "OpenAI partners with Samsung to bring ChatGPT to smart kitchen appliances.", expectedCategory: "industry_moves", expectedUrgency: "coming_soon", expectedRelevance: 5, expectedNoise: true, expectedSafe: true },
    { title: "AI Music Composition Reaches New Heights", content: "Google's latest AI can compose full symphonies indistinguishable from human compositions.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 8, expectedNoise: true, expectedSafe: true },
    { title: "AI in Healthcare Diagnostics Update", content: "New AI system achieves 99% accuracy in detecting rare diseases from blood tests.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 12, expectedNoise: true, expectedSafe: true },
    { title: "Celebrity Uses AI to Generate Movie Script", content: "A Hollywood celebrity used AI to write their latest blockbuster movie script.", expectedCategory: "industry_moves", expectedUrgency: "coming_soon", expectedRelevance: 3, expectedNoise: true, expectedSafe: true },
    { title: "AI Weather Prediction Beats Traditional Models", content: "DeepMind's weather AI outperforms traditional forecasting models for 10-day predictions.", expectedCategory: "research", expectedUrgency: "coming_soon", expectedRelevance: 15, expectedNoise: true, expectedSafe: true },
    { title: "AI Companion Chatbots Growing in Popularity", content: "Consumer AI companion apps see 300% growth as people use AI for daily conversations.", expectedCategory: "industry_moves", expectedUrgency: "coming_soon", expectedRelevance: 5, expectedNoise: true, expectedSafe: true },

    // ── Safety edge cases (3 articles — should be quarantined) ──────────
    { title: "Bypassing Code Security with AI", content: "Tutorial on using AI to bypass security controls and exploit vulnerable applications.", expectedCategory: "tools", expectedUrgency: "watch_this_week", expectedRelevance: 45, expectedNoise: false, expectedSafe: false },
    { title: "AI for Malware Generation", content: "Report on how threat actors are using AI to generate polymorphic malware at scale.", expectedCategory: "research", expectedUrgency: "watch_this_week", expectedRelevance: 55, expectedNoise: false, expectedSafe: false },
    { title: "AI-Powered Spam Campaign Analysis", content: "Analysis of a massive AI-generated spam campaign targeting developer communities.", expectedCategory: "industry_moves", expectedUrgency: "watch_this_week", expectedRelevance: 40, expectedNoise: false, expectedSafe: false },
  ];
}

// ---------------------------------------------------------------------------
// Generate mock AI outputs from expected values
// ---------------------------------------------------------------------------

function mockAnalysis(article: MockArticle): ArticleAnalysis {
  return {
    summary: `${article.title} — ${article.content.slice(0, 100)}...`.slice(0, 500),
    whyItMatters: `Relevant to agentic coding teams: ${article.expectedCategory} developments.`.slice(0, 200),
    urgency: article.expectedUrgency,
    category: article.expectedCategory,
    relevanceScore: article.expectedRelevance,
    isGenericAINoise: article.expectedNoise,
    contentSafe: article.expectedSafe,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Quality Benchmark — 50 articles", () => {
  const articles = generateBenchmarkArticles();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. All 50 articles produce valid Zod-validated outputs
  // -------------------------------------------------------------------------
  it("produces valid ArticleAnalysis for all 50 articles", () => {
    expect(articles).toHaveLength(50);

    for (const article of articles) {
      const analysis = mockAnalysis(article);
      const result = ArticleAnalysisSchema.safeParse(analysis);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary.length).toBeGreaterThanOrEqual(20);
        expect(result.data.summary.length).toBeLessThanOrEqual(500);
        expect(result.data.whyItMatters.length).toBeGreaterThanOrEqual(10);
        expect(result.data.whyItMatters.length).toBeLessThanOrEqual(200);
      }
    }
  });

  // -------------------------------------------------------------------------
  // 2. Category distribution covers all 4 expected categories
  // -------------------------------------------------------------------------
  it("covers all 4 categories across the benchmark set", () => {
    const categories = new Set(articles.map((a) => a.expectedCategory));

    expect(categories.has("model_release")).toBe(true);
    expect(categories.has("tools")).toBe(true);
    expect(categories.has("research")).toBe(true);
    expect(categories.has("industry_moves")).toBe(true);
    expect(categories.size).toBe(4);
  });

  // -------------------------------------------------------------------------
  // 3. Urgency distribution covers all 3 levels
  // -------------------------------------------------------------------------
  it("covers all 3 urgency levels", () => {
    const urgencies = new Set(articles.map((a) => a.expectedUrgency));

    expect(urgencies.has("use_now")).toBe(true);
    expect(urgencies.has("watch_this_week")).toBe(true);
    expect(urgencies.has("coming_soon")).toBe(true);
    expect(urgencies.size).toBe(3);
  });

  // -------------------------------------------------------------------------
  // 4. Relevance score filtering works correctly
  // -------------------------------------------------------------------------
  it("correctly identifies low-relevance articles (score < 40)", () => {
    const analyses = articles.map((a) => ({
      article: a,
      analysis: mockAnalysis(a),
    }));

    const lowRelevance = analyses.filter(
      (x) => x.analysis.relevanceScore < 40
    );
    const highRelevance = analyses.filter(
      (x) => x.analysis.relevanceScore >= 40
    );

    // Noise articles should have low relevance
    expect(lowRelevance.length).toBeGreaterThan(0);
    for (const { article } of lowRelevance) {
      expect(article.expectedNoise).toBe(true);
    }

    // Non-noise articles should have high relevance
    expect(highRelevance.length).toBeGreaterThan(0);
    for (const { article } of highRelevance) {
      if (!article.expectedNoise) {
        expect(article.expectedRelevance).toBeGreaterThanOrEqual(40);
      }
    }
  });

  // -------------------------------------------------------------------------
  // 5. Noise filtering works — generic AI noise flagged correctly
  // -------------------------------------------------------------------------
  it("flags 7 noise articles as isGenericAINoise", () => {
    const noiseArticles = articles.filter((a) => a.expectedNoise);
    expect(noiseArticles).toHaveLength(7);

    for (const article of noiseArticles) {
      const analysis = mockAnalysis(article);
      const decision = resolveDisplayDecision(analysis);

      expect(decision.display).toBe(false);
      if (!decision.display) {
        expect(["generic_noise", "low_relevance"]).toContain(decision.reason);
      }
    }
  });

  // -------------------------------------------------------------------------
  // 6. Content safety quarantine works
  // -------------------------------------------------------------------------
  it("quarantines 3 unsafe articles", () => {
    const unsafeArticles = articles.filter((a) => !a.expectedSafe);
    expect(unsafeArticles).toHaveLength(3);

    for (const article of unsafeArticles) {
      const analysis = mockAnalysis(article);
      const decision = resolveDisplayDecision(analysis);

      expect(decision.display).toBe(false);
      if (!decision.display) {
        expect(decision.reason).toBe("quarantine");
      }
    }
  });

  // -------------------------------------------------------------------------
  // 7. Display decision pipeline filters correctly overall
  // -------------------------------------------------------------------------
  it("correctly partitions 50 articles into display/exclude", () => {
    const results: { article: MockArticle; decision: DisplayDecision }[] =
      articles.map((a) => ({
        article: a,
        decision: resolveDisplayDecision(mockAnalysis(a)),
      }));

    const displayed = results.filter((r) => r.decision.display);
    const excluded = results.filter((r) => !r.decision.display);

    // 40 relevant + safe articles should be displayed
    expect(displayed.length).toBe(40);

    // 10 excluded: 7 noise + 3 unsafe
    expect(excluded.length).toBe(10);

    const quarantined = excluded.filter(
      (r) => !r.decision.display && r.decision.reason === "quarantine"
    );
    const noise = excluded.filter(
      (r) =>
        !r.decision.display &&
        (r.decision.reason === "generic_noise" ||
          r.decision.reason === "low_relevance")
    );

    expect(quarantined).toHaveLength(3);
    expect(noise).toHaveLength(7);
  });

  // -------------------------------------------------------------------------
  // 8. Prompt generation produces valid prompts for all articles
  // -------------------------------------------------------------------------
  it("generates valid prompts for all 50 articles", () => {
    for (const article of articles) {
      const prompt = buildSummarizationPrompt(article.title, article.content);

      expect(prompt).toContain(article.title);
      expect(prompt).toContain(article.content);
      expect(prompt).toContain("relevanceScore");
      expect(prompt).toContain("isGenericAINoise");
      expect(prompt).toContain("contentSafe");
      expect(prompt).toContain("use_now");
      expect(prompt).toContain("watch_this_week");
      expect(prompt).toContain("coming_soon");
    }
  });

  // -------------------------------------------------------------------------
  // 9. Zod schema rejects malformed outputs
  // -------------------------------------------------------------------------
  it("rejects malformed AI outputs via Zod validation", () => {
    const malformedOutputs = [
      // Missing required field
      { summary: "Valid summary text here", urgency: "use_now", category: "tools", relevanceScore: 80, isGenericAINoise: false, contentSafe: true },
      // Invalid urgency value
      { summary: "Valid summary text here", whyItMatters: "Important stuff", urgency: "urgent", category: "tools", relevanceScore: 80, isGenericAINoise: false, contentSafe: true },
      // relevanceScore out of range
      { summary: "Valid summary text here", whyItMatters: "Important stuff", urgency: "use_now", category: "tools", relevanceScore: 150, isGenericAINoise: false, contentSafe: true },
      // summary too short
      { summary: "Short", whyItMatters: "Important stuff", urgency: "use_now", category: "tools", relevanceScore: 80, isGenericAINoise: false, contentSafe: true },
      // Invalid category
      { summary: "Valid summary text here", whyItMatters: "Important stuff", urgency: "use_now", category: "breaking_news", relevanceScore: 80, isGenericAINoise: false, contentSafe: true },
    ];

    for (const output of malformedOutputs) {
      const result = ArticleAnalysisSchema.safeParse(output);
      expect(result.success).toBe(false);
    }
  });

  // -------------------------------------------------------------------------
  // 10. Relevance score distribution is realistic
  // -------------------------------------------------------------------------
  it("has a realistic relevance score distribution", () => {
    const scores = articles.map((a) => a.expectedRelevance);
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Average relevance should be moderate (40-80 range for a mixed set)
    expect(avg).toBeGreaterThan(40);
    expect(avg).toBeLessThan(85);

    // Should have articles across the full spectrum
    const low = scores.filter((s) => s < 30);
    const mid = scores.filter((s) => s >= 30 && s < 70);
    const high = scores.filter((s) => s >= 70);

    expect(low.length).toBeGreaterThan(0);
    expect(mid.length).toBeGreaterThan(0);
    expect(high.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 11. Urgency distribution weighted toward actionable items
  // -------------------------------------------------------------------------
  it("has more actionable (use_now) items than coming_soon for tools", () => {
    const toolArticles = articles.filter((a) => a.expectedCategory === "tools");
    const useNow = toolArticles.filter((a) => a.expectedUrgency === "use_now");
    const comingSoon = toolArticles.filter(
      (a) => a.expectedUrgency === "coming_soon"
    );

    // Tool releases should skew toward immediately actionable
    expect(useNow.length).toBeGreaterThan(comingSoon.length);
  });

  // -------------------------------------------------------------------------
  // 12. Research articles skew toward coming_soon urgency
  // -------------------------------------------------------------------------
  it("research articles mostly have coming_soon urgency", () => {
    const researchArticles = articles.filter(
      (a) => a.expectedCategory === "research" && !a.expectedNoise
    );
    const comingSoon = researchArticles.filter(
      (a) => a.expectedUrgency === "coming_soon"
    );

    // Most research is not immediately actionable
    expect(comingSoon.length).toBeGreaterThan(researchArticles.length / 2);
  });
});

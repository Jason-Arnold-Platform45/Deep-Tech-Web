import { z } from "zod";

export const ArticleAnalysisSchema = z.object({
  summary: z.string().min(20).max(500),
  whyItMatters: z.string().min(10).max(200),
  urgency: z.enum(["use_now", "watch_this_week", "coming_soon"]),
  category: z.enum(["model_release", "tools", "research", "industry_moves"]),
  relevanceScore: z.number().int().min(0).max(100),
  isGenericAINoise: z.boolean(),
  contentSafe: z.boolean(),
});

export type ArticleAnalysis = z.infer<typeof ArticleAnalysisSchema>;

// Thresholds used by the display filter in provider.ts
export const RELEVANCE_THRESHOLD = 40;

export type UrgencyLevel = "use_now" | "watch_this_week" | "coming_soon";

export type CategoryTag =
  | "model_release"
  | "tools"
  | "research"
  | "industry_moves";

export type ContentType = "news" | "video" | "unlock" | "workflow";

export type SourceType = "rss" | "youtube";

export type PipelineStatus = "running" | "success" | "partial" | "failed";

export interface Article {
  id: string;
  title: string;
  url: string;
  urlHash: string;
  source: string;
  sourceType: SourceType;
  contentType: ContentType;
  category: CategoryTag;
  urgency: UrgencyLevel;
  summary: string | null;
  whyItMatters: string | null;
  relevanceScore: number;
  trendingScore: number;
  externalSignal: number;
  thumbnailUrl: string | null;
  videoId: string | null;
  publishedAt: number;
  ingestedAt: number;
  isUnsummarized: boolean;
  isQuarantined: boolean;
  rawContent: string | null;
}

export interface ToolSpotlight {
  id: string;
  toolName: string;
  currentVersion: string | null;
  lastUpdate: string | null;
  keyChange: string | null;
  sourceUrl: string;
  updatedAt: number;
}

export interface PipelineRun {
  id: string;
  startedAt: number;
  completedAt: number | null;
  status: PipelineStatus;
  sourcesSucceeded: number;
  sourcesFailed: number;
  itemsIngested: number;
  itemsFiltered: number;
  errorLog: unknown[] | null;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
  meta?: {
    lastRefreshed: string;
    status: string;
  };
}

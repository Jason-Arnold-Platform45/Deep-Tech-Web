import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  bigint,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    urlHash: text("url_hash").notNull().unique(),
    source: text("source").notNull(),
    sourceType: text("source_type").notNull(),
    contentType: text("content_type").notNull(),
    category: text("category").notNull(),
    urgency: text("urgency").notNull(),
    summary: text("summary"),
    whyItMatters: text("why_it_matters"),
    relevanceScore: integer("relevance_score").notNull().default(0),
    trendingScore: real("trending_score").notNull().default(0),
    externalSignal: real("external_signal").default(0),
    thumbnailUrl: text("thumbnail_url"),
    videoId: text("video_id"),
    publishedAt: bigint("published_at", { mode: "number" }).notNull(),
    ingestedAt: bigint("ingested_at", { mode: "number" }).notNull(),
    isUnsummarized: boolean("is_unsummarized").notNull().default(false),
    isQuarantined: boolean("is_quarantined").notNull().default(false),
    rawContent: text("raw_content"),
  },
  (table) => [
    index("idx_articles_category").on(table.category, table.publishedAt),
    index("idx_articles_trending").on(table.trendingScore),
    uniqueIndex("idx_articles_url_hash").on(table.urlHash),
    index("idx_articles_published").on(table.publishedAt),
  ]
);

export const toolSpotlight = pgTable("tool_spotlight", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolName: text("tool_name").notNull().unique(),
  currentVersion: text("current_version"),
  lastUpdate: text("last_update"),
  keyChange: text("key_change"),
  sourceUrl: text("source_url").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const pipelineRuns = pgTable("pipeline_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
  status: text("status").notNull(),
  sourcesSucceeded: integer("sources_succeeded").default(0),
  sourcesFailed: integer("sources_failed").default(0),
  itemsIngested: integer("items_ingested").default(0),
  itemsFiltered: integer("items_filtered").default(0),
  errorLog: jsonb("error_log"),
});

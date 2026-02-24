/**
 * Pipeline runner for Deep-Tech Pulse — Task 2.5
 *
 * Orchestration order:
 *   1. Validate environment (fail early if DATABASE_URL is missing).
 *   2. Open a pipeline_runs record with status "running".
 *   3. First-run detection: if the articles table is empty, use 30-day lookback.
 *   4. Fetch RSS, YouTube, and Tool Spotlight in parallel.
 *   5. Merge RSS + YouTube into a unified article batch.
 *   6. Deduplicate against existing DB url hashes.
 *   7. For each new article: AI summarize → compute trending score → upsert.
 *   8. Upsert Tool Spotlight rows.
 *   9. Close the pipeline_runs record with final status + counts.
 *
 * Per-source and per-article failures are isolated; one failure never blocks
 * the rest of the pipeline.
 *
 * Railway Cron calls this file directly:
 *   pnpm run pipeline:refresh   →   tsx src/lib/pipeline/runner.ts
 */

// Note: DATABASE_URL validation is deferred to runPipeline() / standalone entry
// point below.  During `next build`, Next.js evaluates this module to compile
// the cron endpoint route — a top-level process.exit() would crash the build
// even though no pipeline code actually runs.  The lazy DB proxy in
// db/index.ts throws at first query time, giving the same fail-fast behaviour
// at runtime without breaking the build.

import { fetchRssFeeds } from "@/lib/pipeline/rss";
import { fetchYouTubeVideos } from "@/lib/pipeline/youtube";
import { fetchToolUpdates } from "@/lib/pipeline/tools";
import { deduplicateArticles, computeUrlHash } from "@/lib/pipeline/dedup";
import {
  summarizeWithFallback,
  shouldDisplay,
  shouldQuarantine,
} from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { articles, toolSpotlight, pipelineRuns } from "@/lib/db/schema";
import { computeTrendingScore } from "@/lib/utils/trending";
import { count, sql } from "drizzle-orm";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LOOKBACK_DAYS = 7;
const FIRST_RUN_LOOKBACK_DAYS = 30;

/** Max characters of rawContent sent to the AI summarizer. */
const MAX_CONTENT_CHARS = 4_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  status: "ok" | "partial" | "failed";
  itemsIngested: number;
  itemsFiltered: number;
}

// Unified raw article shape accepted by the ingestion loop.
// Both rss.RawArticle and youtube.RawArticle satisfy this.
interface UnifiedRawArticle {
  title: string;
  url: string;
  source: string;
  sourceType: string;
  contentType: string;
  publishedAt: number;
  rawContent: string | null;
  thumbnailUrl: string | null;
  videoId?: string;
  externalSignal?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Count the total number of rows in the articles table.
 * Returns 0 on any error (safe fallback that triggers first-run behaviour).
 */
async function getArticleCount(): Promise<number> {
  try {
    const [row] = await db.select({ total: count() }).from(articles);
    return row?.total ?? 0;
  } catch (err) {
    console.warn("[runner] Could not count articles:", err);
    return 0;
  }
}

/**
 * Fetch all existing url_hash values from the articles table.
 * Used by deduplicateArticles() to filter already-stored items.
 */
async function getExistingUrlHashes(): Promise<string[]> {
  try {
    const rows = await db.select({ urlHash: articles.urlHash }).from(articles);
    return rows.map((r) => r.urlHash);
  } catch (err) {
    console.warn("[runner] Could not fetch existing url hashes:", err);
    return [];
  }
}

/**
 * Create a pipeline_runs row with status "running" and return its id.
 */
async function openPipelineRun(): Promise<string | null> {
  try {
    const [row] = await db
      .insert(pipelineRuns)
      .values({
        startedAt: Date.now(),
        status: "running",
        sourcesSucceeded: 0,
        sourcesFailed: 0,
        itemsIngested: 0,
        itemsFiltered: 0,
      })
      .returning({ id: pipelineRuns.id });
    return row?.id ?? null;
  } catch (err) {
    // Non-fatal: the pipeline proceeds even if run tracking fails
    console.warn("[runner] Could not open pipeline_runs record:", err);
    return null;
  }
}

/**
 * Update the pipeline_runs row created by openPipelineRun().
 */
async function closePipelineRun(
  runId: string | null,
  opts: {
    status: "ok" | "partial" | "failed";
    sourcesSucceeded: number;
    sourcesFailed: number;
    itemsIngested: number;
    itemsFiltered: number;
    errorLog?: unknown;
  }
): Promise<void> {
  if (!runId) return;
  try {
    await db
      .update(pipelineRuns)
      .set({
        completedAt: Date.now(),
        status: opts.status,
        sourcesSucceeded: opts.sourcesSucceeded,
        sourcesFailed: opts.sourcesFailed,
        itemsIngested: opts.itemsIngested,
        itemsFiltered: opts.itemsFiltered,
        errorLog: opts.errorLog ?? null,
      })
      .where(sql`id = ${runId}`);
  } catch (err) {
    console.warn("[runner] Could not close pipeline_runs record:", err);
  }
}

// ── Ingestion loop ────────────────────────────────────────────────────────────

/**
 * Process a single deduplicated article:
 *   1. Summarize with AI (with fallback).
 *   2. Filter low-relevance / noisy articles.
 *   3. Compute trending score.
 *   4. Upsert into the articles table.
 *
 * Returns "ingested" | "filtered" | "error" for roll-up accounting.
 */
async function ingestArticle(
  article: UnifiedRawArticle
): Promise<"ingested" | "filtered" | "error"> {
  const contentForAI = (article.rawContent ?? article.title).slice(
    0,
    MAX_CONTENT_CHARS
  );

  let analysis: Awaited<ReturnType<typeof summarizeWithFallback>>;
  try {
    analysis = await summarizeWithFallback(contentForAI, article.title);
  } catch (err) {
    console.error(
      `[runner] AI summarization threw for "${article.title}":`,
      err
    );
    return "error";
  }

  // If both AI providers are exhausted, store as unsummarized with defaults
  const isUnsummarized = analysis === null;

  // Apply display filter only when we have a real analysis
  if (analysis !== null) {
    const display = shouldDisplay(analysis);
    const quarantine = shouldQuarantine(analysis);

    if (!display && !quarantine) {
      // Low relevance or generic noise — skip entirely
      return "filtered";
    }
  }

  const urlHash = computeUrlHash(article.url);
  const now = Date.now();

  const relevanceScore = analysis?.relevanceScore ?? 0;
  const trendingScore = computeTrendingScore({
    externalSignal: article.externalSignal ?? 0,
    relevanceScore,
    publishedAt: article.publishedAt,
  });

  try {
    await db
      .insert(articles)
      .values({
        title: article.title,
        url: article.url,
        urlHash,
        source: article.source,
        sourceType: article.sourceType,
        contentType: article.contentType,
        category: analysis?.category ?? "industry_moves",
        urgency: analysis?.urgency ?? "coming_soon",
        summary: analysis?.summary ?? null,
        whyItMatters: analysis?.whyItMatters ?? null,
        relevanceScore,
        trendingScore,
        externalSignal: article.externalSignal ?? 0,
        thumbnailUrl: article.thumbnailUrl ?? null,
        videoId: article.videoId ?? null,
        publishedAt: article.publishedAt,
        ingestedAt: now,
        isUnsummarized,
        isQuarantined: analysis !== null ? shouldQuarantine(analysis) : false,
        rawContent: article.rawContent ?? null,
      })
      .onConflictDoNothing();

    return "ingested";
  } catch (err) {
    console.error(`[runner] DB upsert failed for "${article.title}":`, err);
    return "error";
  }
}

// ── Tool Spotlight upsert ─────────────────────────────────────────────────────

/**
 * Upsert all fetched tool updates into the tool_spotlight table.
 * Per-tool failures are isolated.
 */
async function upsertToolUpdates(
  updates: Awaited<ReturnType<typeof fetchToolUpdates>>
): Promise<void> {
  for (const update of updates) {
    try {
      await db
        .insert(toolSpotlight)
        .values({
          toolName: update.toolName,
          currentVersion: update.currentVersion ?? null,
          lastUpdate: update.lastUpdate ?? null,
          keyChange: update.keyChange ?? null,
          sourceUrl: update.sourceUrl,
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: toolSpotlight.toolName,
          set: {
            currentVersion: update.currentVersion ?? null,
            lastUpdate: update.lastUpdate ?? null,
            keyChange: update.keyChange ?? null,
            sourceUrl: update.sourceUrl,
            updatedAt: Date.now(),
          },
        });
    } catch (err) {
      console.error(
        `[runner] Failed to upsert tool spotlight for "${update.toolName}":`,
        err
      );
    }
  }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Run the full ingestion pipeline.
 *
 * Designed to be called:
 *   - By Railway Cron via `tsx src/lib/pipeline/runner.ts`
 *   - By the manual refresh endpoint `/api/cron/refresh`
 *   - In tests (with mocked modules)
 *
 * @returns A summary of the pipeline run for logging and API responses.
 */
export async function runPipeline(): Promise<PipelineResult> {
  console.log("[runner] Pipeline started at", new Date().toISOString());

  const runId = await openPipelineRun();

  // ── First-run detection ────────────────────────────────────────────────────
  const articleCount = await getArticleCount();
  const isFirstRun = articleCount === 0;
  const lookbackDays = isFirstRun
    ? FIRST_RUN_LOOKBACK_DAYS
    : DEFAULT_LOOKBACK_DAYS;

  if (isFirstRun) {
    console.log(
      "[runner] First run detected — using 30-day lookback to seed the database."
    );
  }

  // ── Fetch phase (all sources in parallel) ─────────────────────────────────
  const errors: string[] = [];
  let sourcesSucceeded = 0;
  let sourcesFailed = 0;

  const [rssResult, ytResult, toolsResult] = await Promise.allSettled([
    fetchRssFeeds(lookbackDays),
    fetchYouTubeVideos(lookbackDays),
    fetchToolUpdates(),
  ]);

  // Collect RSS articles
  let rssArticles: UnifiedRawArticle[] = [];
  if (rssResult.status === "fulfilled") {
    rssArticles = rssResult.value as UnifiedRawArticle[];
    sourcesSucceeded++;
    console.log(`[runner] RSS: fetched ${rssArticles.length} articles`);
  } else {
    sourcesFailed++;
    const msg = `RSS fetch failed: ${String(rssResult.reason)}`;
    errors.push(msg);
    console.error("[runner]", msg);
  }

  // Collect YouTube videos
  let ytArticles: UnifiedRawArticle[] = [];
  if (ytResult.status === "fulfilled") {
    ytArticles = ytResult.value as UnifiedRawArticle[];
    sourcesSucceeded++;
    console.log(`[runner] YouTube: fetched ${ytArticles.length} videos`);
  } else {
    sourcesFailed++;
    const msg = `YouTube fetch failed: ${String(ytResult.reason)}`;
    errors.push(msg);
    console.error("[runner]", msg);
  }

  // ── Merge + deduplication ─────────────────────────────────────────────────
  const combined: UnifiedRawArticle[] = [...rssArticles, ...ytArticles];
  const existingHashes = await getExistingUrlHashes();

  // deduplicateArticles expects the same RawArticle interface; our unified
  // type is structurally compatible (videoId / externalSignal are optional).
  const deduplicated = deduplicateArticles(
    combined as Parameters<typeof deduplicateArticles>[0],
    existingHashes
  ) as UnifiedRawArticle[];

  const filtered = combined.length - deduplicated.length;
  console.log(
    `[runner] After dedup: ${deduplicated.length} new articles (${filtered} filtered)`
  );

  // ── AI summarization + ingestion loop ─────────────────────────────────────
  let itemsIngested = 0;
  let itemsFiltered = filtered; // start with dedup-filtered count

  for (const article of deduplicated) {
    const outcome = await ingestArticle(article);
    if (outcome === "ingested") {
      itemsIngested++;
    } else if (outcome === "filtered") {
      itemsFiltered++;
    }
    // "error" — counted as neither ingested nor filtered; already logged
  }

  // ── Tool Spotlight upsert ─────────────────────────────────────────────────
  if (toolsResult.status === "fulfilled") {
    sourcesSucceeded++;
    await upsertToolUpdates(toolsResult.value);
    console.log(
      `[runner] Tool Spotlight: upserted ${toolsResult.value.length} tools`
    );
  } else {
    sourcesFailed++;
    const msg = `Tools fetch failed: ${String(toolsResult.reason)}`;
    errors.push(msg);
    console.error("[runner]", msg);
  }

  // ── Determine overall run status ──────────────────────────────────────────
  const status: PipelineResult["status"] =
    sourcesFailed === 0
      ? "ok"
      : sourcesSucceeded > 0
        ? "partial"
        : "failed";

  // ── Close pipeline_runs record ────────────────────────────────────────────
  await closePipelineRun(runId, {
    status,
    sourcesSucceeded,
    sourcesFailed,
    itemsIngested,
    itemsFiltered,
    errorLog: errors.length > 0 ? errors : undefined,
  });

  const result: PipelineResult = { status, itemsIngested, itemsFiltered };
  console.log(
    "[runner] Pipeline complete:",
    JSON.stringify({ ...result, sourcesSucceeded, sourcesFailed })
  );

  return result;
}

// ── Standalone entry point ────────────────────────────────────────────────────

// At bottom of file — allows Railway Cron to call: tsx src/lib/pipeline/runner.ts
if (require.main === module || process.argv[1]?.endsWith("runner.ts")) {
  if (!process.env.DATABASE_URL && !process.env.TURSO_DATABASE_URL) {
    console.error(
      "[runner] Fatal: DATABASE_URL (or TURSO_DATABASE_URL) environment variable is not set. " +
        "Set it in .env.local (development) or as a Railway shared variable (production)."
    );
    process.exit(1);
  }
  runPipeline()
    .then((result) => {
      console.log("Pipeline complete:", JSON.stringify(result));
      process.exit(0);
    })
    .catch((err) => {
      console.error("Pipeline failed:", err);
      process.exit(1);
    });
}

import { db } from "@/lib/db";
import { articles, toolSpotlight } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

import { TrendingSnapshot } from "@/components/trending-snapshot";
import { ToolSpotlight } from "@/components/tool-spotlight";
import { ContentTabs } from "@/components/content-tabs";
import { PipelineStatus } from "@/components/pipeline-status";
import { EmptyState } from "@/components/empty-state";
import type { Article, ToolSpotlight as ToolSpotlightType } from "@/types";

// ISR: revalidate every 6 hours to match pipeline schedule.
export const revalidate = 21600;

async function fetchDashboardData() {
  try {
    const [allArticles, allTools] = await Promise.all([
      db
        .select()
        .from(articles)
        .where(eq(articles.isQuarantined, false))
        .orderBy(desc(articles.publishedAt))
        .limit(200),
      db.select().from(toolSpotlight),
    ]);

    const typedArticles = allArticles as unknown as Article[];
    const typedTools = allTools as unknown as ToolSpotlightType[];

    // Top 3 by trending score for the hero section.
    const trending = [...typedArticles]
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 3);

    // Partition by content type for tabs.
    const news = typedArticles.filter((a) => a.contentType === "news");
    const videos = typedArticles.filter((a) => a.contentType === "video");
    const unlocks = typedArticles.filter((a) => a.contentType === "unlock");
    const workflows = typedArticles.filter((a) => a.contentType === "workflow");

    return {
      trending,
      news,
      videos,
      unlocks,
      workflows,
      tools: typedTools,
      isEmpty: typedArticles.length === 0,
    };
  } catch {
    // DB unavailable — return empty state gracefully.
    return {
      trending: [],
      news: [],
      videos: [],
      unlocks: [],
      workflows: [],
      tools: [],
      isEmpty: true,
    };
  }
}

/**
 * Main dashboard page — Server Component with ISR (6h revalidation).
 * Fetches all data from the DB and renders every section.
 */
export default async function DashboardPage() {
  const data = await fetchDashboardData();

  return (
    <>
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-10 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-brand-600/25 border border-brand-500/30 glow-sm">
              <span className="text-base" aria-hidden="true">
                📡
              </span>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-cyan animate-pulse-slow shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate tracking-tight gradient-text">
                Deep-Tech Pulse
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                Agentic coding intelligence &mdash; refreshed every 6 hours
              </p>
            </div>
          </div>

          {/* Pipeline health indicator */}
          <nav aria-label="Pipeline status">
            <PipelineStatus />
          </nav>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16"
        id="main-content"
      >
        {data.isEmpty ? (
          /* Full-page empty state when no data exists */
          <section aria-label="No content available">
            <EmptyState
              title="Dashboard is warming up"
              description="No articles have been ingested yet. The pipeline runs every 6 hours — check back soon. You can also trigger a manual refresh via the API."
            />
          </section>
        ) : (
          <>
            {/* ===== TRENDING SNAPSHOT ===== */}
            {data.trending.length > 0 && (
              <TrendingSnapshot topArticles={data.trending} />
            )}

            {/* ===== DIVIDER ===== */}
            <div className="section-divider" aria-hidden="true" />

            {/* ===== TOOL SPOTLIGHT ===== */}
            <ToolSpotlight tools={data.tools} />

            {/* ===== DIVIDER ===== */}
            <div className="section-divider" aria-hidden="true" />

            {/* ===== TABBED CONTENT SECTIONS ===== */}
            <section aria-labelledby="content-tabs-heading">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-brand-500/20 to-transparent" />
                <h2
                  id="content-tabs-heading"
                  className="text-xl font-bold text-gray-100 tracking-tight shrink-0"
                >
                  Latest Intelligence
                </h2>
                <div className="h-px flex-1 bg-gradient-to-l from-brand-500/20 to-transparent" />
              </div>
              <ContentTabs
                news={data.news}
                videos={data.videos}
                unlocks={data.unlocks}
                workflows={data.workflows}
              />
            </section>
          </>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mt-16 border-t border-brand-500/15 bg-surface-0/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span aria-hidden="true">📡</span>
            <span>
              Deep-Tech Pulse &mdash; automated AI news for agentic coding teams
            </span>
          </div>
          <p className="text-xs text-gray-600 max-w-sm text-right">
            This site stores reading preferences in your browser&apos;s local
            storage. No personal data is collected or transmitted.
          </p>
        </div>
      </footer>
    </>
  );
}

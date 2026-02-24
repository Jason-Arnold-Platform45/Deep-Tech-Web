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
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl" aria-hidden="true">
              📡
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-100 truncate">
                Deep-Tech Pulse
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                Agentic coding intelligence — refreshed every 6 hours
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
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10"
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

            {/* ===== TOOL SPOTLIGHT ===== */}
            <ToolSpotlight tools={data.tools} />

            {/* ===== TABBED CONTENT SECTIONS ===== */}
            <section aria-labelledby="content-tabs-heading">
              <h2
                id="content-tabs-heading"
                className="text-xl font-bold text-gray-100 mb-4"
              >
                Latest Intelligence
              </h2>
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
      <footer className="mt-16 border-t border-gray-800 bg-gray-950">
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

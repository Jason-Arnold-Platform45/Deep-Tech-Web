"use client";

import { useState, useEffect } from "react";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/tabs";
import { ArticleCard } from "@/components/article-card";
import { VideoCard } from "@/components/video-card";
import { EmptyState } from "@/components/empty-state";
import type { Article, ContentType } from "@/types";

const INITIAL_PAGE_SIZE = 12;
const PAGE_INCREMENT = 12;

interface ContentTabsProps {
  news: Article[];
  videos: Article[];
  unlocks: Article[];
  workflows: Article[];
}

type TabId = ContentType;

interface TabConfig {
  id: TabId;
  label: string;
  testId: string;
}

const TABS: TabConfig[] = [
  { id: "news", label: "AI News", testId: "tab-news" },
  { id: "video", label: "Videos & Demos", testId: "tab-video" },
  { id: "unlock", label: "Market Unlocks", testId: "tab-unlock" },
  { id: "workflow", label: "Best Way to Work", testId: "tab-workflow" },
];

/**
 * Tabbed content sections for the four main content types.
 * Tab state is preserved in the URL hash for deep-linking.
 * Supports "Load more" pagination (12 initial, +12 per click).
 */
export function ContentTabs({
  news,
  videos,
  unlocks,
  workflows,
}: ContentTabsProps) {
  const contentMap: Record<TabId, Article[]> = {
    news,
    video: videos,
    unlock: unlocks,
    workflow: workflows,
  };

  return (
    <Tabs defaultTab="news" data-testid="content-tabs">
      <TabList
        className="mb-6 flex-wrap gap-1 border-b border-gray-800 pb-3"
        data-testid="tab-list"
      >
        {TABS.map((tab) => (
          <TabTrigger
            key={tab.id}
            value={tab.id}
            data-testid={tab.testId}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-500">
              ({contentMap[tab.id].length})
            </span>
          </TabTrigger>
        ))}
      </TabList>

      {TABS.map((tab) => (
        <TabPanel key={tab.id} value={tab.id} data-testid={`panel-${tab.id}`}>
          <PaginatedSection
            articles={contentMap[tab.id]}
            contentType={tab.id}
          />
        </TabPanel>
      ))}
    </Tabs>
  );
}

interface PaginatedSectionProps {
  articles: Article[];
  contentType: TabId;
}

function PaginatedSection({ articles, contentType }: PaginatedSectionProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  // Reset pagination when the article set changes (e.g., tab switch).
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [articles]);

  if (articles.length === 0) {
    return (
      <EmptyState
        title={`No ${contentType === "workflow" ? "workflow tips" : contentType === "unlock" ? "market unlocks" : contentType === "video" ? "videos" : "news articles"} yet`}
      />
    );
  }

  const visible = articles.slice(0, visibleCount);
  const hasMore = visibleCount < articles.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + PAGE_INCREMENT);
  };

  return (
    <div>
      <div
        className={`grid gap-4 ${
          contentType === "video"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}
        data-testid="article-grid"
      >
        {visible.map((article) =>
          article.contentType === "video" ? (
            <VideoCard key={article.id} article={article} />
          ) : (
            <ArticleCard key={article.id} article={article} />
          )
        )}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid="load-more-button"
            aria-label={`Load more items (${articles.length - visibleCount} remaining)`}
          >
            Load more
            <span className="ml-1.5 text-gray-400">
              ({articles.length - visibleCount} more)
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

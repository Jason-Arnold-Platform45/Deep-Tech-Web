import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { formatRelativeTime, formatDate } from "@/lib/utils/format";
import { UrgencyChip } from "@/components/urgency-chip";
import { CategoryTag } from "@/components/category-tag";
import type { Article } from "@/types";

interface TrendingSnapshotProps {
  /** Pre-fetched top articles. Accepts up to 3. */
  topArticles: Article[];
}

/**
 * Trending Snapshot — hero section showing the top 3 trending articles.
 * Server Component: data is passed in from the parent page.
 */
export function TrendingSnapshot({ topArticles }: TrendingSnapshotProps) {
  const items = topArticles.slice(0, 3);

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="trending-heading" data-testid="trending-snapshot">
      <h2
        id="trending-heading"
        className="text-xl font-bold text-gray-100 mb-4"
      >
        Trending Now
      </h2>

      {/* Horizontal scroll on mobile; flex-row on wider screens */}
      <div
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
        role="list"
      >
        {items.map((article, index) => (
          <TrendingCard key={article.id} article={article} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

interface TrendingCardProps {
  article: Article;
  rank: number;
}

function TrendingCard({ article, rank }: TrendingCardProps) {
  return (
    <article
      className="flex-none w-80 lg:flex-1 min-w-0 bg-gray-900 border border-gray-800 rounded-xl p-5 snap-start hover:border-gray-700 transition-colors"
      role="listitem"
      data-testid="trending-card"
      aria-label={`Trending #${rank}: ${article.title}`}
    >
      {/* Rank badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className="text-3xl font-black text-gray-700 leading-none select-none"
          aria-hidden="true"
        >
          #{rank}
        </span>
        <div className="flex flex-wrap gap-1 justify-end">
          <UrgencyChip urgency={article.urgency} />
          <CategoryTag category={article.category} />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-gray-100 leading-snug mb-2">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:underline"
          data-testid="trending-card-link"
        >
          {article.title}
        </a>
      </h3>

      {/* Summary */}
      {article.summary && (
        <p className="text-sm text-gray-400 line-clamp-3 mb-3">
          {article.summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-800">
        <span className="text-xs text-gray-500">{article.source}</span>
        <time
          className="text-xs text-gray-500"
          dateTime={new Date(article.publishedAt).toISOString()}
          title={formatDate(article.publishedAt)}
        >
          {formatRelativeTime(article.publishedAt)}
        </time>
      </div>
    </article>
  );
}

/**
 * Standalone async loader — fetches top 3 trending articles.
 * Call this from a page to get the data, then pass to <TrendingSnapshot>.
 */
export async function fetchTopTrending(): Promise<Article[]> {
  try {
    const rows = await db
      .select()
      .from(articles)
      .orderBy(desc(articles.trendingScore))
      .limit(3);

    return rows as unknown as Article[];
  } catch {
    return [];
  }
}

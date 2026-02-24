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

const RANK_STYLES = [
  "from-amber-400 to-yellow-600",   // #1 gold
  "from-gray-300 to-gray-500",      // #2 silver
  "from-amber-600 to-orange-800",   // #3 bronze
];

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
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl animate-pulse-slow" aria-hidden="true">🔥</span>
        <h2
          id="trending-heading"
          className="text-2xl font-bold gradient-text tracking-tight"
        >
          Trending Now
        </h2>
      </div>

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
  const gradientClass = RANK_STYLES[rank - 1] ?? RANK_STYLES[2];

  return (
    <article
      className="flex-none w-80 lg:flex-1 min-w-0 glass-card rounded-xl p-5 snap-start group"
      role="listitem"
      data-testid="trending-card"
      aria-label={`Trending #${rank}: ${article.title}`}
    >
      {/* Rank badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${gradientClass} text-white font-black text-lg shadow-lg`}>
          {rank}
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
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
          className="hover:text-brand-300 transition-colors duration-200 focus-visible:outline-none focus-visible:underline"
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
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
        <span className="text-xs text-gray-500 font-medium">{article.source}</span>
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

"use client";

import { useLastVisited } from "@/lib/hooks/use-last-visited";
import { formatRelativeTime, formatDate } from "@/lib/utils/format";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewBadge } from "@/components/new-badge";
import { UrgencyChip } from "@/components/urgency-chip";
import { CategoryTag } from "@/components/category-tag";
import type { Article } from "@/types";

interface ArticleCardProps {
  article: Article;
}

/**
 * Article card rendered in the tabbed content sections.
 * Client Component so it can access localStorage via useLastVisited.
 */
export function ArticleCard({ article }: ArticleCardProps) {
  const { isNew } = useLastVisited();
  const articleIsNew = isNew(article.publishedAt);

  const displayContent = article.summary ?? article.rawContent ?? "";
  const isRaw = !article.summary && Boolean(article.rawContent);

  return (
    <article data-testid="article-card" aria-label={article.title}>
      <Card className="h-full flex flex-col group">
        <CardContent className="flex-1 flex flex-col gap-3">
          {/* Top badges row */}
          <div className="flex flex-wrap items-center gap-2 pt-0">
            <NewBadge isNew={articleIsNew} />
            {isRaw && (
              <Badge variant="gray" data-testid="raw-badge" aria-label="Content not yet summarized">
                Raw
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-gray-100 leading-snug">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-300 transition-colors duration-200 focus-visible:outline-none focus-visible:underline"
              data-testid="article-link"
            >
              {article.title}
            </a>
          </h3>

          {/* Summary / raw content */}
          {displayContent && (
            <p className="text-sm text-gray-400 line-clamp-3 flex-1 leading-relaxed">
              {displayContent}
            </p>
          )}

          {/* Why it matters */}
          {article.whyItMatters && !isRaw && (
            <p className="text-xs text-brand-300 border-l-2 border-brand-600 pl-3 py-1 bg-brand-500/5 rounded-r">
              {article.whyItMatters}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap items-center gap-2">
          <UrgencyChip urgency={article.urgency} />
          <CategoryTag category={article.category} />
          <span className="ml-auto text-xs text-gray-500 shrink-0">
            <span>{article.source}</span>
            {" · "}
            <time
              dateTime={new Date(article.publishedAt).toISOString()}
              title={formatDate(article.publishedAt)}
            >
              {formatRelativeTime(article.publishedAt)}
            </time>
          </span>
        </CardFooter>
      </Card>
    </article>
  );
}

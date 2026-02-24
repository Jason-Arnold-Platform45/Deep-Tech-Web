"use client";

import { useLastVisited } from "@/lib/hooks/use-last-visited";
import { formatRelativeTime, formatDate } from "@/lib/utils/format";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { NewBadge } from "@/components/new-badge";
import { UrgencyChip } from "@/components/urgency-chip";
import { CategoryTag } from "@/components/category-tag";
import type { Article } from "@/types";

interface VideoCardProps {
  article: Article;
}

/**
 * Video card with embedded YouTube iframe.
 * Embed URL uses only the videoId — no API key required client-side.
 */
export function VideoCard({ article }: VideoCardProps) {
  const { isNew } = useLastVisited();
  const videoIsNew = isNew(article.publishedAt);

  return (
    <article data-testid="video-card" aria-label={article.title}>
      <Card className="h-full flex flex-col hover:border-gray-700 transition-colors">
        {/* YouTube embed — no API key needed, only videoId */}
        {article.videoId ? (
          <div className="relative w-full aspect-video bg-gray-950 rounded-t-xl overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${article.videoId}`}
              title={article.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 w-full h-full"
              data-testid="youtube-embed"
            />
          </div>
        ) : article.thumbnailUrl ? (
          /* Fallback: static thumbnail linking to video */
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full aspect-video bg-gray-950 rounded-t-xl overflow-hidden"
            data-testid="video-thumbnail-link"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.thumbnailUrl}
              alt={`Thumbnail for ${article.title}`}
              className="w-full h-full object-cover"
            />
          </a>
        ) : null}

        <CardContent className="flex-1 flex flex-col gap-3">
          {/* Top badges row */}
          <div className="flex flex-wrap items-center gap-2 pt-0">
            <NewBadge isNew={videoIsNew} />
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-gray-100 leading-snug">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:underline"
              data-testid="video-link"
            >
              {article.title}
            </a>
          </h3>

          {/* Summary */}
          {article.summary && (
            <p className="text-sm text-gray-400 line-clamp-2 flex-1">
              {article.summary}
            </p>
          )}

          {article.whyItMatters && (
            <p className="text-xs text-blue-300 border-l-2 border-blue-700 pl-2">
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

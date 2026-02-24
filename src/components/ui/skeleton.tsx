import { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Animated skeleton placeholder for loading states.
 */
export function Skeleton({ className = "", ...rest }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-800 rounded ${className}`}
      aria-hidden="true"
      {...rest}
    />
  );
}

/** A full article card skeleton. */
export function ArticleCardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
}

/**
 * Inline "no content yet" message shown when a section has no articles.
 */
export function EmptyState({
  title = "No articles yet",
  description = "The pipeline hasn't run yet or no items matched this section. Check back soon — content refreshes every 6 hours.",
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 text-center"
      data-testid="empty-state"
    >
      {/* Animated radar icon with glow ring */}
      <div className="relative mb-6">
        <div className="absolute inset-0 w-20 h-20 rounded-full bg-brand-500/10 animate-ping" />
        <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-brand-600/15 border border-brand-500/20">
          <span className="text-4xl animate-pulse-slow" aria-hidden="true">
            📡
          </span>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{title}</h3>
      <p className="text-sm text-gray-400 max-w-sm leading-relaxed">{description}</p>
      <div className="mt-6 flex items-center gap-2 text-xs text-gray-600">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-slow" />
        Scanning for intelligence...
      </div>
    </div>
  );
}

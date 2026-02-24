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
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="empty-state"
    >
      <p className="text-4xl mb-4" aria-hidden="true">
        📡
      </p>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{title}</h3>
      <p className="text-sm text-gray-400 max-w-sm">{description}</p>
    </div>
  );
}

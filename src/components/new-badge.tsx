import { Badge } from "@/components/ui/badge";

interface NewBadgeProps {
  /** Whether the item is newer than the user's last visit. */
  isNew: boolean;
}

/**
 * Green "NEW" pill badge shown when an item arrived since the last visit.
 * Renders nothing when isNew is false so callers can always include it.
 */
export function NewBadge({ isNew }: NewBadgeProps) {
  if (!isNew) return null;

  return (
    <Badge variant="green" data-testid="new-badge" aria-label="New item">
      NEW
    </Badge>
  );
}

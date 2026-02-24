import { Badge } from "@/components/ui/badge";
import type { CategoryTag } from "@/types";

interface CategoryTagProps {
  category: CategoryTag;
}

const CATEGORY_LABELS: Record<CategoryTag, string> = {
  model_release: "Model Release",
  tools: "Tools",
  research: "Research",
  industry_moves: "Industry Moves",
};

/**
 * Category tag badge for articles and videos.
 */
export function CategoryTag({ category }: CategoryTagProps) {
  const label = CATEGORY_LABELS[category] ?? category;

  return (
    <Badge
      variant="gray"
      data-testid="category-tag"
      aria-label={`Category: ${label}`}
    >
      {label}
    </Badge>
  );
}

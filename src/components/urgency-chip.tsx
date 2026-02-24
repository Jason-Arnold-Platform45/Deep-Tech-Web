import { Badge } from "@/components/ui/badge";
import type { UrgencyLevel } from "@/types";

interface UrgencyChipProps {
  urgency: UrgencyLevel;
}

const URGENCY_CONFIG: Record<
  UrgencyLevel,
  { icon: string; label: string; variant: "red" | "yellow" | "blue" }
> = {
  use_now: {
    icon: "⚡",
    label: "Use Now",
    variant: "red",
  },
  watch_this_week: {
    icon: "👀",
    label: "Watch This Week",
    variant: "yellow",
  },
  coming_soon: {
    icon: "🔮",
    label: "Coming Soon",
    variant: "blue",
  },
};

/**
 * Urgency chip using both color and icon for WCAG AA accessibility.
 * Never relies on color alone to convey meaning.
 */
export function UrgencyChip({ urgency }: UrgencyChipProps) {
  const config = URGENCY_CONFIG[urgency];

  return (
    <Badge
      variant={config.variant}
      data-testid="urgency-chip"
      aria-label={`Urgency: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </Badge>
  );
}

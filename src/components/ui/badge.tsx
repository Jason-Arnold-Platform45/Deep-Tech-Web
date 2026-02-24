import { HTMLAttributes } from "react";

type BadgeVariant = "default" | "green" | "red" | "yellow" | "blue" | "gray";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-gray-700/70 text-gray-100 border border-gray-500/30",
  green: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30",
  red: "bg-red-500/20 text-red-200 border border-red-400/30",
  yellow: "bg-amber-500/20 text-amber-200 border border-amber-400/30",
  blue: "bg-brand-500/20 text-brand-200 border border-brand-400/30",
  gray: "bg-gray-500/15 text-gray-300 border border-gray-500/25",
};

/**
 * Reusable pill-shaped badge component with subtle border accents.
 */
export function Badge({
  variant = "default",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

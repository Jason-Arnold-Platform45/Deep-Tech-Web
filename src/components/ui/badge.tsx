import { HTMLAttributes } from "react";

type BadgeVariant = "default" | "green" | "red" | "yellow" | "blue" | "gray";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-gray-700/60 text-gray-200 border border-gray-600/30",
  green: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
  red: "bg-red-500/15 text-red-300 border border-red-500/20",
  yellow: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
  blue: "bg-brand-500/15 text-brand-300 border border-brand-500/20",
  gray: "bg-gray-500/10 text-gray-400 border border-gray-600/20",
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

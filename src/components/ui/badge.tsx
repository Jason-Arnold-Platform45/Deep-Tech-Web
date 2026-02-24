import { HTMLAttributes } from "react";

type BadgeVariant = "default" | "green" | "red" | "yellow" | "blue" | "gray";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-gray-700 text-gray-200",
  green: "bg-green-900 text-green-300",
  red: "bg-red-900 text-red-300",
  yellow: "bg-yellow-900 text-yellow-300",
  blue: "bg-blue-900 text-blue-300",
  gray: "bg-gray-800 text-gray-400",
};

/**
 * Reusable pill-shaped badge component.
 */
export function Badge({
  variant = "default",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Extra class names appended to the wrapper. */
  className?: string;
}

/**
 * Reusable surface card with the project's dark-theme styling.
 * Renders a <div> so it can be nested inside any semantic element.
 */
export function Card({ className = "", children, ...rest }: CardProps) {
  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 pb-0 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardContent({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-4 py-3 border-t border-gray-800 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

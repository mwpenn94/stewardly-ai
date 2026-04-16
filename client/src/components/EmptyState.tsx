/**
 * EmptyState — consistent empty-state UI for pages and sections.
 * Shows an icon, title, description, and optional CTA button.
 *
 * Pass 68 — C3 Progressive Disclosure + UX improvement.
 *
 * Usage:
 *   <EmptyState
 *     icon={<FileSearch className="h-12 w-12" />}
 *     title="No results found"
 *     description="Try adjusting your search or filter criteria."
 *     action={{ label: "Clear filters", onClick: clearFilters }}
 *   />
 */
import { Button } from "@/components/ui/button";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Custom icon (defaults to Inbox) */
  icon?: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Optional CTA button */
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  /** Additional CSS classes */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    >
      <div className="text-muted-foreground/40 mb-4">
        {icon ?? <Inbox className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={action.variant ?? "outline"}
          size="sm"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;

/**
 * EmptyState — A warm, encouraging empty state component that makes
 * "no data" feel like potential, not absence.
 *
 * Usage:
 *   <EmptyState
 *     icon={<FileText className="w-8 h-8" />}
 *     title="No documents yet"
 *     description="Upload your first document to get started with AI-powered analysis."
 *     action={{ label: "Upload Document", onClick: () => {} }}
 *   />
 */
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  /** Compact mode for inline/card usage */
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-8 px-4" : "py-16 px-6"
      } ${className}`}
    >
      {/* Warm glow behind icon */}
      {icon && (
        <div className="relative mb-4">
          <div className="absolute inset-0 blur-2xl opacity-20 bg-accent rounded-full scale-150" />
          <div className="relative text-accent/70 animate-in fade-in zoom-in-95 duration-500">
            {icon}
          </div>
        </div>
      )}

      <h3
        className={`font-heading font-semibold text-foreground/90 ${
          compact ? "text-sm" : "text-base"
        } animate-in fade-in slide-in-from-bottom-2 duration-500`}
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        {title}
      </h3>

      {description && (
        <p
          className={`mt-2 text-muted-foreground max-w-sm leading-relaxed ${
            compact ? "text-xs" : "text-sm"
          } animate-in fade-in slide-in-from-bottom-2 duration-500`}
          style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div
          className="mt-5 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500"
          style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
        >
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "default"}
              size={compact ? "sm" : "default"}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant || "ghost"}
              size={compact ? "sm" : "default"}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

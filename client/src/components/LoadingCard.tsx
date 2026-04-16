/**
 * LoadingCard — consistent loading skeleton for card-based layouts.
 * Shows animated shimmer placeholders that match the card structure.
 *
 * Pass 68 — UX improvement for loading states.
 *
 * Usage:
 *   {isLoading ? <LoadingCard lines={4} /> : <ActualContent />}
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingCardProps {
  /** Number of content lines to show (default: 3) */
  lines?: number;
  /** Show a header skeleton (default: true) */
  showHeader?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function LoadingCard({
  lines = 3,
  showHeader = true,
  className = "",
}: LoadingCardProps) {
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2 mt-1" />
        </CardHeader>
      )}
      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${85 - i * 10}%` }}
          />
        ))}
      </CardContent>
    </Card>
  );
}

/** Grid of loading cards for dashboard-style layouts */
export function LoadingCardGrid({
  count = 6,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <LoadingCard key={i} />
      ))}
    </div>
  );
}

export default LoadingCard;

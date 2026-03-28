/**
 * PageSuspenseFallback — A polished full-page loading skeleton shown while
 * lazy-loaded route components are being fetched. Matches the app's dark
 * theme and provides a smooth transition experience.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function PageSuspenseFallback() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Simulated top nav bar */}
      <div className="border-b border-border/40 px-6 py-4 flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Main content area */}
      <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {/* Page title */}
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96 mb-8" />

        {/* Content cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/40 bg-card p-5 space-y-3"
            >
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-20 w-full rounded-lg mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

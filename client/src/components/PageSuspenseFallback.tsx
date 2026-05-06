/**
 * PageSuspenseFallback — A polished full-page loading skeleton shown while
 * lazy-loaded route components are being fetched. Uses warm gold shimmer
 * that matches the Stewardship Gold design system.
 */

export default function PageSuspenseFallback() {
  return (
    <div className="min-h-screen bg-background flex flex-col animate-page-enter">
      {/* Simulated top nav bar */}
      <div className="border-b border-border/40 px-6 py-4 flex items-center gap-4">
        <div className="skeleton-gold h-8 w-8 rounded-lg" />
        <div className="skeleton-gold h-5 w-32 rounded" />
        <div className="flex-1" />
        <div className="skeleton-gold h-8 w-8 rounded-full" />
      </div>

      {/* Main content area */}
      <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {/* Page title */}
        <div className="skeleton-gold h-8 w-64 mb-2 rounded" />
        <div className="skeleton-gold h-4 w-96 mb-8 rounded" />

        {/* Content cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/40 bg-card p-5 space-y-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="skeleton-gold h-5 w-3/4 rounded" />
              <div className="skeleton-gold h-4 w-full rounded" />
              <div className="skeleton-gold h-4 w-5/6 rounded" />
              <div className="skeleton-gold h-20 w-full rounded-lg mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

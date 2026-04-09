/**
 * UX Resilience Tests
 * Covers: toast notifications on retry exhaustion, offline banner, Suspense boundaries
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const clientDir = resolve(__dirname, "../client/src");

function readClient(relPath: string): string {
  return readFileSync(resolve(clientDir, relPath), "utf-8");
}

// ─── Toast Notifications on Retry Exhaustion ──────────────────────────

describe("Toast notifications on retry exhaustion", () => {
  const mainTsx = readClient("main.tsx");

  it("imports toast from sonner", () => {
    expect(mainTsx).toContain('import { toast } from "sonner"');
  });

  it("has showRetryExhaustedToast function", () => {
    expect(mainTsx).toContain("function showRetryExhaustedToast");
  });

  it("shows toast.error with retry action when retries exhausted", () => {
    expect(mainTsx).toContain('toast.error("Something didn\'t work \u2014 let\'s try again"');
    expect(mainTsx).toContain('label: "Retry"');
  });

  it("deduplicates toasts using _recentErrorToasts set", () => {
    expect(mainTsx).toContain("_recentErrorToasts");
    expect(mainTsx).toContain("new Set<string>()");
    // 30s cooldown before allowing re-show
    expect(mainTsx).toContain("30_000");
  });

  it("checks fetchFailureCount against retry count before showing toast", () => {
    expect(mainTsx).toContain("fetchFailureCount");
    expect(mainTsx).toContain("maxRetries");
  });

  it("skips auth redirect errors in toast handler", () => {
    expect(mainTsx).toContain("UNAUTHED_ERR_MSG");
    // The showRetryExhaustedToast function checks for auth errors
    expect(mainTsx).toMatch(/if.*TRPCClientError.*UNAUTHED_ERR_MSG.*return/s);
  });

  it("shows mutation failure toasts only when no custom onError handler exists", () => {
    expect(mainTsx).toContain("event.mutation.options.onError");
    expect(mainTsx).toContain('toast.error("That didn\'t go through"');
  });

  it("truncates long error messages to 120 chars", () => {
    expect(mainTsx).toContain("message.length > 120");
    expect(mainTsx).toContain("message.slice(0, 117)");
  });

  it("invalidates queries on retry button click", () => {
    expect(mainTsx).toContain("queryClient.invalidateQueries");
  });
});

// ─── Offline / Reconnection Banner ────────────────────────────────────

describe("Offline/reconnection banner", () => {
  const banner = readClient("components/OfflineBanner.tsx");
  const appTsx = readClient("App.tsx");

  it("exports a default OfflineBanner component", () => {
    expect(banner).toContain("export default function OfflineBanner");
  });

  it("uses navigator.onLine for initial state", () => {
    expect(banner).toContain("navigator.onLine");
  });

  it("listens to online and offline window events", () => {
    expect(banner).toContain('addEventListener("offline"');
    expect(banner).toContain('addEventListener("online"');
  });

  it("cleans up event listeners on unmount", () => {
    expect(banner).toContain('removeEventListener("offline"');
    expect(banner).toContain('removeEventListener("online"');
  });

  it("has three states: hidden, offline, reconnected", () => {
    expect(banner).toContain('"hidden"');
    expect(banner).toContain('"offline"');
    expect(banner).toContain('"reconnected"');
  });

  it("auto-dismisses reconnected state after 3 seconds", () => {
    expect(banner).toContain("3000");
    expect(banner).toContain('setState("hidden")');
  });

  it("uses role=alert and aria-live=assertive for accessibility", () => {
    expect(banner).toContain('role="alert"');
    expect(banner).toContain('aria-live="assertive"');
  });

  it("shows WifiOff icon when offline and Wifi icon when reconnected", () => {
    expect(banner).toContain("WifiOff");
    expect(banner).toContain("Wifi");
  });

  it("is mounted in App.tsx", () => {
    expect(appTsx).toContain("OfflineBanner");
    expect(appTsx).toContain("<OfflineBanner />");
  });

  it("renders above other content with z-[100]", () => {
    expect(banner).toContain("z-[100]");
  });
});

// ─── Suspense Boundaries with Lazy Loading ────────────────────────────

describe("Suspense boundaries with lazy loading", () => {
  const appTsx = readClient("App.tsx");

  it("imports React.lazy and Suspense", () => {
    expect(appTsx).toContain("lazy");
    expect(appTsx).toContain("Suspense");
    expect(appTsx).toMatch(/import.*{.*lazy.*Suspense.*}.*from.*"react"/);
  });

  it("wraps Router Switch in Suspense with PageSuspenseFallback", () => {
    expect(appTsx).toContain("<Suspense fallback={<PageSuspenseFallback />}>");
    expect(appTsx).toContain("</Suspense>");
  });

  it("eagerly loads critical path pages (Landing, Chat, SignIn)", () => {
    // These should be regular imports, not lazy
    expect(appTsx).toMatch(/^import Landing from/m);
    expect(appTsx).toMatch(/^import Chat from/m);
    expect(appTsx).toMatch(/^import SignIn from/m);
  });

  it("lazy-loads non-critical pages", () => {
    const lazyPages = [
      "Calculators", "Products", "ManagerDashboard", "SettingsHub",
      "Integrations", "OperationsHub", "IntelligenceHub", "AdvisoryHub",
      "RelationshipsHub", "Help", "MarketData", "PassiveActions",
    ];
    for (const page of lazyPages) {
      expect(appTsx).toContain(`const ${page} = lazy(`);
    }
  });

  it("handles PartGPages named exports with .then() wrapper", () => {
    expect(appTsx).toContain('import("./pages/PartGPages").then(m => ({ default: m.InsuranceApplications }))');
    expect(appTsx).toContain('import("./pages/PartGPages").then(m => ({ default: m.AdvisoryExecution }))');
    expect(appTsx).toContain('import("./pages/PartGPages").then(m => ({ default: m.CarrierConnector }))');
  });

  it("keeps Terms, Privacy, Welcome eagerly loaded (public critical)", () => {
    expect(appTsx).toMatch(/^import Terms from/m);
    expect(appTsx).toMatch(/^import Privacy from/m);
    expect(appTsx).toMatch(/^import Welcome from/m);
  });
});

// ─── PageSuspenseFallback Component ───────────────────────────────────

describe("PageSuspenseFallback component", () => {
  const fallback = readClient("components/PageSuspenseFallback.tsx");

  it("exports a default component", () => {
    expect(fallback).toContain("export default function PageSuspenseFallback");
  });

  it("uses skeleton loading indicators for loading state", () => {
    expect(fallback).toContain("skeleton-gold");
  });

  it("renders a grid of placeholder cards", () => {
    expect(fallback).toContain("grid");
    expect(fallback).toContain("grid-cols-1");
    expect(fallback).toContain("md:grid-cols-2");
    expect(fallback).toContain("lg:grid-cols-3");
  });

  it("includes simulated nav bar skeleton", () => {
    expect(fallback).toContain("border-b");
    expect(fallback).toContain("rounded-full"); // avatar skeleton
  });
});

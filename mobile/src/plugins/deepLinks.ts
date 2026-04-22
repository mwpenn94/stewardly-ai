/**
 * §P1-1 Mobile-native shell — Deep Link Routes
 * Handles universal links (iOS) and app links (Android).
 * Maps deep link URLs to SPA routes.
 */

interface DeepLinkMatch {
  route: string;
  params: Record<string, string>;
}

/** Deep link route patterns */
const DEEP_LINK_ROUTES: Array<{ pattern: RegExp; route: string; paramNames: string[] }> = [
  // Learning routes
  { pattern: /\/learning\/track\/(\d+)/, route: "/learning/track/:id", paramNames: ["id"] },
  { pattern: /\/learning\/flashcards\/(\d+)/, route: "/learning/flashcards/:trackId", paramNames: ["trackId"] },
  { pattern: /\/learning\/quiz\/(\d+)/, route: "/learning/quiz/:trackId", paramNames: ["trackId"] },
  { pattern: /\/learning\/chapter\/(\d+)/, route: "/learning/chapter/:id", paramNames: ["id"] },

  // Chat routes
  { pattern: /\/chat\/(\d+)/, route: "/chat/:id", paramNames: ["id"] },
  { pattern: /\/chat$/, route: "/chat", paramNames: [] },

  // Wealth engine routes
  { pattern: /\/wealth-engine\/client\/(\d+)/, route: "/wealth-engine/client/:id", paramNames: ["id"] },
  { pattern: /\/wealth-engine$/, route: "/wealth-engine", paramNames: [] },

  // Dashboard
  { pattern: /\/dashboard$/, route: "/dashboard", paramNames: [] },
  { pattern: /\/$/, route: "/", paramNames: [] },
];

/**
 * Match a deep link URL to an SPA route.
 */
export function matchDeepLink(url: string): DeepLinkMatch | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    for (const { pattern, route, paramNames } of DEEP_LINK_ROUTES) {
      const match = path.match(pattern);
      if (match) {
        const params: Record<string, string> = {};
        paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        return { route: path, params };
      }
    }

    // Fallback: use the path directly
    return { route: path, params: {} };
  } catch {
    return null;
  }
}

/**
 * Initialize deep link listener.
 * Call once at app startup (after Capacitor is ready).
 */
export async function initDeepLinks(): Promise<void> {
  try {
    const { App } = await import("@capacitor/app");

    // Handle app opened via deep link
    App.addListener("appUrlOpen", (event: { url: string }) => {
      const match = matchDeepLink(event.url);
      if (match) {
        // Navigate using SPA router
        window.history.pushState({}, "", match.route);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    });

    // Handle app state changes (resume from background)
    App.addListener("appStateChange", (state: { isActive: boolean }) => {
      if (state.isActive) {
        // App resumed — trigger sync of offline data
        window.dispatchEvent(new CustomEvent("app-resumed"));
      }
    });
  } catch {
    // Not running in Capacitor (web fallback)
    console.log("[DeepLinks] Not available (web environment)");
  }
}

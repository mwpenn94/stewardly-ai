/**
 * Task #43 — PWA + Offline Mode Service
 * Service worker config, offline queue, and sync management
 */

export interface OfflineAction {
  id: string;
  type: "message" | "feedback" | "calculator" | "document_view";
  payload: any;
  timestamp: number;
  synced: boolean;
}

export interface PWAConfig {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  display: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  orientation: "portrait" | "landscape" | "any";
  startUrl: string;
  scope: string;
  icons: Array<{ src: string; sizes: string; type: string }>;
  categories: string[];
  offlineCapabilities: string[];
}

export function getPWAManifest(): PWAConfig {
  return {
    name: "Stewardly — Your Digital Financial Twin",
    shortName: "Stewardly",
    description: "AI-powered financial advisory platform with personalized insights",
    themeColor: "#0F172A",
    backgroundColor: "#0F172A",
    display: "standalone",
    orientation: "any",
    startUrl: "/",
    scope: "/",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    categories: ["finance", "productivity", "education"],
    offlineCapabilities: [
      "View cached conversations",
      "Access saved calculator results",
      "Browse cached knowledge articles",
      "Queue messages for sync",
      "View offline documents",
    ],
  };
}

export function getServiceWorkerConfig(): {
  cacheName: string;
  precacheUrls: string[];
  runtimeCacheStrategies: Array<{ pattern: string; strategy: string; maxAge: number }>;
} {
  return {
    cacheName: "stewardly-v1",
    precacheUrls: ["/", "/index.html", "/manifest.json"],
    runtimeCacheStrategies: [
      { pattern: "/api/trpc/knowledge.*", strategy: "stale-while-revalidate", maxAge: 3600 },
      { pattern: "/api/trpc/calculators.*", strategy: "cache-first", maxAge: 86400 },
      { pattern: "/api/trpc/products.*", strategy: "stale-while-revalidate", maxAge: 7200 },
      { pattern: "/api/trpc/auth.*", strategy: "network-first", maxAge: 0 },
      { pattern: "/api/trpc/chat.*", strategy: "network-only", maxAge: 0 },
    ],
  };
}

// Offline queue management (client-side would use IndexedDB)
const offlineQueue: OfflineAction[] = [];

export function queueOfflineAction(action: Omit<OfflineAction, "id" | "synced">): OfflineAction {
  const entry: OfflineAction = {
    ...action,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    synced: false,
  };
  offlineQueue.push(entry);
  return entry;
}

export function getPendingActions(): OfflineAction[] {
  return offlineQueue.filter(a => !a.synced);
}

export function markSynced(id: string): boolean {
  const action = offlineQueue.find(a => a.id === id);
  if (action) { action.synced = true; return true; }
  return false;
}

export function getOfflineStats(): { queued: number; synced: number; failed: number } {
  return {
    queued: offlineQueue.filter(a => !a.synced).length,
    synced: offlineQueue.filter(a => a.synced).length,
    failed: 0,
  };
}

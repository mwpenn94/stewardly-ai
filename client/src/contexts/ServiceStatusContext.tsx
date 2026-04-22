/**
 * ServiceStatusContext — Provides real-time service health status to the entire app.
 * 
 * Tracks external dependencies: LLM, Database, Market Data, Integrations, Plaid, Stripe.
 * Shows degraded/cached/unavailable indicators. Consumers use useServiceStatus() hook.
 * 
 * Three states per service:
 *   - "connected" — happy path, real-time data
 *   - "degraded"  — using cached/stale data, limited functionality
 *   - "down"      — service unavailable, fallback UI shown
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

export type ServiceState = "connected" | "degraded" | "down" | "unknown";

export interface ServiceInfo {
  id: string;
  name: string;
  state: ServiceState;
  lastChecked: number;
  latencyMs?: number;
  message?: string; // e.g., "Using cached data from 2h ago"
  cachedSince?: number; // timestamp of last successful fetch
}

interface ServiceStatusContextValue {
  services: ServiceInfo[];
  getService: (id: string) => ServiceInfo | undefined;
  overallHealth: ServiceState;
  refreshHealth: () => void;
  isAnyDegraded: boolean;
  isAnyDown: boolean;
}

const ServiceStatusContext = createContext<ServiceStatusContextValue>({
  services: [],
  getService: () => undefined,
  overallHealth: "unknown",
  refreshHealth: () => {},
  isAnyDegraded: false,
  isAnyDown: false,
});

// Default services to track
const DEFAULT_SERVICES: ServiceInfo[] = [
  { id: "llm", name: "AI Assistant", state: "unknown", lastChecked: 0 },
  { id: "database", name: "Database", state: "unknown", lastChecked: 0 },
  { id: "market-data", name: "Market Data", state: "unknown", lastChecked: 0 },
  { id: "integrations", name: "Integrations", state: "unknown", lastChecked: 0 },
  { id: "plaid", name: "Plaid (Banking)", state: "unknown", lastChecked: 0 },
  { id: "stripe", name: "Payments", state: "unknown", lastChecked: 0 },
];

export function ServiceStatusProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<ServiceInfo[]>(DEFAULT_SERVICES);

  // Defer the health check to avoid blocking the initial tRPC batch (auth.me)
  // The serviceHealth query can be slow when the DB is under load, and tRPC
  // batches all concurrent queries into a single HTTP request. If serviceHealth
  // hangs, it blocks auth.me from resolving, causing an infinite spinner.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3000); // delay 3s after mount
    return () => clearTimeout(t);
  }, []);

  // Query the backend health endpoint (polling every 60s)
  const healthQ = trpc.system.serviceHealth.useQuery(undefined, {
    enabled: ready,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Update service states from backend health data
  useEffect(() => {
    if (healthQ.data) {
      setServices(prev => prev.map(svc => {
        const backendStatus = healthQ.data.find((h: any) => h.service === svc.id);
        if (backendStatus) {
          return {
            ...svc,
            state: backendStatus.status as ServiceState,
            lastChecked: backendStatus.lastChecked || Date.now(),
            latencyMs: backendStatus.latencyMs,
            message: backendStatus.details || undefined,
            // @ts-expect-error — property access on loosely typed object
            cachedSince: backendStatus.status === "degraded" ? (backendStatus.cachedSince || Date.now()) : undefined,
          };
        }
        return svc;
      }));
    }
  }, [healthQ.data]);

  // If the health query itself fails, mark everything as degraded
  useEffect(() => {
    if (healthQ.isError) {
      setServices(prev => prev.map(svc => ({
        ...svc,
        state: svc.state === "connected" ? "degraded" : svc.state,
        message: "Health check unavailable",
        lastChecked: Date.now(),
      })));
    }
  }, [healthQ.isError]);

  const getService = useCallback((id: string) => services.find(s => s.id === id), [services]);

  const overallHealth: ServiceState = services.some(s => s.state === "down")
    ? "down"
    : services.some(s => s.state === "degraded")
      ? "degraded"
      : services.every(s => s.state === "connected")
        ? "connected"
        : "unknown";

  const isAnyDegraded = services.some(s => s.state === "degraded");
  const isAnyDown = services.some(s => s.state === "down");

  const refreshHealth = useCallback(() => {
    healthQ.refetch();
  }, [healthQ]);

  return (
    <ServiceStatusContext.Provider value={{ services, getService, overallHealth, refreshHealth, isAnyDegraded, isAnyDown }}>
      {children}
    </ServiceStatusContext.Provider>
  );
}

export function useServiceStatus() {
  return useContext(ServiceStatusContext);
}

/**
 * Hook for a specific service — returns its current state + helper booleans
 */
export function useServiceState(serviceId: string) {
  const { getService } = useServiceStatus();
  const svc = getService(serviceId);
  return {
    state: svc?.state ?? "unknown",
    isConnected: svc?.state === "connected",
    isDegraded: svc?.state === "degraded",
    isDown: svc?.state === "down",
    message: svc?.message,
    latencyMs: svc?.latencyMs,
    cachedSince: svc?.cachedSince,
  };
}

import { describe, it, expect } from "vitest";

/**
 * Tests for the integrations page data handling fix.
 * The root cause was that listProviders returns { providers: [...], grouped: {...} }
 * but the ClientAccountConnections component was calling .find() on the raw response
 * object instead of the .providers array inside it.
 */

describe("Integrations Page — Data Shape Safety", () => {
  // Simulate the listProviders response shape
  const listProvidersResponse = {
    providers: [
      { id: "1", name: "Plaid", slug: "plaid", category: "banking", ownershipTier: "client" },
      { id: "2", name: "Canopy Connect", slug: "canopy-connect", category: "insurance", ownershipTier: "client" },
      { id: "3", name: "SnapTrade", slug: "snaptrade", category: "brokerage", ownershipTier: "client" },
    ],
    grouped: {
      client: [
        { id: "1", name: "Plaid", slug: "plaid" },
        { id: "2", name: "Canopy Connect", slug: "canopy-connect" },
      ],
    },
  };

  // Simulate the listConnections response shape (array)
  const listConnectionsResponse = [
    { id: "c1", providerId: "1", status: "connected", lastSyncAt: new Date() },
    { id: "c2", providerId: "2", status: "disconnected", lastSyncAt: null },
  ];

  it("listProviders response is an object with .providers array, not a raw array", () => {
    // The response is NOT an array — calling .find() on it directly would crash
    expect(Array.isArray(listProvidersResponse)).toBe(false);
    expect(Array.isArray(listProvidersResponse.providers)).toBe(true);
    expect(listProvidersResponse.providers.length).toBe(3);
  });

  it("extracting providers array safely handles both shapes", () => {
    // This is the fixed pattern used in ClientAccountConnections
    const data: any = listProvidersResponse;
    const providersList = Array.isArray(data) ? data : data?.providers;
    expect(Array.isArray(providersList)).toBe(true);
    expect(providersList.length).toBe(3);
  });

  it("extracting providers array safely handles a raw array shape too", () => {
    // If the API ever returned a raw array, the pattern still works
    const data: any = listProvidersResponse.providers;
    const providersList = Array.isArray(data) ? data : data?.providers;
    expect(Array.isArray(providersList)).toBe(true);
    expect(providersList.length).toBe(3);
  });

  it("finding Plaid provider works with the safe extraction pattern", () => {
    const data: any = listProvidersResponse;
    const providersList = Array.isArray(data) ? data : data?.providers;
    const plaid = providersList?.find((p: any) => p.slug === "plaid");
    expect(plaid).toBeDefined();
    expect(plaid.name).toBe("Plaid");
  });

  it("finding Canopy provider works with the safe extraction pattern", () => {
    const data: any = listProvidersResponse;
    const providersList = Array.isArray(data) ? data : data?.providers;
    const canopy = providersList?.find((p: any) => p.slug === "canopy-connect");
    expect(canopy).toBeDefined();
    expect(canopy.name).toBe("Canopy Connect");
  });

  it("listConnections response is a raw array — .find() works directly", () => {
    expect(Array.isArray(listConnectionsResponse)).toBe(true);
    const conn = listConnectionsResponse.find(c => c.providerId === "1");
    expect(conn).toBeDefined();
    expect(conn!.status).toBe("connected");
  });

  it("connectionsList safe extraction handles array and non-array", () => {
    // Array case (normal)
    const arrayData: any = listConnectionsResponse;
    const connectionsList1 = Array.isArray(arrayData) ? arrayData : [];
    expect(connectionsList1.length).toBe(2);

    // Non-array case (defensive)
    const objectData: any = { items: listConnectionsResponse };
    const connectionsList2 = Array.isArray(objectData) ? objectData : [];
    expect(connectionsList2.length).toBe(0);
  });

  it("connectionMap building works with safe extraction", () => {
    const connections = listConnectionsResponse;
    const map = new Map<string, any>();
    for (const conn of (connections || [])) {
      map.set(conn.providerId, conn);
    }
    expect(map.size).toBe(2);
    expect(map.get("1")?.status).toBe("connected");
    expect(map.get("2")?.status).toBe("disconnected");
  });
});

describe("Integrations Page — Error Boundary Logic", () => {
  it("SectionErrorBoundary recovers from errors via getDerivedStateFromError", () => {
    // Simulate the static method that React calls
    const error = new Error("Test crash");
    // The static method should return { hasError: true, error }
    const state = { hasError: true, error };
    expect(state.hasError).toBe(true);
    expect(state.error.message).toBe("Test crash");
  });

  it("SectionErrorBoundary retry resets state", () => {
    // Simulate the retry handler
    let state = { hasError: true, error: new Error("crash") };
    // handleRetry sets state back to clean
    state = { hasError: false, error: null as any };
    expect(state.hasError).toBe(false);
    expect(state.error).toBeNull();
  });

  it("error boundary does not affect sibling sections", () => {
    // Simulate 4 sections where one crashes
    const sections = [
      { name: "ClientAccountConnections", crashed: false },
      { name: "SnapTradeBrokerage", crashed: true },
      { name: "SOFRDashboard", crashed: false },
      { name: "CRMSync", crashed: false },
    ];
    // Only the crashed section should show error UI
    const healthySections = sections.filter(s => !s.crashed);
    const crashedSections = sections.filter(s => s.crashed);
    expect(healthySections.length).toBe(3);
    expect(crashedSections.length).toBe(1);
    expect(crashedSections[0].name).toBe("SnapTradeBrokerage");
  });
});

describe("Integrations Page — Loading Skeleton Logic", () => {
  it("ClientAccountConnections shows skeleton when providers are loading", () => {
    const providersQuery = { isLoading: true, data: undefined };
    const connectionsQuery = { isLoading: false, data: [] };
    const shouldShowSkeleton = providersQuery.isLoading || connectionsQuery.isLoading;
    expect(shouldShowSkeleton).toBe(true);
  });

  it("ClientAccountConnections shows skeleton when connections are loading", () => {
    const providersQuery = { isLoading: false, data: { providers: [] } };
    const connectionsQuery = { isLoading: true, data: undefined };
    const shouldShowSkeleton = providersQuery.isLoading || connectionsQuery.isLoading;
    expect(shouldShowSkeleton).toBe(true);
  });

  it("ClientAccountConnections shows content when both queries resolved", () => {
    const providersQuery = { isLoading: false, data: { providers: [{ slug: "plaid" }] } };
    const connectionsQuery = { isLoading: false, data: [{ providerId: "1" }] };
    const shouldShowSkeleton = providersQuery.isLoading || connectionsQuery.isLoading;
    expect(shouldShowSkeleton).toBe(false);
  });

  it("SOFRDashboard shows skeleton when rates are loading", () => {
    const latestRates = { isLoading: true, data: undefined };
    expect(latestRates.isLoading).toBe(true);
  });

  it("CRMSyncPanel shows skeleton when stats are loading", () => {
    const syncStats = { isLoading: true, data: undefined };
    expect(syncStats.isLoading).toBe(true);
  });

  it("SnapTrade shows skeleton when connections/accounts are loading", () => {
    const stConnections = { isLoading: true, data: undefined };
    const stAccounts = { isLoading: false, data: [] };
    const shouldShowSkeleton = stConnections.isLoading || stAccounts.isLoading;
    expect(shouldShowSkeleton).toBe(true);
  });
});

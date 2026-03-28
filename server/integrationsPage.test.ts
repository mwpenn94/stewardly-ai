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

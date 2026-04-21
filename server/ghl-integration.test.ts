import { describe, it, expect } from "vitest";

describe("GoHighLevel Integration", () => {
  it("should have GHL_API_KEY environment variable set", () => {
    const apiKey = process.env.GHL_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");
    expect(apiKey).toMatch(/^pit-/); // GHL private integration tokens start with "pit-"
  });

  it("should have GHL_LOCATION_ID environment variable set", () => {
    const locationId = process.env.GHL_LOCATION_ID;
    expect(locationId).toBeDefined();
    expect(locationId).not.toBe("");
  });

  it("should successfully authenticate with GoHighLevel API", async () => {
    const apiKey = process.env.GHL_API_KEY;
    const locationId = process.env.GHL_LOCATION_ID;

    // Call a lightweight GHL API endpoint to verify the token works
    const response = await fetch(
      `https://services.leadconnectorhq.com/locations/${locationId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
      }
    );

    // The API should return 200 for a valid token
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toBeDefined();
    // The location object should have an id matching our location ID
    if (data.location) {
      expect(data.location.id).toBe(locationId);
    }
  });
});

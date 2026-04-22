import { describe, it, expect } from "vitest";

describe("Resend API Key Validation", () => {
  it("should have RESEND_API_KEY environment variable set", () => {
    const key = process.env.RESEND_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
    expect(key!.startsWith("re_")).toBe(true);
  });

  it("should be able to reach Resend API with the key", async () => {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.log("RESEND_API_KEY not set, skipping API test");
      return;
    }

    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    // 200 = valid key with domains, 401 = invalid key
    // Any non-401 response means the key is valid
    expect(response.status).not.toBe(401);
    console.log(`Resend API responded with status ${response.status}`);
  });
});

import { describe, it, expect } from "vitest";

describe("Environment secrets validation", () => {
  it("VITE_FRONTEND_FORGE_API_URL should be set and be a valid URL", () => {
    const url = process.env.VITE_FRONTEND_FORGE_API_URL;
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https?:\/\//);
  });

  it("STRIPE_SECRET_KEY should be set", () => {
    const key = process.env.STRIPE_SECRET_KEY;
    expect(key).toBeTruthy();
    expect(key).toMatch(/^sk_(test|live)_/);
  });

  it("VITE_STRIPE_PUBLISHABLE_KEY should be set", () => {
    const key = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    expect(key).toBeTruthy();
    expect(key).toMatch(/^pk_(test|live)_/);
  });

  it("STRIPE_WEBHOOK_SECRET should be set", () => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    expect(secret).toBeTruthy();
    expect(secret).toMatch(/^whsec_/);
  });
});

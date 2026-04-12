import { describe, it, expect } from "vitest";
import {
  summarizeEvent,
  eventBadgeColor,
  formatBytes,
  BACKOFF_MS,
  type AutomationTelemetryEvent,
} from "./useAutomationTelemetryStream";

describe("formatBytes", () => {
  it("formats under 1 KB", () => {
    expect(formatBytes(512)).toBe("512B");
  });
  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.0KB");
  });
  it("formats MB", () => {
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0MB");
  });
});

describe("summarizeEvent", () => {
  it("summarizes request.start", () => {
    const s = summarizeEvent({
      type: "request.start",
      url: "https://ex.com/a",
      host: "ex.com",
      at: 0,
    });
    expect(s).toContain("ex.com");
    expect(s).toContain("/a");
  });
  it("flags revalidating on stale start", () => {
    const s = summarizeEvent({
      type: "request.start",
      url: "https://ex.com/a",
      host: "ex.com",
      at: 0,
      cacheState: "hit-stale",
      revalidating: true,
    });
    expect(s).toContain("revalidating");
  });
  it("summarizes request.network with status + time", () => {
    const s = summarizeEvent({
      type: "request.network",
      url: "https://ex.com/",
      host: "ex.com",
      status: 200,
      bytes: 1024,
      fetchMs: 42,
      at: 0,
      revalidated: false,
    });
    expect(s).toContain("200");
    expect(s).toContain("1.0KB");
    expect(s).toContain("42ms");
  });
  it("flags 304 revalidation", () => {
    const s = summarizeEvent({
      type: "request.network",
      url: "https://ex.com/",
      host: "ex.com",
      status: 304,
      bytes: 0,
      fetchMs: 5,
      at: 0,
      revalidated: true,
    });
    expect(s).toContain("revalidated");
  });
  it("summarizes cache hits with an emoji prefix", () => {
    const s = summarizeEvent({
      type: "request.cached",
      url: "https://ex.com/",
      host: "ex.com",
      cacheState: "hit-fresh",
      bytes: 500,
      at: 0,
    });
    expect(s).toContain("ex.com");
    expect(s).toContain("cache hit-fresh");
  });
  it("summarizes blocked events with reason", () => {
    const s = summarizeEvent({
      type: "request.blocked",
      url: "https://ex.com/",
      host: "ex.com",
      reason: "BLOCKED_BY_ROBOTS",
      at: 0,
      detail: "disallow /",
    });
    expect(s).toContain("BLOCKED_BY_ROBOTS");
    expect(s).toContain("disallow /");
  });
  it("summarizes errors with code + message", () => {
    const s = summarizeEvent({
      type: "request.error",
      url: "https://ex.com/",
      host: "ex.com",
      code: "TIMEOUT",
      message: "fetch timed out",
      at: 0,
    });
    expect(s).toContain("TIMEOUT");
    expect(s).toContain("timed out");
  });
});

describe("eventBadgeColor", () => {
  it.each<[AutomationTelemetryEvent["type"], string]>([
    ["request.cached", "emerald"],
    ["request.blocked", "amber"],
    ["request.error", "red"],
    ["request.start", "muted"],
  ])("returns %s color for %s", (kind, expected) => {
    const ev = {
      type: kind,
      url: "https://ex.com/",
      host: "ex.com",
      at: 0,
    } as any;
    if (kind === "request.cached") {
      ev.cacheState = "hit-fresh";
      ev.bytes = 100;
    }
    if (kind === "request.blocked") ev.reason = "BLOCKED_HOST";
    if (kind === "request.error") {
      ev.code = "X";
      ev.message = "Y";
    }
    expect(eventBadgeColor(ev)).toBe(expected);
  });
  it("returns red for 4xx/5xx network", () => {
    expect(
      eventBadgeColor({
        type: "request.network",
        url: "https://ex.com/",
        host: "ex.com",
        status: 500,
        bytes: 0,
        fetchMs: 1,
        at: 0,
        revalidated: false,
      }),
    ).toBe("red");
  });
  it("returns blue for 2xx network", () => {
    expect(
      eventBadgeColor({
        type: "request.network",
        url: "https://ex.com/",
        host: "ex.com",
        status: 200,
        bytes: 0,
        fetchMs: 1,
        at: 0,
        revalidated: false,
      }),
    ).toBe("blue");
  });
});

describe("BACKOFF_MS", () => {
  it("is strictly non-decreasing and caps at 30s", () => {
    for (let i = 1; i < BACKOFF_MS.length; i++) {
      expect(BACKOFF_MS[i]).toBeGreaterThanOrEqual(BACKOFF_MS[i - 1]);
    }
    expect(BACKOFF_MS[BACKOFF_MS.length - 1]).toBeLessThanOrEqual(30000);
  });
});
